import { db } from "../lib/db";
import { sql } from "drizzle-orm";

const voiceProfile = `- Opens with a direct personal question or relatable scenario — never a generic claim
- Uses 'I' throughout — personal accountability, not institutional voice
- Pairs vulnerability with confidence: admits the hard thing, then names what changed
- Grounds every point in a specific experience, metric, or moment — no abstractions
- Alternates short punchy sentences with longer reflective ones for rhythm
- Ends with an open invitation or question — never a hard CTA
- Uses purposeful emojis sparingly, never decoratively
- Frames work as meaning, not just output`;

const styleNotes =
  "Authentic and emotionally honest — never purely analytical. Balances personal story with concrete engineering insight. Entrepreneurial confidence without arrogance. Shares the experience and lets the reader draw their own conclusion — never preachy.";

const contentAngles = ["Engineering Culture", "Hiring & Culture", "Team Building", "Leadership Development"];

async function main() {
  const result = await db.execute(sql`
    UPDATE authors
    SET
      voice_profile    = ${voiceProfile},
      style_notes      = ${styleNotes},
      content_angles   = ${JSON.stringify(contentAngles)}::jsonb
    WHERE id = (
      SELECT a.id FROM authors a
      JOIN users u ON u.author_id = a.id
      WHERE u.email = 'alice.morgan@signal.app'
    )
  `);
  console.log(`✓ Updated ${result.rowCount} author row`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
