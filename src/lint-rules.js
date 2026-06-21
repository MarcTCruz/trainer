const CHAIN_ALLOWLIST = /^(console|JSON|Math|Object|Array|Number|String|Promise)\./;

function linesOf(text) {
  return text.split('\n');
}

function findLineNumbers(stripped, pattern) {
  return linesOf(stripped)
    .map((line, i) => (pattern.test(line) ? i + 1 : null))
    .filter(n => n !== null);
}
function checkNoElse(_code, stripped) {
  const lines = findLineNumbers(stripped, /\belse\b/);
  return { passed: lines.length === 0, violations: lines.map(l => `line ${l}`) };
}
function indentLevel(line) {
  const match = line.match(/^(\s*)/);
  const ws = match ? match[1] : '';
  if (ws.includes('\t')) return ws.split('').filter(c => c === '\t').length;
  return Math.floor(ws.length / 2);
}

function checkMaxIndent(_code, stripped) {
  const violations = linesOf(stripped)
    .map((line, i) => ({ line, num: i + 1 }))
    .filter(({ line }) => line.trim() !== '' && !/^\s*[});\]]/.test(line))
    .filter(({ line }) => indentLevel(line) >= 3)
    .map(({ num }) => `line ${num}`);
  return { passed: violations.length === 0, violations };
}
function checkNoVar(_code, stripped) {
  const lines = findLineNumbers(stripped, /\bvar\s/);
  return { passed: lines.length === 0, violations: lines.map(l => `line ${l}`) };
}

function countFunctionBodyLines(lines, startIndex) {
  let depth = (lines[startIndex].match(/\{/g) || []).length - (lines[startIndex].match(/\}/g) || []).length;
  let bodyLines = 0;
  let i = startIndex + 1;

  while (i < lines.length && depth > 0) {
    depth += (lines[i].match(/\{/g) || []).length;
    depth -= (lines[i].match(/\}/g) || []).length;
    if (depth > 0 && lines[i].trim() !== '') bodyLines++;
    i++;
  }

  return { bodyLines, nextIndex: i };
}

function checkFunctionLength(code, _stripped) {
  const lines = linesOf(code);
  const violations = [];
  let i = 0;

  while (i < lines.length) {
    const fnMatch = lines[i].match(/(?:function\s+(\w+)[^{]*|(?:const|let|var)\s+(\w+)\s*=.*=>)\s*\{/);
    if (!fnMatch) { i++; continue; }

    const name = fnMatch[1] || fnMatch[2] || '<anonymous>';
    const { bodyLines, nextIndex } = countFunctionBodyLines(lines, i);
    if (bodyLines > 15) {
      violations.push(`${name} at line ${i + 1} has ${bodyLines} body lines`);
    }
    i = nextIndex;
  }

  return { passed: violations.length === 0, violations };
}
function checkNoMagicNumbers(_code, stripped) {
  const violations = [];
  linesOf(stripped).forEach((line, i) => {
    if (/\bconst\b/.test(line)) return;
    const nums = [...line.matchAll(/(?<![.\w])-?\b(\d+(?:\.\d+)?)\b/g)];
    nums.forEach(m => {
      const val = m[1];
      if (val === '0' || val === '1') return;
      const before = line.slice(0, m.index);
      if (/\[\s*$/.test(before)) return;
      violations.push(`line ${i + 1}: ${m[0].trim()}`);
    });
  });
  return { passed: violations.length === 0, violations };
}
function checkNoNestedTernary(_code, stripped) {
  const violations = linesOf(stripped)
    .map((line, i) => ({ count: (line.replace(/\?\./g, '  ').match(/\?/g) || []).length, num: i + 1 }))
    .filter(({ count }) => count >= 2)
    .map(({ num }) => `line ${num}`);
  return { passed: violations.length === 0, violations };
}
function checkShortDotChains(_code, stripped) {
  const violations = [];
  linesOf(stripped).forEach((line, i) => {
    const chains = [...line.matchAll(/\b\w+(?:\.\w+){3,}/g)];
    chains.forEach(m => {
      if (CHAIN_ALLOWLIST.test(m[0])) return;
      violations.push(`line ${i + 1}: ${m[0]}`);
    });
  });
  return { passed: violations.length === 0, violations };
}
function checkConstOverLet(code, stripped) {
  const violations = [];
  const strippedLines = linesOf(stripped);
  const codeLines = linesOf(code);

  strippedLines.forEach((line, i) => {
    const letMatch = line.match(/\blet\s+(\w+)/);
    if (!letMatch) return;

    const varName = letMatch[1];
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reassignPattern = new RegExp(
      `(?<![\\w.])${esc}\\s*(?:[+\\-*/%&|^]=|=(?!=))|(?:\\+\\+|--)\\s*${esc}|${esc}\\s*(?:\\+\\+|--)`
    );

    const isReassigned = codeLines.some((l, j) => j !== i && reassignPattern.test(l));
    if (!isReassigned) {
      violations.push(`line ${i + 1}: let ${varName} is never reassigned, use const`);
    }
  });

  return { passed: violations.length === 0, violations };
}

export const LINT_RULES = [
  { id: 'no-else',           titleKey: 'lint.rule.noElse.title',           hintKey: 'lint.rule.noElse.hint',           bonusXp: 15, check: checkNoElse },
  { id: 'max-indent',        titleKey: 'lint.rule.maxIndent.title',        hintKey: 'lint.rule.maxIndent.hint',        bonusXp: 15, check: checkMaxIndent },
  { id: 'no-var',            titleKey: 'lint.rule.noVar.title',            hintKey: 'lint.rule.noVar.hint',            bonusXp: 10, check: checkNoVar },
  { id: 'function-length',   titleKey: 'lint.rule.functionLength.title',   hintKey: 'lint.rule.functionLength.hint',   bonusXp: 15, check: checkFunctionLength },
  { id: 'no-magic-numbers',  titleKey: 'lint.rule.noMagicNumbers.title',   hintKey: 'lint.rule.noMagicNumbers.hint',   bonusXp: 10, check: checkNoMagicNumbers },
  { id: 'no-nested-ternary', titleKey: 'lint.rule.noNestedTernary.title',  hintKey: 'lint.rule.noNestedTernary.hint',  bonusXp: 10, check: checkNoNestedTernary },
  { id: 'short-dot-chains',  titleKey: 'lint.rule.shortDotChains.title',   hintKey: 'lint.rule.shortDotChains.hint',   bonusXp: 10, check: checkShortDotChains },
  { id: 'const-over-let',    titleKey: 'lint.rule.constOverLet.title',     hintKey: 'lint.rule.constOverLet.hint',     bonusXp: 15, check: checkConstOverLet },
];
