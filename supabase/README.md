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
| `fair_competitions_core`, `party_competition_rpcs`, `party_comp_close_split`, `party_comp_outcome_column`, `duels_worldparty_fair_metrics`, `world_party_data_volatile` | ⚖️ Duel / Party / World Party: faqat "bajarish %" va "XP" o'lchovlari; Party — a'zolar o'rtasidagi musobaqa |
| `clans` | 🛡 klanlar: 30 kishigacha, haftalik klan jangi (o'rtacha XP), top-3 klan a'zolariga 💎; chiqqanlar o'chirilmaydi (left_at) |
| `profiles_anti_cheat_rate_limits` | reyting firibgarligiga qarshi: XP/tanga/gem/streak o'sishi serverda cheklanadi |

Edge function: `functions/send-reminders` (verify_jwt o'chiq — o'rniga Vault'dagi `push_cron_secret` sarlavhasi tekshiriladi).

## Qo'lda ishga tushirish kerak bo'lgan fayllar

`fix_delete_account.sql` — "Delete account" ishlashi uchun **shart** (ichida `DELETE` bor,
avtomatik qo'llanmadi). Supabase → SQL Editor'da bir marta ishga tushiring.
Yangilangan: endi `coin_ledger`, `app_backups`, `account_devices` ham tozalanadi — qayta ishga tushiring.

`friends_remove_block.sql` — ichida `DELETE` bor, shuning uchun avtomatik qo'llanmadi.
Supabase → SQL Editor'da bir marta ishga tushiring. Bo'lmasa ham ilova ishlaydi
(eski `remove_friend` / `block_user` / `unblock_user` ishlatiladi), faqat admin
panelida fikrni o'chirish ishlamaydi.

## ☁️ Sinxronlash va akkaunt markazi (`account.js`)

- SQL: `supabase/account_sync.sql` (qo'llangan). Jadvallar: `coin_ledger` (tanga/XP tarixi, `restore_lost_coins`),
  `app_backups` (kunlik zaxira, 30 kun), `account_devices` (qurilmalar, uzoqdan chiqarish).
- Yangi qurilma xabari: `focusgate` edge funksiyasi, `{action:'notify_new_device', device_id}` + foydalanuvchi JWT;
  `telegram_links.prefs.newDevice = false` bo'lsa yuborilmaydi.

## 👑 Admin paneli v2 (`admin.js`, `ops.js`)

- SQL: `supabase/admin_tools.sql` (qo'llangan: admin_tools_a … admin_tools_e_grants).
- Rollar: `admin_emails.role` — helper (1), admin (2), owner (3); `revoked_at` — rol olib tashlangan.
  Har bir `admin_*` RPC `_admin_need(n)` bilan tekshiradi, har bir amal `admin_audit` ga yoziladi.
- Jadvallar: `user_admin_state` (ban sababi, majburiy nik, tiklash so'rovi), `app_config` (flags, maintenance,
  season, banned_words), `announcements`, `user_messages`, `promo_codes`/`promo_redemptions`, `client_errors`,
  `admin_broadcasts`, `admin_audit`. `profiles.banned_until`, `activity_feed.hidden_at`, `account_devices.sync_*`.
- Ban: `_profiles_admin_guard` — foydalanuvchi o'zi `banned_until` ni o'zgartira olmaydi, ban vaqtida tanga/XP/nik muzlaydi;
  reyting va lentada ko'rinmaydi. Admin funksiyalari `app.admin_op` / `app.coin_restore` tranzaksiya sozlamalarini qo'yadi.
- Edge funksiya `admin-broadcast` (verify_jwt o'chiq, admin/owner JWT tekshiradi): ilova ichida + Web Push + Telegram.

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

## ✈️ Telegram (@LevelUpDayLoginBot)
| Qism | Nima qiladi |
|---|---|
| `telegram_links` | foydalanuvchi ↔ Telegram chat (RLS: faqat o'zinikini ko'radi; mijoz faqat `enabled/prefs/tz/lang` ni o'zgartira oladi — `_telegram_links_guard` trigger) |
| `telegram_link_codes`, `tg_link_code()` | ilovadagi "Ulash" → bir martalik kod (30 daqiqa) → `t.me/LevelUpDayLoginBot?start=<kod>` |
| `telegram_state` | webhook o'rnatilganini eslab qoladi |
| `functions/telegram-auth` | Telegram Login (HMAC tekshiruvi) → akkaunt + sessiya; avtomatik `telegram_links` ga ulaydi |
| `functions/telegram-bot` | webhook: `/start <kod>`, `/start`, `/today`, `/stop`, `/help`; ilovadan "sinov xabari" |
| `functions/send-reminders` | har 5 daqiqada: vazifa eslatmasi, boshlanish vaqti, 08:00 reja, 20:00 streak, 21:30 kun yakuni (Telegram) + web push; webhook va buyruqlar menyusini o'zi o'rnatadi |

Sir: **Edge Functions → Secrets → `TELEGRAM_BOT_TOKEN`**. Token almashtirilsa, webhook keyingi 5 daqiqada o'zi qayta o'rnatiladi.

## 🛡 Focusgate (Windows agenti)

- Jadvallar: `fg_devices` (ulangan kompyuterlar, token sha256), `fg_pair` (15 daqiqalik ulash kodlari), `fg_usage` (kun × ilova soniyalari, 24 soatlik taqsimot), `fg_config` (limitlar, fokus — sayt yozadi, agent o'qiydi). SQL: `supabase/focusgate.sql`.
- Funksiya: `focusgate` (`verify_jwt = false`): `pair_start` / `pair_poll` (agent), `pair_approve` (sayt, foydalanuvchi JWT), `sync` (agent, qurilma tokeni).
- Agent manbasi: `focusgate-agent/` (Go). Yuklab olish: GitHub Releases → `Focusgate.exe`.
