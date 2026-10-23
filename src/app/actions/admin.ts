"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { hashToken, newToken, requireAdmin } from "@/lib/session";

export type LinkResult = { url?: string; error?: string } | undefined;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only the hash is stored, so the link is shown once; a lost link means making a new one. */
export async function createInvite(_: LinkResult, form: FormData): Promise<LinkResult> {
  const me = await requireAdmin();
  const days = Math.min(14, Math.max(1, Number(form.get("days") ?? 4)));
  const maxUses = Math.min(50, Math.max(1, Number(form.get("maxUses") ?? 10)));
  const token = newToken();
  const d = await db();
  await d.insert(schema.invites).values({
    tokenHash: hashToken(token),
    label: String(form.get("label") ?? "Team invite").slice(0, 60) || "Team invite",
    createdBy: me.id,
    expiresAt: new Date(Date.now() + days * 86400_000),
    maxUses,
  });
  revalidatePath("/members");
  return { url: `${await origin()}/join/${token}` };
}

export async function revokeInvite(id: number) {
  await requireAdmin();
  const d = await db();
  await d.update(schema.invites).set({ revoked: true }).where(eq(schema.invites.id, id));
  revalidatePath("/members");
}

export async function setRole(userId: string, role: "admin" | "member") {
  const me = await requireAdmin();
  if (userId === me.id && role !== "admin") return; // never strand the workspace without the acting admin
  const d = await db();
  await d.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
  revalidatePath("/members");
}

export async function setDisabled(userId: string, disabled: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return;
  const d = await db();
  await d.update(schema.users).set({ disabled }).where(eq(schema.users.id, userId));
  revalidatePath("/members");
}

export async function createResetLink(userId: string): Promise<LinkResult> {
  await requireAdmin();
  const token = newToken();
  const d = await db();
  await d.insert(schema.passwordResets).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 2 * 86400_000) });
  return { url: `${await origin()}/reset/${token}` };
}
