import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

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

/* ---------- signal extraction ---------- */

export type ExtractedSignal = {
  rawContent: string;
  contentType: string;
  speaker?: string;
  contentAngles: string[];
  recommendedAuthorRole?: string;
};

export async function extractSignalsFromTranscript(
  transcript: string,
  availableAuthorRoles: string[]
): Promise<ExtractedSignal[]> {
  const raw = await textCall({
    maxTokens: 3000,
    temperature: 0.4,
    system: `You are a senior content strategist who extracts only the strongest, most LinkedIn-worthy moments from meeting transcripts.

A signal MUST meet ALL of these:
- Contains a specific number, result, name, or direct quote — not a paraphrase
- A reader who wasn't in the meeting would find it surprising, useful, or relatable
- There is enough concrete detail to write a post WITHOUT making things up
- It is NOT generic advice that could apply to any company

Immediately discard:
- Small talk, scheduling, logistics
- Vague statements like "we need to improve" or "customers love it"
- Internal process discussions with no external insight
- Anything where the interesting part is missing from the transcript

Be strict. 3 strong signals beat 8 weak ones.

For each signal, produce 2-4 content angles — specific framings, not generic titles.

Return ONLY valid JSON:
{
  "signals": [
    {
      "rawContent": "exact quote or precise summary with specific details preserved",
      "contentType": "success_metric | customer_quote | buying_signal | technical_insight | before_after | objection | lesson",
      "speaker": "name if known, else empty string",
      "contentAngles": ["specific angle 1", "specific angle 2"],
      "recommendedAuthorRole": "best matching role from the available list"
    }
  ]
}`,
    user: `Available author roles: ${availableAuthorRoles.join(", ")}

Transcript:
"""
${transcript.slice(0, 40000)}
"""

Extract only the signals that could produce a genuinely good LinkedIn post. Be selective. Return JSON only.`,
  });
  const parsed = extractJson<{ signals: ExtractedSignal[] }>(raw);
  return parsed.signals ?? [];
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
    ? `\nLearned voice (based on past edits — match this closely):\n${author.voiceProfile}`
    : "";
  const hooksSection = topPerformingHooks.length
    ? `\nTop-performing hooks from past posts (same author):\n- ${topPerformingHooks.join("\n- ")}`
    : "";
  return textCall({
    maxTokens: 1500,
    temperature: 0.8,
    system: `You write LinkedIn posts that get saved and shared, not scrolled past.

LinkedIn-specific rules:
- The first 2 lines are ALL the reader sees before "see more" — make them impossible to skip
- No hashtags unless the author's style notes explicitly use them
- No "excited to share", "game-changer", "delighted to announce", or similar filler
- No throat-clearing intros ("In today's world...", "As a CEO...", "I've been thinking...")
- Short lines, generous white space — walls of text get skipped
- Every claim must be anchored to a specific number, name, or moment from the signal
- Do NOT invent details not present in the signal — if it's not there, don't use it
- End with one line that makes people want to comment — a question, a contrarian take, or a silence that earns itself
- Never end with "What do you think?" — it's lazy

Length: 120–220 words unless the framework says otherwise.
Format: plain text only. No bold, no bullet headers, no markdown.`,
    user: `Write a LinkedIn post for:

Author: ${author.name}${author.role ? ` — ${author.role}` : ""}
${author.bio ? `About them: ${author.bio}` : ""}
${author.styleNotes ? `Their style preferences: ${author.styleNotes}` : ""}${voiceSection}${hooksSection}

Framework to follow: ${framework.name}
${framework.promptTemplate}

The specific angle for this post: ${input.contentAngle}

What was actually said / happened (use this as your source — do not fabricate beyond it):
"""
${input.signalRawContent}
"""

Return ONLY the post text. No title, no preface, no explanation.`,
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
    system: `You edit LinkedIn posts. You make the specific change requested, preserve the author's voice, and do NOT rewrite things that weren't part of the instruction. Return only the edited post text.`,
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
    system: `You score LinkedIn posts on two dimensions:

- hook_strength (0-100): Does the first 1-2 lines make a thumb stop? Specific, surprising, or tension-inducing = high. Generic, corporate, or vague = low.
- specificity (0-100): Does the post use concrete numbers, names, moments? Or is it abstraction soup?

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
    system: `You build a concise, actionable 'voice profile' for an author by analyzing how they edit AI-generated drafts. Focus on patterns: sentence length, word choices they add, phrases they remove, structural preferences, what they make more specific, what they cut as fluff.

Output format: a plain text profile with 5-10 bullet-style lines, each a concrete rule. No preamble. No markdown headers. Keep it under 200 words. It will be pasted directly into future generation prompts.`,
    user: `Current profile (may be empty):
"""
${currentProfile ?? "(none yet)"}
"""

Recent edits from this author:
${edits}

Update the profile. Merge with the current profile where relevant, drop anything contradicted by the new edits.`,
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
