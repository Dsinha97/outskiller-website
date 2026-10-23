# Outskiller Sprint HQ

The logged-in team workspace for Team Outskiller's entry in the [Apart Research AI Collusion Research Sprint](https://apartresearch.com/sprints/ai-collusion-research-sprint-2026-10-23-to-2026-10-25) (Oct 23–25, 2026). It replaces the static team brief with shared, live content:

- **Invite-link sign-up** and email + password sign-in. Admins create invite links on *Members & invites* and post them in WhatsApp or Discord.
- **Living content with approvals.** Talks, project angles, workflow phases, logistics links and team cards can be edited. Members suggest; Deepayan or Liezl approve. Every change is versioned.
- **Polls and plan selection.** Everyone marks a stance on each angle and on the plan options. Selecting a plan turns its angles into the **Team Project** and archives the rest (undoable).
- **Library** of the brief's source cards plus the sprint wiki (papers, research questions, harnesses, concepts), and a **Results** tab that reads `results/*.jsonl` from [outskiller-ai-safety-sprint](https://github.com/Dsinha97/outskiller-ai-safety-sprint).
- **Workflow & decisions** shown in each person's profile time zone: talks, phases, the AoE deadline, the hours when every zone is awake, logistics links, the decisions board and the submission checklist.

This is tooling for the team, not part of the research submission.

## Stack

Next.js 15 (App Router, server actions) · Postgres via Drizzle ORM (Neon in production, [PGlite](https://pglite.dev) on disk for local development) · signed-cookie sessions (`jose`, `bcryptjs`) · deployed on Vercel.

## Local development

No database credentials are needed locally: without `DATABASE_URL` the app uses PGlite in `.data/`.

```bash
npm install
echo "AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")" > .env.local
npm run seed:build   # reads ../website-design/ai-collusion-team-brief.html and ../wiki → content/seed.json
npm run db:migrate
npm run seed         # prints a one-time bootstrap invite link if there are no accounts yet
npm run dev
```

The first account created becomes an admin. `content/` and `.data/` are git-ignored: the seed holds team bios and wiki text, and this repo is public.

## Content sources

`scripts/build-seed.ts` merges two inputs from the parent workspace:

1. **The team brief** (`website-design/ai-collusion-team-brief.html`): angles A–H and their talk refinements, team cards, the role matrix, decisions, workflow phases and notes. The brief's talk 1 speaker name is corrected to Joan Velja, as in the source notes and the wiki.
2. **The sprint wiki** (`wiki/**`, 106 pages): every page becomes a read-only library page, with links rewritten to app routes and links into `sources/` reduced to plain text. Also from the wiki: the sprint schedule (as talks), the submission checklist, and the theme pages' open gaps (as idea candidates for the poll).

Wiki pages are fixed **in the wiki**, then re-imported (`npm run seed:build && npm run seed`). Re-seeding refreshes wiki pages whose content changed and never overwrites edits made in the app.

## Deploying (Vercel + Neon)

1. Import this repo as a Vercel project.
2. Add **Neon Postgres** from the Vercel Marketplace (Storage tab). This sets `DATABASE_URL`.
3. Set environment variables:
   - `AUTH_SECRET`: 32+ random characters.
   - `ADMIN_EMAILS` (optional): comma-separated emails that get admin on sign-up.
   - `RESULTS_REPO` (optional): defaults to `Dsinha97/outskiller-ai-safety-sprint`.
4. Vercel runs the migrations on every build (`vercel-build`). From your machine, with the production `DATABASE_URL` and `BASE_URL=https://<your-domain>` in the shell, run `npm run seed:build` and `npm run seed`. Open the printed bootstrap link to create the first admin account.
5. On **Members & invites**, create the team invite link and post it. The seed fills the shared Drive and Discord links from the wiki's team page. Add the WhatsApp link on the Workflow page. All of these live in the database, not in this repo.

## Scripts

| Command | What it does |
|---|---|
| `npm run seed:build` | Rebuild `content/seed.json` from the brief and the wiki |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (Neon if `DATABASE_URL` is set, else PGlite) |
| `npm run seed` | Load the seed; print a bootstrap invite if there are no users |
