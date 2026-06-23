import { get, set } from './storage.js';

const STORAGE_KEY = 'trainer_v1';
const ATTEMPTS_KEY = 'trainer_attempts';

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
  if (entry) return entry.code;
  return getDraft(exerciseId);
}

const DRAFTS_KEY = 'trainer_drafts';

export function saveDraft(exerciseId, code) {
  const drafts = get(DRAFTS_KEY) ?? {};
  drafts[exerciseId] = code;
  set(DRAFTS_KEY, drafts);
}

export function getDraft(exerciseId) {
  const drafts = get(DRAFTS_KEY) ?? {};
  return drafts[exerciseId] ?? null;
}

export async function recordAttempt(exerciseId) {
  const attempts = get(ATTEMPTS_KEY) ?? {};
  const entry = attempts[exerciseId] ?? { attempts: 0, solves: 0 };
  entry.attempts += 1;
  attempts[exerciseId] = entry;
  set(ATTEMPTS_KEY, attempts);
}

export async function getAttemptStats(exerciseId) {
  const attempts = get(ATTEMPTS_KEY) ?? {};
  return attempts[exerciseId] ?? { attempts: 0, solves: 0 };
}

export async function getDifficultyTier(exerciseId) {
  const stats = await getAttemptStats(exerciseId);
  if (stats.attempts < 3) return null;

  const solveRate = stats.attempts > 0 ? stats.solves / stats.attempts : 0;
  const avgAttempts = stats.attempts;

  if (solveRate > 0.7 || avgAttempts < 2) return 'easy';
  if (solveRate < 0.3 || avgAttempts > 5) return 'hard';
  return 'medium';
}

export function recordSolveInAttempts(exerciseId) {
  const attempts = get(ATTEMPTS_KEY) ?? {};
  const entry = attempts[exerciseId] ?? { attempts: 0, solves: 0 };
  entry.solves += 1;
  attempts[exerciseId] = entry;
  set(ATTEMPTS_KEY, attempts);
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
