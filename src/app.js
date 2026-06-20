import { createEditor, getCode, setCode } from './editor.js'
import { runExercise, ensureQuickJS } from './runner.js'
import { markSolved, getProgress, getSavedCode } from './progress.js'
import exercise from './exercises/valid-parentheses.json'

const elements = {
  title: document.getElementById('exercise-title'),
  difficulty: document.getElementById('exercise-difficulty'),
  description: document.getElementById('exercise-description'),
  editorContainer: document.getElementById('editor-container'),
  runButton: document.getElementById('run-button'),
  resetButton: document.getElementById('reset-button'),
  resultsContainer: document.getElementById('results-container'),
  statusBar: document.getElementById('status-message'),
  xpDisplay: document.getElementById('xp-value'),
  streakDisplay: document.getElementById('streak-value'),
  solvedDisplay: document.getElementById('solved-value'),
  hintButton: document.getElementById('hint-button'),
  hintContent: document.getElementById('hint-content'),
  wasmStatus: document.getElementById('wasm-status'),
}

let editor
let currentHintIndex = 0

function initExercise() {
  elements.title.textContent = exercise.title
  elements.difficulty.textContent = exercise.difficulty
  elements.difficulty.dataset.level = exercise.difficulty.toLowerCase()
  elements.description.innerHTML = formatDescription(exercise.description)

  const savedCode = getSavedCode(exercise.id)
  editor = createEditor(elements.editorContainer, savedCode || exercise.starterCode)

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
  elements.solvedDisplay.textContent = Object.keys(progress.completedExercises).length
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
    const result = await runExercise(userCode, exercise)

    elements.wasmStatus.classList.remove('visible')
    renderResults(result)

    if (result.allPassed) {
      const state = markSolved(exercise.id, userCode)
      updateProgressDisplay()
      elements.statusBar.textContent = 'All tests passed!'
      elements.statusBar.className = 'status-message success'
    } else if (result.error) {
      elements.statusBar.textContent = result.error
      elements.statusBar.className = 'status-message error'
    } else {
      const passCount = result.results.filter((r) => r.passed).length
      elements.statusBar.textContent = `${passCount}/${result.results.length} tests passed`
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

  result.results.forEach((r, i) => {
    const el = document.createElement('div')
    el.className = `test-result ${r.passed ? 'pass' : 'fail'}`

    const icon = r.passed ? '✓' : '✗'
    const inputStr = JSON.stringify(r.input[0])

    let detail = `<span class="result-icon">${icon}</span>`
    detail += `<span class="result-label">Test ${i + 1}:</span>`
    detail += `<span class="result-input">isValid(${escapeHtml(inputStr)})</span>`

    if (!r.passed) {
      if (r.error) {
        detail += `<span class="result-error">Error: ${escapeHtml(r.error)}</span>`
      } else {
        detail += `<span class="result-expected">Expected: ${escapeHtml(JSON.stringify(r.expected))}</span>`
        detail += `<span class="result-actual">Got: ${escapeHtml(JSON.stringify(r.actual))}</span>`
      }
    }

    el.innerHTML = detail
    container.appendChild(el)
  })
}

function handleReset() {
  setCode(editor, exercise.starterCode)
  elements.resultsContainer.innerHTML = ''
  elements.statusBar.textContent = ''
  elements.statusBar.className = 'status-message'
  currentHintIndex = 0
  elements.hintContent.textContent = ''
  elements.hintContent.classList.remove('visible')
}

function handleHint() {
  if (!exercise.hints || exercise.hints.length === 0) return

  if (currentHintIndex < exercise.hints.length) {
    elements.hintContent.textContent = exercise.hints[currentHintIndex]
    elements.hintContent.classList.add('visible')
    currentHintIndex++
    elements.hintButton.textContent =
      currentHintIndex < exercise.hints.length
        ? `Hint ${currentHintIndex + 1}/${exercise.hints.length}`
        : 'No more hints'
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

elements.runButton.addEventListener('click', handleRun)
elements.resetButton.addEventListener('click', handleReset)
elements.hintButton.addEventListener('click', handleHint)

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleRun()
  }
})

initExercise()
