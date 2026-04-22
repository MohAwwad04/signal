"use server";

import { db, schema } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { desc, eq, and, sql, lt, inArray, ilike, or } from "drizzle-orm";
import { extractLinkedinPostUrn, fetchLinkedinAuthoredPosts, getValidLinkedinToken } from "@/lib/linkedin";
import {
  generatePostsFromTranscript,
  generatePost,
  assistedEdit,
  scorePost,
  learnVoiceFromEdits,
  generateDesignBrief,
  reformatPostWithFramework,
  analyzeLinkedinPosts,
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
      sourceExcerpt: s.sourceExcerpt ?? null,
    };
  });
  const inserted = await db.insert(schema.signals).values(rows).returning();

  // Auto-score and auto-star best framework for each signal in parallel
  const frameworks = await db.select().from(schema.frameworks);
  await Promise.all(
    inserted.map(async (signal) => {
      const bestFw =
        frameworks.find((f) => (f.bestFor as string[] | null ?? []).includes(signal.contentType)) ??
        frameworks[0] ??
        null;
      const scores = await scorePost(signal.rawContent).catch(() => null);
      const patch: Record<string, unknown> = {};
      if (bestFw) patch.bestFrameworkId = bestFw.id;
      if (scores) {
        patch.hookStrengthScore = scores.hookStrength;
        patch.specificityScore = scores.specificity;
        patch.clarityScore = scores.clarity;
        patch.emotionalResonanceScore = scores.emotionalResonance;
        patch.callToActionScore = scores.callToAction;
      }
      if (Object.keys(patch).length) {
        await db.update(schema.signals).set(patch as any).where(eq(schema.signals.id, signal.id));
      }
    })
  );

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

  // Auto-score and auto-star best framework
  const [frameworks, scores] = await Promise.all([
    db.select().from(schema.frameworks),
    scorePost(row.rawContent).catch(() => null),
  ]);
  const bestFw =
    frameworks.find((f) => (f.bestFor as string[] | null ?? []).includes(row.contentType)) ??
    frameworks[0] ??
    null;
  const patch: Record<string, unknown> = {};
  if (bestFw) patch.bestFrameworkId = bestFw.id;
  if (scores) {
    patch.hookStrengthScore = scores.hookStrength;
    patch.specificityScore = scores.specificity;
    patch.clarityScore = scores.clarity;
    patch.emotionalResonanceScore = scores.emotionalResonance;
    patch.callToActionScore = scores.callToAction;
  }
  if (Object.keys(patch).length) {
    await db.update(schema.signals).set(patch as any).where(eq(schema.signals.id, row.id));
  }

  revalidatePath("/signals");
  return { ...row, ...patch };
}

export async function scoreSignalAction(id: number) {
  const [signal] = await db.select().from(schema.signals).where(eq(schema.signals.id, id));
  if (!signal) throw new Error("Signal not found.");
  const scores = await scorePost(signal.rawContent);
  await db.update(schema.signals)
    .set({
      hookStrengthScore: scores.hookStrength,
      specificityScore: scores.specificity,
      clarityScore: scores.clarity,
      emotionalResonanceScore: scores.emotionalResonance,
      callToActionScore: scores.callToAction,
    } as any)
    .where(eq(schema.signals.id, id));
  revalidatePath(`/signals/${id}`);
  return scores;
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
  email?: string;
}) {
  const email = input.email?.toLowerCase().trim() || null;
  const [row] = await db
    .insert(schema.authors)
    .values({
      name: input.name,
      role: input.role ?? null,
      bio: input.bio ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      styleNotes: input.styleNotes ?? null,
      email,
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

/* ========== USERS ========== */

export async function addUserAction(email: string, role: "admin" | "user") {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) throw new Error("Invalid email.");

  const { getCurrentUser } = await import("@/lib/session");
  const session = await getCurrentUser();
  if (!session?.isAdmin) throw new Error("Not authorised.");
  // Only superadmin can create other admins
  if (role === "admin" && !session.isSuperAdmin) throw new Error("Only the superadmin can create admin accounts.");

  await db
    .insert(schema.users)
    .values({ email: normalized, role, invitedBy: session.email })
    .onConflictDoUpdate({ target: schema.users.email, set: { role, invitedBy: session.email } });

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db.insert(schema.authTokens).values({
    email: normalized,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const { sendInviteEmail } = await import("@/lib/email");
  await sendInviteEmail(normalized, token);

  revalidatePath("/authors");
}

export async function removeUserAction(id: number) {
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/authors");
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
  const defaultScores = { hookStrength: 0, specificity: 0, clarity: 0, emotionalResonance: 0, callToAction: 0, notes: "" };
  let scores = await scorePost(text).catch(() => defaultScores);

  const totalScore = (s: typeof scores) => s.hookStrength + s.specificity + s.clarity + s.emotionalResonance + s.callToAction;
  if (totalScore(scores) / 5 < 60) {
    const retry = await generatePost(postInput).catch(() => null);
    if (retry) {
      const retryScores = await scorePost(retry).catch(() => null);
      if (retryScores && totalScore(retryScores) > totalScore(scores)) {
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
      clarityScore: scores.clarity,
      emotionalResonanceScore: scores.emotionalResonance,
      callToActionScore: scores.callToAction,
      status: "draft",
    } as any)
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
      .set({
        hookStrengthScore: scores.hookStrength,
        specificityScore: scores.specificity,
        clarityScore: scores.clarity,
        emotionalResonanceScore: scores.emotionalResonance,
        callToActionScore: scores.callToAction,
      } as any)
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

/* ========== LINKEDIN PROFILE ANALYSIS ========== */

async function applyLinkedinAnalysis(authorId: number, posts: string[]): Promise<{ postsFound: number; message: string }> {
  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId));
  if (!author) throw new Error("Author not found.");

  const allFrameworks = await db.select({ name: schema.frameworks.name, description: schema.frameworks.description }).from(schema.frameworks);
  const analysis = await analyzeLinkedinPosts(posts, allFrameworks);

  const allFwRows = await db.select().from(schema.frameworks);
  const preferredIds = analysis.preferredFrameworkNames
    .map((name) => allFwRows.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is number => id !== undefined);

  const patch: Record<string, unknown> = {};
  if (!author.voiceProfile && analysis.voiceProfile) patch.voiceProfile = analysis.voiceProfile;
  if (!author.styleNotes && analysis.styleNotes) patch.styleNotes = analysis.styleNotes;
  if ((!author.contentAngles || (author.contentAngles as string[]).length === 0) && analysis.contentAngles.length > 0) {
    patch.contentAngles = analysis.contentAngles;
  }
  if ((!author.preferredFrameworks || (author.preferredFrameworks as number[]).length === 0) && preferredIds.length > 0) {
    patch.preferredFrameworks = preferredIds;
  }

  if (Object.keys(patch).length > 0) {
    await db.update(schema.authors).set(patch as any).where(eq(schema.authors.id, authorId));
  }
  if (patch.contentAngles) {
    await updateAuthorContentAnglesAction(authorId, analysis.contentAngles);
  }

  revalidatePath(`/authors/${authorId}`);
  return { postsFound: posts.length, message: `Analyzed ${posts.length} posts and updated your profile.` };
}

export async function analyzeLinkedinProfileAction(authorId: number): Promise<{
  ok: boolean;
  postsFound: number;
  message: string;
}> {
  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId));
  if (!author) throw new Error("Author not found.");
  if (!author.linkedinAccessToken || !author.linkedinMemberId) {
    throw new Error("LinkedIn is not connected for this author.");
  }

  const token = await getValidLinkedinToken(authorId);
  const posts = await fetchLinkedinAuthoredPosts(token, author.linkedinMemberId);

  if (!posts || posts.length === 0) {
    return { ok: false, postsFound: 0, message: "No published posts found via API — try pasting your posts manually below." };
  }

  const result = await applyLinkedinAnalysis(authorId, posts);
  return { ok: true, ...result };
}

export async function analyzeLinkedinPostsFromTextAction(authorId: number, rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length < 100) {
    throw new Error("Please paste at least a few posts (100+ characters).");
  }
  // Split on 3+ newlines or explicit separators
  const posts = rawText
    .split(/\n{3,}|(?:\n|^)-{3,}(?:\n|$)/)
    .map((p) => p.trim())
    .filter((p) => p.length > 60);

  const chunks = posts.length > 0 ? posts : [rawText.trim()];
  const result = await applyLinkedinAnalysis(authorId, chunks);
  return result.message;
}
