import { test, expect } from '@playwright/test';
import { pasteCode, CORRECT_SOLUTION } from './helpers.js';

// ---------------------------------------------------------------------------
// Step debugger e2e tests
// ---------------------------------------------------------------------------

// Helper: navigate, wait for editor, paste the correct solution, and click Debug.
// Returns when #dbg-position contains at least one digit (trace is ready).
async function enterDebugMode(page) {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#debug-button').click();
  // Wait until the position indicator shows a step number
  await expect(page.locator('#dbg-position')).toContainText(/\d/, { timeout: 15000 });
}

// ---------------------------------------------------------------------------
// 1. panels hidden when inactive
// ---------------------------------------------------------------------------

test('debugger: panels are hidden before entering debug mode', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#debug-toolbar')).toBeHidden();
  await expect(page.locator('#debug-panel')).toBeHidden();

  // .editor-panel must NOT have class "debugging" on cold load
  const hasDebugging = await page.locator('.editor-panel').evaluate(
    el => el.classList.contains('debugging')
  );
  expect(hasDebugging).toBe(false);
});

// ---------------------------------------------------------------------------
// 2. enter debug mode
// ---------------------------------------------------------------------------

test('debugger: entering debug mode shows toolbar and panel', async ({ page }) => {
  await enterDebugMode(page);

  await expect(page.locator('#debug-toolbar')).toBeVisible();
  await expect(page.locator('#debug-panel')).toBeVisible();

  // .editor-panel gets class "debugging"
  const hasDebugging = await page.locator('.editor-panel').evaluate(
    el => el.classList.contains('debugging')
  );
  expect(hasDebugging).toBe(true);

  // #dbg-position shows "Step X / Y" — must contain at least two digit groups
  const posText = await page.locator('#dbg-position').textContent();
  expect(posText).toMatch(/\d+/);
  // Both current and total should appear
  expect(posText).toMatch(/\d+\s*\/\s*\d+/);
});

// ---------------------------------------------------------------------------
// 3. zero-action-shift: controls row does not move when entering debug mode
// ---------------------------------------------------------------------------

test('debugger: zero-action-shift — controls row y-position unchanged after entering debug', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);

  // Capture bounding box of #run-button (representative element of .controls row)
  const runBtn = page.locator('#run-button');
  await expect(runBtn).toBeVisible();
  const boxBefore = await runBtn.boundingBox();
  expect(boxBefore).not.toBeNull();

  await page.locator('#debug-button').click();
  await expect(page.locator('#dbg-position')).toContainText(/\d/, { timeout: 15000 });

  const boxAfter = await runBtn.boundingBox();
  expect(boxAfter).not.toBeNull();

  // y must not shift when the debug toolbar slides in between controls and editor
  expect(boxAfter.y).toBe(boxBefore.y);
});

// ---------------------------------------------------------------------------
// 4. stepping advances position and populates vars/callstack
// ---------------------------------------------------------------------------

test('debugger: stepping forward advances position and populates panels', async ({ page }) => {
  await enterDebugMode(page);

  const positionEl = page.locator('#dbg-position');
  const initialText = await positionEl.textContent();

  // Step into — should advance if not already at end
  const stepIntoBtn = page.locator('#dbg-step-into');
  await expect(stepIntoBtn).toBeEnabled({ timeout: 5000 });
  await stepIntoBtn.click();

  // Position text must have changed
  await expect(positionEl).not.toHaveText(initialText, { timeout: 5000 });
  const newText = await positionEl.textContent();
  expect(newText).toMatch(/\d+\s*\/\s*\d+/);

  // Variables panel must be populated (non-empty; either shows var rows or "—")
  const varsContent = page.locator('#debug-vars-content');
  await expect(varsContent).toBeVisible();
  const varsText = await varsContent.textContent();
  expect(varsText.trim().length).toBeGreaterThan(0);

  // Callstack panel must be populated
  const callstackContent = page.locator('#debug-callstack-content');
  await expect(callstackContent).toBeVisible();
  const callstackText = await callstackContent.textContent();
  expect(callstackText.trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 5. step back returns to a prior step
// ---------------------------------------------------------------------------

test('debugger: step back decrements or moves toward the beginning', async ({ page }) => {
  await enterDebugMode(page);

  const positionEl = page.locator('#dbg-position');

  // Step forward once first so step-back is enabled
  const stepIntoBtn = page.locator('#dbg-step-into');
  await expect(stepIntoBtn).toBeEnabled({ timeout: 5000 });
  await stepIntoBtn.click();
  const afterForwardText = await positionEl.textContent();

  // Step back
  const stepBackBtn = page.locator('#dbg-step-back');
  await expect(stepBackBtn).toBeEnabled({ timeout: 5000 });
  await stepBackBtn.click();

  // Position must have changed from the post-forward value
  await expect(positionEl).not.toHaveText(afterForwardText, { timeout: 5000 });

  // The new position number should be less than the forward position
  const afterBackText = await positionEl.textContent();
  const forwardMatch = afterForwardText.match(/(\d+)\s*\/\s*\d+/);
  const backMatch = afterBackText.match(/(\d+)\s*\/\s*\d+/);
  if (forwardMatch && backMatch) {
    expect(Number(backMatch[1])).toBeLessThan(Number(forwardMatch[1]));
  }
});

// ---------------------------------------------------------------------------
// 6. test-case picker has multiple options and switching keeps debugger active
// ---------------------------------------------------------------------------

test('debugger: test-case picker has multiple options', async ({ page }) => {
  await page.goto('/');

  // Picker is always in the DOM (inside #debug-toolbar), just hidden
  const picker = page.locator('#dbg-test-picker');

  // Valid Parentheses has 12 test cases → picker must have > 1 option
  const optionCount = await picker.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);
});

test('debugger: selecting a different test case then entering debug keeps debugger active', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);

  // The picker lives inside the hidden toolbar; use evaluate to set its value
  // without requiring visibility (the value is read by handleDebug on click).
  await page.evaluate(() => {
    const picker = document.getElementById('dbg-test-picker');
    if (picker && picker.options.length > 1) picker.value = picker.options[1].value;
  });

  await page.locator('#debug-button').click();
  await expect(page.locator('#dbg-position')).toContainText(/\d/, { timeout: 15000 });

  // Debugger still active — toolbar and panel visible
  await expect(page.locator('#debug-toolbar')).toBeVisible();
  await expect(page.locator('#debug-panel')).toBeVisible();

  // Position indicator still shows a valid step
  const posText = await page.locator('#dbg-position').textContent();
  expect(posText).toMatch(/\d+\s*\/\s*\d+/);
});

// ---------------------------------------------------------------------------
// 7. exit debug: stop button hides toolbar/panel and removes .debugging
// ---------------------------------------------------------------------------

test('debugger: stop button exits debug mode and hides panels', async ({ page }) => {
  await enterDebugMode(page);

  // Confirm we are in debug mode
  await expect(page.locator('#debug-toolbar')).toBeVisible();
  await expect(page.locator('#debug-panel')).toBeVisible();

  // Click stop
  await page.locator('#dbg-stop').click();

  // Toolbar and panel must be hidden again
  await expect(page.locator('#debug-toolbar')).toBeHidden();
  await expect(page.locator('#debug-panel')).toBeHidden();

  // .editor-panel must not have .debugging
  const hasDebugging = await page.locator('.editor-panel').evaluate(
    el => el.classList.contains('debugging')
  );
  expect(hasDebugging).toBe(false);
});
