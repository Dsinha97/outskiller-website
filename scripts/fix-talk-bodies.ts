/**
 * One-off: replace stale seed text in talk bodies that the normal seed keeps (items edited in the app).
 * Only touches talk items whose body still contains "did not attend"; sets body to the current seed body.
 *   npx tsx scripts/fix-talk-bodies.ts            (local)
 *   process.loadEnvFile(".env.production.local") first for production (see fix-talk-bodies-prod run).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const seed = JSON.parse(readFileSync(join(__dirname, "../content/seed.json"), "utf8"));
  const d = await db();
  const { items } = schema;
  let n = 0;
  for (const it of seed.items.filter((i: { kind: string }) => i.kind === "talk")) {
    const [row] = await d.select({ id: items.id, body: items.body }).from(items).where(and(eq(items.kind, "talk"), eq(items.slug, it.slug)));
    if (row && /did not attend/i.test(row.body)) {
      await d.update(items).set({ body: it.body, updatedAt: new Date() }).where(eq(items.id, row.id));
      console.log("fixed", it.slug);
      n++;
    }
  }
  console.log(`talk bodies fixed: ${n}`);
  process.exit(0);
}
main();
