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
};

export async function generatePostsFromTranscript(
  transcript: string,
  authors: AuthorContext[],
): Promise<GeneratedSignal[]> {
  const authorBlock = authors
    .filter((a) => a.contentAngles.length > 0)
    .map((a) => {
      const angles = a.contentAngles.join(", ");
      const frameworks = a.preferredFrameworkNames.length
        ? `Preferred frameworks: ${a.preferredFrameworkNames.join(", ")}.`
        : "";
      const voice = a.voiceProfile
        ? `Voice profile:\n${a.voiceProfile}`
        : "";
      return `AUTHOR: ${a.role}\nContent angles: ${angles}\n${frameworks}\n${voice}`.trim();
    })
    .join("\n\n---\n\n");

  const fallbackRoles = authors.map((a) => a.role).filter(Boolean);

  const raw = await textCall({
    maxTokens: 5000,
    temperature: 0.7,
    system: `${GLOBAL_RULES}

TRANSCRIPT LANGUAGE & QUALITY (critical — read before processing):
- The transcript may be in Arabic, English, or a mix of both. Process any language faithfully.
- Arabic transcription is often noisy. Errors include: wrong homophones, missing short vowels, garbled proper nouns, run-on words, and speaker-label mistakes. Use surrounding context to infer the true meaning — do not discard a segment just because individual words look wrong.
- Arabic speakers frequently use English technical or business terms but pronounce them in Arabic, so they appear in Arabic script (e.g., "ميتنج" = meeting, "بريزنتيشن" = presentation, "ديدلاين" = deadline, "فيدباك" = feedback, "تارجت" = target, "كلاينت" = client, "ريفينيو" = revenue, "بيتشينج" = pitching, "أونبوردينج" = onboarding, "ستريتيجي" = strategy, "ماركيتنج" = marketing, "فريلانس" = freelance, "أوفر" = offer, "ديل" = deal). Recognise these phonetic Arabic spellings and treat them as their English equivalents when extracting insights.
- If a number, metric, or key claim is partially garbled, note the closest plausible reading and still include the insight — flag uncertainty only if the meaning is truly ambiguous.
- Always write the OUTPUT in fluent English regardless of the transcript language.`,
    user: `You are extracting high-value content signals from a meeting transcript. A signal is a specific, real, shareable insight — not a topic, not a vague theme.

PHASE 1 — MINE THE TRANSCRIPT FOR GENUINE VALUE
Scan for moments that are actually worth sharing publicly. A moment qualifies only if it contains at least one of:
- A real decision made and WHY (the reasoning that others rarely share)
- A counterintuitive lesson — something that contradicts conventional advice
- A concrete outcome with real numbers, timelines, or before/after evidence
- A process or framework the team actually uses — specific, not theoretical
- A mistake or failure and what it revealed
- A strong, defensible opinion on something people argue about

REJECT: small talk, status updates, vague plans, obvious statements, anything without a specific detail anchoring it.

If nothing meets this bar → return 0 signals. Never manufacture content to fill space.

PHASE 2 — MATCH TO THE RIGHT AUTHOR AND ANGLE
For each qualified moment:
1. Pick the author whose content angles genuinely match the insight — don't force a match
2. Identify the exact content angle it maps to
3. Extract the core insight as a raw, honest paragraph (3–6 sentences) — write it from the author's perspective, grounded entirely in what was said. Include specific details, numbers, or context from the transcript. This is a working note, not a polished post.

AUTHORS AND THEIR CONTENT ANGLES:
${authorBlock || `Any role from: ${fallbackRoles.join(", ")}`}

Output format — use exactly this structure for each signal:
POST 1:
TITLE: [punchy 6–10 word hook title that captures the core insight — no fluff]
[3–6 sentence raw insight paragraph, written from author's perspective, using only facts from the transcript — specific, grounded, honest. Use emojis only where they genuinely punctuate a point — not decorative, not forced. Some signals need none, others need two or three. Let the content decide. This becomes the source material for a LinkedIn post.]
HASHTAGS: [3–5 relevant hashtags, comma-separated, no # symbol — e.g. leadership, b2bsales, startups]
RECOMMENDED_FOR: [author role]
CONTENT_ANGLE: [the specific content angle this maps to]
FRAMEWORK: [recommended framework name, or leave blank]
SOURCE_QUOTE: [exact 1–2 sentences from the transcript that anchor this insight]

POST 2:
TITLE: [hook title]
[raw insight paragraph with 1–2 emojis]
HASHTAGS: [hashtags]
RECOMMENDED_FOR: [author role]
CONTENT_ANGLE: [content angle]
FRAMEWORK: [framework name or blank]
SOURCE_QUOTE: [verbatim quote]

(Up to 5 signals. Omit any that don't pass Phase 1. Quality over quantity.)

-------------------------------------
TRANSCRIPT:
${transcript.slice(0, 40000)}
-------------------------------------`,
  });

  const parts = raw.split(/\bPOST \d+:/i).filter((p) => p.trim().length > 80);
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
      const skipIdxs = new Set([title.idx, rec.idx, angle.idx, framework.idx, quote.idx, hashtagsField.idx].filter((i) => i !== -1));
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

/* ---------- framework reformat ---------- */

export async function reformatPostWithFramework(
  content: string,
  framework: { name: string; promptTemplate: string }
): Promise<string> {
  return textCall({
    maxTokens: 2000,
    temperature: 0.7,
    system: `You are an expert LinkedIn ghostwriter. Reformat the given post to follow a specific writing framework while keeping ALL the original ideas, facts, emojis, and hashtags intact.`,
    user: `Framework: ${framework.name}
Framework instructions: ${framework.promptTemplate}

Reformat the post below to follow this framework exactly.
- Keep every idea, insight, emoji, and hashtag from the original
- Do NOT add new information
- Do NOT remove existing information
- Only restructure the flow and format to match the framework
- Keep LinkedIn short-line style

ORIGINAL POST:
${content}

Return only the reformatted post — no explanations, no labels.`,
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

Score on five LinkedIn-specific dimensions (0-100 each):
- hook_strength: Do the first 1-2 lines stop a scroll? Specific, surprising, tension-inducing = high. Generic, corporate, vague = low.
- specificity: Does the post use concrete numbers, names, moments? Abstraction soup = low.
- clarity: Is the message immediately clear? No jargon, no ambiguity, reader knows exactly what the point is = high.
- emotional_resonance: Does it stir curiosity, empathy, inspiration, or recognition in the reader? Flat and transactional = low.
- call_to_action: Does it compel the reader to engage (comment, share, reflect, act)? Explicit or implicit CTA, strong close = high. Post that just ends = low.

Be critical, not nice. Penalize vagueness heavily.

Return ONLY valid JSON: { "hook_strength": <int>, "specificity": <int>, "clarity": <int>, "emotional_resonance": <int>, "call_to_action": <int>, "notes": "one short sentence of feedback" }`,
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

/* ---------- linkedin page scrape analysis ---------- */

export async function analyzeLinkedinPageContent(
  scrapedText: string,
  availableFrameworks: { name: string; description: string }[]
): Promise<LinkedinProfileAnalysis> {
  const frameworkList = availableFrameworks.map((f) => `- ${f.name}: ${f.description}`).join("\n");

  const raw = await textCall({
    maxTokens: 1500,
    temperature: 0.3,
    system: `${GLOBAL_RULES}

You are analyzing scraped content from a LinkedIn profile page to build a writing profile for an AI ghostwriter.
The input is raw text extracted from the page — it may include navigation, UI elements, and other noise alongside the actual posts and profile info. Focus only on the meaningful content: posts, headlines, bio, and descriptions of their work.`,
    user: `Analyze this LinkedIn page content and return a JSON writing profile.

AVAILABLE FRAMEWORKS (match the author's natural style to one or more):
${frameworkList}

SCRAPED PAGE CONTENT:
${scrapedText.slice(0, 30000)}

Return ONLY valid JSON in this exact shape:
{
  "contentAngles": ["topic1", "topic2", ...],
  "preferredFrameworkNames": ["Framework Name 1", ...],
  "voiceProfile": "5–10 bullet rules describing the author's writing patterns, tone, sentence length, structure. Concrete and actionable.",
  "styleNotes": "1–2 sentence summary of the author's overall style and what makes it distinctive."
}

Rules:
- contentAngles: 3–8 specific topics this author writes about (from their posts and profile — e.g. "B2B sales strategy", "founder lessons", "hiring culture")
- preferredFrameworkNames: 1–3 framework names from the list above that best match how this author naturally structures posts
- voiceProfile: bullet-style rules, under 200 words total, each rule concrete and directly applicable
- styleNotes: plain sentence(s), no bullet points
- If no posts are visible, derive topics from the profile bio, headline, and experience sections`,
  });

  const parsed = extractJson<LinkedinProfileAnalysis>(raw);
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
