import { desc } from "drizzle-orm";
import { revokeInvite, setDisabled, setRole } from "@/app/actions/admin";
import { InviteForm, ResetLinkButton } from "@/components/AdminLinks";
import { db, schema } from "@/db";
import { members } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { fmt } from "@/lib/time";

export const metadata = { title: "Members & invites" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const me = await requireAdmin();
  const d = await db();
  const [people, invites] = await Promise.all([members(), d.select().from(schema.invites).orderBy(desc(schema.invites.createdAt))]);
  const now = Date.now();
  const inviteLabel = new Map(invites.map((i) => [i.id, i.label]));

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Admin</span>
        <h1 className="display h1">
          Members &amp; <em>invites</em>
        </h1>
        <p className="sub">Anyone with a live invite link can create an account. Post it in the team WhatsApp or Discord, and revoke it once everyone has joined.</p>
      </header>

      <section className="card">
        <h2>New invite link</h2>
        <InviteForm />
      </section>

      <section className="card">
        <h2>Invite links</h2>
        <div>
          {invites.length === 0 && <p className="muted">No invites yet.</p>}
          {invites.map((i) => {
            const live = !i.revoked && i.expiresAt.getTime() > now && i.uses < i.maxUses;
            return (
              <div key={i.id} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <span>
                  <b style={{ fontWeight: 500 }}>{i.label}</b>{" "}
                  <span className="muted">
                    · {i.uses}/{i.maxUses} used · {i.revoked ? "revoked" : i.expiresAt.getTime() < now ? "expired" : `expires ${fmt(i.expiresAt, me.tz)}`}
                  </span>
                </span>
                {live && (
                  <form action={revokeInvite.bind(null, i.id)}>
                    <button className="linkbtn" style={{ color: "var(--stamp)" }}>Revoke</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Members</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                {["Name", "Where", "Joined", "Role", ""].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--line2)", opacity: p.disabled ? 0.55 : 1, verticalAlign: "top" }}>
                  <td style={{ padding: 8 }}>
                    <b style={{ fontWeight: 500 }}>{p.name}</b>
                    <br />
                    <span className="muted">{p.email}</span>
                  </td>
                  <td style={{ padding: 8 }}>
                    {p.city || "—"}
                    <br />
                    <span className="muted">{p.tz.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: 8 }}>
                    {fmt(p.createdAt, me.tz)}
                    <br />
                    <span className="muted">{p.inviteId ? inviteLabel.get(p.inviteId) ?? "invite" : ""}</span>
                  </td>
                  <td style={{ padding: 8 }}>{p.disabled ? "Disabled" : p.role === "admin" ? "Admin" : "Member"}</td>
                  <td style={{ padding: 8 }}>
                    {p.id !== me.id && (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <form action={setRole.bind(null, p.id, p.role === "admin" ? "member" : "admin")}>
                          <button className="linkbtn">{p.role === "admin" ? "Make member" : "Make admin"}</button>
                        </form>
                        <form action={setDisabled.bind(null, p.id, !p.disabled)}>
                          <button className="linkbtn" style={{ color: p.disabled ? "var(--accent)" : "var(--stamp)" }}>{p.disabled ? "Enable" : "Disable"}</button>
                        </form>
                        <ResetLinkButton userId={p.id} name={p.name.split(" ")[0]} />
                      </div>
                    )}
                    {p.id === me.id && <span className="muted">You</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
