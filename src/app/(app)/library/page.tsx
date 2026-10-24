import Link from "next/link";
import { listItems, wikiPages, type Item } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { loadResults } from "@/lib/results";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Library" };
export const dynamic = "force-dynamic";

const TABS = [
  ["sources", "Sources"],
  ["questions", "Questions"],
  ["harnesses", "Harnesses"],
  ["concepts", "Concepts"],
  ["results", "Results"],
] as const;
type Tab = (typeof TABS)[number][0];
type Page = { slug: string; title: string; data: Record<string, unknown> };

const matches = (q: string, ...fields: unknown[]) => !q || fields.some((f) => String(f ?? "").toLowerCase().includes(q));

function PageList({ pages, empty }: { pages: Page[]; empty: string }) {
  if (!pages.length) return <p className="muted">{empty}</p>;
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))" }}>
      {pages.map((p) => (
        <Link key={p.slug} href={`/library/${p.slug}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="eyebrow">{String(p.data.section ?? "")}</span>
          <h2 style={{ fontSize: 16 }}>{p.title}</h2>
          {p.data.summary ? <p className="sub" style={{ fontSize: 13 }}>{String(p.data.summary).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "")}</p> : null}
        </Link>
      ))}
    </div>
  );
}

function SourceCard({ s }: { s: Item }) {
  const d = s.data as Record<string, string>;
  return (
    <details className="card" style={{ gap: 6 }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="eyebrow">
          {d.type}
          {d.year ? ` · ${d.year}` : ""}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</span>
      </summary>
      {d.authors ? <p className="muted">{d.authors}</p> : null}
      <p>{d.summary ?? s.body}</p>
      {d.limitations ? (
        <p className="sub">
          <b style={{ color: "var(--fg)" }}>Evidence boundary:</b> {d.limitations}
        </p>
      ) : null}
      {d.relevance ? (
        <p className="sub">
          <b style={{ color: "var(--fg)" }}>Sprint use:</b> {d.relevance}
        </p>
      ) : null}
      {d.scope ? <p className="muted">Review scope: {d.scope}</p> : null}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
        {d.wiki ? <Link href={`/library/${d.wiki}`}>Full wiki page →</Link> : null}
        {d.url ? (
          <a href={d.url} target="_blank" rel="noopener noreferrer">
            Open original ↗
          </a>
        ) : null}
      </div>
    </details>
  );
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "sources";
  const q = (sp.q ?? "").trim().toLowerCase();
  const [sources, pages] = await Promise.all([listItems("source"), wikiPages()]);
  const pick = (sections: string[]) => pages.filter((p) => sections.includes(String(p.data.section)) && matches(q, p.title, p.data.summary, (p.data.tags as string[])?.join(" ")));
  const types = [...new Set(sources.map((s) => String(s.data.type)))];
  const shownSources = sources.filter((s) => (!sp.type || s.data.type === sp.type) && matches(q, s.title, s.body, s.data.authors, s.data.summary, s.data.relevance));
  const lists = {
    questions: pick(["questions", "tracks"]),
    harnesses: pick(["environments"]),
    concepts: pick(["themes", "topics", "people", "sprint"]),
  };
  const counts: Record<Tab, number | null> = { sources: shownSources.length, questions: lists.questions.length, harnesses: lists.harnesses.length, concepts: lists.concepts.length, results: null };
  const href = (t: Tab) => `/library?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">{sources.length} sources · {pages.length} wiki pages</span>
        <h1 className="display h1">
          The <em>library</em>
        </h1>
        <p className="sub" style={{ maxWidth: "66ch" }}>
          Source cards from the team brief, linked to the sprint wiki&apos;s paper pages, plus the research questions, harnesses and concepts. Wiki pages are read-only here: flag anything wrong and an admin fixes it in the wiki.
        </p>
      </header>

      <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="hidden" name="tab" value={tab} />
        <input type="search" name="q" defaultValue={sp.q ?? ""} className="input" placeholder="Search titles, authors, findings… try: monitoring, pricing, steganography" aria-label="Search the library" style={{ flex: "1 1 320px" }} />
        {tab === "sources" && (
          <select name="type" defaultValue={sp.type ?? ""} className="input" aria-label="Resource type">
            <option value="">All resource types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <button className="btn btn-fill">Search</button>
      </form>

      <nav className="tabs" aria-label="Library sections">
        {TABS.map(([k, label]) => (
          <Link key={k} href={href(k)} aria-current={tab === k ? "page" : undefined}>
            {label}
            {counts[k] !== null ? <span className="muted" style={{ marginLeft: 6 }}>{counts[k]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "sources" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shownSources.length === 0 && <p className="muted">No matching sources. Try a broader search.</p>}
          {shownSources.map((s) => (
            <SourceCard key={s.id} s={s} />
          ))}
        </section>
      )}
      {tab === "questions" && <PageList pages={lists.questions} empty="No matching questions." />}
      {tab === "harnesses" && (
        <>
          <p className="note">
            Each harness page covers what it supports, cost and risk. Experiments run from the team repo with <code className="mono">PYTHONUTF8=1 modal run experiments/&lt;name&gt;/run.py</code>; logged runs appear under <Link href="/library?tab=results">Results</Link>.
          </p>
          <PageList pages={lists.harnesses} empty="No matching harnesses." />
        </>
      )}
      {tab === "concepts" && <PageList pages={lists.concepts} empty="No matching pages." />}
      {tab === "results" && <Results />}
    </>
  );
}

async function Results() {
  const { experiments, texts, error } = await loadResults();
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p className="note">
        Read from <code className="mono">results/**</code> (<code className="mono">.jsonl</code> run logs, plus <code className="mono">.txt</code>/<code className="mono">.md</code> summary tables) in the{" "}
        <a href="https://github.com/Dsinha97/outskiller-ai-safety-sprint" target="_blank" rel="noopener noreferrer">
          team repo
        </a>{" "}
        every 5 minutes. Each line is one run logged by <code className="mono">runlog.py</code>. Check the positive control before reading any other number.
      </p>
      {error && <p className="error">Couldn&apos;t load results: {error}</p>}
      <Findings />
      {!error && experiments.length === 0 && texts.length === 0 && (
        <div className="card">
          <h2>No results yet</h2>
          <p className="sub">Nothing has been logged to the team repo. Runs appear here once someone commits a results file.</p>
        </div>
      )}
      {experiments.map((ex) => (
        <article key={ex.name} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2>{ex.name}</h2>
            <a href={ex.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              Raw file ↗
            </a>
          </div>
          <p className="muted">
            {ex.runs} runs · ${ex.cost.toFixed(2)} logged spend{ex.models.length ? ` · ${ex.models.join(", ")}` : ""}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Condition</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Seeds</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Metrics (mean ± sd, n)</th>
                </tr>
              </thead>
              <tbody>
                {ex.conditions.map((c) => (
                  <tr key={c.condition} style={{ borderTop: "1px solid var(--line2)", verticalAlign: "top" }}>
                    <td style={{ padding: "8px" }}>{c.condition}</td>
                    <td style={{ padding: "8px" }} className="mono">{c.seeds}</td>
                    <td style={{ padding: "8px" }} className="mono">
                      {c.metrics.length ? c.metrics.map((m) => `${m.name}: ${m.mean.toFixed(3)} ± ${m.sd.toFixed(3)} (n=${m.n})`).join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
      {texts.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2>Result tables from the team repo</h2>
          <p className="note">Summary files (<code className="mono">.txt</code> / <code className="mono">.md</code>) printed by the analysis scripts. Shown as committed; open one to read it.</p>
          {texts.map((t) => (
            <details key={t.group + t.name} className="card">
              <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>{t.group ? `${t.group} / ` : ""}{t.name}</b>
                <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>Raw file ↗</a>
              </summary>
              {t.markdown ? (
                <Markdown>{t.text}</Markdown>
              ) : (
                <pre className="mono" style={{ overflowX: "auto", fontSize: 12, margin: "10px 0 0" }}>{t.text}</pre>
              )}
            </details>
          ))}
        </section>
      )}
      <p className="muted">Seeds and variance are shown as logged. Nothing on this page is a finding until the positive control passes and the analysis is written up.</p>
    </section>
  );
}

/** Headline numbers from the team's own write-ups (wiki: topics/grievance-pilot-findings). Team-written, not independently checked. */
function Findings() {
  const rows: [string, string][] = [
    ["Pressure and private notes compound", "Escalation with no hidden aim is 92% (MiniMax) and 89% (Gemma). Aim plus private notes: 28% in both. Aim without notes: 64% and 44%."],
    ["Notes recruit honest raters", "An honest rater given an aim-written note escalated 33% (MiniMax) and 50% (Gemma). A neutral paraphraser recovered about half."],
    ["One gatekeeper is enough", "Full pipeline, 12 records, Gemma: 5 serious cases not escalated with the aim on the screener alone, 7 with it everywhere, 0 in honest arms."],
    ["Endorsement switches the watchdog off", "Six arms, four watchdogs: plain, rejected and safe precedents changed nothing (48 of 48 flagged). Only endorsed unsafe precedents lowered detection, to 24–41 of 48."],
    ["One sentence restores it", "Adding “the written policy controls” brought every first-round watchdog back to 48 of 48, with no measurable rise in false flags."],
    ["The limit", "On the harder set (rating hides the violation) baseline detection was 38% pooled, 15% endorsed, 27% with the sentence."],
    ["Four API monitors (24 Oct)", "Endorsement effect shows in Sonnet 5.5 (98% to 56%) and Gemini 3.8 Flash (100% to 33%), is weaker in Haiku 5.5 (83% to 60%), and is absent in Gemini 4 Argon."],
  ];
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2>Findings so far: Quiet Suppression pilots</h2>
      <p className="callout">
        Team-written pilot results on <b>synthetic</b> grievance records. Small samples (12–36 records per arm), no significance tests, mostly one sender family. The hidden aim is instructed in plain words, so these show how an instructed aim is carried out and spread, <b>not</b> spontaneous collusion. Not independently checked. Runs up to 22 Oct UTC are prior work; later runs are sprint work.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(([h, t]) => (
          <li key={h}>
            <b>{h}.</b> {t}
          </li>
        ))}
      </ul>
      <p className="muted">
        Full detail and caveats: <Link href="/library/topics/grievance-pilot-findings">Grievance pilot findings</Link>.
      </p>
    </article>
  );
}
