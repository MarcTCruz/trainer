import { detectStructure, collectIndices } from './vizDetectors.js'

const COLORS = {
  bg: '#1a1a2e',
  border: '#3d3d60',
  text: '#e0e0e0',
  textMuted: '#9494b8',
  accent: '#64ffda',
  accentDim: '#64ffda33',
  warning: '#ffb74d',
}

const INDEX_NAMES = new Set(['i', 'j', 'idx', 'index', 'left', 'right', 'lo', 'hi', 'mid'])
const STACK_NAMES = new Set(['stack', 'queue', 'heap', 'result'])

const MAX_ELEMENTS = 20
const BOX_HEIGHT = 36
const MIN_BOX_WIDTH = 40
const LABEL_HEIGHT = 18
const INDEX_LABEL_HEIGHT = 16
const PADDING = 12

let canvas = null
let ctx = null

export function initDataViz(c) {
  canvas = c
  ctx = canvas.getContext('2d')
}

export function clearDataViz() {
  if (!ctx) return
  syncCanvasSize()
  ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
}

function collectLinkedListNodes(root) {
  const nodes = []
  const seen = new Set()
  let cur = root
  while (cur && typeof cur === 'object' && !seen.has(cur) && nodes.length < 100) {
    seen.add(cur)
    nodes.push(cur.val ?? cur.value)
    cur = cur.next
  }
  return nodes
}

export function renderDataViz(vars, prevVars) {
  if (!ctx) return
  syncCanvasSize()

  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  ctx.clearRect(0, 0, w, h)

  const detected = detectStructure(vars, prevVars)
  if (!detected) {
    drawEmpty(w, h)
    return
  }

  const { type, name, data } = detected
  const indices = collectIndices(vars)

  switch (type) {
    case 'array':
      drawArray(name, data, prevVars?.[name], w, h, indices)
      break
    case 'sorting':
      drawSorting(name, data, prevVars?.[name], w, h, indices)
      break
    case 'stack':
      drawStack(name, data, prevVars?.[name], w, h, indices)
      break
    case 'linked-list':
      drawLinkedList(name, data.nodes, prevVars?.[name] ? collectLinkedListNodes(prevVars[name]) : null, w, h)
      break
    case 'binary-tree':
      drawTree(name, data, prevVars?.[name], w, h)
      break
    case 'hash-map':
      drawHashMap(name, data, prevVars?.[name] ? (prevVars[name] instanceof Map ? [...prevVars[name].entries()] : Object.entries(prevVars[name])) : null, w, h)
      break
    case 'graph':
      drawGraph(name, data, prevVars?.[name] ? { kind: data.kind, raw: prevVars[name] } : null, w, h)
      break
    default:
      drawEmpty(w, h)
  }
}

function syncCanvasSize() {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.scale(dpr, dpr)
  }
}

function drawEmpty(w, h) {
  ctx.font = '12px monospace'
  ctx.fillStyle = COLORS.textMuted
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('No array data', w / 2, h / 2)
}

function drawArray(name, arr, prevArr, w, h, indices) {
  const truncated = arr.length > MAX_ELEMENTS
  const visible = truncated ? arr.slice(0, MAX_ELEMENTS) : arr

  const usableW = w - PADDING * 2
  const boxW = Math.max(MIN_BOX_WIDTH, Math.floor(usableW / (visible.length + (truncated ? 0.5 : 0))))

  const totalW = boxW * visible.length + (truncated ? boxW * 0.5 : 0)
  const startX = PADDING + Math.max(0, (usableW - totalW) / 2)

  const labelY = PADDING
  const boxY = labelY + LABEL_HEIGHT + 4

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  for (let i = 0; i < visible.length; i++) {
    const x = startX + i * boxW
    const activeIndex = Object.values(indices).find(v => v === i)
    const isHighlighted = activeIndex !== undefined
    const prevVal = prevArr?.[i]
    const curVal = visible[i]
    const changed = prevArr !== undefined && JSON.stringify(prevVal) !== JSON.stringify(curVal)

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(x, boxY, boxW - 2, BOX_HEIGHT)

    if (isHighlighted) {
      ctx.fillStyle = COLORS.accentDim
      ctx.fillRect(x, boxY, boxW - 2, BOX_HEIGHT)
    }

    ctx.strokeStyle = isHighlighted ? COLORS.accent : changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = isHighlighted || changed ? 2 : 1
    ctx.strokeRect(x, boxY, boxW - 2, BOX_HEIGHT)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = formatCell(curVal, boxW - 6)
    ctx.fillText(label, x + (boxW - 2) / 2, boxY + BOX_HEIGHT / 2)

    ctx.font = '10px monospace'
    ctx.fillStyle = COLORS.textMuted
    ctx.textAlign = 'center'
    ctx.fillText(String(i), x + (boxW - 2) / 2, boxY + BOX_HEIGHT + INDEX_LABEL_HEIGHT / 2 + 2)
  }

  if (truncated) {
    const x = startX + visible.length * boxW
    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.textMuted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('…', x + boxW * 0.25, boxY + BOX_HEIGHT / 2)
  }
}

function drawStack(name, arr, prevArr, w, h, indices) {
  const truncated = arr.length > MAX_ELEMENTS
  const visible = truncated ? arr.slice(arr.length - MAX_ELEMENTS) : arr
  const offset = arr.length - visible.length

  const labelY = PADDING
  const usableH = h - labelY - LABEL_HEIGHT - 8 - INDEX_LABEL_HEIGHT
  const boxH = Math.min(BOX_HEIGHT, Math.floor(usableH / Math.max(visible.length, 1)))
  const boxW = Math.min(200, w - PADDING * 2 - 24)
  const startX = PADDING

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  const topY = labelY + LABEL_HEIGHT + 4

  for (let i = 0; i < visible.length; i++) {
    const stackIdx = i + offset
    const y = topY + (visible.length - 1 - i) * (boxH + 2)
    const curVal = visible[i]
    const prevVal = prevArr?.[stackIdx]
    const changed = prevArr !== undefined && JSON.stringify(prevVal) !== JSON.stringify(curVal)
    const isTop = i === visible.length - 1

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(startX, y, boxW, boxH)

    if (isTop) {
      ctx.fillStyle = COLORS.accentDim
      ctx.fillRect(startX, y, boxW, boxH)
    }

    ctx.strokeStyle = isTop ? COLORS.accent : changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = isTop || changed ? 2 : 1
    ctx.strokeRect(startX, y, boxW, boxH)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(curVal, boxW - 6), startX + boxW / 2, y + boxH / 2)
  }

  if (visible.length > 0) {
    const arrowX = startX + boxW + 6
    const topBoxY = topY
    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.accent
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('← top', arrowX, topBoxY + boxH / 2)
  }

  if (truncated) {
    ctx.font = '10px monospace'
    ctx.fillStyle = COLORS.textMuted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const y = topY + visible.length * (boxH + 2) + 4
    ctx.fillText(`… ${arr.length - MAX_ELEMENTS} more below`, startX + boxW / 2, y)
  }
}

function drawQueue(name, arr, prevArr, w, h, indices) {
  const truncated = arr.length > MAX_ELEMENTS
  const visible = truncated ? arr.slice(0, MAX_ELEMENTS) : arr

  const usableW = w - PADDING * 2
  const boxW = Math.max(MIN_BOX_WIDTH, Math.floor(usableW / (visible.length + (truncated ? 0.5 : 0))))

  const totalW = boxW * visible.length + (truncated ? boxW * 0.5 : 0)
  const startX = PADDING + Math.max(0, (usableW - totalW) / 2)

  const labelY = PADDING
  const boxY = labelY + LABEL_HEIGHT + 4

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  for (let i = 0; i < visible.length; i++) {
    const x = startX + i * boxW
    const isHead = i === 0
    const prevVal = prevArr?.[i]
    const curVal = visible[i]
    const changed = prevArr !== undefined && JSON.stringify(prevVal) !== JSON.stringify(curVal)

    ctx.fillStyle = isHead ? COLORS.accentDim : COLORS.bg
    ctx.fillRect(x, boxY, boxW - 2, BOX_HEIGHT)

    ctx.strokeStyle = isHead ? COLORS.accent : changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = isHead || changed ? 2 : 1
    ctx.strokeRect(x, boxY, boxW - 2, BOX_HEIGHT)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(curVal, boxW - 6), x + (boxW - 2) / 2, boxY + BOX_HEIGHT / 2)
  }

  if (visible.length > 0) {
    const headX = startX
    const tailX = startX + (visible.length - 1) * boxW
    const labelY2 = boxY + BOX_HEIGHT + INDEX_LABEL_HEIGHT / 2 + 2

    ctx.font = '10px monospace'
    ctx.fillStyle = COLORS.textMuted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('← head', headX, labelY2)

    ctx.textAlign = 'right'
    ctx.fillText('tail →', tailX + boxW - 2, labelY2)
  }

  if (truncated) {
    const x = startX + visible.length * boxW
    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.textMuted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('…', x + boxW * 0.25, boxY + BOX_HEIGHT / 2)
  }
}

function drawLinkedList(name, nodes, prevNodes, w, h) {
  const MAX_VISIBLE = 15
  const truncated = nodes.length > MAX_VISIBLE
  const visible = truncated ? nodes.slice(0, MAX_VISIBLE - 1) : nodes
  if (truncated) {
    visible.push(`…${nodes.length - (MAX_VISIBLE - 1)} more`)
  }

  const count = visible.length
  const arrowW = 20
  const boxW = count > 0
    ? Math.max(MIN_BOX_WIDTH, Math.floor((w - PADDING * 2 - (count - 1) * arrowW) / count))
    : MIN_BOX_WIDTH

  const labelY = PADDING
  const boxY = labelY + LABEL_HEIGHT + 4
  const startX = PADDING

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  for (let i = 0; i < visible.length; i++) {
    const x = startX + i * (boxW + arrowW)
    const curVal = visible[i]
    const prevVal = prevNodes?.[i]
    const changed = prevNodes !== undefined && JSON.stringify(prevVal) !== JSON.stringify(curVal)

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(x, boxY, boxW, BOX_HEIGHT)

    ctx.strokeStyle = changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = changed ? 2 : 1
    ctx.strokeRect(x, boxY, boxW, BOX_HEIGHT)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(String(curVal), boxW - 6), x + boxW / 2, boxY + BOX_HEIGHT / 2)

    // Draw arrow to next node
    if (i < visible.length - 1) {
      const arrowStartX = x + boxW + 2
      const arrowEndX = x + boxW + arrowW - 2
      const arrowY = boxY + BOX_HEIGHT / 2

      ctx.strokeStyle = COLORS.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(arrowStartX, arrowY)
      ctx.lineTo(arrowEndX - 6, arrowY)
      ctx.stroke()

      // Arrowhead triangle
      ctx.fillStyle = COLORS.border
      ctx.beginPath()
      ctx.moveTo(arrowEndX, arrowY)
      ctx.lineTo(arrowEndX - 6, arrowY - 4)
      ctx.lineTo(arrowEndX - 6, arrowY + 4)
      ctx.closePath()
      ctx.fill()
    }
  }
}

function drawTree(name, root, prevRoot, w, h) {
  const MAX_DEPTH = 5
  const labelY = PADDING
  const NODE_RADIUS = 18

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  if (!root) return

  // Build prev value map: depth-index → value
  const prevMap = {}
  if (prevRoot) {
    const queue = [{ node: prevRoot, depth: 0, index: 0 }]
    while (queue.length) {
      const { node, depth, index } = queue.shift()
      if (!node || depth > MAX_DEPTH) continue
      prevMap[`${depth}-${index}`] = node.val ?? node.value
      if (node.left) queue.push({ node: node.left, depth: depth + 1, index: index * 2 })
      if (node.right) queue.push({ node: node.right, depth: depth + 1, index: index * 2 + 1 })
    }
  }

  // BFS to collect layout positions
  const items = []
  const bfsQueue = [{ node: root, depth: 0, index: 0, parentX: null, parentY: null }]

  while (bfsQueue.length) {
    const { node, depth, index, parentX, parentY } = bfsQueue.shift()
    if (!node || depth > MAX_DEPTH) continue

    const nodeX = (index + 0.5) * (w / Math.pow(2, depth))
    const nodeY = PADDING + LABEL_HEIGHT + depth * 60 + NODE_RADIUS

    items.push({ node, depth, index, x: nodeX, y: nodeY, parentX, parentY })

    if (node.left) bfsQueue.push({ node: node.left, depth: depth + 1, index: index * 2, parentX: nodeX, parentY: nodeY })
    if (node.right) bfsQueue.push({ node: node.right, depth: depth + 1, index: index * 2 + 1, parentX: nodeX, parentY: nodeY })
  }

  // Draw edges first
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  for (const { x, y, parentX, parentY } of items) {
    if (parentX !== null) {
      ctx.beginPath()
      ctx.moveTo(parentX, parentY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  // Draw nodes
  for (const { node, depth, index, x, y } of items) {
    const val = node.val ?? node.value
    const prevVal = prevMap[`${depth}-${index}`]
    const changed = prevRoot !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val)
    const isRoot = depth === 0

    ctx.fillStyle = isRoot ? COLORS.accentDim : COLORS.bg
    ctx.beginPath()
    ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = isRoot ? COLORS.accent : changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = isRoot || changed ? 2 : 1
    ctx.beginPath()
    ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)
    ctx.stroke()

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(String(val), NODE_RADIUS * 2 - 4), x, y)
  }
}

function drawHashMap(name, entries, prevEntries, w, h) {
  const visible = entries.slice(0, MAX_ELEMENTS)
  const labelY = PADDING
  const startY = labelY + LABEL_HEIGHT + 4
  const halfW = (w - PADDING * 2) / 2
  const dividerX = PADDING + halfW

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  // Divider line
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(dividerX, startY)
  ctx.lineTo(dividerX, startY + visible.length * BOX_HEIGHT)
  ctx.stroke()

  for (let i = 0; i < visible.length; i++) {
    const [key, val] = visible[i]
    const y = startY + i * BOX_HEIGHT
    const prevVal = prevEntries?.[i]?.[1]
    const changed = prevEntries !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val)

    // Key cell
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(PADDING, y, halfW - 1, BOX_HEIGHT - 1)
    ctx.strokeStyle = changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = changed ? 2 : 1
    ctx.strokeRect(PADDING, y, halfW - 1, BOX_HEIGHT - 1)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(String(key), halfW - 8), PADDING + 4, y + BOX_HEIGHT / 2)

    // Value cell
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(dividerX + 1, y, halfW - 1, BOX_HEIGHT - 1)
    ctx.strokeStyle = changed ? COLORS.warning : COLORS.border
    ctx.lineWidth = changed ? 2 : 1
    ctx.strokeRect(dividerX + 1, y, halfW - 1, BOX_HEIGHT - 1)

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(String(val), halfW - 8), dividerX + 1 + (halfW - 1) / 2, y + BOX_HEIGHT / 2)
  }
}

function drawSorting(name, arr, prevArr, w, h, indices) {
  const visible = arr.slice(0, MAX_ELEMENTS)
  const labelY = PADDING
  const usableW = w - PADDING * 2
  const usableH = h - PADDING * 2 - LABEL_HEIGHT - INDEX_LABEL_HEIGHT
  const barW = Math.max(4, Math.floor(usableW / visible.length))
  const bottomY = PADDING + LABEL_HEIGHT + usableH

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, labelY + 6)

  const maxVal = Math.max(...visible.map(v => Number(v) || 0), 1)

  // Find swapped positions between current and prev
  const swapped = new Set()
  if (prevArr && Array.isArray(prevArr) && prevArr.length === visible.length) {
    for (let i = 0; i < visible.length; i++) {
      if (JSON.stringify(visible[i]) !== JSON.stringify(prevArr[i])) {
        swapped.add(i)
      }
    }
  }

  for (let i = 0; i < visible.length; i++) {
    const val = Number(visible[i]) || 0
    const barH = Math.max(2, Math.floor((val / maxVal) * usableH))
    const x = PADDING + i * barW
    const y = bottomY - barH

    const isSwapped = swapped.has(i)
    const activeIndex = Object.values(indices).find(v => v === i)
    const isActive = activeIndex !== undefined

    ctx.fillStyle = isSwapped ? COLORS.warning : isActive ? COLORS.accentDim : COLORS.border
    ctx.fillRect(x, y, barW - 1, barH)

    ctx.strokeStyle = isSwapped ? COLORS.warning : isActive ? COLORS.accent : COLORS.border
    ctx.lineWidth = isSwapped || isActive ? 2 : 1
    ctx.strokeRect(x, y, barW - 1, barH)
  }

  // Index pointer triangles
  for (const [idxName, idxVal] of Object.entries(indices)) {
    if (idxVal >= 0 && idxVal < visible.length) {
      const x = PADDING + idxVal * barW + (barW - 1) / 2
      const triY = bottomY + INDEX_LABEL_HEIGHT / 2

      ctx.fillStyle = COLORS.accent
      ctx.beginPath()
      ctx.moveTo(x, triY - 4)
      ctx.lineTo(x - 4, triY + 4)
      ctx.lineTo(x + 4, triY + 4)
      ctx.closePath()
      ctx.fill()

      ctx.font = '10px monospace'
      ctx.fillStyle = COLORS.textMuted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(idxName, x, triY + 5)
    }
  }
}

function drawGraph(name, data, prevData, w, h) {
  const { kind, raw } = data

  ctx.font = '11px monospace'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, PADDING, PADDING + 6)

  const contentY = PADDING + LABEL_HEIGHT + 4

  if (kind === 'grid') {
    const rows = raw
    const cols = rows[0].length
    const cellSize = Math.min(40, Math.floor((w - PADDING * 2) / cols))

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols; c++) {
        const x = PADDING + c * cellSize
        const y = contentY + r * cellSize
        const val = rows[r][c]
        const prevVal = prevData?.raw?.[r]?.[c]
        const changed = prevData !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val)

        ctx.fillStyle = COLORS.bg
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1)

        ctx.strokeStyle = changed ? COLORS.warning : COLORS.border
        ctx.lineWidth = changed ? 2 : 1
        ctx.strokeRect(x, y, cellSize - 1, cellSize - 1)

        ctx.font = '10px monospace'
        ctx.fillStyle = COLORS.text
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatCell(String(val), cellSize - 4), x + (cellSize - 1) / 2, y + (cellSize - 1) / 2)
      }
    }
    return
  }

  // Adjacency list — place up to 10 nodes in a circle
  const entries = raw instanceof Map ? [...raw.entries()] : Object.entries(raw)
  const nodeEntries = entries.slice(0, 10)
  const nodeCount = nodeEntries.length
  if (nodeCount === 0) return

  const centerX = w / 2
  const centerY = (h + contentY) / 2
  const radius = Math.min(w, h - contentY) * 0.35

  // Build positions map
  const positions = {}
  for (let i = 0; i < nodeCount; i++) {
    const [key] = nodeEntries[i]
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2
    positions[key] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  }

  // Draw edges
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  for (const [key, neighbors] of nodeEntries) {
    const from = positions[key]
    if (!from || !Array.isArray(neighbors)) continue
    for (const neighbor of neighbors) {
      const to = positions[neighbor]
      if (!to) continue
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  }

  // Draw nodes
  const NODE_RADIUS = 16
  for (const [key] of nodeEntries) {
    const pos = positions[key]
    if (!pos) continue

    ctx.fillStyle = COLORS.bg
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2)
    ctx.stroke()

    ctx.font = '11px monospace'
    ctx.fillStyle = COLORS.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCell(String(key), NODE_RADIUS * 2 - 4), pos.x, pos.y)
  }
}

function formatCell(val, maxWidth) {
  const s = val === null ? 'null' : val === undefined ? 'undef' : String(val)
  const approxCharWidth = 7
  const maxChars = Math.floor(maxWidth / approxCharWidth)
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s
}
