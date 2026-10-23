import { ThemeToggle } from "./ThemeToggle";

export function AuthShell({ eyebrow, title, emphasis, lede, children }: { eyebrow: string; title: string; emphasis: string; lede: React.ReactNode; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", justifyContent: "center", padding: "36px 20px" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="brand" style={{ padding: 0 }}>
            <span className="mark" aria-hidden="true">O</span>
            <span>
              <b>Outskiller</b>
              <small>AI Collusion Sprint HQ</small>
            </span>
          </div>
          <ThemeToggle />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display" style={{ fontSize: 38 }}>
            {title} <em>{emphasis}</em>
          </h1>
          <div className="sub">{lede}</div>
        </div>
        {children}
      </div>
    </main>
  );
}
