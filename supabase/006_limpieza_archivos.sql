-- =====================================================================
--  006 — Limpieza de archivos e imágenes
--  Encuentra archivos del bucket "catalog" que ya no usa ningún producto
--  ni la configuración del negocio. El borrado real lo hace el panel con la
--  API de Storage (Supabase no permite borrar archivos desde SQL).
--  Solo se consideran archivos con más de 24 horas, para no tocar subidas
--  en curso ni cambios que aún no se guardan.
-- =====================================================================

-- Todo lo que un negocio referencia (productos + configuración), como texto
create or replace function public.tenant_file_refs(p_tenant uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select string_agg(images::text, ' ') from products where tenant_id = p_tenant), '')
      || ' ' ||
         coalesce((select concat_ws(' ', business::text, bot::text, checkout::text, theme::text)
                     from tenant_config where tenant_id = p_tenant), '');
$$;
revoke execute on function public.tenant_file_refs(uuid) from anon, authenticated;

-- Uso de almacenamiento de un negocio
create or replace function public.storage_usage(p_tenant uuid)
returns table (files bigint, bytes bigint)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not (owns_tenant(p_tenant) or is_superadmin()) then raise exception 'Sin permiso'; end if;
  return query
    select count(*)::bigint, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
     where o.bucket_id = 'catalog' and (storage.foldername(o.name))[1] = p_tenant::text;
end $$;

-- Archivos sin usar de un negocio
create or replace function public.list_orphan_files(p_tenant uuid)
returns table (name text, bytes bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, storage as $$
declare v_refs text;
begin
  if not (owns_tenant(p_tenant) or is_superadmin()) then raise exception 'Sin permiso'; end if;
  v_refs := tenant_file_refs(p_tenant);
  return query
    select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
      from storage.objects o
     where o.bucket_id = 'catalog'
       and (storage.foldername(o.name))[1] = p_tenant::text
       and o.created_at < now() - interval '24 hours'
       and position(o.name in v_refs) = 0
     order by o.created_at;
end $$;

-- Superadmin: huérfanos de todos los negocios + carpetas de negocios eliminados
create or replace function public.list_orphan_files_all()
returns table (tenant_id text, name text, bytes bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not is_superadmin() then raise exception 'Sin permiso'; end if;
  return query
    with objs as (
      select o.name, (storage.foldername(o.name))[1] as folder,
             coalesce((o.metadata->>'size')::bigint, 0) as size, o.created_at
        from storage.objects o
       where o.bucket_id = 'catalog' and o.created_at < now() - interval '24 hours'
    ),
    refs as (
      select t.id::text as folder, tenant_file_refs(t.id) as blob from tenants t
    )
    select objs.folder, objs.name, objs.size, objs.created_at
      from objs
      left join refs on refs.folder = objs.folder
     where refs.folder is null                       -- el negocio ya no existe
        or position(objs.name in refs.blob) = 0       -- nadie lo usa
     order by objs.created_at;
end $$;

grant execute on function public.storage_usage(uuid) to authenticated;
grant execute on function public.list_orphan_files(uuid) to authenticated;
grant execute on function public.list_orphan_files_all() to authenticated;

-- El superadmin necesita poder borrar en cualquier carpeta del bucket
drop policy if exists "dueño borra su carpeta" on storage.objects;
create policy "dueño borra su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog'
         and (is_superadmin()
              or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                  and owns_tenant(((storage.foldername(name))[1])::uuid))));
