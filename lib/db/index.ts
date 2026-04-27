import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Trim whitespace/newlines that can sneak in via copy-paste or Vercel env var encoding
const rawUrl = (process.env.DATABASE_URL ?? "").trim();

// neon() requires postgresql:// scheme; normalize postgres:// if present
const url = rawUrl.startsWith("postgres://") ? rawUrl.replace(/^postgres:\/\//, "postgresql://") : rawUrl;

// Use Neon serverless driver for Neon cloud; standard pg for local/other
const isNeon = url.includes(".neon.tech");

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createDb() {
  if (!url) throw new Error("DATABASE_URL is not set — add it to your Vercel project's environment variables.");

  if (isNeon) {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }

  const pool = global.__pgPool ?? new Pool({ connectionString: url });
  if (process.env.NODE_ENV !== "production") global.__pgPool = pool;
  return drizzlePg(pool, { schema });
}

export const db = (global.__db ?? (global.__db = createDb())) as ReturnType<typeof createDb>;
export { schema };
