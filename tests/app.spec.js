import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// App load and storage tests
// ---------------------------------------------------------------------------

test('title "The Refactory" is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('The Refactory');
});

test('Learning Path Ribbon shows "Stack Fundamentals" pill', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.learning-ribbon')).toContainText('Stack Fundamentals');
});

test('Evolution Tree stepper shows "Valid Parentheses" as active', async ({ page }) => {
  await page.goto('/');
  const activeNode = page.locator('.stepper-node.active');
  await expect(activeNode).toContainText('Valid Parentheses');
});

test('app works with completely empty storage', async ({ page }) => {
  // Clear everything before loading
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('trainer-db');
  });
  await page.reload();

  // App should load normally with default state
  await expect(page.locator('#exercise-title')).toContainText('Valid Parentheses', {
    timeout: 5000
  });
  await expect(page.locator('#solved-value')).toHaveText('0');
  await expect(page.locator('#xp-value')).toHaveText('0');
});

test('localStorage data migrates to IndexedDB on first load', async ({ page }) => {
  await page.goto('/');

  // Simulate legacy localStorage data (as if the app had been used before migration)
  await page.evaluate(() => {
    indexedDB.deleteDatabase('trainer-db');
    localStorage.setItem(
      'trainer_v1',
      JSON.stringify({
        completedExercises: {
          'valid-parentheses': { code: 'function isValid() {}', solvedAt: '2026-06-20' }
        },
        xp: 100,
        streak: 1,
        lastActiveDate: '2026-06-20'
      })
    );
  });

  // Reload to trigger migration
  await page.reload();

  // App should show the migrated progress
  await expect(page.locator('#solved-value')).toHaveText('1', { timeout: 5000 });
  await expect(page.locator('#xp-value')).toHaveText('100');

  // localStorage should be cleared after migration
  const lsValue = await page.evaluate(() => localStorage.getItem('trainer_v1'));
  expect(lsValue).toBeNull();
});
