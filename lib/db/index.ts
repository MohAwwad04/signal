import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __sqlClient: ReturnType<typeof neon> | undefined;
}

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set");
}

const sql = global.__sqlClient ?? neon(process.env.DATABASE_URL ?? "postgres://placeholder");
if (process.env.NODE_ENV !== "production") global.__sqlClient = sql;

export const db = drizzle(sql, { schema });
export { schema };
