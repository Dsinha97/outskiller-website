// Runs the seed against production using .env.production.local (git-ignored; you create it).
// Needs DATABASE_URL (pooled) and BASE_URL in that file. Skips quietly if the file is absent.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, ".env.production.local");
if (!existsSync(file)) {
  console.log("production sync skipped (no .env.production.local)");
  process.exit(0);
}
process.loadEnvFile(file);
if (!process.env.DATABASE_URL) {
  console.log("production sync skipped (DATABASE_URL missing in .env.production.local)");
  process.exit(0);
}
const r = spawnSync("npm", ["run", "sync"], { cwd: root, shell: true, encoding: "utf8", env: process.env });
const last = (r.stdout || "").trim().split("\n").slice(-1)[0];
console.log(r.status === 0 ? `production synced (${last})` : `production sync failed: ${(r.stderr || "").slice(-300)}`);
