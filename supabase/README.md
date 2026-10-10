# Supabase (LevelUpDay)

Barcha o'zgarishlar Supabase migratsiyalari sifatida qo'llangan
(`supabase_migrations.schema_migrations` jadvalida to'liq SQL saqlanadi):

| Migratsiya | Nima qiladi |
|---|---|
| `profiles_gems_column` | `profiles.gems` ustuni |
| `friends_helpers` | `_are_friends`, `_my_friend_ids` (ichki) |
| `friends_rpc_v2_read_send` | `get_my_friends_data`, `send_friend_request`, `friend_respond` |
| `duels_rpc_v2` | `get_my_duels_data`, `send_duel_challenge`, `respond_duel_challenge`, `cancel_duel_challenge`, `duel_surrender`, `duel_record_task_event` (gem tikilmasi mijozda hisoblanadi — server tangaga tegmaydi) |
| `lock_old_duel_rpcs_and_feedback` | eski duel RPC'lari yopildi; `feedback` jadvali + admin RPC'lari |
| `social_feed_shared_tasks` | 📰 `activity_feed`, `feed_reactions`, 🤝 `shared_tasks`, `shared_task_checks` + RPC'lar |
| `harden_function_grants` | ichki funksiyalar API'dan yopildi, anon chaqira olmaydi |
| `table_grants_for_api` | jadvallarga Data API huquqlari (RLS qatorlarni himoya qiladi), realtime |
| `todos_delete_grant` | vazifani o'chirish huquqi |
| `profiles_cosmetics` | do'kon bezaklari boshqalarga ko'rinishi |
| `fix_set_friend_code_definer` | profil sinxroni 403 xatosi tuzatildi |
| `admin_by_email_allowlist` | admin paneli faqat 3 ta email uchun |
| `unique_nick_and_change_cooldown` | yagona nik, nikni 7 kunda 1 marta o'zgartirish |
| `push_subscriptions`, `push_config_rpc_and_cron`, `push_service_role_grants`, `schedule_send_reminders` | 🔔 push eslatmalar (kalitlar Vault'da, pg_cron har 5 daqiqada `send-reminders` funksiyasini chaqiradi) |
| `referrals` | 🎁 do'st taklif qilish (3 faol kundan keyin ikkalasiga +10 💎) |
| `friends_last_active` | do'stlarda haqiqiy onlayn holat |
| `profiles_anti_cheat_rate_limits` | reyting firibgarligiga qarshi: XP/tanga/gem/streak o'sishi serverda cheklanadi |

Edge function: `functions/send-reminders` (verify_jwt o'chiq — o'rniga Vault'dagi `push_cron_secret` sarlavhasi tekshiriladi).

## Qo'lda ishga tushirish kerak bo'lgan fayllar

`fix_delete_account.sql` — "Delete account" ishlashi uchun **shart** (ichida `DELETE` bor,
avtomatik qo'llanmadi). Supabase → SQL Editor'da bir marta ishga tushiring.

`friends_remove_block.sql` — ichida `DELETE` bor, shuning uchun avtomatik qo'llanmadi.
Supabase → SQL Editor'da bir marta ishga tushiring. Bo'lmasa ham ilova ishlaydi
(eski `remove_friend` / `block_user` / `unblock_user` ishlatiladi), faqat admin
panelida fikrni o'chirish ishlamaydi.

## Dashboard'da qilinadigan sozlamalar
- **Authentication → URL Configuration**: Site URL va Redirect URLs ga
  `https://levelupday.github.io/LevelUpDay/` qo'shing.
- **Authentication → Providers → Email → Leaked password protection**: yoqing.

## Admin analitikasi
| Migratsiya | Nima qiladi |
|---|---|
| `admin_dashboard_analytics` | `profiles` ga `referral_source`, `referral_other`, `device_type`, `last_active_at`; `user_activity_days` (DAU/MAU); `touch_activity()`; `get_admin_dashboard()` |
| `am_i_admin` | ilova admin tugmasini ko'rsatishi uchun |

Admin qo'shish: `insert into public.admins (user_id) values ('<user uuid>');`
