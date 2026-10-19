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

-- ===== v0.3: hodisalar (Telegram), fokus sessiyalari, dunyo/do'stlar statistikasi =====
alter table public.fg_devices add column if not exists apps jsonb;
alter table public.fg_devices add column if not exists apps_at timestamptz;
create table if not exists public.fg_events (id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade, device_id uuid references public.fg_devices(id) on delete cascade, kind text not null, app text not null, label text, reason text, at timestamptz not null default now(), notified boolean not null default false);
create index if not exists fg_events_user_at on public.fg_events(user_id, at desc);
alter table public.fg_events enable row level security;
create policy fge_sel on public.fg_events for select to authenticated using (user_id = auth.uid());
create table if not exists public.fg_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(), started_at timestamptz not null default now(), planned_min int not null check (planned_min between 1 and 600), ended_at timestamptz, joined_from uuid);
alter table public.fg_sessions enable row level security;
-- siyosatlar: fgs_sel / fgs_ins (started_at ≈ now()) / fgs_upd; trigger _fg_sessions_guard: faqat ended_at o'zgaradi
-- RPC: fg_world_stats(p_days) — anonim (≥3 foydalanuvchi), fg_friends_board(p_days) — config.share=false bo'lsa ko'rinmaydi, fg_friends_focus()
-- To'liq matn bazada qo'llangan (security definer, search_path=public).

-- ===== v0.6: ochilishlar soni + sayt bo'limlari (migratsiya: fg_usage_opens_and_sections) =====
alter table public.fg_usage add column if not exists opens int not null default 0;          -- necha marta ochilgan
alter table public.fg_usage add column if not exists open_hours int[] not null default '{}'; -- ochilishlar soatlar bo'yicha
-- "site:youtube#shorts" kabi bo'lim qatorlari (kengaytma) — fg_world_stats / fg_friends_board / fg_weekly_summary
-- ularni umumiy ekran vaqtiga qo'shmaydi: position('#' in app) = 0.

-- ===== v0.6.1: statistikani tozalash (Profil → Reset → Focusgate) =====
-- functions/focusgate {action:'reset_stats'} + foydalanuvchi JWT: fg_usage, fg_events, fg_sessions dan faqat o'z qatorlarini
-- o'chiradi va fg_config.config.statsResetAt = ms qo'yadi. Agent (0.6.1+) va kengaytma (0.6.1+) sync'da reset_seen yuboradi;
-- reset_seen < statsResetAt bo'lsa server eski hisobni yozmaydi, qurilma esa mahalliy hisobini nolga tushiradi.
-- Agent nomi "Windows · KOMPYUTER · foydalanuvchi" — bitta kompyuterdagi har bir Windows foydalanuvchisi alohida qurilma.
