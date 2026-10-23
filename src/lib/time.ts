/** Time helpers shared by server and client. All stored times are UTC ISO strings. */

export const DEADLINE = "2026-10-26T11:59:00Z"; // Sun Oct 25, 11:59 PM Anywhere on Earth (UTC-12)

export function isTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function fmt(iso: string | Date, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit" }) {
  return new Date(iso).toLocaleString("en-US", { timeZone: tz, ...opts });
}

export const fmtTime = (iso: string | Date, tz: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
export const fmtDay = (iso: string | Date, tz: string) => fmt(iso, tz, { weekday: "long", month: "short", day: "numeric" });

/** UTC offset in hours for `tz` at instant `at`. */
export function offsetHours(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((local - at.getTime()) / 36e5);
}

export function zoneName(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

export function untilLabel(iso: string, now = Date.now()): string {
  let s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m`;
}

/** The time zones shown in pickers: browser-supported zones, or a short fallback list. */
export function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/Los_Angeles", "America/New_York", "Africa/Johannesburg", "Europe/London", "Asia/Kolkata"];
  }
}
