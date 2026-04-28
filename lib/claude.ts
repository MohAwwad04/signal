import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const GLOBAL_RULES = `You are an expert LinkedIn content strategist and B2B storytelling specialist.

Your job is to extract and generate ONLY high-value, high-signal content that is worth publishing on LinkedIn.

Avoid generic, vague, motivational, or obvious content.
Everything must feel specific, credible, and insight-driven.

GLOBAL RULES (APPLY TO ALL STEPS):
- No fluff. No generic advice.
- Prioritize specific numbers, real outcomes, mistakes, lessons, or unique insights.
- Content must sound like it comes from real experience, not theory.
- Reject anything that feels: obvious, cliché, broad, or unverifiable.
- Prefer: contrarian takes, measurable impact, clear before/after transformation, strong opinions backed by experience.
- If input is weak → extract fewer results or skip entirely. Never fill in with generic content.
- Quality is the only priority.`;

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function textCall(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const anthropic = client();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });
      const block = msg.content[0];
      if (!block || block.type !== "text") return "";
      return block.text;
    } catch (err: any) {
      lastErr = err;
      if (err?.status && err.status < 500) throw err; // don't retry 4xx
    }
  }
  throw lastErr;
}

function extractJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : cleaned) as T;
}

/* ---------- post generation from transcript ---------- */

export type GeneratedSignal = {
  title?: string;
  rawContent: string;
  hashtags?: string[];
  recommendedAuthorRole?: string;
  contentAngle?: string;
  frameworkName?: string;
  sourceExcerpt?: string;
};

export type AuthorContext = {
  role: string;
  contentAngles: string[];
  preferredFrameworkNames: string[];
  voiceProfile?: string;
  performanceLearningHints?: string;
};

const TRANSCRIPT_CHUNK_SIZE = 35000;
const TRANSCRIPT_CHUNK_OVERLAP = 2000;
const SIGNALS_PER_CHUNK = 4;
const MAX_SIGNALS_TOTAL = 10;

function chunkTranscript(transcript: string): string[] {
  if (transcript.length <= TRANSCRIPT_CHUNK_SIZE) return [transcript];
  const chunks: string[] = [];
  let start = 0;
  while (start < transcript.length) {
    chunks.push(transcript.slice(start, start + TRANSCRIPT_CHUNK_SIZE));
    if (start + TRANSCRIPT_CHUNK_SIZE >= transcript.length) break;
    start += TRANSCRIPT_CHUNK_SIZE - TRANSCRIPT_CHUNK_OVERLAP;
  }
  return chunks;
}

function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const setA = words(a);
  const setB = words(b);
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function deduplicateAndRank(signals: GeneratedSignal[]): GeneratedSignal[] {
  const kept: GeneratedSignal[] = [];
  for (const signal of signals) {
    const anchor = signal.sourceExcerpt ?? signal.rawContent;
    const dupIdx = kept.findIndex((k) => jaccardSimilarity(anchor, k.sourceExcerpt ?? k.rawContent) > 0.45);
    if (dupIdx === -1) {
      kept.push(signal);
    } else if (signal.rawContent.length > kept[dupIdx].rawContent.length) {
      kept[dupIdx] = signal;
    }
  }
  // rank by richness: numbers, before/after language, raw content length
  return kept
    .map((s) => {
      const text = s.rawContent + (s.sourceExcerpt ?? "");
      let score = Math.min(text.length / 80, 15);
      score += (text.match(/\d+/g)?.length ?? 0) * 3;
      if (/before|after|went from|increased|decreased|grew|dropped|from \d|to \d/i.test(text)) score += 6;
      if (/\$|%|\bx\d|\b\d+x\b/i.test(text)) score += 6;
      return { signal: s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SIGNALS_TOTAL)
    .map((r) => r.signal);
}

function parseSignals(raw: string): GeneratedSignal[] {
  if (!/\bPOST \d+:/i.test(raw)) {
    console.log("[parseSignals] No POST markers found. Raw response (first 300 chars):", raw.slice(0, 300));
    return [];
  }
  // slice(1) drops everything before the first POST marker (preamble / reasoning text)
  const parts = raw.split(/\bPOST \d+:/i).slice(1).filter((p) => p.trim().length > 80);
  console.log(`[parseSignals] Split into ${parts.length} part(s) after POST markers`);
  return parts
    .map((part) => {
      const lines = part.trim().split("\n");
      const pick = (prefix: RegExp) => {
        const idx = lines.findIndex((l) => prefix.test(l.trim()));
        return idx !== -1 ? { value: lines[idx].replace(prefix, "").trim(), idx } : { value: undefined, idx: -1 };
      };
      const title = pick(/^TITLE:\s*/i);
      const rec = pick(/^RECOMMENDED_FOR:\s*/i);
      const angle = pick(/^CONTENT_ANGLE:\s*/i);
      const framework = pick(/^FRAMEWORK:\s*/i);
      const quote = pick(/^SOURCE_QUOTE:\s*/i);
      const hashtagsField = pick(/^HASHTAGS:\s*/i);
      const hashtags = hashtagsField.value
        ? hashtagsField.value.split(",").map((h) => h.trim().replace(/^#/, "")).filter(Boolean)
        : undefined;
      const skipIdxs = new Set(
        [title.idx, rec.idx, angle.idx, framework.idx, quote.idx, hashtagsField.idx].filter((i) => i !== -1),
      );
      const content = lines.filter((_, i) => !skipIdxs.has(i)).join("\n").trim();
      return {
        title: title.value,
        rawContent: content,
        hashtags,
        recommendedAuthorRole: rec.value,
        contentAngle: angle.value,
        frameworkName: framework.value || undefined,
        sourceExcerpt: quote.value,
      };
    })
    .filter((p) => p.rawContent.length > 80);
}

export async function generatePostsFromTranscript(
  transcript: string,
  authors: AuthorContext[],
  frameworks: { name: string; description: string }[] = [],
): Promise<GeneratedSignal[]> {
  const authorBlock = authors
    .filter((a) => a.contentAngles.length > 0)
    .map((a) => {
      const angles = a.contentAngles.join(", ");
      const frameworks = a.preferredFrameworkNames.length
        ? `Preferred frameworks: ${a.preferredFrameworkNames.join(", ")}.`
        : "";
      const voice = a.voiceProfile ? `Voice profile:\n${a.voiceProfile}` : "";
      const hints = a.performanceLearningHints
        ? `Patterns that perform well for this author:\n${a.performanceLearningHints}`
        : "";
      return `AUTHOR: ${a.role}\nContent angles: ${angles}\n${frameworks}\n${voice}\n${hints}`.trim();
    })
    .join("\n\n---\n\n");

  const fallbackRoles = authors.map((a) => a.role).filter(Boolean);

  const systemPrompt = `${GLOBAL_RULES}

TRANSCRIPT LANGUAGE & QUALITY (critical — read before processing):
- The transcript may be in Arabic, English, or a mix of both. Process any language faithfully.
- Arabic transcription is often noisy. Errors include: wrong homophones, missing short vowels, garbled proper nouns, run-on words, and speaker-label mistakes. Use surrounding context to infer the true meaning — do not discard a segment just because individual words look wrong.
- Arabic speakers frequently use English technical or business terms but pronounce them in Arabic, so they appear in Arabic script (e.g., "ميتنج" = meeting, "بريزنتيشن" = presentation, "ديدلاين" = deadline, "فيدباك" = feedback, "تارجت" = target, "كلاينت" = client, "ريفينيو" = revenue, "بيتشينج" = pitching, "أونبوردينج" = onboarding, "ستريتيجي" = strategy, "ماركيتنج" = marketing, "فريلانس" = freelance, "أوفر" = offer, "ديل" = deal). Recognise these phonetic Arabic spellings and treat them as their English equivalents when extracting insights.
- If a number, metric, or key claim is partially garbled, note the closest plausible reading and still include the insight — flag uncertainty only if the meaning is truly ambiguous.
- Always write the OUTPUT in fluent English regardless of the transcript language.`;

  const buildUserPrompt = (chunk: string, chunkLabel: string) => `You are extracting high-value content signals from a meeting transcript${chunkLabel}. A signal is a specific, real, shareable insight — not a topic, not a vague theme.

PHASE 1 — MINE THE TRANSCRIPT FOR GENUINE VALUE
A moment is worth extracting ONLY if a stranger scrolling LinkedIn would stop because of it. It must contain at least one of:
- A real decision made and WHY (the reasoning that others rarely share)
- A counterintuitive lesson — something that contradicts conventional advice
- A concrete outcome with real numbers, timelines, or before/after evidence
- A process or framework the team actually uses — specific, not theoretical
- A mistake or failure and what it revealed
- A strong, defensible opinion on something people argue about
- A moment where someone changed their mind and why — the pivot that shifted the room
- A tension or disagreement that revealed something real about how the team or company actually works
- A surprising contrast: what everyone expected vs. what actually happened
- An uncomfortable truth that people in this industry avoid saying publicly
- A specific system or habit that produced a measurable, named result

REJECT: small talk, status updates, vague plans, obvious statements, anything without a specific detail anchoring it.

If nothing meets this bar → return 0 signals. Never manufacture content to fill space.

PHASE 2 — MATCH TO THE RIGHT AUTHOR AND WRITE A SELF-CONTAINED SIGNAL
For each qualified moment:
1. Pick the author whose content angles genuinely match the insight — don't force a match
2. Identify the exact content angle it maps to
3. Write the raw insight as a standalone publishable signal (3–6 sentences) following ALL of these rules:

   SELF-CONTAINMENT (most important rule):
   - The signal must make 100% sense to a stranger who has NEVER seen this transcript, call, or meeting
   - Never reference "the meeting", "our call", "we discussed", "this quarter", "our team", or any internal context
   - Every specific detail (number, outcome, name, result) must be explained inline so any reader can follow
   - Replace "we" with "I" or make it universal — it must sound like a public post, not a meeting note
   - If the insight leans heavily on internal context, generalise it — do not reject it for this reason alone

   STRUCTURE:
   - OPEN with the most surprising or specific detail — stated as a universal truth or personal experience, never as "in our meeting we found…"
   - AIM for at least one concrete anchor: a real number, a before/after result, or a named outcome — if the transcript has none, a clear specific example or quoted decision is acceptable
   - END with the transferable lesson as a plain declarative sentence any professional can apply
   - It must read like a strong LinkedIn post draft, not a note-to-self or internal summary

   ACCURACY — stay faithful to the transcript:
   - Only use numbers, claims, and outcomes that are explicitly in the transcript — do not invent or sharpen vague figures
   - If the transcript says "a lot" or "significant", mirror that qualifier — do not convert it to a specific number
   - If a detail is ambiguous, use softening language ("roughly", "around") rather than skipping the signal entirely
   - Do not add context or examples that did not appear in the transcript
   - Only reject on accuracy grounds if the signal would actively mislead — vagueness alone is not a reason to reject

   QUALITY GATE — reject the signal only if:
   - It makes no sense without knowing who these people are or what the meeting was about (even after generalising)
   - It is purely a status update or logistics note with zero transferable lesson ("We decided to launch in Q3" → reject)
   - A reader would ask "so what?" AND there is no way to anchor it to anything specific from the transcript

AUTHORS AND THEIR CONTENT ANGLES:
${authorBlock || `Any role from: ${fallbackRoles.join(", ")}`}

${frameworks.length ? `AVAILABLE FRAMEWORKS — pick the ONE that best fits how this specific insight should be structured. Choose based on the insight's nature, not randomly:
${frameworks.map((f) => `- ${f.name}: ${f.description}`).join("\n")}` : ""}

Output format — use exactly this structure for each signal:
POST 1:
TITLE: [punchy 6–10 word hook title that captures the core insight — no fluff]
[3–6 sentence raw insight paragraph per Phase 2 rules above — opens with the surprise, includes a concrete anchor, ends with a plain lesson. Use emojis only where they genuinely punctuate a point — not decorative, not forced.]
HASHTAGS: [3–5 relevant hashtags, comma-separated, no # symbol — e.g. leadership, b2bsales, startups]
RECOMMENDED_FOR: [author role]
CONTENT_ANGLE: [the specific content angle this maps to]
FRAMEWORK: [exact framework name from the list above that best fits this insight — must match exactly]
SOURCE_QUOTE: [exact 1–2 sentences from the transcript that anchor this insight]

POST 2:
TITLE: [hook title]
[raw insight paragraph]
HASHTAGS: [hashtags]
RECOMMENDED_FOR: [author role]
CONTENT_ANGLE: [content angle]
FRAMEWORK: [framework name or blank]
SOURCE_QUOTE: [verbatim quote]

(Up to ${SIGNALS_PER_CHUNK} signals. Omit any that don't pass Phase 1. Quality over quantity.)

-------------------------------------
TRANSCRIPT${chunkLabel.toUpperCase()}:
${chunk}
-------------------------------------`;

  const chunks = chunkTranscript(transcript);
  const totalChunks = chunks.length;

  const rawResults = await Promise.all(
    chunks.map((chunk, i) => {
      const label = totalChunks > 1 ? ` (part ${i + 1} of ${totalChunks})` : "";
      return textCall({
        maxTokens: 5000,
        temperature: 0.7,
        system: systemPrompt,
        user: buildUserPrompt(chunk, label),
      });
    }),
  );

  rawResults.forEach((raw, i) => {
    console.log(`[generateSignals] chunk ${i + 1} raw response (first 500 chars):`, raw.slice(0, 500));
  });
  const allSignals = rawResults.flatMap(parseSignals);
  console.log(`[generateSignals] total parsed signals before dedup: ${allSignals.length}`);
  return deduplicateAndRank(allSignals);
}

/* ---------- framework selection ---------- */

export async function selectBestFramework(
  signalContent: string,
  frameworks: { id: number; name: string; description: string; bestFor: string[] | null }[]
): Promise<number | null> {
  if (!frameworks.length) return null;
  const list = frameworks.map((f) => `- ${f.name}: ${f.description}${f.bestFor?.length ? ` (best for: ${f.bestFor.join(", ")})` : ""}`).join("\n");
  const raw = await textCall({
    maxTokens: 100,
    temperature: 0.2,
    system: `You are a LinkedIn content strategist. Given a signal (raw insight) and a list of post frameworks, pick the single framework that will make this insight hit hardest on LinkedIn. Consider the nature of the content — story, lesson, list, contrast, how-to, opinion — and match it to the framework built for that type.`,
    user: `SIGNAL:\n${signalContent}\n\nFRAMEWORKS:\n${list}\n\nReply with ONLY the exact framework name that best fits this signal. Nothing else.`,
  });
  const name = raw.trim().replace(/^["'-]|["'-]$/g, "");
  const match = frameworks.find((f) => f.name.toLowerCase() === name.toLowerCase());
  return match?.id ?? null;
}

/* ---------- author-aware recommendation ---------- */

export async function recommendForAuthor(
  signalContent: string,
  author: {
    name: string;
    role: string | null;
    voiceProfile: string | null;
    preferredFrameworkNames: string[];
  },
  frameworks: { id: number; name: string; description: string }[],
  authorAngles: string[]
): Promise<{ frameworkId: number | null; angle: string | null }> {
  if (!frameworks.length && !authorAngles.length) return { frameworkId: null, angle: null };

  const frameworkList = frameworks.length
    ? frameworks.map((f) => `- ${f.name}: ${f.description}`).join("\n")
    : "(none)";
  const angleList = authorAngles.length
    ? authorAngles.map((a) => `- ${a}`).join("\n")
    : "(none)";
  const profileSection = [
    author.role ? `Role: ${author.role}` : "",
    author.voiceProfile ? `Voice profile:\n${author.voiceProfile}` : "",
    author.preferredFrameworkNames.length
      ? `Preferred frameworks: ${author.preferredFrameworkNames.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await textCall({
    maxTokens: 150,
    temperature: 0.2,
    system: `You are a LinkedIn content strategist. Given a signal, an author profile, their content angles, and available frameworks — choose the single best framework and single best content angle for this author and signal.
Return ONLY valid JSON: { "framework": "<exact framework name or null>", "angle": "<exact angle name or null>" }`,
    user: `AUTHOR: ${author.name}
${profileSection}

AVAILABLE FRAMEWORKS:
${frameworkList}

AUTHOR'S CONTENT ANGLES:
${angleList}

SIGNAL:
${signalContent.slice(0, 1000)}

Return JSON only.`,
  });

  let parsed: { framework?: string | null; angle?: string | null } = {};
  try {
    parsed = extractJson<typeof parsed>(raw);
  } catch { /* degrade gracefully */ }

  const frameworkId = parsed.framework
    ? (frameworks.find((f) => f.name.toLowerCase() === (parsed.framework ?? "").toLowerCase())?.id ?? null)
    : null;
  const angle =
    typeof parsed.angle === "string" && parsed.angle.trim() ? parsed.angle.trim() : null;

  return { frameworkId, angle };
}

/* ---------- framework reformat ---------- */

export async function reformatPostWithFramework(
  content: string,
  framework: { name: string; description: string; promptTemplate: string; bestFor: string[] | null }
): Promise<string> {
  const bestForLine = framework.bestFor?.length
    ? `Best used for: ${framework.bestFor.join(", ")}`
    : "";

  return textCall({
    maxTokens: 2000,
    temperature: 0.4,
    system: `${GLOBAL_RULES}

You are also a master of LinkedIn post structure and formatting frameworks.
When reformatting a post, your job is to surgically restructure it — not rewrite it.
The voice, specific details, numbers, insights, emojis, and hashtags must all survive intact.
Only the architecture changes. The result must feel like the same author wrote it in a different structure.`,
    user: `## FRAMEWORK TO APPLY
Name: ${framework.name}
Description: ${framework.description}
${bestForLine}

### Framework instructions:
${framework.promptTemplate}

---

## ORIGINAL POST
${content}

---

## YOUR TASK
Restructure the post above using the "${framework.name}" framework. Follow this process:

1. IDENTIFY the core insight, hook, story beats, and CTA in the original
2. MAP each element to the framework's structure
3. REWRITE the layout only — preserve every specific detail, number, outcome, emoji, and hashtag
4. FORMAT for LinkedIn: short punchy lines, strategic white space, no walls of text
5. HOOK must be stronger than the original — lead with the most compelling line

RULES:
- Do NOT invent new facts, claims, or examples
- Do NOT remove any specific insight, number, or result from the original
- Do NOT add generic filler sentences
- Match the original author's tone and vocabulary
- If the framework has a specific line count or section structure, follow it precisely

Return ONLY the reformatted post. No labels, no explanations, no commentary.`,
  });
}

/* ---------- post generation ---------- */

export type GeneratePostInput = {
  signalRawContent: string;
  contentAngle: string;
  suggestedHashtags?: string[];
  author: {
    name: string;
    role: string | null;
    bio: string | null;
    voiceProfile: string | null;
    styleNotes: string | null;
  };
  framework: { name: string; promptTemplate: string };
  topPerformingHooks?: string[];
};

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const { author, framework, topPerformingHooks = [] } = input;

  const voiceSection = author.voiceProfile
    ? `\nLEARNED VOICE — match this precisely:\n${author.voiceProfile}`
    : "";
  const hooksSection = topPerformingHooks.length
    ? `\nTOP-PERFORMING HOOKS from ${author.name}'s past posts (study the rhythm and style):\n${topPerformingHooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "";
  const bioSection = [
    author.bio ? `Bio: ${author.bio}` : "",
    author.role ? `Role: ${author.role}` : "",
    author.styleNotes ? `Style notes: ${author.styleNotes}` : "",
  ].filter(Boolean).join("\n");

  return textCall({
    maxTokens: 2000,
    temperature: 0.85,
    system: `You are the world's most in-demand LinkedIn ghostwriter. You write posts that hit 100k+ impressions not through tricks, but because they make the reader feel like you read their mind.

Your core belief: every great LinkedIn post is a transfer of hard-won experience into someone else's life in under 3 minutes.

THE ANATOMY OF A VIRAL LINKEDIN POST (follow this structure):

━━━ LINE 1: THE HOOK ━━━
The entire post lives or dies here. 8–14 words max. Choose one type:
  → Bold claim: "Most [X]s get [Y] completely wrong."
  → Surprising stat: "We [action] and [unexpected result] happened."
  → Pattern interrupt: "[Common belief] is a lie I believed for [timeframe]."
  → Specific paradox: "The [adjective] thing we did also [unexpected outcome]."

Rules for the hook: No emoji. No "I'm excited to". No "In today's world". No corporate jargon. Raw, direct, specific.

━━━ BODY: THE STORY ━━━
Write like you're texting a smart friend after a long day — honest, a little raw, specific.
Sections (use relevant emojis ONLY at section breaks, never mid-sentence):
  💡 The non-obvious insight — the thing that surprised even you
  📊 The proof — exact numbers, quotes, or outcomes (ONLY from the source signal — never fabricate)
  ✅ or 🎯 The lesson — one transferable takeaway, personal not preachy

Approved emojis: 💡 📊 ⚠️ ✅ 🎯 🔑 📈 🚨 🧠 💬 📉 🏆
Max 4 emojis per post. Hook line: no emoji.

━━━ CLOSING: THE CTA ━━━
One line that earns engagement. Options:
  → Specific question tied to the story ("What's your version of this mistake?")
  → Open observation that invites response
  → A line that just hangs there and makes them think

NEVER: "What do you think?" / "Drop a comment" / "Let me know your thoughts"

━━━ HASHTAGS ━━━
3–5 hashtags on their own line at the very end. Mix broad (#leadership) with specific (#b2bsales #productgrowth). No hashtag stuffing.

━━━ FORMAT RULES ━━━
- Every single line: 12 words max — cut everything that doesn't earn its place
- Blank line between each block
- 220–340 words total
- No bullet lists, no bold, no markdown, no headers
- Short paragraphs (2–3 lines per block max)
- Read it aloud — if it sounds like a press release, rewrite it
- Sound like the AUTHOR wrote it, not an AI

━━━ CONTENT ANGLE ━━━
The content angle is not a tag — it's the ENTIRE LENS through which this post is written. Every sentence should serve this angle. If the angle is "leadership mistakes", the post should ONLY be about a leadership mistake, told from that specific perspective.

━━━ FORBIDDEN PHRASES ━━━
"Excited to share" / "Game-changer" / "Leverage" / "Synergy" / "Pivot" / "In today's landscape" / "It's no secret" / "At the end of the day" / "Circle back" / "Move the needle" / "Deep dive" / "Unpack"`,

    user: `━━━ AUTHOR ━━━
Name: ${author.name}
${bioSection}${voiceSection}${hooksSection}

━━━ FRAMEWORK: ${framework.name} ━━━
Apply this framework to shape the post's structure and flow:
${framework.promptTemplate}

━━━ CONTENT ANGLE ━━━
Write the ENTIRE post through this specific lens: ${input.contentAngle}
Every sentence must serve this angle. This is not a tag — it's the perspective.

━━━ SOURCE SIGNAL ━━━
This is your ONLY source of truth. Do NOT fabricate any claims, numbers, or events beyond what's here:
"""
${input.signalRawContent}
"""
${input.suggestedHashtags?.length ? `\n━━━ HASHTAG SUGGESTIONS ━━━\nInclude these in the hashtag line at the end (add or replace only if a better fit exists): ${input.suggestedHashtags.map(h => `#${h}`).join(" ")}` : ""}
Write ONE complete LinkedIn post. Return ONLY the post text — no explanations, no labels, no preamble.`,
  });
}

/* ---------- assisted edits ---------- */

export async function assistedEdit(
  currentText: string,
  instruction: string,
  author?: { voiceProfile: string | null }
): Promise<string> {
  const voice = author?.voiceProfile
    ? `\nAuthor voice to preserve:\n${author.voiceProfile}`
    : "";
  return textCall({
    maxTokens: 1500,
    temperature: 0.6,
    system: `${GLOBAL_RULES}

You edit LinkedIn posts. Make only the specific change requested. Preserve the author's voice. Do NOT rewrite anything outside the instruction scope. Return only the edited post text.`,
    user: `Instruction: ${instruction}${voice}

Current post:
"""
${currentText}
"""

Return the edited post only.`,
  });
}

/* ---------- scoring ---------- */

export async function scorePost(text: string): Promise<{
  hookStrength: number;
  specificity: number;
  clarity: number;
  emotionalResonance: number;
  callToAction: number;
  notes: string;
}> {
  const raw = await textCall({
    maxTokens: 600,
    temperature: 0.2,
    system: `${GLOBAL_RULES}

STEP 3 — Post Scoring:

You are a brutal LinkedIn content editor. Score 0-100 on five dimensions. Most posts score 20-50. Only truly exceptional content earns above 70. Be harsh.

- hook_strength: Do the first 1-2 lines FORCE a scroll-stop? Must be specific, surprising, or create real tension. "I learned something important" = 5. Generic openers, questions starting with "Have you ever", motivational fluff = under 15. Only a genuinely arresting first line earns above 60.
- specificity: Concrete numbers, real names, exact moments, measurable outcomes = high. Any vague language, abstract claims, or "many people" constructions = deduct heavily. A post with zero hard specifics = under 20.
- clarity: Is the single main point crystal clear within 5 seconds? Jargon, hedging, meandering = low. Conflicting messages = under 20. Perfect clarity = 80+.
- emotional_resonance: Does it provoke a genuine reaction — curiosity, recognition, surprise, empathy? Flat, informational, or transactional posts score under 25. Real emotional punch = 70+.
- call_to_action: Does it compel engagement with a strong close? Posts that just trail off = under 15. Weak "let me know" = under 30. A post that earns its ask = 60+.

Default to skepticism. A mediocre post that does nothing special should average 25-35. Reserve 70+ for work that genuinely stands out. Penalize AI-sounding language, empty inspiration, and corporate speak aggressively.

Return ONLY valid JSON: { "hook_strength": <int>, "specificity": <int>, "clarity": <int>, "emotional_resonance": <int>, "call_to_action": <int>, "notes": "one blunt sentence of feedback" }`,
    user: `Post:\n"""${text}"""`,
  });
  const parsed = extractJson<{
    hook_strength: number;
    specificity: number;
    clarity: number;
    emotional_resonance: number;
    call_to_action: number;
    notes: string;
  }>(raw);
  const clamp = (v: number | undefined) => Math.max(0, Math.min(100, v ?? 0));
  return {
    hookStrength: clamp(parsed.hook_strength),
    specificity: clamp(parsed.specificity),
    clarity: clamp(parsed.clarity),
    emotionalResonance: clamp(parsed.emotional_resonance),
    callToAction: clamp(parsed.call_to_action),
    notes: parsed.notes ?? "",
  };
}

/* ---------- post refinement (Stage 4) ---------- */

export async function refinePost(
  draft: string,
  voiceProfile?: string | null
): Promise<string> {
  const voiceSection = voiceProfile
    ? `\nAuthor voice to preserve:\n${voiceProfile}`
    : "";
  return textCall({
    maxTokens: 1800,
    temperature: 0.5,
    system: `${GLOBAL_RULES}

You are a LinkedIn post editor running a final quality pass. Make the post undeniably human. Return only the revised post text — no explanations.

PASS CHECKLIST (in order):
1. HOOK: If the first line starts with "I", "We", or any generic opener — rewrite it. The hook must be arresting in under 14 words.
2. AI TONE: Find and replace every phrase that sounds generated. Hard blocklist: "delve into", "it's worth noting", "foster", "leverage", "streamline", "game-changer", "in today's landscape", "at the end of the day", "move the needle", "circle back", "deep dive", "unpack", "excited to share", "pivotal", "paradigm", "unlock potential", "transformative".
3. RHYTHM: Vary sentence length. A wall of 10-word lines is as robotic as a wall of 30-word lines. Break long lines. Let short lines breathe.
4. REDUNDANCY: Cut any sentence that restates something already said. One point per post.
5. ENDING: The last line must land with quiet weight — not inspiration-poster weight. If it sounds like a fortune cookie, rewrite it.

Only fix what fails a check. Do not rewrite the whole post. Do not add new information.`,
    user: `Refine this post:${voiceSection}

"""
${draft}
"""

Return only the refined post text.`,
  });
}

/* ---------- performance-driven learning ---------- */

export type TopPostSample = {
  content: string;
  contentAngle: string | null;
  frameworkName: string | null;
  hookLine: string;
  impressions: number;
  likes: number;
  comments: number;
};

export async function learnFromPerformance(
  authorName: string,
  topPosts: TopPostSample[],
  currentHints: string | null
): Promise<string> {
  if (topPosts.length === 0) return currentHints ?? "";

  const postBlock = topPosts
    .map((p, i) => {
      const eng = `${p.impressions} impressions, ${p.likes} likes, ${p.comments} comments`;
      return `--- Post ${i + 1} [${eng}] ---
Angle: ${p.contentAngle ?? "unspecified"}
Framework: ${p.frameworkName ?? "unspecified"}
Hook: ${p.hookLine}
Content:
${p.content}`;
    })
    .join("\n\n");

  return textCall({
    maxTokens: 800,
    temperature: 0.3,
    system: `${GLOBAL_RULES}

You analyze top-performing LinkedIn posts to extract reusable patterns that improve future content generation. Output a concise, actionable hints block — plain text, 6–12 bullet rules, under 250 words. Each rule must be specific, directly applicable, and derived from the actual post data. No preamble, no headers, no markdown.`,
    user: `Author: ${authorName}

Current hints (may be empty or outdated):
"""
${currentHints ?? "(none)"}
"""

Top-performing posts (sorted by engagement):
${postBlock}

Analyze what these posts have in common that drives high engagement. Extract rules about:
- Hook patterns and structures that work for this author
- Signal types (metrics, lessons, contrarian claims, etc.) that resonate
- Content angles and frameworks that outperform
- Structural patterns (line length, paragraph rhythm, use of specifics)
- What the audience responds to most

Merge with current hints where still valid. Drop anything contradicted by new data. Return the updated hints block only.`,
  });
}

/* ---------- voice-profile learning ---------- */

export async function learnVoiceFromEdits(
  currentProfile: string | null,
  pairs: { before: string; after: string; instruction?: string }[]
): Promise<string> {
  const edits = pairs
    .map(
      (p, i) =>
        `--- Edit ${i + 1} ---\n${p.instruction ? `Instruction: ${p.instruction}\n` : ""}BEFORE:\n${p.before}\n\nAFTER:\n${p.after}`
    )
    .join("\n\n");
  return textCall({
    maxTokens: 1200,
    temperature: 0.3,
    system: `${GLOBAL_RULES}

STEP 4 — Voice Profile:

Analyze the differences between original and edited posts. Build a concise, actionable voice profile.

Focus on: sentence length, tone, structure, word choice, formatting patterns.

Output: plain text, 5–10 bullet-style rules, under 200 words.
No preamble. No markdown headers. Each rule must be concrete and directly applicable.

Example style:
- Uses short sentences (under 12 words)
- Starts with a bold or contrarian hook
- Avoids filler words and adjectives
- Breaks lines frequently for readability`,
    user: `Current profile (may be empty):
"""
${currentProfile ?? "(none yet)"}
"""

Recent edits:
${edits}

Update the profile. Merge with current where relevant, drop anything contradicted by new edits.`,
  });
}

/* ---------- linkedin post analysis ---------- */

export type LinkedinProfileAnalysis = {
  contentAngles: string[];
  preferredFrameworkNames: string[];
  voiceProfile: string;
  styleNotes: string;
};

/* ---------- linkedin profile research agent ---------- */

/**
 * Uses Claude as an agent with the web_search tool to autonomously research
 * a LinkedIn profile and extract content angles, voice profile, style notes,
 * and preferred frameworks. No scraping required — Claude does the research.
 */
export async function researchLinkedinProfileWithAgent(
  linkedinUrl: string,
  availableFrameworks: { name: string; description: string }[],
): Promise<LinkedinProfileAnalysis> {
  const anthropic = client();
  const frameworkList = availableFrameworks
    .map((f) => `• ${f.name}: ${f.description}`)
    .join("\n");

  const vanity = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? "";
  const personName = vanity ? vanity.replace(/-/g, " ") : "this person";

  const system = `You are a writing coach and ghostwriter analyst with web research capability.

Your job: research a LinkedIn profile and any publicly available posts/content by the person, then build a precise writing profile that an AI can use to replicate their voice.

Use the web_search tool to find:
1. The person's LinkedIn profile information (their headline, bio, role)
2. Their LinkedIn posts (search for quotes, post titles, reposts, mentions)
3. Articles, interviews, podcasts, or talks they have done
4. Any public writing samples (blog posts, Substack, X/Twitter)

Run as many searches as you need (up to 5). Be specific in your queries — search for the person's name + topic combinations to find their actual writing.

After research, return ONLY a JSON object — no explanation, no markdown fences. Output format strictly:
{
  "contentAngles": ["angle1", "angle2", ...],
  "preferredFrameworkNames": ["Framework Name"],
  "voiceProfile": "bullet rules separated by newlines",
  "styleNotes": "1-2 sentence summary"
}`;

  const user = `Research this LinkedIn profile and build a writing profile for ${personName}:

PROFILE URL: ${linkedinUrl}

━━━ AVAILABLE FRAMEWORKS ━━━
Match the author's natural post structure to one or more of these:
${frameworkList}

━━━ FIELD INSTRUCTIONS ━━━

contentAngles — 3 to 8 specific narrow topics they ACTUALLY write about (derived from real posts, not job titles).
Bad: "leadership", "business"
Good: "scaling a bootstrapped SaaS", "Arab women in fintech", "founder delegation"

preferredFrameworkNames — 1 to 3 framework names from the list above that match their natural post structure.

voiceProfile — 6 to 10 bullet rules, newline-separated. Cover hook style, sentence length, paragraph length, use of numbers, rhetorical questions, personal pronouns, storytelling vs advice ratio, signature phrases. Each rule must be specific and immediately applicable.

styleNotes — exactly 1-2 sentences describing what makes this author's writing recognisable.

If you cannot find enough public content to confidently build a profile, return empty arrays/strings rather than guessing. Quality over completeness.

Return ONLY the JSON object.`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
      });

      // Find the final text block (after any tool_use/tool_result rounds)
      const textBlock = [...msg.content].reverse().find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
      if (!textBlock?.text) {
        if (attempt === 0) continue;
        return { contentAngles: [], preferredFrameworkNames: [], voiceProfile: "", styleNotes: "" };
      }

      let parsed: Partial<LinkedinProfileAnalysis> = {};
      try {
        parsed = extractJson<LinkedinProfileAnalysis>(textBlock.text);
      } catch {
        if (attempt === 0) continue;
      }

      return {
        contentAngles: Array.isArray(parsed.contentAngles) ? parsed.contentAngles : [],
        preferredFrameworkNames: Array.isArray(parsed.preferredFrameworkNames) ? parsed.preferredFrameworkNames : [],
        voiceProfile: parsed.voiceProfile ?? "",
        styleNotes: parsed.styleNotes ?? "",
      };
    } catch (err: any) {
      lastErr = err;
      if (err?.status && err.status < 500 && err.status !== 429) throw err;
    }
  }
  throw lastErr;
}

/* ---------- linkedin page scrape analysis ---------- */

export async function analyzeLinkedinPageContent(
  scrapedText: string,
  availableFrameworks: { name: string; description: string }[]
): Promise<LinkedinProfileAnalysis> {
  const frameworkList = availableFrameworks
    .map((f) => `• ${f.name}: ${f.description}`)
    .join("\n");

  const raw = await textCall({
    maxTokens: 2000,
    temperature: 0.2,
    system: `You are a writing coach and ghostwriter analyst. Your job is to read LinkedIn posts written by a specific author and extract a precise, actionable writing profile that an AI can use to replicate their voice.

You receive raw scraped text from a LinkedIn profile and recent activity page. The text contains noise: UI labels, reaction counts, timestamps, navigation text. Ignore all of that. Focus exclusively on the actual post bodies — the paragraphs of written content the author published.

Return ONLY valid JSON. No explanation, no markdown, no preamble.`,
    user: `Read every post in the scraped LinkedIn content below and build a writing profile for this author.

━━━ AVAILABLE FRAMEWORKS ━━━
Match the author's natural post structure to one or more of these:
${frameworkList}

━━━ SCRAPED LINKEDIN CONTENT ━━━
${scrapedText.slice(0, 32000)}

━━━ OUTPUT ━━━
Return this exact JSON shape and nothing else:
{
  "contentAngles": ["angle1", "angle2", ...],
  "preferredFrameworkNames": ["Framework Name"],
  "voiceProfile": "bullet rules here",
  "styleNotes": "summary sentence here"
}

Field instructions:

contentAngles — 3 to 8 strings.
Each must be a specific, narrow topic this author ACTUALLY posts about.
Bad: "leadership", "business", "marketing"
Good: "scaling a bootstrapped SaaS", "cold outreach for B2B founders", "remote team culture"
Derive only from the posts themselves, not from job titles or buzzwords.

preferredFrameworkNames — 1 to 3 names, chosen from the AVAILABLE FRAMEWORKS list above.
Read how the author structures their posts: where is the hook, how do they build tension, how do they close?
Match that pattern to the closest framework(s). Use the exact name from the list.

voiceProfile — a newline-separated list of 6 to 10 bullet rules.
Each rule must be specific enough that a writer could apply it immediately.
Cover: hook style, sentence length, paragraph length, use of numbers/stats, rhetorical questions, personal pronouns, storytelling vs. advice ratio, how they open, how they close, any signature phrases or patterns.
Examples of good rules:
• Opens with a one-sentence hook that states an outcome or a counterintuitive claim
• Uses short paragraphs — 1 to 2 sentences each, never more than 3
• Includes at least one specific number or percentage per post
• Ends with a direct question addressed to the reader
• Uses "I" not "we" — first-person singular throughout
• No bullet lists in posts — everything is flowing prose
Under 280 words total.

styleNotes — exactly 1 to 2 sentences.
Describe what makes this author's writing recognisable and distinctive in a way that separates them from generic LinkedIn content.`,
  });

  let parsed: Partial<LinkedinProfileAnalysis> = {};
  try { parsed = extractJson<LinkedinProfileAnalysis>(raw); } catch { /* keep empty */ }
  return {
    contentAngles: Array.isArray(parsed.contentAngles) ? parsed.contentAngles : [],
    preferredFrameworkNames: Array.isArray(parsed.preferredFrameworkNames) ? parsed.preferredFrameworkNames : [],
    voiceProfile: parsed.voiceProfile ?? "",
    styleNotes: parsed.styleNotes ?? "",
  };
}

/* ---------- design brief ---------- */

export type DesignBriefOutput = {
  objective: string;
  targetAudience: string;
  tone: string;
  keyMessages: string[];
  designDirection: string;
  svg: string;
};

export async function generateDesignBrief(
  postText: string,
  authorName: string
): Promise<DesignBriefOutput> {
  const raw = await textCall({
    maxTokens: 3000,
    temperature: 0.5,
    system: `You create design briefs for LinkedIn post carousels/images. You also output a simple, clean SVG mock the designer can iterate on. The SVG must be 1080x1080, use at most 3 colors, minimal text (the hook only), and be valid XML.

Return ONLY valid JSON in this shape:
{
  "objective": "...",
  "targetAudience": "...",
  "tone": "...",
  "keyMessages": ["...", "..."],
  "designDirection": "one paragraph describing layout, typography, imagery",
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 1080'>...</svg>"
}`,
    user: `Author: ${authorName}

Post:
"""
${postText}
"""

Return JSON only.`,
  });
  return extractJson<DesignBriefOutput>(raw);
}
