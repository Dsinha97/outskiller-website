import { desc, eq } from "drizzle-orm";
import { logout } from "@/app/actions/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { fmt } from "@/lib/time";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const me = await requireUser();
  const d = await db();
  const mine = await d.select().from(schema.suggestions).where(eq(schema.suggestions.authorId, me.id)).orderBy(desc(schema.suggestions.createdAt)).limit(20);
  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">{me.email}</span>
        <h1 className="display h1">
          Your <em>profile</em>
        </h1>
        <p className="sub">Your time zone sets every time on the site and your place on the team clocks.</p>
      </header>
      <section className="card">
        <ProfileForm name={me.name} city={me.city} tz={me.tz} />
      </section>
      <section className="card">
        <h2>Your suggestions</h2>
        {mine.length === 0 && <p className="muted">None yet. Use Suggest edit on any talk, angle, link or team card.</p>}
        <div>
          {mine.map((s) => (
            <div key={s.id} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <span>
                {s.proposed.title ?? (s.type === "flag" ? "Flagged issue" : "Edit")} <span className="muted">· {s.kind} · {fmt(s.createdAt, me.tz)}</span>
              </span>
              <span className="muted" style={{ color: s.status === "approved" ? "var(--teal)" : s.status === "rejected" ? "var(--stamp)" : undefined }}>
                {s.status}
                {s.reply ? ` · "${s.reply}"` : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
      <form action={logout}>
        <button className="btn btn-quiet">Sign out</button>
      </form>
    </>
  );
}
