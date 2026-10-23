"use client";

import { useActionState, useEffect, useState } from "react";
import { joinWithInvite, login, resetPassword, type FormState } from "@/app/actions/auth";
import { TimeZoneSelect } from "./TimeZoneSelect";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-fill" disabled={pending} style={{ height: 48 }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinWithInvite.bind(null, token), undefined);
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">
        Name
        <input name="name" autoComplete="name" required maxLength={80} />
      </label>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input name="password" type="password" autoComplete="new-password" required minLength={10} />
        <span className="hint">At least 10 characters.</span>
      </label>
      <label className="field">
        Where you&apos;ll work from
        <input name="city" placeholder="City" maxLength={80} />
      </label>
      <label className="field">
        Time zone
        <TimeZoneSelect name="tz" value={tz} onChange={setTz} />
        <span className="hint" style={{ color: "var(--teal)" }}>Detected from this device. Every time on the site follows it.</span>
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-fill" disabled={pending} style={{ height: 48 }}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword.bind(null, token), undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">
        New password
        <input name="password" type="password" autoComplete="new-password" required minLength={10} />
        <span className="hint">At least 10 characters.</span>
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-fill" disabled={pending} style={{ height: 48 }}>
        {pending ? "Saving…" : "Set password and sign in"}
      </button>
    </form>
  );
}
