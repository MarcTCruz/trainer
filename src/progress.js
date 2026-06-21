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

export function normalizeCode(code) {
  let result = '';
  let inString = null;
  let escaped = false;
  let wsRun = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === inString) inString = null;
      result += ch;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      result += ch;
      wsRun = false;
      continue;
    }

    if (/\s/.test(ch)) {
      if (!wsRun) { result += ' '; wsRun = true; }
      continue;
    }

    result += ch;
    wsRun = false;
  }

  return result.trim();
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

export function addBonusXp(exerciseId, newBonus) {
  const state = loadState();
  const entry = state.completedExercises[exerciseId];
  const existingBonus = entry?.lintBonusAwarded ?? 0;

  if (newBonus <= existingBonus) return 0;

  const delta = newBonus - existingBonus;
  state.xp += delta;
  state.completedExercises[exerciseId] = { ...entry, lintBonusAwarded: newBonus };
  save(state);
  return delta;
}
