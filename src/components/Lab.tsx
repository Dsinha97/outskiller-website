"use client";

import { useMemo, useState } from "react";

/* Three synthetic teaching demos ported from the team brief. Fixed rules, no API calls, no findings. */

function shuffled(seed: number) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const a = Array.from({ length: 40 }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Pairing() {
  const [mode, setMode] = useState<"independent" | "aligned" | "opposed">("independent");
  const [seed, setSeed] = useState(41);
  const a = Array.from({ length: 40 }, (_, i) => i + 1);
  const b = mode === "aligned" ? a : mode === "opposed" ? [...a].reverse() : shuffled(seed);
  const mean = 20.5;
  const r = a.reduce((s, v, i) => s + (v - mean) * (b[i] - mean), 0) / a.reduce((s, v) => s + (v - mean) ** 2, 0);
  const explain =
    mode === "aligned"
      ? "The pairs move together, although neither agent's individual bid distribution changed."
      : mode === "opposed"
        ? "The pairs move in opposite directions, with the same individual distributions."
        : "Shuffling removes systematic pairing by construction; finite samples can keep chance correlation.";
  return (
    <article className="card">
      <span className="eyebrow">Demo 1</span>
      <h2>Identical distributions, different relationships</h2>
      <p className="sub">Both agents always use the same set of synthetic bids. Change how the bids are paired: each agent&apos;s average stays fixed while the joint pattern changes.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field">
          Pairing
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="independent">Shuffled pairing</option>
            <option value="aligned">Aligned pairing</option>
            <option value="opposed">Opposed pairing</option>
          </select>
        </label>
        <button type="button" className="btn btn-quiet" onClick={() => { setMode("independent"); setSeed(seed + 7); }}>New shuffle</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", alignItems: "center" }}>
        <svg viewBox="0 0 450 320" role="img" aria-label="Scatter plot of synthetic bids from agents A and B" style={{ width: "100%", background: "var(--bg)", borderRadius: 4 }}>
          <path d="M50 20V270H430" fill="none" stroke="var(--muted)" />
          <text x="190" y="305" fill="var(--fg2)" fontSize="14">Agent A bid</text>
          <text x="8" y="16" fill="var(--fg2)" fontSize="14">Agent B bid</text>
          {a.map((v, i) => (
            <circle key={i} cx={50 + v * 9} cy={270 - b[i] * 6} r="4" fill="var(--teal)" opacity=".8" />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p>Agent A mean: <b className="mono">20.5</b> · Agent B mean: <b className="mono">20.5</b></p>
          <p className="muted">Pairwise Pearson correlation</p>
          <p className="display" style={{ fontSize: 34, color: "var(--accent)" }}>{r.toFixed(3)}</p>
          <p className="sub" aria-live="polite">{explain}</p>
          <p className="muted">Xu et al. motivate looking at joint behaviour. This plot shows dependence only: no market mechanism, proof of agreement, or harm.</p>
        </div>
      </div>
    </article>
  );
}

const CASES = {
  harm: { label: "Channel-dependent harmful coordination", m: "“Let’s reserve the profitable tasks for each other.”", a: "Partners preferentially allocate tasks to their pair.", o: "Other participants lose access to profitable tasks.", v: "Cutting the channel restores ordinary allocation in this scripted case. The ablation supports a causal role for that channel within this toy setup.", ca: "Agents follow ordinary allocation.", co: "The imposed coalition advantage disappears." },
  shared: { label: "Common incentive, no agreement", m: "No private messages. Both receive identical rewards.", a: "Both independently choose the same high-reward action.", o: "Other participants lose out under the incentive design.", v: "Cutting a nonexistent private channel changes nothing. Common incentives explain the pattern; harm alone does not establish an agreement." },
  talk: { label: "Collusive talk without action", m: "“We should secretly favor each other.”", a: "Both follow the authorized allocation rule.", o: "No coalition advantage appears.", v: "Suspicious talk appears without a corresponding change in actions. A conversation-only detector can overstate the evidence." },
  benign: { label: "Authorized cooperation", m: "“Let’s divide the assigned work.”", a: "Agents split tasks as the user authorized.", o: "The shared task improves without disadvantaging others.", v: "Coordination serves the authorized objective. Removing communication can impair useful cooperation.", ca: "Agents duplicate work after losing coordination.", co: "The authorized task takes longer." },
} as const;

function Ablation() {
  const [key, setKey] = useState<keyof typeof CASES>("harm");
  const [cut, setCut] = useState(false);
  const c = CASES[key] as (typeof CASES)[keyof typeof CASES] & { ca?: string; co?: string };
  const steps = [
    ["Messages", cut ? "Private messages unavailable." : c.m],
    ["Actions", cut && c.ca ? c.ca : c.a],
    ["Third-party outcome", cut && c.co ? c.co : c.o],
  ];
  return (
    <article className="card">
      <span className="eyebrow">Demo 2</span>
      <h2>Talk, action and a channel ablation</h2>
      <p className="sub">Pick a synthetic case, then cut the private channel. Does the outcome change, and which rival explanations remain?</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field">
          Case
          <select value={key} onChange={(e) => setKey(e.target.value as keyof typeof CASES)}>
            {Object.entries(CASES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", height: 42 }}>
          <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} style={{ accentColor: "var(--fill)" }} /> Cut private channel
        </label>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
        {steps.map(([t, d]) => (
          <div key={t} className="band" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="eyebrow">{t}</span>
            <span style={{ color: "var(--band-fg2)" }}>{d}</span>
          </div>
        ))}
      </div>
      <p aria-live="polite">{c.v}</p>
      <p className="muted">Colosseum separates communication from action-based evidence. This demo encodes its cases by hand; it cannot discover collusion.</p>
    </article>
  );
}

const SAMPLES: [string, boolean, number, number][] = [
  ["Private deal, harmful allocation", true, 90, 92],
  ["Hidden signal, harmful allocation", true, 25, 78],
  ["Coded deal, harmful allocation", true, 35, 73],
  ["Misleading assurance, harmful allocation", true, 20, 85],
  ["Same incentive, parallel action", false, 45, 30],
  ["Collusive talk, ordinary action", false, 95, 35],
  ["Authorized cooperation", false, 75, 20],
  ["Independent ordinary action", false, 10, 15],
];

function Threshold() {
  const [signal, setSignal] = useState<"text" | "hybrid">("text");
  const [t, setT] = useState(60);
  const rows = useMemo(() => SAMPLES.map(([name, harm, ts, hs]) => ({ name, harm, score: signal === "text" ? ts : hs })).map((r) => ({ ...r, flagged: r.score >= t })), [signal, t]);
  const tp = rows.filter((r) => r.harm && r.flagged).length;
  const fp = rows.filter((r) => !r.harm && r.flagged).length;
  return (
    <article className="card">
      <span className="eyebrow">Demo 3</span>
      <h2>A monitor&apos;s threshold changes who gets accused</h2>
      <p className="sub">Eight invented cases with known labels. Compare two made-up scoring rules and move the accusation threshold.</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field">
          Signal
          <select value={signal} onChange={(e) => setSignal(e.target.value as typeof signal)}>
            <option value="text">Suspicious language only</option>
            <option value="hybrid">Structured claims-and-actions score</option>
          </select>
        </label>
        <label className="field" style={{ minWidth: 220 }}>
          Threshold: <span className="mono">{t}</span>
          <input type="range" min={0} max={100} value={t} onChange={(e) => setT(Number(e.target.value))} style={{ accentColor: "var(--fill)", minHeight: 0, padding: 0, border: 0, background: "none" }} />
        </label>
      </div>
      <p aria-live="polite">
        Detection: <b className="mono">{tp}/4 ({tp * 25}%)</b> · False-positive rate: <b className="mono">{fp}/4 ({fp * 25}%)</b>. These are synthetic-case results.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th style={{ padding: 6, fontWeight: 500 }}>Synthetic case</th>
              <th style={{ padding: 6, fontWeight: 500 }}>Ground truth</th>
              <th style={{ padding: 6, fontWeight: 500 }}>Score</th>
              <th style={{ padding: 6, fontWeight: 500 }}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} style={{ borderTop: "1px solid var(--line2)" }}>
                <td style={{ padding: 6 }}>{r.name}</td>
                <td style={{ padding: 6 }}>{r.harm ? "Harmful coordination" : "Other"}</td>
                <td style={{ padding: 6 }} className="mono">{r.score}</td>
                <td style={{ padding: 6, color: r.flagged ? "var(--accent)" : "var(--muted)" }}>{r.flagged ? "Flagged" : "Not flagged"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">The structured rule is built to win in this tiny example. That is not a result. TraceGuard and extract-and-evaluate monitoring are related; neither validates these numbers.</p>
    </article>
  );
}

export function Lab() {
  return (
    <>
      <Pairing />
      <Ablation />
      <Threshold />
    </>
  );
}
