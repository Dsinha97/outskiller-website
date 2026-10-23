"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const NEXT: Record<string, string> = { L: "S", S: "-", "-": "L" };

export async function cycleRole(pkg: string, person: string) {
  await requireUser();
  const d = await db();
  const [cur] = await d.select().from(schema.roleCells).where(and(eq(schema.roleCells.pkg, pkg), eq(schema.roleCells.person, person)));
  const value = NEXT[cur?.value ?? "-"];
  await d
    .insert(schema.roleCells)
    .values({ pkg, person, value })
    .onConflictDoUpdate({ target: [schema.roleCells.pkg, schema.roleCells.person], set: { value } });
  revalidatePath("/team");
}

export async function setDecision(key: string, form: FormData) {
  const me = await requireUser();
  const value = String(form.get("value") ?? "").trim().slice(0, 200) || null;
  const d = await db();
  await d.update(schema.decisions).set({ value, by: me.id, at: new Date() }).where(eq(schema.decisions.key, key));
  revalidatePath("/workflow");
}

export async function toggleCheck(id: number) {
  await requireUser();
  const d = await db();
  const [c] = await d.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  if (c) await d.update(schema.checklist).set({ done: !c.done }).where(eq(schema.checklist.id, id));
  revalidatePath("/workflow");
}

export async function setCheckOwner(id: number, form: FormData) {
  await requireUser();
  const owner = String(form.get("owner") ?? "");
  const d = await db();
  await d.update(schema.checklist).set({ ownerId: owner || null }).where(eq(schema.checklist.id, id));
  revalidatePath("/workflow");
}
