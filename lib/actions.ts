"use server";

import { db, schema } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { desc, eq, and, sql, lt, inArray } from "drizzle-orm";
import { extractLinkedinPostUrn } from "@/lib/linkedin";
import { sendInviteEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import {
  generatePostsFromTranscript,
  generatePost,
  assistedEdit,
  scorePost,
  learnVoiceFromEdits,
  learnFromPerformance,
  generateDesignBrief,
  reformatPostWithFramework,
  analyzeLinkedinPageContent,
} from "@/lib/claude";
import { ensureTranscript, scoreSignalsOrDelete, deduplicateAgainstExisting } from "@/lib/signals-helpers";
import { getVisibleAuthorIds } from "@/lib/session";

/* ========== SIGNALS ========== */

export async function extractSignalsAction( // transcription vaildation + fetch + gnerate post
  transcript: string,
  meetingTitle?: string,
  meetingDate?: string
) {
  if (!transcript || transcript.length < 100) {
    throw new Error("Transcript is too short — paste more context.");
  }
  const [authors, allFrameworks] = await Promise.all([
    db.select().from(schema.authors).where(eq(schema.authors.active, true)),
    db.select({ id: schema.frameworks.id, name: schema.frameworks.name, description: schema.frameworks.description }).from(schema.frameworks),
  ]);
  const authorContexts = authors.map((a) => ({
    role: a.role ?? "",
    contentAngles: (a.contentAngles as string[] | null) ?? [],
    preferredFrameworkNames: [] as string[],
    voiceProfile: a.voiceProfile ?? undefined,
    performanceLearningHints: a.performanceLearningHints ?? undefined,
  }));
  const generated = await generatePostsFromTranscript(transcript, authorContexts, allFrameworks);
  console.log(`[extract] Claude returned ${generated.length} signal(s)`);
  if (!generated.length) return { inserted: 0, signals: [] };
  const [transcriptRow, visibleAuthorIds] = await Promise.all([
    ensureTranscript({
      title: meetingTitle ?? null,
      content: transcript,
      source: "manual",
      sourceMeetingDate: meetingDate ? new Date(meetingDate) : null,
    }),
    getVisibleAuthorIds(),
  ]);
  const rows = generated.map((s) => {
    const recAuthor = s.recommendedAuthorRole
      ? authors.find((a) =>
          a.role?.toLowerCase() === s.recommendedAuthorRole?.toLowerCase() &&
          (visibleAuthorIds === null || visibleAuthorIds.includes(a.id))
        )
      : undefined;
    const recFramework = s.frameworkName
      ? allFrameworks.find((f) => f.name.toLowerCase() === s.frameworkName!.toLowerCase())
      : undefined;
    return {
      rawContent: s.rawContent,
      title: s.title ?? null,
      contentType: "post",
      speaker: null as string | null,
      hashtags: s.hashtags ?? [],
      contentAngles: s.contentAngle ? [s.contentAngle] : [] as string[],
      recommendedAuthorId: recAuthor?.id ?? null,
      bestFrameworkId: recFramework?.id ?? null,
      source: "manual" as const,
      sourceMeetingTitle: meetingTitle ?? null,
      sourceMeetingDate: meetingDate ? new Date(meetingDate) : null,
      transcriptId: transcriptRow.id,
    };
  });
  const deduped = await deduplicateAgainstExisting(rows);
  console.log(`[extract] After dedup: ${deduped.length}/${rows.length} signal(s) remain`);
  if (!deduped.length) return { inserted: 0, signals: [] };
  const inserted = await db.insert(schema.signals).values(deduped).returning();
  const kept = await scoreSignalsOrDelete(inserted.map((r) => r.id));
  console.log(`[extract] After scoring: ${kept.length}/${inserted.length} signal(s) kept`);
  revalidatePath("/signals");
  revalidatePath("/");
  return { inserted: kept.length, signals: inserted.filter((s) => kept.includes(s.id)) };
}

export async function updateSignalContentAction(id: number, content: string) {
  const [current] = await db.select().from(schema.signals).where(eq(schema.signals.id, id));
  if (!current || current.rawContent === content) return;

  await db.update(schema.signals).set({ rawContent: content }).where(eq(schema.signals.id, id));

  if (current.recommendedAuthorId) {
    await db.insert(schema.edits).values({
      signalId: id,
      authorId: current.recommendedAuthorId,
      before: current.rawContent,
      after: content,
      editType: "manual",
    });

    const recent = await db
      .select()
      .from(schema.edits)
      .where(eq(schema.edits.authorId, current.recommendedAuthorId))
      .orderBy(desc(schema.edits.createdAt))
      .limit(5);

    if (recent.length >= 2) {
      const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, current.recommendedAuthorId));
      const profile = await learnVoiceFromEdits(
        author?.voiceProfile ?? null,
        recent.map((e) => ({ before: e.before, after: e.after, instruction: e.instruction ?? undefined }))
      ).catch(() => null);
      if (profile) {
        await db.update(schema.authors).set({ voiceProfile: profile }).where(eq(schema.authors.id, current.recommendedAuthorId));
      }
    }
  }

  revalidatePath("/signals");
  revalidatePath(`/signals/${id}`);
}

export async function applyFrameworkToSignalAction(content: string, frameworkId: number): Promise<string> {
  const [framework] = await db.select().from(schema.frameworks).where(eq(schema.frameworks.id, frameworkId));
  if (!framework) throw new Error("Framework not found.");
  return reformatPostWithFramework(content, framework);
}

export async function renameTranscriptGroupAction(transcriptId: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await Promise.all([
    db.update(schema.transcripts).set({ title: trimmed }).where(eq(schema.transcripts.id, transcriptId)),
    db.update(schema.signals).set({ sourceMeetingTitle: trimmed }).where(eq(schema.signals.transcriptId, transcriptId)),
  ]);
  revalidatePath("/signals");
}

export async function archiveSignalAction(id: number) {
  await db.update(schema.signals).set({ status: "archived", archivedAt: new Date() }).where(eq(schema.signals.id, id));
  revalidatePath("/signals");
  revalidatePath("/signals/archive");
}

export async function bulkArchiveSignalsAction(ids: number[]) {
  if (!ids.length) return;
  await db.update(schema.signals).set({ status: "archived", archivedAt: new Date() }).where(inArray(schema.signals.id, ids));
  revalidatePath("/signals");
  revalidatePath("/signals/archive");
}

export async function deleteSignalPermanentlyAction(id: number) {
  await db.delete(schema.signals).where(eq(schema.signals.id, id));
  revalidatePath("/signals/archive");
}

export async function restoreSignalAction(id: number) {
  await db.update(schema.signals).set({ status: "unused", archivedAt: null }).where(eq(schema.signals.id, id));
  revalidatePath("/signals");
  revalidatePath("/signals/archive");
}

/* ========== AUTHORS ========== */

export async function createAuthorAction(input: {
  name: string;
  role?: string;
  bio?: string;
  linkedinUrl?: string;
  styleNotes?: string;
}) {
  const [row] = await db
    .insert(schema.authors)
    .values({
      name: input.name,
      role: input.role ?? null,
      bio: input.bio ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      styleNotes: input.styleNotes ?? null,
    })
    .returning();
  revalidatePath("/authors");
  return row;
}

export async function updateAuthorAction(id: number, patch: Partial<{
  name: string;
  role: string;
  bio: string;
  linkedinUrl: string;
  styleNotes: string;
  active: boolean;
}>) {
  await db.update(schema.authors).set(patch).where(eq(schema.authors.id, id));
  revalidatePath("/authors");
  revalidatePath(`/authors/${id}`);
}

export async function updateAuthorContentAnglesAction(authorId: number, angles: string[]) {
  const filtered = angles.map((a) => a.trim()).filter(Boolean);
  if (filtered.length === 0) throw new Error("At least one content angle is required.");
  await db.update(schema.authors).set({ contentAngles: filtered } as any).where(eq(schema.authors.id, authorId));
  revalidatePath(`/authors/${authorId}`);
}

/* ========== FRAMEWORKS ========== */

export async function createFrameworkAction(input: {
  name: string;
  description: string;
  promptTemplate: string;
  bestFor?: string[];
}) {
  const [row] = await db
    .insert(schema.frameworks)
    .values({
      name: input.name,
      description: input.description,
      promptTemplate: input.promptTemplate,
      bestFor: input.bestFor ?? [],
    })
    .returning();
  revalidatePath("/frameworks");
  return row;
}

/* ========== POSTS ========== */

export async function generatePostAction(input: {
  signalId: number;
  authorId: number;
  frameworkId: number;
  contentAngle: string;
}) {
  const [signal] = await db.select().from(schema.signals).where(eq(schema.signals.id, input.signalId));
  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, input.authorId));
  const [framework] = await db.select().from(schema.frameworks).where(eq(schema.frameworks.id, input.frameworkId));
  if (!signal || !author || !framework) throw new Error("Missing signal, author, or framework.");

  // Pull the author's top-performing hooks for context.
  const topHooks = await db
    .select({ content: schema.posts.content })
    .from(schema.posts)
    .leftJoin(schema.analytics, eq(schema.analytics.postId, schema.posts.id))
    .where(and(eq(schema.posts.authorId, input.authorId), eq(schema.posts.status, "published")))
    .orderBy(desc(schema.analytics.likes))
    .limit(3);
  const topHookLines = topHooks
    .map((p) => p.content?.split("\n")[0])
    .filter((h): h is string => !!h && h.length > 10);

  const postInput = {
    signalRawContent: signal.rawContent,
    contentAngle: input.contentAngle,
    author: {
      name: author.name,
      role: author.role,
      bio: author.bio,
      voiceProfile: author.voiceProfile,
      styleNotes: author.styleNotes,
    },
    framework: { name: framework.name, promptTemplate: framework.promptTemplate },
    topPerformingHooks: topHookLines,
  };

  let text = await generatePost(postInput);
  let scores = await scorePost(text).catch(() => ({ hookStrength: 0, specificity: 0, notes: "" }));

  // If the first draft scores poorly, try once more at a lower temperature for tighter output
  if (scores.hookStrength < 45 || scores.specificity < 45) {
    const retry = await generatePost(postInput).catch(() => null);
    if (retry) {
      const retryScores = await scorePost(retry).catch(() => null);
      if (retryScores && (retryScores.hookStrength + retryScores.specificity) > (scores.hookStrength + scores.specificity)) {
        text = retry;
        scores = retryScores;
      }
    }
  }

  const [post] = await db
    .insert(schema.posts)
    .values({
      signalId: input.signalId,
      authorId: input.authorId,
      frameworkId: input.frameworkId,
      contentAngle: input.contentAngle,
      content: text,
      originalContent: text,
      hookStrengthScore: scores.hookStrength,
      specificityScore: scores.specificity,
      status: "draft",
    })
    .returning();

  await db.update(schema.signals).set({ status: "drafting" }).where(eq(schema.signals.id, input.signalId));

  revalidatePath("/signals");
  revalidatePath("/");
  revalidatePath(`/posts/${post.id}`);
  return post;
}

export async function updatePostContentAction(postId: number, newContent: string, instruction?: string) {
  const [current] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!current) throw new Error("Post not found.");
  if (current.content === newContent) return current;

  await db
    .update(schema.posts)
    .set({ content: newContent, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));

  // record the edit
  await db.insert(schema.edits).values({
    postId,
    authorId: current.authorId,
    before: current.content,
    after: newContent,
    editType: instruction ? `assisted:${instruction.slice(0, 40)}` : "manual",
    instruction: instruction ?? null,
  });

  // Re-score (non-blocking feel — but we await for simplicity)
  const scores = await scorePost(newContent).catch(() => null);
  if (scores) {
    await db
      .update(schema.posts)
      .set({ hookStrengthScore: scores.hookStrength, specificityScore: scores.specificity })
      .where(eq(schema.posts.id, postId));
  }

  // Update the author's voice profile using the last ~5 edits.
  if (current.authorId) {
    const recent = await db
      .select()
      .from(schema.edits)
      .where(eq(schema.edits.authorId, current.authorId))
      .orderBy(desc(schema.edits.createdAt))
      .limit(5);
    if (recent.length >= 2) {
      const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, current.authorId));
      const profile = await learnVoiceFromEdits(
        author?.voiceProfile ?? null,
        recent.map((e) => ({ before: e.before, after: e.after, instruction: e.instruction ?? undefined }))
      ).catch(() => null);
      if (profile) {
        await db.update(schema.authors).set({ voiceProfile: profile }).where(eq(schema.authors.id, current.authorId));
      }
    }
  }

  revalidatePath(`/posts/${postId}`);
  return (await db.select().from(schema.posts).where(eq(schema.posts.id, postId)))[0];
}

export async function assistedEditAction(postId: number, instruction: string) {
  const [current] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!current) throw new Error("Post not found.");
  const [author] = current.authorId
    ? await db.select().from(schema.authors).where(eq(schema.authors.id, current.authorId))
    : [null];
  const next = await assistedEdit(current.content, instruction, author ?? undefined);
  return updatePostContentAction(postId, next, instruction);
}

export async function submitForReviewAction(postId: number) {
  await db.update(schema.posts).set({ status: "in_review", updatedAt: new Date() }).where(eq(schema.posts.id, postId));
  revalidatePath("/review");
  revalidatePath(`/posts/${postId}`);
}

export async function approvePostAction(postId: number, notes?: string) {
  await db
    .update(schema.posts)
    .set({ status: "approved", reviewerNotes: notes ?? null, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  revalidatePath("/review");
  revalidatePath(`/posts/${postId}`);
}

export async function rejectPostAction(postId: number, notes: string) {
  await db
    .update(schema.posts)
    .set({ status: "rejected", reviewerNotes: notes, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  revalidatePath("/review");
  revalidatePath(`/posts/${postId}`);
}

export async function markPublishedAction(postId: number, linkedinUrl?: string) {
  const urn = linkedinUrl ? extractLinkedinPostUrn(linkedinUrl) : null;
  await db
    .update(schema.posts)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      ...(urn ? { linkedinPostUrn: urn } : {}),
    })
    .where(eq(schema.posts.id, postId));
  const [p] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (p?.signalId) {
    await db.update(schema.signals).set({ status: "used" }).where(eq(schema.signals.id, p.signalId));
  }
  revalidatePath("/review");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/analytics");
}

export async function setLinkedinPostUrlAction(postId: number, linkedinUrl: string) {
  const urn = extractLinkedinPostUrn(linkedinUrl);
  if (!urn) throw new Error("Could not extract a LinkedIn post URN from that URL. Make sure it's a valid post link.");
  await db
    .update(schema.posts)
    .set({ linkedinPostUrn: urn, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/analytics");
}

/* ========== DESIGN BRIEF ========== */

export async function generateDesignBriefAction(postId: number) {
  const existing = await db
    .select()
    .from(schema.designBriefs)
    .where(eq(schema.designBriefs.postId, postId))
    .limit(1);
  if (existing.length) return existing[0];

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!post) throw new Error("Post not found.");
  const [author] = post.authorId
    ? await db.select().from(schema.authors).where(eq(schema.authors.id, post.authorId))
    : [{ name: "Author" } as any];
  const brief = await generateDesignBrief(post.content, author?.name ?? "Author");
  const [row] = await db
    .insert(schema.designBriefs)
    .values({
      postId,
      objective: brief.objective,
      targetAudience: brief.targetAudience,
      tone: brief.tone,
      keyMessages: brief.keyMessages ?? [],
      designDirection: brief.designDirection,
      svg: brief.svg,
    })
    .returning();
  revalidatePath(`/posts/${postId}`);
  return row;
}

/* ========== ANALYTICS ========== */

export async function recordAnalyticsAction(postId: number, metrics: {
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
}) {
  const [row] = await db
    .insert(schema.analytics)
    .values({
      postId,
      impressions: metrics.impressions ?? 0,
      likes: metrics.likes ?? 0,
      comments: metrics.comments ?? 0,
      shares: metrics.shares ?? 0,
      clicks: metrics.clicks ?? 0,
    })
    .returning();
  revalidatePath("/analytics");
  revalidatePath(`/posts/${postId}`);
  return row;
}

/* ========== DASHBOARD ========== */

/* ========== SIGNAL EXTRAS ========== */

export async function createManualSignalAction(input: { title?: string; content: string; hashtags?: string[] }) {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Signal content is required.");
  }
  const transcriptRow = await ensureTranscript({
    title: input.title ?? null,
    content: input.content,
    source: "manual_entry",
  });
  const signalRow = { rawContent: input.content, contentType: "post" as const, speaker: null as string | null, title: input.title ?? null, hashtags: input.hashtags ?? [], source: "manual" as const, transcriptId: transcriptRow.id };
  const deduped = await deduplicateAgainstExisting([signalRow]);
  if (!deduped.length) throw new Error("A very similar signal already exists.");
  const [row] = await db.insert(schema.signals).values(deduped[0]).returning();
  const kept = await scoreSignalsOrDelete([row.id]);
  if (kept.length === 0) {
    throw new Error("Failed to score the signal — please try again.");
  }
  revalidatePath("/signals");
  return row;
}

export async function scoreSignalAction(signalId: number) {
  const [signal] = await db.select().from(schema.signals).where(eq(schema.signals.id, signalId));
  if (!signal) throw new Error("Signal not found.");
  const scores = await scorePost(signal.rawContent);
  await db.update(schema.signals).set({
    hookStrengthScore: scores.hookStrength,
    specificityScore: scores.specificity,
    clarityScore: scores.clarity,
    emotionalResonanceScore: scores.emotionalResonance,
    callToActionScore: scores.callToAction,
  }).where(eq(schema.signals.id, signalId));
  revalidatePath(`/signals/${signalId}`);
  return scores;
}

export async function updateSignalAuthorAction(signalId: number, authorId: number | null) {
  await db.update(schema.signals).set({ recommendedAuthorId: authorId }).where(eq(schema.signals.id, signalId));
  revalidatePath(`/signals/${signalId}`);
}

export async function updateSignalBestFrameworkAction(signalId: number, frameworkId: number | null) {
  await db.update(schema.signals).set({ bestFrameworkId: frameworkId }).where(eq(schema.signals.id, signalId));
  revalidatePath(`/signals/${signalId}`);
}

export async function updateSignalContentAnglesAction(signalId: number, angles: string[]) {
  await db.update(schema.signals).set({ contentAngles: angles } as any).where(eq(schema.signals.id, signalId));
  revalidatePath(`/signals/${signalId}`);
}

export async function submitSignalDraftsForReviewAction(signalId: number) {
  await db
    .update(schema.posts)
    .set({ status: "in_review" })
    .where(and(eq(schema.posts.signalId, signalId), eq(schema.posts.status, "draft")));
  revalidatePath(`/signals/${signalId}`);
  revalidatePath("/signals");
}

/* ========== CONTENT ANGLES ========== */

export async function createContentAngleAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");
  const existing = await db.select().from(schema.contentAngles).where(eq(schema.contentAngles.name, trimmed));
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(schema.contentAngles).values({ name: trimmed }).returning();
  revalidatePath("/authors");
  return row;
}

export async function deleteContentAngleAction(id: number) {
  await db.delete(schema.contentAngles).where(eq(schema.contentAngles.id, id));
  revalidatePath("/authors");
}

export async function addContentAngleToAuthorAction(authorId: number, angleId: number) {
  await db
    .insert(schema.authorContentAngles)
    .values({ authorId, contentAngleId: angleId })
    .onConflictDoNothing();
  revalidatePath(`/authors/${authorId}`);
}

export async function removeContentAngleFromAuthorAction(authorId: number, angleId: number) {
  await db
    .delete(schema.authorContentAngles)
    .where(and(eq(schema.authorContentAngles.authorId, authorId), eq(schema.authorContentAngles.contentAngleId, angleId)));
  revalidatePath(`/authors/${authorId}`);
}

/* ========== FRAMEWORK EXTRAS ========== */

export async function updateFrameworkAction(id: number, patch: Partial<{ name: string; description: string; promptTemplate: string; bestFor: string[] }>) {
  await db.update(schema.frameworks).set(patch).where(eq(schema.frameworks.id, id));
  revalidatePath("/frameworks");
}

export async function deleteFrameworkAction(id: number) {
  await db.delete(schema.frameworks).where(eq(schema.frameworks.id, id));
  revalidatePath("/frameworks");
}

/* ========== POST EXTRAS ========== */

export async function reopenPostAction(postId: number) {
  await db.update(schema.posts).set({ status: "draft", reviewerNotes: null }).where(eq(schema.posts.id, postId));
  revalidatePath(`/posts/${postId}`);
}

/* ========== PERFORMANCE LEARNING ========== */

export async function learnFromPerformanceAction(authorId: number): Promise<{ updated: boolean; message: string }> {
  const author = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId)).then((r) => r[0]);
  if (!author) throw new Error("Author not found.");

  const topPosts = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.authorId, authorId), eq(schema.posts.status, "published")))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(10);

  if (topPosts.length === 0) return { updated: false, message: "No published posts to learn from yet." };

  const analyticsRows = await db
    .select()
    .from(schema.analytics)
    .where(inArray(schema.analytics.postId, topPosts.map((p) => p.id)));

  const analyticsMap = Object.fromEntries(analyticsRows.map((a) => [a.postId, a]));

  const samples = topPosts
    .map((p) => {
      const a = analyticsMap[p.id];
      const lines = p.content.split("\n");
      return {
        content: p.content,
        hookLine: lines[0] ?? "",
        contentAngle: p.contentAngle ?? null,
        frameworkName: null as string | null,
        impressions: a?.impressions ?? 0,
        likes: a?.likes ?? 0,
        comments: a?.comments ?? 0,
      };
    })
    .sort((a, b) => (b.impressions + b.likes * 3 + b.comments * 5) - (a.impressions + a.likes * 3 + a.comments * 5))
    .slice(0, 5);

  const hints = await learnFromPerformance(author.name, samples, author.performanceLearningHints ?? null);
  await db.update(schema.authors).set({
    performanceLearningHints: hints,
    performanceLearningUpdatedAt: new Date(),
  }).where(eq(schema.authors.id, authorId));
  revalidatePath(`/authors/${authorId}`);
  return { updated: true, message: `Patterns updated from ${samples.length} published posts.` };
}

/* ========== LINKEDIN SCRAPE ========== */

export async function scrapeLinkedinProfileAction(authorId: number): Promise<{ ok: boolean; message: string }> {
  try {
    const author = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId)).then((r) => r[0]);
    if (!author) return { ok: false, message: "Author not found." };
    if (!author.linkedinUrl) return { ok: false, message: "No LinkedIn URL set for this author." };

    const frameworks = await db.select({ name: schema.frameworks.name, description: schema.frameworks.description }).from(schema.frameworks);

    const response = await fetch(author.linkedinUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);

    const result = await analyzeLinkedinPageContent(text, frameworks);

    await db.update(schema.authors).set({
      voiceProfile: result.voiceProfile,
      styleNotes: result.styleNotes,
      contentAngles: result.contentAngles,
    } as any).where(eq(schema.authors.id, authorId));

    revalidatePath(`/authors/${authorId}`);
    return { ok: true, message: "LinkedIn profile analysed and voice updated." };
  } catch {
    return { ok: false, message: "Failed to read LinkedIn profile." };
  }
}

/* ========== USER MANAGEMENT ========== */

export async function addUserAction(email: string, role: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, normalizedEmail));
  if (existing.length > 0) throw new Error("User already exists.");

  await db.insert(schema.users).values({ email: normalizedEmail, role, active: false });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(schema.authTokens).values({ email: normalizedEmail, token, expiresAt });

  await sendInviteEmail(normalizedEmail, token);
  revalidatePath("/authors");
}

export async function removeUserAction(id: number) {
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/authors");
}

/* ========== DASHBOARD ========== */

export async function getDashboardStats() {
  const [signalCounts, postCounts, authorCount, recentPosts, topAuthors] = await Promise.all([
    db
      .select({ status: schema.signals.status, count: sql<number>`count(*)::int` })
      .from(schema.signals)
      .groupBy(schema.signals.status),
    db
      .select({ status: schema.posts.status, count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .groupBy(schema.posts.status),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.authors).where(eq(schema.authors.active, true)),
    db
      .select()
      .from(schema.posts)
      .orderBy(desc(schema.posts.updatedAt))
      .limit(5),
    db
      .select({
        authorId: schema.posts.authorId,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.posts)
      .where(eq(schema.posts.status, "published"))
      .groupBy(schema.posts.authorId),
  ]);
  return { signalCounts, postCounts, authorCount: authorCount[0]?.count ?? 0, recentPosts, topAuthors };
}
