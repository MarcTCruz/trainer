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

## Naming conventions

- **File name:** `<id>.json` — kebab-case, all lowercase, numbers allowed, no underscores.
- **`id`:** must exactly match the filename without extension.
- **`functionName`:** camelCase (e.g. `isValid`, `minStack`, `twoSum`).
- **`params`:** camelCase, short but descriptive (e.g. `s`, `nums`, `operations`).

Valid `id` examples: `two-sum`, `valid-parentheses`, `min-stack`, `lru-cache2`.

## How to test locally

1. Copy `src/exercises/_template.json` to `src/exercises/<your-id>.json`.
2. Fill in all fields.
3. Run the validator:

```bash
node scripts/validate-exercise.js src/exercises/<your-id>.json
```

4. Add your exercise to `src/exercises/registry.json` (the ordered list the app reads). Place it in the appropriate difficulty section.
5. Run the app and verify the exercise renders and test cases execute correctly:

```bash
pnpm dev
```

## PR requirements

- One exercise per PR (or a base + its direct variants).
- `node scripts/validate-exercise.js` exits 0 with no errors.
- Exercise appears in `registry.json` in the correct difficulty section.
- At least 5 test cases (see [Test cases](#test-cases) for coverage guidelines).
- No changes to `scripts/validate-exercise.js` or `src/exercises/_template.json` unless the PR is specifically updating the schema.

CI will automatically run `validate-exercise.js` on every changed exercise file in the PR. A failing validation blocks merge.
