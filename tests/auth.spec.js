import { test, expect } from '@playwright/test';
import { pasteCode, CORRECT_SOLUTION, mockGitHubSync } from './helpers.js';

// ---------------------------------------------------------------------------
// GitHub Auth — PAT paste flow
// ---------------------------------------------------------------------------

test('Sign in button is visible in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sign-in-button')).toBeVisible();
});

test('clicking Sign in opens auth modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sign-in-button').click();

  const modal = page.locator('#auth-modal');
  await expect(modal).toHaveClass(/open/);

  // Modal contains expected elements
  await expect(modal).toContainText('Sign in with GitHub');
  await expect(modal).toContainText('Personal Access Token');
  await expect(page.locator('#token-input')).toBeVisible();
  await expect(page.locator('#auth-connect-button')).toBeVisible();
});

test('auth modal has correct GitHub token creation link', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sign-in-button').click();

  const link = page.locator('#auth-github-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    'href',
    'https://github.com/settings/tokens/new?scopes=repo&description=The+Refactory+Trainer'
  );
  await expect(link).toHaveAttribute('target', '_blank');
});

test('empty token shows error message', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await page.locator('#auth-connect-button').click();

  await expect(page.locator('#auth-error')).toContainText('Please paste your token');
});

test('invalid token shows error via mocked GitHub API', async ({ page }) => {
  // Mock GitHub API to return 401
  await page.route('https://api.github.com/user', (route) =>
    route.fulfill({ status: 401, body: 'Bad credentials' })
  );

  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_invalidtoken123');
  await page.locator('#auth-connect-button').click();

  await expect(page.locator('#auth-error')).toContainText('Invalid token', {
    timeout: 5000
  });
});

test('valid token signs in and shows username via mocked GitHub API', async ({ page }) => {
  // Mock GitHub API to return a user
  await page.route('https://api.github.com/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        name: 'Test User'
      })
    })
  );

  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();

  // Modal should close
  await expect(page.locator('#auth-modal')).not.toHaveClass(/open/, {
    timeout: 5000
  });

  // Username visible in header
  await expect(page.locator('#auth-username')).toContainText('testuser');

  // Sign out button visible
  await expect(page.locator('#sign-out-button')).toBeVisible();
});

test('sign out clears auth state', async ({ page }) => {
  // Mock GitHub API
  await page.route('https://api.github.com/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        name: 'Test User'
      })
    })
  );

  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();

  await expect(page.locator('#auth-username')).toContainText('testuser', {
    timeout: 5000
  });

  // Click sign out
  await page.locator('#sign-out-button').click();

  // Sign in button should be back
  await expect(page.locator('#sign-in-button')).toBeVisible();
});

test('Escape closes auth modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sign-in-button').click();
  await expect(page.locator('#auth-modal')).toHaveClass(/open/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#auth-modal')).not.toHaveClass(/open/);
});

// ---------------------------------------------------------------------------
// GitHub sync flow
// ---------------------------------------------------------------------------

test('solving exercise while authenticated triggers push to GitHub', async ({ page }) => {
  await mockGitHubSync(page);

  // Set up request watchers BEFORE navigating so no race with early requests
  const solutionPutPromise = page.waitForRequest(
    req => req.url().includes('/contents/solutions/') && req.method() === 'PUT',
    { timeout: 15000 }
  );
  const progressPutPromise = page.waitForRequest(
    req => req.url().includes('/contents/progress.json') && req.method() === 'PUT',
    { timeout: 15000 }
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Solve the exercise
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Verify both PUT requests were made
  await solutionPutPromise;
  await progressPutPromise;
});

test('login with existing remote progress merges and updates display', async ({ page }) => {
  const progressData = {
    completedExercises: { 'min-stack': { code: 'remote code', solvedAt: '2026-06-15T00:00:00.000Z' } },
    xp: 200,
    streak: 3,
    lastActiveDate: '2026-06-15'
  };

  await mockGitHubSync(page, { progressData });

  // Watch for the merged progress.json push that confirms syncOnLogin completed
  const progressPutPromise = page.waitForRequest(
    req => req.url().includes('/contents/progress.json') && req.method() === 'PUT',
    { timeout: 15000 }
  );

  await page.goto('/');

  // Sign in — syncOnLogin fires in the background after modal closes
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Wait for sync to push the merged state back
  await progressPutPromise;

  // After sync, the remote exercise and XP should be reflected in the display
  await expect(page.locator('#solved-value')).toHaveText('1', { timeout: 5000 });
  await expect(page.locator('#xp-value')).toHaveText('200');
});

test('sync errors do not break the app', async ({ page }) => {
  // Mock /user for auth (success)
  await page.route('https://api.github.com/user', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ login: 'testuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', name: 'Test User' })
    })
  );

  // All sync endpoints return 500
  await page.route('https://api.github.com/repos/testuser/**', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
  );
  await page.route('https://api.github.com/user/repos', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Solve the exercise — sync will fail silently
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  // App still reports success
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Progress still updated locally
  await expect(page.locator('#solved-value')).not.toHaveText('0', { timeout: 5000 });
});

test('repo creation attempted on first push when repo does not exist', async ({ page }) => {
  await mockGitHubSync(page, { repoExists: false });

  // Watch for repo creation POST BEFORE navigating
  const repoCreatePromise = page.waitForRequest(
    req => req.url() === 'https://api.github.com/user/repos' && req.method() === 'POST',
    { timeout: 15000 }
  );
  const solutionPutPromise = page.waitForRequest(
    req => req.url().includes('/contents/solutions/') && req.method() === 'PUT',
    { timeout: 15000 }
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Solve the exercise
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Verify repo creation was attempted then solution was pushed
  await repoCreatePromise;
  await solutionPutPromise;
});

// ---------------------------------------------------------------------------
// CI sync flow
// ---------------------------------------------------------------------------

test('CI consent prompt appears after first local solve', async ({ page }) => {
  await mockGitHubSync(page);

  // Mock fork check
  await page.route('https://api.github.com/repos/testuser/refactory-validator', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'refactory-validator' }) })
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // No consent prompt yet
  await expect(page.locator('#ci-consent-prompt')).not.toBeAttached();

  // Solve the exercise to trigger the consent prompt
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Consent prompt should appear
  await expect(page.locator('#ci-consent-prompt')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.ci-consent-card h3')).toContainText('official');
  await expect(page.locator('.ci-consent-card p')).toContainText('public fork');

  // Decline — prompt disappears, no consent stored
  await page.locator('.ci-consent-actions .btn-secondary').click();
  await expect(page.locator('#ci-consent-prompt')).not.toBeAttached();
});

test('accepting CI consent pushes solution to fork', async ({ page }) => {
  await mockGitHubSync(page);

  // Mock fork check
  await page.route('https://api.github.com/repos/testuser/refactory-validator', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'refactory-validator' }) })
  );

  // Mock fork contents API (solutions push)
  await page.route('https://api.github.com/repos/testuser/refactory-validator/contents/**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
    }
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'fork-sha' } }) });
    }
    return route.continue();
  });

  // Mock CI results (no results yet)
  await page.route('https://raw.githubusercontent.com/MarcTCruz/refactory-validator/main/results/**', route =>
    route.fulfill({ status: 404 })
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Set up watcher for fork push BEFORE solving
  const forkPushPromise = page.waitForRequest(
    req => req.url().includes('/repos/testuser/refactory-validator/contents/solutions/') && req.method() === 'PUT',
    { timeout: 15000 }
  );

  // Solve the exercise — consent prompt appears
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Accept the consent prompt to trigger CI push
  await expect(page.locator('#ci-consent-prompt')).toBeVisible({ timeout: 5000 });
  await page.locator('.ci-consent-actions .btn-primary').click();

  // Verify fork push was made
  const forkPush = await forkPushPromise;
  expect(forkPush.url()).toContain('valid-parentheses.js');
});

test('CI results display verification badges', async ({ page }) => {
  await mockGitHubSync(page);

  // Mock fork check
  await page.route('https://api.github.com/repos/testuser/refactory-validator', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'refactory-validator' }) })
  );

  const ciResults = {
    user: 'testuser',
    verified_at: '2026-06-21T08:45:00Z',
    exercises: {
      'valid-parentheses': { status: 'pass', verified_at: '2026-06-21T08:45:00Z' }
    }
  };

  await page.goto('/');

  // Sign in — this stores token + user in IndexedDB
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Seed CI consent into IndexedDB so boot treats CI as enabled
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('trainer-db', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(true, 'trainer_ci_consent');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Write CI results directly into IndexedDB so boot finds them immediately on reload
  await page.evaluate(results => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('trainer-db', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(results, 'trainer_ci_results');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, ciResults);

  // Reload — boot() reads CI results from IndexedDB before loadExercise renders the badge
  await page.reload();

  // Auth state should restore from persisted token
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Badge should be visible because CI results were pre-seeded before boot
  await expect(page.locator('.ci-badge-verified')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.ci-badge-verified')).toContainText('Verified');
});

test('CI sync errors do not break solving', async ({ page }) => {
  await mockGitHubSync(page);

  // Mock fork check — 500 error
  await page.route('https://api.github.com/repos/testuser/refactory-validator', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
  );

  // Mock fork creation — 500 error
  await page.route('https://api.github.com/repos/MarcTCruz/refactory-validator/forks', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
  );

  // Mock CI results — 500 error
  await page.route('https://raw.githubusercontent.com/MarcTCruz/refactory-validator/main/results/**', route =>
    route.fulfill({ status: 500 })
  );

  await page.goto('/');

  // Sign in
  await page.locator('#sign-in-button').click();
  await page.locator('#token-input').fill('ghp_validtoken123');
  await page.locator('#auth-connect-button').click();
  await expect(page.locator('#auth-username')).toContainText('testuser', { timeout: 5000 });

  // Seed CI consent so pushToCI is attempted (will fail silently due to mocked 500s)
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('trainer-db', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(true, 'trainer_ci_consent');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Solve the exercise — CI sync will fail silently but solve still works
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  // App still reports success
  await expect(page.locator('#status-message')).toContainText('All tests passed', { timeout: 15000 });

  // Progress still updated locally
  await expect(page.locator('#solved-value')).not.toHaveText('0', { timeout: 5000 });
});
