"use server";

import { db, schema } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { desc, eq, and, sql, lt, inArray, ilike, or } from "drizzle-orm";
import { extractLinkedinPostUrn } from "@/lib/linkedin";
import {
  generatePostsFromTranscript,
  generatePost,
  assistedEdit,
  scorePost,
  learnVoiceFromEdits,
  generateDesignBrief,
  reformatPostWithFramework,
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
  const voiceProfiles = Object.fromEntries(
    authors.filter((a) => a.role && a.voiceProfile).map((a) => [a.role!, a.voiceProfile!])
  );
  const generated = await generatePostsFromTranscript(transcript, roles, allAngles, voiceProfiles);
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
      sourceTranscript: transcript,
    };
  });
  const inserted = await db.insert(schema.signals).values(rows).returning();
  revalidatePath("/signals");
  revalidatePath("/");
  return { inserted: inserted.length, signals: inserted };
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

export async function updateSignalAuthorAction(id: number, authorId: number | null) {
  await db.update(schema.signals).set({ recommendedAuthorId: authorId }).where(eq(schema.signals.id, id));
  revalidatePath(`/signals/${id}`);
  revalidatePath("/signals");
}

export async function updateSignalBestFrameworkAction(id: number, frameworkId: number | null) {
  await db.update(schema.signals).set({ bestFrameworkId: frameworkId }).where(eq(schema.signals.id, id));
  revalidatePath(`/signals/${id}`);
}

export async function updateSignalContentAnglesAction(id: number, angles: string[]) {
  await db.update(schema.signals).set({ contentAngles: angles } as any).where(eq(schema.signals.id, id));
  revalidatePath(`/signals/${id}`);
  revalidatePath("/signals");
}

export async function applyFrameworkToSignalAction(content: string, frameworkId: number): Promise<string> {
  const [framework] = await db.select().from(schema.frameworks).where(eq(schema.frameworks.id, frameworkId));
  if (!framework) throw new Error("Framework not found.");
  return reformatPostWithFramework(content, framework);
}

export async function archiveSignalAction(id: number) {
  await db.update(schema.signals).set({ status: "archived", archivedAt: new Date() }).where(eq(schema.signals.id, id));
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

/* ========== CONTENT ANGLES ========== */

export async function getAllContentAnglesAction() {
  return db.select().from(schema.contentAngles).orderBy(schema.contentAngles.name);
}

export async function getAuthorContentAnglesAction(authorId: number) {
  const rows = await db
    .select({ angle: schema.contentAngles })
    .from(schema.authorContentAngles)
    .innerJoin(schema.contentAngles, eq(schema.authorContentAngles.contentAngleId, schema.contentAngles.id))
    .where(eq(schema.authorContentAngles.authorId, authorId));
  return rows.map((r) => r.angle);
}

export async function createContentAngleAction(name: string): Promise<typeof schema.contentAngles.$inferSelect> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Angle name is required.");
  const existing = await db.select().from(schema.contentAngles).where(eq(schema.contentAngles.name, trimmed)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(schema.contentAngles).values({ name: trimmed }).returning();
  revalidatePath("/authors/content-angles");
  return created;
}

export async function deleteContentAngleAction(id: number) {
  await db.delete(schema.contentAngles).where(eq(schema.contentAngles.id, id));
  revalidatePath("/authors/content-angles");
  revalidatePath("/authors");
}

export async function addContentAngleToAuthorAction(authorId: number, contentAngleId: number) {
  await db.insert(schema.authorContentAngles).values({ authorId, contentAngleId }).onConflictDoNothing();

  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId));
  const [angle] = await db.select().from(schema.contentAngles).where(eq(schema.contentAngles.id, contentAngleId));
  const existing = (author?.contentAngles as string[] | null) ?? [];
  if (angle && !existing.includes(angle.name)) {
    await db.update(schema.authors).set({ contentAngles: [...existing, angle.name] } as any).where(eq(schema.authors.id, authorId));
  }

  revalidatePath(`/authors/${authorId}`);
  revalidatePath("/authors/content-angles");
}

export async function removeContentAngleFromAuthorAction(authorId: number, contentAngleId: number) {
  await db
    .delete(schema.authorContentAngles)
    .where(and(eq(schema.authorContentAngles.authorId, authorId), eq(schema.authorContentAngles.contentAngleId, contentAngleId)));

  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId));
  const [angle] = await db.select().from(schema.contentAngles).where(eq(schema.contentAngles.id, contentAngleId));
  const existing = (author?.contentAngles as string[] | null) ?? [];
  if (angle) {
    await db.update(schema.authors).set({ contentAngles: existing.filter((a) => a !== angle.name) } as any).where(eq(schema.authors.id, authorId));
  }

  revalidatePath(`/authors/${authorId}`);
  revalidatePath("/authors/content-angles");
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

  // Upsert each angle into global pool
  const angleRows = await Promise.all(
    filtered.map(async (name) => {
      const ex = await db.select().from(schema.contentAngles).where(eq(schema.contentAngles.name, name)).limit(1);
      if (ex[0]) return ex[0];
      const [c] = await db.insert(schema.contentAngles).values({ name }).returning();
      return c;
    })
  );

  // Replace author's join-table entries
  await db.delete(schema.authorContentAngles).where(eq(schema.authorContentAngles.authorId, authorId));
  if (angleRows.length > 0) {
    await db.insert(schema.authorContentAngles).values(angleRows.map((a) => ({ authorId, contentAngleId: a.id })));
  }

  // Keep jsonb in sync for backward compat
  await db.update(schema.authors).set({ contentAngles: filtered } as any).where(eq(schema.authors.id, authorId));

  revalidatePath(`/authors/${authorId}`);
  revalidatePath("/authors/content-angles");
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

export async function updateFrameworkAction(id: number, patch: {
  name?: string;
  description?: string;
  promptTemplate?: string;
  bestFor?: string[];
}) {
  await db.update(schema.frameworks).set(patch).where(eq(schema.frameworks.id, id));
  revalidatePath("/frameworks");
}

export async function deleteFrameworkAction(id: number) {
  await db.delete(schema.frameworks).where(eq(schema.frameworks.id, id));
  revalidatePath("/frameworks");
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
  revalidatePath("/drafts");
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

  await db.insert(schema.edits).values({
    postId,
    authorId: current.authorId,
    before: current.content,
    after: newContent,
    editType: instruction ? `assisted:${instruction.slice(0, 40)}` : "manual",
    instruction: instruction ?? null,
  });

  const scores = await scorePost(newContent).catch(() => null);
  if (scores) {
    await db
      .update(schema.posts)
      .set({ hookStrengthScore: scores.hookStrength, specificityScore: scores.specificity })
      .where(eq(schema.posts.id, postId));
  }

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
  revalidatePath("/drafts");
  revalidatePath(`/posts/${postId}`);
}

export async function approvePostAction(postId: number, notes?: string) {
  await db
    .update(schema.posts)
    .set({ status: "approved", reviewerNotes: notes ?? null, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  revalidatePath("/drafts");
  revalidatePath(`/posts/${postId}`);
}

export async function rejectPostAction(postId: number, notes: string) {
  await db
    .update(schema.posts)
    .set({ status: "rejected", reviewerNotes: notes, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  revalidatePath("/drafts");
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
  revalidatePath("/drafts");
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
