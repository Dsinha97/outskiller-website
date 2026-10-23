/**
 * Loads content/seed.json into the database (Neon if DATABASE_URL is set, else local PGlite).
 *   npx tsx scripts/seed.ts
 *
 * Safe to re-run: wiki pages are refreshed when their sha changes; brief items, polls,
 * decisions, roles and the checklist are only inserted when missing, so in-app edits stay.
 * On an empty users table it prints a one-time bootstrap invite link.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../src/db";

type Seed = {
  items: { kind: string; slug: string; title: string; body: string; data: Record<string, unknown>; origin: string; sha?: string; sort: number; status?: string }[];
  ideas: { label: string; theme: string }[];
  checklist: string[];
  roles: { names: string[]; packages: string[][] };
  decisions: { key: string; label: string; options: string[]; sort: number }[];
  poll: { title: string; options: { label: string; angles: string[]; sort: number }[] };
};

async function main() {
  const seed: Seed = JSON.parse(readFileSync(join(__dirname, "../content/seed.json"), "utf8"));
  const d = await db();
  const { items, checklist, roleCells, decisions, polls, pollOptions, users, invites } = schema;

  let inserted = 0;
  let refreshed = 0;
  const allItems = [
    ...seed.items,
    ...seed.ideas.map((idea, i) => ({ kind: "idea", slug: `idea-${i + 1}`, title: idea.label.replace(/\*\*|\[|\]\([^)]*\)/g, "").slice(0, 140), body: idea.label, data: { theme: idea.theme }, origin: "wiki", sort: i, status: "candidate", sha: undefined })),
  ];
  for (const it of allItems) {
    const [existing] = await d.select({ id: items.id, sha: items.sha, origin: items.origin }).from(items).where(and(eq(items.kind, it.kind), eq(items.slug, it.slug)));
    if (!existing) {
      await d.insert(items).values({ kind: it.kind, slug: it.slug, title: it.title, body: it.body, data: it.data, origin: it.origin, sha: it.sha ?? null, sort: it.sort, status: it.status ?? "active" });
      inserted++;
    } else if (it.origin === "wiki" && existing.origin === "wiki" && it.sha && existing.sha !== it.sha) {
      await d.update(items).set({ title: it.title, body: it.body, data: it.data, sha: it.sha, updatedAt: new Date(), version: sql`${items.version} + 1` }).where(eq(items.id, existing.id));
      refreshed++;
    }
  }

  if ((await d.select({ n: sql<number>`count(*)` }).from(checklist))[0].n == 0) {
    await d.insert(checklist).values(seed.checklist.map((label, i) => ({ label, sort: i })));
  }
  if ((await d.select({ n: sql<number>`count(*)` }).from(roleCells))[0].n == 0) {
    const rows = seed.roles.packages.flatMap(([pkg, ...vals]) => vals.map((value, j) => ({ pkg, person: seed.roles.names[j], value })));
    await d.insert(roleCells).values(rows);
  }
  for (const dec of seed.decisions) {
    await d.insert(decisions).values(dec).onConflictDoNothing();
  }
  await d.insert(decisions).values({ key: "budget", label: "Budget cap (USD)", options: [], value: "50", sort: 99 }).onConflictDoNothing();
  if ((await d.select({ n: sql<number>`count(*)` }).from(polls))[0].n == 0) {
    const [poll] = await d.insert(polls).values({ title: seed.poll.title, kind: "plan" }).returning();
    await d.insert(pollOptions).values(seed.poll.options.map((o) => ({ pollId: poll.id, label: o.label, angles: o.angles, sort: o.sort })));
  }

  console.log(`items: ${inserted} inserted, ${refreshed} wiki pages refreshed`);

  if ((await d.select({ n: sql<number>`count(*)` }).from(users))[0].n == 0) {
    const token = randomBytes(18).toString("base64url");
    await d.insert(invites).values({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      label: "Bootstrap (first admin)",
      expiresAt: new Date(Date.now() + 2 * 86400_000),
      maxUses: 1,
    });
    const base = process.env.BASE_URL ?? "http://localhost:3000";
    console.log(`\nNo accounts yet. One-time bootstrap invite (expires in 2 days):\n  ${base}/join/${token}\n`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
