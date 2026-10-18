# Changelog

This project follows SemVer once it leaves `0.x`.

## Unreleased (incest-slow-burn branch)

### Incest / Taboo specialization — COMPLETE

- Renamed and retargeted as **Incest Slow-Burn Realism**.
- New 5-stage relationship phase ladder: Familial → Tension → Forbidden Awareness → Crossing → Intimate.
- New config toggles: `note_taboo_awareness`, `note_guilt_shame`, `note_role_bleed`, `note_secrecy`.
- New controls: `strict_taboo_pacing` (raises phase thresholds), `power_imbalance_sensitivity` (1–3).
- Extended memory-scar types: guilt_spike, near_discovery, role_reminder, near_confession, boundary_test, family_intrusion.
- New detectors: `detectTabooAwareness`, `detectGuiltShame`, `detectRoleBleed`, `detectSecrecy`.
- Emotion tones extended with guilt, shame, denial.
- `Stage.tsx` fully wired: phase ladder, detector candidates, prompt injection, UI overlay, lifecycle.
- Updated `public/chub_meta.yaml`, README, and config schema.

### Original Romance Realism (upstream)
- Weighted, negation-aware emotion snapshot + delta scoring.
- One-shot system-prompt injection (configurable; never written into chat transcript).
- Unified note quota control via `max_notes_per_20`.
- Stage lifecycle functional tests and prompt quota regression coverage.
