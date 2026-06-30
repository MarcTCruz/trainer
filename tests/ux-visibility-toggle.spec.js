// tests/ux-visibility-toggle.spec.js
// Tests for live-state visibility toggle (spec: visibility-toggle-live-state)

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedPublicCache(page) {
  await page.addInitScript(() => {
    const open = indexedDB.open('trainer-db', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onsuccess = () => {
      const db = open.result;
      db.transaction('kv', 'readwrite').objectStore('kv').put(true, 'trainer_repo_public');
    };
  });
}

async function mockRepo(page, { isPrivate, patchStatus = 200, getDelayMs = 0 }) {
  await page.route('https://api.github.com/user', r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        name: 'Test User',
      }),
    }),
  );
  await page.route('https://api.github.com/repos/testuser/refactory-solutions', async route => {
    const m = route.request().method();
    if (m === 'GET') {
      if (getDelayMs) await new Promise(res => setTimeout(res, getDelayMs));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'refactory-solutions', private: isPrivate }),
      });
    }
    if (m === 'PATCH')
      return route.fulfill({
        status: patchStatus,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    return route.continue();
  });
  // README/progress PUTs (pushReadme) — accept anything
  await page.route(
    'https://api.github.com/repos/testuser/refactory-solutions/contents/**',
    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'x' } }) }),
  );
}

async function signIn(page) {
  await page.goto('/');
  await page.click('#sign-in-button');
  await page.fill('#token-input', 'test-token-123');
  await page.click('#auth-connect-button');
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('live state beats stale cache: cache=public, live=private → shows Make Public, no badge', async ({
  page,
}) => {
  // Cache says public, live repo says private — live must win.
  await seedPublicCache(page);
  await mockRepo(page, { isPrivate: true });
  await signIn(page);

  // Allow the async fetch to resolve
  await expect(page.locator('#visibility-toggle-button')).toHaveText('Make Public', {
    timeout: 5000,
  });
  await expect(page.locator('#repo-visibility-badge')).not.toBeAttached();
});

test('reflects live public: no cache, live=public → badge "Public" + "Make Private" button', async ({
  page,
}) => {
  // No cache seed — live repo says public.
  await mockRepo(page, { isPrivate: false });
  await signIn(page);

  await expect(page.locator('#repo-visibility-badge')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#repo-visibility-badge')).toHaveText('Public');
  await expect(page.locator('#visibility-toggle-button')).toHaveText('Make Private');
});

test('loading indicator visible while fetching', async ({ page }) => {
  // Delay the GET by 1500ms — loading indicator must appear immediately.
  await mockRepo(page, { isPrivate: true, getDelayMs: 1500 });
  await signIn(page);

  await expect(page.locator('#visibility-loading')).toBeVisible({ timeout: 1000 });
});

test('success toast shown + badge appears after toggling to public', async ({ page }) => {
  await mockRepo(page, { isPrivate: true, patchStatus: 200 });
  await signIn(page);

  // Wait for live state to load (shows "Make Public")
  await expect(page.locator('#visibility-toggle-button')).toHaveText('Make Public', {
    timeout: 5000,
  });

  await page.click('#visibility-toggle-button');

  // Toast with published text must appear
  await expect(page.locator('.pwa-toast', { hasText: 'now public' })).toBeVisible({ timeout: 5000 });

  // Badge must appear (renderAuthState re-renders with public=true in cache)
  await expect(page.locator('#repo-visibility-badge')).toBeVisible({ timeout: 5000 });
});

test('failure toast shown + button re-enabled when PATCH fails', async ({ page }) => {
  await mockRepo(page, { isPrivate: true, patchStatus: 500 });
  await signIn(page);

  // Wait for live state to load
  await expect(page.locator('#visibility-toggle-button')).toHaveText('Make Public', {
    timeout: 5000,
  });

  await page.click('#visibility-toggle-button');

  // Error toast must appear
  await expect(page.locator('.pwa-toast', { hasText: "Couldn't change" })).toBeVisible({ timeout: 5000 });

  // Button must be re-enabled
  await expect(page.locator('#visibility-toggle-button')).toBeEnabled({ timeout: 3000 });
});
