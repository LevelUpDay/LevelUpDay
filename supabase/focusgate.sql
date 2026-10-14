-- 🛡 Focusgate: Windows agenti uchun jadvallar (bazada qo'llangan).
create table if not exists public.fg_config (user_id uuid primary key references auth.users(id) on delete cascade, config jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.fg_devices (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, token_hash text not null unique, agent_version text, created_at timestamptz not null default now(), last_seen timestamptz);
create index if not exists fg_devices_user on public.fg_devices(user_id);
create table if not exists public.fg_pair (code text primary key, device_name text, user_id uuid references auth.users(id) on delete cascade, token text, created_at timestamptz not null default now());
create table if not exists public.fg_usage (user_id uuid not null references auth.users(id) on delete cascade, device_id uuid not null references public.fg_devices(id) on delete cascade, day date not null, app text not null, label text, seconds int not null default 0, hours int[] not null default '{}', updated_at timestamptz not null default now(), primary key (user_id, device_id, day, app));
alter table public.fg_config enable row level security;
alter table public.fg_devices enable row level security;
alter table public.fg_pair enable row level security;   -- siyosat yo'q: faqat service_role
alter table public.fg_usage enable row level security;
create policy fgc_sel on public.fg_config for select to authenticated using (user_id = auth.uid());
create policy fgc_ins on public.fg_config for insert to authenticated with check (user_id = auth.uid());
create policy fgc_upd on public.fg_config for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fgd_sel on public.fg_devices for select to authenticated using (user_id = auth.uid());
create policy fgd_del on public.fg_devices for delete to authenticated using (user_id = auth.uid());
create policy fgu_sel on public.fg_usage for select to authenticated using (user_id = auth.uid());
grant select, insert, update on public.fg_config to authenticated;
grant select, delete on public.fg_devices to authenticated;
grant select on public.fg_usage to authenticated;
grant select, insert, update, delete on public.fg_config, public.fg_devices, public.fg_pair, public.fg_usage to service_role;
