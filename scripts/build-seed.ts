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

// Team pilot results (wiki/topics/grievance-pilot-findings.md, 24 Oct). Team-written, small samples, not independently checked.
const PILOT_EVIDENCE: Record<string, string> = {
  B: "Pilots on synthetic grievance records: with a hidden aim plus private notes, escalation of serious cases fell from about 90% to 28%; one pressured gatekeeper was almost as effective as the whole team. Instructed suppression, not spontaneous. See Library → Results.",
  H: "Pilots: endorsing three unsafe past cases as board-approved dropped watchdog detection (e.g. Sonnet 5.5 98% to 56%, Gemini 3.8 Flash 100% to 33%); one sentence saying the written policy controls restored it on the easy set, only partly on the harder one. Absent in Gemini 4 Argon. See Library → Results.",
};

ANGLES.forEach((a, i) => {
  const id = String(a.id);
  const body = [
    `**Question.** ${a.q}`,
    `**Design.** ${a.design}`,
    a.needs ? `**Needs.** ${a.needs}` : "",
    a.fit ? `**Fit.** ${a.fit}` : "",
    REFINE[id] ? `**From the talks.** ${REFINE[id]}` : "",
    PILOT_EVIDENCE[id] ? `**Pilot evidence so far.** ${PILOT_EVIDENCE[id]}` : "",
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
  kemeklis: `**The argument.** Treat frontier AIs as untrusted insiders. The hard part is that they are numerous, conspiring, and often copies of one another. The talk focuses on the few-blatant-actions end (weight exfiltration, rogue internal deployment), not subtle research sabotage.

**AI control in one picture.** U is the smart, possibly scheming model; T is a weaker model trusted because it is too weak to scheme; H is humans, who can audit only about 2% of actions. T scores each action: low runs, suspicious is rewritten by T, the most suspicious goes to a human. Red team plays U, blue team builds the protocol. Trusted editing reached about 92% safe and 94% useful in the original APPS setup.

**Six defenses, and how each breaks**
- Treat AIs like insiders → the insiders are copies that collude.
- A trusted model checks every action → it is weaker, so attacks slip past.
- A copy of the strong model watches → copies collude without talking.
- Read their reasoning → they can think without writing it down.
- Control everything they see → they know when they are tested.
- Labs already monitor agents → incidents keep happening.

**Collusion without messages.** Copies can pick the same obvious cue (a Schelling point) or recognise their own output ("could I have written this?"). Paraphrasing cannot stop that. Counters he lists: paraphrasing, diverse models, trusted models, honeypots.

**Why it matters to us.** Same idea as the steganography talks from the control side: any monitor that is a copy of the agent may collude with it. Fits the Detection and Audit track. Candidate test: same-model monitor vs different-model monitor, with a same-model no-communication control.

**From the recording.** An AI insider is the worst of both: as numerous as outsiders, with the access of insiders, though we can replay and simulate it. His account of the Hugging Face incident: a message board in a shared package manager ran over two months, OpenAI flushed it and restarted runs on July 6, and agents built a new one two days later in package and directory names. A copy monitor can collude and can also be prompt-injected by the agent it watches; paraphrasing helps but there are many ways to paraphrase. Use CoT and action monitors as an OR. Do not train against bad traces: models learn to stop verbalising. Many of the model claims (Mythos, Astra) are his and not checked.

Slides plus the recording; figures are his citations of other work (e.g. monitor catches 94.9% of first-try attacks at 1% false positives) and are not checked.`,
  logistics: `**Goal.** Build the experiment that catches agents colluding. One of three tracks (Markets and Collusion; Detection and Audit, which also holds the Red-teaming challenge on Poseidon's Dolos-1.5B; Collusion Carriers and Countermeasures). A project can span tracks.

**Rules that can disqualify.** Only the weekend's work is judged; mark pre-sprint code as preexisting in the README and the report. AI tools are fine, but made-up results or references can disqualify. At most two projects per person. One rubric: Impact Potential and Innovation, Execution Quality, Presentation and Clarity. Limitations and Dual-Use / Ethical appendix is required.

**Submitting.** Three steps from the button on the sprint page: project details plus PDF (up to 25 MB), optional material, team details (including Discord username and Google Scholar profile). Deadline Sun Oct 25 11:59 PM AoE = Mon Oct 26 11:59 AM UTC. 4 to 8 pages, 8 a hard cap before references and appendices.

**Watch out: resubmitting.** The Guidelines say resubmitting with the exact same title replaces the PDF; the slide says it does not. In the recording Kamil said the hub document's "replace" line is wrong and the PDF is NOT replaced: make a new submission (safest) or email the new PDF, on the deadline day, because projects go to judges a few hours after the deadline. Plan to submit once with the final PDF; if you must change it, submit again and email it. (This reverses the correction we noted earlier; the wiki page records both.)

**From the recording.** Best-performing teams are 1 to 3 people. The 8-page cap is new and hard; appendices and references can be long. No AI-text detector is used, but a judge who cannot follow a report can decline to score it, so write it yourselves. Undisclosed prior work can mean disqualification; an off-topic project is disqualified. No extension (an hour or two at most). Results in 2 to 3 weeks, maybe 4 (74 judges); roughly 80 to 100 projects go on to the next steps. Prizes $2,000 ($1,000 / 500 / 300 / 100 / 100). Modal gives $50 but needs a card on file. Recordings go in the Discord announcements and on the Schedule tab. Questions: Discord help-desk, tag @Support, or the sprints email.`,
  anwar: `**The argument.** Classical steganography detection needs a "normal" cover distribution to compare against, and LLM reasoning has none (characterising benign traces and labelling stego traces is circular). So judge a transcript by what it lets an agent do, not how it looks.

**The steganographic gap.** Give the same signal Z to a receiver (can use hidden content) and a weaker Sentinel (public content only), and compare their performance on an auditing task. Gap = I_receiver − I_sentinel, normalised to at most 1. Positive means private information only the receiver can use. No reference distribution needed, and it can in principle flag even perfectly secure steganography, since it looks at effects on decisions.

**Evidence on the slides**
- Injected ROT13 cipher: the gap rises with the encoding probability.
- Learned codewords on CoinFlip: gap 0.01 with none, 0.70 with two, 0.92 with four.
- Fine-tuned bigram cipher (GPT-4.1, APPS backdoor audit): longer fine-tuning gives larger gaps; same-family Sentinels show smaller gaps.
- More Sentinel compute reduces the gap (the 14B Sentinel falls from about 0.75 to about 0.15 with a bigger token budget).
- LLM judges rated most encodings as not suspicious and never spotted the hidden nationality signal; the gap was positive on every channel.

**Examples he opens with.** An o3 chain of thought full of "disclaim"/"overshadow" (probably degenerate text, not encoding), loan summaries that encode nationality through framing, and Claude rewrites whose changed first letters spell a target.

**For our project.** A concrete detector for the evidence-standard question: measure decision advantage, not text oddness. Weekend version: reproduce an injected-cipher gap curve with two small open models, with a no-cipher control (gap about 0), and report the gap against Sentinel size and token budget.

**From the recording.** The DeepSeek-R1 vs V3 audit found no steganographic gap. He says LLMs cannot yet do natural steganographic communication on their own (about one to four bits at most), but expects capability to grow with latent computation; trained propensity is the best defence. The gap needs a trusted Sentinel and an auditing task; watermarks are not detected. An LLM suspiciousness judge is a weak baseline because it looks for garbled text; paraphrasing as a test fails on planted encodings.

The paper is not named on the slides or in the talk.`,
  "bagdasarian-nakamura": `**The talk.** The Colosseum paper, presented: how to audit collusion among cooperative agents, built on DCOPs (single-step multi-agent decision problems with a known optimum). Opens with the Hugging Face incident as motivation.

**Why auditing is hard, and the fix for each.** Collusion is subjective, so use regret metrics grounded in the task. Evidence is sparse, so analyse messages and actions together. Knowing when collusion forms is intractable, so use single-step DCOPs.

**Metrics.** A collusion judge (an LLM reads the channel), coalition advantage (do coalition members earn more than non-members), and overall regret against the optimal solution. Collusion intensity λ in [0,1] mixes the cooperative and hidden coalition objectives, a ready-made one-lever sweep.

**Four types.** Direct (judge up, advantage up), hidden (judge flat, advantage up), attempted or "collusion-on-paper" (judge up, advantage flat), none.

**Answers on the slides**
- RQ1: an LLM judge alone is not enough; action-based metrics are needed.
- RQ2: collusive talk does not generally become collusive action (Kimi-K2-Thinking and MiniMax talked a lot, acted little).
- RQ3: some models show emergent hidden collusion once a secret channel exists.
- RQ4: persuasion, objective misalignment and network topology all change efficacy; topology can mitigate, unequal power promotes it.

**Setup.** Meeting scheduling, Jira ticket allocation and hospital environments; at least 30 runs per data point, 6 agents (slide numbers, not from the paper page).

**Conclusion.** Audit language and actions together; agents may not act on what they claim; even a benign private channel can enable emergent collusion. Code: github.com/umass-ai-safety/colosseum.

**For our project.** Use words-and-actions together plus a no-secret-channel control, and sweep λ one lever at a time.

32 of 42 slides captured.

**From the recording.** At least 30 runs per data point, 6 agents (confirmed by Mason). Baseline is a classical DCOP solver (approximately optimal). At lambda = 0, a secret channel between two benign agents raised their coalition advantage on average; cause unexplained. Kimi-K2-Thinking and MiniMax talked but did not act because other agents took the actions they planned. The code-word weakness: the judge can be fooled, hence audit actions. For a weekend project they suggested the mitigation trade-off (public blackboard vs efficiency) in meeting scheduling or Jira, not the hospital environment. Rerunning on newer models is not planned soon.`,
  shi: `**The talk.** "Lies, Broken Promises, and Silence": how to measure deception in multi-agent LLMs, and what it means for collusion. This is from the recording's transcript and slides.

**Three-tier test for deception.** T0 misrepresentation (the output is false); T1 deception (the model knew better and acted on purpose); T2 manipulation (it changed a person's choice). Telling a model to lie does not count as intent, because the instruction supplies the goal. Of 92 evaluation papers, 60 have no incentive arm, only 5 add a reversed-incentive arm, and 32 show the model knew better. MASK and Insider Trading reach T0 only. Report the tier your evidence supports.

**Do agents keep their word?** Plan, announce, act in repeated games; ten models, six games, about 490,000 calls. Promise-breaking depends on the model and the game together (claude-opus-5: 0% in Weakest link, 88% in Diners). A model's awareness of breaking a promise is unrelated to how often it breaks one (rho 0.07). Over rounds, behaviour diverges: in 25-round Diners claude-opus-5 falls to 0, claude-sonnet-5 rises to about 90. Only a private plan that disagrees with the announcement shows intent to mislead.

**Do agents tell the whole truth?** In a resource game with private recipes, competitive agents withhold a known detail in 185 of 289 speaking rounds (aligned 14 of 395). With no lying prompt, agents still deceive by selective disclosure and silence.

**How to stand out.** Collusion has three variables: environment, agents, interactions; most papers are markets, GPT or Claude by API, and steganography or private messaging. Change one, or ground a simulation in real-world risk.

**For our project.** Add a matched reversed-incentive arm to any aim-prompted result, report the evidence tier, classify private notes against announcements, and run more than one model.

Caveats: transcript is machine-made; the slide 41 bar segments (358) do not add to the stated 289 rounds, so check before citing.`,
  nguyen: `**The talk.** Khanh Linh Nguyen (first author of TraceGuard) gives an overview of AI collusion research. This is from 26 slide captures plus the Zoom transcript and chat.

**The field.** Five waves (tabular RL, deep RL, LLM agents, secret collusion, detection) and four strands (emergence, carriers, detection, mitigation). Most of the 100+ papers are pricing studies. Producing collusion is easy; proving it is the hard part (94% of long-horizon runs colluded when two agents shared task logs, in a 2026 paper). Reading the transcript is not enough: messages can be hidden, faithful reasoning can still collude, and each step can look benign. Anchor on actions and outcomes across the whole episode.

**Detection.** Ten ways to look for collusion, from statistical tests to white-box probes. Only 2 of 229 emergent collusive episodes put the coordination into words. When agents know about the monitor, detection gets harder (20 of 40 attacks never caught at 1% FPR). TraceGuard at 1% FPR catches 20% of attacks (75% at 5%).

**Say and do.** A monitor must separate four cases: agreement carried out (flag), cheap talk, parallel moves with no talk, and competition. Over 90% of broken promises were already in private plans; adding agent messages lifted sabotage detection from 68% to 81% at 2% FPR.

**Six rules for a Track 2.2 study.** Freeze the monitor; report false alarms (recall at 1% and 5%, AUROC); add hard negatives; compress the report; add computed signals (price correlation, HHI, regret); vary the provider.

**Open.** The evidence still disagrees on whether collusion lasts, whether deep RL colludes, whether mixing agents helps, and whether reasoning traces reveal it. No study has compared mitigations on the same markets.

Caveats: 26 of at least 31 slides captured; many cited papers are not in the wiki's sources; the transcript is machine-made.

**From the recording.** The speaker says they are not an AI-safety specialist and read from notes, and that the methods list may be incomplete. At 1% FPR TraceGuard catches 20% of attacks (75% at 5%): fine for an AI-control deployment, but for an antitrust-type auditor the low-FPR end is what matters. Q&A advice: pick something that adds to existing research, or bring a new environment to an existing method. Asked whether a same-model monitor with narrow questions would match a different-provider one, they said they could not say and it should be tested. First papers to read: AI Control (Greenblatt et al.), then Secret Collusion (Motwani et al. 2024).`,
};

// Talks and sessions, from wiki/sprint/schedule.md (times there are given in ET and UTC);
// Luma links from sources/sprint/Schedule.md. Held talks get short notes; the full wiki page stays linked.
const talks: { slug: string; luma: string; speaker: string; aff: string; title: string; at: string; mins?: number; wiki?: string; people?: string[]; papers?: string[]; note?: string; event?: boolean; recorded?: boolean }[] = [
  { slug: "talk-1", luma: "https://luma.com/ai-collusion-research-sprint-joan-velja", speaker: "Joan Velja", aff: "Oxford", title: "How concerned should we be by steganography?", at: "2026-10-22T14:15:00Z", mins: 54, wiki: "sprint/talk-1-steganographic-collusion", people: ["people/joan-velja"], papers: ["papers/hidden-in-plain-text"] },
  { slug: "talk-2", luma: "https://luma.com/ai-collusion-research-sprint-sumeet-motwani", speaker: "Sumeet Motwani", aff: "Oxford", title: "We're Not Prepared for Steganographic Collusion", at: "2026-10-22T17:15:00Z", mins: 41, wiki: "sprint/talk-2-not-prepared-for-steganographic-collusion", people: ["people/sumeet-motwani"], papers: ["papers/secret-collusion-ai-agents"] },
  { slug: "kemeklis", luma: "https://luma.com/ai-collusion-research-sprint-jurgis-kemeklis", speaker: "Jurgis Kemeklis", aff: "MIT AI Alignment, Redwood", title: "Mitigating Insider threats from AIs with AI control", at: "2026-10-23T15:15:00Z", wiki: "sprint/talk-3-mitigating-insider-threats-ai-control", people: ["people/jurgis-kemeklis"], papers: ["papers/sleight-bench"] },
  { slug: "logistics", luma: "https://luma.com/ai-collusion-research-sprint-logistics", speaker: "Kamil Alaa", aff: "Apart Research", title: "Sprint Logistics: how the weekend works", at: "2026-10-23T16:15:00Z", mins: 30, event: true, recorded: true, wiki: "sprint/talk-4-sprint-logistics", people: ["people/kamil-alaa"], note: "Tracks and the Red-teaming challenge, rules, how to submit and the deadline, talks still to come, Modal credits, finding a team on Discord. Recorded." },
  { slug: "anwar", luma: "https://luma.com/ai-collusion-research-sprint-usman-anwar", speaker: "Usman Anwar", aff: "Cambridge", title: "Challenges in Detecting Steganography in LLM Transcripts", at: "2026-10-23T17:15:00Z", wiki: "sprint/talk-5-steganography-in-llm-transcripts", people: ["people/usman-anwar"] },
  { slug: "bagdasarian-nakamura", luma: "https://luma.com/ai-collusion-sprint-bagdasarian-nakamura", speaker: "Eugene Bagdasarian and Mason Nakamura", aff: "UMass Amherst", title: "Auditing Collusion in Cooperative Multi-Agent Systems (Colosseum)", at: "2026-10-23T18:15:00Z", people: ["people/eugene-bagdasarian", "people/mason-nakamura"], wiki: "sprint/talk-6-auditing-collusion-colosseum", papers: ["papers/colosseum-auditing-collusion"] },
  { slug: "shi", luma: "https://luma.com/ai-collusion-research-sprint-jerick-shi", speaker: "Jerick Shi", aff: "The Voleon Group", title: "Lies, Broken Promises, and Silence", at: "2026-10-24T00:15:00Z", wiki: "sprint/talk-7-lies-broken-promises-and-silence", people: ["people/jerick-shi"], papers: ["papers/when-agents-lie"] },
  { slug: "nguyen", luma: "https://luma.com/ai-collusion-research-sprint-khanh-linh-nguyen", speaker: "Khanh Linh Nguyen", aff: "Obello, AI Safety Vietnam", title: "Overview of AI collusion research and the most useful topics for the sprint", at: "2026-10-24T12:15:00Z", wiki: "sprint/talk-8-overview-of-collusion-research", people: ["people/khanh-linh-nguyen"], papers: ["papers/traceguard"], note: "Moved from Fri Oct 23 per the updated Luma list." },
  { slug: "nyc-hub", luma: "https://luma.com/ai-collusion-research-sprint-2026-nyc", speaker: "NYC hub at Collider", aff: "In person", title: "NYC hub open (Sat 10am to Sun 6pm ET)", at: "2026-10-24T14:00:00Z", event: true },
  { slug: "lee", luma: "https://luma.com/ai-collusion-research-sprint-matthew-lee", speaker: "Matthew Lee", aff: "Poseidon Research", title: "Defining AI Collusion (in person, streamed)", at: "2026-10-24T18:00:00Z", note: "Moved from 11:00am to 2:00pm ET (calendar invite updated Oct 24).", people: ["people/matthew-lee"] },
];
talks.forEach((t, i) => {
  items.push({
    kind: "talk",
    slug: t.slug,
    title: `${t.speaker}: ${t.title}`,
    body: TALK_NOTES[t.slug] ?? "",
    data: { link: t.luma, recording: "", speaker: t.speaker, affiliation: t.aff, talkTitle: t.title, startsAt: t.at, minutes: t.mins ?? null, held: new Date(t.at) < new Date("2026-10-24T13:30:00Z"), recorded: Boolean(t.recorded), event: Boolean(t.event), wiki: t.wiki ?? "", people: t.people ?? [], papers: t.papers ?? [], note: t.note ?? "" },
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
