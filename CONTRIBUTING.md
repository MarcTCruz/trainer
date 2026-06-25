# Contributing Exercises

This guide covers everything needed to add a new exercise to Trainer.

## Exercise JSON Schema

Each exercise lives in `src/exercises/<id>.json`. All fields below are required unless marked optional.

```json
{
  "id": "exercise-id",
  "variantOf": null,
  "variantOrder": 1,
  "variantPrompt": null,
  "title": "Exercise Title",
  "difficulty": "Easy|Medium|Hard",
  "description": "Markdown description with backticks for `code` and **bold** for emphasis.",
  "functionName": "camelCaseFunctionName",
  "params": ["param1", "param2"],
  "starterCode": "function camelCaseFunctionName(param1, param2) {\n  // Your solution here\n  \n}",
  "testCases": [
    { "input": ["value1", "value2"], "expected": true }
  ],
  "hints": ["hint 1", "hint 2"]
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Kebab-case unique identifier. Must match the filename (e.g. `two-sum.json` → `"id": "two-sum"`). |
| `title` | string | Human-readable title shown in the exercise browser. |
| `difficulty` | string | One of `Easy`, `Medium`, or `Hard`. |
| `description` | string | Problem statement in Markdown. Use backticks for inline `code`, triple backticks for blocks. |
| `functionName` | string | camelCase name of the function the user implements. Must appear in `starterCode`. |
| `params` | string[] | Parameter names in order. Must be non-empty. |
| `starterCode` | string | The function shell shown to the user. Must declare `functionName`. |
| `testCases` | object[] | Test suite. See [Test cases](#test-cases) below. Must be non-empty. |
| `hints` | string[] | Progressive hints displayed on demand. |
| `language` | string (optional) | Execution language. Default: `"javascript"`. Allowed: `"javascript"`, `"apex"`. |
| `engine` | string (optional) | Evaluation engine. Default: `"standard-io"`. Allowed: `"standard-io"`, `"geometry"`. |

### Variant fields (optional)

Variants let you build on a base exercise — the user solves the base first, then an evolved version.

| Field | Type | Description |
|---|---|---|
| `variantOf` | string \| null | ID of the base exercise this extends. `null` for standalone exercises. |
| `variantOrder` | number | 1-based position in the variant chain. Always `1` for standalone exercises. |
| `variantPrompt` | string \| null | Short prompt shown when the user advances to this variant (e.g. `"Now solve it without a stack."`). `null` for standalone. |

## Test cases

Each test case has:

- `input` — array of argument values, one entry per parameter in `params` order.
- `expected` — the exact return value the function must produce.

```json
{ "input": ["()[]{}"], "expected": true }
```

Values can be any JSON type: strings, numbers, booleans, arrays, objects, or `null`.

For functions with multiple parameters, pass one value per parameter:

```json
{ "input": [["MinStack", "push", "getMin"], [[], [5], []]], "expected": [null, null, 5] }
```

Aim for at least 5 test cases covering:

- A typical happy path
- The empty / zero / null input
- A boundary value (length 1, single element)
- A tricky or counterintuitive case
- At least one negative / false result (if applicable)

## Reference solution

Every exercise must include a `referenceSolution` field — a complete, correct JavaScript function that passes all test cases. Place it in the JSON immediately after `starterCode`.

The value must be a top-level `function` declaration using the exact `functionName`:

```json
"referenceSolution": "function twoSum(nums, target) {\n  const map = new Map();\n  // ...\n  return [i, j];\n}"
```

Verify it passes every test case before opening a PR:

```bash
node scripts/check-solvability.js src/exercises/<your-id>.json
```

The reference solution is **automatically stripped from the production build** — the Vite plugin removes it at build time so the answer never ships to users. You can confirm with:

```bash
npx vite build && grep -rl referenceSolution dist 2>/dev/null && echo "LEAK" || echo "STRIPPED-OK"
```

## Naming conventions

- **File name:** `<id>.json` — kebab-case, all lowercase, numbers allowed, no underscores.
- **`id`:** must exactly match the filename without extension.
- **`functionName`:** camelCase (e.g. `isValid`, `minStack`, `twoSum`).
- **`params`:** camelCase, short but descriptive (e.g. `s`, `nums`, `operations`).

Valid `id` examples: `two-sum`, `valid-parentheses`, `min-stack`, `lru-cache2`.

## How to Contribute an Exercise

1. **Fork the repo** and create a feature branch.

2. **Copy the template** to `src/exercises/<your-id>.json`:
   ```bash
   cp src/exercises/_template.json src/exercises/<your-id>.json
   ```
   Fill in all required fields.

   The exercise auto-registers: every `*.json` in `src/exercises/` is loaded automatically at build time (via `import.meta.glob`). No code change is needed to wire it in.

3. **Optionally add it to a cluster or track** in `src/exercises/registry.json`. Place it in the relevant cluster's `exercises` array, or add it as a new cluster if no existing one fits.

4. **Run the validator** to catch schema errors:
   ```bash
   node scripts/validate-exercise.js src/exercises/<your-id>.json
   ```

5. **Run the test suite** to confirm nothing is broken:
   ```bash
   npx playwright test
   ```

6. **Open a PR** with a brief description of the exercise and the algorithm concept it teaches.

## Exercise Quality Guidelines

**Problem statement**
- State the input, output, and constraints clearly. Include a short worked example in the description itself.
- Markdown is supported: use backticks for `inline code` and triple backticks for blocks.

**Test cases**
- 5–8 cases is the sweet spot. Cover: a typical case, empty/zero/null input, a boundary value (length 1), and at least one negative or false result.
- Avoid redundant cases that test the same code path.

**Hints**
- 2–4 hints ordered from conceptual to near-implementation.
- Good hints narrow the search space without naming the algorithm outright.
- Example ladder: "What data structure gives O(1) lookup?" → "A hash map stores each value's index." → "Check the complement before inserting."

**Difficulty**
- `Easy` — one data structure or pattern applied directly.
- `Medium` — two concepts combined, or a non-obvious optimization.
- `Hard` — novel insight, multi-step algorithm, or advanced data structure.

**Variants**
- A variant extends a base exercise by adding a new constraint or dimension.
- Set `variantOf` to the base `id`, increment `variantOrder`, and write a `variantPrompt` that frames the new challenge relative to the solution the student just wrote.
- Submit a base + its variants together in one PR.

## PR requirements

- One exercise per PR (or a base + its direct variants).
- `node scripts/validate-exercise.js` exits 0.
- At least 5 test cases (see [Test cases](#test-cases) for coverage guidelines).
- No changes to `scripts/validate-exercise.js` or `src/exercises/_template.json` unless the PR is specifically updating the schema.

CI will automatically run `validate-exercise.js` on every changed exercise file in the PR. A failing validation blocks merge.
