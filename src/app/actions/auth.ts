"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { allow } from "@/lib/ratelimit";
import { clearSession, hashToken, requireUser, signSession } from "@/lib/session";
import { isTimeZone } from "@/lib/time";

export type FormState = { error?: string; ok?: string } | undefined;

// Compared against when the email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export async function login(_: FormState, form: FormData): Promise<FormState> {
  if (!(await allow("login", 10, 600))) return { error: "Too many attempts. Wait ten minutes and try again." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const d = await db();
  const [u] = await d.select().from(schema.users).where(eq(schema.users.email, email));
  const ok = await bcrypt.compare(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok || u.disabled) return { error: "That email and password don't match an account." };
  await signSession(u.id);
  redirect("/");
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(80),
  email: z.email("Use a valid email address.").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  city: z.string().trim().max(80),
  tz: z.string().refine(isTimeZone, "Pick a time zone from the list."),
});

export async function joinWithInvite(token: string, _: FormState, form: FormData): Promise<FormState> {
  if (!(await allow("join", 20, 3600))) return { error: "Too many attempts from this network. Try again later." };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, email, password, city, tz } = parsed.data;
  const d = await db();
  const { invites, users } = schema;

  // Claim one use of the invite atomically; a stale, revoked or used-up link claims nothing.
  const [invite] = await d
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(and(eq(invites.tokenHash, hashToken(token)), eq(invites.revoked, false), gt(invites.expiresAt, new Date()), lt(invites.uses, invites.maxUses)))
    .returning();
  if (!invite) return { error: "This invite link has expired or been used up. Ask an admin for a new one." };

  const [existing] = await d.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    await d.update(invites).set({ uses: sql`${invites.uses} - 1` }).where(eq(invites.id, invite.id));
    return { error: "An account with this email already exists. Sign in instead." };
  }
  const [{ n }] = await d.select({ n: sql<number>`count(*)` }).from(users);
  const admins = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const role = Number(n) === 0 || admins.includes(email) ? "admin" : "member";
  const [u] = await d
    .insert(users)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 12), city, tz, role, inviteId: invite.id })
    .returning();
  await signSession(u.id);
  redirect("/");
}

export async function resetPassword(token: string, _: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  const d = await db();
  const [r] = await d
    .update(schema.passwordResets)
    .set({ used: true })
    .where(and(eq(schema.passwordResets.tokenHash, hashToken(token)), eq(schema.passwordResets.used, false), gt(schema.passwordResets.expiresAt, new Date())))
    .returning();
  if (!r) return { error: "This reset link has expired or was already used. Ask an admin for a new one." };
  await d.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(schema.users.id, r.userId));
  await signSession(r.userId);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const tz = String(form.get("tz") ?? "");
  if (!name) return { error: "Add your name." };
  if (!isTimeZone(tz)) return { error: "Pick a time zone from the list." };
  const d = await db();
  const set: Partial<typeof schema.users.$inferInsert> = { name: name.slice(0, 80), city: city.slice(0, 80), tz };
  const pw = String(form.get("password") ?? "");
  if (pw) {
    if (pw.length < 10) return { error: "A new password needs at least 10 characters." };
    set.passwordHash = await bcrypt.hash(pw, 12);
  }
  await d.update(schema.users).set(set).where(eq(schema.users.id, me.id));
  return { ok: "Saved." };
}
