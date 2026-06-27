# UX Pattern Standard — The Refactory

The committed, enforceable UX standard for this app. Every UI change must satisfy
these patterns. Each pattern carries a **mechanical enforcement** (a Playwright e2e
assertion, a lint/grep rule, or — only when neither is feasible — a PR-checklist item)
so the pattern is enforced by CI, not by memory.

Source: derived with the project design brain (Gemini), grounded in Nielsen Norman Group
heuristics. Refined 2026-06-27.

## The patterns

| # | Pattern | Rule | Mechanical enforcement (fails CI on violation) |
|---|---------|------|------------------------------------------------|
| 1 | **Spatial Stability** | Primary-action coordinates stay fixed across state changes. | Playwright: `#main-toolbar` boundingBox `x/y` identical before and after `#debug-mode` activates. |
| 2 | **State-Reflecting Controls** | Controls reflect the live remote source of truth, never a local cached assumption. | Playwright: mock GitHub visibility = false; assert the toggle reads false regardless of injected localStorage cache. |
| 3 | **Data-Driven Navigation** | Menus/selectors iterate the config registry so every valid path is reachable. | Playwright: read `src/exercises/registry.json` at runtime; assert rendered track-selector item count === number of registry tracks. |
| 4 | **Progressive Disclosure** | Show the most relevant context by default; keep the rest behind a secondary interaction. | Playwright: full track list hidden on load; visible only after the selector trigger is clicked. |
| 5 | **Explicit Destructive Boundaries** | Irreversible actions declare their exact footprint (local vs remote) and require hard confirmation. | Playwright: trigger delete → hard-confirm input visible; after mock delete, `localStorage` token remains intact. |
| 6 | **Honest Labeling** | Button/link text announces its exact payload or documentation intent. | CI grep: fail build if `>(Your Data\|Click Here\|More Info)<` appears inside a `button`/`a` in `src/**`. |
| 7 | **Feedback Immediacy** | Every state mutation yields an instant visual response (loading/disabled/toast). | Playwright: delay the network route 2s; assert `[data-status="loading"]` visible before the route fulfils. |
| 8 | **Zero Action Shift** | Contextual tools deploy into dedicated zones/overlays without displacing the global toolbar. | Playwright: `#debug-panel` top > `#main-toolbar` bottom (no overlap/push). |

## Current known violations (to fix — see tracker)

1. **Learning-path nav** (pattern 3): `renderTrackRibbon` (src/app.js) hardcodes the
   `thirty-days` track. The `euclid-elements` track and its Proposition 1 exercise are
   **unreachable** — zero presence in the rendered DOM. No track selector exists.
2. **"Your Data" button** (pattern 6): label implies it shows the user's data; it opens
   an info panel about where data is stored. Relabel to announce documentation intent
   (e.g. "Storage Policy" / demote to a secondary info link).
3. **"Clear All My Data"** (pattern 5): currently deletes the CI fork AND wipes browser
   storage (token, progress, prefs) and signs out. Required scope: clear ONLY the user's
   public GitHub footprint, never touch the browser, and name exactly what it removes.
   Relabel (e.g. "Delete Public GitHub Fork") + hard-confirm modal stating the boundary.
4. **"Make Public" toggle** (patterns 2 + 7): reads a local cached flag, not live repo
   visibility — shows "Make Public" for an already-public repo, stays enabled, click is a
   silent no-op. Read live visibility; reflect state; give loading + success/failure feedback.

## Redesign notes (per defect)

- **Nav:** dynamic `TrackSelector` (segmented control / dropdown) iterating registry
  tracks; default to the most recent track (progressive disclosure), all paths reachable.
- **Make Public:** fetch live GitHub repo visibility; disable + show a "Public" badge when
  already public; inline loading during the request; toast on success/failure.
- **Clear:** rename to the bounded action; hard-confirm modal (type the repo name); copy:
  "This deletes your remote GitHub repository. Your local progress, browser storage, and
  active session will not be affected."
- **Your Data:** rename to announce intent; demote from primary button to a secondary
  utility link with an info icon.
