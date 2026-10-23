import { Lab } from "@/components/Lab";

export const metadata = { title: "Lab" };

export default function LabPage() {
  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Teaching demos</span>
        <h1 className="display h1">
          Interactive <em>lab</em>
        </h1>
        <p className="callout" style={{ maxWidth: "70ch" }}>
          <b>Illustrative models only.</b> These demos run in your browser with synthetic data and fixed rules. They make no API calls and report no new empirical findings. Their scores and thresholds are teaching devices, not estimates from the papers.
        </p>
      </header>
      <Lab />
    </>
  );
}
