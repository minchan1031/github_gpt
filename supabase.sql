-- D-100 입시 생존기: rankings table and Row Level Security
-- Run in the connected Supabase project before deploying the static client.

create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 20),
  final_score integer not null check (final_score between 0 and 2500),
  grade text not null check (grade in ('S급: 서울대', 'A급: 인서울', 'F급: 재수학원')),
  play_date date not null default (timezone('Asia/Seoul', now())::date),
  created_at timestamptz not null default now(),
  constraint rankings_grade_matches_score check (
    (final_score >= 2500 and grade = 'S급: 서울대')
    or (final_score >= 1500 and final_score < 2500 and grade = 'A급: 인서울')
    or (final_score < 1500 and grade = 'F급: 재수학원')
  )
);

create index if not exists rankings_score_created_idx
  on public.rankings (final_score desc, created_at asc);

create index if not exists rankings_user_id_idx
  on public.rankings (user_id);

alter table public.rankings enable row level security;

drop policy if exists "rankings are publicly readable" on public.rankings;
create policy "rankings are publicly readable"
  on public.rankings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "authenticated users insert own ranking" on public.rankings;
create policy "authenticated users insert own ranking"
  on public.rankings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- The browser only needs public reads and authenticated inserts.
-- UPDATE and DELETE remain unavailable.
revoke all on table public.rankings from anon, authenticated;
grant select (nickname, final_score, grade, play_date, created_at)
  on table public.rankings to anon, authenticated;
grant insert (user_id, nickname, final_score, grade)
  on table public.rankings to authenticated;

