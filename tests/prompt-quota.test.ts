import test from "node:test";
import assert from "node:assert/strict";
import {Stage} from "../src/Stage";

function makeStage(config: any = {}, messageState: any = null, chatState: any = null) {
    return new Stage({
        characters: {},
        users: {},
        config,
        messageState,
        chatState: chatState ?? {scene: null},
        initState: null,
    } as any);
}

test("prompt injection: max_notes_per_20=0 blocks non-critical notes", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        prompt_injection_include_scene: 0,
        max_notes_per_20: 0,
        note_subtext: 1,
        note_taboo_awareness: 1,
        note_guilt_shame: 1,
    });

    // Non-critical subtext / mild taboo language should be blocked when quota is 0
    await stage.afterResponse({content: "Um... anyway, doesn't matter."} as any);
    assert.equal(stage.myInternalState.pendingPromptNotes == null, true);
});

test("prompt injection: high-score taboo notes can still queue when enabled", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        prompt_injection_include_scene: 0,
        note_taboo_awareness: 1,
        note_guilt_shame: 1,
        note_secrecy: 1,
        max_notes_per_20: 6,
    });

    await stage.afterResponse({
        content: "This is wrong. I shouldn't feel this way. If anyone found out we would be ruined.",
    } as any);

    // With quota available, strong taboo/guilt/secrecy signals should produce guidance
    assert.ok(stage.myInternalState.pendingPromptNotes);
    const res = await stage.beforePrompt({content: "next"} as any);
    assert.equal(typeof res.systemMessage, "string");
    assert.match(res.systemMessage as string, /INTERNAL REALISM NOTES/i);
});

test("prompt injection quota: strictness 2 allows limited non-critical notes", async () => {
    const stage = makeStage({
        strictness: 2,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        prompt_injection_include_scene: 0,
        note_taboo_awareness: 1,
        note_guilt_shame: 1,
        note_secrecy: 1,
        note_subtext: 1,
    });

    await stage.afterResponse({
        content: "This is wrong. I shouldn't want this. Keep this secret between us.",
    } as any);
    assert.ok(stage.myInternalState.pendingPromptNotes);

    // Consume the one-shot injection
    await stage.beforePrompt({content: "next"} as any);
    assert.equal(stage.myInternalState.pendingPromptNotes, null);
});
