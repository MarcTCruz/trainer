import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: sign in with a mocked GitHub user + fork route
// ---------------------------------------------------------------------------

async function signIn(page) {
  await page.route('https://api.github.com/user', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        name: 'Test User',
      }),
    })
  );

  await page.route('https://api.github.com/repos/testuser/refactory-validator', route => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'refactory-validator' }),
    });
  });

  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_testtoken');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Test 1: Hard-confirm gate
// ---------------------------------------------------------------------------

test('hard-confirm gate: input required + disabled button until exact match', async ({ page }) => {
  await signIn(page);

  await page.locator('#clear-data-button').click();

  // Input and disabled delete button must be visible
  await expect(page.locator('#clear-confirm-input')).toBeVisible();
  await expect(page.locator('#clear-confirm-action')).toBeDisabled();

  // Wrong value keeps it disabled
  await page.locator('#clear-confirm-input').fill('wrong/repo');
  await expect(page.locator('#clear-confirm-action')).toBeDisabled();

  // Exact match enables it
  await page.locator('#clear-confirm-input').fill('testuser/refactory-validator');
  await expect(page.locator('#clear-confirm-action')).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Test 2: Deletes only the fork; storage (token/session) survives reload
// ---------------------------------------------------------------------------

test('deletes only the fork and storage survives reload', async ({ page }) => {
  await signIn(page);

  await page.locator('#clear-data-button').click();
  await page.locator('#clear-confirm-input').fill('testuser/refactory-validator');
  await expect(page.locator('#clear-confirm-action')).toBeEnabled();

  const del = page.waitForRequest(
    r =>
      r.url() === 'https://api.github.com/repos/testuser/refactory-validator' &&
      r.method() === 'DELETE'
  );

  await page.locator('#clear-confirm-action').click();
  await del;

  // Success message names the fork
  const doneMsg = page.locator('#clear-done-message');
  await expect(doneMsg).toBeVisible({ timeout: 5000 });
  await expect(doneMsg).toContainText('refactory-validator');

  // Reload — token survived (user still signed in, no sign-in button)
  await page.reload();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });
  await expect(page.locator('#sign-in-button')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3: Honest label — no "Clear All My Data" copy
// ---------------------------------------------------------------------------

test('honest label: button says Delete Public GitHub Fork, not Clear All My Data', async ({
  page,
}) => {
  await signIn(page);

  const btn = page.locator('#clear-data-button');
  await expect(btn).toContainText('Delete Public GitHub Fork');
  await expect(btn).not.toContainText('Clear All My Data');
});
