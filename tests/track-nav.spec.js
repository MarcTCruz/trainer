import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Track navigation — data-driven selector + Euclid reachability
// ---------------------------------------------------------------------------

test('learning-path selector renders one control per registry track', async ({ page }) => {
  await page.goto('/');

  // Wait for the ribbon controls to be rendered
  await page.waitForSelector('.ribbon-controls');

  // There must be exactly 2 [data-track-id] controls — one per track in registry
  const trackControls = page.locator('[data-track-id]');
  await expect(trackControls).toHaveCount(2);
});

test('euclid-elements track is reachable via its selector control', async ({ page }) => {
  await page.goto('/');

  await page.waitForSelector('.ribbon-controls');

  // Click the control for euclid-elements
  const euclidControl = page.locator('[data-track-id="euclid-elements"]');
  await euclidControl.click();

  // The first day's exercise title must appear
  await expect(page.locator('#exercise-title')).toContainText(
    "Euclid's Proposition 1: Equilateral Triangle",
    { timeout: 5000 }
  );
});
