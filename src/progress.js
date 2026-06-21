import { get, set } from './storage.js';

const STORAGE_KEY = 'trainer_v1';

function loadState() {
  const data = get(STORAGE_KEY);
  return data ?? createDefault();
}

function createDefault() {
  return {
    completedExercises: {},
    xp: 0,
    streak: 0,
    lastActiveDate: null
  };
}

function save(state) {
  set(STORAGE_KEY, state);
}

function normalizeCode(code) {
  return code.replace(/\s+/g, ' ').trim();
}

export function markSolved(exerciseId, code) {
  const state = loadState();
  const existing = state.completedExercises[exerciseId];
  const isNewExercise = !existing;
  const isRealChange = existing && normalizeCode(existing.code) !== normalizeCode(code);

  if (!isNewExercise && !isRealChange) return state;

  state.completedExercises[exerciseId] = {
    code,
    solvedAt: new Date().toISOString()
  };

  if (isNewExercise) {
    state.xp += 100;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (state.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak = state.lastActiveDate === yesterday ? state.streak + 1 : 1;
    state.lastActiveDate = today;
  }

  save(state);
  return state;
}

export function getProgress() {
  return loadState();
}

export function getSavedCode(exerciseId) {
  const state = loadState();
  const entry = state.completedExercises[exerciseId];
  return entry ? entry.code : null;
}
