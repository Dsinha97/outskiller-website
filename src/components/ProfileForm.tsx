"use client";

import { useActionState, useState } from "react";
import { updateProfile, type FormState } from "@/app/actions/auth";
import { TimeZoneSelect } from "./TimeZoneSelect";

export function ProfileForm({ name, city, tz }: { name: string; city: string; tz: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, undefined);
  const [zone, setZone] = useState(tz);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
      <label className="field">
        Name
        <input name="name" defaultValue={name} required maxLength={80} />
      </label>
      <label className="field">
        City
        <input name="city" defaultValue={city} maxLength={80} />
      </label>
      <label className="field">
        Time zone
        <TimeZoneSelect name="tz" value={zone} onChange={setZone} />
        <button type="button" className="linkbtn" style={{ alignSelf: "flex-start", fontWeight: 400 }} onClick={() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>
          Use this device&apos;s zone
        </button>
      </label>
      <label className="field">
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={10} />
        <span className="hint">Leave blank to keep the current one.</span>
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <button className="btn btn-fill" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
