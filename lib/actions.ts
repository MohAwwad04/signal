"use server";

import { db, schema } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { desc, eq, and, sql } from "drizzle-orm";
import {
  generatePostsFromTranscript,
  generatePost,
  assistedEdit,
  scorePost,
  learnVoiceFromEdits,
  generateDesignBrief,
} from "@/lib/claude";

/* ========== SIGNALS ========== */

export async function extractSignalsAction(
  transcript: string,
  meetingTitle?: string,
  meetingDate?: string
) {
  if (!transcript || transcript.length < 100) {
    throw new Error("Transcript is too short — paste more context.");
  }
  const authors = await db.select().from(schema.authors).where(eq(schema.authors.active, true));
  const roles = authors.map((a) => a.role ?? "").filter(Boolean);
  const allAngles = authors.flatMap((a) => (a.contentAngles as string[] | null) ?? []);
  const generated = await generatePostsFromTranscript(transcript, roles, allAngles);
  if (!generated.length) return { inserted: 0, signals: [] };
  const rows = generated.map((s) => {
    const recAuthor = s.recommendedAuthorRole
      ? authors.find((a) => a.role?.toLowerCase() === s.recommendedAuthorRole?.toLowerCase())
      : undefined;
    return {
      rawContent: s.rawContent,
      contentType: "post",
      speaker: null as string | null,
      contentAngles: [] as string[],
      recommendedAuthorId: recAuthor?.id ?? null,
      source: "manual" as const,
      sourceMeetingTitle: meetingTitle ?? null,
      sourceMeetingDate: meetingDate ? new Date(meetingDate) : null,
    };
  });
  const inserted = await db.insert(schema.signals).values(rows).returning();
  revalidatePath("/signals");
  revalidatePath("/");
  return { inserted: inserted.length, signals: inserted };
}

export async function updateSignalContentAction(id: number, content: string) {
  await db.update(schema.signals).set({ rawContent: content }).where(eq(schema.signals.id, id));
  revalidatePath("/signals");
  revalidatePath(`/signals/${id}`);
}

export async function createSignalAction(input: {
  rawContent: string;
  contentType: string;
  speaker?: string;
  notes?: string;
}) {
  const [row] = await db
    .insert(schema.signals)
    .values({
      rawContent: input.rawContent,
      contentType: input.contentType,
      speaker: input.speaker ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  revalidatePath("/signals");
  return row;
}

export async function archiveSignalAction(id: number) {
  await db.update(schema.signals).set({ status: "archived" }).where(eq(schema.signals.id, id));
  revalidatePath("/signals");
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

export async function markPublishedAction(postId: number) {
  await db
    .update(schema.posts)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  const [p] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (p?.signalId) {
    await db.update(schema.signals).set({ status: "used" }).where(eq(schema.signals.id, p.signalId));
  }
  revalidatePath("/review");
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
