import { initDataViz, renderDataViz, clearDataViz } from './dataViz.js'

const STEP_DELAY_MS = 800

function arrayScenario() {
  const arr = [4, 2, 7, 1, 9]
  return arr.map((_, i) => ({
    vars: { nums: arr, i },
    prevVars: i === 0 ? null : { nums: arr, i: i - 1 },
  }))
}

function stackScenario() {
  const pushes = [3, 7, 1]
  const states = []

  let current = []
  for (const val of pushes) {
    const prev = [...current]
    current = [...current, val]
    states.push({
      vars: { stack: current },
      prevVars: states.length === 0 ? null : { stack: prev },
    })
  }

  // pop twice
  for (let p = 0; p < 2; p++) {
    const prev = [...current]
    current = current.slice(0, -1)
    states.push({
      vars: { stack: current },
      prevVars: { stack: prev },
    })
  }

  return states
}

function queueScenario() {
  const enqueues = ['A', 'B', 'C']
  const states = []

  let current = []
  for (const val of enqueues) {
    const prev = [...current]
    current = [...current, val]
    states.push({
      vars: { queue: current },
      prevVars: states.length === 0 ? null : { queue: prev },
    })
  }

  // dequeue twice
  for (let d = 0; d < 2; d++) {
    const prev = [...current]
    current = current.slice(1)
    states.push({
      vars: { queue: current },
      prevVars: { queue: prev },
    })
  }

  return states
}

function linkedListScenario() {
  const step1 = { val: 1, next: null }
  const step2 = { val: 1, next: { val: 2, next: null } }
  const step3 = { val: 1, next: { val: 2, next: { val: 3, next: null } } }
  const step4 = { val: 1, next: { val: 2, next: { val: 3, next: { val: 4, next: null } } } }

  return [
    { vars: { head: step1 }, prevVars: null },
    { vars: { head: step2 }, prevVars: { head: step1 } },
    { vars: { head: step3 }, prevVars: { head: step2 } },
    { vars: { head: step4 }, prevVars: { head: step3 } },
  ]
}

function binaryTreeScenario() {
  const root = {
    val: 5,
    left: { val: 3, left: null, right: null },
    right: { val: 8, left: null, right: null },
  }

  // Show tree growing: root alone → add left → add right
  const step1 = { val: 5, left: null, right: null }
  const step2 = { val: 5, left: { val: 3, left: null, right: null }, right: null }
  const step3 = root

  return [
    { vars: { tree: step1 }, prevVars: null },
    { vars: { tree: step2 }, prevVars: { tree: step1 } },
    { vars: { tree: step3 }, prevVars: { tree: step2 } },
  ]
}

function hashMapScenario() {
  const state1 = { a: 1 }
  const state2 = { a: 1, b: 2 }
  const state3 = { a: 1, b: 2, c: 3 }

  return [
    { vars: { map: state1 }, prevVars: null },
    { vars: { map: state2 }, prevVars: { map: state1 } },
    { vars: { map: state3 }, prevVars: { map: state2 } },
  ]
}

function sortingScenario() {
  const step1 = [5, 3, 8, 1, 4]
  const step2 = [3, 5, 8, 1, 4]
  const step3 = [3, 5, 1, 8, 4]
  const step4 = [1, 3, 4, 5, 8]

  return [
    { vars: { nums: step1 }, prevVars: null },
    { vars: { nums: step2 }, prevVars: { nums: step1 } },
    { vars: { nums: step3 }, prevVars: { nums: step2 } },
    { vars: { nums: step4 }, prevVars: { nums: step3 } },
  ]
}

function graphScenario() {
  const partial1 = { A: ['B'] }
  const partial2 = { A: ['B', 'C'], B: ['A'] }
  const partial3 = { A: ['B', 'C'], B: ['A'], C: ['A'] }
  const full = { A: ['B', 'C'], B: ['A'], C: ['A', 'D'], D: ['C'] }

  return [
    { vars: { graph: partial1 }, prevVars: null },
    { vars: { graph: partial2 }, prevVars: { graph: partial1 } },
    { vars: { graph: partial3 }, prevVars: { graph: partial2 } },
    { vars: { graph: full }, prevVars: { graph: partial3 } },
  ]
}

const SCENARIOS = {
  'array': arrayScenario,
  'stack': stackScenario,
  'queue': queueScenario,
  'linked-list': linkedListScenario,
  'binary-tree': binaryTreeScenario,
  'hash-map': hashMapScenario,
  'sorting': sortingScenario,
  'graph': graphScenario,
}

export function playIntroAnimation(canvas, structureType, onComplete) {
  const scenarioFn = SCENARIOS[structureType]
  if (!scenarioFn) {
    onComplete?.()
    return () => {}
  }

  initDataViz(canvas)

  const steps = scenarioFn()
  let cancelled = false
  let rafId = null
  let timeoutId = null
  let stepIndex = 0

  function runStep() {
    if (cancelled) return
    if (stepIndex >= steps.length) {
      clearDataViz()
      onComplete?.()
      return
    }

    const { vars, prevVars } = steps[stepIndex]
    renderDataViz(vars, prevVars ?? {})
    stepIndex++

    timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(runStep)
    }, STEP_DELAY_MS)
  }

  rafId = requestAnimationFrame(runStep)

  return function cancel() {
    cancelled = true
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (timeoutId !== null) clearTimeout(timeoutId)
    clearDataViz()
  }
}
