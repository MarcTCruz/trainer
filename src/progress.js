const STORAGE_KEY = 'trainer_v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefault()
    return JSON.parse(raw)
  } catch {
    return createDefault()
  }
}

function createDefault() {
  return {
    completedExercises: {},
    xp: 0,
    streak: 0,
    lastActiveDate: null,
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function markSolved(exerciseId, code) {
  const state = loadState()
  const alreadySolved = Boolean(state.completedExercises[exerciseId])

  state.completedExercises[exerciseId] = {
    code,
    solvedAt: new Date().toISOString(),
  }

  if (!alreadySolved) {
    state.xp += 100
  }

  const today = new Date().toISOString().slice(0, 10)
  if (state.lastActiveDate === today) {
    // same day, no streak change
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    state.streak = state.lastActiveDate === yesterday ? state.streak + 1 : 1
  }
  state.lastActiveDate = today

  save(state)
  return state
}

export function getProgress() {
  return loadState()
}

export function getSavedCode(exerciseId) {
  const state = loadState()
  const entry = state.completedExercises[exerciseId]
  return entry ? entry.code : null
}
