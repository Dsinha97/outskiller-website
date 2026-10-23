import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // admin | member
  city: text("city").notNull().default(""),
  tz: text("tz").notNull().default("UTC"),
  inviteId: integer("invite_id"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull().default("Team invite"),
  createdBy: uuid("created_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUses: integer("max_uses").notNull().default(10),
  uses: integer("uses").notNull().default(0),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
});

/**
 * Every piece of living content: talks, angles, workflow phases, logistics links,
 * team cards, notes, and the wiki-sourced library pages. `origin` says where it came
 * from; wiki items are read-only in the app and only the importer rewrites them.
 */
export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("active"), // active | archived | team_project
    origin: text("origin").notNull().default("app"), // brief | wiki | app
    sha: text("sha"),
    sort: integer("sort").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("items_kind_slug").on(t.kind, t.slug), index("items_kind").on(t.kind)],
);

export const itemVersions = pgTable("item_versions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").$type<{ title: string; body: string; data: Record<string, unknown> }>().notNull(),
  note: text("note").notNull().default(""),
  by: uuid("by"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id"), // null = proposes a new item of `kind`
  kind: text("kind").notNull(),
  type: text("type").notNull().default("edit"), // edit | new | flag
  proposed: jsonb("proposed").$type<{ title?: string; body?: string; data?: Record<string, unknown> }>().notNull(),
  note: text("note").notNull().default(""),
  authorId: uuid("author_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  reviewerId: uuid("reviewer_id"),
  reply: text("reply").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("plan"), // plan | idea
  status: text("status").notNull().default("open"), // open | closed | decided
  winnerOptionId: integer("winner_option_id"),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pollOptions = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  label: text("label").notNull(),
  angles: jsonb("angles").$type<string[]>().notNull().default([]),
  sort: integer("sort").notNull().default(0),
});

/** A person's view on an angle (`angle:E`) or a poll option (`option:12`). */
export const stances = pgTable(
  "stances",
  {
    target: text("target").notNull(),
    userId: uuid("user_id").notNull(),
    stance: text("stance").notNull(), // first | interested | not
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.target, t.userId] })],
);

export const roleCells = pgTable(
  "role_cells",
  {
    pkg: text("pkg").notNull(),
    person: text("person").notNull(),
    value: text("value").notNull(), // L | S | -
  },
  (t) => [primaryKey({ columns: [t.pkg, t.person] })],
);

export const decisions = pgTable("decisions", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  value: text("value"),
  by: uuid("by"),
  at: timestamp("at", { withTimezone: true }),
  sort: integer("sort").notNull().default(0),
});

export const checklist = pgTable("checklist", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  ownerId: uuid("owner_id"),
  done: boolean("done").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const rateHits = pgTable(
  "rate_hits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
