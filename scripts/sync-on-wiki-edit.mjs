// Claude Code PostToolUse hook: when an Edit/Write touches the wiki, sources or team brief,
// rebuild and reload the website seed. Reads the hook JSON on stdin. Never fails the tool call.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let raw = "";
for await (const c of process.stdin) raw += c;
let path = "";
try {
  path = (JSON.parse(raw).tool_input?.file_path ?? "").replace(/\\/g, "/");
} catch {}
if (/\/(wiki|sources)\/|ai-collusion-team-brief\.html$/.test(path) && !/\/wiki\/exports\//.test(path)) {
  const r = spawnSync("npm", ["run", "sync"], { cwd: root, shell: true, encoding: "utf8" });
  const last = (r.stdout || "").trim().split("\n").slice(-2).join(" | ");
  console.log(r.status === 0 ? `website seed synced (${last})` : `website seed sync failed: ${(r.stderr || "").slice(-300)}`);
}
