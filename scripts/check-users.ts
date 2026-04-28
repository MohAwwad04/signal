import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const users = await db.execute(sql`
    SELECT u.email, u.role, u.active, u.author_id,
           a.name, a.voice_profile IS NOT NULL as has_voice
    FROM users u
    LEFT JOIN authors a ON a.id = u.author_id
    ORDER BY u.id
  `);
  console.table(users.rows);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
