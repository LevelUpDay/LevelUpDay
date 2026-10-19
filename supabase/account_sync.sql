-- ☁️ Sinxronlash va akkaunt markazi (account.js). Supabase'da migratsiya sifatida qo'llangan:
--   account_sync_center, coin_restore_bypass_rate_limit. Bu fayl — ma'lumot uchun nusxa.
--  • coin_ledger   — tanga/XP/olmosdagi har bir o'zgarish (profiles AFTER UPDATE trigger), restore_lost_coins()
--  • app_backups   — kunlik bulut zaxirasi, 30 ta slot (slot = kun raqami % 30)
--  • account_devices — kirilgan qurilmalar, uzoqdan chiqarish (signed_out_at), yangi qurilma Telegram xabari (notified)
-- Akkaunt o'chirilganda bu jadvallar ham tozalanadi: supabase/fix_delete_account.sql.

create table if not exists public.coin_ledger (
  id bigserial primary key,
  user_id uuid not null,
  at timestamptz not null default now(),
  d_coins int not null default 0, d_xp int not null default 0, d_gems int not null default 0,
  coins int, xp int, gems int,
  reason text, device text,
  restored_at timestamptz
);
create index if not exists coin_ledger_user_at on public.coin_ledger(user_id, at desc);
alter table public.coin_ledger enable row level security;
create policy coin_ledger_sel on public.coin_ledger for select to authenticated using (user_id = auth.uid());
grant select on public.coin_ledger to authenticated;
-- Sayt har bir yozishda oxirgi sababni (S.tarix[0].desc) yuboradi — jurnalda ko'rinadi
alter table public.profiles add column if not exists last_reason text;

create or replace function public._profiles_ledger() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.coins,0) is distinct from coalesce(old.coins,0) or coalesce(new.xp,0) is distinct from coalesce(old.xp,0)
     or coalesce(new.gems,0) is distinct from coalesce(old.gems,0) then
    insert into coin_ledger(user_id, d_coins, d_xp, d_gems, coins, xp, gems, reason, device)
    values (new.id, coalesce(new.coins,0) - coalesce(old.coins,0), coalesce(new.xp,0) - coalesce(old.xp,0), coalesce(new.gems,0) - coalesce(old.gems,0),
            new.coins, new.xp, new.gems, left(new.last_reason, 120), left(new.device_type, 20));
  end if;
  return new;
end; $$;
create trigger trg_profiles_ledger after update on public.profiles for each row execute function public._profiles_ledger();

-- Xato bilan yo'qolgan tangani qaytarish: tanga VA XP birga keskin tushgan yozuv, 30 kun ichida, bir marta.
-- app.coin_restore — _profiles_rate_limit shu tranzaksiyada byudjetni tekshirmaydi (faqat qaytarilayotgan miqdor).
create or replace function public.restore_lost_coins(p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare r coin_ledger; p profiles;
begin
  select * into r from coin_ledger where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if r.restored_at is not null then raise exception 'already_restored'; end if;
  if r.at < now() - interval '30 days' then raise exception 'too_old'; end if;
  if not (r.d_coins < 0 and r.d_xp < 0 and (coalesce(r.xp,0) = 0 or -r.d_xp * 2 >= coalesce(r.xp,0) - r.d_xp)) then raise exception 'not_a_loss'; end if;
  perform set_config('app.coin_restore', '1', true);
  update coin_ledger set restored_at = now() where id = r.id;
  update profiles set coins = coalesce(coins,0) - r.d_coins, xp = coalesce(xp,0) - r.d_xp,
         gems = coalesce(gems,0) - least(0, r.d_gems), last_reason = 'restore #' || r.id
   where id = auth.uid() returning * into p;
  perform set_config('app.coin_restore', '0', true);
  return jsonb_build_object('coins', p.coins, 'xp', p.xp, 'gems', p.gems, 'total_coins', p.total_coins);
end; $$;
revoke all on function public.restore_lost_coins(bigint) from public, anon;
grant execute on function public.restore_lost_coins(bigint) to authenticated;
-- _profiles_rate_limit() boshiga qo'shilgan:
--   if tg_op = 'UPDATE' and current_setting('app.coin_restore', true) = '1' then
--     new.level := case ... end; return new;
--   end if;

create table if not exists public.app_backups (
  user_id uuid not null,
  slot smallint not null check (slot between 0 and 29),
  day date not null,
  data jsonb not null,
  tasks jsonb not null default '[]'::jsonb,
  info jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.app_backups enable row level security;
create policy app_backups_sel on public.app_backups for select to authenticated using (user_id = auth.uid());
create policy app_backups_ins on public.app_backups for insert to authenticated with check (user_id = auth.uid());
create policy app_backups_upd on public.app_backups for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.app_backups to authenticated;

create table if not exists public.account_devices (
  id uuid primary key,
  user_id uuid not null,
  name text, kind text, ua text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  signed_out_at timestamptz,
  notified boolean not null default false
);
create index if not exists account_devices_user on public.account_devices(user_id, last_seen desc);
alter table public.account_devices enable row level security;
create policy account_devices_sel on public.account_devices for select to authenticated using (user_id = auth.uid());
create policy account_devices_ins on public.account_devices for insert to authenticated with check (user_id = auth.uid());
create policy account_devices_upd on public.account_devices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.account_devices to authenticated;
