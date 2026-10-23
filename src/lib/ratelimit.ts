import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Fixed-window counter in Postgres: true while `key` has made fewer than `limit` hits this window. */
export async function allow(action: string, limit: number, windowSeconds: number): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${action}:${ip}`;
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const d = await db();
  const [row] = await d
    .insert(schema.rateHits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [schema.rateHits.key, schema.rateHits.windowStart], set: { count: sql`${schema.rateHits.count} + 1` } })
    .returning({ count: schema.rateHits.count });
  return row.count <= limit;
}
