-- =====================================================================
--  CATÁLOGO MULTINEGOCIO — Esquema base (Fase 0)
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--  Proyecto Supabase NUEVO (no usar el del catálogo de streaming)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------
-- 1. PERFILES (rol de cada usuario que inicia sesión)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'owner' check (role in ('owner','superadmin')),
  created_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. PLANTILLAS DE RUBRO (las administra el superadmin)
-- ---------------------------------------------------------------------
create table public.rubro_templates (
  id               uuid primary key default gen_random_uuid(),
  key              text unique not null,           -- 'ferreteria', 'perfumeria'...
  name             text not null,
  description      text,
  config_base      jsonb not null default '{}',    -- theme, sections, modules, checkout, bot
  categories_base  jsonb not null default '[]',    -- ["Herramientas","Pinturas",...]
  faqs_base        jsonb not null default '[]',    -- [{question, keywords[], answer}]
  active           boolean not null default true,
  sort             int not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. NEGOCIOS (tenants)
-- ---------------------------------------------------------------------
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  slug          text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name          text not null,
  rubro_key     text references public.rubro_templates(key) on update cascade,
  status        text not null default 'pendiente' check (status in ('pendiente','activo','suspendido')),
  plan          text not null default 'basico',
  expires_at    timestamptz,
  order_prefix  text not null default 'PED' check (order_prefix ~ '^[A-Z0-9]{2,5}$'),
  order_seq     int  not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.tenants(owner_id);

-- Historial de slugs: si el dueño cambia su slug, los links viejos siguen funcionando
create table public.slug_history (
  old_slug    text primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  changed_at  timestamptz not null default now()
);

-- Configuración completa del catálogo (todo lo personalizable)
create table public.tenant_config (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  business    jsonb not null default '{}',  -- logo, descripción, whatsapp, dirección, redes, horario
  theme       jsonb not null default '{}',  -- estilo, acento, modo, tipografía
  sections    jsonb not null default '[]',  -- [{id, type, enabled, order, props}]
  modules     jsonb not null default '{}',  -- {stock:true, peso:false, delivery:true, ...}
  checkout    jsonb not null default '{}',  -- campos del checkout, métodos de pago, plantilla de mensaje
  bot         jsonb not null default '{}',  -- nombre, avatar, saludo, tono, activo
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. CATÁLOGO
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  icon        text,
  sort        int not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.categories(tenant_id, sort);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  description  text,
  images       jsonb not null default '[]',  -- [{full, thumb, w, h}]
  attributes   jsonb not null default '{}',  -- campos libres: marca, aroma, medida...
  tags         text[] not null default '{}', -- sinónimos/palabras clave (también los usa el bot)
  badge        text,                         -- 'Nuevo', 'Oferta', 'Más vendido'
  featured     boolean not null default false,
  visible      boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.products(tenant_id, category_id, sort);

create table public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  label         text not null default 'Único',  -- '1 mes', '100 ml', 'Grande', '1 kg'
  price         numeric(10,2),                  -- null = "precio a consultar"
  compare_price numeric(10,2),                  -- precio tachado
  stock         numeric(12,3),                  -- null = sin control de stock
  unit          text not null default 'und',    -- und, kg, g, l, ml, m, caja...
  min_qty       numeric(12,3) not null default 1,
  step          numeric(12,3) not null default 1, -- 0.25 para venta por peso
  sku           text,
  visible       boolean not null default true,
  sort          int not null default 0,
  check (min_qty > 0 and step > 0)
);
create index on public.product_variants(product_id, sort);

create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('porcentaje','monto','combo','cantidad','cupon')),
  rules       jsonb not null default '{}',
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  cost        numeric(10,2) not null default 0,
  sort        int not null default 0,
  active      boolean not null default true
);

-- ---------------------------------------------------------------------
-- 5. BOT LOCAL (sin IA): base de conocimiento del dueño
-- ---------------------------------------------------------------------
create table public.bot_faqs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  question    text not null,
  keywords    text[] not null default '{}',
  answer      text not null,
  active      boolean not null default true,
  sort        int not null default 0
);

-- Preguntas que el bot no supo responder → el dueño las ve y crea respuestas
create table public.bot_unanswered (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  question    text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.bot_unanswered(tenant_id, resolved, created_at desc);

-- ---------------------------------------------------------------------
-- 6. PEDIDOS (registro previo a WhatsApp)
-- ---------------------------------------------------------------------
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code           text not null,
  items          jsonb not null,            -- copia congelada de nombre, variante, precio, cantidad
  subtotal       numeric(10,2) not null default 0,
  delivery_cost  numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  has_quote_items boolean not null default false, -- algún ítem "a consultar"
  customer       jsonb not null default '{}', -- nombre, teléfono, entrega, zona, dirección, nota
  status         text not null default 'pendiente'
                 check (status in ('pendiente','confirmado','enviado','entregado','no_concretado','cancelado')),
  payment        jsonb,                      -- registro manual del dueño: {metodo, monto, fecha}
  session_id     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, code)
);
create index on public.orders(tenant_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- 7. QR Y ANALÍTICA
-- ---------------------------------------------------------------------
create table public.qr_codes (
  code        text primary key default substr(replace(gen_random_uuid()::text,'-',''),1,8),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  label       text not null default 'Principal',
  design      jsonb not null default '{}',   -- puntos, esquinas, colores, logo, formato
  created_at  timestamptz not null default now()
);

create table public.events (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  type        text not null check (type in
              ('visit','qr_scan','product_view','add_cart','checkout_open','order_sent','bot_message','search')),
  product_id  uuid,
  session_id  text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.events(tenant_id, created_at desc);
create index on public.events(tenant_id, type, created_at desc);

-- =====================================================================
-- 8. FUNCIONES DE AYUDA
-- =====================================================================
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin');
$$;

create or replace function public.owns_tenant(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenants where id = t and owner_id = auth.uid());
$$;

create or replace function public.tenant_is_public(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenants
                 where id = t and status = 'activo'
                   and (expires_at is null or expires_at > now()));
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_products_upd before update on public.products
  for each row execute function public.touch_updated_at();
create trigger trg_orders_upd before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger trg_config_upd before update on public.tenant_config
  for each row execute function public.touch_updated_at();

-- Guarda el slug anterior cuando cambia
create or replace function public.track_slug_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug <> old.slug then
    insert into slug_history(old_slug, tenant_id) values (old.slug, old.id)
    on conflict (old_slug) do update set tenant_id = excluded.tenant_id, changed_at = now();
  end if;
  return new;
end $$;
create trigger trg_slug_change after update of slug on public.tenants
  for each row execute function public.track_slug_change();

-- Evita que el dueño se cambie a sí mismo estado, plan o vencimiento
create or replace function public.protect_tenant_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor / service role (tú desde Supabase): se permite
  if auth.uid() is not null and not public.is_superadmin() then
    new.status     := old.status;
    new.plan       := old.plan;
    new.expires_at := old.expires_at;
    new.owner_id   := old.owner_id;
  end if;
  return new;
end $$;
create trigger trg_protect_tenant before update on public.tenants
  for each row execute function public.protect_tenant_fields();

-- Evita que un usuario se ponga rol superadmin
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_superadmin() then new.role := old.role; end if;
  return new;
end $$;
create trigger trg_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- =====================================================================
-- 9. RPC: CREAR MI NEGOCIO (copia la plantilla del rubro)
-- =====================================================================
create or replace function public.create_my_tenant(p_name text, p_slug text, p_rubro text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid;
  v_tpl rubro_templates%rowtype;
  v_cat text;
  v_i   int := 0;
  v_faq jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from tenants where owner_id = auth.uid()) then
    raise exception 'Ya tienes un negocio registrado';
  end if;
  if exists (select 1 from slug_history where old_slug = lower(p_slug)) then
    raise exception 'Ese enlace no está disponible';
  end if;

  select * into v_tpl from rubro_templates where key = p_rubro and active;
  if not found then raise exception 'Rubro no válido'; end if;

  insert into tenants(owner_id, slug, name, rubro_key)
  values (auth.uid(), lower(trim(p_slug)), trim(p_name), p_rubro)
  returning id into v_tid;

  insert into tenant_config(tenant_id, business, theme, sections, modules, checkout, bot)
  values (v_tid,
          jsonb_build_object('name', trim(p_name)),
          coalesce(v_tpl.config_base->'theme',    '{}'),
          coalesce(v_tpl.config_base->'sections', '[]'),
          coalesce(v_tpl.config_base->'modules',  '{}'),
          coalesce(v_tpl.config_base->'checkout', '{}'),
          coalesce(v_tpl.config_base->'bot',      '{}'));

  for v_cat in select jsonb_array_elements_text(v_tpl.categories_base) loop
    insert into categories(tenant_id, name, sort) values (v_tid, v_cat, v_i);
    v_i := v_i + 1;
  end loop;

  v_i := 0;
  for v_faq in select * from jsonb_array_elements(v_tpl.faqs_base) loop
    insert into bot_faqs(tenant_id, question, keywords, answer, sort)
    values (v_tid, v_faq->>'question',
            array(select jsonb_array_elements_text(coalesce(v_faq->'keywords','[]'))),
            v_faq->>'answer', v_i);
    v_i := v_i + 1;
  end loop;

  insert into qr_codes(tenant_id) values (v_tid);
  return v_tid;
end $$;

-- =====================================================================
-- 10. RPC PÚBLICAS (catálogo, sin sesión)
-- =====================================================================

-- Resuelve un slug (incluye slugs antiguos) → slug actual
create or replace function public.resolve_slug(p_slug text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select slug from tenants where slug = lower(p_slug)),
    (select t.slug from slug_history h join tenants t on t.id = h.tenant_id where h.old_slug = lower(p_slug))
  );
$$;

-- Resuelve un QR → slug actual
create or replace function public.resolve_qr(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select t.slug from qr_codes q join tenants t on t.id = q.tenant_id where q.code = p_code;
$$;

-- Registrar evento de analítica
create or replace function public.track_event(
  p_slug text, p_type text, p_session text, p_product uuid default null, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = lower(p_slug);
  if v_tid is null or not tenant_is_public(v_tid) then return; end if;
  if length(coalesce(p_session,'')) > 64 then return; end if;
  -- máx. 300 eventos por sesión por hora
  if (select count(*) from events where session_id = p_session
        and created_at > now() - interval '1 hour') > 300 then return; end if;
  insert into events(tenant_id, type, product_id, session_id, meta)
  values (v_tid, p_type, p_product, p_session, coalesce(p_meta,'{}'));
exception when check_violation then return;
end $$;

-- Pregunta sin respuesta del bot
create or replace function public.log_unanswered(p_slug text, p_question text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = lower(p_slug);
  if v_tid is null or not tenant_is_public(v_tid) then return; end if;
  if length(trim(p_question)) < 3 or length(p_question) > 300 then return; end if;
  -- no repetir la misma pregunta en 24 h
  if exists (select 1 from bot_unanswered where tenant_id = v_tid
             and lower(question) = lower(trim(p_question))
             and created_at > now() - interval '24 hours') then return; end if;
  insert into bot_unanswered(tenant_id, question) values (v_tid, trim(p_question));
end $$;

-- Crear pedido: recalcula precios desde la BD (el navegador no decide el total)
-- p_items: [{"variant_id":"...","qty":2}]
-- p_customer: {"name":"","phone":"","delivery":"delivery|recojo","zone_id":"","address":"","note":""}
create or replace function public.create_order(
  p_slug text, p_items jsonb, p_customer jsonb, p_session text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t        tenants%rowtype;
  v_mod      jsonb;
  v_item     jsonb;
  v_var      record;
  v_qty      numeric;
  v_lines    jsonb := '[]';
  v_subtotal numeric := 0;
  v_quote    boolean := false;
  v_delivery numeric := 0;
  v_zone     record;
  v_code     text;
  v_seq      int;
begin
  select * into v_t from tenants where slug = lower(p_slug);
  if not found or not tenant_is_public(v_t.id) then raise exception 'Catálogo no disponible'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 60 then
    raise exception 'Carrito inválido';
  end if;

  -- anti-spam: máx. 5 pedidos por sesión cada 10 min
  if (select count(*) from orders where tenant_id = v_t.id and session_id = p_session
        and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados pedidos seguidos, espera unos minutos';
  end if;

  select modules into v_mod from tenant_config where tenant_id = v_t.id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::numeric;

    select pv.*, p.name as product_name
      into v_var
      from product_variants pv join products p on p.id = pv.product_id
     where pv.id = (v_item->>'variant_id')::uuid
       and pv.tenant_id = v_t.id and pv.visible and p.visible;
    if not found then raise exception 'Producto no disponible'; end if;

    if v_qty is null or v_qty < v_var.min_qty or v_qty > 100000 then
      raise exception 'Cantidad inválida para %', v_var.product_name;
    end if;

    if coalesce((v_mod->>'stock')::boolean, false) and v_var.stock is not null and v_qty > v_var.stock then
      raise exception 'Stock insuficiente para %', v_var.product_name;
    end if;

    if v_var.price is null then v_quote := true; end if;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_var.id,
      'product',    v_var.product_name,
      'variant',    v_var.label,
      'unit',       v_var.unit,
      'qty',        v_qty,
      'price',      v_var.price,
      'line_total', case when v_var.price is null then null else round(v_var.price * v_qty, 2) end
    );
    v_subtotal := v_subtotal + coalesce(v_var.price * v_qty, 0);
  end loop;

  if coalesce((v_mod->>'delivery')::boolean, false)
     and p_customer->>'delivery' = 'delivery'
     and nullif(p_customer->>'zone_id','') is not null then
    select * into v_zone from delivery_zones
     where id = (p_customer->>'zone_id')::uuid and tenant_id = v_t.id and active;
    if found then
      v_delivery := v_zone.cost;
      p_customer := p_customer || jsonb_build_object('zone_name', v_zone.name);
    end if;
  end if;

  update tenants set order_seq = order_seq + 1 where id = v_t.id returning order_seq into v_seq;
  v_code := v_t.order_prefix || '-' || lpad(v_seq::text, 4, '0');

  insert into orders(tenant_id, code, items, subtotal, delivery_cost, total, has_quote_items, customer, session_id)
  values (v_t.id, v_code, v_lines, round(v_subtotal,2), v_delivery,
          round(v_subtotal + v_delivery, 2), v_quote,
          jsonb_strip_nulls(jsonb_build_object(
            'name',     left(p_customer->>'name', 80),
            'phone',    left(p_customer->>'phone', 20),
            'delivery', left(p_customer->>'delivery', 20),
            'zone_id',  p_customer->>'zone_id',
            'zone_name',p_customer->>'zone_name',
            'address',  left(p_customer->>'address', 200),
            'note',     left(p_customer->>'note', 300))),
          left(p_session, 64));

  insert into events(tenant_id, type, session_id, meta)
  values (v_t.id, 'order_sent', left(p_session,64), jsonb_build_object('code', v_code));

  return jsonb_build_object(
    'code', v_code, 'items', v_lines,
    'subtotal', round(v_subtotal,2), 'delivery', v_delivery,
    'total', round(v_subtotal + v_delivery,2), 'has_quote_items', v_quote);
end $$;

-- Pedidos pendientes > 48 h pasan a "no concretado" (llamar con pg_cron o desde el panel)
create or replace function public.expire_pending_orders()
returns int language sql security definer set search_path = public as $$
  with u as (
    update orders set status = 'no_concretado'
     where status = 'pendiente' and created_at < now() - interval '48 hours'
    returning 1)
  select count(*)::int from u;
$$;

-- Limpieza de analítica: borra eventos de más de 90 días
create or replace function public.purge_old_events()
returns int language sql security definer set search_path = public as $$
  with d as (delete from events where created_at < now() - interval '90 days' returning 1)
  select count(*)::int from d;
$$;

-- Permisos de ejecución
revoke execute on function public.expire_pending_orders() from anon, authenticated;
revoke execute on function public.purge_old_events()      from anon, authenticated;
grant  execute on function public.create_order(text,jsonb,jsonb,text)          to anon, authenticated;
grant  execute on function public.track_event(text,text,text,uuid,jsonb)       to anon, authenticated;
grant  execute on function public.log_unanswered(text,text)                    to anon, authenticated;
grant  execute on function public.resolve_slug(text)                           to anon, authenticated;
grant  execute on function public.resolve_qr(text)                             to anon, authenticated;
revoke execute on function public.create_my_tenant(text,text,text) from anon;
grant  execute on function public.create_my_tenant(text,text,text) to authenticated;

-- =====================================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.rubro_templates  enable row level security;
alter table public.tenants          enable row level security;
alter table public.slug_history     enable row level security;
alter table public.tenant_config    enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.promotions       enable row level security;
alter table public.delivery_zones   enable row level security;
alter table public.bot_faqs         enable row level security;
alter table public.bot_unanswered   enable row level security;
alter table public.orders           enable row level security;
alter table public.qr_codes         enable row level security;
alter table public.events           enable row level security;

-- profiles
create policy "perfil propio o superadmin" on public.profiles
  for select using (id = auth.uid() or is_superadmin());
create policy "editar perfil propio" on public.profiles
  for update using (id = auth.uid() or is_superadmin());

-- rubro_templates: todos leen las activas; solo superadmin edita
create policy "leer plantillas" on public.rubro_templates
  for select using (active or is_superadmin());
create policy "superadmin plantillas" on public.rubro_templates
  for all using (is_superadmin()) with check (is_superadmin());

-- tenants
create policy "leer negocio" on public.tenants
  for select using (tenant_is_public(id) or owner_id = auth.uid() or is_superadmin());
create policy "dueño edita su negocio" on public.tenants
  for update using (owner_id = auth.uid() or is_superadmin());
create policy "superadmin borra" on public.tenants
  for delete using (is_superadmin());
-- (insert solo vía create_my_tenant)

create policy "superadmin slug_history" on public.slug_history
  for select using (is_superadmin());

-- Tablas del catálogo: público lee lo visible de negocios activos; dueño y superadmin todo
-- tenant_config
create policy "publico config" on public.tenant_config
  for select using (tenant_is_public(tenant_id) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño config" on public.tenant_config
  for update using (owns_tenant(tenant_id) or is_superadmin());

-- categories
create policy "publico categorias" on public.categories
  for select using ((visible and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño categorias" on public.categories
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- products
create policy "publico productos" on public.products
  for select using ((visible and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño productos" on public.products
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- product_variants
create policy "publico variantes" on public.product_variants
  for select using ((visible and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño variantes" on public.product_variants
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- promotions
create policy "publico promos" on public.promotions
  for select using ((active and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño promos" on public.promotions
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- delivery_zones
create policy "publico zonas" on public.delivery_zones
  for select using ((active and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño zonas" on public.delivery_zones
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- bot_faqs
create policy "publico faqs" on public.bot_faqs
  for select using ((active and tenant_is_public(tenant_id)) or owns_tenant(tenant_id) or is_superadmin());
create policy "dueño faqs" on public.bot_faqs
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- bot_unanswered (solo dueño; el público inserta vía RPC)
create policy "dueño sin respuesta" on public.bot_unanswered
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- orders (solo dueño; el público crea vía RPC)
create policy "dueño pedidos" on public.orders
  for select using (owns_tenant(tenant_id) or is_superadmin());
create policy "dueño actualiza pedidos" on public.orders
  for update using (owns_tenant(tenant_id) or is_superadmin());
create policy "dueño borra pedidos" on public.orders
  for delete using (owns_tenant(tenant_id) or is_superadmin());

-- qr_codes
create policy "dueño qr" on public.qr_codes
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

-- events (solo lectura del dueño; el público inserta vía RPC)
create policy "dueño eventos" on public.events
  for select using (owns_tenant(tenant_id) or is_superadmin());

-- =====================================================================
-- 12. STORAGE: bucket público de imágenes, escritura solo en su carpeta
--     Ruta obligatoria: {tenant_id}/products/archivo.webp
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 1048576,  -- 1 MB máx. (ya llegan comprimidas)
        array['image/webp','image/png','image/jpeg','image/svg+xml'])
on conflict (id) do nothing;

create policy "leer imagenes catalogo" on storage.objects
  for select using (bucket_id = 'catalog');
create policy "dueño sube a su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog'
              and (owns_tenant(((storage.foldername(name))[1])::uuid) or is_superadmin()));
create policy "dueño edita su carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog'
         and (owns_tenant(((storage.foldername(name))[1])::uuid) or is_superadmin()));
create policy "dueño borra su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog'
         and (owns_tenant(((storage.foldername(name))[1])::uuid) or is_superadmin()));

-- =====================================================================
-- 13. VISTAS DE ANALÍTICA (respetan RLS del que consulta)
-- =====================================================================
create or replace view public.v_daily_stats with (security_invoker = true) as
select tenant_id,
       date_trunc('day', created_at at time zone 'America/Lima')::date as day,
       count(*) filter (where type = 'visit')         as visits,
       count(*) filter (where type = 'qr_scan')       as qr_scans,
       count(*) filter (where type = 'product_view')  as product_views,
       count(*) filter (where type = 'add_cart')      as add_cart,
       count(*) filter (where type = 'order_sent')    as orders_sent,
       count(distinct session_id)                     as sessions
  from public.events
 group by 1, 2;

create or replace view public.v_top_products with (security_invoker = true) as
select e.tenant_id, e.product_id, p.name,
       count(*) filter (where e.type = 'product_view') as views,
       count(*) filter (where e.type = 'add_cart')     as adds
  from public.events e
  join public.products p on p.id = e.product_id
 where e.created_at > now() - interval '30 days'
 group by 1, 2, 3;

create or replace view public.v_peak_hours with (security_invoker = true) as
select tenant_id,
       extract(hour from created_at at time zone 'America/Lima')::int as hour,
       count(*) as visits
  from public.events
 where type = 'visit' and created_at > now() - interval '30 days'
 group by 1, 2;
