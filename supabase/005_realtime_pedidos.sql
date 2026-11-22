-- =====================================================================
--  005 — Pedidos en tiempo real en el panel
--  Hace que la lista de pedidos se actualice sola cuando entra uno nuevo.
--  (Respeta RLS: cada dueño solo recibe los suyos.)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
