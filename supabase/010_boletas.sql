-- =====================================================================
-- 010 · Boletas (notas de venta internas, sin valor tributario)
-- Numeración correlativa por negocio y serie: NV01-000001, NV01-000002…
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

create table if not exists public.receipts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  series         text not null default 'NV01',
  number         int  not null default 0,
  code           text not null default '',
  order_id       uuid references public.orders(id) on delete set null,
  customer       jsonb not null default '{}',   -- name, doc_type, doc_number, phone, address
  items          jsonb not null default '[]',   -- [{ description, qty, unit, unit_price, discount }]
  discount_type  text not null default 'amount' check (discount_type in ('amount','percent')),
  discount_value numeric(10,2) not null default 0,
  igv            boolean not null default false,
  igv_rate       numeric(5,2) not null default 18,
  subtotal       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  taxable        numeric(12,2) not null default 0,
  igv_amount     numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  currency       text not null default 'PEN',
  payment_method text,
  notes          text,
  status         text not null default 'emitida' check (status in ('emitida','anulada')),
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists receipts_tenant_idx on public.receipts(tenant_id, issued_at desc);
create index if not exists receipts_order_idx on public.receipts(order_id);
create unique index if not exists receipts_code_uq on public.receipts(tenant_id, series, number);

-- Correlativo por negocio y serie (a prueba de dos boletas al mismo tiempo)
create table if not exists public.receipt_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  series    text not null,
  last      int  not null default 0,
  primary key (tenant_id, series)
);
alter table public.receipt_counters enable row level security;

create or replace function public.receipts_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_next int;
begin
  new.series := upper(coalesce(nullif(regexp_replace(new.series, '[^A-Za-z0-9]', '', 'g'), ''), 'NV01'));
  new.series := left(new.series, 4);
  insert into receipt_counters (tenant_id, series, last) values (new.tenant_id, new.series, 1)
  on conflict (tenant_id, series) do update set last = receipt_counters.last + 1
  returning last into v_next;
  new.number := v_next;
  new.code := new.series || '-' || lpad(v_next::text, 6, '0');
  return new;
end $$;

drop trigger if exists receipts_number on public.receipts;
create trigger receipts_number before insert on public.receipts
  for each row execute function public.receipts_before_insert();

-- El número y el negocio no se cambian después de emitida
create or replace function public.receipts_before_update()
returns trigger language plpgsql as $$
begin
  new.tenant_id := old.tenant_id;
  new.series := old.series;
  new.number := old.number;
  new.code := old.code;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists receipts_lock on public.receipts;
create trigger receipts_lock before update on public.receipts
  for each row execute function public.receipts_before_update();

alter table public.receipts enable row level security;
drop policy if exists "dueño boletas" on public.receipts;
create policy "dueño boletas" on public.receipts
  for all using (owns_tenant(tenant_id) or is_superadmin())
  with check (owns_tenant(tenant_id) or is_superadmin());

grant select, insert, update, delete on public.receipts to authenticated;
