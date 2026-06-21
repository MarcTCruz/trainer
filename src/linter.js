import { LINT_RULES } from './lint-rules.js';

const MAX_SCORE = 100;
const TOTAL_RULES = 8;

export function stripStringsAndComments(code) {
  const chars = code.split('');
  let inString = null;
  let escaped = false;
  let i = 0;

  while (i < chars.length) {
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (inString && chars[i] === '\\') {
      escaped = true;
      i++;
      continue;
    }

    if (inString) {
      if (chars[i] === inString) {
        inString = null;
        i++;
        continue;
      }
      if (chars[i] !== '\n') {
        chars[i] = ' ';
      }
      i++;
      continue;
    }

    // Single-line comment: replace from // to end of line
    if (chars[i] === '/' && chars[i + 1] === '/') {
      i += 2;
      while (i < chars.length && chars[i] !== '\n') {
        chars[i] = ' ';
        i++;
      }
      continue;
    }

    if (chars[i] === '"' || chars[i] === "'" || chars[i] === '`') {
      inString = chars[i];
      i++;
      continue;
    }

    i++;
  }

  return chars.join('');
}

export function analyzeSolution(code) {
  const stripped = stripStringsAndComments(code);

  const rules = LINT_RULES.map(rule => {
    const { passed, violations } = rule.check(code, stripped);
    return {
      id: rule.id,
      passed,
      bonusXp: passed ? rule.bonusXp : 0,
      violations,
    };
  });

  const score = rules.reduce((sum, r) => sum + r.bonusXp, 0);
  const passedCount = rules.filter(r => r.passed).length;

  return { score, maxScore: MAX_SCORE, passedCount, totalRules: TOTAL_RULES, rules };
}
