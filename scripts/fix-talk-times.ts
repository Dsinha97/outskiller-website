/**
 * One-off: copy startsAt and note from the seed into talk items the normal seed keeps (edited in the app).
 * Links, recordings and other in-app fields are left alone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const seed = JSON.parse(readFileSync(join(__dirname, "../content/seed.json"), "utf8"));
  const d = await db();
  const { items } = schema;
  for (const it of seed.items.filter((i: { kind: string }) => i.kind === "talk")) {
    const [row] = await d.select({ id: items.id, data: items.data }).from(items).where(and(eq(items.kind, "talk"), eq(items.slug, it.slug)));
    if (!row) continue;
    const data = row.data as Record<string, unknown>;
    if (data.startsAt !== it.data.startsAt || data.note !== it.data.note) {
      await d.update(items).set({ data: { ...data, startsAt: it.data.startsAt, note: it.data.note }, updatedAt: new Date() }).where(eq(items.id, row.id));
      console.log("updated", it.slug, data.startsAt, "->", it.data.startsAt);
    }
  }
  process.exit(0);
}
main();
