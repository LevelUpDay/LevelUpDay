-- ✈️ Telegram jadvallari uchun ruxsatlar.
-- Loyihada yangi jadvallarga avtomatik ruxsat berilmaydi, shuning uchun service_role (edge funksiyalar)
-- telegram_links'ga yoza olmasdi va app_state'ni o'qiy olmasdi → bot "akkaunt ulanmagan" derdi.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
-- Foydalanuvchi o'z bog'lanishini ko'radi/sozlaydi/uzadi (RLS faqat o'ziniki bilan cheklaydi)
grant select, update, delete on public.telegram_links to authenticated;
