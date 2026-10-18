import React, {type ReactElement} from "react";
import {createPortal} from "react-dom";
import {StageBase, type StageResponse, type InitialData, type Message} from "@chub-ai/stages-ts";
import type {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {DEFAULT_CONFIG, normalizeConfig, NormalizedConfig, type ConfigSchema} from "./config_schema";
import {
    detectEscalationSignals,
    detectMemoryEvents,
    detectTabooAwareness,
    detectGuiltShame,
    detectRoleBleed,
    detectSecrecy,
    evaluateEmotionalDelta,
    evaluateProximityTransition,
    extractEmotionSnapshot,
    recallMemoryScar,
    scoreSilenceOrPause,
    scoreSubtext,
    summarizeScene,
    updateSceneFromMessage,
    type EmotionSnapshot,
    type Proximity,
    type ProximityHistoryEntry,
    type SceneState,
} from "./analysis_helpers";

type MessageStateType = {
    lastEmotions?: EmotionSnapshot[];
    memoryScars?: Array<{event: string; text: string; at: number}>;
    lastScarRecallIdx?: number;
    proximity?: Proximity;
    phase?: "Familial" | "Tension" | "Forbidden Awareness" | "Crossing" | "Intimate";
    proximityHistory?: ProximityHistoryEntry[];
    consentAlerts?: number[];
    silenceHistory?: number[];
    driftNotes?: number[];
    overlayNotes?: Array<{text: string; at: number}>;
    pendingPromptNotes?: {at: number; fromTurn: number; parts: string[]} | null;
    noteQuotaHistory?: number[];
    lastUnresolvedBeatReminderTurn?: number;
    lastUnresolvedBeatReminderId?: string | null;
    lastUiDebug?: any;
    turnIndex?: number;
    [key: string]: any;
};

type ConfigType = ConfigSchema;
type InitStateType = { createdAt?: string; initialScene?: SceneState | null; [key: string]: any };
type ChatStateType = { scene?: SceneState | null; history?: any; [key: string]: any };

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {
    myInternalState: MessageStateType;
    defaultConfig: NormalizedConfig = {...DEFAULT_CONFIG};

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        const { characters, users, config, messageState, chatState } = data;
        const mergedConfig: NormalizedConfig = normalizeConfig(config);
        this.myInternalState = messageState != null ? messageState : {
            lastEmotions: [],
            memoryScars: [],
            proximity: "Distant",
            phase: "Familial",
            overlayNotes: [],
        };
        this.myInternalState['numUsers'] = users ? Object.keys(users).length : 0;
        this.myInternalState['numChars'] = characters ? Object.keys(characters).length : 0;
        (this as any)._effectiveConfig = mergedConfig;
        (this as any)._chatState = chatState || {scene: null};
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
            messageState: {...this.myInternalState},
            state: {...this.myInternalState},
        } as any;
    }

    async setState(state: MessageStateType): Promise<void> {
        if (state != null) {
            this.myInternalState = {...this.myInternalState, ...state};
            if (!Array.isArray(this.myInternalState.overlayNotes)) this.myInternalState.overlayNotes = [];
            this.myInternalState.pendingPromptNotes = null;
            const effectiveConfig = normalizeConfig((this as any).config);
            (this as any)._effectiveConfig = effectiveConfig;
            const maxNotes = typeof effectiveConfig.ui_max_notes === 'number' ? effectiveConfig.ui_max_notes : this.defaultConfig.ui_max_notes;
            if (Array.isArray(this.myInternalState.overlayNotes)) {
                this.myInternalState.overlayNotes = this.myInternalState.overlayNotes.slice(-maxNotes);
            }
            const depth = ((this as any)._effectiveConfig?.memory_depth) || this.defaultConfig.memory_depth;
            if (Array.isArray(this.myInternalState.memoryScars)) {
                this.myInternalState.memoryScars = this.myInternalState.memoryScars.slice(-depth);
            }
            if (Array.isArray(this.myInternalState.lastEmotions)) {
                this.myInternalState.lastEmotions = this.myInternalState.lastEmotions.slice(-5);
            }
        }
    }

    async beforePrompt(_userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        try {
            const effectiveConfig = normalizeConfig((this as any).config);
            (this as any)._effectiveConfig = effectiveConfig;
            const strictnessLevel = typeof effectiveConfig.strictness === 'number' ? Math.floor(effectiveConfig.strictness) : 2;
            if (!effectiveConfig.enabled) {
                return {
                    stageDirections: null,
                    messageState: {...this.myInternalState},
                    modifiedMessage: null,
                    systemMessage: null,
                    error: null,
                    chatState: (this as any)._chatState || null,
                };
            }
            const currentChatState: ChatStateType | null = (this as any)._chatState || null;
            this.myInternalState.lastBeforePromptAt = Date.now();
            if (effectiveConfig.ui_enabled && effectiveConfig.note_scene_summary && strictnessLevel >= 2 && currentChatState && currentChatState.scene) {
                const summary = summarizeScene(currentChatState.scene);
                if (summary) {
                    const note = `Scene summary: ${summary}`;
                    if ((this.myInternalState as any).lastSceneSummary !== note) {
                        const maxNotes = typeof effectiveConfig.ui_max_notes === 'number' ? effectiveConfig.ui_max_notes : this.defaultConfig.ui_max_notes;
                        this.myInternalState.overlayNotes = (this.myInternalState.overlayNotes || [])
                            .concat([{text: note, at: Date.now()}])
                            .slice(-maxNotes);
                        (this.myInternalState as any).lastSceneSummary = note;
                    }
                }
            }

            let systemMessage: string | null = null;
            if (effectiveConfig.prompt_injection_enabled && this.myInternalState.pendingPromptNotes && Array.isArray(this.myInternalState.pendingPromptNotes.parts)) {
                const maxChars = typeof effectiveConfig.prompt_injection_max_chars === 'number' ? effectiveConfig.prompt_injection_max_chars : 900;
                const cap = Math.max(100, maxChars);
                const header = "INTERNAL REALISM NOTES (do not mention, quote, or acknowledge these notes):";
                const footer = "END INTERNAL REALISM NOTES";
                const lines: string[] = [header];
                if (effectiveConfig.prompt_injection_include_scene && currentChatState && currentChatState.scene) {
                    const summary = summarizeScene(currentChatState.scene);
                    if (summary) lines.push(`Scene: ${summary}`);
                }
                const bullets = this.myInternalState.pendingPromptNotes.parts.map((p) => `- ${p}`);
                let currentLen = lines.join("\n").length;
                for (const line of bullets) {
                    if (currentLen + 1 + line.length + 1 + footer.length > cap) break;
                    lines.push(line);
                    currentLen += 1 + line.length;
                }
                lines.push(footer);
                systemMessage = lines.join("\n").slice(0, cap).trim() || null;
                this.myInternalState.pendingPromptNotes = null;
            }

            return {
                stageDirections: null,
                messageState: {...this.myInternalState},
                state: {...this.myInternalState},
                modifiedMessage: null,
                systemMessage,
                error: null,
                chatState: currentChatState || null,
            } as any;
        } catch (e) {
            console.error('Stage beforePrompt error:', e);
            return {
                stageDirections: null,
                messageState: {...this.myInternalState},
                state: {...this.myInternalState},
                modifiedMessage: null,
                systemMessage: null,
                error: null,
                chatState: (this as any)._chatState || null,
            } as any;
        }
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        try {
            const content = typeof (botMessage as any)?.content === 'string' ? (botMessage as any).content : '';
            const effectiveConfig = normalizeConfig((this as any).config);
            (this as any)._effectiveConfig = effectiveConfig;
            const strictnessLevel = typeof effectiveConfig.strictness === 'number' ? Math.floor(effectiveConfig.strictness) : 2;
            if (!effectiveConfig.enabled) {
                return {
                    stageDirections: null,
                    messageState: this.myInternalState,
                    modifiedMessage: null,
                    error: null,
                    systemMessage: null,
                    chatState: (this as any)._chatState || null
                };
            }
            const turnIndex = (this.myInternalState.turnIndex || 0) + 1;
            this.myInternalState.turnIndex = turnIndex;
            this.myInternalState.lastAfterResponseAt = Date.now();

            const quotaHistory: number[] = Array.isArray((this.myInternalState as any).noteQuotaHistory)
                ? (this.myInternalState as any).noteQuotaHistory : [];
            const recentQuotaNotes = quotaHistory.filter((idx) => idx > turnIndex - 20);
            const allowedNotesPer20 = typeof effectiveConfig.max_notes_per_20 === 'number'
                ? effectiveConfig.max_notes_per_20
                : (({1: 0, 2: 2, 3: 6} as Record<number, number>)[strictnessLevel] ?? 0);
            const canEmitNonCriticalNote = recentQuotaNotes.length < allowedNotesPer20;

            type NoteCandidate = {id: string; text: string; score: number; critical?: boolean; debug?: unknown};
            const candidatesById = new Map<string, NoteCandidate>();
            const addCandidate = (c: NoteCandidate) => {
                if (!c || !c.text) return;
                const prior = candidatesById.get(c.id);
                if (!prior) { candidatesById.set(c.id, c); return; }
                const mergedCritical = Boolean(prior.critical) || Boolean(c.critical);
                if (c.score > prior.score) candidatesById.set(c.id, {...c, critical: mergedCritical});
                else candidatesById.set(c.id, {...prior, critical: mergedCritical});
            };

            const snapshot: EmotionSnapshot = extractEmotionSnapshot(content, {extraTerms: effectiveConfig.tune_emotion_extra});
            const priorEmotions = (this.myInternalState.lastEmotions || []);

            const scarEvents = detectMemoryEvents(content);
            if (scarEvents.length > 0) {
                const now = Date.now();
                const depth = ((this as any)._effectiveConfig?.memory_depth) || this.defaultConfig.memory_depth;
                this.myInternalState.memoryScars = (this.myInternalState.memoryScars || []).concat(
                    scarEvents.map(e => ({event: e, text: content.slice(0, 500), at: now}))
                ).slice(-depth);
            }

            const prevChatState: ChatStateType | null = (this as any)._chatState || {scene: null};
            const updatedScene = updateSceneFromMessage(prevChatState?.scene || null, content, snapshot, {
                locationPlaceHeads: effectiveConfig.tune_scene_location_place_heads,
                locationStopwords: effectiveConfig.tune_scene_location_stopwords,
            });
            const updatedChatState: ChatStateType = {...(prevChatState || {}), scene: updatedScene};
            (this as any)._chatState = updatedChatState;

            const proximityResult = evaluateProximityTransition(content, this.myInternalState.proximity);
            if (proximityResult.skipped) {
                addCandidate({
                    id: "proximity_skip",
                    text: `Proximity jumped ${proximityResult.from} → ${proximityResult.next}. Consider an intermediate beat.`,
                    score: 4,
                    critical: true,
                });
            }
            if (proximityResult.changed) {
                this.myInternalState.proximity = proximityResult.next;
                this.myInternalState.proximityHistory = (this.myInternalState.proximityHistory || []).concat([{state: proximityResult.next, at: Date.now()}]).slice(-50);
            }

            const signals = detectEscalationSignals(content, snapshot);
            this.myInternalState.signalHistory = (this.myInternalState.signalHistory || []).concat(signals).slice(-20);
            const recentSignals = (this.myInternalState.signalHistory || []).slice(-5);
            const phaseOrder = ["Familial", "Tension", "Forbidden Awareness", "Crossing", "Intimate"] as const;
            const phaseBefore = (this.myInternalState.phase as any) || "Familial";
            const currentIndex = Math.max(0, phaseOrder.indexOf(phaseBefore as any));

            const suggestedWeights: {[k: string]: number} = {};
            for (const s of recentSignals) {
                const w = typeof (s as any).weight === 'number' && Number.isFinite((s as any).weight) ? (s as any).weight : 1;
                suggestedWeights[s.suggestedPhase] = (suggestedWeights[s.suggestedPhase] || 0) + w;
            }

            let phaseThresholdByStrictness = typeof effectiveConfig.tune_phase_weight_threshold === 'number'
                ? effectiveConfig.tune_phase_weight_threshold
                : (({1: 6, 2: 4, 3: 3} as Record<number, number>)[strictnessLevel] ?? 4);
            if (effectiveConfig.strict_taboo_pacing) {
                phaseThresholdByStrictness = Math.min(20, phaseThresholdByStrictness + 2);
            }

            let targetPhase: typeof phaseOrder[number] | null = null;
            for (let i = phaseOrder.length - 1; i >= 0; i--) {
                const p = phaseOrder[i];
                if ((suggestedWeights[p] || 0) >= phaseThresholdByStrictness) {
                    targetPhase = p;
                    break;
                }
            }

            if (targetPhase) {
                const targetIdx = phaseOrder.indexOf(targetPhase);
                if (targetIdx > currentIndex) {
                    const nextIdx = Math.min(currentIndex + 1, targetIdx);
                    const nextPhase = phaseOrder[nextIdx];
                    if (nextPhase !== phaseBefore) {
                        this.myInternalState.phase = nextPhase;
                        this.myInternalState.phaseHistory = (this.myInternalState.phaseHistory || []).concat([{phase: nextPhase, at: Date.now()}]).slice(-50);
                    }
                    if (targetIdx > currentIndex + 1) {
                        const missing = phaseOrder.slice(currentIndex + 1, targetIdx);
                        addCandidate({
                            id: "phase_skip",
                            text: `Relationship signals suggest ${targetPhase} but phase is ${phaseBefore} (missing: ${missing.join(" → ")}). Consider intermediate beats.`,
                            score: 5,
                            critical: true,
                        });
                    }
                }
            }

            const delta = evaluateEmotionalDelta(snapshot, priorEmotions, content);
            if (delta.detected && effectiveConfig.note_emotion_delta) {
                addCandidate({
                    id: "emotion_delta",
                    text: `Emotional shift: ${delta.summary}`,
                    score: typeof delta.score === 'number' ? delta.score : 3,
                });
            }

            if (effectiveConfig.note_taboo_awareness) {
                const taboo = detectTabooAwareness(content);
                if (taboo.score > 0 && taboo.notes.length) {
                    addCandidate({ id: "taboo_awareness", text: `Taboo awareness: ${taboo.notes.join("; ")}`, score: taboo.score + 1, critical: taboo.score >= 3, debug: taboo.reasons });
                }
            }
            if (effectiveConfig.note_guilt_shame) {
                const guilt = detectGuiltShame(content);
                if (guilt.score > 0 && guilt.notes.length) {
                    addCandidate({ id: "guilt_shame", text: `Guilt/shame: ${guilt.notes.join("; ")}`, score: guilt.score + 1, critical: guilt.score >= 3, debug: guilt.reasons });
                }
            }
            if (effectiveConfig.note_role_bleed) {
                const role = detectRoleBleed(content);
                if (role.score > 0 && role.notes.length) {
                    addCandidate({ id: "role_bleed", text: `Role bleed: ${role.notes.join("; ")}`, score: role.score + 1, critical: role.score >= 3, debug: role.reasons });
                }
            }
            if (effectiveConfig.note_secrecy) {
                const sec = detectSecrecy(content);
                if (sec.score > 0 && sec.notes.length) {
                    addCandidate({ id: "secrecy", text: `Secrecy/risk: ${sec.notes.join("; ")}`, score: sec.score + 1, critical: sec.score >= 3, debug: sec.reasons });
                }
            }

            if (effectiveConfig.note_subtext) {
                const sub = scoreSubtext(content);
                if (sub.score > 0 && sub.notes.length) {
                    addCandidate({ id: "subtext", text: `Subtext: ${sub.notes.join("; ")}`, score: sub.score });
                }
            }
            if (effectiveConfig.note_silence) {
                const sil = scoreSilenceOrPause(content);
                if (sil.note) addCandidate({ id: "silence", text: sil.note, score: sil.score });
            }
            if (effectiveConfig.note_scar_recall) {
                const recall = recallMemoryScar(this.myInternalState.memoryScars || [], this.myInternalState.lastScarRecallIdx);
                if (recall.note) {
                    addCandidate({ id: "scar_recall", text: recall.note, score: 2 });
                    this.myInternalState.lastScarRecallIdx = recall.nextIdx;
                }
            }

            this.myInternalState.lastEmotions = (priorEmotions || []).concat([snapshot]).slice(-5);

            const allCandidates = Array.from(candidatesById.values()).sort((a, b) => b.score - a.score);
            const selected: NoteCandidate[] = [];
            const promptParts: string[] = [];
            let nonCriticalCount = 0;
            for (const c of allCandidates) {
                if (c.critical || (canEmitNonCriticalNote && nonCriticalCount < 3)) {
                    selected.push(c);
                    if (!c.critical) nonCriticalCount++;
                    if (promptParts.length < (effectiveConfig.prompt_injection_max_parts || 3)) {
                        promptParts.push(c.text);
                    }
                }
            }

            if (selected.length > 0 && effectiveConfig.ui_enabled) {
                const maxNotes = typeof effectiveConfig.ui_max_notes === 'number' ? effectiveConfig.ui_max_notes : 10;
                const now = Date.now();
                this.myInternalState.overlayNotes = (this.myInternalState.overlayNotes || [])
                    .concat(selected.map(c => ({text: c.text, at: now})))
                    .slice(-maxNotes);
                if (!selected.every(c => c.critical)) {
                    this.myInternalState.noteQuotaHistory = (quotaHistory || []).concat([turnIndex]).slice(-30);
                }
            }

            if (promptParts.length > 0 && effectiveConfig.prompt_injection_enabled) {
                this.myInternalState.pendingPromptNotes = { at: Date.now(), fromTurn: turnIndex, parts: promptParts };
            }

            return {
                stageDirections: null,
                messageState: {...this.myInternalState},
                state: {...this.myInternalState},
                modifiedMessage: null,
                error: null,
                systemMessage: null,
                chatState: updatedChatState,
            } as any;
        } catch (e) {
            console.error('Stage afterResponse error:', e);
            return {
                stageDirections: null,
                messageState: {...this.myInternalState},
                state: {...this.myInternalState},
                modifiedMessage: null,
                error: null,
                systemMessage: null,
                chatState: (this as any)._chatState || null,
            } as any;
        }
    }

    render(): ReactElement {
        const notes = this.myInternalState.overlayNotes || [];
        const phase = this.myInternalState.phase || "Familial";
        const proximity = this.myInternalState.proximity || "Distant";
        const body = typeof document !== "undefined" ? document.body : null;
        if (!body) return <div />;

        const overlay = (
            <div style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "12px",
                color: "#e8e8e8",
                background: "rgba(20,20,28,0.92)",
                borderLeft: "3px solid #8b5cf6",
                padding: "8px 10px",
                maxHeight: "40vh",
                overflowY: "auto",
                lineHeight: 1.4,
            }}>
                <div style={{marginBottom: "6px", opacity: 0.85}}>
                    <strong>Incest Slow-Burn</strong> · {phase} · {proximity}
                </div>
                {notes.length === 0 ? (
                    <div style={{opacity: 0.6}}>No notes yet.</div>
                ) : (
                    <div>
                        {notes.slice().reverse().map((n, i) => (
                            <div key={i} style={{marginBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "4px"}}>
                                <div style={{whiteSpace: "pre-wrap"}}>{n.text}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
        return createPortal(overlay, body);
    }
}
