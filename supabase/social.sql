-- ============================================================
-- ToDoList — 👥 Birgalikdagi vazifalar + 📰 Do'stlar lentasi
-- Supabase → SQL Editor → shu faylni to'liq ishga tushiring.
-- Qayta ishga tushirish xavfsiz (IF NOT EXISTS / OR REPLACE).
--
-- Do'stlik tekshiruvi mavjud public.get_my_friends_data() RPC orqali
-- qilinadi (u ilovada allaqachon ishlatiladi), shuning uchun do'stlar
-- jadvalining nomini bilish shart emas.
-- ============================================================

-- Joriy foydalanuvchining do'stlari ro'yxati (uuid[])
create or replace function public._my_friend_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d jsonb;
  ids uuid[];
begin
  d := to_jsonb(public.get_my_friends_data());
  select coalesce(array_agg((f->>'id')::uuid), '{}')
    into ids
    from jsonb_array_elements(coalesce(d->'friends', '[]'::jsonb)) f
   where f->>'id' ~* '^[0-9a-f-]{36}$';
  return ids;
exception when others then
  return '{}';
end;
$$;

-- ------------------------------------------------------------
-- 📰 LENTA
-- ------------------------------------------------------------
create table if not exists public.activity_feed (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,
  text       text not null check (char_length(text) <= 200),
  emoji      text not null default '✅' check (char_length(emoji) <= 8),
  created_at timestamptz not null default now()
);
create index if not exists activity_feed_user_time on public.activity_feed (user_id, created_at desc);

create table if not exists public.feed_reactions (
  feed_id    bigint not null references public.activity_feed(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥','👏','💪','❤️')),
  created_at timestamptz not null default now(),
  primary key (feed_id, user_id, emoji)
);

alter table public.activity_feed  enable row level security;
alter table public.feed_reactions enable row level security;
-- To'g'ridan-to'g'ri jadval o'qish faqat o'zinikiga; do'stlarniki RPC orqali.
drop policy if exists activity_feed_own on public.activity_feed;
create policy activity_feed_own on public.activity_feed for select using (user_id = auth.uid());
drop policy if exists activity_feed_del on public.activity_feed;
create policy activity_feed_del on public.activity_feed for delete using (user_id = auth.uid());
drop policy if exists feed_reactions_own on public.feed_reactions;
create policy feed_reactions_own on public.feed_reactions for select using (user_id = auth.uid());

create or replace function public.post_activity(p_kind text, p_text text, p_emoji text default '✅')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- spamdan himoya: sutkasiga 40 tadan ko'p emas
  select count(*) into v_cnt from activity_feed where user_id = auth.uid() and created_at > now() - interval '1 day';
  if v_cnt >= 40 then return null; end if;
  insert into activity_feed (user_id, kind, text, emoji)
  values (auth.uid(), left(coalesce(p_kind, 'misc'), 30), left(coalesce(p_text, ''), 200), left(coalesce(nullif(p_emoji, ''), '✅'), 8))
  returning id into v_id;
  -- 60 kundan eski yozuvlarni tozalash
  delete from activity_feed where user_id = auth.uid() and created_at < now() - interval '60 days';
  return v_id;
end;
$$;

create or replace function public.get_friend_feed(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[];
begin
  if v_me is null then return '[]'::jsonb; end if;
  v_ids := array_append(_my_friend_ids(), v_me);
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.created_at desc)
    from (
      select a.id, a.user_id, a.kind, a.text, a.emoji, a.created_at,
             (a.user_id = v_me) as is_me,
             p.name, p.photo,
             coalesce((select jsonb_object_agg(r.emoji, r.c) from (select emoji, count(*) c from feed_reactions where feed_id = a.id group by emoji) r), '{}'::jsonb) as reactions,
             coalesce((select jsonb_agg(emoji) from feed_reactions where feed_id = a.id and user_id = v_me), '[]'::jsonb) as my_reactions
        from activity_feed a
        left join profiles p on p.id = a.user_id
       where a.user_id = any(v_ids)
         and a.created_at > now() - interval '30 days'
       order by a.created_at desc
       limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.react_activity(p_feed bigint, p_emoji text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select user_id into v_owner from activity_feed where id = p_feed;
  if v_owner is null then raise exception 'not found'; end if;
  if v_owner <> auth.uid() and not (v_owner = any(_my_friend_ids())) then raise exception 'not a friend'; end if;
  if p_on then
    insert into feed_reactions (feed_id, user_id, emoji) values (p_feed, auth.uid(), p_emoji) on conflict do nothing;
  else
    delete from feed_reactions where feed_id = p_feed and user_id = auth.uid() and emoji = p_emoji;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 👥 BIRGALIKDAGI VAZIFALAR
-- ------------------------------------------------------------
create table if not exists public.shared_tasks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  emoji      text not null default '🤝',
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  check (owner_id <> partner_id)
);
create index if not exists shared_tasks_owner on public.shared_tasks (owner_id) where not archived;
create index if not exists shared_tasks_partner on public.shared_tasks (partner_id) where not archived;

create table if not exists public.shared_task_checks (
  task_id    uuid not null references public.shared_tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id, day)
);

alter table public.shared_tasks       enable row level security;
alter table public.shared_task_checks enable row level security;
drop policy if exists shared_tasks_members on public.shared_tasks;
create policy shared_tasks_members on public.shared_tasks for select using (auth.uid() in (owner_id, partner_id));
drop policy if exists shared_checks_members on public.shared_task_checks;
create policy shared_checks_members on public.shared_task_checks for select using (
  exists (select 1 from shared_tasks t where t.id = task_id and auth.uid() in (t.owner_id, t.partner_id))
);

create or replace function public.get_my_shared_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.created_at)
    from (
      select t.id, t.name, t.emoji, t.created_at, (t.owner_id = v_me) as is_owner,
             case when t.owner_id = v_me then t.partner_id else t.owner_id end as partner_id,
             p.name as partner_name, p.photo as partner_photo,
             coalesce((select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'day', c.day))
                         from shared_task_checks c
                        where c.task_id = t.id and c.day > current_date - 60), '[]'::jsonb) as checks
        from shared_tasks t
        left join profiles p on p.id = case when t.owner_id = v_me then t.partner_id else t.owner_id end
       where not t.archived and v_me in (t.owner_id, t.partner_id)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_shared_task(p_partner uuid, p_name text, p_emoji text default '🤝')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_partner is null or p_partner = auth.uid() then raise exception 'invalid partner'; end if;
  if not (p_partner = any(_my_friend_ids())) then raise exception 'not a friend'; end if;
  select count(*) into v_cnt from shared_tasks where not archived and auth.uid() in (owner_id, partner_id);
  if v_cnt >= 20 then raise exception 'too many shared tasks'; end if;
  insert into shared_tasks (owner_id, partner_id, name, emoji)
  values (auth.uid(), p_partner, left(trim(p_name), 60), left(coalesce(nullif(p_emoji, ''), '🤝'), 8))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.check_shared_task(p_task uuid, p_day date, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from shared_tasks where id = p_task and not archived and auth.uid() in (owner_id, partner_id)) then
    raise exception 'not found';
  end if;
  -- faqat bugun yoki kecha (vaqt zonasi farqi uchun) belgilash mumkin
  if p_day < current_date - 1 or p_day > current_date + 1 then raise exception 'invalid day'; end if;
  if p_done then
    insert into shared_task_checks (task_id, user_id, day) values (p_task, auth.uid(), p_day) on conflict do nothing;
  else
    delete from shared_task_checks where task_id = p_task and user_id = auth.uid() and day = p_day;
  end if;
end;
$$;

create or replace function public.delete_shared_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update shared_tasks set archived = true
   where id = p_task and auth.uid() in (owner_id, partner_id);
end;
$$;

-- Ruxsatlar: faqat tizimga kirgan foydalanuvchilar
revoke all on function public._my_friend_ids() from public, anon;
revoke all on function public.post_activity(text, text, text) from public, anon;
revoke all on function public.get_friend_feed(int) from public, anon;
revoke all on function public.react_activity(bigint, text, boolean) from public, anon;
revoke all on function public.get_my_shared_tasks() from public, anon;
revoke all on function public.create_shared_task(uuid, text, text) from public, anon;
revoke all on function public.check_shared_task(uuid, date, boolean) from public, anon;
revoke all on function public.delete_shared_task(uuid) from public, anon;
grant execute on function public.post_activity(text, text, text) to authenticated;
grant execute on function public.get_friend_feed(int) to authenticated;
grant execute on function public.react_activity(bigint, text, boolean) to authenticated;
grant execute on function public.get_my_shared_tasks() to authenticated;
grant execute on function public.create_shared_task(uuid, text, text) to authenticated;
grant execute on function public.check_shared_task(uuid, date, boolean) to authenticated;
grant execute on function public.delete_shared_task(uuid) to authenticated;
