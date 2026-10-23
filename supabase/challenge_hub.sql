-- ⚔️ Challenge markazi: Focusgate challenge'lariga 🍅 Pomodoro o'lchovi (mode='pomo') va chiqish/bekor qilish
alter table fg_challenges add column if not exists mode text;
-- fg_challenge_stats: pomo_min, pomo_days, photo maydonlari qo'shildi (pomo_log dan)
-- fg_challenge_leave(p_id): a'zo — chiqadi; egasi — challenge'ni tugatadi (end_at o'tmishga suriladi)
create or replace function public.fg_challenge_leave(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  update fg_challenges set members = array_remove(members, auth.uid()), accepted = array_remove(accepted, auth.uid())
  where id = p_id and auth.uid() = any(members) and owner <> auth.uid();
  update fg_challenges set end_at = now() - interval '8 days'
  where id = p_id and (owner = auth.uid() or coalesce(array_length(members, 1), 0) < 2);
end $$;
grant execute on function public.fg_challenge_leave(uuid) to authenticated;
