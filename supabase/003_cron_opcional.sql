-- =====================================================================
--  OPCIONAL — Tareas automáticas con pg_cron
--  Activar antes: Database → Extensions → pg_cron
-- =====================================================================

-- Todos los días a las 4:00 a. m. (hora Lima = 9:00 UTC)
select cron.schedule('expirar-pedidos', '0 9 * * *', $$ select public.expire_pending_orders(); $$);
select cron.schedule('limpiar-eventos', '15 9 * * *', $$ select public.purge_old_events(); $$);
