"use client";

import { useOptimistic, useTransition } from "react";
import { setStance } from "@/app/actions/polls";

const OPTIONS = [
  { key: "first", label: "First choice" },
  { key: "interested", label: "Interested" },
  { key: "not", label: "Not for me" },
] as const;

export function StanceControl({ target, mine, label, disabled }: { target: string; mine: string | null; label: string; disabled?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(mine);
  const [, start] = useTransition();
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={optimistic === o.key}
          disabled={disabled}
          onClick={() =>
            start(async () => {
              setOptimistic(optimistic === o.key ? null : o.key);
              await setStance(target, o.key);
            })
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
