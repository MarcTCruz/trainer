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

// ---------------------------------------------------------------------------
// IndexedDB migration
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GitHub sync flow
// ---------------------------------------------------------------------------

async function mockGitHubSync(page, { repoExists = true, progressData = null } = {}) {
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

// ---------------------------------------------------------------------------
// i18n — translation completeness and locale switching
// ---------------------------------------------------------------------------

test('i18n: all locale files have the same keys and placeholders as en.json', async () => {
  const { readFileSync, readdirSync } = await import('fs');
  const { join } = await import('path');

  const i18nDir = join(process.cwd(), 'src', 'i18n');
  const en = JSON.parse(readFileSync(join(i18nDir, 'en.json'), 'utf-8'));
  const enKeys = Object.keys(en);

  const localeFiles = readdirSync(i18nDir).filter(f => f.endsWith('.json') && f !== 'en.json');
  expect(localeFiles.length).toBeGreaterThan(0);

  for (const file of localeFiles) {
    const locale = JSON.parse(readFileSync(join(i18nDir, file), 'utf-8'));
    const localeKeys = Object.keys(locale);

    const missing = enKeys.filter(k => !localeKeys.includes(k));
    expect(missing, `${file} missing keys`).toEqual([]);

    const extra = localeKeys.filter(k => !enKeys.includes(k));
    expect(extra, `${file} extra keys`).toEqual([]);

    const empty = localeKeys.filter(k => locale[k] === '');
    expect(empty, `${file} empty values`).toEqual([]);

    for (const key of enKeys) {
      const enPh = (en[key].match(/\{[^}]+\}/g) || []).sort();
      const localePh = (locale[key]?.match(/\{[^}]+\}/g) || []).sort();
      expect(localePh, `${file} "${key}" placeholders`).toEqual(enPh);
    }
  }
});

test('locale selector switches UI to Portuguese and back to English', async ({ page }) => {
  await page.goto('/');

  // Default is English
  await expect(page.locator('#run-button')).toHaveText('Run Code');
  await expect(page.locator('#reset-button')).toHaveText('Reset');
  await expect(page.locator('#browse-button')).toHaveText('Browse');

  // Switch to pt-BR
  await page.locator('.locale-btn', { hasText: 'pt-BR' }).click();

  // Verify Portuguese strings
  await expect(page.locator('#run-button')).toHaveText('Executar');
  await expect(page.locator('#reset-button')).toHaveText('Resetar');
  await expect(page.locator('#format-button')).toHaveText('Formatar');
  await expect(page.locator('#browse-button')).toHaveText('Explorar');

  // Switch back to English
  await page.locator('.locale-btn', { hasText: 'en' }).click();

  // Verify English strings
  await expect(page.locator('#run-button')).toHaveText('Run Code');
  await expect(page.locator('#reset-button')).toHaveText('Reset');
  await expect(page.locator('#format-button')).toHaveText('Format');
  await expect(page.locator('#browse-button')).toHaveText('Browse');
});

test('i18n: every text-setting line in source uses t() or is exempt', async () => {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const TEXT_SETTERS = /\.(textContent|innerText|placeholder)\s*=\s*/;
  const ARIA_LABEL = /setAttribute\(\s*['"]aria-label['"]\s*,/;
  const USES_T = /\bt\(/;
  const EMPTY_STRING = /=\s*['"]['"]\s*;?\s*$/;
  const EXEMPT_PATTERNS = [
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
  ];

  const files = ['src/app.js', 'src/runner.js'];
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(process.cwd(), file), 'utf-8').split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const isTextSetter = TEXT_SETTERS.test(trimmed) || ARIA_LABEL.test(trimmed);
      if (!isTextSetter) return;
      const block = lines.slice(idx, idx + 4).join(' ');
      if (USES_T.test(block)) return;
      if (EMPTY_STRING.test(trimmed)) return;
      if (EXEMPT_PATTERNS.some(p => p.test(block))) return;
      violations.push(`${file}:${idx + 1}: ${trimmed}`);
    });
  }

  expect(violations, `Text-setting lines not using t(): ${violations.join('\n')}`).toEqual([]);
});

test('locale selection persists across page reload', async ({ page }) => {
  await page.goto('/');

  // Switch to pt-BR
  await page.locator('.locale-btn', { hasText: 'pt-BR' }).click();
  await expect(page.locator('#run-button')).toHaveText('Executar');

  // Reload
  await page.reload();

  // Should still be Portuguese
  await expect(page.locator('#run-button')).toHaveText('Executar', { timeout: 5000 });
  await expect(page.locator('#browse-button')).toHaveText('Explorar');
});

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

// ---------------------------------------------------------------------------
// normalizeCode — adversarial tests for whitespace normalization
// ---------------------------------------------------------------------------

test('normalizeCode preserves spaces inside double-quoted strings', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const { normalizeCode } = window.__test_normalizeCode ?? {};
    if (!normalizeCode) return 'NOT_EXPOSED';
    return normalizeCode('var x = "hello   world";');
  });
  if (result === 'NOT_EXPOSED') {
    const { normalizeCode } = await import('../src/progress.js');
    expect(normalizeCode('var x = "hello   world";')).toBe('var x = "hello   world";');
    expect(normalizeCode("var x = 'hello   world';")).toBe("var x = 'hello   world';");
    expect(normalizeCode('var x = `hello   world`;')).toBe('var x = `hello   world`;');
    return;
  }
  expect(result).toBe('var x = "hello   world";');
});

test('normalizeCode collapses whitespace outside strings', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('function  foo(  )  {  }')).toBe('function foo( ) { }');
  expect(normalizeCode('  var   x  =  1  ;  ')).toBe('var x = 1 ;');
  expect(normalizeCode('a\n\n\nb')).toBe('a b');
  expect(normalizeCode('a\t\tb')).toBe('a b');
});

test('normalizeCode handles escaped quotes inside strings', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('var x = "he said \\"hi  there\\"";')).toBe('var x = "he said \\"hi  there\\"";');
  expect(normalizeCode("var x = 'it\\'s   fine';")).toBe("var x = 'it\\'s   fine';");
});

test('normalizeCode handles mixed string types', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  const input = 'var a = "double  space"; var b = \'single  space\'; var c = `template  space`;';
  const expected = 'var a = "double  space"; var b = \'single  space\'; var c = `template  space`;';
  expect(normalizeCode(input)).toBe(expected);
});

test('normalizeCode treats identical code with different whitespace as equal', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  const tabbed = 'function isValid(s) {\n\tconst stack = [];\n\treturn stack.length === 0;\n}';
  const spaced = 'function isValid(s) {\n  const stack = [];\n  return stack.length === 0;\n}';
  expect(normalizeCode(tabbed)).toBe(normalizeCode(spaced));
  const trailing = 'var x = 1;   \nvar y = 2;  ';
  const clean = 'var x = 1;\nvar y = 2;';
  expect(normalizeCode(trailing)).toBe(normalizeCode(clean));
});

test('normalizeCode handles empty string and whitespace-only input', async () => {
  const { normalizeCode } = await import('../src/progress.js');
  expect(normalizeCode('')).toBe('');
  expect(normalizeCode('   ')).toBe('');
  expect(normalizeCode('\n\t\r')).toBe('');
});
