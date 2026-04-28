import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check the user record
  const user = await db.execute(sql`
    SELECT u.id, u.email, u.role, u.active, u.author_id
    FROM users u
    WHERE u.email = 'alice.morgan@signal.app'
  `);
  console.log("User:", JSON.stringify(user.rows[0], null, 2));

  // Check the author record
  const author = await db.execute(sql`
    SELECT a.id, a.name, a.voice_profile IS NOT NULL as has_voice,
           a.style_notes IS NOT NULL as has_style,
           a.content_angles
    FROM authors a
    WHERE a.id = (SELECT author_id FROM users WHERE email = 'alice.morgan@signal.app')
  `);
  console.log("Author:", JSON.stringify(author.rows[0], null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
