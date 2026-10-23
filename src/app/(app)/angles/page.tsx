import Link from "next/link";
import { addPollOption, removePollOption, selectPlan, undoPlan } from "@/app/actions/polls";
import { ChangeDialog } from "@/components/ChangeDialog";
import { Markdown } from "@/components/Markdown";
import { StanceControl } from "@/components/StanceControl";
import { TrackFilter } from "@/components/TrackFilter";
import { currentPoll, getItem, listItems, members, stanceTallies } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Project angles" };
export const dynamic = "force-dynamic";

export default async function AnglesPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const { track = "all" } = await searchParams;
  const [angles, archived, poll, views, ideas, combo, people] = await Promise.all([
    listItems("angle", ["active", "team_project"]),
    listItems("angle", "archived"),
    currentPoll(me.id),
    stanceTallies("angle:", me.id),
    listItems("idea", "candidate"),
    getItem("note", "suggested-combination"),
    members(),
  ]);
  const active = people.filter((p) => !p.disabled).length;
  const decided = poll?.poll.status === "decided";
  const maxVotes = Math.max(1, ...(poll?.options ?? []).map((o) => o.tally.first + o.tally.interested));

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Tracks 1–3 · {angles.length} proposals</span>
          <h1 className="display h1">
            Project <em>angles</em>
          </h1>
          <p className="sub" style={{ maxWidth: "62ch" }}>
            Mark your view on each card. Your stance is saved for the team and feeds the plan poll. Once a plan is selected, the winner becomes the Team Project and the rest move to the archive.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ChangeDialog label="Suggest an angle" heading="Suggest a new angle" kind="angle" type="new" fields={["title", "question", "body"]} isAdmin={isAdmin} className="btn btn-line" />
          {archived.length > 0 && (
            <Link className="btn btn-line" href="/angles/archive">
              Archive ({archived.length})
            </Link>
          )}
        </div>
      </header>

      {poll && (
        <section className="card poll" aria-label="Plan poll" style={{ padding: 20, gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="eyebrow">Plan poll · {decided ? "decided" : "open"}</span>
              <h2 className="display" style={{ fontSize: 26 }}>{decided ? poll.winner?.label : poll.poll.title}</h2>
            </div>
            <span className="muted">
              {poll.voters} of {active} voted
            </span>
          </div>
          {decided ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Link className="btn btn-fill" href="/project">Open the Team Project</Link>
              {isAdmin && (
                <form action={undoPlan}>
                  <button className="btn btn-quiet">Undo selection</button>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 10 }}>
                {poll.options.map((o) => (
                  <div key={o.id} style={{ padding: 14, borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{o.label}</span>
                    <div className="bar">
                      <i style={{ width: `${((o.tally.first + o.tally.interested) / maxVotes) * 100}%` }} />
                    </div>
                    <span className="mono muted" style={{ fontSize: 12 }}>
                      {o.tally.first} first · {o.tally.interested} interested · {o.tally.not} not
                    </span>
                    <StanceControl target={`option:${o.id}`} mine={o.mine} label={`Your vote on ${o.label}`} />
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                        <form action={selectPlan.bind(null, o.id)}>
                          <button className="linkbtn">Select this plan</button>
                        </form>
                        {o.sort >= 100 && (
                          <form action={removePollOption.bind(null, o.id)}>
                            <button className="linkbtn" style={{ color: "var(--muted)" }}>Remove</button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin && (
                <form action={addPollOption} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input name="label" className="input" placeholder="Add an option, e.g. G + F: paraphraser arm" aria-label="New poll option" style={{ flex: "1 1 260px" }} />
                  <button className="btn btn-fill">Add option</button>
                </form>
              )}
              <span className="muted" style={{ fontSize: 12 }}>
                Selecting a plan makes its angles the <b style={{ color: "var(--fg)" }}>Team Project</b>, moves every other angle to the archive, and records the choice on the decisions board. An admin can undo it.
              </span>
            </>
          )}
        </section>
      )}

      <TrackFilter initial={["1", "2", "3"].includes(track) ? track : "all"}>
        {angles.map((a) => {
          const target = `angle:${a.slug}`;
          const t = views.tallies[target] ?? { first: 0, interested: 0, not: 0 };
          const mine = views.mine[target] ?? null;
          return (
            <article key={a.id} id={`angle-${a.slug}`} data-tracks={[...new Set(((a.data.tracks as string[]) ?? []).map((tr) => tr.split(".")[0]))].join(" ")} className={`card${mine === "first" || a.status === "team_project" ? " pick1" : ""}`}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="idbox">{String(a.data.letter ?? a.slug.toUpperCase())}</span>
                {((a.data.tracks as string[]) ?? []).map((tr) => (
                  <span key={tr} className="chip">{tr}</span>
                ))}
                {a.status === "team_project" ? <span className="chip gold">Team Project</span> : a.data.recommended ? <span className="chip gold">Recommended</span> : a.data.source ? <span className="chip gold">{String(a.data.source)}</span> : null}
              </div>
              <h2>{a.title}</h2>
              {a.data.question ? <p className="sub">{String(a.data.question)}</p> : null}
              {a.data.refine ? (
                <p className="note">
                  <b style={{ color: "var(--fg)", fontWeight: 500 }}>From the talks:</b> {String(a.data.refine)}
                </p>
              ) : null}
              <details>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)" }}>Design, needs and fit</summary>
                <Markdown>{a.body}</Markdown>
              </details>
              <StanceControl target={target} mine={mine} label={`Your view on angle ${a.slug.toUpperCase()}`} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="muted">
                  Team: {t.first} first · {t.interested} interested · {t.not} not
                </span>
                <ChangeDialog label="Suggest edit" heading={`Edit angle ${a.slug.toUpperCase()}`} kind="angle" itemId={a.id} fields={["title", "question", "body"]} initial={{ title: a.title, question: String(a.data.question ?? ""), body: a.body }} isAdmin={isAdmin} />
              </div>
            </article>
          );
        })}
      </TrackFilter>

      {combo && (
        <section className="card" aria-label="Suggested combination">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2>{combo.title}</h2>
            <ChangeDialog label="Suggest edit" heading="Edit the suggested combination" kind="note" itemId={combo.id} initial={{ title: combo.title, body: combo.body }} isAdmin={isAdmin} />
          </div>
          <Markdown>{combo.body}</Markdown>
        </section>
      )}

      {ideas.length > 0 && (
        <section className="card" aria-label="Ideas from the wiki">
          <h2>Ideas from the wiki&apos;s open gaps</h2>
          <p className="muted">Candidate projects listed on the five theme pages. {isAdmin ? "Add one to the plan poll to put it to a vote." : "Ask an admin to add one to the plan poll."}</p>
          <div>
            {ideas.map((idea) => (
              <div key={idea.id} className="row" style={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  <Markdown className="prose">{idea.body}</Markdown>
                  <Link href={`/library/${String(idea.data.theme)}`} className="muted">From {String(idea.data.theme).replace("themes/", "").replace(/-/g, " ")}</Link>
                </div>
                {isAdmin && (
                  <form action={addPollOption}>
                    <input type="hidden" name="label" value={idea.title} />
                    <input type="hidden" name="ideaId" value={idea.id} />
                    <button className="btn btn-quiet btn-sm">Add to poll</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
