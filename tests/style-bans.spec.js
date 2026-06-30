// Static CSS gate: enforces impeccable bans + a11y requirements on src/style.css.
// Runs in Node (no page object needed); Playwright discovers it via testMatch **/*.spec.js.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(process.cwd(), 'src/style.css'), 'utf-8');

// ─── helpers ───────────────────────────────────────────────────────────────
const norm = css.replace(/\s+/g, '');

/** Extract every cubic-bezier(...) from raw CSS and return their 4 numbers. */
function parseCubicBeziers(rawCss) {
  const results = [];
  const re = /cubic-bezier\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*\)/gi;
  let m;
  while ((m = re.exec(rawCss)) !== null) {
    results.push({ a: parseFloat(m[1]), b: parseFloat(m[2]), c: parseFloat(m[3]), d: parseFloat(m[4]) });
  }
  return results;
}

/** Return every border-left/right/inline-* declaration's first px value (0 if none). */
function parseSideBorderWidths(rawCss) {
  const results = [];
  const re = /border-(left|right|inline-start|inline-end)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(rawCss)) !== null) {
    const valueStr = m[2];
    const pxMatch = valueStr.match(/(\d+(?:\.\d+)?)px/);
    results.push({ prop: m[1], value: valueStr.trim(), px: pxMatch ? parseFloat(pxMatch[1]) : 0 });
  }
  return results;
}

// ─── BAN 1: gradient text (background-clip: text) ─────────────────────────
test('BAN — no gradient text (background-clip: text)', async () => {
  const hasClip = /(-webkit-)?background-clip:text/i.test(norm);
  expect(
    hasClip,
    'Found background-clip:text in style.css — gradient text is banned (impeccable ban #1)'
  ).toBe(false);
});

// ─── BAN 2: side-stripe accent border (>= 2px) ───────────────────────────
test('BAN — no side-stripe accent border (border-left/right >= 2px)', async () => {
  const borders = parseSideBorderWidths(css);
  const violations = borders.filter(b => b.px >= 2);
  expect(
    violations,
    `Found border-left/right/inline-start/end >= 2px: ${JSON.stringify(violations)} — banned as side-stripe accent border`
  ).toHaveLength(0);
});

// ─── BAN 3: bounce / elastic easing ──────────────────────────────────────
test('BAN — no bounce/elastic easing (named keywords or out-of-range cubic-bezier)', async () => {
  // Named keywords
  const hasNamedBounce = /\b(bounce|elastic)\b/i.test(css);
  expect(
    hasNamedBounce,
    'Found "bounce" or "elastic" keyword in style.css — banned easing'
  ).toBe(false);

  // cubic-bezier y control points must stay in [0, 1]
  const beziers = parseCubicBeziers(css);
  const outOfRange = beziers.filter(({ b, d }) => b < 0 || b > 1 || d < 0 || d > 1);
  expect(
    outOfRange,
    `Found cubic-bezier with y control point outside [0,1] (overshoot/bounce): ${JSON.stringify(outOfRange)}`
  ).toHaveLength(0);
});

// ─── PRESENCE 4: prefers-reduced-motion ──────────────────────────────────
test('PRESENCE — @media (prefers-reduced-motion: reduce) block exists', async () => {
  const hasReducedMotion = /@media[^{]*prefers-reduced-motion\s*:\s*reduce/i.test(css);
  expect(
    hasReducedMotion,
    'Missing @media (prefers-reduced-motion: reduce) in style.css — required a11y rule'
  ).toBe(true);
});

// ─── PRESENCE 5: global :focus-visible ───────────────────────────────────
test('PRESENCE — global :focus-visible rule exists', async () => {
  const hasFocusVisible = /:focus-visible/.test(css);
  expect(
    hasFocusVisible,
    'Missing :focus-visible rule in style.css — required a11y rule'
  ).toBe(true);
});
