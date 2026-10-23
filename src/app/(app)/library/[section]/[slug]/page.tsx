import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeDialog } from "@/components/ChangeDialog";
import { Markdown } from "@/components/Markdown";
import { getItem } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  const page = await getItem("wiki", `${section}/${slug}`);
  return { title: page?.title ?? "Library" };
}

export default async function WikiPage({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const me = await requireUser();
  const { section, slug } = await params;
  const page = await getItem("wiki", `${section}/${slug}`);
  if (!page) notFound();
  const tags = (page.data.tags as string[]) ?? [];
  return (
    <>
      <nav className="muted" aria-label="Breadcrumb">
        <Link href="/library">Library</Link> / {section}
      </nav>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">
          {String(page.data.type ?? section)} · from the wiki{page.data.updated ? `, updated ${String(page.data.updated)}` : ""}
        </span>
        <h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>{page.title}</h1>
        {page.data.summary ? <Markdown className="lede">{String(page.data.summary)}</Markdown> : null}
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        )}
      </header>
      <article className="card" style={{ padding: "24px 28px" }}>
        <Markdown>{page.body}</Markdown>
      </article>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <ChangeDialog label="Flag an issue" heading={`Flag: ${page.title}`} kind="wiki" itemId={page.id} type="flag" isAdmin={me.role === "admin"} className="btn btn-quiet" />
        <span className="muted">Wiki pages are fixed in the wiki and re-imported, so the citation trail stays intact.</span>
      </div>
    </>
  );
}
