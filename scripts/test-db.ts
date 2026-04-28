import { config } from "dotenv";
config({ path: ".env.local" });
import { db, schema } from "../lib/db";

async function run() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.slice(0, 40));
  const r = await db.select({ id: schema.sessions.id, email: schema.sessions.email }).from(schema.sessions).limit(3);
  console.log("Sessions:", r);
  process.exit(0);
}
run().catch(e => { console.error("DB ERROR:", e?.message); process.exit(1); });
