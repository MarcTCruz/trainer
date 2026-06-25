import { test, expect } from '@playwright/test';
import { pasteCode, CORRECT_SOLUTION } from './helpers.js';

// ---------------------------------------------------------------------------
// Visual regression screenshot tests — key views
//
// Baselines live under tests/visual.spec.js-snapshots/.
// Re-generate with:  npx playwright test tests/visual.spec.js --update-snapshots
// ---------------------------------------------------------------------------

const SCREENSHOT_OPTS = {
  maxDiffPixelRatio: 0.02,
  animations: 'disabled',
};

// ---------------------------------------------------------------------------
// 1. exercise-default — cold load of the exercise page
// ---------------------------------------------------------------------------

test('visual: exercise-default', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__testEditor);
  await expect(page.locator('#exercise-title')).toBeVisible();
  await expect(page.locator('#exercise-title')).not.toHaveText('');
  await expect(page.locator('#run-button')).toBeVisible();
  await expect(page).toHaveScreenshot('exercise-default.png', SCREENSHOT_OPTS);
});

// ---------------------------------------------------------------------------
// 2. exercise-solved — paste correct solution, run, capture results + evolution UI
// ---------------------------------------------------------------------------

test('visual: exercise-solved', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000,
  });
  // Wait for the evolution prompt to settle
  await expect(page.locator('.evolution-prompt')).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveScreenshot('exercise-solved.png', SCREENSHOT_OPTS);
});

// ---------------------------------------------------------------------------
// 3. debugger-active — side-by-side debug layout (toolbar + #debug-panel)
// ---------------------------------------------------------------------------

test('visual: debugger-active', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#debug-button').click();
  await expect(page.locator('#dbg-position')).toContainText(/\d/, { timeout: 15000 });
  await expect(page.locator('#debug-panel')).toBeVisible();
  await expect(page.locator('#debug-toolbar')).toBeVisible();
  await expect(page).toHaveScreenshot('debugger-active.png', {
    ...SCREENSHOT_OPTS,
    // Mask the canvas-based data visualisation which renders differently across runs
    mask: [page.locator('#debug-canvas')],
  });
});

// ---------------------------------------------------------------------------
// 4. sidebar-open — exercise browser sidebar
// ---------------------------------------------------------------------------

test('visual: sidebar-open', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__testEditor);
  await page.locator('#browse-button').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/, { timeout: 5000 });
  // Wait for sidebar content to populate
  await expect(page.locator('#sidebar-content')).toBeVisible();
  await expect(page).toHaveScreenshot('sidebar-open.png', SCREENSHOT_OPTS);
});

// ---------------------------------------------------------------------------
// 5. auth-modal-open — GitHub PAT sign-in modal
// ---------------------------------------------------------------------------

test('visual: auth-modal-open', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await expect(page.locator('#auth-modal')).toHaveClass(/open/, { timeout: 5000 });
  await expect(page.locator('#token-input')).toBeVisible();
  await expect(page).toHaveScreenshot('auth-modal-open.png', SCREENSHOT_OPTS);
});

// ---------------------------------------------------------------------------
// 6. leaderboard-open — leaderboard/trophy panel
// ---------------------------------------------------------------------------

test('visual: leaderboard-open', async ({ page }) => {
  // Mock the GitHub tree API to avoid a live network call producing non-deterministic data
  await page.route(
    'https://api.github.com/repos/MarcTCruz/refactory-validator/git/trees/**',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tree: [{ path: 'results/.gitkeep', type: 'blob' }] }),
      })
  );

  await page.goto('/');
  await page.locator('#leaderboard-button').click();
  await expect(page.locator('#leaderboard-panel')).toHaveClass(/open/, { timeout: 5000 });
  // Wait for the panel content to settle (empty state or rows)
  await expect(
    page.locator('.leaderboard-empty, .leaderboard-row').first()
  ).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveScreenshot('leaderboard-open.png', SCREENSHOT_OPTS);
});

// ---------------------------------------------------------------------------
// 7. mobile-default — responsive layout at iPhone-sized viewport (390×844)
// ---------------------------------------------------------------------------

test('visual: mobile-default', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => window.__testEditor);
  await expect(page.locator('#exercise-title')).toBeVisible();
  await expect(page.locator('#run-button')).toBeVisible();
  await expect(page).toHaveScreenshot('mobile-default.png', SCREENSHOT_OPTS);
});
