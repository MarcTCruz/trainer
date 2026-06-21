// unit-role: edge — exercises boundary inputs for stripStringsAndComments and each lint rule:
// passing code, violating code, and string/comment false-positive cases. Edge inputs include
// escaped quotes, optional chaining (?.), and allowlisted dot chains. No mocks.
import { describe, it, expect } from 'bun:test';
import { stripStringsAndComments } from '../src/linter.js';
import { analyzeSolution } from '../src/linter.js';
import { LINT_RULES } from '../src/lint-rules.js';

// ---------------------------------------------------------------------------
// Helper: get a rule's check fn by id
// ---------------------------------------------------------------------------
function rule(id) {
  const r = LINT_RULES.find(r => r.id === id);
  if (!r) throw new Error(`rule not found: ${id}`);
  return r;
}

function check(id, code) {
  const stripped = stripStringsAndComments(code);
  return rule(id).check(code, stripped);
}

// ---------------------------------------------------------------------------
// stripStringsAndComments
// ---------------------------------------------------------------------------
describe('stripStringsAndComments', () => {
  it('strips double-quoted strings', () => {
    const result = stripStringsAndComments('const x = "hello world";');
    expect(result).toBe('const x = "           ";');
  });

  it('strips single-quoted strings', () => {
    const result = stripStringsAndComments("const x = 'hi';");
    expect(result).toBe("const x = '  ';");
  });

  it('strips template literals', () => {
    const result = stripStringsAndComments('const x = `foo bar`;');
    expect(result).toBe('const x = `       `;');
  });

  it('strips single-line comments', () => {
    const result = stripStringsAndComments('const x = 1; // a comment here');
    expect(result).toBe('const x = 1; //               ');
  });

  it('handles escaped quotes inside strings', () => {
    const result = stripStringsAndComments('const x = "say \\"hi\\" now";');
    expect(result).not.toContain('hi');
    expect(result.length).toBe('const x = "say \\"hi\\" now";'.length);
  });

  it('preserves line count (same number of newlines)', () => {
    const code = 'const a = "foo";\nconst b = 1; // comment\nconst c = `bar`;';
    const result = stripStringsAndComments(code);
    const originalNewlines = (code.match(/\n/g) || []).length;
    const strippedNewlines = (result.match(/\n/g) || []).length;
    expect(strippedNewlines).toBe(originalNewlines);
  });

  it('does NOT strip code outside strings/comments', () => {
    const code = 'function add(a, b) { return a + b; }';
    const result = stripStringsAndComments(code);
    expect(result).toBe(code);
  });
});

// ---------------------------------------------------------------------------
// Rule: no-else
// ---------------------------------------------------------------------------
describe('rule: no-else', () => {
  it('passes when using if/return without else', () => {
    const code = `function f(x) {\n  if (x > 0) return x;\n  return -x;\n}`;
    expect(check('no-else', code).passed).toBe(true);
  });

  it('fails and returns correct line number when else is used', () => {
    const code = `function f(x) {\n  if (x > 0) return x;\n  else return -x;\n}`;
    const result = check('no-else', code);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('line 3');
  });

  it('"else" inside a string does NOT trigger', () => {
    const code = `const msg = "use else carefully";\nreturn msg;`;
    expect(check('no-else', code).passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule: max-indent
// ---------------------------------------------------------------------------
describe('rule: max-indent', () => {
  it('passes when code has at most 2 indent levels', () => {
    const code = `function f() {\n  if (x) {\n    return 1;\n  }\n}`;
    expect(check('max-indent', code).passed).toBe(true);
  });

  it('fails when code has 3+ indent levels', () => {
    const code = `function f() {\n  if (x) {\n    if (y) {\n      return 1;\n    }\n  }\n}`;
    const result = check('max-indent', code);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: no-var
// ---------------------------------------------------------------------------
describe('rule: no-var', () => {
  it('passes when const/let used', () => {
    const code = `const x = 1;\nlet y = 2;`;
    expect(check('no-var', code).passed).toBe(true);
  });

  it('fails when var is used', () => {
    const code = `var x = 1;`;
    const result = check('no-var', code);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('line 1');
  });

  it('"var" inside a string does NOT trigger', () => {
    const code = `const msg = "use var carefully";`;
    expect(check('no-var', code).passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule: function-length
// ---------------------------------------------------------------------------
describe('rule: function-length', () => {
  it('passes for a short function', () => {
    const lines = ['function f() {', ...Array(5).fill('  const x = 1;'), '}'];
    expect(check('function-length', lines.join('\n')).passed).toBe(true);
  });

  it('fails for a function with 20 body lines', () => {
    const lines = ['function longFn() {', ...Array(20).fill('  const x = 1;'), '}'];
    const result = check('function-length', lines.join('\n'));
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/longFn/);
    expect(result.violations[0]).toMatch(/20 body lines/);
  });
});

// ---------------------------------------------------------------------------
// Rule: no-magic-numbers
// ---------------------------------------------------------------------------
describe('rule: no-magic-numbers', () => {
  it('passes when number is in a const declaration', () => {
    const code = `const LIMIT = 42;`;
    expect(check('no-magic-numbers', code).passed).toBe(true);
  });

  it('fails when a bare magic number appears in an expression', () => {
    const code = `if (x > 42) return;`;
    const result = check('no-magic-numbers', code);
    expect(result.passed).toBe(false);
  });

  it('0 and 1 do not trigger', () => {
    const code = `if (x === 0) return 1;`;
    expect(check('no-magic-numbers', code).passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule: no-nested-ternary
// ---------------------------------------------------------------------------
describe('rule: no-nested-ternary', () => {
  it('passes for a simple ternary', () => {
    const code = `const x = a ? b : c;`;
    expect(check('no-nested-ternary', code).passed).toBe(true);
  });

  it('fails for a nested ternary', () => {
    const code = `const x = a ? b ? c : d : e;`;
    const result = check('no-nested-ternary', code);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('line 1');
  });

  it('optional chaining ?. does not count as ternary', () => {
    const code = `const x = obj?.prop ? 1 : 0;`;
    expect(check('no-nested-ternary', code).passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule: short-dot-chains
// ---------------------------------------------------------------------------
describe('rule: short-dot-chains', () => {
  it('passes for a.b (1 dot)', () => {
    const code = `const x = a.b;`;
    expect(check('short-dot-chains', code).passed).toBe(true);
  });

  it('fails for a.b.c.d (3 dots)', () => {
    const code = `const x = foo.bar.baz.qux;`;
    const result = check('short-dot-chains', code);
    expect(result.passed).toBe(false);
  });

  it('console.error.stack.message.extra passes (allowlist covers all console chains)', () => {
    // Brief: chains STARTING WITH console are excluded regardless of depth
    const code = `console.error.stack.message.extra;`;
    expect(check('short-dot-chains', code).passed).toBe(true);
  });

  it('console.log(x) passes (allowlist)', () => {
    const code = `console.log(x);`;
    expect(check('short-dot-chains', code).passed).toBe(true);
  });

  it('JSON.parse.something.extra passes (allowlist covers all JSON chains)', () => {
    // Brief: chains starting with JSON are excluded
    const code = `JSON.parse.something.extra();`;
    expect(check('short-dot-chains', code).passed).toBe(true);
  });

  it('user domain chain with 3 dots fails', () => {
    const code = `const x = foo.bar.baz.qux.quux;`;
    const result = check('short-dot-chains', code);
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule: const-over-let
// ---------------------------------------------------------------------------
describe('rule: const-over-let', () => {
  it('passes when const is used', () => {
    const code = `const x = 1;`;
    expect(check('const-over-let', code).passed).toBe(true);
  });

  it('fails when let is declared but never reassigned', () => {
    const code = `let x = 1;\nreturn x;`;
    const result = check('const-over-let', code);
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/let x/);
  });

  it('passes when let is declared and later reassigned', () => {
    const code = `let x = 1;\nx = 2;\nreturn x;`;
    expect(check('const-over-let', code).passed).toBe(true);
  });

  it('passes when let is used with ++', () => {
    const code = `let count = 0;\ncount++;\nreturn count;`;
    expect(check('const-over-let', code).passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeSolution — report shape, score, passedCount
// ---------------------------------------------------------------------------
describe('analyzeSolution', () => {
  it('returns correct report shape', () => {
    const code = `function f(x) {\n  if (x > 0) return x;\n  return -x;\n}`;
    const report = analyzeSolution(code);
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('maxScore', 100);
    expect(report).toHaveProperty('passedCount');
    expect(report).toHaveProperty('totalRules', 8);
    expect(report).toHaveProperty('rules');
    expect(report.rules.length).toBe(8);
    report.rules.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('passed');
      expect(r).toHaveProperty('bonusXp');
      expect(r).toHaveProperty('violations');
    });
  });

  it('score sums only passed rules bonusXp', () => {
    const code = `const x = 1;`; // simple code: likely passes most rules
    const report = analyzeSolution(code);
    const expectedScore = report.rules.filter(r => r.passed).reduce((s, r) => s + r.bonusXp, 0);
    expect(report.score).toBe(expectedScore);
  });

  it('passedCount matches actual passes', () => {
    const code = `const x = 1;`;
    const report = analyzeSolution(code);
    const actualPassed = report.rules.filter(r => r.passed).length;
    expect(report.passedCount).toBe(actualPassed);
  });

  it('failed rules have bonusXp of 0', () => {
    // code with an else — no-else will fail
    const code = `function f(x) { if (x > 0) { return x; } else { return -x; } }`;
    const report = analyzeSolution(code);
    const noElseRule = report.rules.find(r => r.id === 'no-else');
    expect(noElseRule.passed).toBe(false);
    expect(noElseRule.bonusXp).toBe(0);
  });
});
