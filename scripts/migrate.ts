/**
 * Applies drizzle/ migrations to Neon (DATABASE_URL set) or the local PGlite database.
 *   npx tsx scripts/migrate.ts
 */
import { db } from "../src/db";

async function main() {
  const d = await db();
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    await migrate(d as never, { migrationsFolder: "drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(d as never, { migrationsFolder: "drizzle" });
  }
  console.log(`Migrated ${process.env.DATABASE_URL ? "Neon" : "local PGlite"} database.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
