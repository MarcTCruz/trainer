#!/usr/bin/env node
import { readFileSync } from 'fs';
import { basename } from 'path';

const REQUIRED_FIELDS = ['id', 'title', 'difficulty', 'description', 'functionName', 'params', 'starterCode', 'testCases'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateExercise(filePath) {
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

  for (const field of REQUIRED_FIELDS) {
    if (exercise[field] === undefined) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length) return errors;

  if (typeof exercise.id !== 'string' || !exercise.id) {
    errors.push('"id" must be a non-empty string');
  } else {
    if (!ID_PATTERN.test(exercise.id)) {
      errors.push(`"id" must be kebab-case (got "${exercise.id}")`);
    }

    const expectedId = basename(filePath, '.json');
    if (exercise.id !== expectedId) {
      errors.push(`"id" must match filename: expected "${expectedId}", got "${exercise.id}"`);
    }
  }

  if (typeof exercise.title !== 'string' || !exercise.title) {
    errors.push('"title" must be a non-empty string');
  }

  if (!VALID_DIFFICULTIES.includes(exercise.difficulty)) {
    errors.push(`"difficulty" must be one of ${VALID_DIFFICULTIES.join(', ')} (got "${exercise.difficulty}")`);
  }

  if (typeof exercise.description !== 'string' || !exercise.description) {
    errors.push('"description" must be a non-empty string');
  }

  if (typeof exercise.functionName !== 'string' || !exercise.functionName) {
    errors.push('"functionName" must be a non-empty string');
  }

  if (!Array.isArray(exercise.params) || exercise.params.length === 0) {
    errors.push('"params" must be a non-empty array');
  }

  if (typeof exercise.starterCode !== 'string' || !exercise.starterCode) {
    errors.push('"starterCode" must be a non-empty string');
  } else if (typeof exercise.functionName === 'string' && exercise.functionName) {
    if (!exercise.starterCode.includes(exercise.functionName)) {
      errors.push(`"starterCode" must contain the function name "${exercise.functionName}"`);
    }
  }

  if (!Array.isArray(exercise.testCases) || exercise.testCases.length === 0) {
    errors.push('"testCases" must be a non-empty array');
  } else {
    exercise.testCases.forEach((tc, i) => {
      if (!Array.isArray(tc.input)) {
        errors.push(`testCases[${i}].input must be an array`);
      }
      if (tc.expected === undefined) {
        errors.push(`testCases[${i}] is missing "expected"`);
      }
    });
  }

  return errors;
}

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: validate-exercise.js <file.json> [file.json ...]');
  process.exit(1);
}

let hasFailures = false;

for (const file of files) {
  const errors = validateExercise(file);
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
