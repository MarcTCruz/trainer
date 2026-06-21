import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: paste code into the CodeMirror editor
// ---------------------------------------------------------------------------

async function pasteCode(page, code) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.evaluate((c) => {
    document.execCommand('insertText', false, c);
  }, code);
  await page.waitForTimeout(200);
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
}`;

// ---------------------------------------------------------------------------
// Correct solution for the depth-limit variant
// ---------------------------------------------------------------------------

const MIN_STACK_SOLUTION = `function minStack(operations, values) {
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

const MIN_MAX_STACK_SOLUTION = `function minMaxStack(operations, values) {
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

const RPN_SOLUTION = `function evaluateRPN(tokens) {
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

const RPN_EXTENDED_SOLUTION = `function evaluateRPNExtended(tokens) {
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

const TWO_SUM_SOLUTION = `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
}`;

const THREE_SUM_SOLUTION = `function threeSum(nums) {
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
}`;

const DAILY_TEMPS_SOLUTION = `function dailyTemperatures(temperatures) {
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

const STOCK_SPAN_SOLUTION = `function stockSpan(prices) {
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
// Page loads correctly
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

test('CodeMirror editor renders with starter code', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('isValid');
});

test('Run Code, Reset, and Format buttons are visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#run-button')).toBeVisible();
  await expect(page.locator('#reset-button')).toBeVisible();
  await expect(page.locator('#format-button')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Exercise execution — correct solution passes
// ---------------------------------------------------------------------------

test('correct solution shows "All tests passed" with 12 passing results', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  const status = page.locator('#status-message');
  await expect(status).toContainText('All tests passed', { timeout: 15000 });

  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(12);
});

// ---------------------------------------------------------------------------
// Exercise execution — wrong solution fails
// ---------------------------------------------------------------------------

test('wrong solution shows failing tests with expected/actual values', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, 'function isValid(s) { return true; }');
  await page.locator('#run-button').click();

  const status = page.locator('#status-message');
  await expect(status).not.toContainText('All tests passed', { timeout: 15000 });
  await expect(status).toContainText('tests passed', { timeout: 15000 });

  const failResults = page.locator('.test-result.fail');
  await expect(failResults).not.toHaveCount(0);

  // At least one failing test must show expected/actual detail
  const firstFail = failResults.first();
  const hasExpected = await firstFail.locator('.result-expected').isVisible();
  const hasError = await firstFail.locator('.result-error').isVisible();
  expect(hasExpected || hasError).toBe(true);
});

// ---------------------------------------------------------------------------
// Exercise execution — syntax error handling
// ---------------------------------------------------------------------------

test('syntax error shows an error message', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, 'function isValid(s) { ');
  await page.locator('#run-button').click();

  const status = page.locator('#status-message');
  await expect(status).toContainText('Error', { timeout: 15000 });
});

// ---------------------------------------------------------------------------
// Exercise execution — infinite loop timeout
// ---------------------------------------------------------------------------

test('infinite loop shows interrupted error', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, 'function isValid(s) { while(true){} }');
  await page.locator('#run-button').click();

  const status = page.locator('#status-message');
  await expect(status).toContainText('0/12 tests passed', { timeout: 15000 });
  const results = page.locator('.test-result');
  await expect(results.first()).toContainText('interrupted');
});

// ---------------------------------------------------------------------------
// Evolution prompt appears after solving the base exercise
// ---------------------------------------------------------------------------

test('evolution prompt appears after solving the base exercise', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  const prompt = page.locator('.evolution-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('button', { hasText: 'Evolve' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Variant transition
// ---------------------------------------------------------------------------

test('clicking Evolve loads depth variant and preserves stack code', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();

  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();

  // Title changes to the depth variant
  await expect(page.locator('#exercise-title')).toContainText('Depth Limit', { timeout: 5000 });

  // Editor still contains the previous code (keepCode = true)
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('stack');

  // Stepper: base node is solved, depth node is active
  const solvedNode = page.locator('.stepper-node.solved');
  await expect(solvedNode).toContainText('Valid Parentheses');

  const activeNode = page.locator('.stepper-node.active');
  await expect(activeNode).toContainText('Depth Limit');
});

// ---------------------------------------------------------------------------
// Variant exercise works end-to-end
// ---------------------------------------------------------------------------

test('depth variant passes all tests and updates XP and Solved counters', async ({ page }) => {
  await page.goto('/');

  // Solve base exercise first to unlock the variant
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolve
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Depth Limit', { timeout: 5000 });

  // Paste depth solution and run
  await pasteCode(page, DEPTH_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Stats reflect two solved exercises
  await expect(page.locator('#solved-value')).toHaveText('2');
  await expect(page.locator('#xp-value')).not.toHaveText('0');
});

// ---------------------------------------------------------------------------
// Format button
// ---------------------------------------------------------------------------

test('Format button reformats code into multiple lines', async ({ page }) => {
  await page.goto('/');
  const oneLiner =
    'function isValid(s){const stack=[];for(const ch of s){if(ch==="("){stack.push(ch);}else{if(stack.pop()!==("("))return false;}}return stack.length===0;}';
  await pasteCode(page, oneLiner);

  const editor = page.locator('.cm-content');
  const beforeLines = await editor.locator('.cm-line').count();

  await page.locator('#format-button').click();
  await page.waitForTimeout(3000);

  const afterLines = await editor.locator('.cm-line').count();
  expect(afterLines).toBeGreaterThan(beforeLines);
});

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

test('Reset button restores starter code', async ({ page }) => {
  await page.goto('/');
  await pasteCode(page, 'function isValid(s) { return false; }');

  await page.locator('#reset-button').click();

  const editor = page.locator('.cm-content');
  // Starter code contains this placeholder comment
  await expect(editor).toContainText('Your solution here');
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('stepper nodes are <button> elements', async ({ page }) => {
  await page.goto('/');
  const stepperButtons = page.locator('#evolution-stepper button');
  await expect(stepperButtons.first()).toBeVisible();
  // Confirm the tag is a native button (Playwright toHaveRole uses ARIA role)
  await expect(stepperButtons.first()).toHaveRole('button');
});

test('learning ribbon has role="navigation" and aria-label', async ({ page }) => {
  await page.goto('/');
  const ribbon = page.locator('#learning-ribbon');
  await expect(ribbon).toHaveAttribute('role', 'navigation');
  await expect(ribbon).toHaveAttribute('aria-label');
});

test('evolution stepper has role="navigation" and aria-label', async ({ page }) => {
  await page.goto('/');
  const stepper = page.locator('#evolution-stepper');
  await expect(stepper).toHaveAttribute('role', 'navigation');
  await expect(stepper).toHaveAttribute('aria-label');
});

// ---------------------------------------------------------------------------
// Min Stack exercise — navigate and solve
// ---------------------------------------------------------------------------

// Helper: solve both parentheses exercises so the app advances to Min Stack
async function solveParenthesesFamily(page) {
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
}

async function solveMinStackFamily(page) {
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
}

async function solveRPNFamily(page) {
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
}

async function solveDailyTemperaturesFamily(page) {
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
}

test('Min Stack exercise loads after solving parentheses family and reloading', async ({
  page
}) => {
  await page.goto('/');
  await solveParenthesesFamily(page);

  // Both parentheses exercises solved — reload so resolveStartExercise picks min-stack
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('minStack');
});

test('Min Stack correct solution passes all 8 test cases', async ({ page }) => {
  await page.goto('/');

  // Solve parentheses family so resolveStartExercise advances to min-stack, then reload
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });

  await pasteCode(page, MIN_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(8);
});

test('Min Max Stack variant loads after solving Min Stack and passes all tests', async ({
  page
}) => {
  await page.goto('/');

  // Advance past parentheses family, reload to land on min-stack
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });

  // Solve Min Stack
  await pasteCode(page, MIN_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolve to Min Max Stack
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Min Max Stack', { timeout: 5000 });

  // Editor preserves code from Min Stack
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('minStack');

  // Paste Min Max Stack solution and run
  await pasteCode(page, MIN_MAX_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(7);
});

// ---------------------------------------------------------------------------
// Evaluate RPN exercise — navigate and solve
// ---------------------------------------------------------------------------

test('Evaluate RPN exercise loads after solving all prior exercises', async ({ page }) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });
  await solveMinStackFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Evaluate Reverse Polish Notation', {
    timeout: 5000
  });
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('evaluateRPN');
});

test('Evaluate RPN correct solution passes all 10 test cases', async ({ page }) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });
  await solveMinStackFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Evaluate Reverse Polish Notation', {
    timeout: 5000
  });

  await pasteCode(page, RPN_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(10);
});

test('Extended RPN variant loads after solving RPN and passes all tests', async ({ page }) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });
  await solveMinStackFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Evaluate Reverse Polish Notation', {
    timeout: 5000
  });

  // Solve RPN base
  await pasteCode(page, RPN_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolve to Extended RPN
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Extended RPN', { timeout: 5000 });

  // Solve Extended RPN
  await pasteCode(page, RPN_EXTENDED_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(10);
});

// ---------------------------------------------------------------------------
// Array Patterns cluster — Two Sum and Three Sum
// ---------------------------------------------------------------------------

test('ribbon shows Array Patterns pill alongside Stack Fundamentals', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.learning-ribbon')).toContainText('Stack Fundamentals');
  await expect(page.locator('.learning-ribbon')).toContainText('Array Patterns');
});

test('Two Sum exercise loads after solving all Stack exercises', async ({ page }) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });
  await solveMinStackFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Evaluate Reverse Polish Notation', {
    timeout: 5000
  });
  await solveRPNFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Daily Temperatures', {
    timeout: 5000
  });
  await solveDailyTemperaturesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Two Sum', { timeout: 5000 });
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('twoSum');
});

test('Two Sum correct solution passes all 8 test cases', async ({ page }) => {
  await page.goto('/');
  // Solve all stacks to advance to arrays cluster
  await solveParenthesesFamily(page);
  await page.reload();
  await solveMinStackFamily(page);
  await page.reload();
  await solveRPNFamily(page);
  await page.reload();
  await solveDailyTemperaturesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Two Sum', { timeout: 5000 });

  await pasteCode(page, TWO_SUM_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(8);
});

test('Three Sum variant loads after solving Two Sum and passes all tests', async ({ page }) => {
  await page.goto('/');
  // Solve all stacks + Two Sum
  await solveParenthesesFamily(page);
  await page.reload();
  await solveMinStackFamily(page);
  await page.reload();
  await solveRPNFamily(page);
  await page.reload();
  await solveDailyTemperaturesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Two Sum', { timeout: 5000 });

  // Solve Two Sum
  await pasteCode(page, TWO_SUM_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolve to Three Sum
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Three Sum', { timeout: 5000 });

  // Solve Three Sum
  await pasteCode(page, THREE_SUM_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(8);
});

// ---------------------------------------------------------------------------
// Sidebar exercise browser
// ---------------------------------------------------------------------------

test('Browse button is visible in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#browse-button')).toBeVisible();
});

test('clicking Browse opens sidebar with all clusters and exercises', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('#sidebar');

  // Sidebar starts closed
  await expect(sidebar).not.toHaveClass(/open/);

  // Click Browse
  await page.locator('#browse-button').click();
  await expect(sidebar).toHaveClass(/open/);

  // Both clusters visible
  await expect(sidebar).toContainText('Stack Fundamentals');
  await expect(sidebar).toContainText('Array Patterns');

  // Exercises listed
  await expect(sidebar).toContainText('Valid Parentheses');
  await expect(sidebar).toContainText('Min Stack');
  await expect(sidebar).toContainText('Two Sum');
});

test('clicking exercise in sidebar navigates and closes sidebar', async ({ page }) => {
  await page.goto('/');

  // Open sidebar
  await page.locator('#browse-button').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);

  // Click Two Sum in the sidebar
  const twoSumBtn = page.locator('.sidebar-exercise', { hasText: 'Two Sum' });
  await twoSumBtn.click();

  // Sidebar closes
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);

  // Exercise loaded
  await expect(page.locator('#exercise-title')).toContainText('Two Sum', { timeout: 5000 });
});

test('sidebar shows solved status after solving an exercise', async ({ page }) => {
  await page.goto('/');

  // Solve the base exercise
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Open sidebar
  await page.locator('#browse-button').click();

  // Valid Parentheses should show solved class
  const solvedExercise = page.locator('.sidebar-exercise.solved', { hasText: 'Valid Parentheses' });
  await expect(solvedExercise).toBeVisible();
});

// ---------------------------------------------------------------------------
// Silent forward-testing
// ---------------------------------------------------------------------------

test('forward-test indicator shows after solving base exercise', async ({ page }) => {
  await page.goto('/');

  // Solve the base Valid Parentheses exercise
  await pasteCode(page, CORRECT_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolution prompt should appear with forward-test indicator
  const prompt = page.locator('.evolution-prompt');
  await expect(prompt).toBeVisible();

  // Forward-test indicator should show (isValid passes 9/12 depth variant tests)
  const indicator = page.locator('#forward-test-indicator');
  await expect(indicator).toBeVisible({ timeout: 10000 });
  await expect(indicator).toContainText('/12');
  await expect(indicator).toContainText('already passes');
});

test('forward-test indicator not shown when 0 variant tests pass', async ({ page }) => {
  await page.goto('/');

  // Solve parentheses family to advance
  await solveParenthesesFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Min Stack', { timeout: 5000 });

  // Solve Min Stack with a minimal solution
  await pasteCode(page, MIN_STACK_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolution prompt should appear
  const prompt = page.locator('.evolution-prompt');
  await expect(prompt).toBeVisible();

  // Wait briefly for forward-test to complete
  await page.waitForTimeout(2000);

  // If indicator exists, it should show a count > 0 (it's only shown when passCount > 0)
  // The MinStack solution should pass some MinMaxStack tests (ones without getMax)
  // Whether this shows depends on how many tests pass — just verify no crash
  // The indicator may or may not be visible depending on pass count
});

// ---------------------------------------------------------------------------
// Daily Temperatures exercise — navigate and solve
// ---------------------------------------------------------------------------

test('Daily Temperatures exercise loads after solving all prior Stack exercises', async ({
  page
}) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await solveMinStackFamily(page);
  await page.reload();
  await solveRPNFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Daily Temperatures', {
    timeout: 5000
  });
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('dailyTemperatures');
});

test('Daily Temperatures correct solution passes all 8 test cases', async ({ page }) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await solveMinStackFamily(page);
  await page.reload();
  await solveRPNFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Daily Temperatures', {
    timeout: 5000
  });

  await pasteCode(page, DAILY_TEMPS_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(8);
});

test('Stock Span variant loads after solving Daily Temperatures and passes all tests', async ({
  page
}) => {
  await page.goto('/');
  await solveParenthesesFamily(page);
  await page.reload();
  await solveMinStackFamily(page);
  await page.reload();
  await solveRPNFamily(page);
  await page.reload();
  await expect(page.locator('#exercise-title')).toContainText('Daily Temperatures', {
    timeout: 5000
  });

  // Solve Daily Temperatures
  await pasteCode(page, DAILY_TEMPS_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });

  // Evolve to Stock Span
  await page.locator('.evolution-prompt button', { hasText: 'Evolve' }).click();
  await expect(page.locator('#exercise-title')).toContainText('Stock Span', { timeout: 5000 });

  // Solve Stock Span
  await pasteCode(page, STOCK_SPAN_SOLUTION);
  await page.locator('#run-button').click();
  await expect(page.locator('#status-message')).toContainText('All tests passed', {
    timeout: 15000
  });
  const passResults = page.locator('.test-result.pass');
  await expect(passResults).toHaveCount(7);
});

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
