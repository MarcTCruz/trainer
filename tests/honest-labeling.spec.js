import { test, expect } from '@playwright/test';

test('honest labeling: no banned vague labels used as button/anchor labels', async () => {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const BANNED = ['your data', 'click here', 'more info'];
  const en = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/en.json'), 'utf-8'));
  const ptBR = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/pt-BR.json'), 'utf-8'));

  // Collect i18n keys used as button/anchor labels:
  // (a) makeButton(id, class, 'KEY') 3rd arg across src/*.js
  // (b) any anchor/button element whose textContent is set via t('KEY')  [best-effort: scan `.textContent = t('KEY')`]
  const sources = ['src/app.js']; // add others if they call makeButton
  const labelKeys = new Set();
  const makeBtn = /makeButton\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;
  const textT = /\.textContent\s*=\s*t\(\s*['"]([^'"]+)['"]/g;
  for (const f of sources) {
    const src = readFileSync(join(process.cwd(), f), 'utf-8');
    for (const m of src.matchAll(makeBtn)) labelKeys.add(m[1]);
    for (const m of src.matchAll(textT)) labelKeys.add(m[1]);
  }

  const norm = s => String(s ?? '').trim().toLowerCase().replace(/[.!?:→\s]+$/u, '');
  const violations = [];
  for (const key of labelKeys) {
    for (const [loc, dict] of [['en', en], ['pt-BR', ptBR]]) {
      const val = dict[key];
      if (val === undefined) continue;
      if (BANNED.includes(norm(val))) violations.push(`${loc}:${key} = "${val}"`);
    }
  }
  expect(violations, `Banned vague labels used as button/anchor labels: ${violations.join(', ')}`).toEqual([]);
});
