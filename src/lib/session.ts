import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { db, schema } from "@/db";

export const SESSION_COOKIE = "hq_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type SessionUser = typeof schema.users.$inferSelect;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters).");
  return new TextEncoder().encode(s);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(18).toString("base64url");

export async function signSession(userId: string) {
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(SESSION_COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  const id = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const d = await db();
  const [u] = await d.select().from(schema.users).where(eq(schema.users.id, id));
  return u && !u.disabled ? u : null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}
