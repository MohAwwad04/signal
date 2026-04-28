/**
 * Seeds Dana Shaheen as an admin author with full profile data
 * gathered from her LinkedIn profile (https://www.linkedin.com/in/danashaheen/).
 *
 * Run: npx tsx scripts/seed-dana-shaheen.ts
 */

import { db, schema } from "../lib/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";

const USER_EMAIL = "dana@signal.app";
const USER_ROLE: "admin" | "superadmin" | "user" = "admin";

const LINKEDIN_URL = "https://www.linkedin.com/in/danashaheen/";

const CONTENT_ANGLES = [
  "Arab women in the workforce",
  "Founder productivity & delegation",
  "Fintech & digital banking in MENA",
  "Entrepreneurship & startup journey",
  "Remote work for Arab talent",
  "Women in tech & fintech",
  "MENA startup ecosystem",
  "Social impact & humanitarian causes",
];

const VOICE_PROFILE = `\
- Opens with a bold transformation hook ("One year can change everything") — never a generic greeting
- First-person singular throughout; deeply personal, not corporate
- Blends founder vulnerability ("I've spent 12 months obsessing over a problem I've lived myself") with concrete business outcomes
- Uses specific numbers to anchor every claim: placements, growth percentages, timelines
- Strategic emoji placement at section breaks (💔 🤲🏻 ✅) — never mid-sentence, never decorative
- Short punchy paragraphs (1-3 lines) separated by white space
- Closes with a purpose-driven line that carries weight ("Building with purpose")
- Explains Arabic concepts in English inline for bilingual clarity (YOUMNA = "right hand")
- Humanises business metrics through individual stories and named people
- Avoids corporate jargon; prefers "right hand" over "operational leverage"`;

const STYLE_NOTES =
  "Conversational yet strategic founder voice. Every post balances personal narrative with measurable impact, rooted in Arab women's empowerment and the MENA startup ecosystem. Posts feel like honest dispatches from the build — never polished press releases.";

const PERFORMANCE_HINTS = `\
- Anniversary/milestone posts (company birthdays, placements hit) consistently outperform regular content — lead with the number, then the story behind it
- Fintech insight posts perform best when framed through UAE/MENA specificity rather than global generalisation
- Humanitarian and social cause posts drive highest emotional engagement — use firsthand testimony and named individuals
- Posts that explain a problem the author personally lived before solving it get the strongest "me too" replies
- Metrics paired with human stories (100 women placed = 100 lives changed) beat pure data posts
- Bullet-point insight posts with visual markers (〰) work well for curated roundups and conference takeaways
- Bilingual hooks (Arabic word + English meaning) create differentiation and cultural connection in the MENA feed
- Posts featuring other people by name (founders, team members) drive more comments than solo reflections`;

async function main() {
  console.log("\n📋  Seeding Dana Shaheen author profile…");

  // ── Look up matching framework IDs ──────────────────────────────────────
  const frameworks = await db
    .select({ id: schema.frameworks.id, name: schema.frameworks.name })
    .from(schema.frameworks);

  const preferredNames = ["Hook · Story · Lesson", "Data drop", "Before · After · Bridge"];
  const preferredFrameworkIds = preferredNames
    .map((name) => frameworks.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is number => id !== undefined);

  console.log(
    `   Matched ${preferredFrameworkIds.length}/${preferredNames.length} preferred frameworks`
  );

  // ── Check if author already exists ───────────────────────────────────────
  const existing = await db
    .select({ id: schema.authors.id })
    .from(schema.authors)
    .where(eq(schema.authors.linkedinUrl, LINKEDIN_URL));

  let authorId: number;

  if (existing.length > 0) {
    authorId = existing[0].id;
    console.log(`   Author already exists (id=${authorId}) — updating profile…`);
    await db
      .update(schema.authors)
      .set({
        name: "Dana Shaheen",
        role: "Founder, YOUMNA",
        bio: "Founder of YOUMNA (يمنـــى) — the world's first Arabic-speaking productivity platform matching leaders with trained remote 'right hands'. Previously Director of Fintech & Digital Banking MENA at Visa. MBA, London Business School. Based in Dubai.",
        linkedinUrl: LINKEDIN_URL,
        voiceProfile: VOICE_PROFILE,
        styleNotes: STYLE_NOTES,
        contentAngles: CONTENT_ANGLES,
        preferredFrameworks: preferredFrameworkIds,
        performanceLearningHints: PERFORMANCE_HINTS,
        performanceLearningUpdatedAt: new Date(),
        active: true,
      })
      .where(eq(schema.authors.id, authorId));
  } else {
    const [author] = await db
      .insert(schema.authors)
      .values({
        name: "Dana Shaheen",
        role: "Founder, YOUMNA",
        bio: "Founder of YOUMNA (يمنـــى) — the world's first Arabic-speaking productivity platform matching leaders with trained remote 'right hands'. Previously Director of Fintech & Digital Banking MENA at Visa. MBA, London Business School. Based in Dubai.",
        linkedinUrl: LINKEDIN_URL,
        voiceProfile: VOICE_PROFILE,
        styleNotes: STYLE_NOTES,
        contentAngles: CONTENT_ANGLES,
        preferredFrameworks: preferredFrameworkIds,
        performanceLearningHints: PERFORMANCE_HINTS,
        performanceLearningUpdatedAt: new Date(),
        active: true,
      })
      .returning();
    authorId = author.id;
    console.log(`   Author inserted (id=${authorId})`);
  }

  // ── Sync content angles to global pool + join table ─────────────────────
  let anglesLinked = 0;
  for (const angleName of CONTENT_ANGLES) {
    const existing = await db
      .select({ id: schema.contentAngles.id })
      .from(schema.contentAngles)
      .where(eq(schema.contentAngles.name, angleName));

    let angleId: number;
    if (existing.length > 0) {
      angleId = existing[0].id;
    } else {
      const [row] = await db
        .insert(schema.contentAngles)
        .values({ name: angleName })
        .returning();
      angleId = row.id;
    }

    await db
      .insert(schema.authorContentAngles)
      .values({ authorId, contentAngleId: angleId })
      .onConflictDoNothing();

    anglesLinked++;
  }
  console.log(`   Content angles linked: ${anglesLinked}`);

  // ── Ensure user account exists ───────────────────────────────────────────
  const normalizedEmail = USER_EMAIL.trim().toLowerCase();
  const existingUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail));

  if (existingUser.length > 0) {
    await db
      .update(schema.users)
      .set({ authorId, active: true })
      .where(eq(schema.users.email, normalizedEmail));
    console.log(`   User ${normalizedEmail} already exists — linked to author ${authorId}`);
  } else {
    const tempPassword = "Dana2025!";
    await db.insert(schema.users).values({
      email: normalizedEmail,
      role: USER_ROLE,
      authorId,
      active: true,
      passwordHash: hashPassword(tempPassword),
    });
    console.log(`   Created user: ${normalizedEmail} (role: ${USER_ROLE})`);
    console.log(`   Temp password: ${tempPassword}  ← change after first login`);
  }

  console.log(`\n✅  Dana Shaheen is live at /authors/${authorId}`);
  console.log(
    `\n   Profile summary:\n` +
    `   • Content angles: ${CONTENT_ANGLES.length}\n` +
    `   • Preferred frameworks: ${preferredFrameworkIds.length}\n` +
    `   • Voice profile: ${VOICE_PROFILE.split("\n").length} rules\n` +
    `   • Performance hints: ${PERFORMANCE_HINTS.split("\n").length} patterns`
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌  Error:", e?.message ?? e);
  process.exit(1);
});
