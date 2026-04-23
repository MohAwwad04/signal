import { cache } from "react";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { SUPERADMIN_EMAIL } from "@/lib/auth";

export type SessionUser = {
  email: string;
  role: "superadmin" | "admin" | "user";
  authorId: number | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
};

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = cookies();
  const email = cookieStore.get("signal_email")?.value?.toLowerCase().trim();
  if (!email) return null;

  // Hardcoded superadmin
  if (email === SUPERADMIN_EMAIL) {
    return { email, role: "superadmin", authorId: null, isSuperAdmin: true, isAdmin: true };
  }

  // Env-var admins (ALLOWED_EMAILS) are treated as superadmin-level
  const envAdmins = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (envAdmins.includes(email)) {
    return { email, role: "superadmin", authorId: null, isSuperAdmin: true, isAdmin: true };
  }

  // DB users
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
    .catch(() => []);

  if (!user) return null;

  const role = user.role as "admin" | "user";
  return {
    email: user.email,
    role,
    authorId: user.authorId ?? null,
    isSuperAdmin: false,
    isAdmin: role === "admin",
  };
});
