// unit-role: contract — proves runGeometry injects stripped primitives into QuickJS, user code can call Point/Line/Circle/intersect, and POJO shapes marshal out correctly; also adversarial (syntax error path).
/**
 * Geometry engine integration test — real QuickJS, real primitives injection.
 *
 * Why a bun test (not Playwright):
 *   QuickJS WASM loads fine in Node/bun (confirmed by probe). The only
 *   Vite-specific construct in src/engines/geometry/runner.js is the `?raw`
 *   import. This test bypasses that single seam by reading primitives.js via
 *   fs.readFileSync and applying the same strip transform, then exercising
 *   the identical QuickJS logic. This proves:
 *     - STRIPPED_PRIMITIVES evals without 'export' syntax errors in QuickJS.
 *     - Point/Line/Circle/intersect are callable by user code inside the sandbox.
 *     - Returned POJO shapes ({kind,x,y} etc.) marshal out via JSON.stringify/parse.
 *     - deepEqual compares them correctly against tc.expected.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRIMITIVES_PATH = join(__dirname, '..', 'src', 'engines', 'geometry', 'primitives.js')

// Read and strip export keywords exactly as the geometry runner does at bundle time.
const primitivesSrc = readFileSync(PRIMITIVES_PATH, 'utf8')
const STRIPPED_PRIMITIVES = primitivesSrc.replace(/^export\s+/gm, '')

// ---------------------------------------------------------------------------
// Inline the geometry engine logic using the real quickjs-loader infra.
// We import from the loader directly (no ?raw needed).
// ---------------------------------------------------------------------------
import { ensureQuickJS, loadQuickJS, TIMEOUT_MS, MAX_MEMORY_BYTES, deepEqual } from '../src/quickjs-loader.js'
export { ensureQuickJS, deepEqual } // contract boundary: quickjs-loader infra used by geometry engine

async function runGeometryDirect(exercise, userCode) {
  const QuickJS = await ensureQuickJS()
  const { shouldInterruptAfterDeadline } = await loadQuickJS()
  const vm = QuickJS.newContext()

  vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS))
  vm.runtime.setMemoryLimit(MAX_MEMORY_BYTES)

  const sandboxCode = STRIPPED_PRIMITIVES + '\n' + userCode
  const defineResult = vm.evalCode(sandboxCode)
  if (defineResult.error) {
    const errorObj = vm.dump(defineResult.error)
    defineResult.error.dispose()
    vm.dispose()
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message ?? String(errorObj))
    return { allPassed: false, error: msg, results: [] }
  }
  defineResult.value.dispose()

  const results = []
  for (const tc of exercise.testCases) {
    const args = tc.input.map((v) => JSON.stringify(v)).join(', ')
    const callResult = vm.evalCode(`JSON.stringify(${exercise.functionName}(${args}))`)
    if (callResult.error) {
      const errorObj = vm.dump(callResult.error)
      callResult.error.dispose()
      const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message ?? String(errorObj))
      results.push({ passed: false, input: tc.input, expected: tc.expected, actual: null, error: msg })
      continue
    }
    const rawResult = vm.dump(callResult.value)
    callResult.value.dispose()
    let actual
    try { actual = JSON.parse(rawResult) } catch { actual = rawResult }
    results.push({ passed: deepEqual(actual, tc.expected), input: tc.input, expected: tc.expected, actual })
  }

  vm.dispose()
  return { allPassed: results.every((r) => r.passed), results }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('geometry engine — stripped primitives inject + QuickJS execution', () => {
  test('stripped primitives source has no export keywords', () => {
    expect(STRIPPED_PRIMITIVES).not.toMatch(/^export\s/m)
    // The four public names must still be present.
    expect(STRIPPED_PRIMITIVES).toContain('function Point(')
    expect(STRIPPED_PRIMITIVES).toContain('function Line(')
    expect(STRIPPED_PRIMITIVES).toContain('function Circle(')
    expect(STRIPPED_PRIMITIVES).toContain('function intersect(')
  })

  test('Point factory: user code calls Point(x,y) and POJO marshals out', async () => {
    const exercise = {
      functionName: 'buildPoint',
      testCases: [
        { input: [3, 4], expected: { kind: 'point', x: 3, y: 4 } },
        { input: [0, 0], expected: { kind: 'point', x: 0, y: 0 } },
        { input: [-1, 5], expected: { kind: 'point', x: -1, y: 5 } },
      ],
    }
    const userCode = 'function buildPoint(x, y) { return Point(x, y); }'
    const result = await runGeometryDirect(exercise, userCode)
    expect(result.allPassed).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.results[0].actual).toEqual({ kind: 'point', x: 3, y: 4 })
    expect(result.results[2].actual).toEqual({ kind: 'point', x: -1, y: 5 })
  })

  test('Line factory: user code builds a Line POJO and it marshals out', async () => {
    const exercise = {
      functionName: 'buildLine',
      testCases: [
        {
          input: [0, 0, 1, 1],
          expected: { kind: 'line', a: { kind: 'point', x: 0, y: 0 }, b: { kind: 'point', x: 1, y: 1 } },
        },
      ],
    }
    const userCode = 'function buildLine(ax, ay, bx, by) { return Line(Point(ax, ay), Point(bx, by)); }'
    const result = await runGeometryDirect(exercise, userCode)
    expect(result.allPassed).toBe(true)
    expect(result.results[0].actual.kind).toBe('line')
    expect(result.results[0].actual.a).toEqual({ kind: 'point', x: 0, y: 0 })
  })

  test('intersect: two crossing lines return one intersection point', async () => {
    // Line through (0,0)→(1,1) and line through (0,1)→(1,0) cross at (0.5, 0.5).
    const exercise = {
      functionName: 'findIntersection',
      testCases: [
        {
          input: [],
          expected: [{ kind: 'point', x: 0.5, y: 0.5 }],
        },
      ],
    }
    const userCode = `
function findIntersection() {
  var l1 = Line(Point(0, 0), Point(1, 1));
  var l2 = Line(Point(0, 1), Point(1, 0));
  return intersect(l1, l2);
}`
    const result = await runGeometryDirect(exercise, userCode)
    expect(result.allPassed).toBe(true)
    expect(result.results[0].actual).toHaveLength(1)
    expect(result.results[0].actual[0].kind).toBe('point')
    expect(result.results[0].actual[0].x).toBeCloseTo(0.5, 5)
    expect(result.results[0].actual[0].y).toBeCloseTo(0.5, 5)
  })

  test('Circle factory: user code returns Circle POJO', async () => {
    const exercise = {
      functionName: 'buildCircle',
      testCases: [
        {
          input: [0, 0, 5],
          expected: { kind: 'circle', center: { kind: 'point', x: 0, y: 0 }, radius: 5 },
        },
      ],
    }
    const userCode = 'function buildCircle(cx, cy, r) { return Circle(Point(cx, cy), r); }'
    const result = await runGeometryDirect(exercise, userCode)
    expect(result.allPassed).toBe(true)
    expect(result.results[0].actual).toEqual({
      kind: 'circle',
      center: { kind: 'point', x: 0, y: 0 },
      radius: 5,
    })
  })

  test('parallel lines return empty intersection array', async () => {
    const exercise = {
      functionName: 'parallelIntersect',
      testCases: [{ input: [], expected: [] }],
    }
    const userCode = `
function parallelIntersect() {
  var l1 = Line(Point(0, 0), Point(1, 0));
  var l2 = Line(Point(0, 1), Point(1, 1));
  return intersect(l1, l2);
}`
    const result = await runGeometryDirect(exercise, userCode)
    expect(result.allPassed).toBe(true)
    expect(result.results[0].actual).toEqual([])
  })

  test('syntax error in user code returns allPassed:false with error', async () => {
    const exercise = {
      functionName: 'bad',
      testCases: [{ input: [], expected: null }],
    }
    const result = await runGeometryDirect(exercise, 'function bad( { return Point(0,0); }')
    expect(result.allPassed).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.results).toHaveLength(0)
  })
})
