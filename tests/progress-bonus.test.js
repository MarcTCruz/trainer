// unit-role: integration — tests addBonusXp state machine via mocked storage layer.
// Covers: first award, upgrade on higher score, no-op on equal/lower score,
// cumulative XP total, and independence across multiple exercises.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// --- Storage mock --------------------------------------------------------
// storage.js uses a module-level cache Map + synchronous get/set.
// We intercept at the module boundary so progress.js sees our in-memory state.

const store = new Map();

mock.module('../src/storage.js', () => ({
  get: (key) => store.get(key) ?? null,
  set: (key, value) => store.set(key, value),
  remove: (key) => store.delete(key),
  init: async () => {}
}));

// Import AFTER mock.module so the module graph resolves to our mock.
const { addBonusXp, getProgress } = await import('../src/progress.js');

const KEY = 'trainer_v1';

function seed(partial = {}) {
  store.set(KEY, {
    completedExercises: {},
    xp: 0,
    streak: 0,
    lastActiveDate: null,
    ...partial
  });
}

function seedWithSolvedExercise(exerciseId, lintBonusAwarded = 0) {
  seed({
    completedExercises: {
      [exerciseId]: { code: 'const x = 1;', solvedAt: '2026-06-21T00:00:00.000Z', lintBonusAwarded }
    },
    xp: 100
  });
}

// -------------------------------------------------------------------------

describe('addBonusXp', () => {
  beforeEach(() => {
    store.clear();
  });

  it('awards bonus on first call (delta = newBonus)', () => {
    seedWithSolvedExercise('ex-1');
    const delta = addBonusXp('ex-1', 50);
    expect(delta).toBe(50);
    expect(getProgress().xp).toBe(150);
    expect(getProgress().completedExercises['ex-1'].lintBonusAwarded).toBe(50);
  });

  it('increases bonus on higher score (delta = difference)', () => {
    seedWithSolvedExercise('ex-1', 40);
    store.get(KEY).xp = 140; // reflect prior bonus already awarded
    const delta = addBonusXp('ex-1', 70);
    expect(delta).toBe(30);
    expect(getProgress().xp).toBe(170);
    expect(getProgress().completedExercises['ex-1'].lintBonusAwarded).toBe(70);
  });

  it('no-op on equal score (delta = 0)', () => {
    seedWithSolvedExercise('ex-1', 60);
    store.get(KEY).xp = 160;
    const delta = addBonusXp('ex-1', 60);
    expect(delta).toBe(0);
    expect(getProgress().xp).toBe(160);
    expect(getProgress().completedExercises['ex-1'].lintBonusAwarded).toBe(60);
  });

  it('no-op on lower score (delta = 0)', () => {
    seedWithSolvedExercise('ex-1', 80);
    store.get(KEY).xp = 180;
    const delta = addBonusXp('ex-1', 30);
    expect(delta).toBe(0);
    expect(getProgress().xp).toBe(180);
    expect(getProgress().completedExercises['ex-1'].lintBonusAwarded).toBe(80);
  });

  it('XP total reflects cumulative bonuses across upgrades', () => {
    seedWithSolvedExercise('ex-1');
    addBonusXp('ex-1', 25);
    addBonusXp('ex-1', 50);
    addBonusXp('ex-1', 40); // lower — no-op
    const progress = getProgress();
    expect(progress.xp).toBe(150); // 100 base + 50 total bonus
    expect(progress.completedExercises['ex-1'].lintBonusAwarded).toBe(50);
  });

  it('works for multiple exercises independently', () => {
    seed({
      completedExercises: {
        'ex-a': { code: 'const a = 1;', solvedAt: '2026-06-21T00:00:00.000Z', lintBonusAwarded: 0 },
        'ex-b': { code: 'const b = 2;', solvedAt: '2026-06-21T00:00:00.000Z', lintBonusAwarded: 0 }
      },
      xp: 200
    });

    addBonusXp('ex-a', 30);
    addBonusXp('ex-b', 70);

    const progress = getProgress();
    expect(progress.xp).toBe(300);
    expect(progress.completedExercises['ex-a'].lintBonusAwarded).toBe(30);
    expect(progress.completedExercises['ex-b'].lintBonusAwarded).toBe(70);

    // Upgrading one doesn't affect the other
    addBonusXp('ex-a', 90);
    expect(getProgress().xp).toBe(360);
    expect(getProgress().completedExercises['ex-b'].lintBonusAwarded).toBe(70);
  });
});
