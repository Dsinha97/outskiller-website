import Link from "next/link";
import { setItemStatus } from "@/app/actions/content";
import { Markdown } from "@/components/Markdown";
import { listItems } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Angle archive" };
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const me = await requireUser();
  const archived = await listItems("angle", "archived");
  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Not selected this sprint</span>
        <h1 className="display h1">
          Angle <em>archive</em>
        </h1>
        <p className="sub">These angles stayed readable after the plan was chosen. <Link href="/project">Back to the Team Project</Link></p>
      </header>
      {archived.length === 0 && <p className="muted">Nothing archived yet. Angles move here when a plan is selected.</p>}
      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))" }}>
        {archived.map((a) => (
          <article key={a.id} className="card">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="idbox">{a.slug.toUpperCase()}</span>
              {((a.data.tracks as string[]) ?? []).map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
            <h2>{a.title}</h2>
            <Markdown>{a.body}</Markdown>
            {me.role === "admin" && (
              <form action={setItemStatus.bind(null, a.id, "active")}>
                <button className="linkbtn">Restore to active</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
