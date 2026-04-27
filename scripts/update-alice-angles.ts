import { db, schema } from "../lib/db";
import { sql } from "drizzle-orm";

const angles = ["Engineering Culture", "Hiring & Culture", "Team Building", "Leadership Development"];

async function main() {
  // Get Alice's author id
  const rows = await db.execute(sql`
    SELECT a.id AS author_id FROM authors a
    JOIN users u ON u.author_id = a.id
    WHERE u.email = 'alice.morgan@signal.app'
  `);
  const author_id = (rows.rows[0] as any).author_id;

  // Delete existing links
  await db.execute(sql`
    DELETE FROM author_content_angles WHERE author_id = ${author_id}
  `);

  // Re-insert with updated angles
  for (const name of angles) {
    await db.execute(sql`
      INSERT INTO author_content_angles (author_id, content_angle_id)
      SELECT ${author_id}, id FROM content_angles WHERE name = ${name}
      ON CONFLICT DO NOTHING
    `);
  }

  console.log(`✓ Re-linked ${angles.length} content angles for author ${author_id}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
