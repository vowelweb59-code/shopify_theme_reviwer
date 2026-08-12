# Phase 0 — Scaffolding

**Depends on:** nothing (starting point)
**Goal:** A running Next.js app with the database schema in place, so every later phase has somewhere to write to and a UI shell to render into. No audit logic, no LLM calls, no Google Sheets yet — this phase is pure plumbing.

## Scope

- Next.js app (App Router), TypeScript, Node backend via API routes.
- Postgres database with `pgvector` extension enabled (Supabase recommended for zero-setup pgvector, but plain Postgres + `pgvector` extension works if self-hosted).
- No authentication — this is a single-user internal tool, don't build a login system.
- Empty page shells for the three main views so navigation exists from day one: `/audit`, `/sources`, `/reports`.

## Database schema (create as migrations, not ad-hoc SQL)

```sql
-- Knowledge base sources
create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in (
    'theme_store_requirement', 'personal_design_standard', 'seo_aeo', 'custom'
  )),
  origin text not null, -- 'upload' | 'url' | 'paste'
  origin_url text,       -- if origin = 'url'
  raw_text text,         -- full extracted text, kept for re-chunking later
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Chunked + embedded pieces of each source
create table source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  chunk_text text not null,
  heading_path text,          -- e.g. "Technical requirements > Performance"
  embedding vector(1536),      -- dimension depends on embedding model chosen
  created_at timestamptz not null default now()
);
create index on source_chunks using ivfflat (embedding vector_cosine_ops);

-- One row per theme audited (a theme may be audited multiple times over its life)
create table themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- One row per audit run
create table audit_runs (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','complete','failed')),
  sheet_url text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One row per finding within a run
create table findings (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references audit_runs(id) on delete cascade,
  file_path text not null,
  line_number int,
  category text not null check (category in ('SEO','AEO','Accessibility','Bug','Theme Store Compliance')),
  severity text not null check (severity in ('blocker','high','medium','low')),
  layer text not null check (layer in ('static','llm')),
  finding text not null,
  recommendation text,
  source_reference text,   -- which source/clause this rule traces back to
  created_at timestamptz not null default now()
);
```

## Folder structure to establish

```
/app
  /audit/page.tsx
  /sources/page.tsx
  /reports/page.tsx
  /api/audit/run/route.ts       (stub, returns 501 for now)
  /api/sources/ingest/route.ts  (stub)
  /api/reports/[id]/route.ts    (stub)
/lib
  /db/            (query helpers, migration runner)
  /theme-parser/  (empty, filled in Phase 2)
  /static-rules/  (empty, filled in Phase 3)
  /llm-reviewer/  (empty, filled in Phase 4)
  /knowledge-base/(empty, filled in Phase 1)
  /report-writer/ (empty, filled in Phase 5)
```

## Acceptance criteria

- `npm run dev` boots the app with three navigable (empty) pages.
- Migrations run cleanly against a fresh database, `pgvector` extension confirmed enabled.
- Stub API routes return a placeholder response so the routing layer is provably wired up.

## Explicitly out of scope for this phase

Anything related to parsing themes, calling Claude, or Google Sheets. If Claude Code starts building any of that here, stop it — that's Phases 1–5.
