/**
 * Config schema and normalization utilities for the Incest Slow-Burn Realism Pack.
 * Ensures null-safety, default fallbacks, and range clamping for numeric fields.
 * Specialized from the original Romance Realism Pack for taboo-aware family dynamics.
 */

export type ConfigSchema = {
    // Core
    enabled?: boolean;
    strictness?: number; // 1..3
    memory_depth?: number; // 5..30

    // UI
    ui_enabled?: boolean | number;
    ui_max_notes?: number; // 1..50
    ui_show_status?: boolean | number;
    ui_show_timestamps?: boolean | number;
    max_notes_per_20?: number; // -1 disables override, otherwise 0..20
    max_ui_notes_per_20?: number; // deprecated alias of `max_notes_per_20`

    // UI debug
    ui_debug_scoring?: boolean | number;
    ui_debug_max_candidates?: number; // 1..50

    // Prompt injection (system prompt only; never written into chat log).
    prompt_injection_enabled?: boolean | number;
    prompt_injection_include_scene?: boolean | number;
    prompt_injection_max_parts?: number; // 1..6
    prompt_injection_max_chars?: number; // 100..4000

    // Unresolved beat capture + reminders
    scene_unresolved_beats_enabled?: boolean | number;
    note_unresolved_beats?: boolean | number;
    unresolved_beats_max_history?: number; // 0..20
    unresolved_beats_snippet_max_chars?: number; // 40..240
    tune_unresolved_beat_score_threshold?: number;
    tune_unresolved_beat_cooldown_turns?: number;

    // Note toggles (original)
    note_scene_summary?: boolean | number;
    note_emotion_delta?: boolean | number;
    note_phase?: boolean | number;
    note_proximity?: boolean | number;
    note_consent?: boolean | number;
    note_subtext?: boolean | number;
    note_silence?: boolean | number;
    note_drift?: boolean | number;
    note_scar_recall?: boolean | number;

    // Note toggles (incest / taboo extensions)
    note_taboo_awareness?: boolean | number;
    note_guilt_shame?: boolean | number;
    note_role_bleed?: boolean | number;
    note_secrecy?: boolean | number;

    // Taboo-specific controls
    strict_taboo_pacing?: boolean | number;
    power_imbalance_sensitivity?: number; // 1..3

    // Tuning overrides
    tune_phase_weight_threshold?: number;
    tune_delta_score_threshold?: number;
    tune_ui_note_parts?: number;

    // Lexicon tuning
    tune_emotion_extra?: Record<string, string[]>;
    tune_scene_location_place_heads?: string[];
    tune_scene_location_stopwords?: string[];

    [key: string]: unknown;
};

export type NormalizedConfig = {
    enabled: boolean;
    strictness: number;
    memory_depth: number;

    ui_enabled: boolean;
    ui_max_notes: number;
    ui_show_status: boolean;
    ui_show_timestamps: boolean;
    max_notes_per_20: number | null;
    ui_debug_scoring: boolean;
    ui_debug_max_candidates: number;

    prompt_injection_enabled: boolean;
    prompt_injection_include_scene: boolean;
    prompt_injection_max_parts: number;
    prompt_injection_max_chars: number;

    scene_unresolved_beats_enabled: boolean;
    note_unresolved_beats: boolean;
    unresolved_beats_max_history: number;
    unresolved_beats_snippet_max_chars: number;
    tune_unresolved_beat_score_threshold: number | null;
    tune_unresolved_beat_cooldown_turns: number | null;

    note_scene_summary: boolean;
    note_emotion_delta: boolean;
    note_phase: boolean;
    note_proximity: boolean;
    note_consent: boolean;
    note_subtext: boolean;
    note_silence: boolean;
    note_drift: boolean;
    note_scar_recall: boolean;

    note_taboo_awareness: boolean;
    note_guilt_shame: boolean;
    note_role_bleed: boolean;
    note_secrecy: boolean;

    strict_taboo_pacing: boolean;
    power_imbalance_sensitivity: number;

    tune_phase_weight_threshold: number | null;
    tune_delta_score_threshold: number | null;
    tune_ui_note_parts: number | null;

    tune_emotion_extra: Record<string, string[]>;
    tune_scene_location_place_heads: string[];
    tune_scene_location_stopwords: string[];
    [key: string]: unknown;
};

export const DEFAULT_CONFIG: NormalizedConfig = {
    enabled: true,
    strictness: 2,
    memory_depth: 15,
    ui_enabled: true,
    ui_max_notes: 10,
    ui_show_status: true,
    ui_show_timestamps: true,
    max_notes_per_20: null,
    ui_debug_scoring: false,
    ui_debug_max_candidates: 12,

    prompt_injection_enabled: true,
    prompt_injection_include_scene: true,
    prompt_injection_max_parts: 3,
    prompt_injection_max_chars: 900,

    scene_unresolved_beats_enabled: true,
    note_unresolved_beats: true,
    unresolved_beats_max_history: 10,
    unresolved_beats_snippet_max_chars: 160,
    tune_unresolved_beat_score_threshold: null,
    tune_unresolved_beat_cooldown_turns: null,

    note_scene_summary: true,
    note_emotion_delta: true,
    note_phase: true,
    note_proximity: true,
    note_consent: true,
    note_subtext: true,
    note_silence: true,
    note_drift: true,
    note_scar_recall: true,

    note_taboo_awareness: true,
    note_guilt_shame: true,
    note_role_bleed: true,
    note_secrecy: true,

    strict_taboo_pacing: true,
    power_imbalance_sensitivity: 2,

    tune_phase_weight_threshold: null,
    tune_delta_score_threshold: null,
    tune_ui_note_parts: null,

    tune_emotion_extra: {},
    tune_scene_location_place_heads: [],
    tune_scene_location_stopwords: [],
} as const;

function clamp(n: number, min: number, max: number): number {
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function asBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
    return fallback;
}

function normalizeStringArray(v: unknown, opts?: {maxItems?: number; maxLen?: number; lower?: boolean}): string[] {
    const maxItems = opts?.maxItems ?? 200;
    const maxLen = opts?.maxLen ?? 48;
    const lower = opts?.lower ?? true;
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of v) {
        if (typeof raw !== 'string') continue;
        let s = raw.trim();
        if (!s) continue;
        if (s.length > maxLen) s = s.slice(0, maxLen);
        const key = (lower ? s.toLowerCase() : s);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key);
        if (out.length >= maxItems) break;
    }
    return out;
}

function normalizeStringRecordOfArrays(v: unknown, opts?: {maxKeys?: number; maxItemsPerKey?: number; maxLen?: number}): Record<string, string[]> {
    const maxKeys = opts?.maxKeys ?? 20;
    const maxItemsPerKey = opts?.maxItemsPerKey ?? 80;
    const maxLen = opts?.maxLen ?? 48;
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, string[]> = {};
    const keys = Object.keys(v as any).slice(0, maxKeys);
    for (const k of keys) {
        const arr = normalizeStringArray((v as any)[k], {maxItems: maxItemsPerKey, maxLen, lower: true});
        if (arr.length > 0) out[String(k)] = arr;
    }
    return out;
}

export function normalizeConfig(cfg?: ConfigSchema | null): NormalizedConfig {
    const src = cfg || {};
    const enabled = typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_CONFIG.enabled;
    const strictness = (typeof src.strictness === 'number')
        ? clamp(Math.floor(src.strictness), 1, 3)
        : DEFAULT_CONFIG.strictness;
    const memory_depth = (typeof src.memory_depth === 'number')
        ? clamp(Math.floor(src.memory_depth), 5, 30)
        : DEFAULT_CONFIG.memory_depth;

    const ui_enabled = asBool(src.ui_enabled, DEFAULT_CONFIG.ui_enabled);
    const ui_max_notes = (typeof src.ui_max_notes === 'number')
        ? clamp(Math.floor(src.ui_max_notes), 1, 50)
        : DEFAULT_CONFIG.ui_max_notes;
    const ui_show_status = asBool(src.ui_show_status, DEFAULT_CONFIG.ui_show_status);
    const ui_show_timestamps = asBool(src.ui_show_timestamps, DEFAULT_CONFIG.ui_show_timestamps);
    const maxOverrideRaw = (typeof src.max_notes_per_20 === 'number' && Number.isFinite(src.max_notes_per_20))
        ? Math.floor(src.max_notes_per_20)
        : ((typeof src.max_ui_notes_per_20 === 'number' && Number.isFinite(src.max_ui_notes_per_20))
            ? Math.floor(src.max_ui_notes_per_20)
            : null);
    const max_notes_per_20 = maxOverrideRaw == null
        ? DEFAULT_CONFIG.max_notes_per_20
        : (maxOverrideRaw < 0 ? null : clamp(maxOverrideRaw, 0, 20));
    const ui_debug_scoring = asBool(src.ui_debug_scoring, DEFAULT_CONFIG.ui_debug_scoring);
    const ui_debug_max_candidates = (typeof src.ui_debug_max_candidates === 'number')
        ? clamp(Math.floor(src.ui_debug_max_candidates), 1, 50)
        : DEFAULT_CONFIG.ui_debug_max_candidates;

    const prompt_injection_enabled = asBool(src.prompt_injection_enabled, DEFAULT_CONFIG.prompt_injection_enabled);
    const prompt_injection_include_scene = asBool(src.prompt_injection_include_scene, DEFAULT_CONFIG.prompt_injection_include_scene);
    const prompt_injection_max_parts = (typeof src.prompt_injection_max_parts === 'number')
        ? clamp(Math.floor(src.prompt_injection_max_parts), 1, 6)
        : DEFAULT_CONFIG.prompt_injection_max_parts;
    const prompt_injection_max_chars = (typeof src.prompt_injection_max_chars === 'number')
        ? clamp(Math.floor(src.prompt_injection_max_chars), 100, 4000)
        : DEFAULT_CONFIG.prompt_injection_max_chars;

    const scene_unresolved_beats_enabled = asBool(src.scene_unresolved_beats_enabled, DEFAULT_CONFIG.scene_unresolved_beats_enabled);
    const note_unresolved_beats = asBool(src.note_unresolved_beats, DEFAULT_CONFIG.note_unresolved_beats);
    const unresolved_beats_max_history = (typeof src.unresolved_beats_max_history === 'number' && Number.isFinite(src.unresolved_beats_max_history))
        ? clamp(Math.floor(src.unresolved_beats_max_history), 0, 20)
        : DEFAULT_CONFIG.unresolved_beats_max_history;
    const unresolved_beats_snippet_max_chars = (typeof src.unresolved_beats_snippet_max_chars === 'number' && Number.isFinite(src.unresolved_beats_snippet_max_chars))
        ? clamp(Math.floor(src.unresolved_beats_snippet_max_chars), 40, 240)
        : DEFAULT_CONFIG.unresolved_beats_snippet_max_chars;
    const tune_unresolved_beat_score_threshold = (typeof src.tune_unresolved_beat_score_threshold === 'number' && Number.isFinite(src.tune_unresolved_beat_score_threshold))
        ? clamp(Math.floor(src.tune_unresolved_beat_score_threshold), 1, 20)
        : DEFAULT_CONFIG.tune_unresolved_beat_score_threshold;
    const tune_unresolved_beat_cooldown_turns = (typeof src.tune_unresolved_beat_cooldown_turns === 'number' && Number.isFinite(src.tune_unresolved_beat_cooldown_turns))
        ? clamp(Math.floor(src.tune_unresolved_beat_cooldown_turns), 0, 50)
        : DEFAULT_CONFIG.tune_unresolved_beat_cooldown_turns;

    const note_scene_summary = asBool(src.note_scene_summary, DEFAULT_CONFIG.note_scene_summary);
    const note_emotion_delta = asBool(src.note_emotion_delta, DEFAULT_CONFIG.note_emotion_delta);
    const note_phase = asBool(src.note_phase, DEFAULT_CONFIG.note_phase);
    const note_proximity = asBool(src.note_proximity, DEFAULT_CONFIG.note_proximity);
    const note_consent = asBool(src.note_consent, DEFAULT_CONFIG.note_consent);
    const note_subtext = asBool(src.note_subtext, DEFAULT_CONFIG.note_subtext);
    const note_silence = asBool(src.note_silence, DEFAULT_CONFIG.note_silence);
    const note_drift = asBool(src.note_drift, DEFAULT_CONFIG.note_drift);
    const note_scar_recall = asBool(src.note_scar_recall, DEFAULT_CONFIG.note_scar_recall);

    const note_taboo_awareness = asBool(src.note_taboo_awareness, DEFAULT_CONFIG.note_taboo_awareness);
    const note_guilt_shame = asBool(src.note_guilt_shame, DEFAULT_CONFIG.note_guilt_shame);
    const note_role_bleed = asBool(src.note_role_bleed, DEFAULT_CONFIG.note_role_bleed);
    const note_secrecy = asBool(src.note_secrecy, DEFAULT_CONFIG.note_secrecy);

    const strict_taboo_pacing = asBool(src.strict_taboo_pacing, DEFAULT_CONFIG.strict_taboo_pacing);
    const power_imbalance_sensitivity = (typeof src.power_imbalance_sensitivity === 'number')
        ? clamp(Math.floor(src.power_imbalance_sensitivity), 1, 3)
        : DEFAULT_CONFIG.power_imbalance_sensitivity;

    const tune_phase_weight_threshold = (typeof src.tune_phase_weight_threshold === 'number' && Number.isFinite(src.tune_phase_weight_threshold))
        ? clamp(Math.floor(src.tune_phase_weight_threshold), 1, 20)
        : DEFAULT_CONFIG.tune_phase_weight_threshold;
    const tune_delta_score_threshold = (typeof src.tune_delta_score_threshold === 'number' && Number.isFinite(src.tune_delta_score_threshold))
        ? clamp(Math.floor(src.tune_delta_score_threshold), 0, 20)
        : DEFAULT_CONFIG.tune_delta_score_threshold;
    const tune_ui_note_parts = (typeof src.tune_ui_note_parts === 'number' && Number.isFinite(src.tune_ui_note_parts))
        ? clamp(Math.floor(src.tune_ui_note_parts), 1, 6)
        : DEFAULT_CONFIG.tune_ui_note_parts;

    const tune_emotion_extra = normalizeStringRecordOfArrays((src as any).tune_emotion_extra) || DEFAULT_CONFIG.tune_emotion_extra;
    const tune_scene_location_place_heads = normalizeStringArray((src as any).tune_scene_location_place_heads) || DEFAULT_CONFIG.tune_scene_location_place_heads;
    const tune_scene_location_stopwords = normalizeStringArray((src as any).tune_scene_location_stopwords) || DEFAULT_CONFIG.tune_scene_location_stopwords;

    return {
        enabled,
        strictness,
        memory_depth,
        ui_enabled,
        ui_max_notes,
        ui_show_status,
        ui_show_timestamps,
        max_notes_per_20,
        ui_debug_scoring,
        ui_debug_max_candidates,

        prompt_injection_enabled,
        prompt_injection_include_scene,
        prompt_injection_max_parts,
        prompt_injection_max_chars,

        scene_unresolved_beats_enabled,
        note_unresolved_beats,
        unresolved_beats_max_history,
        unresolved_beats_snippet_max_chars,
        tune_unresolved_beat_score_threshold,
        tune_unresolved_beat_cooldown_turns,

        note_scene_summary,
        note_emotion_delta,
        note_phase,
        note_proximity,
        note_consent,
        note_subtext,
        note_silence,
        note_drift,
        note_scar_recall,

        note_taboo_awareness,
        note_guilt_shame,
        note_role_bleed,
        note_secrecy,

        strict_taboo_pacing,
        power_imbalance_sensitivity,

        tune_phase_weight_threshold,
        tune_delta_score_threshold,
        tune_ui_note_parts,

        tune_emotion_extra,
        tune_scene_location_place_heads,
        tune_scene_location_stopwords,
    };
}

export function validateConfig(cfg?: ConfigSchema | null): string[] {
    const errors: string[] = [];
    if (cfg == null) return errors;
    if (cfg.enabled != null && typeof cfg.enabled !== 'boolean') errors.push('`enabled` must be a boolean.');
    if (cfg.strictness != null && (typeof cfg.strictness !== 'number' || !Number.isFinite(cfg.strictness))) errors.push('`strictness` must be a number.');
    if (cfg.memory_depth != null && (typeof cfg.memory_depth !== 'number' || !Number.isFinite(cfg.memory_depth))) errors.push('`memory_depth` must be a number.');
    if (cfg.power_imbalance_sensitivity != null && (typeof cfg.power_imbalance_sensitivity !== 'number' || !Number.isFinite(cfg.power_imbalance_sensitivity))) {
        errors.push('`power_imbalance_sensitivity` must be a number (1-3).');
    }
    return errors;
}
