-- Supabase → SQL Editor'da bir marta ishga tushiring.
-- (Bu funksiyalarda DELETE bor, shuning uchun avtomatik qo'llanmadi.)
-- Ilova ular bo'lmasa ham ishlaydi — eski remove_friend/block_user/unblock_user ishlatiladi.

create or replace function public.friend_remove(p_other_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where (user_id = auth.uid() and friend_id = p_other_id) or (user_id = p_other_id and friend_id = auth.uid());
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.friend_block(p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_target_id is null or p_target_id = auth.uid() then return jsonb_build_object('ok', false, 'error', 'invalid user'); end if;
  insert into friend_blocks(user_id, blocked_id) values (auth.uid(), p_target_id) on conflict do nothing;
  delete from friendships where (user_id = auth.uid() and friend_id = p_target_id) or (user_id = p_target_id and friend_id = auth.uid());
  delete from friend_requests where (from_id = auth.uid() and to_id = p_target_id) or (from_id = p_target_id and to_id = auth.uid());
  update duels set status = 'cancelled' where status = 'pending' and ((from_id = auth.uid() and to_id = p_target_id) or (from_id = p_target_id and to_id = auth.uid()));
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.friend_unblock(p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from friend_blocks where user_id = auth.uid() and blocked_id = p_target_id;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.admin_delete_feedback(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'Ruxsat yo''q'; end if;
  delete from feedback where id = p_id;
end; $$;

revoke execute on function public.friend_remove(uuid) from public, anon;
revoke execute on function public.friend_block(uuid) from public, anon;
revoke execute on function public.friend_unblock(uuid) from public, anon;
revoke execute on function public.admin_delete_feedback(bigint) from public, anon;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_block(uuid) to authenticated;
grant execute on function public.friend_unblock(uuid) to authenticated;
grant execute on function public.admin_delete_feedback(bigint) to authenticated;
