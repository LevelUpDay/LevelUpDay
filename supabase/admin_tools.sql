-- 👑 Admin paneli v2 (admin.js) va hamma uchun ishlaydigan qism (ops.js).
-- Supabase'da migratsiyalar sifatida qo'llangan: admin_tools_a (jadvallar, rollar, himoya),
-- admin_tools_b (foydalanuvchi RPC'lari), admin_tools_c (admin RPC'lari), admin_tools_d (analitika va tizim).
-- Bu fayl — ma'lumot uchun nusxa. Hech narsa butunlay o'chirilmaydi: yashirish/bekor qilish ustunlari ishlatiladi.
--
-- Rollar (admin_emails.role): helper = 1 (ko'rish, fikrlar, xabar, nik/post moderatsiyasi),
-- admin = 2 (tanga, ban, sozlamalar, e'lon, promo), owner = 3 (jamoani boshqarish).
-- admin_emails.revoked_at — rol olib tashlangan (qatorni o'chirmasdan).

-- ============================== A) JADVALLAR, ROLLAR, HIMOYA ==============================
alter table public.admin_emails add column if not exists revoked_at timestamptz;
alter table public.admin_emails add column if not exists added_at timestamptz default now();

create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path to 'public', 'auth' as $$
  select exists (select 1 from auth.users u join public.admin_emails e on e.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null and e.revoked_at is null);
$$;
create or replace function public.get_staff_roles() returns table(user_id uuid, role text)
language sql stable security definer set search_path to 'public', 'auth' as $$
  select u.id, e.role from auth.users u join public.admin_emails e on e.email = lower(u.email)
  where u.email_confirmed_at is not null and e.revoked_at is null;
$$;
create or replace function public._is_staff_user(p_uid uuid) returns boolean
language sql stable security definer set search_path to 'public', 'auth' as $$
  select exists (select 1 from auth.users u join public.admin_emails e on e.email = lower(u.email) where u.id = p_uid and e.revoked_at is null);
$$;
create or replace function public._admin_level() returns int
language sql stable security definer set search_path to 'public', 'auth' as $$
  select coalesce(max(case e.role when 'owner' then 3 when 'admin' then 2 when 'helper' then 1 else 0 end), 0)
  from auth.users u join public.admin_emails e on e.email = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null and e.revoked_at is null;
$$;
create or replace function public._admin_need(p_level int) returns void
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if public._admin_level() < p_level then raise exception 'forbidden' using errcode = '42501'; end if;
end; $$;

-- 📜 Admin amallari jurnali
create table if not exists public.admin_audit (
  id bigserial primary key, admin_id uuid, admin_email text,
  action text not null, target uuid, details jsonb, at timestamptz not null default now()
);
create index if not exists admin_audit_at on public.admin_audit(at desc);
alter table public.admin_audit enable row level security;
create or replace function public._audit(p_action text, p_target uuid, p_details jsonb) returns void
language sql security definer set search_path to 'public', 'auth' as $$
  insert into public.admin_audit(admin_id, admin_email, action, target, details)
  select auth.uid(), (select lower(email) from auth.users where id = auth.uid()), p_action, p_target, p_details;
$$;
revoke all on function public._audit(text, uuid, jsonb) from public, anon, authenticated;

-- 🚫 Ban va admin holati (faqat server funksiyalari o'qiydi/yozadi)
alter table public.profiles add column if not exists banned_until timestamptz;
create table if not exists public.user_admin_state (
  user_id uuid primary key,
  ban_reason text, banned_at timestamptz, banned_by uuid,
  force_name text, force_reason text, force_at timestamptz,
  restore_slot smallint, restore_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_admin_state enable row level security;

-- Foydalanuvchi banned_until ni o'zi o'zgartira olmaydi; ban vaqtida tanga/XP/nik muzlatiladi.
-- app.admin_op — faqat admin funksiyalari tranzaksiya ichida qo'yadi.
create or replace function public._profiles_admin_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if current_setting('app.admin_op', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then new.banned_until := null; return new; end if;
  new.banned_until := old.banned_until;
  if old.banned_until is not null and old.banned_until > now() then
    new.coins := old.coins; new.xp := old.xp; new.gems := old.gems; new.level := old.level;
    new.total_coins := old.total_coins; new.season_coins := old.season_coins;
    new.streak := old.streak; new.best_streak := old.best_streak; new.tasks_completed := old.tasks_completed;
    new.name := old.name; new.photo := old.photo;
  end if;
  return new;
end; $$;
create trigger trg_profiles_admin_guard before insert or update on public.profiles
  for each row execute function public._profiles_admin_guard();

-- ⚙️ Ilova sozlamalari: flags, maintenance, season, banned_words (oxirgisi — faqat server)
create table if not exists public.app_config (
  key text primary key, value jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid
);
alter table public.app_config enable row level security;
create policy app_config_read on public.app_config for select to anon, authenticated using (key <> 'banned_words');
grant select on public.app_config to anon, authenticated;
insert into public.app_config(key, value) values
  ('flags', '{}'::jsonb), ('maintenance', '{"on": false}'::jsonb), ('season', '{}'::jsonb), ('banned_words', '[]'::jsonb)
on conflict (key) do nothing;

-- 🤬 Taqiqlangan so'zlar
create or replace function public._norm_word(p text) returns text
language sql immutable as $$
  select translate(lower(regexp_replace(coalesce(p, ''), '[^[:alnum:]]', '', 'g')), '013457@$', 'oleastas');
$$;
create or replace function public._has_banned_word(p text) returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
declare w text; n text := public._norm_word(p);
begin
  if n = '' then return false; end if;
  for w in select public._norm_word(x) from app_config c, jsonb_array_elements_text(c.value) x where c.key = 'banned_words' loop
    if length(w) >= 2 and position(w in n) > 0 then return true; end if;
  end loop;
  return false;
end; $$;
create or replace function public._mask_banned(p text) returns text
language plpgsql stable security definer set search_path to 'public' as $$
declare w text; r text := p;
begin
  if p is null then return p; end if;
  for w in select x from app_config c, jsonb_array_elements_text(c.value) x where c.key = 'banned_words' loop
    if length(w) >= 2 then r := regexp_replace(r, regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '***', 'gi'); end if;
  end loop;
  return r;
end; $$;

create or replace function public._profiles_name_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if current_setting('app.admin_op', true) = '1' then return new; end if;
  if new.name is distinct from old.name then
    if new.name is null or char_length(btrim(new.name)) < 3 or char_length(btrim(new.name)) > 20 then
      raise exception 'name_invalid' using errcode = 'P0001';
    end if;
    if lower(btrim(new.name)) <> lower(btrim(coalesce(old.name, ''))) then
      if old.name_changed_at is not null and old.name_changed_at > now() - interval '7 days' then
        raise exception 'name_change_cooldown' using errcode = 'P0001',
          detail = to_char(old.name_changed_at + interval '7 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
      end if;
      new.name_changed_at := now();
    end if;
  end if;
  return new;
end; $$;
create or replace function public._profiles_reserved_name() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare n text;
begin
  if current_setting('app.admin_op', true) = '1' then return new; end if;
  if new.name is null then return new; end if;
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then return new; end if;
  n := lower(regexp_replace(new.name, '[^[:alnum:]]', '', 'g'));
  n := translate(n, '013457@$', 'oleastas');
  if n ~ '(owner|admin|adm1n|helper|moderator|modera|support|staff|official|levelupday|админ|модер|хелпер|владелец)' then
    if not public._is_staff_user(new.id) then
      raise exception 'name_reserved' using errcode = 'P0001';
    end if;
  end if;
  if public._has_banned_word(new.name) then raise exception 'name_banned' using errcode = 'P0001'; end if;
  return new;
end; $$;

-- 📰 Lenta: yashirish (hidden_at) va so'z filtri
alter table public.activity_feed add column if not exists hidden_at timestamptz;
alter table public.activity_feed add column if not exists hidden_by uuid;
create or replace function public.get_friend_feed(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_me uuid := auth.uid(); v_ids uuid[];
begin
  if v_me is null then return '[]'::jsonb; end if;
  v_ids := array_append(_my_friend_ids(), v_me);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id, a.user_id, a.kind, a.text, a.emoji, a.created_at, (a.user_id = v_me) as is_me, p.name, p.photo,
        coalesce((select jsonb_object_agg(r.emoji, r.c) from (select emoji, count(*) c from feed_reactions where feed_id = a.id and active group by emoji) r), '{}'::jsonb) as reactions,
        coalesce((select jsonb_agg(emoji) from feed_reactions where feed_id = a.id and user_id = v_me and active), '[]'::jsonb) as my_reactions
      from activity_feed a left join profiles p on p.id = a.user_id
      where a.user_id = any(v_ids) and a.created_at > now() - interval '30 days' and a.hidden_at is null
        and (p.banned_until is null or p.banned_until < now())
      order by a.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) x), '[]'::jsonb);
end; $$;
create or replace function public.post_activity(p_kind text, p_text text, p_emoji text default '✅') returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned_until > now()) then return null; end if;
  select count(*) into v_cnt from activity_feed where user_id = auth.uid() and created_at > now() - interval '1 day';
  if v_cnt >= 40 then return null; end if;
  insert into activity_feed (user_id, kind, text, emoji)
  values (auth.uid(), left(coalesce(p_kind, 'misc'), 30), left(public._mask_banned(coalesce(p_text, '')), 200), left(coalesce(nullif(p_emoji, ''), '✅'), 8))
  returning id into v_id;
  return v_id;
end; $$;

-- 🛡 Klan: taqiqlangan so'z tekshiruvi
create or replace function public.create_clan(p_name text, p_tag text, p_emoji text, p_desc text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); v_id uuid; v_lvl int; v_tag text := upper(btrim(coalesce(p_tag, '')));
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if exists (select 1 from clan_members where user_id = me and left_at is null) then return jsonb_build_object('ok', false, 'error', 'already_in_clan'); end if;
  select coalesce(level, 1) into v_lvl from profiles where id = me;
  if coalesce(v_lvl, 1) < 2 then return jsonb_build_object('ok', false, 'error', 'level_too_low'); end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 24 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  if v_tag !~ '^[A-Z0-9]{2,5}$' then return jsonb_build_object('ok', false, 'error', 'bad_tag'); end if;
  if public._has_banned_word(p_name) or public._has_banned_word(v_tag) or public._has_banned_word(p_desc) then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  if exists (select 1 from clans where disbanded_at is null and (lower(btrim(name)) = lower(btrim(p_name)) or tag = v_tag)) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  insert into clans (name, tag, emoji, description, leader_id)
  values (btrim(p_name), v_tag, left(coalesce(nullif(btrim(p_emoji), ''), '🛡'), 8), left(btrim(coalesce(p_desc, '')), 140), me)
  returning id into v_id;
  insert into clan_members (clan_id, user_id, role) values (v_id, me, 'leader');
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;

-- 📣 E'lonlar (banner / oyna / changelog)
create table if not exists public.announcements (
  id bigserial primary key,
  kind text not null default 'banner' check (kind in ('banner', 'modal', 'changelog')),
  title text, body text not null, version text,
  lang text, country text, min_level int, max_level int, audience text not null default 'all' check (audience in ('all', 'guests', 'users')),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  active boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

-- ✉️ Shaxsiy xabarlar (admin → foydalanuvchi)
create table if not exists public.user_messages (
  id bigserial primary key, user_id uuid not null,
  title text, body text not null, kind text not null default 'admin',
  from_admin uuid, created_at timestamptz not null default now(), seen_at timestamptz
);
create index if not exists user_messages_user on public.user_messages(user_id, created_at desc);
alter table public.user_messages enable row level security;
create policy user_messages_own on public.user_messages for select to authenticated using (user_id = auth.uid());
grant select on public.user_messages to authenticated;

-- 🎁 Promo-kodlar
create table if not exists public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,32}$'),
  coins int not null default 0, gems int not null default 0, xp int not null default 0,
  max_uses int, uses int not null default 0, expires_at timestamptz, active boolean not null default true,
  note text, created_by uuid, created_at timestamptz not null default now()
);
create table if not exists public.promo_redemptions (
  code text not null, user_id uuid not null, at timestamptz not null default now(), primary key (code, user_id)
);
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- 🐞 Mijoz xatolari (bir xil xato bir kunda bitta qator, count oshadi)
create table if not exists public.client_errors (
  id bigserial primary key, sig text not null, day date not null default current_date,
  msg text, src text, line int, stack text, version text, url text, ua text,
  user_id uuid, users uuid[] not null default '{}', count int not null default 1,
  first_at timestamptz not null default now(), last_at timestamptz not null default now(), resolved_at timestamptz,
  unique (sig, day)
);
alter table public.client_errors enable row level security;

-- 📣 Ommaviy xabarlar jurnali (edge funksiya yozadi)
create table if not exists public.admin_broadcasts (
  id bigserial primary key, admin_id uuid, title text, body text, filters jsonb, channels text[],
  targets int, sent_push int, sent_tg int, sent_inapp int, at timestamptz not null default now()
);
alter table public.admin_broadcasts enable row level security;

-- 🔄 Sinxron holati (account.js har ping'da yozadi)
alter table public.account_devices add column if not exists app_version text;
alter table public.account_devices add column if not exists sync_pending int;
alter table public.account_devices add column if not exists sync_err text;
alter table public.account_devices add column if not exists sync_at timestamptz;

-- ============================== B) FOYDALANUVCHI RPC'LARI (ops.js) ==============================
alter table public.user_admin_state add column if not exists force_photo boolean not null default false;
alter table public.user_messages add column if not exists data jsonb;

-- Mening holatim: ban, majburiy nik, tiklash so'rovi, o'qilmagan xabarlar
create or replace function public.get_my_status() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s user_admin_state; v_until timestamptz;
begin
  if me is null then return '{}'::jsonb; end if;
  select * into s from user_admin_state where user_id = me;
  select banned_until into v_until from profiles where id = me;
  return jsonb_build_object(
    'banned', case when v_until > now() then jsonb_build_object('until', case when v_until = 'infinity' then null else v_until end, 'reason', s.ban_reason) end,
    'force', case when s.force_name is not null then jsonb_build_object('name', s.force_name, 'reason', s.force_reason, 'photo', s.force_photo) end,
    'restore_slot', s.restore_slot,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'kind', m.kind, 'data', m.data, 'at', m.created_at) order by m.created_at)
                          from user_messages m where m.user_id = me and m.seen_at is null), '[]'::jsonb),
    'staff', public._admin_level()
  );
end; $$;
create or replace function public.ack_my_status(p_what text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return; end if;
  if p_what = 'force' then update user_admin_state set force_name = null, force_reason = null, force_photo = false, updated_at = now() where user_id = auth.uid();
  elsif p_what = 'restore' then update user_admin_state set restore_slot = null, restore_at = null, updated_at = now() where user_id = auth.uid();
  end if;
end; $$;
create or replace function public.mark_messages_seen(p_ids bigint[]) returns void
language sql security definer set search_path to 'public' as $$
  update user_messages set seen_at = now() where user_id = auth.uid() and id = any(p_ids) and seen_at is null;
$$;

-- E'lonlar (mehmonlar ham oladi)
create or replace function public.get_announcements(p_lang text, p_country text, p_level int, p_user boolean) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'title', a.title, 'body', a.body, 'version', a.version, 'at', a.starts_at) order by a.starts_at desc), '[]'::jsonb)
  from (select * from announcements a
        where a.active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
          and (a.lang is null or a.lang = p_lang) and (a.country is null or a.country = p_country)
          and (a.min_level is null or coalesce(p_level, 1) >= a.min_level) and (a.max_level is null or coalesce(p_level, 1) <= a.max_level)
          and (a.audience = 'all' or a.audience = case when p_user then 'users' else 'guests' end)
        order by a.starts_at desc limit 20) a;
$$;
grant execute on function public.get_announcements(text, text, int, boolean) to anon, authenticated;

-- 🎁 Promo-kodni ishlatish
create or replace function public.redeem_promo(p_code text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); c promo_codes; p profiles; n int;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into c from promo_codes where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or not c.active then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'error', 'used_up'); end if;
  if exists (select 1 from profiles where id = me and banned_until > now()) then return jsonb_build_object('ok', false, 'error', 'banned'); end if;
  insert into promo_redemptions(code, user_id) values (c.code, me) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  update promo_codes set uses = uses + 1 where code = c.code;
  perform set_config('app.coin_restore', '1', true);
  update profiles set coins = coalesce(coins, 0) + c.coins, total_coins = coalesce(total_coins, 0) + greatest(0, c.coins),
         gems = coalesce(gems, 0) + c.gems, xp = coalesce(xp, 0) + c.xp, last_reason = '🎁 promo ' || c.code
   where id = me returning * into p;
  perform set_config('app.coin_restore', '0', true);
  return jsonb_build_object('ok', true, 'coins', c.coins, 'gems', c.gems, 'xp', c.xp,
    'profile', jsonb_build_object('coins', p.coins, 'total_coins', p.total_coins, 'xp', p.xp, 'gems', p.gems, 'level', p.level));
end; $$;

-- 🐞 Mijoz xatosini yozish (mehmonlar ham; kuniga ko'pi bilan 3000 xil xato)
create or replace function public.log_client_error(p jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); v_sig text; v_line int;
begin
  if p is null or coalesce(p->>'msg', '') = '' then return; end if;
  v_line := case when coalesce(p->>'line', '') ~ '^\d{1,9}$' then (p->>'line')::int end;
  v_sig := md5(left(p->>'msg', 300) || '|' || coalesce(regexp_replace(p->>'src', '\?.*$', ''), '') || '|' || coalesce(v_line::text, ''));
  if not exists (select 1 from client_errors where sig = v_sig and day = current_date)
     and (select count(*) from client_errors where day = current_date) >= 3000 then return; end if;
  insert into client_errors(sig, msg, src, line, stack, version, url, ua, user_id, users)
  values (v_sig, left(p->>'msg', 500), left(p->>'src', 300), v_line, left(p->>'stack', 3000), left(p->>'version', 20),
          left(p->>'url', 300), left(p->>'ua', 200), me, case when me is null then '{}'::uuid[] else array[me] end)
  on conflict (sig, day) do update set count = client_errors.count + 1, last_at = now(),
    version = coalesce(excluded.version, client_errors.version),
    users = case when me is null or me = any(client_errors.users) or cardinality(client_errors.users) >= 50 then client_errors.users else client_errors.users || me end;
end; $$;
grant execute on function public.log_client_error(jsonb) to anon, authenticated;

-- ============================== C) ADMIN RPC LARI ==============================
create or replace function public.admin_whoami() returns jsonb
language sql stable security definer set search_path to 'public', 'auth' as $$
  select jsonb_build_object('level', public._admin_level(), 'email', (select lower(email) from auth.users where id = auth.uid()), 'id', auth.uid());
$$;

-- 👤 Foydalanuvchilarni qidirish (p_f: country, provider, lang, device, level_min, level_max, active, banned, tg)
create or replace function public.admin_search_users(p_q text, p_f jsonb default '{}'::jsonb, p_sort text default 'active', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'auth' as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_f jsonb := coalesce(p_f, '{}'::jsonb);
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 5000); v_off int := greatest(coalesce(p_offset, 0), 0); r jsonb;
begin
  perform public._admin_need(1);
  with base as (
    select p.id, p.name, p.photo, p.country, p.language, p.level, p.xp, p.coins, p.gems, p.streak, p.best_streak, p.tasks_completed,
      p.created_at, p.last_active_at, p.banned_until, p.device_type, p.referral_source, p.friend_code,
      u.email, public._auth_provider(u.raw_app_meta_data, u.raw_user_meta_data, u.email) as provider, u.last_sign_in_at,
      tl.username as tg_username, coalesce(tl.enabled, false) as tg_on
    from profiles p left join auth.users u on u.id = p.id left join telegram_links tl on tl.user_id = p.id
    where (v_q is null or p.name ilike '%' || v_q || '%' or u.email ilike '%' || v_q || '%' or p.friend_code ilike v_q
           or p.id::text = v_q or tl.username ilike '%' || ltrim(v_q, '@') || '%')
      and (v_f->>'country' is null or p.country = v_f->>'country')
      and (v_f->>'lang' is null or p.language = v_f->>'lang')
      and (v_f->>'device' is null or p.device_type = v_f->>'device')
      and (v_f->>'provider' is null or public._auth_provider(u.raw_app_meta_data, u.raw_user_meta_data, u.email) = v_f->>'provider')
      and (coalesce(v_f->>'level_min', '') !~ '^\d+$' or coalesce(p.level, 1) >= (v_f->>'level_min')::int)
      and (coalesce(v_f->>'level_max', '') !~ '^\d+$' or coalesce(p.level, 1) <= (v_f->>'level_max')::int)
      and (coalesce(v_f->>'active', '') = ''
           or (v_f->>'active' = 'online' and p.last_active_at > now() - interval '5 minutes')
           or (v_f->>'active' = 'today' and p.last_active_at >= current_date)
           or (v_f->>'active' = '7d' and p.last_active_at > now() - interval '7 days')
           or (v_f->>'active' = '30d' and p.last_active_at > now() - interval '30 days')
           or (v_f->>'active' = 'inactive14' and p.last_active_at < now() - interval '14 days')
           or (v_f->>'active' = 'never' and p.last_active_at is null))
      and (coalesce(v_f->>'banned', '') <> 'true' or p.banned_until > now())
      and (coalesce(v_f->>'tg', '') <> 'true' or tl.enabled)
  )
  select jsonb_build_object('total', (select count(*) from base), 'rows', coalesce((
    select jsonb_agg(to_jsonb(b)) from (
      select * from base order by
        case when p_sort = 'xp' then xp end desc nulls last,
        case when p_sort = 'coins' then coins end desc nulls last,
        case when p_sort = 'streak' then streak end desc nulls last,
        case when p_sort = 'new' then created_at end desc nulls last,
        case when p_sort = 'name' then lower(name) end asc nulls last,
        last_active_at desc nulls last
      limit v_lim offset v_off) b), '[]'::jsonb)) into r;
  return r;
end; $$;

-- 🗂 Foydalanuvchi kartochkasi (ko'rish ham jurnalga yoziladi)
create or replace function public.admin_user_card(p_uid uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'auth' as $$
declare r jsonb;
begin
  perform public._admin_need(1);
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'cosmetics' from profiles p where p.id = p_uid),
    'auth', (select jsonb_build_object('email', u.email, 'provider', public._auth_provider(u.raw_app_meta_data, u.raw_user_meta_data, u.email),
               'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'confirmed', u.email_confirmed_at is not null) from auth.users u where u.id = p_uid),
    'state', (select to_jsonb(s) from user_admin_state s where s.user_id = p_uid),
    'staff_role', (select e.role from auth.users u join admin_emails e on e.email = lower(u.email) where u.id = p_uid and e.revoked_at is null),
    'devices', (select jsonb_agg(to_jsonb(d) - 'ua' - 'user_id' order by d.last_seen desc) from account_devices d where d.user_id = p_uid),
    'fg_devices', (select jsonb_agg(jsonb_build_object('name', f.name, 'version', f.agent_version, 'last_seen', f.last_seen) order by f.last_seen desc nulls last) from fg_devices f where f.user_id = p_uid),
    'friends', (select count(*) from friendships where user_id = p_uid),
    'clan', (select jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'role', m.role) from clan_members m join clans c on c.id = m.clan_id where m.user_id = p_uid and m.left_at is null limit 1),
    'ledger', (select jsonb_agg(to_jsonb(l) - 'user_id' order by l.id desc) from (select * from coin_ledger where user_id = p_uid order by id desc limit 60) l),
    'backups', (select jsonb_agg(jsonb_build_object('slot', b.slot, 'day', b.day, 'info', b.info, 'created_at', b.created_at) order by b.day desc) from app_backups b where b.user_id = p_uid),
    'telegram', (select jsonb_build_object('username', t.username, 'enabled', t.enabled, 'lang', t.lang, 'linked_at', t.linked_at) from telegram_links t where t.user_id = p_uid),
    'push', (select count(*) from push_subscriptions where user_id = p_uid),
    'active_days_30', (select count(*) from user_activity_days where user_id = p_uid and day > current_date - 30),
    'tasks', (select count(*) from todos where user_id = p_uid),
    'feedback', (select count(*) from feedback where user_id = p_uid),
    'errors_30d', (select coalesce(sum(count), 0) from client_errors where p_uid = any(users) and day > current_date - 30),
    'referred_by', (select jsonb_build_object('id', r.referrer, 'name', p.name) from referrals r left join profiles p on p.id = r.referrer where r.referee = p_uid limit 1),
    'referrals', (select count(*) from referrals where referrer = p_uid),
    'messages', (select jsonb_agg(to_jsonb(m) - 'user_id' order by m.id desc) from (select * from user_messages where user_id = p_uid order by id desc limit 20) m),
    'audit', (select jsonb_agg(jsonb_build_object('action', a.action, 'by', a.admin_email, 'at', a.at, 'details', a.details) order by a.id desc) from (select * from admin_audit where target = p_uid and action <> 'view_user' order by id desc limit 30) a)
  ) into r;
  perform public._audit('view_user', p_uid, null);
  return r;
end; $$;

-- 🪙 Tanga/XP/olmos berish yoki olish
create or replace function public.admin_adjust_econ(p_uid uuid, p_coins int, p_xp int, p_gems int, p_reason text, p_notify boolean default true) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare p profiles; v_c int := coalesce(p_coins, 0); v_x int := coalesce(p_xp, 0); v_g int := coalesce(p_gems, 0);
begin
  perform public._admin_need(2);
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  if abs(v_c) > 100000 or abs(v_x) > 200000 or abs(v_g) > 10000 then raise exception 'too_big'; end if;
  perform set_config('app.coin_restore', '1', true); perform set_config('app.admin_op', '1', true);
  update profiles set coins = greatest(0, coalesce(coins, 0) + v_c), total_coins = coalesce(total_coins, 0) + greatest(0, v_c),
         xp = greatest(0, coalesce(xp, 0) + v_x), gems = greatest(0, coalesce(gems, 0) + v_g), last_reason = left('👑 ' || btrim(p_reason), 120)
   where id = p_uid returning * into p;
  if not found then raise exception 'not_found'; end if;
  perform set_config('app.coin_restore', '0', true); perform set_config('app.admin_op', '0', true);
  if p_notify then
    insert into user_messages(user_id, kind, body, data, from_admin)
    values (p_uid, 'econ', btrim(p_reason), jsonb_build_object('coins', v_c, 'xp', v_x, 'gems', v_g), auth.uid());
  end if;
  perform public._audit('adjust_econ', p_uid, jsonb_build_object('coins', v_c, 'xp', v_x, 'gems', v_g, 'reason', p_reason));
  return jsonb_build_object('coins', p.coins, 'xp', p.xp, 'gems', p.gems, 'level', p.level);
end; $$;

-- 🚫 Ban / unban (p_hours null = doimiy)
create or replace function public.admin_ban(p_uid uuid, p_hours int, p_reason text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_until timestamptz := case when p_hours is null then 'infinity'::timestamptz else now() + make_interval(hours => greatest(1, p_hours)) end;
begin
  perform public._admin_need(2);
  if public._is_staff_user(p_uid) then raise exception 'cannot_ban_staff'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  perform set_config('app.admin_op', '1', true);
  update profiles set banned_until = v_until where id = p_uid;
  if not found then raise exception 'not_found'; end if;
  perform set_config('app.admin_op', '0', true);
  insert into user_admin_state(user_id, ban_reason, banned_at, banned_by) values (p_uid, left(p_reason, 300), now(), auth.uid())
  on conflict (user_id) do update set ban_reason = excluded.ban_reason, banned_at = now(), banned_by = auth.uid(), updated_at = now();
  perform public._audit('ban', p_uid, jsonb_build_object('hours', p_hours, 'reason', p_reason));
  return jsonb_build_object('until', case when p_hours is null then null else v_until end);
end; $$;
create or replace function public.admin_unban(p_uid uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._admin_need(2);
  perform set_config('app.admin_op', '1', true);
  update profiles set banned_until = null where id = p_uid;
  perform set_config('app.admin_op', '0', true);
  update user_admin_state set ban_reason = null, banned_at = null, banned_by = null, updated_at = now() where user_id = p_uid;
  perform public._audit('unban', p_uid, null);
end; $$;

-- ✏️ Nikni (va avatarni) majburan o'zgartirish
create or replace function public.admin_force_rename(p_uid uuid, p_reason text, p_reset_photo boolean default false) returns text
language plpgsql security definer set search_path to 'public' as $$
declare v_name text; i int := 0;
begin
  perform public._admin_need(1);
  loop
    v_name := 'User' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from profiles where lower(name) = lower(v_name)) or i > 20;
    i := i + 1;
  end loop;
  perform set_config('app.admin_op', '1', true);
  update profiles set name = v_name, name_changed_at = null, photo = case when p_reset_photo then null else photo end where id = p_uid;
  if not found then raise exception 'not_found'; end if;
  perform set_config('app.admin_op', '0', true);
  insert into user_admin_state(user_id, force_name, force_reason, force_at, force_photo) values (p_uid, v_name, left(p_reason, 300), now(), coalesce(p_reset_photo, false))
  on conflict (user_id) do update set force_name = excluded.force_name, force_reason = excluded.force_reason, force_at = now(), force_photo = excluded.force_photo, updated_at = now();
  perform public._audit('force_rename', p_uid, jsonb_build_object('name', v_name, 'reason', p_reason, 'photo', p_reset_photo));
  return v_name;
end; $$;

-- ♻️ Foydalanuvchi zaxirasini tiklash (ilova keyingi ochilishda tiklaydi)
create or replace function public.admin_request_restore(p_uid uuid, p_slot int) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._admin_need(2);
  if not exists (select 1 from app_backups where user_id = p_uid and slot = p_slot) then raise exception 'no_backup'; end if;
  insert into user_admin_state(user_id, restore_slot, restore_at) values (p_uid, p_slot, now())
  on conflict (user_id) do update set restore_slot = excluded.restore_slot, restore_at = now(), updated_at = now();
  perform public._audit('request_restore', p_uid, jsonb_build_object('slot', p_slot));
end; $$;

-- 🚪 Barcha qurilmalardan chiqarish
create or replace function public.admin_signout_all(p_uid uuid) returns int
language plpgsql security definer set search_path to 'public', 'auth' as $$
declare n int;
begin
  perform public._admin_need(2);
  update auth.refresh_tokens set revoked = true, updated_at = now() where user_id = p_uid::text and revoked is not true;
  get diagnostics n = row_count;
  update account_devices set signed_out_at = now() where user_id = p_uid and signed_out_at is null;
  perform public._audit('signout_all', p_uid, jsonb_build_object('tokens', n));
  return n;
end; $$;

-- ✉️ Shaxsiy xabar
create or replace function public.admin_send_message(p_uid uuid, p_title text, p_body text) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint;
begin
  perform public._admin_need(1);
  if char_length(btrim(coalesce(p_body, ''))) < 1 then raise exception 'empty'; end if;
  insert into user_messages(user_id, title, body, kind, from_admin) values (p_uid, left(p_title, 120), left(p_body, 2000), 'admin', auth.uid()) returning id into v_id;
  perform public._audit('message', p_uid, jsonb_build_object('title', p_title));
  return v_id;
end; $$;

-- 🕵️ Shubhali faollik
create or replace function public.admin_suspicious(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare d int := least(greatest(coalesce(p_days, 7), 1), 90); r jsonb;
begin
  perform public._admin_need(1);
  select jsonb_build_object(
    'gains', coalesce((select jsonb_agg(x order by x.xp desc) from (
        select l.user_id as id, p.name, sum(greatest(l.d_xp, 0)) as xp, sum(greatest(l.d_coins, 0)) as coins, count(*) as changes,
               round(sum(greatest(l.d_xp, 0))::numeric / d) as xp_per_day, p.banned_until
        from coin_ledger l left join profiles p on p.id = l.user_id
        where l.at > now() - make_interval(days => d) and coalesce(l.reason, '') not like '👑%' and coalesce(l.reason, '') not like 'restore #%'
        group by l.user_id, p.name, p.banned_until
        having sum(greatest(l.d_xp, 0)) > 1200 * d or sum(greatest(l.d_coins, 0)) > 2000 * d
        order by xp desc limit 30) x), '[]'::jsonb),
    'spikes', coalesce((select jsonb_agg(x order by x.at desc) from (
        select l.id, l.user_id, p.name, l.at, l.d_coins, l.d_xp, l.d_gems, l.reason
        from coin_ledger l left join profiles p on p.id = l.user_id
        where l.at > now() - make_interval(days => d) and (l.d_coins > 600 or l.d_xp > 1500 or l.d_gems > 40)
          and coalesce(l.reason, '') not like '👑%' and coalesce(l.reason, '') not like 'restore #%' and coalesce(l.reason, '') not like '🎁 promo%'
        order by l.at desc limit 40) x), '[]'::jsonb),
    'capped', coalesce((select jsonb_agg(x) from (
        select pl.user_id, p.name, round(pl.xp_b) as xp_b, round(pl.coins_b) as coins_b, pl.refilled_at
        from profile_limits pl left join profiles p on p.id = pl.user_id
        where pl.refilled_at > now() - make_interval(days => d) and (pl.xp_b < 100 or pl.coins_b < 100)
        order by pl.refilled_at desc limit 30) x), '[]'::jsonb),
    'banned', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'until', case when p.banned_until = 'infinity' then null else p.banned_until end, 'reason', s.ban_reason))
        from profiles p left join user_admin_state s on s.user_id = p.id where p.banned_until > now()), '[]'::jsonb)
  ) into r;
  return r;
end; $$;

-- 📰 Lenta moderatsiyasi
create or replace function public.admin_feed_list(p_q text default null, p_hidden boolean default false, p_limit int default 100) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select a.id, a.user_id, p.name, a.kind, a.text, a.emoji, a.created_at, a.hidden_at
    from activity_feed a left join profiles p on p.id = a.user_id
    where public._admin_level() >= 1
      and (p_q is null or p_q = '' or a.text ilike '%' || p_q || '%' or p.name ilike '%' || p_q || '%')
      and (case when p_hidden then a.hidden_at is not null else true end)
    order by a.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x;
$$;
create or replace function public.admin_feed_hide(p_id bigint, p_hide boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid;
begin
  perform public._admin_need(1);
  update activity_feed set hidden_at = case when p_hide then now() end, hidden_by = case when p_hide then auth.uid() end where id = p_id returning user_id into v_uid;
  perform public._audit(case when p_hide then 'feed_hide' else 'feed_unhide' end, v_uid, jsonb_build_object('id', p_id));
end; $$;

-- 🛡 Klanlar
create or replace function public.admin_clans_list(p_q text default null) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by x.members desc), '[]'::jsonb) from (
    select c.id, c.name, c.tag, c.emoji, c.description, c.created_at, c.disbanded_at, c.leader_id, p.name as leader_name,
      (select count(*) from clan_members m where m.clan_id = c.id and m.left_at is null) as members
    from clans c left join profiles p on p.id = c.leader_id
    where public._admin_level() >= 1 and (p_q is null or p_q = '' or c.name ilike '%' || p_q || '%' or c.tag ilike '%' || p_q || '%')
    order by c.disbanded_at nulls first, c.created_at desc limit 300) x;
$$;
create or replace function public.admin_clan_action(p_id uuid, p_action text, p_value text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._admin_need(2);
  if p_action = 'rename' then
    if char_length(btrim(coalesce(p_value, ''))) not between 3 and 24 then raise exception 'bad_name'; end if;
    if exists (select 1 from clans where disbanded_at is null and id <> p_id and lower(btrim(name)) = lower(btrim(p_value))) then raise exception 'taken'; end if;
    update clans set name = btrim(p_value) where id = p_id;
  elsif p_action = 'desc' then update clans set description = left(btrim(coalesce(p_value, '')), 140) where id = p_id;
  elsif p_action = 'disband' then
    update clans set disbanded_at = now() where id = p_id and disbanded_at is null;
    update clan_members set left_at = now() where clan_id = p_id and left_at is null;
  else raise exception 'bad_action';
  end if;
  perform public._audit('clan_' || p_action, null, jsonb_build_object('clan', p_id, 'value', p_value));
end; $$;

-- ⚙️ Sozlamalar
create or replace function public.admin_get_config() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when public._admin_level() >= 1 then coalesce(jsonb_object_agg(key, value), '{}'::jsonb) end from app_config;
$$;
create or replace function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._admin_need(2);
  if p_key not in ('flags', 'maintenance', 'season', 'banned_words') then raise exception 'bad_key'; end if;
  if p_key = 'banned_words' and jsonb_typeof(p_value) <> 'array' then raise exception 'bad_value'; end if;
  if p_key <> 'banned_words' and jsonb_typeof(p_value) <> 'object' then raise exception 'bad_value'; end if;
  insert into app_config(key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public._audit('config_' || p_key, null, p_value);
end; $$;

-- 🎁 Promo-kodlar (admin)
create or replace function public.admin_promo_list() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) from promo_codes c where public._admin_level() >= 1;
$$;
create or replace function public.admin_promo_save(p jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_code text := upper(btrim(coalesce(p->>'code', '')));
begin
  perform public._admin_need(2);
  if v_code !~ '^[A-Z0-9_-]{3,32}$' then raise exception 'bad_code'; end if;
  insert into promo_codes(code, coins, gems, xp, max_uses, expires_at, active, note, created_by)
  values (v_code, least(greatest(coalesce((p->>'coins')::int, 0), 0), 5000), least(greatest(coalesce((p->>'gems')::int, 0), 0), 500), least(greatest(coalesce((p->>'xp')::int, 0), 0), 20000),
          nullif(p->>'max_uses', '')::int, nullif(p->>'expires_at', '')::timestamptz, coalesce((p->>'active')::boolean, true), left(p->>'note', 200), auth.uid())
  on conflict (code) do update set coins = excluded.coins, gems = excluded.gems, xp = excluded.xp, max_uses = excluded.max_uses,
    expires_at = excluded.expires_at, active = excluded.active, note = excluded.note;
  perform public._audit('promo_save', null, p);
end; $$;

-- 📣 E'lonlar (admin)
create or replace function public.admin_announce_list() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) from (select * from announcements order by created_at desc limit 100) a where public._admin_level() >= 1;
$$;
create or replace function public.admin_announce_save(p jsonb) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint := nullif(p->>'id', '')::bigint;
begin
  perform public._admin_need(2);
  if v_id is null then
    insert into announcements(kind, title, body, version, lang, country, min_level, max_level, audience, starts_at, ends_at, active, created_by)
    values (coalesce(p->>'kind', 'banner'), left(p->>'title', 120), left(coalesce(p->>'body', ''), 4000), left(p->>'version', 20), nullif(p->>'lang', ''), nullif(p->>'country', ''),
            nullif(p->>'min_level', '')::int, nullif(p->>'max_level', '')::int, coalesce(nullif(p->>'audience', ''), 'all'),
            coalesce(nullif(p->>'starts_at', '')::timestamptz, now()), nullif(p->>'ends_at', '')::timestamptz, coalesce((p->>'active')::boolean, true), auth.uid())
    returning id into v_id;
  else
    update announcements set kind = coalesce(p->>'kind', kind), title = left(p->>'title', 120), body = left(coalesce(p->>'body', body), 4000), version = left(p->>'version', 20),
      lang = nullif(p->>'lang', ''), country = nullif(p->>'country', ''), min_level = nullif(p->>'min_level', '')::int, max_level = nullif(p->>'max_level', '')::int,
      audience = coalesce(nullif(p->>'audience', ''), audience), starts_at = coalesce(nullif(p->>'starts_at', '')::timestamptz, starts_at),
      ends_at = nullif(p->>'ends_at', '')::timestamptz, active = coalesce((p->>'active')::boolean, active), updated_at = now()
    where id = v_id;
  end if;
  perform public._audit('announce_save', null, p || jsonb_build_object('id', v_id));
  return v_id;
end; $$;

-- 📣 Ommaviy xabar: kimga boradi (edge funksiya ham ishlatadi)
create or replace function public._broadcast_users(p_f jsonb) returns setof uuid
language sql stable security definer set search_path to 'public' as $$
  select p.id from profiles p
  where (p.banned_until is null or p.banned_until < now())
    and (coalesce(p_f->>'lang', '') = '' or p.language = p_f->>'lang')
    and (coalesce(p_f->>'country', '') = '' or p.country = p_f->>'country')
    and (coalesce(p_f->>'level_min', '') !~ '^\d+$' or coalesce(p.level, 1) >= (p_f->>'level_min')::int)
    and (coalesce(p_f->>'level_max', '') !~ '^\d+$' or coalesce(p.level, 1) <= (p_f->>'level_max')::int)
    and (coalesce(p_f->>'active', '') = ''
         or (p_f->>'active' = '7d' and p.last_active_at > now() - interval '7 days')
         or (p_f->>'active' = '30d' and p.last_active_at > now() - interval '30 days')
         or (p_f->>'active' = 'inactive14' and p.last_active_at < now() - interval '14 days'));
$$;
revoke all on function public._broadcast_users(jsonb) from public, anon, authenticated;
create or replace function public.admin_broadcast_preview(p_f jsonb) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public._admin_need(2);
  with u as (select * from public._broadcast_users(coalesce(p_f, '{}'::jsonb)) id)
  select jsonb_build_object('users', (select count(*) from u),
    'push', (select count(distinct s.user_id) from push_subscriptions s join u on u.id = s.user_id),
    'telegram', (select count(*) from telegram_links t join u on u.id = t.user_id where t.enabled)) into r;
  return r;
end; $$;
create or replace function public.admin_broadcast_list() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(b) order by b.at desc), '[]'::jsonb) from (select * from admin_broadcasts order by at desc limit 50) b where public._admin_level() >= 1;
$$;

-- 🏆 Mavsum va klan haftasi
create or replace function public.admin_season() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb; v_week date;
begin
  perform public._admin_need(1);
  select max(week_start) into v_week from clan_week_results;
  select jsonb_build_object(
    'config', (select value from app_config where key = 'season'),
    'participants', (select count(*) from profiles where season_coins > 0 and (banned_until is null or banned_until < now())),
    'top', coalesce((select jsonb_agg(x) from (select id, name, season_coins, level, country from profiles
             where season_coins > 0 and (banned_until is null or banned_until < now()) order by season_coins desc limit 20) x), '[]'::jsonb),
    'clan_week', v_week,
    'clans', coalesce((select jsonb_agg(x order by x.rank) from (select r.rank, r.avg_xp, c.name, c.tag, c.emoji from clan_week_results r left join clans c on c.id = r.clan_id where r.week_start = v_week order by r.rank limit 20) x), '[]'::jsonb)
  ) into r;
  return r;
end; $$;

-- 👥 Jamoa va jurnal
create or replace function public.admin_staff_list() returns jsonb
language sql stable security definer set search_path to 'public', 'auth' as $$
  select coalesce(jsonb_agg(x order by x.revoked_at nulls first, x.role), '[]'::jsonb) from (
    select e.email, e.role, e.revoked_at, e.added_at, u.id as user_id, p.name, p.last_active_at
    from admin_emails e left join auth.users u on lower(u.email) = e.email left join profiles p on p.id = u.id
    where public._admin_level() >= 1) x;
$$;
create or replace function public.admin_staff_set(p_email text, p_role text) returns void
language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform public._admin_need(3);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then raise exception 'self'; end if;
  if p_role = 'revoked' then
    update admin_emails set revoked_at = now() where email = v_email;
  elsif p_role in ('owner', 'admin', 'helper') then
    insert into admin_emails(email, role, revoked_at, added_at) values (v_email, p_role, null, now())
    on conflict (email) do update set role = excluded.role, revoked_at = null;
    insert into admins(user_id) select id from auth.users where lower(email) = v_email and email_confirmed_at is not null on conflict do nothing;
  else raise exception 'bad_role';
  end if;
  perform public._audit('staff_set', (select id from auth.users where lower(email) = v_email limit 1), jsonb_build_object('email', v_email, 'role', p_role));
end; $$;
create or replace function public.admin_audit_list(p_limit int default 200, p_action text default null) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public._admin_need(2);
  select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) into r from (
    select a.id, a.admin_email, a.action, a.target, p.name as target_name, a.details, a.at
    from admin_audit a left join profiles p on p.id = a.target
    where (p_action is null or p_action = '' or a.action = p_action)
    order by a.id desc limit least(greatest(coalesce(p_limit, 200), 1), 1000)) x;
  return r;
end; $$;

-- ============================== D) ANALITIKA VA TIZIM (migratsiya: admin_tools_d) ==============================
-- admin_range_stats(p_from, p_to)  — kunlik ro'yxatdan o'tish / faol / Pomodoro / mukofot (≤ 400 kun)
-- admin_analytics()                — voronka, haftalik kogortalar (D1/D7/D30), funksiyalar, onlayn, ketganlar,
--                                    Focusgate (top bloklangan/ishlatilgan), referallar, Telegram
-- admin_errors(p_days, p_resolved), admin_error_resolve(p_sig, p_resolved) — client_errors bo'yicha
-- admin_sync_issues()              — account_devices.sync_* (account.js yozadi), ilova versiyalari
-- admin_system_health()            — baza hajmi, katta jadvallar, cron natijalari, pg_net xatolari (faqat admin+)
-- To'liq matn: supabase_migrations.schema_migrations (name = 'admin_tools_d').
-- admin_tools_e_grants: grant execute on function public._broadcast_users(jsonb) to service_role;
-- Ommaviy xabar: supabase/functions/admin-broadcast (ilova ichida + Web Push + Telegram).
