import { ensureQuickJS } from '../runner.js'

const MAX_STEPS = 50_000
const MAX_MEMORY_BYTES = 1024 * 1024 * 10
const TIMEOUT_MS = 5000
const INSTRUMENTATION_SYMBOLS = ['__step', '__callEnter', '__callExit']

function buildInterruptHandler(deadline, stepState) {
  return () => {
    if (Date.now() > deadline) return true
    if (stepState.count >= MAX_STEPS) {
      stepState.limitHit = true
      return true
    }
    return false
  }
}

function registerHostFunctions(vm, trace, callStack, callEvents, stepState) {
  const stepFn = vm.newFunction('__step', (lineHandle, varsHandle) => {
    stepState.count++
    trace.push({
      line: vm.getNumber(lineHandle),
      vars: vm.dump(varsHandle),
      depth: callStack.length,
    })
    return vm.undefined
  })
  vm.setProp(vm.global, '__step', stepFn)
  stepFn.dispose()

  const callEnterFn = vm.newFunction('__callEnter', (nameHandle, varsHandle) => {
    const name = vm.dump(nameHandle)
    const vars = vm.dump(varsHandle)
    callStack.push({ name, vars })
    callEvents.push({ type: 'enter', name, vars, traceIndex: trace.length })
    return vm.undefined
  })
  vm.setProp(vm.global, '__callEnter', callEnterFn)
  callEnterFn.dispose()

  const callExitFn = vm.newFunction('__callExit', () => {
    callStack.pop()
    callEvents.push({ type: 'exit', name: null, vars: null, traceIndex: trace.length })
    return vm.undefined
  })
  vm.setProp(vm.global, '__callExit', callExitFn)
  callExitFn.dispose()
}

function stripInstrumentationSymbols(message) {
  if (typeof message !== 'string') return message
  return INSTRUMENTATION_SYMBOLS.reduce(
    (msg, sym) => msg.replaceAll(sym, `<${sym}>`),
    message,
  )
}

function formatError(errorObj) {
  if (typeof errorObj === 'string') return stripInstrumentationSymbols(errorObj)
  if (errorObj?.message) return stripInstrumentationSymbols(errorObj.message)
  return stripInstrumentationSymbols(String(errorObj))
}

export async function captureTrace(instrumentedCode, exercise, testIndex = 0) {
  const QuickJS = await ensureQuickJS()

  const trace = []
  const callStack = []
  const callEvents = []
  const stepState = { count: 0, limitHit: false }

  const vm = QuickJS.newContext()
  try {
    vm.runtime.setMemoryLimit(MAX_MEMORY_BYTES)
    vm.runtime.setInterruptHandler(buildInterruptHandler(Date.now() + TIMEOUT_MS, stepState))

    registerHostFunctions(vm, trace, callStack, callEvents, stepState)

    const defineResult = vm.evalCode(instrumentedCode)
    if (defineResult.error) {
      const errorObj = vm.dump(defineResult.error)
      defineResult.error.dispose()
      return { trace, callEvents, error: formatError(errorObj), stepLimitHit: false }
    }
    defineResult.value.dispose()

    const tc = exercise.testCases[testIndex] ?? exercise.testCases[0]
    const args = tc.input.map((v) => JSON.stringify(v)).join(', ')
    const callResult = vm.evalCode(`JSON.stringify(${exercise.functionName}(${args}))`)
    if (callResult.error) {
      const errorObj = vm.dump(callResult.error)
      callResult.error.dispose()
      return {
        trace,
        callEvents,
        error: formatError(errorObj),
        stepLimitHit: stepState.limitHit,
      }
    }
    callResult.value.dispose()

    return { trace, callEvents, error: null, stepLimitHit: stepState.limitHit }
  } finally {
    vm.dispose()
  }
}
