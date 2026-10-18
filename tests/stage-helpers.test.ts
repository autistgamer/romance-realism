import test from "node:test";
import assert from "node:assert/strict";
import {
    detectConsentIssues,
    detectEscalationSignals,
    detectMemoryEvents,
    evaluateEmotionalDelta,
    evaluateProximityTransition,
    extractEmotionSnapshot,
    scoreSilenceOrPause,
    updateSceneFromMessage,
} from "../src/analysis_helpers";

test("extractEmotionSnapshot: empty -> neutral/low", () => {
    const snapshot = extractEmotionSnapshot("");
    assert.deepEqual(snapshot, {tone: "neutral", intensity: "low"});
});

test("extractEmotionSnapshot: sad keyword -> sad/medium", () => {
    const snapshot = extractEmotionSnapshot("I regret this.");
    assert.deepEqual(snapshot, {tone: "sad", intensity: "medium"});
});

test("extractEmotionSnapshot: negation avoids angry classification", () => {
    const snapshot = extractEmotionSnapshot("I'm not angry.");
    assert.notEqual(snapshot.tone, "angry");
});

test("extractEmotionSnapshot: 'tear' verb does not imply sadness", () => {
    const snapshot = extractEmotionSnapshot("He tears his gaze away.");
    assert.notEqual(snapshot.tone, "sad");
});

test("extractEmotionSnapshot: 'regret nothing' does not imply sadness", () => {
    const snapshot = extractEmotionSnapshot("I regret nothing.");
    assert.notEqual(snapshot.tone, "sad");
});

test("extractEmotionSnapshot: extra term tuning expands coverage", () => {
    const snapshot = extractEmotionSnapshot("He feels wistful about it.", {extraTerms: {sad: ["wistful"]}});
    assert.equal(snapshot.tone, "sad");
    assert.equal(snapshot.intensity, "low");
});

test("extractEmotionSnapshot: affection keyword -> affection/medium", () => {
    const snapshot = extractEmotionSnapshot("I love you");
    assert.deepEqual(snapshot, {tone: "affection", intensity: "medium"});
});

test("evaluateEmotionalDelta: detects tone + intensity change after steady window", () => {
    const current = {tone: "sad", intensity: "medium"} as const;
    const recent = Array.from({length: 5}, () => ({tone: "neutral", intensity: "low"} as const));
    const delta = evaluateEmotionalDelta(current, recent);
    assert.equal(delta.detected, true);
});

test("evaluateEmotionalDelta: detects abrupt intensity drop after steady high window", () => {
    const current = {tone: "neutral", intensity: "low"} as const;
    const recent = Array.from({length: 5}, () => ({tone: "angry", intensity: "high"} as const));
    const delta = evaluateEmotionalDelta(current, recent);
    assert.equal(delta.detected, true);
});

test("evaluateEmotionalDelta: transition cue can suppress borderline delta", () => {
    const current = {tone: "sad", intensity: "medium"} as const;
    const recent = Array.from({length: 5}, () => ({tone: "neutral", intensity: "low"} as const));
    const withoutCue = evaluateEmotionalDelta(current, recent, "I regret this.");
    assert.equal(withoutCue.detected, true);

    const withCue = evaluateEmotionalDelta(current, recent, "After a long pause, I regret this.");
    assert.equal(withCue.detected, false);
});

test("detectEscalationSignals: returns expected signal types", () => {
    const signals = detectEscalationSignals(
        "I confess I need you. She hugs him close.",
        {tone: "neutral", intensity: "low"},
    );

    const types = new Set(signals.map((s: any) => s.type));
    assert.equal(types.has("emotional_disclosure"), true);
    assert.equal(types.has("dependency"), true);
    assert.equal(types.has("physical_closeness"), true);
});

test("detectEscalationSignals: avoids time-context false positives", () => {
    const signals = detectEscalationSignals(
        "It was close to midnight when they arrived.",
        {tone: "neutral", intensity: "low"},
    );
    assert.equal(signals.some((s) => s.type === "physical_closeness"), false);
});

test("extractEmotionSnapshot: detects high intensity cues", () => {
    const snapshot = extractEmotionSnapshot("I love you!!! I'm shaking.");
    assert.equal(snapshot.tone, "affection");
    assert.equal(snapshot.intensity, "high");
});

test("extractEmotionSnapshot: sigh defaults to tense, not sad", () => {
    const snapshot = extractEmotionSnapshot("He sighs.");
    assert.equal(snapshot.tone, "tense");
    assert.equal(snapshot.intensity, "low");
});

test("extractEmotionSnapshot: smile alone stays low intensity", () => {
    const snapshot = extractEmotionSnapshot("He smiles.");
    assert.deepEqual(snapshot, {tone: "affection", intensity: "low"});
});

// Proximity/consent/scene helpers are intentionally simplified stubs in the incest specialization.
// Keep smoke checks so the stage still typechecks and basic contracts hold.

test("evaluateProximityTransition: returns stable structure", () => {
    const res = evaluateProximityTransition("She takes your hand.", "Distant");
    assert.equal(res.from, "Distant");
    assert.equal(typeof res.next, "string");
    assert.equal(typeof res.skipped, "boolean");
    assert.equal(typeof res.changed, "boolean");
});

test("detectConsentIssues: returns notes array structure", () => {
    const issues = detectConsentIssues("He pins you down and forces you to kiss him.");
    assert.ok(Array.isArray(issues.notes));
    assert.equal(typeof issues.score, "number");
});

test("evaluateProximityTransition: avoids adjective 'touching moment' false positive", () => {
    const res = evaluateProximityTransition("It was a touching moment.", "Distant");
    assert.equal(res.from, "Distant");
    assert.equal(res.next, "Distant");
    assert.equal(res.changed, false);
    assert.equal(res.skipped, false);
});

test("scoreSilenceOrPause: ignores action-only roleplay replies", () => {
    const res = scoreSilenceOrPause("*nods*");
    assert.equal(res.note, null);
});

test("detectEscalationSignals: avoids negated intimacy cues", () => {
    const signals = detectEscalationSignals(
        "He doesn't kiss you. He keeps his distance.",
        {tone: "neutral", intensity: "low"},
    );
    assert.equal(signals.some((s) => s.type === "physical_intimacy"), false);
});

test("detectMemoryEvents: can emit multiple unique events", () => {
    const events = detectMemoryEvents("He comes clean. He lied to you.");
    assert.equal(events.includes("confession"), true);
    assert.equal(events.includes("betrayal"), true);
});

test("updateSceneFromMessage: returns scene object", () => {
    const scene = updateSceneFromMessage(null, "It was late night when they arrived.", {tone: "neutral", intensity: "low"});
    assert.ok(scene && typeof scene === "object");
});

test("detectMemoryEvents: detects guilt and secrecy scars", () => {
    const events = detectMemoryEvents("This is wrong. If anyone found out...");
    assert.equal(events.includes("guilt_spike"), true);
    assert.equal(events.includes("near_discovery"), true);
});
