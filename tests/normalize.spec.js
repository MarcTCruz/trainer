import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// normalizeCode — adversarial tests for whitespace normalization
// ---------------------------------------------------------------------------

test('normalizeCode preserves spaces inside double-quoted strings', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const { normalizeCode } = window.__test_normalizeCode ?? {};
    if (!normalizeCode) return 'NOT_EXPOSED';
    return normalizeCode('var x = "hello   world";');
  });
  if (result === 'NOT_EXPOSED') {
    const { normalizeCode } = await import('../src/progress.js');
    expect(normalizeCode('var x = "hello   world";')).toBe('var x = "hello   world";');
    expect(normalizeCode("var x = 'hello   world';")).toBe("var x = 'hello   world';");
    expect(normalizeCode('var x = `hello   world`;')).toBe('var x = `hello   world`;');
    return;
  }
  expect(result).toBe('var x = "hello   world";');
});

test('normalizeCode collapses whitespace outside strings', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('function  foo(  )  {  }')).toBe('function foo( ) { }');
  expect(normalizeCode('  var   x  =  1  ;  ')).toBe('var x = 1 ;');
  expect(normalizeCode('a\n\n\nb')).toBe('a b');
  expect(normalizeCode('a\t\tb')).toBe('a b');
});

test('normalizeCode handles escaped quotes inside strings', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('var x = "he said \\"hi  there\\"";')).toBe('var x = "he said \\"hi  there\\"";');
  expect(normalizeCode("var x = 'it\\'s   fine';")).toBe("var x = 'it\\'s   fine';");
});

test('normalizeCode handles mixed string types', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  const input = 'var a = "double  space"; var b = \'single  space\'; var c = `template  space`;';
  const expected = 'var a = "double  space"; var b = \'single  space\'; var c = `template  space`;';
  expect(normalizeCode(input)).toBe(expected);
});

test('normalizeCode treats identical code with different whitespace as equal', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  const tabbed = 'function isValid(s) {\n\tconst stack = [];\n\treturn stack.length === 0;\n}';
  const spaced = 'function isValid(s) {\n  const stack = [];\n  return stack.length === 0;\n}';
  expect(normalizeCode(tabbed)).toBe(normalizeCode(spaced));
  const trailing = 'var x = 1;   \nvar y = 2;  ';
  const clean = 'var x = 1;\nvar y = 2;';
  expect(normalizeCode(trailing)).toBe(normalizeCode(clean));
});

test('normalizeCode handles empty string and whitespace-only input', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('')).toBe('');
  expect(normalizeCode('   ')).toBe('');
  expect(normalizeCode('\n\t\r')).toBe('');
});
