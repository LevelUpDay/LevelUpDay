-- ✈️ Telegram v2: botdagi amallar navbati, "keyinroq eslat", sozlanadigan vaqtlar
create table if not exists public.tg_actions (
  id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('done','add','snooze')), task_id bigint, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), applied_at timestamptz);
create index if not exists tg_actions_user_pending on public.tg_actions(user_id) where applied_at is null;
alter table public.tg_actions enable row level security;
create policy tga_sel on public.tg_actions for select using (user_id = auth.uid());
create policy tga_upd on public.tg_actions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.telegram_links add column if not exists times jsonb not null default '{}'::jsonb;
create table if not exists public.tg_snooze (user_id uuid not null, task_id bigint not null, fire_at timestamptz not null, sent_at timestamptz, primary key (user_id, task_id));
alter table public.tg_snooze enable row level security;
