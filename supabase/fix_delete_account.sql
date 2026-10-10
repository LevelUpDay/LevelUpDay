-- 🗑 "Delete account" tuzatish (Supabase → SQL Editor'da bir marta ishga tushiring)
-- Sabab: eski funksiya avatarni storage.objects jadvalidan to'g'ridan-to'g'ri o'chirardi —
-- Supabase buni taqiqlaydi (403), shu sabab butun o'chirish bekor bo'lardi.
-- Endi avatar ilova tomonida Storage API orqali o'chiriladi, bu funksiya esa faqat
-- ma'lumotlar va auth foydalanuvchini o'chiradi.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  t   text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  foreach t in array array['todos','app_state','reward_log','pomo_log','pomo_break_stats','friendships','blocked_users','blocks','friend_blocks','user_activity_days','activity_feed','shared_tasks','feed_reactions']
  loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('delete from public.%I where user_id = $1', t) using uid;
      exception when undefined_column then null;
      end;
    end if;
  end loop;

  foreach t in array array['friend_requests','party_invites','duels']
  loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('delete from public.%I where from_id = $1 or to_id = $1', t) using uid;
      exception when undefined_column then null;
      end;
    end if;
  end loop;

  if to_regclass('public.friendships') is not null then
    begin execute 'delete from public.friendships where friend_id = $1' using uid;
    exception when undefined_column then null; end;
  end if;
  if to_regclass('public.friend_blocks') is not null then
    begin execute 'delete from public.friend_blocks where blocked_id = $1' using uid;
    exception when undefined_column then null; end;
  end if;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
