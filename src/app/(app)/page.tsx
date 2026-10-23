import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Markdown } from "@/components/Markdown";
import { currentPoll, getItem, itemHref, listItems, members, recentChanges } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { DEADLINE, fmt, fmtTime, untilLabel, zoneName } from "@/lib/time";

export const dynamic = "force-dynamic";

const READ_FIRST = [
  ["https://arxiv.org/abs/2602.15198", "Colosseum: actions can contradict collusive talk"],
  ["https://arxiv.org/abs/2607.05132", "When Agents Lie: commitments and actions can diverge"],
  ["https://arxiv.org/abs/2601.21112", "Information access and monitoring: more context can hurt"],
  ["https://arxiv.org/abs/2607.26385", "Competitive marginals: price histories can miss joint dependence"],
];
const STEPS = [
  ["Observe", "Compare messages with actions and outcomes."],
  ["Challenge", "Cut a channel or replace a participant."],
  ["Compare", "Measure the change against a matched control."],
  ["Bound the claim", "State what the evidence establishes."],
];

export default async function StartHere() {
  const me = await requireUser();
  const now = new Date();
  const [phases, talks, poll, people, changes, discipline] = await Promise.all([
    listItems("phase"),
    listItems("talk"),
    currentPoll(me.id),
    members(),
    recentChanges(5),
    getItem("note", "reading-discipline"),
  ]);
  const phase =
    phases.find((p) => new Date(String(p.data.startsAt)) <= now && now < new Date(String(p.data.endsAt))) ??
    (now < new Date(String(phases[0]?.data.startsAt)) ? phases[0] : phases[phases.length - 1]);
  const nextTalk = talks.find((t) => !t.data.event && new Date(String(t.data.startsAt)) > now);
  const top = poll ? [...poll.options].sort((a, b) => b.score - a.score).slice(0, 2) : [];
  const maxScore = Math.max(1, ...top.map((o) => o.tally.first + o.tally.interested));
  const votedMe = poll?.options.some((o) => o.mine);

  // Team clocks: one card per time zone in use.
  const byZone = new Map<string, string[]>();
  people.filter((p) => !p.disabled).forEach((p) => byZone.set(p.tz, [...(byZone.get(p.tz) ?? []), p.name.split(" ")[0]]));
  const clocks = [...byZone.entries()].map(([tz, names]) => {
    const hour = Number(fmt(now, tz, { hour: "numeric", hourCycle: "h23" }));
    return { tz, names, time: fmtTime(now, tz), zone: zoneName(tz).replace(/ (Standard|Daylight) Time$/, ""), awake: hour >= 8 && hour < 22 };
  });

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="eyebrow">
            {fmt(now, me.tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} your time{me.city ? ` · ${me.city}` : ""}
          </span>
          <h1 className="display h1">
            When agents coordinate, what counts as <em>evidence?</em>
          </h1>
          <p className="lede">Coordination has several explanations. A convincing audit tests which one survives a controlled change.</p>
        </div>
        <div className="band" style={{ flex: "0 1 300px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="eyebrow">Submissions close in</span>
          <Countdown to={DEADLINE} initial={untilLabel(DEADLINE, now.getTime())} />
          <span style={{ fontSize: 12, color: "var(--band-fg2)" }}>Sun Oct 25, 11:59 PM AoE · {fmt(DEADLINE, me.tz)} your time</span>
        </div>
      </header>

      <section className="grid" aria-label="Today">
        <article className="card">
          <span className="eyebrow">Phase now · {phase?.title}</span>
          <Markdown className="sub">{phase?.body ?? ""}</Markdown>
          {phase?.data.note ? <p className="callout">{String(phase.data.note)}</p> : null}
          <Link href="/workflow" style={{ marginTop: "auto", fontWeight: 500, textDecoration: "none" }}>Open the workflow →</Link>
        </article>

        <article className="card">
          {poll?.poll.status === "decided" ? (
            <>
              <span className="eyebrow">Plan selected</span>
              <h2>{poll.winner?.label}</h2>
              <p className="sub">The other angles are in the archive.</p>
              <Link href="/project" style={{ marginTop: "auto", fontWeight: 500, textDecoration: "none" }}>Open the Team Project →</Link>
            </>
          ) : (
            <>
              <span className="eyebrow">Plan poll · open</span>
              <h2>Pick the team project</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {top.map((o) => (
                  <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span>{o.label}</span>
                      <span className="mono">{o.tally.first} first</span>
                    </div>
                    <div className="bar"><i style={{ width: `${((o.tally.first + o.tally.interested) / maxScore) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <span className="muted">
                {poll?.voters ?? 0} of {people.filter((p) => !p.disabled).length} voted · {votedMe ? "you've voted" : "you haven't voted yet"}
              </span>
              <Link href="/angles" style={{ marginTop: "auto", fontWeight: 500, textDecoration: "none" }}>Vote on angles →</Link>
            </>
          )}
        </article>

        <article className="card">
          {nextTalk ? (
            <>
              <span className="eyebrow">Next talk · {fmt(String(nextTalk.data.startsAt), me.tz)}</span>
              <h2>{nextTalk.title}</h2>
              <p className="sub">
                {String(nextTalk.data.affiliation)} · Zoom, RSVP on Luma · in {untilLabel(String(nextTalk.data.startsAt), now.getTime())}
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow">Talks</span>
              <h2>All sessions are done</h2>
            </>
          )}
          <Link href="/talks" style={{ marginTop: "auto", fontWeight: 500, textDecoration: "none" }}>All {talks.length} sessions →</Link>
        </article>
      </section>

      <section className="card" aria-label="Team clocks">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15 }}>Team clocks</h2>
          <span className="muted">Grouped by profile time zone · teammates appear when they join</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 10 }}>
          {clocks.map((c) => (
            <div key={c.tz} style={{ padding: "12px 14px", border: "1px solid var(--line2)", borderRadius: 4, background: "var(--bg)", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 500 }}>{c.names.join(" + ")}</span>
              <span className="mono" style={{ fontSize: 22 }}>{c.time}</span>
              <span style={{ fontSize: 12, color: c.awake ? "var(--teal)" : "var(--muted)" }}>
                {c.zone} · {c.awake ? "awake" : "probably asleep"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Evidence workflow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">The evidence workflow</span>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 10 }}>
          {STEPS.map(([t, d], i) => (
            <div key={t} className="band" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="eyebrow">0{i + 1} · {t}</span>
              <span style={{ color: "var(--band-fg2)" }}>{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
        <article className="card">
          <h2 style={{ fontSize: 15 }}>Recently changed</h2>
          <div>
            {changes.length === 0 && <p className="muted">Nothing yet. Approved suggestions and edits show up here.</p>}
            {changes.map((c, i) => (
              <div className="row" key={i}>
                <span className="mono muted" style={{ width: 92, flexShrink: 0 }}>{fmt(c.at, me.tz)}</span>
                <span>
                  <Link href={itemHref(c.kind, c.slug)} style={{ fontWeight: 500, textDecoration: "none" }}>{c.title}</Link> · v{c.version}
                  {c.by ? ` · ${c.by}` : ""}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2 style={{ fontSize: 15 }}>Read these first</h2>
          <div>
            {READ_FIRST.map(([href, t]) => (
              <div className="row" key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{t} ↗</a>
              </div>
            ))}
          </div>
        </article>
      </section>

      {discipline && (
        <div style={{ padding: "14px 16px", borderRadius: 4, border: "1px dashed var(--line)", color: "var(--fg2)", fontSize: 13 }}>
          <b style={{ color: "var(--fg)" }}>Reading discipline.</b> {discipline.body}
        </div>
      )}
    </>
  );
}
