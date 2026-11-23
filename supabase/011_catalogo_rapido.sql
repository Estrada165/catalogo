-- =====================================================================
-- 011 · Catálogo en un solo viaje
-- Antes el catálogo hacía 2 tandas de consultas (negocio → todo lo demás).
-- Esta función devuelve todo junto, con las mismas reglas de acceso que las tablas.
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

create or replace function public.get_catalog(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t      tenants%rowtype;
  v_all    boolean;
  v_pop    jsonb := '[]';
  v_moved  text;
begin
  select * into v_t from tenants where slug = lower(p_slug);
  if not found then
    begin
      select resolve_slug(p_slug) into v_moved;
    exception when undefined_function then v_moved := null;
    end;
    if v_moved is not null and v_moved <> lower(p_slug) then
      return jsonb_build_object('state', 'moved', 'slug', v_moved);
    end if;
    return jsonb_build_object('state', 'none');
  end if;

  -- Mismas reglas que las tablas: el público ve negocios activos; el dueño y el superadmin, todo
  v_all := owns_tenant(v_t.id) or is_superadmin();
  if not (tenant_is_public(v_t.id) or v_all) then
    return jsonb_build_object('state', 'none');
  end if;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'score', x.score)), '[]')
      into v_pop from popular_products(v_t.slug, 8) x;
  exception when undefined_function then v_pop := '[]';
  end;

  return jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object('id', v_t.id, 'slug', v_t.slug, 'name', v_t.name, 'status', v_t.status, 'expires_at', v_t.expires_at),
    'config', (select to_jsonb(c) from tenant_config c where c.tenant_id = v_t.id),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort) from categories c where c.tenant_id = v_t.id and (c.visible or v_all)), '[]'),
    'products', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('product_variants', coalesce((
               select jsonb_agg(to_jsonb(v) order by v.sort) from product_variants v
                where v.product_id = p.id and (v.visible or v_all)), '[]')) order by p.sort)
        from products p where p.tenant_id = v_t.id and (p.visible or v_all)), '[]'),
    'zones', coalesce((select jsonb_agg(to_jsonb(z) order by z.sort) from delivery_zones z where z.tenant_id = v_t.id and (z.active or v_all)), '[]'),
    'faqs', coalesce((select jsonb_agg(to_jsonb(f) order by f.sort) from bot_faqs f where f.tenant_id = v_t.id and (f.active or v_all)), '[]'),
    'popular', v_pop
  );
end $$;

grant execute on function public.get_catalog(text) to anon, authenticated;
