import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(sql`
    SELECT a.id, a.name, a.voice_profile, a.style_notes, a.content_angles
    FROM authors a
    JOIN users u ON u.author_id = a.id
    WHERE u.email = 'alice.morgan@signal.app'
  `);
  console.log(JSON.stringify(rows.rows[0], null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
