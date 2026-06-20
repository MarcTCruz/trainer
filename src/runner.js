const TIMEOUT_MS = 5000
const MAX_MEMORY_BYTES = 1024 * 1024 * 10

let quickJSModule = null
let qjsApi = null

async function loadQuickJS() {
  if (!qjsApi) {
    qjsApi = await import('quickjs-emscripten')
  }
  return qjsApi
}

export async function ensureQuickJS() {
  if (quickJSModule) return quickJSModule
  const { getQuickJS } = await loadQuickJS()
  quickJSModule = await getQuickJS()
  return quickJSModule
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((val, i) => deepEqual(val, b[i]))
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((k) => deepEqual(a[k], b[k]))
  }

  return false
}

export async function runExercise(userCode, exercise) {
  const QuickJS = await ensureQuickJS()
  const { shouldInterruptAfterDeadline } = await loadQuickJS()
  const vm = QuickJS.newContext()

  vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS))
  vm.runtime.setMemoryLimit(MAX_MEMORY_BYTES)

  const defineResult = vm.evalCode(userCode)
  if (defineResult.error) {
    const errorObj = vm.dump(defineResult.error)
    defineResult.error.dispose()
    vm.dispose()
    return {
      allPassed: false,
      error: formatError(errorObj),
      results: [],
    }
  }
  defineResult.value.dispose()

  const fnCheck = vm.evalCode(`typeof ${exercise.functionName}`)
  if (fnCheck.error) {
    fnCheck.error.dispose()
    vm.dispose()
    return {
      allPassed: false,
      error: `Function "${exercise.functionName}" is not defined.`,
      results: [],
    }
  }
  const fnType = vm.dump(fnCheck.value)
  fnCheck.value.dispose()

  if (fnType !== 'function') {
    vm.dispose()
    return {
      allPassed: false,
      error: `"${exercise.functionName}" is not a function (got ${fnType}).`,
      results: [],
    }
  }

  const results = []

  for (const tc of exercise.testCases) {
    const args = tc.input.map((v) => JSON.stringify(v)).join(', ')
    const callCode = `JSON.stringify(${exercise.functionName}(${args}))`

    const callResult = vm.evalCode(callCode)
    if (callResult.error) {
      const errorObj = vm.dump(callResult.error)
      callResult.error.dispose()
      results.push({
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: null,
        error: formatError(errorObj),
      })
      continue
    }

    const rawResult = vm.dump(callResult.value)
    callResult.value.dispose()

    let actual
    try {
      actual = JSON.parse(rawResult)
    } catch {
      actual = rawResult
    }

    const passed = deepEqual(actual, tc.expected)
    results.push({
      passed,
      input: tc.input,
      expected: tc.expected,
      actual,
    })
  }

  vm.dispose()

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

function formatError(errorObj) {
  if (typeof errorObj === 'string') return errorObj
  if (errorObj && errorObj.message) return errorObj.message
  return String(errorObj)
}
