-- =====================================================================
--  004 — Slugs reservados + verificación de disponibilidad
--  El catálogo vive en dominio.pe/{slug}, así que estas palabras
--  no pueden ser usadas como nombre de negocio.
-- =====================================================================

create or replace function public.is_reserved_slug(p_slug text)
returns boolean language sql immutable as $$
  select lower(p_slug) = any (array[
    'login','registro','registrarse','salir','logout','panel','admin','superadmin',
    'q','qr','api','app','assets','static','public','www','web','mail',
    'soporte','ayuda','contacto','terminos','privacidad','precios','planes',
    'blog','docs','status','pedido','pedidos','cotizacion','catalogo','c',
    'recuperar','reset','cuenta','perfil','config','configuracion'
  ]);
$$;

alter table public.tenants drop constraint if exists tenants_slug_check;
alter table public.tenants add constraint tenants_slug_check check (
  slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  and length(slug) between 3 and 40
  and not public.is_reserved_slug(slug)
);

-- Disponibilidad en vivo para el formulario de registro
create or replace function public.slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_slug) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and length(p_slug) between 3 and 40
     and not public.is_reserved_slug(p_slug)
     and not exists (select 1 from tenants where slug = lower(p_slug))
     and not exists (select 1 from slug_history where old_slug = lower(p_slug));
$$;

grant execute on function public.slug_available(text) to anon, authenticated;
