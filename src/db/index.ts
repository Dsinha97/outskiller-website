import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

declare global {
  var __hqDb: Promise<DB> | undefined;
}

/**
 * Neon (WebSocket pool, so transactions work) when DATABASE_URL is set, otherwise an
 * on-disk PGlite database in .data/ for local development without any credentials.
 */
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws;
    return drizzle(new Pool({ connectionString: url }), { schema }) as unknown as DB;
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set for this deployment. Connect Neon to the project, then redeploy.");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return drizzle(client, { schema }) as unknown as DB;
}

export function db(): Promise<DB> {
  globalThis.__hqDb ??= connect();
  return globalThis.__hqDb;
}

export { schema };
