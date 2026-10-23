"use client";

import { useState } from "react";

const FIELDS = [
  ["conds", "Conditions", 4],
  ["runs", "Runs per condition", 5],
  ["rounds", "Rounds per run", 30],
  ["agents", "Agents", 3],
  ["inTok", "Input tokens per call", 2000],
  ["outTok", "Output tokens per call", 300],
  ["pin", "$ per 1M input", 1],
  ["pout", "$ per 1M output", 5],
  ["mon", "Monitor / judge overhead %", 20],
] as const;

/** Planning aid ported from the brief. Prices are placeholders: use the provider's current page. */
export function BudgetEstimator({ cap }: { cap: number }) {
  const [v, setV] = useState<Record<string, number>>(Object.fromEntries(FIELDS.map(([k, , d]) => [k, d])));
  const calls = v.conds * v.runs * v.rounds * v.agents;
  const total = Math.round(calls * (1 + v.mon / 100));
  const cost = (total * (v.inTok * v.pin + v.outTok * v.pout)) / 1e6;
  return (
    <section className="card" aria-label="API budget estimator">
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>API budget estimator</h2>
        <span className="muted">Rough planning only. Replace the prices with current rates from the provider&apos;s pricing page.</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(170px, 100%), 1fr))", gap: 10 }}>
        {FIELDS.map(([k, label]) => (
          <label key={k} className="field" style={{ fontWeight: 400, fontSize: 12 }}>
            {label}
            <input type="number" min={0} step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        ))}
      </div>
      <p className="sub">
        Agent calls: <b className="mono">{calls.toLocaleString()}</b> · with overhead: <b className="mono">{total.toLocaleString()}</b>
      </p>
      <p className="display" style={{ fontSize: 30, color: cost > cap ? "var(--stamp)" : "var(--accent)" }}>
        ≈ ${cost.toFixed(2)} <span style={{ fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>against a ${cap} cap</span>
      </p>
    </section>
  );
}
