import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

declare global {
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
}

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set");
}

const pool =
  global.__pool ??
  new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://placeholder" });

if (process.env.NODE_ENV !== "production") global.__pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
