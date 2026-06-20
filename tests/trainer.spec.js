import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: paste code into the CodeMirror editor
// ---------------------------------------------------------------------------

async function pasteCode(page, code) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.evaluate((c) => {
    document.execCommand('insertText', false, c)
  }, code)
  await page.waitForTimeout(200)
}

// ---------------------------------------------------------------------------
// Correct solution for the base exercise
// ---------------------------------------------------------------------------

const CORRECT_SOLUTION = `function isValid(s) {
  const stack = [];
  const map = new Map([[')', '('], [']', '['], ['}', '{']]);
  for (const ch of s) {
    if (map.has(ch)) {
      if (stack.pop() !== map.get(ch)) return false;
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}`

// ---------------------------------------------------------------------------
// Correct solution for the depth-limit variant
// ---------------------------------------------------------------------------

const DEPTH_SOLUTION = `function isValidDepth(s, maxDepth) {
  const stack = [];
  const map = new Map([[')', '('], [']', '['], ['}', '{']]);
  for (const ch of s) {
    if (map.has(ch)) {
      if (stack.pop() !== map.get(ch)) return false;
    } else {
      stack.push(ch);
      if (stack.length > maxDepth) return false;
    }
  }
  return stack.length === 0;
}`

// ---------------------------------------------------------------------------
// Page loads correctly
// ---------------------------------------------------------------------------

test('title "The Refactory" is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('The Refactory')
})

test('Learning Path Ribbon shows "Stack Fundamentals" pill', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.learning-ribbon')).toContainText('Stack Fundamentals')
})

test('Evolution Tree stepper shows "Valid Parentheses" as active', async ({ page }) => {
  await page.goto('/')
  const activeNode = page.locator('.stepper-node.active')
  await expect(activeNode).toContainText('Valid Parentheses')
})

test('CodeMirror editor renders with starter code', async ({ page }) => {
  await page.goto('/')
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await expect(editor).toContainText('isValid')
})

test('Run Code, Reset, and Format buttons are visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#run-button')).toBeVisible()
  await expect(page.locator('#reset-button')).toBeVisible()
  await expect(page.locator('#format-button')).toBeVisible()
})

// ---------------------------------------------------------------------------
// Exercise execution — correct solution passes
// ---------------------------------------------------------------------------

test('correct solution shows "All tests passed" with 12 passing results', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, CORRECT_SOLUTION)
  await page.locator('#run-button').click()

  const status = page.locator('#status-message')
  await expect(status).toContainText('All tests passed', { timeout: 15000 })

  const passResults = page.locator('.test-result.pass')
  await expect(passResults).toHaveCount(12)
})

// ---------------------------------------------------------------------------
// Exercise execution — wrong solution fails
// ---------------------------------------------------------------------------

test('wrong solution shows failing tests with expected/actual values', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, 'function isValid(s) { return true; }')
  await page.locator('#run-button').click()

  const status = page.locator('#status-message')
  await expect(status).not.toContainText('All tests passed', { timeout: 15000 })
  await expect(status).toContainText('tests passed', { timeout: 15000 })

  const failResults = page.locator('.test-result.fail')
  await expect(failResults).not.toHaveCount(0)

  // At least one failing test must show expected/actual detail
  const firstFail = failResults.first()
  const hasExpected = await firstFail.locator('.result-expected').isVisible()
  const hasError = await firstFail.locator('.result-error').isVisible()
  expect(hasExpected || hasError).toBe(true)
})

// ---------------------------------------------------------------------------
// Exercise execution — syntax error handling
// ---------------------------------------------------------------------------

test('syntax error shows an error message', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, 'function isValid(s) { ')
  await page.locator('#run-button').click()

  const status = page.locator('#status-message')
  await expect(status).toContainText('Error', { timeout: 15000 })
})

// ---------------------------------------------------------------------------
// Exercise execution — infinite loop timeout
// ---------------------------------------------------------------------------

test('infinite loop shows interrupted error', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, 'function isValid(s) { while(true){} }')
  await page.locator('#run-button').click()

  const status = page.locator('#status-message')
  await expect(status).toContainText('0/12 tests passed', { timeout: 15000 })
  const results = page.locator('.test-result')
  await expect(results.first()).toContainText('interrupted')
})

// ---------------------------------------------------------------------------
// Evolution prompt appears after solving the base exercise
// ---------------------------------------------------------------------------

test('evolution prompt appears after solving the base exercise', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, CORRECT_SOLUTION)
  await page.locator('#run-button').click()

  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 })

  const prompt = page.locator('.evolution-prompt')
  await expect(prompt).toBeVisible()
  await expect(prompt.locator('button', { hasText: 'Evolve' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Variant transition
// ---------------------------------------------------------------------------

test('clicking Evolve loads depth variant and preserves stack code', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, CORRECT_SOLUTION)
  await page.locator('#run-button').click()

  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 })
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click()

  // Title changes to the depth variant
  await expect(page.locator('#exercise-title')).toContainText('Depth Limit', { timeout: 5000 })

  // Editor still contains the previous code (keepCode = true)
  const editor = page.locator('.cm-content')
  await expect(editor).toContainText('stack')

  // Stepper: base node is solved, depth node is active
  const solvedNode = page.locator('.stepper-node.solved')
  await expect(solvedNode).toContainText('Valid Parentheses')

  const activeNode = page.locator('.stepper-node.active')
  await expect(activeNode).toContainText('Depth Limit')
})

// ---------------------------------------------------------------------------
// Variant exercise works end-to-end
// ---------------------------------------------------------------------------

test('depth variant passes all tests and updates XP and Solved counters', async ({ page }) => {
  await page.goto('/')

  // Solve base exercise first to unlock the variant
  await pasteCode(page, CORRECT_SOLUTION)
  await page.locator('#run-button').click()
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 })

  // Evolve
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click()
  await expect(page.locator('#exercise-title')).toContainText('Depth Limit', { timeout: 5000 })

  // Paste depth solution and run
  await pasteCode(page, DEPTH_SOLUTION)
  await page.locator('#run-button').click()
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 })

  // Stats reflect two solved exercises
  await expect(page.locator('#solved-value')).toHaveText('2')
  await expect(page.locator('#xp-value')).not.toHaveText('0')
})

// ---------------------------------------------------------------------------
// Format button
// ---------------------------------------------------------------------------

test('Format button reformats code into multiple lines', async ({ page }) => {
  await page.goto('/')
  const oneLiner = 'function isValid(s){const stack=[];for(const ch of s){if(ch==="("){stack.push(ch);}else{if(stack.pop()!==("("))return false;}}return stack.length===0;}'
  await pasteCode(page, oneLiner)

  const editor = page.locator('.cm-content')
  const beforeLines = await editor.locator('.cm-line').count()

  await page.locator('#format-button').click()
  await page.waitForTimeout(3000)

  const afterLines = await editor.locator('.cm-line').count()
  expect(afterLines).toBeGreaterThan(beforeLines)
})

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

test('Reset button restores starter code', async ({ page }) => {
  await page.goto('/')
  await pasteCode(page, 'function isValid(s) { return false; }')

  await page.locator('#reset-button').click()

  const editor = page.locator('.cm-content')
  // Starter code contains this placeholder comment
  await expect(editor).toContainText('Your solution here')
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('stepper nodes are <button> elements', async ({ page }) => {
  await page.goto('/')
  const stepperButtons = page.locator('#evolution-stepper button')
  await expect(stepperButtons.first()).toBeVisible()
  // Confirm the tag is a native button (Playwright toHaveRole uses ARIA role)
  await expect(stepperButtons.first()).toHaveRole('button')
})

test('learning ribbon has role="navigation" and aria-label', async ({ page }) => {
  await page.goto('/')
  const ribbon = page.locator('#learning-ribbon')
  await expect(ribbon).toHaveAttribute('role', 'navigation')
  await expect(ribbon).toHaveAttribute('aria-label')
})

test('evolution stepper has role="navigation" and aria-label', async ({ page }) => {
  await page.goto('/')
  const stepper = page.locator('#evolution-stepper')
  await expect(stepper).toHaveAttribute('role', 'navigation')
  await expect(stepper).toHaveAttribute('aria-label')
})
