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
};

export async function generatePostsFromTranscript(
  transcript: string,
  availableAuthorRoles: string[],
  contentAngles?: string[],
  voiceProfiles?: Record<string, string> // role → voice profile
): Promise<GeneratedSignal[]> {
  const anglesHint = contentAngles?.length
    ? `\nContent angles to focus on (use these as inspiration if relevant): ${contentAngles.join(", ")}.`
    : "";
  const authorHint = availableAuthorRoles.length
    ? `\nAvailable author roles: ${availableAuthorRoles.join(", ")}. After each post, add exactly one line: RECOMMENDED_FOR: [role] — pick the role whose audience best fits the post.`
    : "";
  const voiceHint = voiceProfiles && Object.keys(voiceProfiles).length
    ? `\n\nLearned voice profiles per author (match these closely when writing for that role):\n${Object.entries(voiceProfiles).map(([role, profile]) => `${role}: ${profile}`).join("\n")}`
    : "";

  const raw = await textCall({
    maxTokens: 4000,
    temperature: 0.8,
    system: `You are a top-tier LinkedIn ghostwriter known for posts that go viral because they feel real, punchy, and genuinely useful.${anglesHint}${voiceHint}`,
    user: `Read this meeting transcript and turn it into 1–3 LinkedIn posts that people actually stop scrolling for.

Each post MUST:
- Be built on ONE sharp idea from the transcript (a metric, a mistake, a contrarian take, a real quote, a surprising insight)
- Skip anything generic, obvious, or vague
- Feel like it came from a real person — not a consultant

Structure every post like this:
1. 🔥 Hook — 1 punchy line that makes someone stop (question, bold claim, or unexpected stat)
2. Short setup — 1–2 lines of context
3. The real insight — what happened, what was learned, what surprised you
4. Proof — a number, a quote, a specific example
5. Takeaway — one clear "so what" the reader can use

Formatting rules:
- Use emojis at the START of key lines to create visual rhythm (e.g. 💡 for insight, 📉 for a problem, ✅ for a win, ⚠️ for a warning) — but only where they genuinely fit
- Short lines — max 10 words each, LinkedIn style
- Add one blank line between each section
- End with 3–5 relevant hashtags on their own line
- No bullet lists — flowing short paragraphs only
- Make it feel worth saving and sharing

${availableAuthorRoles.length ? `Output format — use exactly this:
POST 1:
[post text]
RECOMMENDED_FOR: [role]

POST 2:
[post text]
RECOMMENDED_FOR: [role]

(Only include posts that are genuinely valuable. Omit POST 2 or POST 3 if the transcript doesn't have enough strong material.)` : `Output format — use exactly this:
POST 1:
[post text]

POST 2:
[post text]

(Only include posts that are genuinely valuable.)`}
${authorHint}

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
      const recommendedAuthorRole =
        recIdx !== -1
          ? lines[recIdx].replace(/^RECOMMENDED_FOR:\s*/i, "").trim()
          : undefined;
      const content = lines
        .filter((_, i) => i !== recIdx)
        .join("\n")
        .trim();
      return { rawContent: content, recommendedAuthorRole };
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
    ? `\nLearned voice (match this closely):\n${author.voiceProfile}`
    : "";
  const hooksSection = topPerformingHooks.length
    ? `\nTop-performing hooks from this author's past posts:\n- ${topPerformingHooks.join("\n- ")}`
    : "";
  return textCall({
    maxTokens: 1500,
    temperature: 0.8,
    system: `${GLOBAL_RULES}

STEP 2 — Post Generation:

Write ONE LinkedIn post using ONE signal. Follow this structure:
1. Hook — pattern interrupt, surprising, or specific (first line must stop the scroll)
2. Context — what happened
3. Insight — what most people get wrong
4. Takeaway — clear, practical lesson

STRICT RULES:
- Plain text only — no JSON, no title, no explanation, no markdown
- 120–220 words
- Short punchy paragraphs, generous white space
- No buzzwords, no corporate tone
- No emojis unless the author's style explicitly uses them
- No hashtags
- No "excited to share", "game-changer", "In today's world", or throat-clearing openers
- Every claim must be anchored to a specific detail from the signal — do NOT fabricate
- End with a line that earns a comment — contrarian, specific question, or a silence that lands
- Never end with "What do you think?"`,
    user: `Author: ${author.name}${author.role ? ` — ${author.role}` : ""}
${author.bio ? `About them: ${author.bio}` : ""}
${author.styleNotes ? `Style preferences: ${author.styleNotes}` : ""}${voiceSection}${hooksSection}

Framework: ${framework.name}
${framework.promptTemplate}

Content angle: ${input.contentAngle}

Source signal (do not fabricate beyond this):
"""
${input.signalRawContent}
"""

Return ONLY the post text.`,
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
  notes: string;
}> {
  const raw = await textCall({
    maxTokens: 500,
    temperature: 0.2,
    system: `${GLOBAL_RULES}

STEP 3 — Post Scoring:

Score on two dimensions:
- hook_strength (0-100): Do the first 1-2 lines stop a scroll? Specific, surprising, tension-inducing = high. Generic, corporate, vague = low.
- specificity (0-100): Does the post use concrete numbers, names, moments? Abstraction soup = low.

Be critical, not nice. Penalize vagueness heavily. Reward specificity and originality.

Return ONLY valid JSON: { "hook_strength": <int>, "specificity": <int>, "notes": "one short sentence of feedback" }`,
    user: `Post:\n"""${text}"""`,
  });
  const parsed = extractJson<{ hook_strength: number; specificity: number; notes: string }>(raw);
  return {
    hookStrength: Math.max(0, Math.min(100, parsed.hook_strength ?? 0)),
    specificity: Math.max(0, Math.min(100, parsed.specificity ?? 0)),
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
