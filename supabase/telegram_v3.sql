-- ✈️ Telegram v3: botdan sub-tasklarni ham bajarildi deb belgilash imkoniyati.
-- tg_actions.kind ro'yxatiga 'subtask_done' qo'shiladi (payload: { day, subId }).
alter table public.tg_actions drop constraint if exists tg_actions_kind_check;
alter table public.tg_actions add constraint tg_actions_kind_check check (kind in ('done', 'add', 'snooze', 'subtask_done'));
