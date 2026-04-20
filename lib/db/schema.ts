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

/** A piece of raw content captured from a meeting that could become a post. */
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  rawContent: text("raw_content").notNull(),
  contentType: varchar("content_type", { length: 64 }).notNull(), // success_metric, paying_quote, buying_signal, etc.
  vertical: varchar("vertical", { length: 64 }),
  source: varchar("source", { length: 64 }).default("manual"), // fathom, fireflies, manual
  sourceMeetingId: varchar("source_meeting_id", { length: 128 }),
  sourceMeetingTitle: text("source_meeting_title"),
  sourceMeetingDate: timestamp("source_meeting_date"),
  speaker: varchar("speaker", { length: 128 }),
  contentAngles: jsonb("content_angles").$type<string[]>().default([]),
  recommendedAuthorId: integer("recommended_author_id"),
  status: signalStatus("status").default("unused").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** People whose voice we're writing in. */
export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 128 }), // CTO, Head of Sales, etc.
  bio: text("bio"),
  linkedinUrl: text("linkedin_url"),
  /** Voice profile is built up automatically from edits. */
  voiceProfile: text("voice_profile"),
  /** Stylistic guardrails the author insists on. */
  styleNotes: text("style_notes"),
  preferredFrameworks: jsonb("preferred_frameworks").$type<number[]>().default([]),
  contentAngles: jsonb("content_angles").$type<string[]>(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Fathom OAuth integration
  fathomAccessToken: text("fathom_access_token"),
  fathomRefreshToken: text("fathom_refresh_token"),
  fathomTokenExpiresAt: timestamp("fathom_token_expires_at"),
  fathomUserId: varchar("fathom_user_id", { length: 128 }),
  fathomUserEmail: varchar("fathom_user_email", { length: 256 }),
  fathomConnectedAt: timestamp("fathom_connected_at"),
  fathomLastSyncedAt: timestamp("fathom_last_synced_at"),
});

/** Reusable post structures (Hook→Story→Lesson, Before/After, etc.) */
export const frameworks = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(),
  /** A short prompt fragment that teaches Claude how to apply this framework. */
  promptTemplate: text("prompt_template").notNull(),
  bestFor: jsonb("best_for").$type<string[]>().default([]), // signal types this works well with
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** A generated (and possibly edited) post. */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").references(() => signals.id, { onDelete: "set null" }),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "set null" }),
  frameworkId: integer("framework_id").references(() => frameworks.id, { onDelete: "set null" }),
  contentAngle: text("content_angle"),
  /** Current text of the post. */
  content: text("content").notNull(),
  /** First version Claude produced — never overwritten. Used for diffing edits. */
  originalContent: text("original_content").notNull(),
  hookStrengthScore: integer("hook_strength_score"), // 0-100
  specificityScore: integer("specificity_score"), // 0-100
  status: postStatus("status").default("draft").notNull(),
  reviewerNotes: text("reviewer_notes"),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Every edit to a post — used to learn each author's voice. */
export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "set null" }),
  before: text("before").notNull(),
  after: text("after").notNull(),
  editType: varchar("edit_type", { length: 32 }).notNull(), // manual, assisted_shorter, assisted_more_technical, assisted_hook, etc.
  instruction: text("instruction"), // for assisted edits, what the user asked for
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

/** CSRF-protected OAuth state for Fathom connect flow. */
export const oauthStates = pgTable("oauth_states", {
  id: serial("id").primaryKey(),
  state: varchar("state", { length: 64 }).notNull(),
  authorId: integer("author_id").references(() => authors.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
  stateIdx: uniqueIndex("oauth_states_state_idx").on(t.state),
}));

export type Signal = typeof signals.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Edit = typeof edits.$inferSelect;
export type AnalyticsRow = typeof analytics.$inferSelect;
export type DesignBrief = typeof designBriefs.$inferSelect;
