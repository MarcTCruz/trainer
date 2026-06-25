import { describe, it, expect } from 'bun:test';
import { tokenize, jaccard, coverageWarnings, SIMILARITY_THRESHOLD } from '../scripts/audit-exercise.js';

// ── tokenize ──────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumeric', () => {
    const tokens = tokenize('Hello, World! This is a test.');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('test');
  });

  it('drops stopwords', () => {
    const tokens = tokenize('the and for are that with this');
    expect(tokens).toEqual([]);
  });

  it('drops tokens shorter than MIN_TOKEN_LEN (3)', () => {
    const tokens = tokenize('ab cd ef');
    expect(tokens).toEqual([]);
  });

  it('keeps tokens of length >= 3 that are not stopwords', () => {
    const tokens = tokenize('sum array index hash');
    expect(tokens).toEqual(['sum', 'array', 'index', 'hash']);
  });

  it('handles empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

// ── jaccard ───────────────────────────────────────────────────────────────────

describe('jaccard', () => {
  it('returns 1.0 for identical token sets', () => {
    const tokens = ['foo', 'bar', 'baz'];
    expect(jaccard(tokens, tokens)).toBe(1);
  });

  it('returns 0 for completely disjoint sets', () => {
    expect(jaccard(['foo', 'bar'], ['baz', 'qux'])).toBe(0);
  });

  it('returns 0 for two empty arrays', () => {
    expect(jaccard([], [])).toBe(0);
  });

  it('computes correct score for partial overlap', () => {
    // intersection={c}, union={a,b,c,d,e} → 1/5 = 0.2
    const score = jaccard(['a', 'b', 'c'], ['c', 'd', 'e']);
    expect(score).toBeCloseTo(0.2, 5);
  });

  it('deduplicates tokens before comparing (set semantics)', () => {
    // ['a','a','b'] → set {a,b}; ['a','b','b'] → set {a,b} → 2/2 = 1.0
    const score = jaccard(['a', 'a', 'b'], ['a', 'b', 'b']);
    expect(score).toBe(1);
  });

  it('SIMILARITY_THRESHOLD is exported and equals 0.7', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.7);
  });
});

// ── coverageWarnings ──────────────────────────────────────────────────────────

describe('coverageWarnings', () => {
  const makeCase = (input, expected) => ({ input, expected });

  it('returns no warnings for a fully covered fixture', () => {
    const testCases = [
      makeCase([[1, 2], 3], [0, 1]),        // typical
      makeCase([[], 0], []),                 // empty first arg + falsy expected
      makeCase([[5], 5], [0]),               // length-1 array
    ];
    expect(coverageWarnings(testCases)).toEqual([]);
  });

  it('warns when no empty/zero input exists', () => {
    const testCases = [
      makeCase([[1, 2, 3], 3], [0, 2]),
      makeCase([[5], 5], [0]),
      makeCase([[1, 2], 3], false),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('empty/zero'))).toBe(true);
  });

  it('warns when no single-element/boundary input exists', () => {
    const testCases = [
      makeCase([[], 0], []),
      makeCase([[1, 2, 3], 6], [0, 2]),
      makeCase([[4, 5], 9], false),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('single-element'))).toBe(true);
  });

  it('warns when no falsy expected exists', () => {
    const testCases = [
      makeCase([[], 0], [1, 2]),    // empty first arg but non-falsy expected
      makeCase([[1], 1], [0]),      // single-element boundary
      makeCase([[1, 2], 3], [0, 1]),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('falsy'))).toBe(true);
  });

  it('detects empty array as empty-input sentinel', () => {
    const testCases = [
      makeCase([[], 0], false),
      makeCase([[1], 1], [0]),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('empty/zero'))).toBe(false);
  });

  it('detects the number 0 as empty-input sentinel', () => {
    const testCases = [
      makeCase([0], false),
      makeCase([[1], 1], [0]),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('empty/zero'))).toBe(false);
  });

  it('detects null expected as falsy sentinel', () => {
    const testCases = [
      makeCase([[], 0], null),
      makeCase([[1], 1], [0]),
    ];
    const warns = coverageWarnings(testCases);
    expect(warns.some((w) => w.includes('falsy'))).toBe(false);
  });

  it('returns three warnings when all categories are missing', () => {
    const testCases = [
      makeCase([[1, 2, 3], 6], [0, 2]),
      makeCase([[4, 5, 6], 11], [1, 2]),
    ];
    expect(coverageWarnings(testCases)).toHaveLength(3);
  });
});
