-- Eva Birthday Quiz — Supabase Schema
-- Run this in the Supabase SQL Editor before launching the app
--
-- OBS: Om du redan kört en tidigare version av detta schema, kör bara detta i SQL-editorn:
--   alter table game_state add column if not exists reveal_step text not null default 'question';
--

-- ─── Game State ──────────────────────────────────────────────────────────────
-- Stores a single row representing the current state of the quiz
create table if not exists game_state (
  id            integer primary key default 1,
  phase         text not null default 'open',
  -- 'open'     → gäster kan svara på quizzen
  -- 'locked'   → svarsfrist stängd, avslöjning ej startad
  -- 'reveal'   → host går igenom frågorna en i taget
  -- 'finished' → avslöjning klar
  reveal_index  integer not null default 0,
  -- vilket frågaindex (0-baserat) som visas just nu
  reveal_step   text not null default 'question',
  -- 'question'    → frågan visas, gäster ser sitt eget svar
  -- 'answer'      → rätt svar avslöjas + poäng
  -- 'leaderboard' → ställningen visas
  constraint single_row check (id = 1)
);

-- Startrad
insert into game_state (id, phase, reveal_index, reveal_step)
values (1, 'open', 0, 'question')
on conflict (id) do nothing;

-- ─── Players ─────────────────────────────────────────────────────────────────
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ─── Answers ─────────────────────────────────────────────────────────────────
create table if not exists answers (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  question_id  integer not null,
  answer       text not null,
  is_correct   boolean,
  -- null until the host grades/reveals that question
  points       integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (player_id, question_id)
);

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime on game_state so all clients react instantly when host advances
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table answers;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- For a one-week party app, the simplest approach is to allow all reads/writes
-- via the anon key. The host password is handled in the app, not at DB level.

alter table game_state enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

create policy "Public read game_state"  on game_state for select using (true);
create policy "Public update game_state" on game_state for update using (true);

create policy "Public read players"  on players for select using (true);
create policy "Public insert players" on players for insert with check (true);

create policy "Public read answers"   on answers for select using (true);
create policy "Public insert answers" on answers for insert with check (true);
create policy "Public update answers" on answers for update using (true);

-- ─── Photos ──────────────────────────────────────────────────────────────────
create table if not exists photos (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references players(id) on delete cascade,
  player_name text not null,
  public_url  text not null,
  storage_path text not null,
  created_at  timestamptz not null default now()
);

alter publication supabase_realtime add table photos;

alter table photos enable row level security;
create policy "Public read photos"   on photos for select using (true);
create policy "Public insert photos" on photos for insert with check (true);
create policy "Public delete photos" on photos for delete using (true);
