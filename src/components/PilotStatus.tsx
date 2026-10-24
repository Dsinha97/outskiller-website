import Link from "next/link";

/**
 * Where the Quiet Suppression pilots stand. Mirrors wiki/topics/grievance-pilot-findings.md and
 * wiki/environments/precedent-arms-modal-run.md as of 2026-10-24; update this file when the wiki changes.
 */
const DONE: [string, string][] = [
  ["Prior work (to end of 22 Oct UTC)", "MiniMax pilots, the 540 cached trajectories and the GrieVoice v2 records. Marked preexisting in the report."],
  ["Sprint work, 23 Oct", "Gemma runs, full-pipeline lifecycle arms, cross-family monitors, sentence ablation, note carry-over."],
  ["Sprint work, 24 Oct", "Six-arm precedent experiment, the harder set, and four API monitors (Haiku 5.5, Sonnet 5.5, Gemini 3.8 Flash, Gemini 4 Argon)."],
];
const NEXT: string[] = [
  "Same frozen prompts on five open-weight monitors on Modal (not yet run).",
  "Watchdog with transcript access, the planned next arm.",
  "Clean re-run of the \u201cglass notes\u201d arm: its prompt still said the lender never sees notes.",
];
const REPORT: string[] = [
  "Fill the [TBD] author roles and [Affiliation] fields in the draft.",
  "Update the model list, spend and usage statement for the API-monitor runs (\u201cunder $2\u201d is out of date; Sonnet alone cost about $3.45).",
  "Soften the abstract\u2019s \u201c100%\u201d claim: it does not hold for Haiku 5.5.",
  "Check the 8-page cap in Word (a LibreOffice render ended the body on page 8).",
  "Ask the organisers to confirm the prior-work line.",
  "Submit once: the sources conflict on whether resubmitting replaces the PDF.",
];
const CAVEATS: string[] = [
  "Record R13: the earlier report says 0 of 32 flags, the merged later results say 1 of 96. Use the later figure and say so.",
  "The harder set\u2019s 7-of-9 threshold and labels were chosen after seeing the data.",
  "Sonnet had 15 reads whose JSON was cut off; they count as not flagged (its arm F would read 96% rather than 88%).",
  "Small samples, two draws per prompt (below the 3\u20135 seeds the guidelines suggest), one sender family in the watchdog sets, no human-checked severity labels.",
];

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

export function PilotStatus({ part = "all" }: { part?: "all" | "report" }) {
  return (
    <section className="card" aria-label="Pilot status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 15 }}>{part === "report" ? "Report to-dos from the pilots" : "Quiet Suppression pilots: status"}</h2>
      {part === "all" && (
        <>
          <section>
            <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Done</h3>
            {DONE.map(([h, t]) => (
              <div key={h} className="row" style={{ flexDirection: "column", gap: 2 }}>
                <b style={{ fontWeight: 500 }}>{h}</b>
                <span className="sub">{t}</span>
              </div>
            ))}
          </section>
          <List title="Planned, not done" items={NEXT} />
        </>
      )}
      <List title="Before we submit" items={REPORT} />
      <List title="Caveats to carry into the report" items={CAVEATS} />
      <span className="muted">
        As of 24 Oct, from the team&apos;s write-ups. Numbers are on <Link href="/library?tab=results">Results</Link>; detail on <Link href="/library/topics/grievance-pilot-findings">Grievance pilot findings</Link>.
      </span>
    </section>
  );
}
