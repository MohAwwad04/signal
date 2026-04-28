import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { verifyPassword } from "../lib/password";

async function main() {
  const rows = await db.execute(sql`
    SELECT email, password_hash, active FROM users WHERE email = 'alice.morgan@signal.app'
  `);
  const user = rows.rows[0] as any;
  console.log("active:", user.active);
  console.log("has hash:", !!user.password_hash);
  console.log("Pass@001 matches:", verifyPassword("Pass@001", user.password_hash));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
