import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const [authToken] = await db
    .select()
    .from(schema.authTokens)
    .where(and(eq(schema.authTokens.token, token), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
    .limit(1);

  if (!authToken) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 403 });

  const [user] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, authToken.email))
    .limit(1);

  return NextResponse.json({ role: user?.role ?? "user", email: authToken.email });
}
