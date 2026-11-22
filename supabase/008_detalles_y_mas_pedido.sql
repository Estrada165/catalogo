-- =====================================================================
-- 008 · Detalles del producto y "Lo más pedido"
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- 1) Bloques de información extra por producto
--    [{ "kind": "incluye" | "atencion" | "pasos" | "nota", "title": "Incluye", "items": ["...", "..."] }]
alter table public.products
  add column if not exists details jsonb not null default '[]';

-- 2) Lo más pedido: pedidos reales de los últimos 60 días
--    (más un empujón por "agregado al carrito" de los últimos 30 días)
create or replace function public.popular_products(p_slug text, p_limit int default 8)
returns table (product_id uuid, score bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = lower(p_slug);
  if v_tid is null then return; end if;
  if not (tenant_is_public(v_tid) or owns_tenant(v_tid) or is_superadmin()) then return; end if;

  return query
    with sold as (
      select pv.product_id, count(distinct o.id) * 3 as pts
        from orders o
        cross join lateral jsonb_array_elements(o.items) it
        join product_variants pv on pv.id = nullif(it->>'variant_id','')::uuid
       where o.tenant_id = v_tid
         and o.status not in ('cancelado','no_concretado')
         and o.created_at > now() - interval '60 days'
       group by pv.product_id
    ),
    carts as (
      select e.product_id, count(distinct e.session_id) as pts
        from events e
       where e.tenant_id = v_tid and e.type = 'add_cart' and e.product_id is not null
         and e.created_at > now() - interval '30 days'
       group by e.product_id
    )
    select p.id, (coalesce(s.pts, 0) + coalesce(c.pts, 0))::bigint
      from products p
      left join sold s  on s.product_id = p.id
      left join carts c on c.product_id = p.id
     where p.tenant_id = v_tid and p.visible
       and coalesce(s.pts, 0) + coalesce(c.pts, 0) > 0
     order by 2 desc, p.sort
     limit least(greatest(coalesce(p_limit, 8), 1), 20);
end $$;

grant execute on function public.popular_products(text, int) to anon, authenticated;
