"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema, type DB } from "@/db";
import { requireAdmin, requireUser } from "@/lib/session";

const { items, itemVersions, suggestions } = schema;
export type ActionResult = { error?: string; ok?: string } | undefined;

/** Kinds people can edit or propose in the app; wiki pages are flagged, never edited here. */
const EDITABLE = new Set(["talk", "angle", "phase", "link", "person", "note"]);
type Proposed = { title?: string; body?: string; data?: Record<string, unknown> };

function readProposed(form: FormData): Proposed {
  const p: Proposed = {};
  const title = form.get("title");
  const body = form.get("body");
  if (typeof title === "string" && title.trim()) p.title = title.trim().slice(0, 200);
  if (typeof body === "string") p.body = body.slice(0, 40_000);
  const data: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("data.") && typeof v === "string") data[k.slice(5)] = v.trim();
  }
  for (const k of ["url", "link", "recording"]) {
    if (typeof data[k] === "string" && data[k] && !/^https:\/\//.test(data[k] as string)) throw new Error("Links must start with https://");
  }
  if (Object.keys(data).length) p.data = data;
  return p;
}

const slugFor = (title: string) =>
  title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60) || `item-${Date.now()}`;

/** Writes a change and its version record together. `itemId` null creates a new item. */
async function apply(d: DB, kind: string, itemId: number | null, p: Proposed, by: string, note: string) {
  await d.transaction(async (tx) => {
    let id = itemId;
    if (id === null) {
      const title = p.title ?? "Untitled";
      const [it] = await tx
        .insert(items)
        .values({ kind, slug: `${slugFor(title)}-${Date.now().toString(36)}`, title, body: p.body ?? "", data: p.data ?? {}, origin: "app", sort: 1000, updatedBy: by })
        .returning();
      id = it.id;
      await tx.insert(itemVersions).values({ itemId: id, version: 1, snapshot: { title: it.title, body: it.body, data: it.data }, note, by });
      return;
    }
    const [cur] = await tx.select().from(items).where(eq(items.id, id));
    if (!cur) throw new Error("That item no longer exists.");
    const next = { title: p.title ?? cur.title, body: p.body ?? cur.body, data: { ...cur.data, ...(p.data ?? {}) } };
    await tx.update(items).set({ ...next, version: cur.version + 1, updatedBy: by, updatedAt: new Date() }).where(eq(items.id, id));
    await tx.insert(itemVersions).values({ itemId: id, version: cur.version + 1, snapshot: next, note, by });
  });
}

/** Members propose; admins can also apply straight away (still versioned). */
export async function submitChange(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const kind = String(form.get("kind") ?? "");
  const itemId = form.get("itemId") ? Number(form.get("itemId")) : null;
  const type = String(form.get("type") ?? (itemId ? "edit" : "new"));
  const note = String(form.get("note") ?? "").slice(0, 2000);
  const d = await db();

  if (type === "flag") {
    if (!itemId || !note.trim()) return { error: "Say what's wrong so an admin can fix the wiki." };
    await d.insert(suggestions).values({ itemId, kind, type: "flag", proposed: {}, note, authorId: me.id });
    revalidatePath("/", "layout");
    return { ok: "Flagged. An admin will fix the wiki page and re-import it." };
  }
  if (!EDITABLE.has(kind)) return { error: "This kind of content can't be edited here." };
  let p: Proposed;
  try {
    p = readProposed(form);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!itemId && !p.title) return { error: "Add a title." };
  if (itemId) {
    const [cur] = await d.select({ origin: items.origin }).from(items).where(eq(items.id, itemId));
    if (!cur) return { error: "That item no longer exists." };
    if (cur.origin === "wiki") return { error: "Wiki pages are edited in the wiki, not here. Use Flag an issue." };
  }

  if (me.role === "admin" && form.get("direct") === "on") {
    await apply(d, kind, itemId, p, me.id, note || "Edited directly by an admin");
    revalidatePath("/", "layout");
    return { ok: "Saved and published." };
  }
  await d.insert(suggestions).values({ itemId, kind, type, proposed: p, note, authorId: me.id });
  revalidatePath("/", "layout");
  return { ok: "Sent for admin approval." };
}

export async function approveSuggestion(id: number, form: FormData) {
  const me = await requireAdmin();
  const d = await db();
  const [s] = await d.select().from(suggestions).where(and(eq(suggestions.id, id), eq(suggestions.status, "pending")));
  if (!s) return;
  if (s.type !== "flag") {
    // "Edit, then approve" sends the admin's edited fields; plain approve sends none.
    const edited = form.get("edited") === "1" ? readProposed(form) : null;
    await apply(d, s.kind, s.itemId, edited ?? s.proposed, me.id, s.note || "Approved suggestion");
  }
  await d.update(suggestions).set({ status: "approved", reviewerId: me.id, reviewedAt: new Date(), reply: String(form.get("reply") ?? "") }).where(eq(suggestions.id, id));
  revalidatePath("/", "layout");
}

export async function rejectSuggestion(id: number, form: FormData) {
  const me = await requireAdmin();
  const d = await db();
  await d
    .update(suggestions)
    .set({ status: "rejected", reviewerId: me.id, reviewedAt: new Date(), reply: String(form.get("reply") ?? "") })
    .where(and(eq(suggestions.id, id), eq(suggestions.status, "pending")));
  revalidatePath("/", "layout");
}

export async function restoreVersion(itemId: number, version: number) {
  const me = await requireAdmin();
  const d = await db();
  const [v] = await d.select().from(itemVersions).where(and(eq(itemVersions.itemId, itemId), eq(itemVersions.version, version)));
  if (!v) return;
  await apply(d, "", itemId, v.snapshot, me.id, `Restored version ${version}`);
  revalidatePath("/", "layout");
}

export async function setItemStatus(itemId: number, status: "active" | "archived") {
  await requireAdmin();
  const d = await db();
  await d.update(items).set({ status, updatedAt: new Date() }).where(eq(items.id, itemId));
  revalidatePath("/", "layout");
}
