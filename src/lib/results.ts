import "server-only";

/**
 * Reads results/*.jsonl from the public team repo. Each line is one run record written by
 * team-repo/src/collusion_sprint/runlog.py: {ts, condition, seed, model, prompt_hash, cost_usd, ...metrics}.
 */
const REPO = process.env.RESULTS_REPO ?? "Dsinha97/outskiller-ai-safety-sprint";

export type RunRecord = { ts?: number; condition?: string; seed?: number; model?: string; prompt_hash?: string; cost_usd?: number; [k: string]: unknown };
export type Experiment = {
  name: string;
  url: string;
  runs: number;
  cost: number;
  models: string[];
  conditions: { condition: string; seeds: number; metrics: { name: string; mean: number; sd: number; n: number }[] }[];
};

const META = new Set(["ts", "condition", "seed", "model", "prompt_hash", "cost_usd"]);

export async function loadResults(): Promise<{ experiments: Experiment[]; error?: string }> {
  try {
    const list = await fetch(`https://api.github.com/repos/${REPO}/contents/results`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (list.status === 404) return { experiments: [] };
    if (!list.ok) return { experiments: [], error: `GitHub returned ${list.status}.` };
    const files = ((await list.json()) as { name: string; download_url: string; html_url: string }[]).filter((f) => f.name.endsWith(".jsonl"));
    const experiments = await Promise.all(
      files.map(async (f) => {
        const text = await (await fetch(f.download_url, { next: { revalidate: 300 } })).text();
        const rows: RunRecord[] = text
          .split("\n")
          .filter((l) => l.trim())
          .flatMap((l) => {
            try {
              return [JSON.parse(l) as RunRecord];
            } catch {
              return [];
            }
          });
        return summarize(f.name.replace(/\.jsonl$/, ""), f.html_url, rows);
      }),
    );
    return { experiments };
  } catch (e) {
    return { experiments: [], error: (e as Error).message };
  }
}

export function summarize(name: string, url: string, rows: RunRecord[]): Experiment {
  const byCond = new Map<string, RunRecord[]>();
  rows.forEach((r) => byCond.set(String(r.condition ?? "unlabelled"), [...(byCond.get(String(r.condition ?? "unlabelled")) ?? []), r]));
  return {
    name,
    url,
    runs: rows.length,
    cost: rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0),
    models: [...new Set(rows.map((r) => r.model).filter(Boolean) as string[])],
    conditions: [...byCond.entries()].map(([condition, rs]) => {
      const keys = [...new Set(rs.flatMap((r) => Object.keys(r).filter((k) => !META.has(k) && typeof r[k] === "number")))];
      return {
        condition,
        seeds: new Set(rs.map((r) => r.seed)).size,
        metrics: keys.map((k) => {
          const xs = rs.map((r) => r[k]).filter((x): x is number => typeof x === "number");
          const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
          const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) : 0;
          return { name: k, mean, sd, n: xs.length };
        }),
      };
    }),
  };
}
