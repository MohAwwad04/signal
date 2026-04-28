import { config } from "dotenv";
config({ path: ".env.local" });
import { db, schema } from "../lib/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";

async function main() {
  const email = "dana@signal.app";

  const users = await db.select().from(schema.users).where(eq(schema.users.email, email));
  console.log("Users found:", users.length);
  if (users.length > 0) {
    const u = users[0];
    console.log({ id: u.id, email: u.email, role: u.role, active: u.active, authorId: u.authorId, hasPassword: !!u.passwordHash });
    process.exit(0);
  }

  // Not found — create now
  console.log("Not found — creating…");
  const [user] = await db.insert(schema.users).values({
    email,
    role: "admin",
    authorId: 66,
    active: true,
    passwordHash: hashPassword("Dana2025!"),
  }).returning();
  console.log("Created:", { id: user.id, email: user.email, role: user.role, active: user.active });
  process.exit(0);
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1); });
