import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const SUPERADMIN_EMAIL = "moh.awwad.243@gmail.com";

export type SessionUser = {
  email: string;
  role: "superadmin" | "admin" | "user";
  authorId: number | null;
  isSuperAdmin: boolean;
  isAdmin: boolean; // true for superadmin and admin
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const email = cookieStore.get("signal_email")?.value?.toLowerCase().trim();
  if (!email) return null;

  if (email === SUPERADMIN_EMAIL) {
    return { email, role: "superadmin", authorId: null, isSuperAdmin: true, isAdmin: true };
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
    isSuperAdmin: false,
    isAdmin: role === "admin",
  };
}
