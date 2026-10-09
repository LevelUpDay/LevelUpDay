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

## Qo'lda ishga tushirish kerak bo'lgan fayl

`friends_remove_block.sql` — ichida `DELETE` bor, shuning uchun avtomatik qo'llanmadi.
Supabase → SQL Editor'da bir marta ishga tushiring. Bo'lmasa ham ilova ishlaydi
(eski `remove_friend` / `block_user` / `unblock_user` ishlatiladi), faqat admin
panelida fikrni o'chirish ishlamaydi.

## Dashboard'da qilinadigan sozlamalar
- **Authentication → URL Configuration**: Site URL va Redirect URLs ga
  `https://levelupday.github.io/LevelUpDay/` qo'shing.
- **Authentication → Providers → Email → Leaked password protection**: yoqing.
