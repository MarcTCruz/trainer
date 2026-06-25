import { test, expect } from '@playwright/test';
import { pasteCode } from './helpers.js';

// Reference solution for Proposition 1 — matches the referenceSolution in the exercise JSON.
const PROP1_SOLUTION = `function equilateralTriangle(ax, ay, bx, by) {
  const A = Point(ax, ay);
  const B = Point(bx, by);
  const side = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  const cA = Circle(A, side);
  const cB = Circle(B, side);
  const pts = intersect(cA, cB);
  const C = pts[0];
  return [A, B, C];
}`;

// Navigate to the Proposition 1 exercise via the window.__loadExercise test hook.
async function loadProposition1(page) {
  await page.goto('/');
  // Wait for the test hook to be available (set in loadExercise on first load).
  await page.waitForFunction(() => typeof window.__loadExercise === 'function');
  await page.evaluate(() => window.__loadExercise('proposition-1-equilateral-triangle'));
  await expect(page.locator('#exercise-title')).toContainText("Proposition 1", { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Geometry canvas section visibility
// ---------------------------------------------------------------------------

test('geometry section is hidden for a standard JS exercise', async ({ page }) => {
  await page.goto('/');
  // Default exercise (Valid Parentheses) is standard-io — geometry section must stay hidden.
  await expect(page.locator('#exercise-title')).toContainText('Valid Parentheses', { timeout: 5000 });
  await expect(page.locator('#debug-geometry')).toBeHidden();
});

test('geometry section appears after running Proposition 1 reference solution', async ({ page }) => {
  await loadProposition1(page);

  await pasteCode(page, PROP1_SOLUTION);
  await page.locator('#run-button').click();

  // All 5 test cases should pass.
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // The geometry section and canvas must now be visible.
  await expect(page.locator('#debug-geometry')).toBeVisible();
  await expect(page.locator('#geometry-output')).toBeVisible();

  // The debug panel container that wraps the geometry section must be visible.
  await expect(page.locator('#debug-panel')).toBeVisible();
});

test('geometry canvas has been drawn to after running a geometry exercise', async ({ page }) => {
  await loadProposition1(page);

  await pasteCode(page, PROP1_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });
  await expect(page.locator('#geometry-output')).toBeVisible();

  // Check that at least one pixel is non-black — confirms the canvas was drawn to.
  // We read a pixel near the centre of the 320×320 canvas (160, 160).
  const isDrawn = await page.evaluate(() => {
    const canvas = document.getElementById('geometry-output');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Look for any non-background pixel (background is #1a1a2e = rgb(26,26,46)).
    // A drawn shape uses accent colours that differ from the background.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r !== 26 || g !== 26 || b !== 46) return true;
    }
    return false;
  });
  expect(isDrawn).toBe(true);
});

test('geometry section hides again when switching to a standard exercise', async ({ page }) => {
  await loadProposition1(page);

  // Run the geometry exercise so the section becomes visible.
  await pasteCode(page, PROP1_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });
  await expect(page.locator('#debug-geometry')).toBeVisible();

  // Navigate away to Valid Parentheses (standard-io).
  // loadExercise resets geometrySection.hidden = true immediately on exercise switch.
  await page.evaluate(() => window.__loadExercise('valid-parentheses'));
  await expect(page.locator('#exercise-title')).toContainText('Valid Parentheses', { timeout: 5000 });

  await expect(page.locator('#debug-geometry')).toBeHidden();
});
