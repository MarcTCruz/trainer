import { ensureQuickJS } from './quickjs-loader.js'
import { runStandardIO } from './engines/standard-io/runner.js'
import { runGeometry } from './engines/geometry/runner.js'

const ENGINE_STANDARD_IO = 'standard-io'
const ENGINE_GEOMETRY = 'geometry'

export async function evaluateExercise(exercise, userCode) {
  const engine = exercise.engine ?? ENGINE_STANDARD_IO
  if (engine === ENGINE_GEOMETRY) return runGeometry(exercise, userCode)
  return runStandardIO(exercise, userCode)
}

export { ensureQuickJS }
