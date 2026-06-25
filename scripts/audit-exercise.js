#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import vm from 'node:vm';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXERCISES_DIR = 'src/exercises';
const EXCLUDED_FILES = new Set(['registry.json', '_template.json']);
const GEOMETRY_ENGINE = 'geometry';
const PRIMITIVES_PATH = 'src/engines/geometry/primitives.js';

const STARTER_TIMEOUT_MS = 2000;
export const SIMILARITY_THRESHOLD = 0.7;
const MIN_TOKEN_LEN = 3;

const EMPTY_ZERO_SENTINELS = new Set(['', 0, null]);
const FALSY_EXPECTED_SENTINELS = new Set([false, 0, '', null]);

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'that', 'with', 'this', 'you', 'can',
  'not', 'from', 'has', 'its', 'but', 'have', 'was', 'all', 'one',
  'will', 'each', 'use', 'your', 'any', 'may', 'more', 'also', 'two',
  'into', 'how', 'return', 'given', 'must', 'than', 'such', 'same',
]);

// ── Pure helpers (exported for unit tests) ────────────────────────────────────

export function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN && !STOPWORDS.has(t));
}

export function jaccard(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

export function coverageWarnings(testCases) {
  const warnings = [];

  const hasEmptyZero = testCases.some((tc) => {
    const first = tc.input[0];
    if (EMPTY_ZERO_SENTINELS.has(first)) return true;
    if (Array.isArray(first) && first.length === 0) return true;
    if (typeof first === 'object' && first !== null && Object.keys(first).length === 0) return true;
    return false;
  });

  const hasSingleBoundary = testCases.some((tc) => {
    const first = tc.input[0];
    if (first === 1) return true;
    if (typeof first === 'string' && first.length === 1) return true;
    if (Array.isArray(first) && first.length === 1) return true;
    return false;
  });

  const hasFalsyExpected = testCases.some((tc) => {
    const exp = tc.expected;
    if (FALSY_EXPECTED_SENTINELS.has(exp)) return true;
    if (Array.isArray(exp) && exp.length === 0) return true;
    return false;
  });

  if (!hasEmptyZero) {
    warnings.push('no empty/zero input test case (first arg: "", [], 0, null, or {})');
  }
  if (!hasSingleBoundary) {
    warnings.push('no single-element/boundary input test case (first arg: length-1 string/array or the number 1)');
  }
  if (!hasFalsyExpected) {
    warnings.push('no falsy/negative expected test case (expected: false, 0, "", [], or null)');
  }

  return warnings;
}

// ── VM helpers ────────────────────────────────────────────────────────────────

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function geometryPreamble(exercise) {
  if (exercise.engine !== GEOMETRY_ENGINE) return '';
  const src = readFileSync(resolve(PRIMITIVES_PATH), 'utf8');
  return src.replace(/^export\s+/gm, '') + '\n';
}

// Returns { fn, error } — error is a string if evaluation failed, fn is null in that case.
function evalCode(exercise, code) {
  const preamble = geometryPreamble(exercise);
  const context = vm.createContext({});
  try {
    vm.runInContext(preamble + code, context);
  } catch (err) {
    return { fn: null, evalError: err.message };
  }
  const fn = context[exercise.functionName];
  if (typeof fn !== 'function') {
    return { fn: null, evalError: `did not define a function named "${exercise.functionName}"` };
  }
  return { fn, evalError: null };
}

// ── Audit 1: solvability ──────────────────────────────────────────────────────

function auditSolvability(exercise) {
  const { fn, evalError } = evalCode(exercise, exercise.referenceSolution);
  if (evalError) return [`referenceSolution failed to evaluate: ${evalError}`];

  const testCases = exercise.testCases;
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return ['"testCases" must be a non-empty array'];
  }

  const fails = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    let actual;
    try {
      const raw = fn(...tc.input);
      actual = JSON.parse(JSON.stringify(raw));
    } catch (err) {
      fails.push(`testCases[${i}] threw: ${err.message}`);
      continue;
    }
    if (!deepEqual(actual, tc.expected)) {
      fails.push(
        `testCases[${i}] FAIL — expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(actual)}`
      );
    }
  }

  return fails;
}

// ── Audit 2: coverage heuristic ───────────────────────────────────────────────

function auditCoverage(exercise) {
  return coverageWarnings(exercise.testCases);
}

// ── Audit 3: duplicate detection ─────────────────────────────────────────────

function auditDuplicates(exercise, allExercises) {
  const myTokens = tokenize(exercise.description || '');
  const warnings = [];

  for (const other of allExercises) {
    if (other.id === exercise.id) continue;
    const otherTokens = tokenize(other.description || '');
    const score = jaccard(myTokens, otherTokens);
    if (score > SIMILARITY_THRESHOLD) {
      warnings.push(
        `description too similar to "${other.id}" (Jaccard=${score.toFixed(2)})`
      );
    }
  }

  return warnings;
}

// ── Audit 4: starter-code runaway check ──────────────────────────────────────

function auditStarterCode(exercise) {
  const preamble = geometryPreamble(exercise);
  const context = vm.createContext({});

  try {
    vm.runInContext(preamble + exercise.starterCode, context, {
      timeout: STARTER_TIMEOUT_MS,
    });
  } catch (err) {
    if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      return [`starterCode timed out after ${STARTER_TIMEOUT_MS}ms`];
    }
    return [`starterCode threw on definition: ${err.message}`];
  }

  const fn = context[exercise.functionName];
  if (typeof fn !== 'function') {
    return [`starterCode did not define a function named "${exercise.functionName}"`];
  }

  return [];
}

// ── File loader ───────────────────────────────────────────────────────────────

function loadExercise(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function resolveDefaultFiles() {
  return readdirSync(EXERCISES_DIR)
    .filter((name) => name.endsWith('.json') && !EXCLUDED_FILES.has(name))
    .map((name) => join(EXERCISES_DIR, name));
}

function loadAllExercises() {
  return resolveDefaultFiles().map((f) => loadExercise(resolve(f)));
}

// ── Per-file audit runner ─────────────────────────────────────────────────────

function auditFile(filePath, allExercises) {
  const absPath = resolve(filePath);
  let exercise;
  try {
    exercise = loadExercise(absPath);
  } catch (err) {
    return { file: filePath, fails: [`Cannot load file: ${err.message}`], warns: [] };
  }

  const solvFails    = auditSolvability(exercise);
  const coverWarn    = auditCoverage(exercise);
  const dupWarn      = auditDuplicates(exercise, allExercises);
  const starterFails = auditStarterCode(exercise);

  return {
    file: filePath,
    fails: [...solvFails, ...starterFails],
    warns: [...coverWarn, ...dupWarn],
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const argFiles = process.argv
  .slice(2)
  .filter((f) => !EXCLUDED_FILES.has(f.split('/').pop()));

const files = argFiles.length ? argFiles : resolveDefaultFiles();
const allExercises = loadAllExercises();

let hasFailures = false;

for (const file of files) {
  const { fails, warns } = auditFile(file, allExercises);

  if (fails.length) {
    console.error(`FAIL  ${file}`);
    for (const msg of fails) {
      console.error(`      - ${msg}`);
    }
    hasFailures = true;
    continue;
  }

  if (warns.length) {
    console.log(`WARN  ${file}`);
    for (const msg of warns) {
      console.log(`      - ${msg}`);
    }
    continue;
  }

  console.log(`OK    ${file}`);
}

if (hasFailures) process.exit(1);
