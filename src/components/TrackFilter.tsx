"use client";

import { useState, type ReactNode } from "react";

const TRACKS = [
  ["all", "All tracks"],
  ["1", "1 · Markets"],
  ["2", "2 · Detection & audit"],
  ["3", "3 · Carriers & countermeasures"],
];

/**
 * Track tabs that filter the cards in place: no navigation, so scroll position, open
 * details and votes in flight stay put. Each child card carries `data-tracks="1 2"`.
 */
export function TrackFilter({ initial, children }: { initial: string; children: ReactNode }) {
  const [track, setTrack] = useState(initial);
  const pick = (k: string) => {
    setTrack(k);
    const url = new URL(window.location.href);
    if (k === "all") url.searchParams.delete("track");
    else url.searchParams.set("track", k);
    window.history.replaceState(window.history.state, "", url);
  };
  return (
    <>
      <nav className="tabs" aria-label="Filter by track">
        {TRACKS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={track === k} onClick={() => pick(k)}>
            {label}
          </button>
        ))}
      </nav>
      <section className="grid track-grid" data-track={track} aria-label="Angles" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))" }}>
        {children}
      </section>
    </>
  );
}
