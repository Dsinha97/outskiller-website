import "server-only";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { items, polls, pollOptions, stances, suggestions, users, itemVersions } = schema;
export type Item = typeof items.$inferSelect;
export type Stance = "first" | "interested" | "not";
export const STANCES: { key: Stance; label: string }[] = [
  { key: "first", label: "First choice" },
  { key: "interested", label: "Interested" },
  { key: "not", label: "Not for me" },
];

export async function listItems(kind: string, status?: string | string[]) {
  const d = await db();
  const where = status ? and(eq(items.kind, kind), Array.isArray(status) ? inArray(items.status, status) : eq(items.status, status)) : eq(items.kind, kind);
  return d.select().from(items).where(where).orderBy(asc(items.sort), asc(items.title));
}

export async function getItem(kind: string, slug: string) {
  const d = await db();
  const [it] = await d.select().from(items).where(and(eq(items.kind, kind), eq(items.slug, slug)));
  return it ?? null;
}

export async function wikiPages(section?: string) {
  const d = await db();
  return d
    .select({ slug: items.slug, title: items.title, data: items.data })
    .from(items)
    .where(section ? and(eq(items.kind, "wiki"), like(items.slug, `${section}/%`)) : eq(items.kind, "wiki"))
    .orderBy(asc(items.title));
}

export async function pendingCount() {
  const d = await db();
  const [{ n }] = await d.select({ n: sql<number>`count(*)` }).from(suggestions).where(eq(suggestions.status, "pending"));
  return Number(n);
}

export async function members() {
  const d = await db();
  return d.select({ id: users.id, name: users.name, email: users.email, role: users.role, city: users.city, tz: users.tz, disabled: users.disabled, createdAt: users.createdAt, inviteId: users.inviteId }).from(users).orderBy(asc(users.createdAt));
}

type Tally = Record<Stance, number>;
const empty = (): Tally => ({ first: 0, interested: 0, not: 0 });

export async function stanceTallies(prefix: string, userId: string) {
  const d = await db();
  const rows = await d.select().from(stances).where(like(stances.target, `${prefix}%`));
  const tallies: Record<string, Tally> = {};
  const mine: Record<string, Stance> = {};
  const voters = new Set<string>();
  for (const r of rows) {
    (tallies[r.target] ??= empty())[r.stance as Stance]++;
    voters.add(r.userId);
    if (r.userId === userId) mine[r.target] = r.stance as Stance;
  }
  return { tallies, mine, voters: voters.size };
}

export async function currentPoll(userId: string) {
  const d = await db();
  const [poll] = await d.select().from(polls).where(eq(polls.kind, "plan")).orderBy(desc(polls.createdAt)).limit(1);
  if (!poll) return null;
  const options = await d.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(asc(pollOptions.sort));
  const { tallies, mine, voters } = await stanceTallies("option:", userId);
  const withVotes = options
    .map((o) => ({ ...o, tally: tallies[`option:${o.id}`] ?? empty(), mine: mine[`option:${o.id}`] ?? null }))
    .map((o) => ({ ...o, score: o.tally.first * 2 + o.tally.interested - o.tally.not }));
  return { poll, options: withVotes, voters, winner: options.find((o) => o.id === poll.winnerOptionId) ?? null };
}

export async function recentChanges(limit = 6) {
  const d = await db();
  return d
    .select({ at: itemVersions.at, note: itemVersions.note, version: itemVersions.version, title: items.title, kind: items.kind, slug: items.slug, by: users.name })
    .from(itemVersions)
    .innerJoin(items, eq(items.id, itemVersions.itemId))
    .leftJoin(users, eq(users.id, itemVersions.by))
    .orderBy(desc(itemVersions.at))
    .limit(limit);
}

export function itemHref(kind: string, slug: string): string {
  switch (kind) {
    case "angle":
      return `/angles#angle-${slug}`;
    case "talk":
      return `/talks#${slug}`;
    case "phase":
    case "link":
      return "/workflow";
    case "person":
      return "/team";
    case "wiki":
      return `/library/${slug}`;
    case "note":
      return "/angles";
    case "source":
      return "/library";
    default:
      return "/";
  }
}
