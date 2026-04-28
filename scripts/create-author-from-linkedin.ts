/**
 * Creates a new author record by scraping and analyzing a LinkedIn profile.
 * Also creates an admin user linked to that author.
 *
 * Usage:
 *   npx tsx scripts/create-author-from-linkedin.ts \
 *     --url "https://www.linkedin.com/in/danashaheen/" \
 *     --email "dana@example.com" \
 *     --role "admin"
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, schema } from "../lib/db";
import { jinaGet } from "../lib/linkedin";
import { analyzeLinkedinPageContent, learnFromPerformance } from "../lib/claude";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name: string): string | null {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] ?? null : null;
}

const LINKEDIN_URL = arg("url") ?? "https://www.linkedin.com/in/danashaheen/";
const EMAIL        = arg("email") ?? "";
const ROLE         = (arg("role") ?? "admin") as "admin" | "superadmin" | "user";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isAuthWall(t: string) {
  return (
    t.includes("Sign in to LinkedIn") ||
    t.includes("authwall") ||
    t.includes("Join LinkedIn") ||
    t.includes("Be seen by employers")
  );
}

// Extract readable post blocks from Jina-scraped text
function extractPostBlocks(text: string): string[] {
  // Split on common separators Jina uses between sections
  const chunks = text.split(/\n{3,}|---+/).map((c) => c.trim()).filter(Boolean);
  // Keep chunks that look like posts (>80 chars, not just a heading)
  return chunks.filter((c) => c.length > 80 && !c.startsWith("#"));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const vanity = LINKEDIN_URL.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? null;
  if (!vanity) throw new Error("Could not parse LinkedIn vanity from URL");

  console.log(`\n🔍  Scraping LinkedIn profile: ${LINKEDIN_URL}`);

  const [profileRaw, activityRaw] = await Promise.all([
    jinaGet(LINKEDIN_URL),
    jinaGet(`https://www.linkedin.com/in/${vanity}/recent-activity/shares/`),
  ]);

  const profileText  = profileRaw  && !isAuthWall(profileRaw)  ? profileRaw  : null;
  const activityText = activityRaw && !isAuthWall(activityRaw) ? activityRaw : null;

  if (!profileText && !activityText) {
    throw new Error(
      "Could not read profile — it may be private or blocked. Make sure the profile URL is correct and set to public."
    );
  }

  const fullText = [profileText, activityText].filter(Boolean).join("\n\n---\n\n");
  console.log(`✅  Scraped ${fullText.length.toLocaleString()} chars`);

  // ── Fetch frameworks from DB ──────────────────────────────────────────────
  const frameworks = await db
    .select({ id: schema.frameworks.id, name: schema.frameworks.name, description: schema.frameworks.description })
    .from(schema.frameworks);

  if (frameworks.length === 0) {
    console.warn("⚠️  No frameworks in DB yet — run seed.ts first for best results.");
  }

  // ── AI analysis ───────────────────────────────────────────────────────────
  console.log("🤖  Analyzing profile with Claude…");
  const analysis = await analyzeLinkedinPageContent(fullText, frameworks);

  console.log(`   Content angles (${analysis.contentAngles.length}): ${analysis.contentAngles.join(", ")}`);
  console.log(`   Preferred frameworks: ${analysis.preferredFrameworkNames.join(", ") || "(none matched)"}`);
  console.log(`   Voice profile: ${analysis.voiceProfile ? "✓" : "empty"}`);
  console.log(`   Style notes: ${analysis.styleNotes || "(none)"}`);

  // ── Performance patterns (from post content, no real analytics) ──────────
  console.log("📊  Deriving performance patterns…");
  const postBlocks = extractPostBlocks(activityText ?? profileText ?? "");
  const topPostSamples = postBlocks.slice(0, 8).map((content) => ({
    content,
    hookLine: content.split("\n")[0] ?? "",
    contentAngle: null,
    frameworkName: null,
    impressions: 0,
    likes: 0,
    comments: 0,
  }));

  let performanceLearningHints: string | null = null;
  if (topPostSamples.length > 0) {
    const nameGuess = profileText?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? vanity;
    performanceLearningHints = await learnFromPerformance(nameGuess, topPostSamples, null).catch(() => null);
    if (performanceLearningHints) {
      console.log(`   Performance hints: ✓ (${performanceLearningHints.length} chars)`);
    }
  } else {
    console.log("   Performance hints: skipped (no post blocks found)");
  }

  // ── Resolve preferred framework IDs ──────────────────────────────────────
  const preferredFrameworkIds = analysis.preferredFrameworkNames
    .map((name) => frameworks.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is number => id !== undefined);

  // ── Extract name from scraped text ────────────────────────────────────────
  const scrapedName =
    profileText?.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    profileText?.match(/^(.{3,60})\n/m)?.[1]?.trim() ??
    vanity.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Extract role/headline ─────────────────────────────────────────────────
  const scrapedRole =
    profileText?.match(/\n##?\s+(.{5,100})\n/m)?.[1]?.trim() ??
    profileText?.match(/(?:^|\n)([\w\s,|·–-]{10,80})\n/m)?.[1]?.trim() ??
    null;

  // ── Insert author ─────────────────────────────────────────────────────────
  console.log(`\n💾  Inserting author: "${scrapedName}"`);

  const [author] = await db
    .insert(schema.authors)
    .values({
      name: scrapedName,
      role: scrapedRole ?? null,
      linkedinUrl: LINKEDIN_URL,
      voiceProfile: analysis.voiceProfile || null,
      styleNotes: analysis.styleNotes || null,
      contentAngles: analysis.contentAngles.length ? analysis.contentAngles : [],
      preferredFrameworks: preferredFrameworkIds,
      performanceLearningHints: performanceLearningHints ?? null,
      performanceLearningUpdatedAt: performanceLearningHints ? new Date() : null,
      active: true,
    })
    .returning();

  console.log(`   Author ID: ${author.id}`);

  // ── Insert content angles into global pool + join table ───────────────────
  for (const angleName of analysis.contentAngles) {
    const existing = await db
      .select()
      .from(schema.contentAngles)
      .where(eq(schema.contentAngles.name, angleName));

    let angleId: number;
    if (existing.length > 0) {
      angleId = existing[0].id;
    } else {
      const [row] = await db.insert(schema.contentAngles).values({ name: angleName }).returning();
      angleId = row.id;
    }

    await db
      .insert(schema.authorContentAngles)
      .values({ authorId: author.id, contentAngleId: angleId })
      .onConflictDoNothing();
  }
  console.log(`   Content angles linked: ${analysis.contentAngles.length}`);

  // ── Insert user (admin) ───────────────────────────────────────────────────
  if (EMAIL) {
    const normalizedEmail = EMAIL.trim().toLowerCase();
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (existingUser.length > 0) {
      console.log(`\n⚠️  User ${normalizedEmail} already exists — skipping user creation.`);
      await db
        .update(schema.users)
        .set({ authorId: author.id })
        .where(eq(schema.users.email, normalizedEmail));
      console.log(`   Linked existing user to author ${author.id}.`);
    } else {
      const tempPassword = Math.random().toString(36).slice(2, 10);
      const hashed = hashPassword(tempPassword);
      await db.insert(schema.users).values({
        email: normalizedEmail,
        role: ROLE,
        authorId: author.id,
        active: true,
        passwordHash: hashed,
      });
      console.log(`\n👤  Created user: ${normalizedEmail} (role: ${ROLE})`);
      console.log(`   Temp password: ${tempPassword}  ← change this after first login`);
    }
  } else {
    console.log("\n⚠️  No --email provided — author created without a user account.");
  }

  console.log(`\n✅  Done. Author "${scrapedName}" is live at /authors/${author.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌  Error:", e?.message ?? e);
  process.exit(1);
});
