import { cache } from "react";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { SUPERADMIN_EMAIL } from "@/lib/auth";

export type SessionUser = {
  email: string;
  role: "superadmin" | "admin" | "user";
  authorId: number | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
};

export const getVisibleAuthorIds = cache(async (): Promise<number[] | null> => {
  const session = await getCurrentUser();
  if (!session) return [];
  if (session.isSuperAdmin) return null;
  if (session.isAdmin && session.email) {
    const invited = await db
      .select({ authorId: schema.users.authorId })
      .from(schema.users)
      .where(eq(schema.users.invitedBy, session.email))
      .catch(() => []);
    const ids = new Set<number>();
    for (const u of invited) if (u.authorId != null) ids.add(u.authorId);
    if (session.authorId) ids.add(session.authorId);
    return [...ids];
  }
  return session.authorId ? [session.authorId] : [];
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = cookies();
  const email = cookieStore.get("signal_email")?.value?.toLowerCase().trim();
  const sessionToken = cookieStore.get("signal_auth")?.value;
  if (!email) return null;

  if (!sessionToken) return null;

  // Single-session: find the latest valid session for this email and reject if it's not this token
  const [latestSession] = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.email, email), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.createdAt))
    .limit(1)
    .catch(() => []);

  if (!latestSession || latestSession.token !== sessionToken) return null;

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

  const dbRole = user.role as "superadmin" | "admin" | "user";
  const isSuperAdmin = dbRole === "superadmin";
  return {
    email: user.email,
    role: isSuperAdmin ? "superadmin" : dbRole,
    authorId: user.authorId ?? null,
    isSuperAdmin,
    isAdmin: isSuperAdmin || dbRole === "admin",
  };
});
