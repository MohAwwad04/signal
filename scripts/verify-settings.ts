import { db, schema } from "../lib/db";
import { eq } from "drizzle-orm";

async function main() {
  // Mimic exactly what the settings page does
  const users = await db.select().from(schema.users).where(eq(schema.users.email, "alice.morgan@signal.app")).limit(1);
  const user = users[0];
  console.log("User authorId:", user?.authorId);

  const authors = await db.select().from(schema.authors).where(eq(schema.authors.id, user.authorId!));
  const author = authors[0];
  console.log("voiceProfile:", author.voiceProfile ? "SET ✓" : "NULL ✗");
  console.log("styleNotes:", author.styleNotes ? "SET ✓" : "NULL ✗");
  console.log("contentAngles:", JSON.stringify(author.contentAngles));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
