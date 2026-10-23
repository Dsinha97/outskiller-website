"use client";

import { useMemo } from "react";
import { timeZones } from "@/lib/time";

export function TimeZoneSelect({ name, value, onChange }: { name: string; value: string; onChange?: (tz: string) => void }) {
  const zones = useMemo(() => {
    const list = timeZones();
    return list.includes(value) ? list : [value, ...list];
  }, [value]);
  return (
    <select name={name} value={value} onChange={(e) => onChange?.(e.target.value)}>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
