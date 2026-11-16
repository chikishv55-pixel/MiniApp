# Отложено: версия с базой Supabase

Рабочий код под Supabase (профили между устройствами, вызовы в базе со списком ответов,
баннеры в Supabase Storage). Отложен 2026-11-16 — пока живём без базы.

Чтобы вернуть: `schema.sql` выполнить в Supabase, файлы из `api/` положить обратно в `/api`
(`admin-ads.ts` → `api/admin/ads.ts`), прописать SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
Клиент тогда снова надо научить ходить в `/api/me` и `/api/result`.
