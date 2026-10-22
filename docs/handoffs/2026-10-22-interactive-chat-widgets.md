# Task handoff — interactive widgets in chat answers

- Date / owner: Oct 22, 2026 / Noah (Claude Code session)
- Status: implemented, awaiting validation with live models
- Branch: `claude/interactive-chat-widgets`
- What changed: answers can contain interactive widgets the AI describes as JSON in a fenced `orbit-widget` block: **calculator** (sliders, live result tiles, breakdown, total, optional LaTeX formula), **chart** (line, area, bar, donut; hover tooltips, legend, "Show table"), **diagram** (step flow with arrow labels and tap-for-details). Rendered by `components/chat-widgets.tsx`; validated and bounded in `lib/widgets/schema.ts`; formulas run in `lib/widgets/expr.ts`, a small arithmetic parser (no eval, no property access). Invalid widgets show as plain code; while streaming a placeholder shows.
- Colours: `--viz-1..8` in `app/globals.css`, the dataviz skill's validated categorical palette (light + dark steps; dark set validated against #212121).
- Prompt: `config/quality.ts` adds widget instructions to `RESPONSE_QUALITY_PROMPT` (all providers and Orbit), version `student-v2`. Adds roughly 350 input tokens to every chat call (small per-answer cost increase, still settled through reserve → call → reconcile).
- Checks: lint, typecheck, webpack build, 608/608 tests (incl. evaluator safety and widget validation). Browser check with synthetic data at 1280×900 dark and 375×812 light: sliders recalculate, tooltips, donut, table toggle, diagram stacking.
- Not verified: how often and how well each live model emits valid widgets (needs a small paid sample, with Jake/Noah's authorization); exports/copy include the raw JSON block.
- Next: try a few real prompts per provider on staging; tune the prompt wording if a model over- or under-uses widgets.
