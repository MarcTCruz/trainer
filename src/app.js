import { createEditor, getCode, setCode, onFormat } from './editor.js'
import { runExercise, ensureQuickJS } from './runner.js'
import { markSolved, getProgress, getSavedCode } from './progress.js'
import {
  getExercise,
  getNextVariant,
  getVariantsOf,
  getCluster,
  getAllClusters,
} from './exercise-loader.js'

const elements = {
  title: document.getElementById('exercise-title'),
  difficulty: document.getElementById('exercise-difficulty'),
  description: document.getElementById('exercise-description'),
  editorContainer: document.getElementById('editor-container'),
  runButton: document.getElementById('run-button'),
  resetButton: document.getElementById('reset-button'),
  formatButton: document.getElementById('format-button'),
  resultsContainer: document.getElementById('results-container'),
  statusBar: document.getElementById('status-message'),
  xpDisplay: document.getElementById('xp-value'),
  streakDisplay: document.getElementById('streak-value'),
  solvedDisplay: document.getElementById('solved-value'),
  hintButton: document.getElementById('hint-button'),
  hintContent: document.getElementById('hint-content'),
  wasmStatus: document.getElementById('wasm-status'),
  stepper: document.getElementById('evolution-stepper'),
  ribbon: document.getElementById('learning-ribbon'),
}

let editor
let currentHintIndex = 0
let currentExercise = null

function resolveStartExercise() {
  const progress = getProgress()
  const solved = progress.completedExercises
  const allClusters = getAllClusters()
  for (const cluster of allClusters) {
    for (const entry of cluster.exercises) {
      if (!solved[entry.id]) return entry.id
    }
  }
  return allClusters[0]?.exercises[0]?.id ?? 'valid-parentheses'
}

function loadExercise(id, keepCode = false) {
  const exercise = getExercise(id)
  if (!exercise) return

  currentExercise = exercise
  currentHintIndex = 0

  elements.title.textContent = exercise.title
  elements.difficulty.textContent = exercise.difficulty
  elements.difficulty.dataset.level = exercise.difficulty.toLowerCase()
  elements.description.innerHTML = formatDescription(exercise.description)

  if (!keepCode) {
    const savedCode = getSavedCode(exercise.id)
    if (editor) {
      setCode(editor, savedCode || exercise.starterCode)
    } else {
      editor = createEditor(
        elements.editorContainer,
        savedCode || exercise.starterCode,
      )
    }
  }

  elements.resultsContainer.innerHTML = ''
  elements.statusBar.textContent = ''
  elements.statusBar.className = 'status-message'
  elements.hintContent.textContent = ''
  elements.hintContent.classList.remove('visible')
  elements.hintButton.textContent = `Hint 1/${exercise.hints?.length ?? 0}`

  renderStepper()
  renderRibbon()
  updateProgressDisplay()
}

function formatDescription(desc) {
  return desc
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) return ''
      return line
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    })
    .filter(Boolean)
    .join('<br>')
}

function updateProgressDisplay() {
  const progress = getProgress()
  elements.xpDisplay.textContent = progress.xp
  elements.streakDisplay.textContent = progress.streak
  elements.solvedDisplay.textContent = Object.keys(
    progress.completedExercises,
  ).length
}

function renderStepper() {
  const container = elements.stepper
  if (!container || !currentExercise) return

  const baseId = currentExercise.variantOf || currentExercise.id
  const family = getVariantsOf(baseId)
  const progress = getProgress()
  const solved = progress.completedExercises

  container.innerHTML = ''

  family.forEach((exercise, idx) => {
    const isSolved = Boolean(solved[exercise.id])
    const isActive = exercise.id === currentExercise.id
    const isFirst = idx === 0
    const prevSolved = idx === 0 || Boolean(solved[family[idx - 1].id])
    const isLocked = !isFirst && !prevSolved && !isSolved && !isActive

    if (idx > 0) {
      const connector = document.createElement('div')
      connector.className = `stepper-connector${isSolved ? ' solved' : ''}`
      container.appendChild(connector)
    }

    const node = document.createElement('button')
    node.className = `stepper-node${isSolved ? ' solved' : ''}${isActive ? ' active' : ''}`
    node.type = 'button'

    if (isLocked) {
      node.setAttribute('aria-disabled', 'true')
    } else {
      node.setAttribute('aria-disabled', 'false')
    }

    if (isActive) {
      node.setAttribute('aria-current', 'step')
    }

    const icon = document.createElement('span')
    icon.className = 'node-icon'
    icon.textContent = isSolved ? '✓' : isActive ? '●' : '○'
    icon.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.textContent = exercise.title

    node.appendChild(icon)
    node.appendChild(label)

    node.addEventListener('click', () => {
      if (isLocked) return
      if (exercise.id !== currentExercise.id) {
        loadExercise(exercise.id, false)
      }
    })

    container.appendChild(node)
  })
}

function renderRibbon() {
  const container = elements.ribbon
  if (!container || !currentExercise) return

  const clusters = getAllClusters()
  const activeCluster = getCluster(currentExercise.id)
  const progress = getProgress()
  const solved = progress.completedExercises

  container.innerHTML = ''

  clusters.forEach((cluster) => {
    const isActive = cluster.id === activeCluster?.id
    const total = cluster.exercises.length
    const solvedCount = cluster.exercises.filter((e) => Boolean(solved[e.id]))
      .length
    const progressPct = total > 0 ? (solvedCount / total) * 100 : 0

    const pill = document.createElement('button')
    pill.className = `ribbon-pill${isActive ? ' active' : ''}`
    pill.type = 'button'
    pill.textContent = cluster.title
    pill.setAttribute('aria-pressed', String(isActive))

    const bar = document.createElement('span')
    bar.className = 'ribbon-progress'
    bar.style.width = `${progressPct}%`
    bar.setAttribute('aria-hidden', 'true')

    pill.appendChild(bar)
    container.appendChild(pill)
  })
}

function showEvolutionPrompt(nextVariant) {
  dismissEvolutionPrompt()

  const card = document.createElement('div')
  card.className = 'evolution-prompt'
  card.id = 'evolution-prompt'
  card.setAttribute('role', 'status')
  card.setAttribute('aria-live', 'polite')

  const heading = document.createElement('h3')
  heading.textContent = 'Base concept mastered. Ready for the next level?'

  const text = document.createElement('p')
  text.textContent =
    nextVariant.variantPrompt ||
    `Next up: ${nextVariant.title}. Your code stays — only the challenge grows.`

  const actions = document.createElement('div')
  actions.className = 'prompt-actions'

  const evolveBtn = document.createElement('button')
  evolveBtn.className = 'btn btn-primary'
  evolveBtn.type = 'button'
  evolveBtn.textContent = `Evolve: ${nextVariant.title} →`
  evolveBtn.addEventListener('click', () => {
    dismissEvolutionPrompt()
    loadExercise(nextVariant.id, true)
  })

  const stayBtn = document.createElement('button')
  stayBtn.className = 'btn btn-secondary'
  stayBtn.type = 'button'
  stayBtn.textContent = 'Stay & Refactor'
  stayBtn.addEventListener('click', dismissEvolutionPrompt)

  actions.appendChild(evolveBtn)
  actions.appendChild(stayBtn)

  card.appendChild(heading)
  card.appendChild(text)
  card.appendChild(actions)

  elements.resultsContainer.appendChild(card)
}

function dismissEvolutionPrompt() {
  const existing = document.getElementById('evolution-prompt')
  if (existing) existing.remove()
}

async function handleRun() {
  elements.runButton.disabled = true
  elements.runButton.textContent = 'Running...'
  elements.resultsContainer.innerHTML = ''
  elements.statusBar.textContent = ''
  elements.statusBar.className = 'status-message'

  elements.wasmStatus.textContent = 'Loading WASM sandbox...'
  elements.wasmStatus.classList.add('visible')

  try {
    await ensureQuickJS()
    elements.wasmStatus.textContent = 'Executing in sandbox...'

    const userCode = getCode(editor)
    const result = await runExercise(userCode, currentExercise)

    elements.wasmStatus.classList.remove('visible')
    renderResults(result)

    if (result.allPassed) {
      markSolved(currentExercise.id, userCode)
      updateProgressDisplay()
      renderStepper()
      renderRibbon()
      elements.statusBar.textContent = '✔ All tests passed!'
      elements.statusBar.className = 'status-message success'

      const nextVariant = getNextVariant(currentExercise.id)
      if (nextVariant) {
        showEvolutionPrompt(nextVariant)
      }
    } else if (result.error) {
      elements.statusBar.textContent = `✘ Error: ${result.error}`
      elements.statusBar.className = 'status-message error'
    } else {
      const passCount = result.results.filter((r) => r.passed).length
      elements.statusBar.textContent = `⚠ ${passCount}/${result.results.length} tests passed`
      elements.statusBar.className = 'status-message partial'
    }
  } catch (err) {
    elements.wasmStatus.classList.remove('visible')
    elements.statusBar.textContent = `Runner error: ${err.message}`
    elements.statusBar.className = 'status-message error'
  } finally {
    elements.runButton.disabled = false
    elements.runButton.textContent = 'Run Code'
  }
}

function renderResults(result) {
  const container = elements.resultsContainer
  container.innerHTML = ''

  if (result.error && result.results.length === 0) {
    const errorEl = document.createElement('div')
    errorEl.className = 'test-result error'
    errorEl.innerHTML = `<span class="result-icon">!</span> <span class="result-text">${escapeHtml(result.error)}</span>`
    container.appendChild(errorEl)
    return
  }

  const fnName = currentExercise.functionName
  const paramNames = currentExercise.params ?? ['input']

  result.results.forEach((r, i) => {
    const el = document.createElement('div')
    el.className = `test-result ${r.passed ? 'pass' : 'fail'}`

    const icon = r.passed ? '✓' : '✗'
    const verdict = r.passed ? 'PASS' : 'FAIL'
    const args = r.input.map((v) => JSON.stringify(v)).join(', ')

    let detail = `<span class="result-icon">${icon}</span>`
    detail += `<span class="result-verdict">${verdict}</span>`
    detail += `<span class="result-label">Test ${i + 1}:</span>`
    detail += `<span class="result-input">${escapeHtml(fnName)}(${escapeHtml(args)})</span>`

    if (!r.passed) {
      if (r.error) {
        detail += `<span class="result-error">Error: ${escapeHtml(r.error)}</span>`
      } else {
        detail += `<span class="result-expected">Expected: ${escapeHtml(formatValue(r.expected))}</span>`
        detail += `<span class="result-actual">Got: ${escapeHtml(formatValue(r.actual))}</span>`
      }
    }

    el.innerHTML = detail
    container.appendChild(el)
  })
}

function handleReset() {
  if (!currentExercise) return
  setCode(editor, currentExercise.starterCode)
  elements.resultsContainer.innerHTML = ''
  elements.statusBar.textContent = ''
  elements.statusBar.className = 'status-message'
  currentHintIndex = 0
  elements.hintContent.textContent = ''
  elements.hintContent.classList.remove('visible')
  elements.hintButton.textContent = `Hint 1/${currentExercise.hints?.length ?? 0}`
}

function handleHint() {
  if (!currentExercise?.hints?.length) return

  if (currentHintIndex < currentExercise.hints.length) {
    elements.hintContent.textContent = currentExercise.hints[currentHintIndex]
    elements.hintContent.classList.add('visible')
    currentHintIndex++
    elements.hintButton.textContent =
      currentHintIndex < currentExercise.hints.length
        ? `Hint ${currentHintIndex + 1}/${currentExercise.hints.length}`
        : 'No more hints'
  }
}

function formatValue(val) {
  if (val === undefined) return 'undefined'
  if (val === null) return 'null'
  return JSON.stringify(val)
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

async function handleFormat() {
  const code = getCode(editor)
  try {
    const prettier = await import('prettier/standalone')
    const parserBabel = await import('prettier/plugins/babel')
    const parserEstree = await import('prettier/plugins/estree')
    const formatted = await prettier.format(code, {
      parser: 'babel',
      plugins: [parserBabel.default, parserEstree.default],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 60,
    })
    setCode(editor, formatted.trimEnd())
  } catch (err) {
    elements.statusBar.textContent = `✘ Format error: ${err.message}`
    elements.statusBar.className = 'status-message error'
  }
}

elements.runButton.addEventListener('click', handleRun)
elements.resetButton.addEventListener('click', handleReset)
elements.formatButton.addEventListener('click', handleFormat)
elements.hintButton.addEventListener('click', handleHint)
onFormat(handleFormat)

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleRun()
  }
})

loadExercise(resolveStartExercise())
