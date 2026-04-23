import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  varchar,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const signalStatus = pgEnum("signal_status", [
  "unused",
  "drafting",
  "used",
  "archived",
]);

export const postStatus = pgEnum("post_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "published",
]);

/** Raw meeting transcript, source of truth for signal extraction. */
export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  content: text("content").notNull(),
  source: varchar("source", { length: 64 }).default("manual").notNull(),
  sourceMeetingId: varchar("source_meeting_id", { length: 128 }),
  sourceMeetingDate: timestamp("source_meeting_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** A piece of raw content captured from a meeting that could become a post. */
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }),
  rawContent: text("raw_content").notNull(),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  contentType: varchar("content_type", { length: 64 }).notNull(),
  vertical: varchar("vertical", { length: 64 }),
  source: varchar("source", { length: 64 }).default("manual"),
  sourceMeetingId: varchar("source_meeting_id", { length: 128 }),
  sourceMeetingTitle: text("source_meeting_title"),
  sourceMeetingDate: timestamp("source_meeting_date"),
  speaker: varchar("speaker", { length: 128 }),
  contentAngles: jsonb("content_angles").$type<string[]>().default([]),
  recommendedAuthorId: integer("recommended_author_id"),
  bestFrameworkId: integer("best_framework_id"),
  sourceTranscript: text("source_transcript"),
  sourceExcerpt: text("source_excerpt"),
  transcriptId: integer("transcript_id").references(() => transcripts.id, { onDelete: "set null" }),
  hookStrengthScore: integer("hook_strength_score"),
  specificityScore: integer("specificity_score"),
  clarityScore: integer("clarity_score"),
  emotionalResonanceScore: integer("emotional_resonance_score"),
  callToActionScore: integer("call_to_action_score"),
  status: signalStatus("status").default("unused").notNull(),
  notes: text("notes"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  statusIdx: index("signals_status_idx").on(t.status),
  createdAtIdx: index("signals_created_at_idx").on(t.createdAt),
}));

/** People whose voice we're writing in. */
export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 128 }),
  bio: text("bio"),
  linkedinUrl: text("linkedin_url"),
  voiceProfile: text("voice_profile"),
  styleNotes: text("style_notes"),
  preferredFrameworks: jsonb("preferred_frameworks").$type<number[]>().default([]),
  contentAngles: jsonb("content_angles").$type<string[]>(),
  email: varchar("email", { length: 256 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fathomAccessToken: text("fathom_access_token"),
  fathomRefreshToken: text("fathom_refresh_token"),
  fathomTokenExpiresAt: timestamp("fathom_token_expires_at"),
  fathomUserId: varchar("fathom_user_id", { length: 128 }),
  fathomUserEmail: varchar("fathom_user_email", { length: 256 }),
  fathomConnectedAt: timestamp("fathom_connected_at"),
  fathomLastSyncedAt: timestamp("fathom_last_synced_at"),
  linkedinAccessToken: text("linkedin_access_token"),
  linkedinRefreshToken: text("linkedin_refresh_token"),
  linkedinTokenExpiresAt: timestamp("linkedin_token_expires_at"),
  linkedinMemberId: varchar("linkedin_member_id", { length: 128 }),
  linkedinMemberName: varchar("linkedin_member_name", { length: 256 }),
  linkedinConnectedAt: timestamp("linkedin_connected_at"),
  linkedinLastSyncedAt: timestamp("linkedin_last_synced_at"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),
  googleUserEmail: varchar("google_user_email", { length: 256 }),
  googleConnectedAt: timestamp("google_connected_at"),
  googleLastSyncedAt: timestamp("google_last_synced_at"),
});

/** Global pool of named content angles, independent of any author. */
export const contentAngles = pgTable("content_angles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  nameIdx: uniqueIndex("content_angles_name_idx").on(t.name),
}));

/** Join table: which authors are associated with which content angles. */
export const authorContentAngles = pgTable("author_content_angles", {
  authorId: integer("author_id").references(() => authors.id, { onDelete: "cascade" }).notNull(),
  contentAngleId: integer("content_angle_id").references(() => contentAngles.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.authorId, t.contentAngleId] }),
}));

/** Reusable post structures (Hook→Story→Lesson, Before/After, etc.) */
export const frameworks = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(),
  promptTemplate: text("prompt_template").notNull(),
  bestFor: jsonb("best_for").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** A generated (and possibly edited) post. */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").references(() => signals.id, { onDelete: "set null" }),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "set null" }),
  frameworkId: integer("framework_id").references(() => frameworks.id, { onDelete: "set null" }),
  contentAngle: text("content_angle"),
  content: text("content").notNull(),
  originalContent: text("original_content").notNull(),
  hookStrengthScore: integer("hook_strength_score"),
  specificityScore: integer("specificity_score"),
  clarityScore: integer("clarity_score"),
  emotionalResonanceScore: integer("emotional_resonance_score"),
  callToActionScore: integer("call_to_action_score"),
  status: postStatus("status").default("draft").notNull(),
  reviewerNotes: text("reviewer_notes"),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  linkedinPostUrn: varchar("linkedin_post_urn", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  authorIdIdx: index("posts_author_id_idx").on(t.authorId),
  statusIdx: index("posts_status_idx").on(t.status),
  authorStatusIdx: index("posts_author_status_idx").on(t.authorId, t.status),
  createdAtIdx: index("posts_created_at_idx").on(t.createdAt),
}));

/** Every edit to a post or signal — used to learn each author's voice. */
export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }),
  signalId: integer("signal_id").references(() => signals.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "set null" }),
  before: text("before").notNull(),
  after: text("after").notNull(),
  editType: varchar("edit_type", { length: 32 }).notNull(),
  instruction: text("instruction"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Performance metrics pulled or entered for a published post. */
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  impressions: integer("impressions").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  clicks: integer("clicks").default(0),
  source: varchar("source", { length: 32 }).default("manual"),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

/** Design briefs generated for approved posts. */
export const designBriefs = pgTable("design_briefs", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  objective: text("objective").notNull(),
  targetAudience: text("target_audience").notNull(),
  tone: text("tone").notNull(),
  keyMessages: jsonb("key_messages").$type<string[]>().default([]),
  designDirection: text("design_direction").notNull(),
  svg: text("svg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Team members who can log in, with their access role. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 256 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("user"), // 'superadmin' | 'admin' | 'user'
  passwordHash: text("password_hash"),
  active: boolean("active").default(false).notNull(),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "set null" }),
  invitedBy: varchar("invited_by", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

/** Magic-link auth: tokens issued to allowed emails. */
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 256 }).notNull(),
  token: varchar("token", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("auth_tokens_token_idx").on(t.token),
}));

/** CSRF-protected OAuth state for Fathom/LinkedIn connect flow. */
export const oauthStates = pgTable("oauth_states", {
  id: serial("id").primaryKey(),
  state: varchar("state", { length: 64 }).notNull(),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).default("fathom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
  stateIdx: uniqueIndex("oauth_states_state_idx").on(t.state),
}));

export type Transcript = typeof transcripts.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Edit = typeof edits.$inferSelect;
export type AnalyticsRow = typeof analytics.$inferSelect;
export type DesignBrief = typeof designBriefs.$inferSelect;
export type ContentAngle = typeof contentAngles.$inferSelect;
export type AuthorContentAngle = typeof authorContentAngles.$inferSelect;
export type User = typeof users.$inferSelect;
