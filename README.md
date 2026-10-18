# Incest Slow-Burn Realism

Invisible, background guardrails for **taboo-aware slow-burn family roleplay**.  
Forked and specialized from [MaeveOfFae/romance-realism](https://github.com/MaeveOfFae/romance-realism).Generated code with Grok.

Runs beside the chat, shows concise notes in the stage UI, and can optionally inject one-shot guidance into the next system prompt (never into the transcript).

## What it does

- Keeps tone, pacing, proximity, and scene carryover coherent (location, time-of-day, lingering mood, unresolved beats).
- Detects abrupt emotional shifts and suggests transitional cues.
- Tracks a **taboo-aware relationship phase ladder** and proximity; warns when escalation skips setup.
- Logs emotional "scars" (conflicts, confessions, rejections, **guilt spikes, near-discoveries, role reminders, boundary tests**) and can recall them later.
- Surfaces consent/agency issues (with extra sensitivity to power imbalance), subtext, hesitation/silence, drift, **taboo awareness, guilt/shame, role-bleed, and secrecy**.

## Adapted Phase Ladder

1. **Familial** – normal family dynamic, affectionate but clearly non-romantic.  
2. **Tension** – charged undercurrent, lingering looks, accidental proximity, internal conflict begins.  
3. **Forbidden Awareness** – recognition of attraction; guilt, denial, rationalization, secrecy language.  
4. **Crossing** – first deliberate boundary violations, prolonged touch, role-blurring language.  
5. **Intimate / Taboo** – full romantic/sexual intimacy while the family frame remains or is being renegotiated.

Advance at most one phase per message. Large jumps produce warnings listing the missing intermediate steps.

## Guarantees

- Never rewrites or blocks user text; notes live only in the stage UI.
- Prompt injection (when enabled) is one-shot, system-prompt-only, and off the transcript.
- Heuristics are lightweight regex-based and unit-testable; configs are null-safe via `normalizeConfig`.
- Does **not** moralize the user. Notes are continuity/realism tools only.

## Quick start

Prereqs: Node 21.7.1, Yarn.

```bash
yarn install
# Dev mode (TestRunner + Playground)
yarn dev
# Lint / type-check
yarn lint
yarn tsc --noEmit
# Tests
yarn test
# Production build
yarn build
```

## Lifecycle at a glance

- `load()` sets up defaults and returns success + initial state.
- `beforePrompt()` may emit a compact scene summary to the UI and inject pending notes (one-shot system message) when enabled.
- `afterResponse()` runs all detectors, updates message/chat state, emits UI notes, and queues the next prompt injection.
- `setState()` restores persisted message-level state on branch navigation and re-applies caps.

## Configuration (normalize everything)

- Core: `enabled`, `strictness` (1-3), `memory_depth` (5-30).
- UI: `ui_enabled`, `ui_max_notes`, `ui_show_status`, `ui_show_timestamps`, `max_notes_per_20`, `tune_ui_note_parts`.
- Prompt injection: `prompt_injection_enabled`, `prompt_injection_include_scene`, `prompt_injection_max_parts`, `prompt_injection_max_chars`.
- Per-detector toggles: original set + `note_taboo_awareness`, `note_guilt_shame`, `note_role_bleed`, `note_secrecy`.
- Taboo-specific: `strict_taboo_pacing` (slower phase advancement), `power_imbalance_sensitivity` (1-3).
- Story beats, tuning overrides, lexicon tuning, and debug flags remain available.

## Signals and detectors

- Emotion snapshot and delta (whiplash detection, negation-aware keywords) — extended with guilt, shame, denial, rationalization, secrecy, role_conflict tones.
- Escalation signals, phase tracking (new 5-stage ladder), and proximity gating.
- Consent/agency checks with power-imbalance amplification.
- Subtext, hesitation/silence, relationship drift.
- Memory scars (original + near_confession, role_reminder, guilt_spike, near_discovery, boundary_test, family_intrusion).
- Taboo awareness, role-bleed, secrecy detectors.
- Scene capture and summarization (location/time/mood/beats).

## Project layout

- `src/Stage.tsx` — lifecycle and orchestration.
- `src/analysis_helpers.ts` — unit-testable heuristics.
- `src/config_schema.ts` — null-safe config and `normalizeConfig` helper.
- `public/chub_meta.yaml` — stage metadata.
- `docs/DETECTORS.md` — how to add detectors.
- `tests/*.test.ts` — unit tests.

## Design principles (incest-specific)

- Taboo is load-bearing. Escalation that ignores guilt, secrecy, or role conflict feels cheap; the stage surfaces it.
- Power imbalance is never invisible. Consent/agency checks are stricter by default when authority language appears.
- Slow is the point. Extra intermediate phases and higher thresholds exist so the burn stays slow.
- Never moralize the user. Notes are continuity tools only.
- Agency stays sacred. Never speak for the user.

## Credits

Original Romance Realism Pack by [MaeveOfFae](https://github.com/MaeveOfFae/romance-realism).  
This branch specializes it for taboo-aware slow-burn family dynamics while preserving the original architecture and guarantees.
