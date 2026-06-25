#!/usr/bin/env node
import { readFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import vm from 'node:vm';

const EXERCISES_DIR = 'src/exercises';
const EXCLUDED_FILES = new Set(['registry.json', '_template.json']);
const GEOMETRY_ENGINE = 'geometry';
const PRIMITIVES_PATH = 'src/engines/geometry/primitives.js';

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

function resolveDefaultFiles() {
  return readdirSync(EXERCISES_DIR)
    .filter((name) => name.endsWith('.json') && !EXCLUDED_FILES.has(name))
    .map((name) => join(EXERCISES_DIR, name));
}

function checkExercise(filePath) {
  const errors = [];

  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [`Cannot read file: ${err.message}`];
  }

  let exercise;
  try {
    exercise = JSON.parse(raw);
  } catch (err) {
    return [`Invalid JSON: ${err.message}`];
  }

  if (typeof exercise.referenceSolution !== 'string' || !exercise.referenceSolution) {
    return ['"referenceSolution" must be a non-empty string'];
  }

  if (typeof exercise.functionName === 'string' && exercise.functionName) {
    if (!exercise.referenceSolution.includes(exercise.functionName)) {
      return [`"referenceSolution" must contain the function name "${exercise.functionName}"`];
    }
  }

  let prefixSrc = '';
  if (exercise.engine === GEOMETRY_ENGINE) {
    const primitivesRaw = readFileSync(resolve(PRIMITIVES_PATH), 'utf8');
    prefixSrc = primitivesRaw.replace(/^export\s+/gm, '') + '\n';
  }

  const context = vm.createContext({});
  try {
    vm.runInContext(prefixSrc + exercise.referenceSolution, context);
  } catch (err) {
    return [`"referenceSolution" failed to evaluate: ${err.message}`];
  }

  const fn = context[exercise.functionName];
  if (typeof fn !== 'function') {
    return [`"referenceSolution" did not define a function named "${exercise.functionName}"`];
  }

  const testCases = exercise.testCases;
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return ['"testCases" must be a non-empty array'];
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    let actual;
    try {
      const raw = fn(...tc.input);
      actual = JSON.parse(JSON.stringify(raw));
    } catch (err) {
      errors.push(`testCases[${i}] threw: ${err.message}`);
      continue;
    }
    if (!deepEqual(actual, tc.expected)) {
      errors.push(
        `testCases[${i}] FAIL — expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(actual)}`
      );
    }
  }

  return errors;
}

const argFiles = process.argv.slice(2).filter((f) => !EXCLUDED_FILES.has(f.split('/').pop()));
const files = argFiles.length ? argFiles : resolveDefaultFiles();

let hasFailures = false;

for (const file of files) {
  const absPath = resolve(file);
  const errors = checkExercise(absPath);
  if (errors.length) {
    console.error(`FAIL  ${file}`);
    for (const err of errors) {
      console.error(`      - ${err}`);
    }
    hasFailures = true;
    continue;
  }
  console.log(`OK    ${file}`);
}

if (hasFailures) process.exit(1);
