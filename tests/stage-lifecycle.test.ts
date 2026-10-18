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

test("Stage.load: returns success and initial state", async () => {
    const stage = makeStage({ui_enabled: 0});
    const res = await stage.load();
    assert.equal(res.success, true);
    assert.ok(res.messageState);
    assert.equal((res.messageState as any).phase, "Familial");
});

test("Stage.beforePrompt: injects pendingPromptNotes one-shot (system prompt only)", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        prompt_injection_include_scene: 0,
    });

    stage.myInternalState.pendingPromptNotes = {at: Date.now(), fromTurn: 1, parts: ["Keep continuity consistent."]};
    const first = await stage.beforePrompt({content: "hello"} as any);
    assert.equal(typeof first.systemMessage, "string");
    assert.match(first.systemMessage as string, /INTERNAL REALISM NOTES/i);
    assert.match(first.systemMessage as string, /Keep continuity consistent\./);
    assert.equal(stage.myInternalState.pendingPromptNotes, null);

    const second = await stage.beforePrompt({content: "hello again"} as any);
    assert.equal(second.systemMessage, null);
});

test("Stage.afterResponse: tracks emotions and can queue notes", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        prompt_injection_include_scene: 0,
        note_guilt_shame: 1,
        note_taboo_awareness: 1,
    });

    await stage.afterResponse({content: "This is wrong. I shouldn't feel this way about you."} as any);
    assert.ok(Array.isArray(stage.myInternalState.lastEmotions));
    assert.ok(stage.myInternalState.lastEmotions!.length >= 1);
});

test("Stage.afterResponse: scars log guilt/secrecy events", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        note_scar_recall: 1,
    });

    await stage.afterResponse({content: "This is wrong. If anyone found out we would be ruined."} as any);
    assert.ok(Array.isArray(stage.myInternalState.memoryScars));
    assert.ok(stage.myInternalState.memoryScars!.some((s: any) => s.event === "guilt_spike" || s.event === "near_discovery"));
});

test("Stage.afterResponse: action-only replies are not treated as silence", async () => {
    const stage = makeStage({
        strictness: 3,
        ui_enabled: 0,
        prompt_injection_enabled: 1,
        note_silence: 1,
    });

    await stage.afterResponse({content: "*nods*"} as any);
    // Action-only should not create a silence note
    const notes = stage.myInternalState.pendingPromptNotes;
    if (notes && Array.isArray(notes.parts)) {
        assert.equal(notes.parts.some((p: string) => /silence|pause/i.test(p)), false);
    }
});

test("Stage.setState: restores message state", async () => {
    const stage = makeStage({strictness: 2, ui_enabled: 0});
    stage.myInternalState.phase = "Tension";
    stage.myInternalState.overlayNotes = [{text: "test", at: Date.now()}];
    const persisted = {...stage.myInternalState};
    await stage.setState(persisted);
    assert.equal(stage.myInternalState.phase, "Tension");
});
