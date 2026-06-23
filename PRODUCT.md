# Product

## Register

product

## Users

Developers learning or sharpening coding skills. They arrive wanting focused practice, not lectures. They write code in the browser, run it instantly against test cases, and progress through concept clusters at their own pace. Solo learners — no classroom, no pair programming, no instructor.

## Product Purpose

Interactive code training platform. Exercises run in a WASM sandbox (QuickJS), with a time-travel debugger, clean code linter with XP rewards, CI verification via GitHub, and i18n (EN/PT-BR). Serverless — GitHub as the persistence backend. Success looks like: a learner opens it, picks an exercise, writes code, gets immediate feedback, and feels momentum building.

## Brand Personality

Playful, encouraging, approachable. The product should feel like a well-designed game that happens to teach real engineering. Rewards (XP, streaks, evolution prompts) are genuine motivators, not corporate gamification. The tone is a friend who's good at coding nudging you forward, not a judge scoring your interview.

## Anti-references

- **LeetCode / HackerRank** — corporate competitive grind, ad-heavy, interview-prep factory, anxiety-inducing timers and rankings
- **Codecademy / freeCodeCamp** — hand-holding tutorial style, oversimplified, walls of prose before you touch code
- **Generic SaaS dashboard** — cream backgrounds, rounded cards everywhere, startup template aesthetic, feels like a settings page not a creative tool

## Design Principles

1. **Code-first** — the editor is the center of gravity. Everything else supports the act of writing and running code.
2. **Momentum over mastery** — celebrate progress, not perfection. Every small win (a passing test, a lint rule cleared) should feel good.
3. **Show, don't lecture** — hints are progressive, descriptions are terse, the code speaks. No tutorial walls.
4. **Honest difficulty** — don't hide complexity. Label it, scaffold it, but never pretend hard things are easy.
5. **Portable** — works offline, works on mobile (aspirational), no account required to start.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. Dark theme is default but must meet contrast ratios. Keyboard navigation for all interactive elements. Reduced motion support. Screen reader labels on all controls (aria-labels already in place). i18n for EN and PT-BR with enforcement tests.
