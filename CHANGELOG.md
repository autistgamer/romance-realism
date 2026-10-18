# Changelog

This project follows SemVer once it leaves `0.x`.

## Unreleased (incest-slow-burn branch)

### Incest / Taboo specialization
- Renamed and retargeted as **Incest Slow-Burn Realism**.
- New 5-stage relationship phase ladder: Familial → Tension → Forbidden Awareness → Crossing → Intimate/Taboo.
- New config toggles: `note_taboo_awareness`, `note_guilt_shame`, `note_role_bleed`, `note_secrecy`.
- New controls: `strict_taboo_pacing` (slower phase advancement), `power_imbalance_sensitivity` (1–3).
- Extended memory-scar types planned: near_confession, role_reminder, guilt_spike, near_discovery, boundary_test, family_intrusion.
- Updated `public/chub_meta.yaml` (name, tagline, tags) and README for the new focus.
- Config schema and normalization fully extended; Stage/analysis_helpers wiring is the next implementation step.

### Original Romance Realism (upstream)
- Weighted, negation-aware emotion snapshot + delta scoring.
- One-shot system-prompt injection (configurable; never written into chat transcript).
- Unified note quota control via `max_notes_per_20` (legacy `max_ui_notes_per_20` supported).
- Added Stage lifecycle functional tests and prompt quota regression coverage.
- Added GitHub Actions CI (Node LTS + 21.7.1).
