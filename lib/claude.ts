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
  rawContent: string;
  recommendedAuthorRole?: string;
  sourceExcerpt?: string;
};

export async function generatePostsFromTranscript(
  transcript: string,
  availableAuthorRoles: string[],
  contentAngles?: string[],
  voiceProfiles?: Record<string, string> // role → voice profile
): Promise<GeneratedSignal[]> {
  const anglesHint = contentAngles?.length
    ? `\nHigh-value content angles present in this team (use as creative inspiration): ${contentAngles.join(", ")}.`
    : "";
  const voiceHint = voiceProfiles && Object.keys(voiceProfiles).length
    ? `\n\nVoice profiles — match these precisely when writing for that role:\n${Object.entries(voiceProfiles).map(([role, profile]) => `${role}:\n${profile}`).join("\n\n")}`
    : "";

  const raw = await textCall({
    maxTokens: 5000,
    temperature: 0.85,
    system: `You are a LinkedIn ghostwriter who writes in a specific, well-defined voice: personal, honest, and reflective. Not trying to inspire — trying to be understood.

The author's style (follow this precisely):
- Opens with a question someone often asks her, a personal confession, or a specific moment — never a corporate claim or shocking stat
- Answers honestly and briefly first, then unpacks the story behind it
- Uses everyday metaphors and real language ("golden handcuffs", "brain fully switched on", "in flow") — not business jargon
- Flows in prose, not bullet points — 2–3 sentences per paragraph, natural rhythm
- The insight lands quietly, not with a hammer — it's the thing that makes a reader pause and nod
- Closes with a specific question directed at a named audience ("Fellow founders who made the leap…") — never generic engagement bait
- Emojis: 1–3 per post, placed at the start of a paragraph break or insight moment — never mid-sentence, never as decoration. The hook line never starts with an emoji.
- Hashtags: 2–4, relevant, at the very end

TRANSCRIPT LANGUAGE & QUALITY (critical — read before processing):
- The transcript may be in Arabic, English, or a mix of both. Process any language faithfully.
- Arabic transcription is often noisy. Errors include: wrong homophones, missing short vowels, garbled proper nouns, run-on words, and speaker-label mistakes. Use surrounding context to infer the true meaning — do not discard a segment just because individual words look wrong.
- Arabic speakers frequently use English technical or business terms but pronounce them in Arabic, so they appear in Arabic script (e.g., "ميتنج" = meeting, "بريزنتيشن" = presentation, "ديدلاين" = deadline, "فيدباك" = feedback, "تارجت" = target, "كلاينت" = client, "ريفينيو" = revenue, "بيتشينج" = pitching, "أونبوردينج" = onboarding, "ستريتيجي" = strategy, "ماركيتنج" = marketing, "فريلانس" = freelance, "أوفر" = offer, "ديل" = deal). Recognise these phonetic Arabic spellings and treat them as their English equivalents when extracting insights.
- If a number, metric, or key claim is partially garbled, note the closest plausible reading and still include the insight — flag uncertainty only if the meaning is truly ambiguous.
- Always write the OUTPUT posts in fluent English regardless of the transcript language.${anglesHint}${voiceHint}`,
    user: `Mine this transcript for 1–3 LinkedIn posts worth publishing. Each post must be built on exactly ONE sharp, specific idea — a real moment, a genuine decision, a counterintuitive lesson, a surprising outcome, a before/after shift.

QUALITY BAR: If the transcript doesn't have strong material, output fewer posts. Never fill space with generic content.

Each post flows like this (not a rigid template — a natural shape):

OPENING — pull the reader into a human moment:
  • A question the author gets asked, a confession, or a specific real moment
  • Conversational, not corporate. First-person or a quote from someone else directed at them.
  • Short — one or two lines maximum.

HONEST ANSWER — brief, direct:
  • Give the real answer first, before the story. Acknowledge complexity if it exists.

THE STORY — context and turning point:
  • What happened, what they thought, what changed. Specific and grounded.
  • Use real details from the transcript — a number, a name, a decision, a moment.
  • This is where the reader earns the insight.

THE INSIGHT — quiet and clear:
  • The non-obvious thing. The thing that changed how they see something.
  • Not preachy. Not a life lesson. Just honest.

CLOSING — specific question to a named audience:
  • One sentence. Directed at a specific group ("Fellow founders…", "Anyone who's been through a pivot…")
  • NEVER: "What do you think?" / "Drop a comment" / "Let me know your thoughts"

#2to4 #relevant #hashtags

FORMATTING:
- Flowing prose, not bullet points or headers
- 2–3 sentences per paragraph, blank line between each block
- Total post: 180–320 words
- No markdown, no bold, no emojis as section markers
- Reads like a person wrote it — honest, direct, a little vulnerable

${availableAuthorRoles.length ? `Output format — use exactly this structure:
POST 1:
[full post text following the structure above]
RECOMMENDED_FOR: [role from: ${availableAuthorRoles.join(", ")}]
SOURCE_QUOTE: [verbatim 1-2 sentences from the transcript that directly inspired this post]

POST 2:
[full post text]
RECOMMENDED_FOR: [role]
SOURCE_QUOTE: [verbatim quote]

POST 3:
[full post text]
RECOMMENDED_FOR: [role]
SOURCE_QUOTE: [verbatim quote]

(Only include posts that clear the quality bar. Omit POST 2 or POST 3 if the transcript doesn't have enough strong material.)` : `Output format — use exactly this structure:
POST 1:
[full post text following the structure above]
SOURCE_QUOTE: [verbatim 1-2 sentences from the transcript that directly inspired this post]

POST 2:
[full post text]
SOURCE_QUOTE: [verbatim quote]

(Only include posts that clear the quality bar.)`}

-------------------------------------
TRANSCRIPT:
${transcript.slice(0, 40000)}
-------------------------------------`,
  });

  const parts = raw.split(/\bPOST \d+:/i).filter((p) => p.trim().length > 80);
  return parts
    .map((part) => {
      const lines = part.trim().split("\n");
      const recIdx = lines.findIndex((l) => /^RECOMMENDED_FOR:/i.test(l.trim()));
      const quoteIdx = lines.findIndex((l) => /^SOURCE_QUOTE:/i.test(l.trim()));
      const recommendedAuthorRole =
        recIdx !== -1 ? lines[recIdx].replace(/^RECOMMENDED_FOR:\s*/i, "").trim() : undefined;
      const sourceExcerpt =
        quoteIdx !== -1 ? lines[quoteIdx].replace(/^SOURCE_QUOTE:\s*/i, "").trim() : undefined;
      const content = lines
        .filter((_, i) => i !== recIdx && i !== quoteIdx)
        .join("\n")
        .trim();
      return { rawContent: content, recommendedAuthorRole, sourceExcerpt };
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

export async function analyzeLinkedinPosts(
  posts: string[],
  availableFrameworks: { name: string; description: string }[]
): Promise<LinkedinProfileAnalysis> {
  const postsBlock = posts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join("\n\n");
  const frameworkList = availableFrameworks.map((f) => `- ${f.name}: ${f.description}`).join("\n");

  const raw = await textCall({
    maxTokens: 1500,
    temperature: 0.3,
    system: `${GLOBAL_RULES}

You are analyzing an author's real LinkedIn posts to build a writing profile for an AI ghostwriter.
Your job is to extract patterns the AI can actually use — not generic observations.`,
    user: `Analyze these LinkedIn posts and return a JSON profile.

AVAILABLE FRAMEWORKS (match the author's natural style to one or more):
${frameworkList}

POSTS:
${postsBlock}

Return ONLY valid JSON in this exact shape:
{
  "contentAngles": ["topic1", "topic2", ...],
  "preferredFrameworkNames": ["Framework Name 1", ...],
  "voiceProfile": "5–10 bullet rules describing the author's writing patterns, tone, sentence length, structure. Concrete and actionable.",
  "styleNotes": "1–2 sentence summary of the author's overall style and what makes it distinctive."
}

Rules:
- contentAngles: 3–8 specific topics this author writes about (e.g. "B2B sales strategy", "founder lessons", "hiring culture")
- preferredFrameworkNames: 1–3 framework names from the list above that best match how this author naturally structures posts
- voiceProfile: bullet-style rules, under 200 words total, each rule concrete and directly applicable
- styleNotes: plain sentence(s), no bullet points`,
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
