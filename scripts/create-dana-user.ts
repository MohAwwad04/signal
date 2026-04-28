import { config } from "dotenv";
config({ path: ".env.local" });

import { db, schema } from "../lib/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";

async function main() {
  const email = "dana@signal.app";
  const tempPassword = "Dana2025!";
  const hashed = hashPassword(tempPassword);

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existing.length > 0) {
    await db
      .update(schema.users)
      .set({ authorId: 66, active: true })
      .where(eq(schema.users.email, email));
    console.log("Updated existing user — linked to author 66");
  } else {
    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        role: "admin",
        authorId: 66,
        active: true,
        passwordHash: hashed,
      })
      .returning();
    console.log(`Created user id=${user.id}`);
  }

  console.log(`\n✅  Dana can now log in:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${tempPassword}  ← change after first login`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e?.message ?? e);
  process.exit(1);
});
