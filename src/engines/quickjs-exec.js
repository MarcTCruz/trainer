import { t } from '../i18n.js'
import { ensureQuickJS, loadQuickJS, TIMEOUT_MS, MAX_MEMORY_BYTES, deepEqual } from '../quickjs-loader.js'

export async function runInQuickJS(exercise, userCode, preamble = '') {
  const QuickJS = await ensureQuickJS()
  const { shouldInterruptAfterDeadline } = await loadQuickJS()
  const vm = QuickJS.newContext()

  vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS))
  vm.runtime.setMemoryLimit(MAX_MEMORY_BYTES)

  const defineResult = vm.evalCode(preamble + userCode)
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
      error: t('runner.fnNotDefined', { functionName: exercise.functionName }),
      results: [],
    }
  }
  const fnType = vm.dump(fnCheck.value)
  fnCheck.value.dispose()

  if (fnType !== 'function') {
    vm.dispose()
    return {
      allPassed: false,
      error: t('runner.notAFunction', { name: exercise.functionName, type: fnType }),
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
