import { test, expect } from '@playwright/test';
import { SECTION_TITLES, ARIA_LABELS, I18N_EXEMPT_PATTERNS } from './helpers.js';

// ---------------------------------------------------------------------------
// i18n — translation completeness and locale switching
// ---------------------------------------------------------------------------

test('i18n: all locale files have the same keys and placeholders as en.json', async () => {
  const { readFileSync, readdirSync } = await import('fs');
  const { join } = await import('path');

  const i18nDir = join(process.cwd(), 'src', 'i18n');
  const en = JSON.parse(readFileSync(join(i18nDir, 'en.json'), 'utf-8'));
  const enKeys = Object.keys(en);

  const localeFiles = readdirSync(i18nDir).filter(f => f.endsWith('.json') && f !== 'en.json');
  expect(localeFiles.length).toBeGreaterThan(0);

  for (const file of localeFiles) {
    const locale = JSON.parse(readFileSync(join(i18nDir, file), 'utf-8'));
    const localeKeys = Object.keys(locale);

    const missing = enKeys.filter(k => !localeKeys.includes(k));
    expect(missing, `${file} missing keys`).toEqual([]);

    const extra = localeKeys.filter(k => !enKeys.includes(k));
    expect(extra, `${file} extra keys`).toEqual([]);

    const empty = localeKeys.filter(k => locale[k] === '');
    expect(empty, `${file} empty values`).toEqual([]);

    for (const key of enKeys) {
      const enPh = (en[key].match(/\{[^}]+\}/g) || []).sort();
      const localePh = (locale[key]?.match(/\{[^}]+\}/g) || []).sort();
      expect(localePh, `${file} "${key}" placeholders`).toEqual(enPh);
    }
  }
});

test('locale selector switches UI to Portuguese and back to English', async ({ page }) => {
  await page.goto('/');

  // Default is English
  await expect(page.locator('#run-button')).toHaveText('Run Code');
  await expect(page.locator('#reset-button')).toHaveText('Reset');
  await expect(page.locator('#browse-button')).toHaveText('Browse');

  // Switch to pt-BR
  await page.locator('.locale-btn', { hasText: 'pt-BR' }).click();

  // Verify Portuguese strings
  await expect(page.locator('#run-button')).toHaveText('Executar');
  await expect(page.locator('#reset-button')).toHaveText('Resetar');
  await expect(page.locator('#format-button')).toHaveText('Formatar');
  await expect(page.locator('#browse-button')).toHaveText('Explorar');

  // Switch back to English
  await page.locator('.locale-btn', { hasText: 'en' }).click();

  // Verify English strings
  await expect(page.locator('#run-button')).toHaveText('Run Code');
  await expect(page.locator('#reset-button')).toHaveText('Reset');
  await expect(page.locator('#format-button')).toHaveText('Format');
  await expect(page.locator('#browse-button')).toHaveText('Browse');
});

test('i18n: every text-setting line in source uses t() or is exempt', async () => {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const TEXT_SETTERS = /\.(textContent|innerText|placeholder)\s*=\s*/;
  const ARIA_LABEL = /setAttribute\(\s*['"]aria-label['"]\s*,/;
  const USES_T = /\bt\(/;
  const EMPTY_STRING = /=\s*['"]['"]\s*;?\s*$/;
  const EXEMPT_PATTERNS = I18N_EXEMPT_PATTERNS;

  const files = ['src/app.js', 'src/runner.js', 'src/debugger/debugUI.js'];
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(process.cwd(), file), 'utf-8').split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const isTextSetter = TEXT_SETTERS.test(trimmed) || ARIA_LABEL.test(trimmed);
      if (!isTextSetter) return;
      const block = lines.slice(idx, idx + 4).join(' ');
      if (USES_T.test(block)) return;
      if (EMPTY_STRING.test(trimmed)) return;
      if (EXEMPT_PATTERNS.some(p => p.test(block))) return;
      violations.push(`${file}:${idx + 1}: ${trimmed}`);
    });
  }

  expect(violations, `Text-setting lines not using t(): ${violations.join('\n')}`).toEqual([]);
});

test('locale selection persists across page reload', async ({ page }) => {
  await page.goto('/');

  // Switch to pt-BR
  await page.locator('.locale-btn', { hasText: 'pt-BR' }).click();
  await expect(page.locator('#run-button')).toHaveText('Executar');

  // Reload
  await page.reload();

  // Should still be Portuguese
  await expect(page.locator('#run-button')).toHaveText('Executar', { timeout: 5000 });
  await expect(page.locator('#browse-button')).toHaveText('Explorar');
});

test('i18n: every hardcoded English string in index.html has a matching translation key', async () => {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf-8');
  const en = JSON.parse(readFileSync(join(process.cwd(), 'src', 'i18n', 'en.json'), 'utf-8'));

  const enExact = new Set(Object.values(en));
  const enTemplateRegexes = Object.values(en)
    .filter(v => /\{[^}]+\}/.test(v))
    .map(v => new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\{[^}]+\\}/g, '.+') + '$'));

  function normalize(text) {
    return text
      .replace(/&middot;/g, '·').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
      .replace(/&times;/g, '×').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasCoverage(text) {
    const n = normalize(text);
    if (!n) return true;
    if (enExact.has(n)) return true;
    if (enTemplateRegexes.some(re => re.test(n))) return true;
    if ([...enExact].some(v => v.length > 3 && n.includes(v))) return true;
    return false;
  }

  const ELEMENT_RE = /<(button|h[1-6]|span|label|p|a|select)\b[^>]*>([^<]+)<\//gi;
  const ATTR_RE = /<[^>]+\b(title|aria-label)\s*=\s*["']([^"']+)["']/gi;
  const PLACEHOLDER_RE = /<[^>]+\bplaceholder\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

  const EXEMPT_RE = /^[⏪↓→↑▶◀⏮🏆✕×·\d\s.]+$|^(Ctrl|Enter|Shift|Alt|F)$/;
  const EXEMPT_CLASSES = ['stat-value', 'shortcut-hint', 'cm-'];

  function isExempt(text, fullTag) {
    if (!text || /^\s*$/.test(text)) return true;
    if (EXEMPT_RE.test(text.trim())) return true;
    if (EXEMPT_CLASSES.some(c => fullTag.includes(c))) return true;
    return false;
  }

  const violations = [];

  for (const match of html.matchAll(ELEMENT_RE)) {
    const [full, tag, text] = match;
    const norm = normalize(text);
    if (isExempt(norm, full)) continue;
    if (!hasCoverage(text)) {
      violations.push(`<${tag}> text="${norm}" — no matching en.json value`);
    }
  }

  for (const match of html.matchAll(ATTR_RE)) {
    const [full, attr, value] = match;
    if (isExempt(value, full)) continue;
    if (!hasCoverage(value)) {
      const idMatch = full.match(/id=["']([^"']+)["']/);
      violations.push(`${attr}="${value}" on ${idMatch ? '#' + idMatch[1] : 'element'} — no matching en.json value`);
    }
  }

  for (const match of html.matchAll(PLACEHOLDER_RE)) {
    const [full, dq, sq] = match;
    const value = dq ?? sq;
    if (isExempt(value, full)) continue;
    if (!hasCoverage(value)) {
      const idMatch = full.match(/id=["']([^"']+)["']/);
      violations.push(`placeholder="${value}" on ${idMatch ? '#' + idMatch[1] : 'element'} — no matching en.json value`);
    }
  }

  expect(violations, `HTML text without translation key:\n${violations.join('\n')}`).toEqual([]);
});

test('i18n: locale switch translates all UI chrome including debug and custom tests', async ({ page }) => {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const en = JSON.parse(readFileSync(join(process.cwd(), 'src', 'i18n', 'en.json'), 'utf-8'));
  const ptBR = JSON.parse(readFileSync(join(process.cwd(), 'src', 'i18n', 'pt-BR.json'), 'utf-8'));

  await page.goto('/');

  const BUTTONS = [
    { sel: '#run-button', key: 'run.runCode' },
    { sel: '#reset-button', key: 'run.reset' },
    { sel: '#format-button', key: 'run.format' },
    { sel: '#debug-button', key: 'debug.button' },
    { sel: '#browse-button', key: 'nav.browse' },
    { sel: '#custom-tests-toggle', key: 'customTest.add' },
    { sel: '#custom-test-add', key: 'customTest.addButton' },
  ];

  const LOCAL_SECTION_TITLES = SECTION_TITLES;

  const LOCAL_ARIA_LABELS = ARIA_LABELS;

  const PLACEHOLDERS = [
    { sel: '#custom-test-input', key: 'customTest.inputPlaceholder' },
    { sel: '#custom-test-expected', key: 'customTest.expectedPlaceholder' },
    { sel: '#token-input', key: 'auth.tokenPlaceholder' },
  ];

  for (const { sel, key } of BUTTONS) {
    await expect(page.locator(sel), `${sel} en`).toHaveText(en[key]);
  }
  for (const { sel, key } of LOCAL_SECTION_TITLES) {
    await expect(page.locator(sel), `${sel} en`).toHaveText(en[key]);
  }
  for (const { sel, key } of LOCAL_ARIA_LABELS) {
    expect(
      await page.locator(sel).getAttribute('aria-label'),
      `${sel} aria-label en`
    ).toBe(en[key]);
  }
  for (const { sel, key } of PLACEHOLDERS) {
    expect(
      await page.locator(sel).getAttribute('placeholder'),
      `${sel} placeholder en`
    ).toBe(en[key]);
  }

  await page.locator('.locale-btn', { hasText: 'pt-BR' }).click();
  await expect(page.locator('#run-button')).toHaveText(ptBR['run.runCode']);

  for (const { sel, key } of BUTTONS) {
    await expect(page.locator(sel), `${sel} pt-BR`).toHaveText(ptBR[key]);
  }
  for (const { sel, key } of LOCAL_SECTION_TITLES) {
    await expect(page.locator(sel), `${sel} pt-BR`).toHaveText(ptBR[key]);
  }
  for (const { sel, key } of LOCAL_ARIA_LABELS) {
    expect(
      await page.locator(sel).getAttribute('aria-label'),
      `${sel} aria-label pt-BR`
    ).toBe(ptBR[key]);
  }
  for (const { sel, key } of PLACEHOLDERS) {
    expect(
      await page.locator(sel).getAttribute('placeholder'),
      `${sel} placeholder pt-BR`
    ).toBe(ptBR[key]);
  }
});
