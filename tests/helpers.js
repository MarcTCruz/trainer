// ---------------------------------------------------------------------------
// Shared test helpers and fixtures for the Trainer test suite.
// This file must NOT contain any test() calls — it is a pure helpers module.
// ---------------------------------------------------------------------------

import { expect } from '@playwright/test';

export async function flushStorage(page) {
  await page.evaluate(() => window.__testStorageFlush?.());
}

// ---------------------------------------------------------------------------
// Helper: paste code into the CodeMirror editor
// ---------------------------------------------------------------------------

export async function pasteCode(page, code) {
  await page.waitForFunction(() => window.__testEditor);
  await page.evaluate((c) => window.__testEditor.setCode(c), code);
}

// ---------------------------------------------------------------------------
// Solution constants
// ---------------------------------------------------------------------------

export const CORRECT_SOLUTION = `function isValid(s) {
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
}`;

export const MIN_STACK_SOLUTION = `function minStack(operations, values) {
  const results = [];
  const stack = [];
  const mins = [];
  for (let i = 0; i < operations.length; i++) {
    switch (operations[i]) {
      case "MinStack":
        results.push(null);
        break;
      case "push":
        stack.push(values[i][0]);
        mins.push(mins.length === 0 ? values[i][0] : Math.min(values[i][0], mins[mins.length - 1]));
        results.push(null);
        break;
      case "pop":
        stack.pop();
        mins.pop();
        results.push(null);
        break;
      case "top":
        results.push(stack[stack.length - 1]);
        break;
      case "getMin":
        results.push(mins[mins.length - 1]);
        break;
    }
  }
  return results;
}`;

export const MIN_MAX_STACK_SOLUTION = `function minMaxStack(operations, values) {
  const results = [];
  const stack = [];
  const aux = [];
  for (let i = 0; i < operations.length; i++) {
    switch (operations[i]) {
      case "MinMaxStack":
        results.push(null);
        break;
      case "push": {
        const v = values[i][0];
        stack.push(v);
        if (aux.length === 0) {
          aux.push({ min: v, max: v });
        } else {
          const prev = aux[aux.length - 1];
          aux.push({ min: Math.min(v, prev.min), max: Math.max(v, prev.max) });
        }
        results.push(null);
        break;
      }
      case "pop":
        stack.pop();
        aux.pop();
        results.push(null);
        break;
      case "top":
        results.push(stack[stack.length - 1]);
        break;
      case "getMin":
        results.push(aux[aux.length - 1].min);
        break;
      case "getMax":
        results.push(aux[aux.length - 1].max);
        break;
    }
  }
  return results;
}`;

export const RPN_SOLUTION = `function evaluateRPN(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (["+", "-", "*", "/"].includes(token)) {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(Math.trunc(a / b)); break;
      }
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}`;

export const RPN_EXTENDED_SOLUTION = `function evaluateRPNExtended(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (token === "neg") {
      stack.push(-stack.pop());
    } else if (["+", "-", "*", "/", "^"].includes(token)) {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(Math.trunc(a / b)); break;
        case "^": stack.push(Math.pow(a, b)); break;
      }
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}`;

export const TWO_SUM_SOLUTION = `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
}`;

export const THREE_SUM_SOLUTION = `function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    let lo = i + 1, hi = nums.length - 1;
    while (lo < hi) {
      const sum = nums[i] + nums[lo] + nums[hi];
      if (sum === 0) {
        result.push([nums[i], nums[lo], nums[hi]]);
        while (lo < hi && nums[lo] === nums[lo + 1]) lo++;
        while (lo < hi && nums[hi] === nums[hi - 1]) hi--;
        lo++;
        hi--;
      } else if (sum < 0) {
        lo++;
      } else {
        hi--;
      }
    }
  }
  return result;
}`;

export const DEPTH_SOLUTION = `function isValidDepth(s, maxDepth) {
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
}`;

export const DAILY_TEMPS_SOLUTION = `function dailyTemperatures(temperatures) {
  const result = new Array(temperatures.length).fill(0);
  const stack = [];
  for (let i = 0; i < temperatures.length; i++) {
    while (stack.length > 0 && temperatures[i] > temperatures[stack[stack.length - 1]]) {
      const prev = stack.pop();
      result[prev] = i - prev;
    }
    stack.push(i);
  }
  return result;
}`;

export const STOCK_SPAN_SOLUTION = `function stockSpan(prices) {
  const spans = new Array(prices.length).fill(0);
  const stack = [];
  for (let i = 0; i < prices.length; i++) {
    while (stack.length > 0 && prices[stack[stack.length - 1]] <= prices[i]) {
      stack.pop();
    }
    spans[i] = stack.length === 0 ? i + 1 : i - stack[stack.length - 1];
    stack.push(i);
  }
  return spans;
}`;

// ---------------------------------------------------------------------------
// Shared helper: solve exercise families
// ---------------------------------------------------------------------------

export async function solveParenthesesFamily(page) {
  // Wait for the exercise to finish loading before pasting — after a page
  // reload the app restores progress and navigates asynchronously, so the
  // editor's bound exercise (and its functionName) may still be the previous
  // one when this helper starts. Without this guard, Run executes against a
  // stale functionName and flakes (e.g. "isValidDepth is not a function").
  await expect(page.locator('#exercise-title')).toContainText('Valid Parentheses', {
    timeout: 10000
  });
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Depth Limit', { timeout: 5000 });
  await pasteCode(page, DEPTH_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await flushStorage(page);
}

export async function solveMinStackFamily(page) {
  // Guard against the post-reload navigation race (see solveParenthesesFamily).
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', {
    timeout: 10000
  });
  await pasteCode(page, MIN_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Min Max Stack', { timeout: 5000 });
  await pasteCode(page, MIN_MAX_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await flushStorage(page);
}

export async function solveRPNFamily(page) {
  // Guard against the post-reload navigation race (see solveParenthesesFamily).
  await expect(page.locator('#exercise-title')).toContainText('Evaluate Reverse Polish Notation', {
    timeout: 10000
  });
  await pasteCode(page, RPN_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Extended RPN', { timeout: 5000 });
  await pasteCode(page, RPN_EXTENDED_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await flushStorage(page);
}

export async function solveDailyTemperaturesFamily(page) {
  // Guard against the post-reload navigation race (see solveParenthesesFamily).
  await expect(page.locator('#exercise-title')).toContainText('Daily Temperatures', {
    timeout: 10000
  });
  await pasteCode(page, DAILY_TEMPS_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Stock Span', { timeout: 5000 });
  await pasteCode(page, STOCK_SPAN_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await flushStorage(page);
}

// ---------------------------------------------------------------------------
// Shared mock helper for GitHub sync tests
// ---------------------------------------------------------------------------

export async function mockGitHubSync(page, { repoExists = true, progressData = null } = {}) {
  // Mock /user for auth
  await page.route('https://api.github.com/user', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ login: 'testuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', name: 'Test User' })
    })
  );

  // Mock repo check
  await page.route('https://api.github.com/repos/testuser/refactory-solutions', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: repoExists ? 200 : 404, contentType: 'application/json', body: JSON.stringify(repoExists ? { name: 'refactory-solutions' } : { message: 'Not Found' }) });
    }
    return route.continue();
  });

  // Mock repo creation
  await page.route('https://api.github.com/user/repos', route =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ name: 'refactory-solutions' }) })
  );

  // Mock contents API (solutions and progress.json) — catch-all for GET and PUT
  await page.route('https://api.github.com/repos/testuser/refactory-solutions/contents/**', route => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      // If progressData is provided and this is progress.json GET, return it
      if (url.includes('progress.json') && progressData) {
        const encoded = btoa(JSON.stringify(progressData));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: encoded, sha: 'abc123' })
        });
      }
      // Otherwise 404 (no existing file)
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
    }

    if (method === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'newsha123' } })
      });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// i18n shared data arrays (used by i18n.spec.js)
// ---------------------------------------------------------------------------

export const SECTION_TITLES = [
  { sel: '#debug-vars .debug-section-title', key: 'debug.variables' },
  { sel: '#debug-callstack .debug-section-title', key: 'debug.callStack' },
  { sel: '#debug-dataviz .debug-section-title', key: 'debug.data' },
  { sel: '#custom-tests-section .debug-section-title', key: 'customTest.title' },
  { sel: '.sidebar-header h2', key: 'nav.exercises' },
  { sel: '.leaderboard-header h2', key: 'leaderboard.title' },
  { sel: '#dbg-picker-label', key: 'debug.testPickerLabel' },
  { sel: '#auto-format-label', key: 'run.autoFormat' },
];

export const ARIA_LABELS = [
  { sel: '#dbg-step-back', key: 'debug.stepBack' },
  { sel: '#dbg-step-into', key: 'debug.stepInto' },
  { sel: '#dbg-step-over', key: 'debug.stepOver' },
  { sel: '#dbg-step-out', key: 'debug.stepOut' },
  { sel: '#dbg-continue', key: 'debug.continue' },
  { sel: '#dbg-continue-back', key: 'debug.continueBack' },
  { sel: '#dbg-reset', key: 'debug.reset' },
  { sel: '#dbg-test-picker', key: 'debug.testPicker' },
  { sel: '#dbg-stop', key: 'debug.stop' },
];

export const I18N_EXEMPT_PATTERNS = [
  /icon\.textContent/,
  /\.textContent\s*=\s*exercise\./,
  /\.textContent\s*=\s*progress\./,
  /\.textContent\s*=\s*cluster\./,
  /\.textContent\s*=\s*user\./,
  /\.textContent\s*=\s*locale/,
  /\.textContent\s*=\s*badgeConfig/,
  /\.textContent\s*=\s*currentExercise\./,
  /div\.textContent\s*=\s*str/,
  /progressSpan\.textContent/,
  /Object\.keys\(/,
  /\.textContent\s*=\s*`\$\{/,
  /variantPrompt/,
  /\.textContent\s*=\s*calibrated\[/,
  /rank\.textContent/,
  /userLink\.textContent/,
  /solvedDisplay\.textContent/,
  /toggle\.textContent/,
  /valEl\.textContent/,
  /el\.textContent\s*=\s*frame/,
  /container\.textContent\s*=\s*'—'/,
  /\.textContent\s*=\s*msg/,
  /\.textContent\s*=\s*preview/,
  /\.textContent\s*=\s*text$/,
  /body\.textContent/,
  /opt\.textContent/,
  /del\.textContent/,
  /violations\.textContent/,
  /\.textContent\s*=\s*org\./,
  /\.textContent\s*=\s*track\./,
];
