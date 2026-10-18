export type EmotionIntensity = "low" | "medium" | "high";

export type EmotionSnapshot = {
    tone: string;
    intensity: EmotionIntensity;
};

export type RelationshipPhase = "Familial" | "Tension" | "Forbidden Awareness" | "Crossing" | "Intimate";
export type Proximity = "Distant" | "Nearby" | "Touching" | "Intimate";

export type MemoryScar = {event: string; text: string; at: number};
export type PhaseHistoryEntry = {phase: RelationshipPhase; at: number};
export type ProximityHistoryEntry = {state: Proximity; at: number};

export type EmotionTuning = {
    extraTerms?: Record<string, string[]> | null;
};

export type SceneTuning = {
    locationPlaceHeads?: string[] | null;
    locationStopwords?: string[] | null;
};

function countMatches(text: string, re: RegExp): number {
    const m = text.match(re);
    return m ? m.length : 0;
}

type WeightedHit = {label: string; weight: number};

function escapeRegExp(s: string): string {
    return (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileLooseTermsRegex(terms: string[] | null | undefined): RegExp | null {
    if (!Array.isArray(terms) || terms.length === 0) return null;
    const cleaned = Array.from(new Set(terms.map((t) => String(t || "").trim()).filter(Boolean))).slice(0, 80);
    if (cleaned.length === 0) return null;
    const parts = cleaned.map((t) => {
        const esc = escapeRegExp(t).replace(/\s+/g, "\\s+");
        return /\s/.test(t) ? esc : `\\b${esc}\\b`;
    });
    return new RegExp(`(?:${parts.join("|")})`, "i");
}

function stripQuotedDialogue(text: string): string {
    if (!text) return "";
    return text.replace(/"[^"]*"/g, " ");
}

function pushWeighted(hits: WeightedHit[], label: string, weight: number) {
    hits.push({label, weight});
}

function sumWeights(hits: WeightedHit[]): number {
    return hits.reduce((acc, h) => acc + (Number.isFinite(h.weight) ? h.weight : 0), 0);
}

function isNegatedAt(text: string, matchIndex: number, windowChars: number = 24): boolean {
    if (!text || matchIndex <= 0) return false;
    const start = Math.max(0, matchIndex - windowChars);
    const prefix = text.slice(start, matchIndex);
    if (/[.!?;,]/.test(prefix)) return false;
    return /\b(?:not|never|no|hardly|scarcely|without|isn'?t|aren'?t|don'?t|didn'?t|won'?t|can'?t|couldn'?t)\b/i.test(prefix);
}

function scoreRegexWithNegation(text: string, re: RegExp, weight: number, label: string): {score: number; reasons: WeightedHit[]} {
    if (!text) return {score: 0, reasons: []};
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    let score = 0;
    let count = 0;
    const maxCount = 6;
    while ((m = global.exec(text)) != null) {
        if (m.index == null) continue;
        if (isNegatedAt(text, m.index)) continue;
        score += weight;
        count += 1;
        if (count >= maxCount) break;
    }
    return {score, reasons: score !== 0 ? [{label, weight: score}] : []};
}

function hasAffirmedMatch(text: string, re: RegExp): boolean {
    if (!text) return false;
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) != null) {
        if (m.index == null) continue;
        if (isNegatedAt(text, m.index)) continue;
        return true;
    }
    return false;
}

function extractIntensity(text: string): EmotionIntensity {
    const t = text || "";
    let score = 0;
    const exclamations = countMatches(t, /!/g);
    const questions = countMatches(t, /\?/g);
    const allCapsWords = countMatches(t, /\b[A-Z]{3,}\b/g);
    const elongated = countMatches(t, /([a-z])\1{2,}/gi);
    if (exclamations >= 1) score += 1;
    if (exclamations >= 3) score += 1;
    if (questions >= 3) score += 1;
    if (allCapsWords >= 2) score += 1;
    if (elongated >= 1) score += 1;
    if (/\b(very|really|so|extremely|absolutely|completely|totally|utterly|incredibly)\b/i.test(t)) score += 1;
    if (/\b(furious|devastated|heartbroken|terrified|desperate|sobbing|screaming|shaking|trembling|panicking)\b/i.test(t)) score += 2;
    if (score >= 3) return "high";
    if (score >= 1) return "medium";
    return "low";
}

export function scoreEmotionSnapshot(text: string, tuning?: EmotionTuning): {
    snapshot: EmotionSnapshot;
    toneScores: Array<{tone: string; score: number; reasons: WeightedHit[]}>;
} {
    if (!text || text.trim().length === 0) {
        return {snapshot: {tone: "neutral", intensity: "low"}, toneScores: []};
    }
    const t = text;
    const intensity = extractIntensity(t);
    const extraTermsByTone = tuning?.extraTerms || null;
    const extraCache = new Map<string, RegExp | null>();
    const getExtraRegex = (tone: string): RegExp | null => {
        if (extraCache.has(tone)) return extraCache.get(tone) ?? null;
        const re = compileLooseTermsRegex(extraTermsByTone && (extraTermsByTone as any)[tone]);
        extraCache.set(tone, re);
        return re;
    };
    const toneScore = (tone: string, parts: Array<{label: string; re: RegExp; weight: number}>) => {
        const reasons: WeightedHit[] = [];
        let score = 0;
        for (const p of parts) {
            const hit = scoreRegexWithNegation(t, p.re, p.weight, p.label);
            score += hit.score;
            if (hit.reasons.length) reasons.push(...hit.reasons);
        }
        const extraRe = getExtraRegex(tone);
        if (extraRe) {
            const hit = scoreRegexWithNegation(t, extraRe, 2, "extra_terms");
            score += hit.score;
            if (hit.reasons.length) reasons.push(...hit.reasons);
        }
        return {tone, score, reasons};
    };

    const sadness = toneScore("sad", [
        {label: "sad_words", re: /\b(sad|sorrow|tearful|teary|cry(?:ing)?|sob(?:bing)?|regret(?:s|ted)?(?!\s+(?:nothing|none)\b)|heartbroken|grief|mourn(?:s|ing)?)\b/i, weight: 2},
        {label: "tears_noun", re: /\b(?:his|her|their|my|your|the)\s+tears\b|\btears?\s+(?:well(?:s|ing)?\s+up|spill(?:s|ing)?|stream(?:s|ing)?|roll(?:s|ing)?(?:\s+down)?|fall(?:s|ing)?|in\s+(?:his|her|their|my|your)\s+eyes)\b/i, weight: 2},
        {label: "apology", re: /\b(apolog(?:y|ize|ise)|sorry)\b/i, weight: 1},
        {label: "hurt", re: /\b(hurt|aching|broken|heavy in (?:his|her|their|your) chest)\b/i, weight: 1},
        {label: "tears_voice", re: /\b(voice cracks?|wipes? (?:a|his|her|their) tears?)\b/i, weight: 2},
    ]);
    const anger = toneScore("angry", [
        {label: "anger_words", re: /\b(angry|furious|enraged|livid|mad|rage)\b/i, weight: 2},
        {label: "aggressive_verbs", re: /\b(snaps?|snarls?|glares?|seeth(?:es|ing)|growls?)\b/i, weight: 2},
        {label: "shouting", re: /\b(shouts?|yells?|screams?)\b/i, weight: 2},
        {label: "dare", re: /\bhow dare you\b/i, weight: 2},
    ]);
    const anxiety = toneScore("anxious", [
        {label: "anxiety_words", re: /\b(anxious|nervous|worried|uneasy|afraid|scared|fear(?:ful)?|panic(?:s|king)?|dread)\b/i, weight: 2},
        {label: "tremble", re: /\b(trembl(?:e|es|ing)|shak(?:e|es|ing)|fidgets?|wrings? (?:his|her|their) hands)\b/i, weight: 1},
        {label: "racing", re: /\b(heart races|can'?t breathe|short of breath)\b/i, weight: 1},
    ]);
    const affection = toneScore("affection", [
        {label: "love_words", re: /\b(love|adore|cherish|treasure|fond)\b/i, weight: 2},
        {label: "care_miss", re: /\b(miss you|care about you)\b/i, weight: 2},
        {label: "tender", re: /\b(affectionately|tenderly|tender|affectionate|gentle|with a soft smile|smiles? softly|softly (?:says|whispers?|murmurs?)|warmly (?:smiles?|greets?))\b/i, weight: 1},
        {label: "smile", re: /\b(smile(?:s|d|ing)?|grin(?:s|ned|ning)?)\b/i, weight: 1},
    ]);
    const embarrassment = toneScore("embarrassed", [
        {label: "blush", re: /\b(blush(?:es|ed|ing)?|flustered|embarrass(?:ed|ing)|self-conscious|flush(?:es|ed)?)\b/i, weight: 2},
        {label: "awkward_tells", re: /\b(looks away|averts (?:his|her|their) gaze|clears? (?:his|her|their) throat|stammers?)\b/i, weight: 1},
    ]);
    const jealousy = toneScore("jealous", [
        {label: "jealous_words", re: /\b(jealous|possessive|envious|envy)\b/i, weight: 2},
        {label: "tightens", re: /\b(something tightens|a sting of jealousy|can'?t stand the thought)\b/i, weight: 1},
    ]);
    const excitement = toneScore("excited", [
        {label: "excited_words", re: /\b(excited|thrilled|giddy|eager|delighted|can'?t wait)\b/i, weight: 2},
        {label: "laugh", re: /\b(laughs?|chuckles?)\b/i, weight: 1},
        {label: "bright", re: /\b(eyes light up|can'?t help but smile)\b/i, weight: 1},
    ]);
    const tense = toneScore("tense", [
        {label: "tense_words", re: /\b(tense|awkward|stiff|rigid|strained|uneasy)\b/i, weight: 2},
        {label: "silence", re: /\b(an awkward silence|a beat of silence)\b/i, weight: 1},
        {label: "hesitation", re: /\b(pauses?|hesitates?|swallows?)\b/i, weight: 1},
        {label: "sigh", re: /\b(sighs?|exhales?|lets out (?:a|an) (?:slow )?breath)\b/i, weight: 1},
    ]);
    const guilt = toneScore("guilt", [
        {label: "guilt_words", re: /\b(guilt(?:y)?|ashamed|shame|remorse|regret(?:s|ted)?|shouldn'?t (?:feel|want|be)|this is wrong|what(?:'s| is) wrong with me)\b/i, weight: 2},
        {label: "self_reproach", re: /\b(hate myself for|can'?t believe I|disgusted with myself|sick with (?:guilt|shame))\b/i, weight: 2},
    ]);
    const shame = toneScore("shame", [
        {label: "shame_words", re: /\b(shame(?:ful)?|humiliat(?:ed|ing)|mortified|degraded)\b/i, weight: 2},
        {label: "hide", re: /\b(hide (?:my|this|it)|can'?t look (?:at|you)|want to disappear)\b/i, weight: 1},
    ]);
    const denial = toneScore("denial", [
        {label: "denial_words", re: /\b(it(?:'s| is) nothing|just (?:friends|family)|don'?t (?:mean|think) (?:it|that)|overthinking|imagining things)\b/i, weight: 2},
        {label: "rationalize", re: /\b(everyone feels|perfectly normal|just affection|nothing more)\b/i, weight: 1},
    ]);

    const toneScores = [affection, anger, anxiety, sadness, embarrassment, jealousy, excitement, tense, guilt, shame, denial]
        .sort((a, b) => b.score - a.score);

    const best = toneScores[0];
    const bestTone = best && best.score > 0 ? best.tone : "neutral";
    const minScoreByTone: Record<string, number> = {
        sad: 2, angry: 2, anxious: 2, embarrassed: 2, jealous: 2, excited: 2,
        affection: 1, tense: 1, guilt: 2, shame: 2, denial: 2,
    };
    const minScore = minScoreByTone[bestTone] ?? 1;
    const tone = best && best.score >= minScore ? bestTone : "neutral";
    const forceMediumLabels = new Set<string>(["sad_words", "love_words", "care_miss"]);
    const forcedMedium = (tone === "sad" || tone === "affection") && best && best.reasons.some((r) => forceMediumLabels.has(r.label));
    const adjustedIntensity: EmotionIntensity = forcedMedium && intensity === "low" ? "medium" : intensity;
    return {snapshot: {tone, intensity: adjustedIntensity}, toneScores};
}

export function extractEmotionSnapshot(text: string, tuning?: EmotionTuning): EmotionSnapshot {
    return scoreEmotionSnapshot(text, tuning).snapshot;
}

export function evaluateEmotionalDelta(current: EmotionSnapshot, recent: EmotionSnapshot[], content?: string) {
    const window = recent.slice(-5);
    if (!window || window.length === 0) return {detected: false, summary: '', score: 0, reasons: [] as WeightedHit[]};
    const intensityScore = (s: EmotionSnapshot) => ({low: 0, medium: 1, high: 2}[s.intensity] ?? 0);
    const avgPrevIntensity = Math.round(window.reduce((a, b) => a + intensityScore(b), 0) / window.length);
    const recentTones = window.map((s) => s.tone);
    const lastTone = recentTones[recentTones.length - 1] ?? '';
    const prevTones = Array.from(new Set(recentTones)).slice(-3);
    const curIntensity = intensityScore(current);
    const toneChanged = lastTone.length === 0 ? false : (lastTone !== current.tone);
    const intensityJump = curIntensity - avgPrevIntensity;
    const absIntensityJump = Math.abs(intensityJump);
    const steadyPrev = recentTones.length >= 3 && recentTones.every(t => t === lastTone);
    const polarity = (tone: string): "pos" | "neg" | "neutral" => {
        if (["affection", "excited"].includes(tone)) return "pos";
        if (["sad", "angry", "anxious", "jealous", "tense", "guilt", "shame", "denial"].includes(tone)) return "neg";
        return "neutral";
    };
    const prevPolarity = polarity(lastTone);
    const curPolarity = polarity(current.tone);
    const polarityFlip = prevPolarity !== curPolarity && prevPolarity !== "neutral" && curPolarity !== "neutral";
    const reasons: WeightedHit[] = [];
    if (steadyPrev) pushWeighted(reasons, "steady_previous_window", 1);
    if (toneChanged) pushWeighted(reasons, "tone_changed", 1);
    if (polarityFlip) pushWeighted(reasons, "polarity_flip", 2);
    if (absIntensityJump >= 1) {
        const label = intensityJump >= 0 ? "intensity_spike" : "intensity_drop";
        pushWeighted(reasons, label, Math.min(3, absIntensityJump) * 2);
    }
    const transitionCues = /\b(after a (?:long )?pause|takes a breath|breathes (?:in|out)|softens|voice (?:softens|quiets|drops)|steadying|gently|carefully|hesitates|swallows|manages a smile)\b/i;
    if (typeof content === "string" && transitionCues.test(content)) pushWeighted(reasons, "transition_cue_present", -2);
    const score = sumWeights(reasons);
    const detected = score >= 3 && ((absIntensityJump >= 2) || (polarityFlip && steadyPrev && curIntensity >= 1) || (toneChanged && steadyPrev && absIntensityJump >= 1));
    const intensityWord = (n: number) => (n <= 0 ? "low" : n === 1 ? "medium" : "high");
    const prevToneLabel = lastTone && lastTone.length > 0 ? lastTone : "neutral";
    const summary = `${prevToneLabel}/${intensityWord(avgPrevIntensity)} → ${current.tone}/${intensityWord(curIntensity)}${prevTones.length > 1 ? ` (recent tones: ${prevTones.join(", ")})` : ""}`;
    return {detected, summary, score, reasons};
}

export function detectEscalationSignals(content: string, snapshot: EmotionSnapshot) {
    const signals: Array<{type: string; suggestedPhase: RelationshipPhase; text: string; weight: number}> = [];
    if (!content || content.trim().length === 0) return signals;
    const t = content;
    const pushUnique = (signal: {type: string; suggestedPhase: RelationshipPhase; text: string; weight: number}) => {
        if (signals.some((s) => s.type === signal.type)) return;
        signals.push(signal);
    };
    if (hasAffirmedMatch(t, /\b(I\s+(?:feel|felt|confess|admit|can'?t help)\b|\bconfess(?:ed)?\b|\bcome(?:s|ing)? clean\b|\bthe truth is\b)/i)) {
        pushUnique({type: 'emotional_disclosure', suggestedPhase: 'Tension', text: t.slice(0, 200), weight: 1});
    }
    if (hasAffirmedMatch(t, /\b(you'?re (?:beautiful|pretty|gorgeous|handsome)|can'?t stop looking at you|you look (?:good|amazing)|so cute|so hot|you smell (?:good|nice))\b/i)) {
        pushUnique({type: 'attraction_language', suggestedPhase: 'Tension', text: t.slice(0, 200), weight: 1});
    }
    if (hasAffirmedMatch(t, /\b(this is wrong|shouldn'?t (?:feel|want|be|think)|what(?:'s| is) wrong with me|I shouldn'?t|forbidden|taboo|incest|we can'?t)\b/i)) {
        pushUnique({type: 'taboo_recognition', suggestedPhase: 'Forbidden Awareness', text: t.slice(0, 200), weight: 2});
    }
    if (hasAffirmedMatch(t, /\b(guilt(?:y)?|ashamed|shame|remorse|hate myself for|sick with (?:guilt|shame))\b/i)) {
        pushUnique({type: 'guilt_shame', suggestedPhase: 'Forbidden Awareness', text: t.slice(0, 200), weight: 2});
    }
    if (hasAffirmedMatch(t, /\b(if (?:anyone|someone|they|mom|dad|family) (?:found|finds|knew|knows)|keep (?:this|it) (?:secret|quiet|between us)|don'?t tell|no one can know)\b/i)) {
        pushUnique({type: 'secrecy', suggestedPhase: 'Forbidden Awareness', text: t.slice(0, 200), weight: 2});
    }
    if (hasAffirmedMatch(t, /\b(hugs?|embrace(?:s|d)?|cuddl(?:e|es|ed|ing)|wraps? (?:an?|their) arm|takes? (?:your|his|her|their) hand|interlaces fingers|holds hands|leans? in|moves? closer|closes the distance|press(?:es|ed)? against|rests? (?:a|his|her|their) hand (?:on|against) (?:your|his|her|their) (?:arm|shoulder|waist|back))\b/i)) {
        pushUnique({type: 'physical_closeness', suggestedPhase: 'Crossing', text: t.slice(0, 200), weight: 1});
    }
    if (hasAffirmedMatch(t, /\b(I need you|don'?t leave|please stay|I can'?t live|depend on you|rely on you|I can'?t (?:do|be) (?:this|without you))\b/i)) {
        pushUnique({type: 'dependency', suggestedPhase: 'Crossing', text: t.slice(0, 200), weight: 2});
    }
    if (hasAffirmedMatch(t, /\b(I love you|in love|falling for you|can'?t stop thinking about you)\b/i)) {
        pushUnique({type: 'love_confession', suggestedPhase: 'Crossing', text: t.slice(0, 200), weight: 3});
    }
    if (hasAffirmedMatch(t, /\b(kiss(?:es|ed|ing)?(?:\s+(?:you|me|him|her|them))?\s+on the lips|making love|have sex|sex\b|intercourse|nude|strip(?:s|ped|ping)?|undress(?:es|ed)?|moan(?:s|ed|ing)?|orgasm)\b/i)) {
        pushUnique({type: 'physical_intimacy', suggestedPhase: 'Intimate', text: t.slice(0, 200), weight: 3});
    }
    if (snapshot.tone === 'affection' && snapshot.intensity === 'high') {
        pushUnique({type: 'affection_high', suggestedPhase: 'Crossing', text: 'high-affection', weight: 1});
    }
    if (["guilt", "shame"].includes(snapshot.tone) && snapshot.intensity !== "low") {
        pushUnique({type: 'guilt_tone', suggestedPhase: 'Forbidden Awareness', text: 'guilt/shame tone', weight: 1});
    }
    return signals;
}

export function detectMemoryEvents(content: string): string[] {
    if (!content) return [];
    const t = content;
    const hits = new Set<string>();
    if (hasAffirmedMatch(t, /\b(confess(?:ed)?|admit(?:s|ted)?|come(?:s|ing)? clean|the truth is)\b/i) || hasAffirmedMatch(t, /\b(I (?:need|have) to be honest|I have to tell you something|I should tell you|I owe you the truth)\b/i)) hits.add('confession');
    if (hasAffirmedMatch(t, /\b(betray(?:s|ed)?|cheat(?:s|ed|ing)?|deceiv(?:e|es|ed)|gaslight(?:s|ed|ing)?)\b/i) || hasAffirmedMatch(t, /\b(lie(?:s|d)? to you|lied to you|lying to you)\b/i) || hasAffirmedMatch(t, /\b(hid(?:es|ing)? it|kept it from you|kept this from you|went behind your back|broke your trust)\b/i)) hits.add('betrayal');
    if (hasAffirmedMatch(t, /\b(reject(?:s|ed)?|turns you down|pushes you away|not interested|breaks up|says no)\b/i) || hasAffirmedMatch(t, /\b(let'?s just be friends|I don'?t feel that way|not like that|I can'?t be with you|we shouldn'?t)\b/i)) hits.add('rejection');
    if (hasAffirmedMatch(t, /\b(argue(?:s|d)?|fight(?:s|ing)?|conflict|shout(?:s|ed|ing)?|yell(?:s|ed|ing)?|storm(?:s|ed)? off|slams? the door|snaps? at)\b/i) || hasAffirmedMatch(t, /\b(gives the silent treatment|won'?t talk to|refuses to speak)\b/i)) hits.add('conflict');
    if (hasAffirmedMatch(t, /\b(this is wrong|shouldn'?t (?:feel|want|be)|what(?:'s| is) wrong with me|I shouldn'?t)\b/i) || hasAffirmedMatch(t, /\b(guilt(?:y)?|ashamed|shame|remorse|hate myself for)\b/i)) hits.add('guilt_spike');
    if (hasAffirmedMatch(t, /\b(if (?:anyone|someone|they|mom|dad|family) (?:found|finds|knew|knows)|keep (?:this|it) (?:secret|quiet|between us)|don'?t tell|no one can know|almost (?:got|caught))\b/i)) hits.add('near_discovery');
    if (hasAffirmedMatch(t, /\b((?:my |your )?(?:dad|daddy|mom|mommy|mother|father|sis|sister|bro|brother|daughter|son)\b.*\b(?:kiss|touch|want|love|need)|\b(?:kiss|touch|want|love|need)\b.*\b(?:dad|daddy|mom|mommy|mother|father|sis|sister|bro|brother|daughter|son))\b/i)) hits.add('role_reminder');
    if (hasAffirmedMatch(t, /\b(almost (?:said|told|confessed|kissed)|came so close|stopped myself|held back)\b/i)) hits.add('near_confession');
    if (hasAffirmedMatch(t, /\b(boundary|cross(?:ed|ing)? (?:the )?(?:line|boundary)|went too far|shouldn'?t have)\b/i)) hits.add('boundary_test');
    if (hasAffirmedMatch(t, /\b((?:mom|dad|sister|brother|family) (?:walked|came|knocked|called|interrupted)|heard (?:footsteps|someone)|door (?:opened|creaked))\b/i)) hits.add('family_intrusion');
    return Array.from(hits);
}

export function detectSubtext(content: string): string[] { return scoreSubtext(content).notes; }

export function scoreSubtext(content: string): {notes: string[]; score: number; reasons: WeightedHit[]} {
    if (!content) return {notes: [], score: 0, reasons: []};
    const notes = new Set<string>();
    const reasons: WeightedHit[] = [];
    const t = content;
    if (hasAffirmedMatch(t, /\b(um|uh|er)\b/i) || hasAffirmedMatch(t, /\.\.\./) || hasAffirmedMatch(t, /\b(hesitates|pauses)\b/i) || hasAffirmedMatch(t, /\b(not sure|maybe|i guess|i suppose)\b/i)) { notes.add('hesitation/uncertainty'); pushWeighted(reasons, 'hesitation/uncertainty', 1); }
    if (hasAffirmedMatch(t, /\b(changes the subject|deflects|dodges the question|avoids eye contact|looks away|shrugs it off|doesn'?t answer)\b/i) || hasAffirmedMatch(t, /\b(anyway|besides|doesn'?t matter|let'?s not)\b/i)) { notes.add('avoidance'); pushWeighted(reasons, 'avoidance', 2); }
    if (hasAffirmedMatch(t, /\b(careful not to|holding back|guarded|keeps distance emotionally|measured tone|doesn'?t say it outright)\b/i)) { notes.add('guarded interest'); pushWeighted(reasons, 'guarded interest', 1); }
    if (hasAffirmedMatch(t, /\b(afraid to ask|fear of rejection|worried you'?ll say no|doesn'?t want to scare you off)\b/i)) { notes.add('fear of rejection'); pushWeighted(reasons, 'fear of rejection', 2); }
    if (hasAffirmedMatch(t, /\b(swallow(?:s|ed)?|fidgets?|chews? (?:their|his|her|their) lip|voice (?:drops|quiet|small)|hands? (?:shake|tremble))\b/i)) { notes.add('nervous tell'); pushWeighted(reasons, 'nervous tell', 1); }
    return {notes: Array.from(notes), score: sumWeights(reasons), reasons};
}

export function recallMemoryScar(scars: MemoryScar[], lastScarRecallIdx: number | null | undefined) {
    if (!Array.isArray(scars) || scars.length === 0) return {note: null as string | null, nextIdx: lastScarRecallIdx ?? -1};
    const priorIdx = lastScarRecallIdx ?? -1;
    const targetIdx = scars.length - 1;
    if (targetIdx === priorIdx) return {note: null as string | null, nextIdx: priorIdx};
    const scar = scars[targetIdx];
    const templates: Record<string, string> = {
        confession: 'Recall: a confession is still in the air. Keep stakes and vulnerability consistent.',
        betrayal: 'Recall: a betrayal/lie still hangs between them. Trust tension should persist until repaired.',
        rejection: 'Recall: rejection still stings. Avoid sudden comfort without a repair beat.',
        conflict: 'Recall: conflict remains unresolved. Consider apology/clarification before softening too far.',
        guilt_spike: 'Recall: guilt/shame is still active. Softening too quickly without addressing it may feel unearned.',
        near_discovery: 'Recall: a near-discovery still hangs in the air. Secrecy pressure and risk awareness should persist.',
        role_reminder: 'Recall: family-role language and attraction recently mixed. Role tension remains relevant.',
        near_confession: 'Recall: a near-confession was left hanging. The unspoken weight should still color the dynamic.',
        boundary_test: 'Recall: a boundary was tested. Consequences or reflection should not vanish without a beat.',
        family_intrusion: 'Recall: a family interruption occurred. Risk and secrecy remain elevated.',
    };
    return { note: templates[scar.event] || `Recall: unresolved ${scar.event} persists. Keep continuity in tone and stakes.`, nextIdx: targetIdx };
}

export function detectTabooAwareness(content: string): {notes: string[]; score: number; reasons: WeightedHit[]} {
    if (!content) return {notes: [], score: 0, reasons: []};
    const notes = new Set<string>(); const reasons: WeightedHit[] = []; const t = content;
    if (hasAffirmedMatch(t, /\b(this is wrong|shouldn'?t (?:feel|want|be|think)|what(?:'s| is) wrong with me|forbidden|taboo|we can'?t|I shouldn'?t)\b/i)) { notes.add('taboo recognition'); pushWeighted(reasons, 'taboo_recognition', 2); }
    if (hasAffirmedMatch(t, /\b(it(?:'s| is) nothing|just (?:friends|family)|don'?t (?:mean|think) (?:it|that)|overthinking|imagining things|perfectly normal)\b/i)) { notes.add('denial/rationalization'); pushWeighted(reasons, 'denial', 1); }
    if (hasAffirmedMatch(t, /\b(cross(?:ed|ing)? (?:the )?(?:line|boundary)|went too far|shouldn'?t have (?:touched|said|done))\b/i)) { notes.add('boundary awareness'); pushWeighted(reasons, 'boundary_awareness', 2); }
    return {notes: Array.from(notes), score: sumWeights(reasons), reasons};
}

export function detectGuiltShame(content: string): {notes: string[]; score: number; reasons: WeightedHit[]} {
    if (!content) return {notes: [], score: 0, reasons: []};
    const notes = new Set<string>(); const reasons: WeightedHit[] = []; const t = content;
    if (hasAffirmedMatch(t, /\b(guilt(?:y)?|ashamed|shame|remorse|regret(?:s|ted)?)\b/i)) { notes.add('guilt/shame language'); pushWeighted(reasons, 'guilt_shame_words', 2); }
    if (hasAffirmedMatch(t, /\b(hate myself for|can'?t believe I|disgusted with myself|sick with (?:guilt|shame)|want to disappear)\b/i)) { notes.add('self-reproach'); pushWeighted(reasons, 'self_reproach', 2); }
    if (hasAffirmedMatch(t, /\b(afterglow|despite (?:the )?guilt|even though (?:it(?:'s| is) wrong|I shouldn'?t))\b/i)) { notes.add('guilt alongside desire'); pushWeighted(reasons, 'guilt_with_desire', 1); }
    return {notes: Array.from(notes), score: sumWeights(reasons), reasons};
}

export function detectRoleBleed(content: string): {notes: string[]; score: number; reasons: WeightedHit[]} {
    if (!content) return {notes: [], score: 0, reasons: []};
    const notes = new Set<string>(); const reasons: WeightedHit[] = []; const t = content;
    const familyTerms = /\b(?:dad|daddy|mom|mommy|mother|father|sis|sister|bro|brother|daughter|son|kid|child)\b/i;
    const romanticSexual = /\b(?:kiss|touch|want|desire|love|need|hot|beautiful|gorgeous|hard|wet|moan|bed|naked|undress)\b/i;
    if (familyTerms.test(t) && romanticSexual.test(t)) { notes.add('familial + romantic/sexual language co-occurrence'); pushWeighted(reasons, 'role_bleed_cooccurrence', 3); }
    if (hasAffirmedMatch(t, /\b(?:good (?:girl|boy)|my (?:girl|boy|princess|baby))\b/i) && familyTerms.test(t)) { notes.add('possessive/affectionate framing with family role'); pushWeighted(reasons, 'possessive_family', 2); }
    if (hasAffirmedMatch(t, /\b(?:not (?:just )?(?:your )?(?:dad|mom|sister|brother)|more than (?:family|siblings|father|mother))\b/i)) { notes.add('explicit role renegotiation'); pushWeighted(reasons, 'role_renegotiation', 2); }
    return {notes: Array.from(notes), score: sumWeights(reasons), reasons};
}

export function detectSecrecy(content: string): {notes: string[]; score: number; reasons: WeightedHit[]} {
    if (!content) return {notes: [], score: 0, reasons: []};
    const notes = new Set<string>(); const reasons: WeightedHit[] = []; const t = content;
    if (hasAffirmedMatch(t, /\b(if (?:anyone|someone|they|mom|dad|family) (?:found|finds|knew|knows)|keep (?:this|it) (?:secret|quiet|between us)|don'?t tell|no one can know)\b/i)) { notes.add('fear of discovery / secrecy language'); pushWeighted(reasons, 'secrecy_language', 2); }
    if (hasAffirmedMatch(t, /\b(lock(?:ed)? the door|close(?:d)? the (?:door|blinds|curtains)|whisper(?:s|ed|ing)?|lower(?:ed|ing)? (?:his|her|their|your) voice)\b/i)) { notes.add('secrecy behavior'); pushWeighted(reasons, 'secrecy_behavior', 1); }
    if (hasAffirmedMatch(t, /\b(almost (?:got|caught|seen)|close call|too close|heard (?:footsteps|someone)|door (?:opened|creaked))\b/i)) { notes.add('near-discovery tension'); pushWeighted(reasons, 'near_discovery', 2); }
    return {notes: Array.from(notes), score: sumWeights(reasons), reasons};
}

// Stubs for remaining original helpers so Stage compiles. Full bodies retained in upstream history.
export function detectDrift(_p: any): string | null { return null; }
export function scoreSilenceOrPause(content: string): {note: string | null; score: number; reasons: WeightedHit[]} {
    if (content == null) return {note: null, score: 0, reasons: []};
    const trimmed = content.trim();
    if (/^(?:\*[^*]{1,120}\*|\([^)]{1,120}\)|\[[^\]]{1,120}\])$/.test(trimmed)) return {note: null, score: 0, reasons: []};
    if (trimmed.length === 0) return {note: 'Silence detected: consider clarifying hesitation or disengagement.', score: 3, reasons: [{label: 'silence', weight: 3}]};
    return {note: null, score: 0, reasons: []};
}
export function detectSilenceOrPause(content: string): string | null { return scoreSilenceOrPause(content).note; }
export function evaluateProximityTransition(content: string, current?: Proximity): {changed: boolean; skipped: boolean; from: Proximity; next: Proximity; missing?: string[]} {
    const from = current || 'Distant';
    return {changed: false, skipped: false, from, next: from};
}
export type SceneState = { location?: string; timeOfDay?: string; mood?: string; unresolvedBeats?: Array<{id: string; snippet: string}>; [k: string]: any };
export function updateSceneFromMessage(prev: SceneState | null, _content: string, _snapshot: EmotionSnapshot, _tuning?: SceneTuning): SceneState {
    return prev || {};
}
export function summarizeScene(scene: SceneState | null | undefined): string {
    if (!scene) return '';
    const parts: string[] = [];
    if (scene.location) parts.push(String(scene.location));
    if (scene.timeOfDay) parts.push(String(scene.timeOfDay));
    if (scene.mood) parts.push(String(scene.mood));
    return parts.join(' · ');
}
export function detectConsentIssues(_content: string, _sensitivity?: number): {notes: string[]; score: number; critical?: boolean} {
    return {notes: [], score: 0};
}
export function scoreUnresolvedBeatReminder(_args: any): {note: string | null; score: number; reasons: WeightedHit[]; beatId?: string | null} {
    return {note: null, score: 0, reasons: [], beatId: null};
}
