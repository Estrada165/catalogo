-- =====================================================================
--  007 — Ajustes de la plataforma, activación y almacenamiento por negocio
-- =====================================================================

-- 1) Ajustes generales (los edita solo el superadmin; todos pueden leerlos)
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

drop policy if exists "leer ajustes" on public.platform_settings;
create policy "leer ajustes" on public.platform_settings for select using (true);
drop policy if exists "superadmin ajustes" on public.platform_settings;
create policy "superadmin ajustes" on public.platform_settings
  for all using (is_superadmin()) with check (is_superadmin());

grant select on public.platform_settings to anon, authenticated;
grant insert, update, delete on public.platform_settings to authenticated;

insert into public.platform_settings (key, value) values
  ('contacto', jsonb_build_object(
     'whatsapp', '',
     'mensaje_activacion', 'Hola, acabo de registrar mi negocio {negocio} ({enlace}) y quiero activar mi catálogo.',
     'mensaje_renovacion', 'Hola, quiero renovar el plan de mi catálogo {negocio} ({enlace}).'
  ))
on conflict (key) do nothing;

-- 2) Plantillas base en monocromo (cada negocio luego elige su color)
update public.rubro_templates
   set config_base = jsonb_set(config_base, '{theme,accent}', '"#18181B"')
 where key in ('general', 'streaming')
   and config_base->'theme'->>'accent' = '#FF6B35';

-- 3) Almacenamiento detallado por negocio (solo superadmin)
create or replace function public.storage_usage_all()
returns table (tenant_id text, tenant_name text, slug text, files bigint, bytes bigint,
               products_bytes bigint, brand_bytes bigint, payments_bytes bigint, bot_bytes bigint,
               orphan_files bigint, orphan_bytes bigint)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not is_superadmin() then raise exception 'Sin permiso'; end if;
  return query
    with objs as (
      select (storage.foldername(o.name))[1] as folder,
             (storage.foldername(o.name))[2] as kind,
             o.name, coalesce((o.metadata->>'size')::bigint, 0) as size, o.created_at
        from storage.objects o
       where o.bucket_id = 'catalog'
    ),
    refs as (select t.id::text as folder, t.name, t.slug, tenant_file_refs(t.id) as blob from tenants t)
    select objs.folder,
           coalesce(refs.name, '(negocio eliminado)'),
           refs.slug,
           count(*)::bigint,
           sum(objs.size)::bigint,
           sum(objs.size) filter (where objs.kind = 'products')::bigint,
           sum(objs.size) filter (where objs.kind = 'brand')::bigint,
           sum(objs.size) filter (where objs.kind = 'payments')::bigint,
           sum(objs.size) filter (where objs.kind = 'bot')::bigint,
           count(*) filter (where objs.created_at < now() - interval '24 hours'
                              and (refs.folder is null or position(objs.name in refs.blob) = 0))::bigint,
           coalesce(sum(objs.size) filter (where objs.created_at < now() - interval '24 hours'
                              and (refs.folder is null or position(objs.name in refs.blob) = 0)), 0)::bigint
      from objs
      left join refs on refs.folder = objs.folder
     group by objs.folder, refs.name, refs.slug
     order by sum(objs.size) desc;
end $$;
grant execute on function public.storage_usage_all() to authenticated;

-- El almacenamiento ya no se muestra a los dueños
revoke execute on function public.storage_usage(uuid) from authenticated;
revoke execute on function public.list_orphan_files(uuid) from authenticated;
