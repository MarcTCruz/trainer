export const STACK_NAMES = new Set(['stack', 'queue', 'heap', 'result'])

const INDEX_NAMES = new Set(['i', 'j', 'idx', 'index', 'left', 'right', 'lo', 'hi', 'mid'])

export function collectIndices(vars) {
  const out = {}
  for (const [name, val] of Object.entries(vars)) {
    if (INDEX_NAMES.has(name) && typeof val === 'number' && Number.isInteger(val)) {
      out[name] = val
    }
  }
  return out
}

function isLinkedListNode(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    ('val' in v || 'value' in v) && 'next' in v
}

function isBinaryTreeNode(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    ('val' in v || 'value' in v) && ('left' in v || 'right' in v) &&
    !('next' in v)
}

function isAdjacencyList(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const vals = Object.values(v)
  if (vals.length === 0) return false
  const arrCount = vals.filter(x => Array.isArray(x)).length
  return arrCount / vals.length >= 0.6
}

function is2DGrid(v) {
  if (!Array.isArray(v) || v.length === 0) return false
  if (!Array.isArray(v[0])) return false
  const len = v[0].length
  return v.every(row => Array.isArray(row) && row.length === len)
}

function isPrimitiveDominant(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const vals = Object.values(v)
  if (vals.length === 0) return false
  const primCount = vals.filter(x =>
    x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
  ).length
  return primCount / vals.length > 0.5
}

function walkLinkedList(root) {
  const nodes = []
  const seen = new Set()
  let cur = root
  let hasCycle = false
  let cycleStart = null

  while (cur && typeof cur === 'object' && nodes.length < 100) {
    if (seen.has(cur)) {
      hasCycle = true
      cycleStart = cur.val ?? cur.value
      break
    }
    seen.add(cur)
    nodes.push(cur.val ?? cur.value)
    cur = cur.next
  }

  return { nodes, hasCycle, cycleStart }
}

function isSortingTransition(arr, prevArr) {
  if (!prevArr || !Array.isArray(prevArr)) return false
  if (arr.length !== prevArr.length) return false
  const sortedCur = JSON.stringify([...arr].sort((a, b) => {
    const sa = String(a)
    const sb = String(b)
    return sa < sb ? -1 : sa > sb ? 1 : 0
  }))
  const sortedPrev = JSON.stringify([...prevArr].sort((a, b) => {
    const sa = String(a)
    const sb = String(b)
    return sa < sb ? -1 : sa > sb ? 1 : 0
  }))
  return sortedCur === sortedPrev
}

function isStackLikeByChange(arr, prevArr) {
  if (!prevArr || !Array.isArray(prevArr)) return false
  return Math.abs(arr.length - prevArr.length) === 1
}

export function detectStructure(vars, prevVars) {
  if (!vars) return null

  for (const [name, val] of Object.entries(vars)) {
    // 1. linked-list
    if (isLinkedListNode(val)) {
      const { nodes, hasCycle, cycleStart } = walkLinkedList(val)
      return { type: 'linked-list', name, data: { nodes, hasCycle, cycleStart } }
    }
  }

  for (const [name, val] of Object.entries(vars)) {
    // 2. binary-tree
    if (isBinaryTreeNode(val)) {
      return { type: 'binary-tree', name, data: val }
    }
  }

  for (const [name, val] of Object.entries(vars)) {
    // 3. graph — Map adjacency, plain-object adjacency list, or 2D grid
    if (val instanceof Map) {
      return { type: 'graph', name, data: { kind: 'adjacency', raw: val } }
    }
    if (is2DGrid(val)) {
      return { type: 'graph', name, data: { kind: 'grid', raw: val } }
    }
    if (isAdjacencyList(val)) {
      return { type: 'graph', name, data: { kind: 'adjacency', raw: val } }
    }
  }

  for (const [name, val] of Object.entries(vars)) {
    // 4. hash-map — Map or primitive-dominant plain object
    if (val instanceof Map) {
      return { type: 'hash-map', name, data: [...val.entries()] }
    }
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && isPrimitiveDominant(val)) {
      return { type: 'hash-map', name, data: Object.entries(val) }
    }
  }

  // 5 & 6. stack / array — check stack first (subtype)
  // First pass: STACK_NAMES entries (explicit stack-like names)
  for (const stackName of STACK_NAMES) {
    if (stackName in vars && Array.isArray(vars[stackName])) {
      return { type: 'stack', name: stackName, data: vars[stackName] }
    }
  }

  // Second pass: first array — check if stack-like by change, else array/sorting
  for (const [name, val] of Object.entries(vars)) {
    if (Array.isArray(val)) {
      const prevArr = prevVars?.[name]
      if (isStackLikeByChange(val, prevArr)) {
        return { type: 'stack', name, data: val }
      }
      if (isSortingTransition(val, prevArr)) {
        return { type: 'sorting', name, data: val }
      }
      return { type: 'array', name, data: val }
    }
  }

  return null
}
