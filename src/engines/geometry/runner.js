import primitivesSrc from './primitives.js?raw'
import { runInQuickJS } from '../quickjs-exec.js'

const STRIPPED_PRIMITIVES = primitivesSrc.replace(/^export\s+/gm, '')

export async function runGeometry(exercise, userCode) {
  return runInQuickJS(exercise, userCode, STRIPPED_PRIMITIVES + '\n')
}
