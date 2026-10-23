"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  user: { name: string; role: string; zone: string };
  pending: number;
  pollOpen: boolean;
  teamProject: boolean;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Sidebar({ user, pending, pollOpen, teamProject }: Props) {
  const path = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const moreRoutes = ["/library", "/team", "/lab", "/approvals", "/members", "/me"];
  const inMore = moreRoutes.some((r) => path.startsWith(r)) || (teamProject && path.startsWith("/angles"));
  const [open, setOpen] = useState(inMore);
  const cur = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)) ? "page" : undefined;
  const [q, setQ] = useState("");

  const search = (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/library?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label className="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" aria-label="Search the library" />
      </label>
    </form>
  );

  return (
    <aside className="side" aria-label="Sections">
      <div className="topbar">
        <Link className="brand" href="/">
          <span className="mark" aria-hidden="true">O</span>
          <span>
            <b>Outskiller</b>
            <small>Sprint HQ</small>
          </span>
        </Link>
        <div className="tools">
          <Link className="iconbtn" href="/library" aria-label="Search the library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <ThemeToggle />
          <Link className="avatar" href="/me" aria-label={`${user.name}, your profile`}>
            {initials(user.name)}
          </Link>
        </div>
      </div>
      <Link className="brand wide" href="/">
        <span className="mark" aria-hidden="true">O</span>
        <span>
          <b>Outskiller</b>
          <small>AI Collusion Sprint HQ</small>
        </span>
      </Link>
      <div className="wide">{search}</div>
      <nav className="nav" aria-label="Main">
        <Link href="/" aria-current={cur("/")}>Start here</Link>
        {teamProject ? (
          <Link href="/project" aria-current={cur("/project")}>Team Project</Link>
        ) : (
          <Link href="/angles" aria-current={cur("/angles")}>
            Project angles {pollOpen && <span className="live" role="img" aria-label="Poll open" title="Poll open" />}
          </Link>
        )}
        <Link href="/talks" aria-current={cur("/talks")}>Sprint talks</Link>
        <Link href="/workflow" aria-current={cur("/workflow")}>Workflow</Link>
        <button type="button" className="more" aria-expanded={open} aria-controls="more-sections" onClick={() => setOpen(!open)}>
          <span>{open ? "Less" : "More"}</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {!open && isAdmin && pending > 0 && <span className="badge" aria-label={`${pending} pending approvals`}>{pending}</span>}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {open && (
          <div className="navmore" id="more-sections">
            {teamProject && <Link href="/angles/archive" aria-current={cur("/angles")}>Angle archive</Link>}
            <Link href="/library" aria-current={cur("/library")}>Library</Link>
            <Link href="/team" aria-current={cur("/team")}>Team &amp; roles</Link>
            <Link href="/lab" aria-current={cur("/lab")}>Lab</Link>
            {isAdmin && (
              <>
                <span className="navlabel">Admin</span>
                <Link href="/approvals" aria-current={cur("/approvals")}>
                  Approvals {pending > 0 && <span className="badge">{pending}</span>}
                </Link>
                <Link href="/members" aria-current={cur("/members")}>Members &amp; invites</Link>
              </>
            )}
          </div>
        )}
      </nav>
      <div className="me wide">
        <Link className="avatar" href="/me" aria-label="Your profile">
          {initials(user.name)}
        </Link>
        <span style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>
          <Link href="/me" style={{ display: "block", fontWeight: 500, color: "var(--fg)", textDecoration: "none" }}>
            {user.name}
          </Link>
          <span className="muted">
            {isAdmin ? "Admin" : "Member"} · {user.zone}
          </span>
        </span>
        <ThemeToggle />
      </div>
      <form action={logout} className="wide" style={{ padding: "0 6px" }}>
        <button className="linkbtn" style={{ color: "var(--muted)", fontSize: 12 }}>Sign out</button>
      </form>
    </aside>
  );
}
