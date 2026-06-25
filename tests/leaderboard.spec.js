import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// PWA offline mode
// ---------------------------------------------------------------------------

test('offline banner appears when network disconnects', async ({ page, context }) => {
  await page.goto('/');

  // Banner should be hidden when online
  const banner = page.locator('#offline-banner');
  await expect(banner).toBeHidden();

  // Go offline
  await context.setOffline(true);

  // Banner should appear
  await expect(banner).toBeVisible({ timeout: 3000 });

  // Go back online
  await context.setOffline(false);

  // Banner should disappear
  await expect(banner).toBeHidden({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

test('leaderboard panel opens on trophy button click and closes on backdrop', async ({ page }) => {
  await page.goto('/');

  const panel = page.locator('#leaderboard-panel');
  await expect(panel).not.toHaveClass(/open/);

  // Click trophy button
  await page.locator('#leaderboard-button').click();
  await expect(panel).toHaveClass(/open/);

  // Click backdrop to close
  await page.locator('#leaderboard-backdrop').click();
  await expect(panel).not.toHaveClass(/open/);
});

test('leaderboard shows empty state when no verified users', async ({ page }) => {
  // Mock the tree API to return no result files
  await page.route('https://api.github.com/repos/MarcTCruz/refactory-validator/git/trees/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tree: [{ path: 'results/.gitkeep', type: 'blob' }] })
    })
  );

  await page.goto('/');

  // Open leaderboard
  await page.locator('#leaderboard-button').click();

  // Should show empty message
  await expect(page.locator('.leaderboard-empty')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.leaderboard-empty')).toContainText('No verified users');
});

test('leaderboard displays ranked users from CI results', async ({ page }) => {
  // Mock tree API
  await page.route('https://api.github.com/repos/MarcTCruz/refactory-validator/git/trees/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tree: [
          { path: 'results/alice.json', type: 'blob' },
          { path: 'results/bob.json', type: 'blob' },
          { path: 'results/.gitkeep', type: 'blob' }
        ]
      })
    })
  );

  // Mock result files
  await page.route('https://raw.githubusercontent.com/MarcTCruz/refactory-validator/main/results/alice.json', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: 'alice',
        verified_at: '2026-06-20T10:00:00Z',
        exercises: {
          'valid-parentheses': { status: 'pass' },
          'min-stack': { status: 'pass' },
          'two-sum': { status: 'fail' }
        }
      })
    })
  );

  await page.route('https://raw.githubusercontent.com/MarcTCruz/refactory-validator/main/results/bob.json', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: 'bob',
        verified_at: '2026-06-21T08:00:00Z',
        exercises: {
          'valid-parentheses': { status: 'pass' }
        }
      })
    })
  );

  await page.goto('/');

  // Wait for leaderboard data to load (fire-and-forget in boot)
  await page.waitForTimeout(2000);

  // Open leaderboard
  await page.locator('#leaderboard-button').click();

  // Should show ranked users - alice first (2 passed), bob second (1 passed)
  const rows = page.locator('.leaderboard-row');
  await expect(rows).toHaveCount(2, { timeout: 5000 });

  const firstRow = rows.first();
  await expect(firstRow.locator('.leaderboard-rank')).toContainText('#1');
  await expect(firstRow.locator('.leaderboard-user')).toContainText('alice');
  await expect(firstRow.locator('.leaderboard-score')).toContainText('2/3');

  const secondRow = rows.nth(1);
  await expect(secondRow.locator('.leaderboard-rank')).toContainText('#2');
  await expect(secondRow.locator('.leaderboard-user')).toContainText('bob');
});
