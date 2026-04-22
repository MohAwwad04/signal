import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export type SessionUser = {
  email: string;
  role: "admin" | "user";
  authorId: number | null;
  isAdmin: boolean;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const email = cookieStore.get("signal_email")?.value?.toLowerCase().trim();
  if (!email) return null;

  // Env-var admins always get full access
  const envAdmins = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (envAdmins.includes(email)) {
    return { email, role: "admin", authorId: null, isAdmin: true };
  }

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
    isAdmin: role === "admin",
  };
}
