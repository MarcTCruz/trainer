import { t } from '../i18n.js'
import { instrumentCode } from './instrumenter.js'
import { captureTrace } from './traceCapture.js'
import { createReplayEngine } from './replayEngine.js'
import { setDebugLine, clearDebugDecorations, toggleBreakpoint, onBreakpointToggle } from '../editor.js'
import { initDataViz, renderDataViz, clearDataViz } from './dataViz.js'

let els = null
let engine = null
let unsubscribe = null
let keyHandler = null
let prevVars = {}
let isActive = false
let activeEditor = null
const expandedPaths = new Set()

export function initDebugUI(elements) {
  els = elements

  const canvas = document.getElementById('debug-canvas')
  if (canvas) initDataViz(canvas)

  onBreakpointToggle((lineNum, bpSet) => {
    if (!engine) return
    engine.setBreakpoints(bpSet)
  })

  els.dbgStepBack.addEventListener('click', () => engine?.stepBack())
  els.dbgStepInto.addEventListener('click', () => engine?.stepInto())
  els.dbgStepOver.addEventListener('click', () => engine?.stepOver())
  els.dbgStepOut.addEventListener('click', () => engine?.stepOut())
  els.dbgContinue.addEventListener('click', () => engine?.continueForward())
  els.dbgContinueBack.addEventListener('click', () => engine?.continueBackward())
  els.dbgReset.addEventListener('click', () => engine?.reset())
  els.dbgStop.addEventListener('click', stopDebugSession)
}

export async function startDebugSession(code, exercise, editor, testIndex = 0) {
  const { code: instrumented, error: instrError } = instrumentCode(code)
  if (instrError) {
    showStatus(t('debug.instrumentError', { error: instrError }), 'error')
    return
  }

  if (/\basync\b|\bawait\b|\bPromise\b/.test(code)) {
    showStatus(t('debug.asyncUnsupported'), 'error')
    return
  }

  showWasmStatus(t('debug.capturing'))

  const { trace, callEvents, error: traceError, stepLimitHit } = await captureTrace(instrumented, exercise, testIndex)

  hideWasmStatus()

  if (traceError) {
    showStatus(t('debug.traceError', { error: traceError }), 'error')
    return
  }

  if (stepLimitHit) {
    showStatus(t('debug.stepLimitHit', { count: trace.length }), 'error')
  }

  engine = createReplayEngine(trace, callEvents)
  isActive = true
  activeEditor = editor
  prevVars = {}

  els.debugToolbar.removeAttribute('hidden')
  els.debugPanel.removeAttribute('hidden')
  els.resultsContainer.style.display = 'none'
  els.debugToolbar.closest('.editor-panel')?.classList.add('debugging')

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }

  unsubscribe = engine.subscribe((state) => renderState(state, editor))

  keyHandler = (e) => handleKey(e, editor)
  document.addEventListener('keydown', keyHandler)

  engine.jumpTo(0)
}

export function stopDebugSession() {
  if (!isActive) return

  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }

  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler)
    keyHandler = null
  }

  if (activeEditor) clearDebugDecorations(activeEditor)

  engine = null
  isActive = false
  activeEditor = null
  prevVars = {}

  els.debugToolbar.setAttribute('hidden', '')
  els.debugPanel.setAttribute('hidden', '')
  els.resultsContainer.style.display = ''
  els.debugToolbar.closest('.editor-panel')?.classList.remove('debugging')
  clearEditorHighlight()
  clearDataViz()
}

export function isDebugging() {
  return isActive
}

function renderEntry(editor, entry) {
  if (!entry) {
    clearEditorHighlight(editor)
    renderVars({})
    return
  }
  setDebugLine(editor, entry.line)
  renderVars(entry.vars)
}

function renderState(state, editor) {
  const { index, entry, atStart, atEnd, traceLength, callStack } = state

  els.dbgPosition.textContent = t('debug.position', { current: index + 1, total: traceLength })

  els.dbgStepBack.disabled = atStart
  els.dbgContinueBack.disabled = atStart
  els.dbgStepInto.disabled = atEnd
  els.dbgStepOver.disabled = atEnd
  els.dbgStepOut.disabled = atEnd
  els.dbgContinue.disabled = atEnd

  renderDataViz(entry?.vars ?? {}, prevVars)

  renderEntry(editor, entry)
  renderCallStack(callStack)
}

function renderVars(vars) {
  const container = els.debugVarsContent
  container.innerHTML = ''
  const currentKeys = Object.keys(vars)

  if (currentKeys.length === 0) {
    container.textContent = '—'
    prevVars = {}
    return
  }

  for (const key of currentKeys) {
    const val = vars[key]
    if (val === undefined) continue
    const changed = prevVars[key] !== undefined && JSON.stringify(prevVars[key]) !== JSON.stringify(val)
    if ((Array.isArray(val) || val?.__type === 'Map' || val?.__type === 'Set') && !expandedPaths.has(key)) expandedPaths.add(key)
    renderVarNode(container, key, val, key, changed, 0)
  }

  prevVars = vars
}

function togglePath(path) {
  if (expandedPaths.has(path)) {
    expandedPaths.delete(path)
    return
  }
  expandedPaths.add(path)
}

function previewOf(snapType, val) {
  if (snapType === 'Map') return `Map(${val.size})`
  if (snapType === 'Set') return `Set(${val.size})`
  if (Array.isArray(val)) return `Array(${val.length})`
  const keys = Object.keys(val)
  const head = keys.slice(0, 3).join(', ')
  const tail = keys.length > 3 ? '…' : ''
  return `Object {${head}${tail}}`
}

function entriesOf(snapType, val) {
  if (snapType === 'Map') return val.entries.map(([k, v]) => [String(k), v])
  if (snapType === 'Set') return val.values.map((v, i) => [String(i), v])
  if (Array.isArray(val)) return val.map((v, i) => [String(i), v])
  return Object.entries(val).filter(([k]) => k !== '__type' && k !== 'size')
}

function renderVarNode(container, key, val, path, changed, depth) {
  const isExpandable = val !== null && typeof val === 'object' && depth < 3
  const isExpanded = expandedPaths.has(path)

  const row = document.createElement('div')
  row.className = depth === 0 ? 'debug-var-row' : `debug-var-row nested-${depth}`

  const nameEl = document.createElement('span')
  nameEl.className = 'debug-var-name'

  if (isExpandable) {
    const toggle = document.createElement('span')
    toggle.className = 'debug-var-toggle'
    toggle.textContent = isExpanded ? '▼' : '▶'
    toggle.addEventListener('click', () => {
      togglePath(path)
      renderVars(prevVars)
    })
    nameEl.appendChild(toggle)
  }

  nameEl.appendChild(document.createTextNode(key))

  const valEl = document.createElement('span')
  valEl.className = changed ? 'debug-var-value debug-var-changed' : 'debug-var-value'

  const snapType = val?.__type
  if (isExpandable) {
    valEl.className += ' debug-val-object'
    valEl.textContent = previewOf(snapType, val)
  }
  if (!isExpandable) {
    const { cls, text } = formatValTyped(val)
    valEl.className += ` ${cls}`
    valEl.textContent = text
  }

  row.appendChild(nameEl)
  row.appendChild(valEl)
  container.appendChild(row)

  if (!isExpandable || !isExpanded) return

  const entries = entriesOf(snapType, val)

  for (const [childKey, childVal] of entries) {
    renderVarNode(container, childKey, childVal, `${path}.${childKey}`, false, depth + 1)
  }
}

function renderCallStack(callStack) {
  const container = els.debugCallstackContent
  container.innerHTML = ''

  if (!callStack?.length) {
    container.textContent = '—'
    return
  }

  for (let i = callStack.length - 1; i >= 0; i--) {
    const frame = callStack[i]
    const el = document.createElement('div')
    el.className = i === callStack.length - 1 ? 'debug-stack-frame active' : 'debug-stack-frame'
    el.textContent = frame || '(anonymous)'
    container.appendChild(el)
  }
}

function handleKey(e, editor) {
  if (!engine) return

  if (e.key === 'F10') {
    e.preventDefault()
    engine.stepOver()
    return
  }
  if (e.key === 'F11' && e.shiftKey) {
    e.preventDefault()
    engine.stepOut()
    return
  }
  if (e.key === 'F11') {
    e.preventDefault()
    engine.stepInto()
    return
  }
  if (e.key === 'F5') {
    e.preventDefault()
    engine.continueForward()
    return
  }
  if (e.key === 'Escape') {
    stopDebugSession()
  }
}

function clearEditorHighlight(editor) {
  if (editor) clearDebugDecorations(editor)
}

function formatValTyped(val) {
  if (val === null) return { cls: 'debug-val-null', text: 'null' }
  if (val === undefined) return { cls: 'debug-val-null', text: 'undefined' }
  if (typeof val === 'number') return { cls: 'debug-val-number', text: String(val) }
  if (typeof val === 'boolean') return { cls: 'debug-val-boolean', text: String(val) }
  if (typeof val === 'string') return { cls: 'debug-val-string', text: `"${val}"` }
  return { cls: 'debug-val-object', text: String(val) }
}

function showStatus(msg, kind) {
  if (!els?.statusBar) return
  els.statusBar.textContent = msg
  els.statusBar.className = `status-message ${kind}`
}

function showWasmStatus(msg) {
  if (!els?.wasmStatus) return
  els.wasmStatus.textContent = msg
  els.wasmStatus.classList.add('visible')
}

function hideWasmStatus() {
  if (!els?.wasmStatus) return
  els.wasmStatus.textContent = ''
  els.wasmStatus.classList.remove('visible')
}
