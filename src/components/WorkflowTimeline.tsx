"use client";

import { useMemo, useState } from "react";
import { fmt, offsetHours } from "@/lib/time";

type Phase = { slug: string; title: string; body: string; note: string; startsAt: string; endsAt: string };
type Talk = { slug: string; title: string; startsAt: string; event: boolean };
type Group = { label: string; tz: string };

const AOE = "Etc/GMT+12";

/** Phases, sessions and the reachability chart, re-timed for whichever zone is selected. */
export function WorkflowTimeline({ myTz, myLabel, phases, talks, groups, deadline, nowIso }: { myTz: string; myLabel: string; phases: Phase[]; talks: Talk[]; groups: Group[]; deadline: string; nowIso: string }) {
  const zones = useMemo(() => {
    const list = [{ key: "me", tz: myTz, label: "My time" }];
    groups.forEach((g) => {
      if (g.tz !== myTz && !list.some((z) => z.tz === g.tz)) list.push({ key: g.tz, tz: g.tz, label: g.label.split(" · ").pop() ?? g.tz });
    });
    list.push({ key: "aoe", tz: AOE, label: "AoE" });
    return list;
  }, [myTz, groups]);
  const [zk, setZk] = useState("me");
  const zone = zones.find((z) => z.key === zk) ?? zones[0];
  const now = new Date(nowIso);
  const at = (iso: string) => fmt(iso, zone.tz);

  // Reachability: each group is awake 8 AM to 10 PM local; show it on the selected zone's clock.
  const zOff = offsetHours(zone.tz, now);
  const heat = groups.map((g) => {
    const gOff = offsetHours(g.tz, now);
    const set = new Set<number>();
    for (let h = 8; h < 22; h++) set.add((((h - gOff + zOff) % 24) + 24) % 24);
    return { ...g, set };
  });
  const all = (h: number) => heat.length > 0 && heat.every((g) => g.set.has(h));
  const hours = Array.from({ length: 24 }, (_, h) => h).filter(all);
  const hl = (h: number) => `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
  const overlap = hours.length ? `${hl(hours[0])} to ${hl(hours[hours.length - 1] + 1)}` : "no hours";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span className="eyebrow">Showing {zone.key === "me" ? `your time · ${myLabel}` : zone.label}</span>
        <div className="tabs" role="group" aria-label="Time zone">
          {zones.map((z) => (
            <button key={z.key} type="button" aria-pressed={z.key === zk} onClick={() => setZk(z.key)}>
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid" aria-label="Timeline" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", alignItems: "start" }}>
        {phases.map((p) => {
          const live = new Date(p.startsAt) <= now && now < new Date(p.endsAt);
          const evs = talks.filter((t) => t.startsAt >= p.startsAt && t.startsAt < p.endsAt);
          const last = p.endsAt === deadline;
          return (
            <article key={p.slug} className={`card${live ? " pick1" : ""}`} style={{ padding: 0, gap: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line2)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <b style={{ fontWeight: 600 }}>{p.title}</b>
                <span className="eyebrow">{live ? "Now" : fmt(p.startsAt, zone.tz, { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontWeight: 500 }}>{p.body}</p>
                {p.note && <p className="callout">{p.note}</p>}
                {live && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                    <i style={{ flex: 1, height: 1, background: "var(--fill)" }} />
                    Now · {at(nowIso)}
                    <i style={{ flex: 1, height: 1, background: "var(--fill)" }} />
                  </div>
                )}
                {evs.map((t) => (
                  <div key={t.slug} style={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", gap: 10, fontSize: 13 }}>
                    <span className="mono muted">{at(t.startsAt)}</span>
                    <a href={`/talks#${t.slug}`} style={{ color: "var(--fg)", textDecoration: "none" }}>{t.event ? t.title : `Talk · ${t.title}`}</a>
                  </div>
                ))}
                {last && (
                  <div className="band" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="eyebrow">Hard deadline</span>
                    <span className="mono" style={{ fontSize: 17 }}>{at(deadline)}</span>
                    <span style={{ fontSize: 12, color: "var(--band-fg2)" }}>= Sun Oct 25, 11:59 PM Anywhere on Earth</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="card" aria-label="Reachability">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15 }}>When everyone is reachable</h2>
          <span className="muted">One cell per hour on the selected clock · 8 AM to 10 PM local for each zone</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {heat.map((g) => (
            <div key={g.tz} className="heatrow">
              <span>{g.label}</span>
              <div className="heat" aria-label={`${g.label} awake hours`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <i key={h} className={all(h) ? "all" : g.set.has(h) ? "on" : ""} />
                ))}
              </div>
            </div>
          ))}
          <div className="heatrow">
            <span className="sp" />
            <div className="axis">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </div>
          </div>
        </div>
        <p className="note">
          All zones awake: <b style={{ color: "var(--fg)" }}>{overlap}</b> {zone.key === "me" ? "your time" : `(${zone.label})`}. Written updates stay the default; book calls inside this band. Before signing off, queue runs for the next zone.
        </p>
      </section>
    </>
  );
}
