/**
 * Builds content/seed.json from the team brief and the sprint wiki, both read from the
 * parent workspace. Runs locally only; content/ is git-ignored because the repo is public.
 *
 *   npx tsx scripts/build-seed.ts
 *   BRIEF=... WIKI=... npx tsx scripts/build-seed.ts   (override the source paths)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import vm from "node:vm";
import matter from "gray-matter";

const ROOT = resolve(__dirname, "..");
const BRIEF = resolve(process.env.BRIEF ?? join(ROOT, "../website-design/ai-collusion-team-brief.html"));
const WIKI = resolve(process.env.WIKI ?? join(ROOT, "../wiki"));
const OUT = join(ROOT, "content/seed.json");

type SeedItem = {
  kind: string;
  slug: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status?: string;
  origin: "brief" | "wiki";
  sha?: string;
  sort: number;
};

const items: SeedItem[] = [];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);

// ---------- brief ----------

// The brief misnames the talk 1 speaker; the source notes and the wiki say Joan Velja.
const html = readFileSync(BRIEF, "utf8").replace(/\r\n/g, "\n").replace(/Yoann/g, "Joan Velja");
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

/** Small HTML-to-markdown pass for the brief's hand-written cards and boxes. */
function md(fragment: string): string {
  return decode(
    fragment
      .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
      .replace(/<(strong|b)>(.*?)<\/\1>/g, "**$2**")
      .replace(/<(em|i)>(.*?)<\/\1>/g, "*$2*")
      .replace(/<code>(.*?)<\/code>/g, "`$1`")
      .replace(/<li>/g, "\n- ")
      .replace(/<\/(p|ul|h3|div)>/g, "\n\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scriptConst(name: string, endMarker: RegExp): string {
  const start = html.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`brief: const ${name} not found`);
  const rest = html.slice(start);
  const m = rest.match(endMarker);
  if (!m || m.index === undefined) throw new Error(`brief: end of ${name} not found`);
  return rest.slice(0, m.index + m[0].length);
}

// The brief is our own file; evaluating its data literals in an empty context is safe.
const ctx = vm.createContext({});
vm.runInContext(scriptConst("SOURCES", /\];\n/).replace("const SOURCES", "var SOURCES"), ctx);
vm.runInContext(scriptConst("ANGLES", /\}\];\n/).replace("const ANGLES", "var ANGLES"), ctx);
vm.runInContext(scriptConst("REFINE", /\};\n/).replace("const REFINE", "var REFINE"), ctx);
vm.runInContext(scriptConst("PACKAGES", /\];\n/).replace("const PACKAGES", "var PACKAGES"), ctx);
vm.runInContext(scriptConst("DECISIONS", /\]\];\n/).replace("const DECISIONS", "var DECISIONS"), ctx);
const { SOURCES, ANGLES, REFINE, PACKAGES, DECISIONS } = ctx as unknown as {
  SOURCES: Record<string, string>[];
  ANGLES: Record<string, unknown>[];
  REFINE: Record<string, string>;
  PACKAGES: string[][];
  DECISIONS: [string, string, string[]][];
};

ANGLES.forEach((a, i) => {
  const id = String(a.id);
  const body = [
    `**Question.** ${a.q}`,
    `**Design.** ${a.design}`,
    a.needs ? `**Needs.** ${a.needs}` : "",
    a.fit ? `**Fit.** ${a.fit}` : "",
    REFINE[id] ? `**From the talks.** ${REFINE[id]}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  items.push({
    kind: "angle",
    slug: id.toLowerCase(),
    title: String(a.title),
    body,
    data: { letter: id, tracks: a.tracks, source: a.src ?? "", question: a.q, recommended: Boolean(a.rec), refine: REFINE[id] ?? "" },
    origin: "brief",
    sort: i,
  });
});

// Team cards
const people = [...html.matchAll(/<article class="card person[^"]*">([\s\S]*?)<\/article>/g)];
people.forEach((m, i) => {
  const inner = m[1];
  const tag = decode(inner.match(/<span class="tag">(.*?)<\/span>/)?.[1] ?? "");
  const name = decode(inner.match(/<h3>(.*?)<\/h3>/)?.[1] ?? `Member ${i + 1}`);
  const chip = decode((inner.match(/<p class="chip">(.*?)<\/p>/)?.[1] ?? "").replace(/<[^>]+>/g, ""));
  const body = md(inner.replace(/<span class="tag">.*?<\/span>/, "").replace(/<h3>.*?<\/h3>/, "").replace(/<p class="chip">.*?<\/p>/, ""));
  items.push({ kind: "person", slug: slugify(name.split(" ")[0]), title: name, body, data: { location: tag, suggested: chip }, origin: "brief", sort: i });
});

function box(heading: string): string {
  const re = new RegExp(`<h3>${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h3>([\\s\\S]*?)</(div|article)>`);
  const m = html.match(re);
  if (!m) throw new Error(`brief: box "${heading}" not found`);
  return md(m[1]);
}
const notes: [string, string, string][] = [
  ["suggested-combination", "Suggested combination", box("Suggested combination")],
  ["what-the-talks-mean", "What the talks mean for us", box("What this means for us")],
  ["new-from-talk-1", "New from talk 1", box("New from talk 1")],
  ["engineering", "On engineering", md(html.match(/<div class="note"><strong>On engineering:<\/strong>([\s\S]*?)<\/div>/)?.[1] ?? "")],
  ["reading-discipline", "Reading discipline", md(html.match(/<div class="note"><strong>Reading discipline\.<\/strong>([\s\S]*?)<\/div>/)?.[1] ?? "")],
];
notes.forEach(([slug, title, body], i) => items.push({ kind: "note", slug, title, body, data: {}, origin: "brief", sort: i }));

// Workflow phases, anchored in UTC (US Eastern midnights, EDT = UTC-4).
const phaseText = (h: string) => md(html.match(new RegExp(`<div class="phase"><h3>${h}</h3><p>([\\s\\S]*?)</p></div>`))?.[1] ?? "");
const phases = [
  ["before-friday", "Before Friday", "2026-10-22T04:00:00Z", "2026-10-23T04:00:00Z", phaseText("Before Friday"), ""],
  ["friday", "Friday", "2026-10-23T04:00:00Z", "2026-10-24T04:00:00Z", phaseText("Friday"), "Reproduce the positive control first: scripted collusive pairs flagged, benign pairs not. Then change one lever at a time."],
  ["saturday", "Saturday", "2026-10-24T04:00:00Z", "2026-10-25T04:00:00Z", phaseText("Saturday"), ""],
  ["sunday", "Sunday", "2026-10-25T04:00:00Z", "2026-10-26T11:59:00Z", phaseText("Sunday"), ""],
];
phases.forEach(([slug, title, startsAt, endsAt, body, note], i) =>
  items.push({ kind: "phase", slug, title, body, data: { startsAt, endsAt, note, wiki: slug === "friday" ? "topics/positive-control" : "" }, origin: "brief", sort: i }),
);

// Logistics links; URLs the repo must not carry are left blank and filled in the app.
const links = [
  ["whatsapp", "WhatsApp group", "Day-to-day coordination and quick decisions", ""],
  ["shared-drive", "Shared drive", "Decisions, research question, rubric and the draft write-up", ""],
  ["github-repo", "GitHub repo", "Code, configs and logged results", "https://github.com/Dsinha97/outskiller-ai-safety-sprint"],
  ["sprint-page", "Sprint page", "Apart Research: schedule, Discord, submission form", "https://apartresearch.com/sprints/ai-collusion-research-sprint-2026-10-23-to-2026-10-25"],
  ["compute", "Compute", "Modal for fan-out across seeds; results show in Library → Results", ""],
  ["calls", "Calls", "Optional, short, and scheduled inside the shared awake band", ""],
];
// The team's Drive and Discord links are recorded in wiki/people/our-team.md; they go into the
// database through the seed, so they never land in this public repo.
const teamPage = readFileSync(join(WIKI, "people/our-team.md"), "utf8");
const found = (re: RegExp) => teamPage.match(re)?.[0] ?? "";
links[1][3] ||= found(/https:\/\/drive\.google\.com\/[^\s>)]+/);
const discord = found(/https:\/\/discord\.gg\/[^\s>)]+/);
if (discord) links.splice(1, 0, ["discord", "Discord", "Alternative space for collaboration and calls", discord]);
links.forEach(([slug, title, body, url], i) => items.push({ kind: "link", slug, title, body, data: { url }, origin: "brief", sort: i }));

// ---------- wiki ----------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

const SECTIONS = new Set(["papers", "environments", "questions", "tracks", "themes", "topics", "people", "sprint"]);
const wikiFiles = walk(WIKI).filter((p) => relative(WIKI, p) !== "index.md" && !relative(WIKI, p).startsWith("exports"));

/** Wiki-relative links become app routes; links into sources/ become plain text. */
function rewrite(body: string, file: string): string {
  const fromDir = posix.dirname(relative(WIKI, file).split(sep).join("/"));
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)\n?/g, "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text: string, href: string) => {
      if (/^(https?:|mailto:)/.test(href)) return whole;
      const [path, hash] = href.split("#");
      const target = posix.normalize(posix.join(fromDir, decodeURIComponent(path)));
      if (target.startsWith("../") || target.startsWith("sources/")) return text;
      if (target === "index.md") return `[${text}](/library)`;
      const [section, ...rest] = target.replace(/\.md$/, "").split("/");
      if (!SECTIONS.has(section) || rest.length !== 1) return text;
      return `[${text}](/library/${section}/${rest[0]}${hash ? `#${hash}` : ""})`;
    });
}

const wikiPages = new Map<string, { title: string; summary: string; section: string }>();
const ideas: { label: string; theme: string }[] = [];
let checklist: string[] = [];

for (const file of wikiFiles) {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const { data: fm, content } = matter(raw);
  const relPath = relative(WIKI, file).split(sep).join("/");
  const [section, name] = relPath.replace(/\.md$/, "").split("/");
  if (!SECTIONS.has(section) || !name) continue;
  const lines = content.replace(/^\s*#\s+.*\n/, "").split("\n");
  const summaryIdx = lines.findIndex((l) => l.startsWith(">"));
  const summary = summaryIdx >= 0 ? lines[summaryIdx].replace(/^>\s*/, "").trim() : "";
  if (summaryIdx >= 0) lines.splice(summaryIdx, 1);
  const body = rewrite(lines.join("\n").trim(), file);
  const slug = `${section}/${name}`;
  const title = String(fm.title ?? name);
  wikiPages.set(slug, { title, summary: rewrite(summary, file), section });
  items.push({
    kind: "wiki",
    slug,
    title,
    body,
    data: { section, type: fm.type ?? section, tags: fm.tags ?? [], updated: fm.updated ? String(fm.updated).slice(0, 10) : "", summary: rewrite(summary, file) },
    origin: "wiki",
    sha: sha(raw),
    sort: 0,
  });

  if (section === "themes") {
    const gaps = content.split(/\n## /).find((s) => s.startsWith("Open gaps"));
    gaps
      ?.split("\n")
      .filter((l) => /^[-*]\s+/.test(l))
      .forEach((l) => ideas.push({ label: rewrite(l.replace(/^[-*]\s+/, "").trim(), file), theme: slug }));
  }
  if (slug === "sprint/submission-requirements") {
    checklist = content.split("\n").filter((l) => l.startsWith("- [ ]")).map((l) => l.replace("- [ ]", "").trim());
  }
}

// Sources: the brief's 42 cards, linked to wiki paper pages where the titles match.
const norm = (s: string) => new Set(s.replace(/\(.*?\)/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3));
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};
const paperPages = [...wikiPages.entries()].filter(([, v]) => v.section === "papers");
const matched = new Set<string>();
SOURCES.forEach((s, i) => {
  let best = "";
  let score = 0;
  if (s.type === "Research paper") {
    for (const [slug, p] of paperPages) {
      const j = jaccard(norm(s.title), norm(p.title));
      if (j > score) [best, score] = [slug, j];
    }
  }
  const wiki = score >= 0.34 ? best : "";
  if (wiki) matched.add(wiki);
  items.push({ kind: "source", slug: slugify(s.title), title: s.title, body: s.summary ?? "", data: { ...s, wiki }, origin: "brief", sort: i });
});
paperPages
  .filter(([slug]) => !matched.has(slug))
  .forEach(([slug, p], i) =>
    items.push({
      kind: "source",
      slug: slugify(p.title),
      title: p.title,
      body: p.summary,
      data: { type: "Research paper", wiki: slug, summary: p.summary, scope: "From the sprint wiki; not in the original brief's library." },
      origin: "wiki",
      sort: SOURCES.length + i,
    }),
  );

const TALK_NOTES: Record<string, string> = {
  "talk-1": `**The argument.** In real incidents agents mostly skipped steganography and used cheaper side channels nobody watched: DNS, CI logs, caches, wikis. Steganography becomes likely when side channels are closed, coordination is cheap (same model or shared weights), and training pressure lands on the monitored channel itself. So hardening a sandbox can *raise* the pressure to hide messages in plain sight.

**Threat ladder**, easiest to hardest to oversee: one agent obscures its reasoning → agents coordinate on an unmonitored channel → agents hide messages inside the monitored channel → the monitor itself colludes.

**From the 2024 paper (Hidden in Plain Text).** Steganography emerged from optimization pressure without anyone asking for it. Paraphrasing cut multi-bit capacity but did not stop 1-bit messages (at least 90% decoding success in the paper).

**Oversight advice.** List every path one agent can write and another can read. Monitor attempts and actions, not only outputs. Keep reasoning legible. A defense counts if it pushes the success-vs-bitrate frontier toward zero, not just if detection improves.

**Experiments he wants to see**
- Monitored channel vs a reachable side channel: vary coordination cost and side-channel usability, record which route agents take (our Angle G). Main confound: make sure the "closed" channels really are closed.
- A tool-augmented overseer against a plain LLM monitor.
- Activation probes trained on synthetic stego data.
- Collusion success under paraphrasing and jamming at 1-bit payloads.`,
  "talk-2": `**The argument.** Agents have an incentive to collude in secret: colluding raises their score, getting caught lowers it. Capability for this is rising and control may fall behind. Steganographic collusion between LLMs is still unproven in the wild; the Hugging Face incident was plain-text coordination on an unsanctioned message board.

**Capability trend (2024 Secret Collusion paper).** GPT-4 led on every axis: 56% on a simple coordination scheme, 92% on Base64, and it slipped past an overseer about 26% of the time. Base64 and Caesar were near zero before GPT-4. He expects today's frontier models to pass most of these tests.

**Early warning sign.** Invisible Unicode tag characters carrying a URL inside an agent's post. Easy to catch by inspecting Unicode, but it shows the direction of travel.

**Mitigations and their limits**
- Training against collusion only acts at training time; at test time collusion may still pay.
- Restricting tools helps, but agents can write their own code and find randomness.
- Paraphrasing is the most practical, yet the meaning (which topic, which choice) still carries bits.
- Blocking channels hurts task performance enough that deployments reopen them.
- Perfectly secure steganography is invisible in the channel, so watch actions, tool use and chain of thought.

**Weekend ideas he suggested.** Show that paraphrasing works as a defense (he is not optimistic); RL-train colluding agents and test monitors or probes against them; Schelling-point coordination across model versions; a monitor for encoded chain of thought and hidden Unicode; an agent colluding with a future copy of itself. These feed our Angles E, F and G.`,
};

// Talks and sessions, from wiki/sprint/schedule.md (times there are given in ET and UTC);
// Luma links from sources/sprint/Schedule.md. Held talks get short notes; the full wiki page stays linked.
const talks: { slug: string; luma: string; speaker: string; aff: string; title: string; at: string; mins?: number; wiki?: string; people?: string[]; papers?: string[]; note?: string; event?: boolean }[] = [
  { slug: "talk-1", luma: "https://luma.com/ai-collusion-research-sprint-joan-velja", speaker: "Joan Velja", aff: "Oxford", title: "How concerned should we be by steganography?", at: "2026-10-22T14:15:00Z", mins: 54, wiki: "sprint/talk-1-steganographic-collusion", people: ["people/joan-velja"], papers: ["papers/hidden-in-plain-text"] },
  { slug: "talk-2", luma: "https://luma.com/ai-collusion-research-sprint-sumeet-motwani", speaker: "Sumeet Motwani", aff: "Oxford", title: "We're Not Prepared for Steganographic Collusion", at: "2026-10-22T17:15:00Z", mins: 41, wiki: "sprint/talk-2-not-prepared-for-steganographic-collusion", people: ["people/sumeet-motwani"], papers: ["papers/secret-collusion-ai-agents"] },
  { slug: "kemeklis", luma: "https://luma.com/ai-collusion-research-sprint-jurgis-kemeklis", speaker: "Jurgis Kemeklis", aff: "MIT AI Alignment, Redwood", title: "Mitigating Insider threats from AIs with AI control", at: "2026-10-23T15:15:00Z", people: ["people/jurgis-kemeklis"] },
  { slug: "logistics", luma: "https://luma.com/ai-collusion-research-sprint-logistics", speaker: "Kamil Alaa", aff: "Apart Research", title: "Sprint Logistics: how the weekend works", at: "2026-10-23T16:15:00Z", mins: 30, event: true, note: "Tracks and the Red-teaming challenge, rules, how to submit and the deadline, talks still to come, Modal credits, finding a team on Discord. Recorded." },
  { slug: "anwar", luma: "https://luma.com/ai-collusion-research-sprint-usman-anwar", speaker: "Usman Anwar", aff: "Cambridge", title: "Challenges in Detecting Steganography in LLM Transcripts", at: "2026-10-23T17:15:00Z", people: ["people/usman-anwar"] },
  { slug: "bagdasarian-nakamura", luma: "https://luma.com/ai-collusion-sprint-bagdasarian-nakamura", speaker: "Eugene Bagdasarian and Mason Nakamura", aff: "UMass Amherst", title: "Colosseum authors (title not announced)", at: "2026-10-23T18:15:00Z", people: ["people/eugene-bagdasarian", "people/mason-nakamura"], papers: ["papers/colosseum-auditing-collusion"] },
  { slug: "shi", luma: "https://luma.com/ai-collusion-research-sprint-jerick-shi", speaker: "Jerick Shi", aff: "The Voleon Group", title: "When Agents Lie author (title not announced)", at: "2026-10-24T00:15:00Z", people: ["people/jerick-shi"], papers: ["papers/when-agents-lie"] },
  { slug: "nguyen", luma: "https://luma.com/ai-collusion-research-sprint-khanh-linh-nguyen", speaker: "Khanh Linh Nguyen", aff: "Obello, AI Safety Vietnam", title: "Overview of AI collusion research and the most useful topics for the sprint", at: "2026-10-24T12:15:00Z", people: ["people/khanh-linh-nguyen"], papers: ["papers/traceguard"], note: "Moved from Fri Oct 23 per the updated Luma list." },
  { slug: "nyc-hub", luma: "https://luma.com/ai-collusion-research-sprint-2026-nyc", speaker: "NYC hub at Collider", aff: "In person", title: "NYC hub open (Sat 10am to Sun 6pm ET)", at: "2026-10-24T14:00:00Z", event: true },
  { slug: "lee", luma: "https://luma.com/ai-collusion-research-sprint-matthew-lee", speaker: "Matthew Lee", aff: "Poseidon Research", title: "Defining AI Collusion (in person, streamed)", at: "2026-10-24T15:00:00Z", people: ["people/matthew-lee"] },
];
talks.forEach((t, i) => {
  items.push({
    kind: "talk",
    slug: t.slug,
    title: `${t.speaker}: ${t.title}`,
    body: TALK_NOTES[t.slug] ?? "",
    data: { link: t.luma, recording: "", speaker: t.speaker, affiliation: t.aff, talkTitle: t.title, startsAt: t.at, minutes: t.mins ?? null, held: new Date(t.at) < new Date("2026-10-23T00:00:00Z"), event: Boolean(t.event), wiki: t.wiki ?? "", people: t.people ?? [], papers: t.papers ?? [], note: t.note ?? "" },
    origin: "brief",
    sort: i,
  });
});

const angleLetters = (label: string) => [...new Set((label.split(":")[0].match(/\b[A-H]\b/g) ?? []))];
const angleDecision = DECISIONS.find(([k]) => k === "angle");
const seed = {
  generatedAt: new Date().toISOString(),
  inputs: { brief: relative(ROOT, BRIEF), wiki: relative(ROOT, WIKI), wikiPages: wikiPages.size },
  items,
  ideas,
  checklist,
  roles: { names: ["Liezl", "Carl", "Deepayan", "Prashanth", "Vidhya"], packages: PACKAGES },
  decisions: DECISIONS.filter(([k]) => k !== "angle").map(([key, label, options], i) => ({ key, label, options, sort: i })),
  poll: { title: "Which plan do we run this weekend?", options: (angleDecision?.[2] ?? []).map((label, i) => ({ label, angles: angleLetters(label), sort: i })) },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(seed, null, 2));
const count = (k: string) => items.filter((x) => x.kind === k).length;
console.log(
  `seed: ${items.length} items · wiki ${count("wiki")} · sources ${count("source")} (${matched.size} linked to wiki papers) · angles ${count("angle")} · talks ${count("talk")} · people ${count("person")} · ideas ${ideas.length} · checklist ${checklist.length}`,
);
