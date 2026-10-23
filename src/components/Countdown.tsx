"use client";

import { useEffect, useState } from "react";
import { untilLabel } from "@/lib/time";

export function Countdown({ to, initial }: { to: string; initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    const tick = () => setLabel(untilLabel(to));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [to]);
  return <span className="mono" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{label}</span>;
}
