import { runInQuickJS } from '../quickjs-exec.js'

export async function runStandardIO(exercise, userCode) {
  return runInQuickJS(exercise, userCode)
}
