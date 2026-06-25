export const TIMEOUT_MS = 5000
export const MAX_MEMORY_BYTES = 1024 * 1024 * 10

let quickJSModule = null
let qjsApi = null

export async function loadQuickJS() {
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

export function deepEqual(a, b) {
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
