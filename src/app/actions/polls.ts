"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin, requireUser } from "@/lib/session";

const { stances, polls, pollOptions, items, decisions } = schema;
const VALID = new Set(["first", "interested", "not"]);

/** Sets, changes or (choosing the same stance again) clears the caller's view on a target. */
export async function setStance(target: string, stance: string) {
  const me = await requireUser();
  if (!/^(angle:[a-h]|option:\d+)$/.test(target) || !VALID.has(stance)) return;
  const d = await db();
  const [cur] = await d.select().from(stances).where(and(eq(stances.target, target), eq(stances.userId, me.id)));
  if (cur?.stance === stance) {
    await d.delete(stances).where(and(eq(stances.target, target), eq(stances.userId, me.id)));
  } else {
    await d
      .insert(stances)
      .values({ target, userId: me.id, stance })
      .onConflictDoUpdate({ target: [stances.target, stances.userId], set: { stance, at: new Date() } });
  }
  revalidatePath("/", "layout");
}

/**
 * Closes the plan poll on `optionId`: its angles become the Team Project, every other angle
 * moves to the archive, and the choice is written to the decisions board.
 */
export async function selectPlan(optionId: number) {
  const me = await requireAdmin();
  const d = await db();
  const [opt] = await d.select().from(pollOptions).where(eq(pollOptions.id, optionId));
  if (!opt) return;
  const slugs = opt.angles.map((a) => a.toLowerCase());
  await d.transaction(async (tx) => {
    await tx.update(polls).set({ status: "decided", winnerOptionId: opt.id }).where(eq(polls.id, opt.pollId));
    if (slugs.length) {
      await tx.update(items).set({ status: "team_project", updatedAt: new Date() }).where(and(eq(items.kind, "angle"), inArray(items.slug, slugs)));
      await tx.update(items).set({ status: "archived", updatedAt: new Date() }).where(and(eq(items.kind, "angle"), notInArray(items.slug, slugs)));
    }
    await tx
      .insert(decisions)
      .values({ key: "angle", label: "Project angle", options: [], value: opt.label, by: me.id, at: new Date(), sort: -1 })
      .onConflictDoUpdate({ target: decisions.key, set: { value: opt.label, by: me.id, at: new Date() } });
  });
  revalidatePath("/", "layout");
}

export async function undoPlan() {
  await requireAdmin();
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.update(polls).set({ status: "open", winnerOptionId: null }).where(eq(polls.kind, "plan"));
    await tx.update(items).set({ status: "active", updatedAt: new Date() }).where(eq(items.kind, "angle"));
    await tx.update(decisions).set({ value: null, by: null, at: null }).where(eq(decisions.key, "angle"));
  });
  revalidatePath("/", "layout");
}

/** Adds an option to the open poll: an angle combination, or an idea promoted from the wiki's open gaps. */
export async function addPollOption(form: FormData) {
  await requireAdmin();
  const label = String(form.get("label") ?? "").trim().slice(0, 160);
  if (!label) return;
  const angles = [...new Set((label.split(":")[0].match(/\b[A-H]\b/g) ?? []) as string[])];
  const d = await db();
  const [poll] = await d.select().from(polls).where(eq(polls.kind, "plan"));
  if (!poll) return;
  await d.insert(pollOptions).values({ pollId: poll.id, label, angles, sort: 100 });
  const ideaId = Number(form.get("ideaId"));
  if (ideaId) await d.update(items).set({ status: "in_poll" }).where(and(eq(items.id, ideaId), eq(items.kind, "idea")));
  revalidatePath("/", "layout");
}

export async function removePollOption(optionId: number) {
  await requireAdmin();
  const d = await db();
  await d.delete(stances).where(eq(stances.target, `option:${optionId}`));
  await d.delete(pollOptions).where(eq(pollOptions.id, optionId));
  revalidatePath("/", "layout");
}
