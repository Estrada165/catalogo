-- =====================================================================
-- 009 · Precio del alquiler, ciclo y historial de renovaciones
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- 1) Precio y ciclo por negocio (el dueño los ve en su panel, no los puede cambiar)
alter table public.tenants add column if not exists price      numeric(10,2);
alter table public.tenants add column if not exists cycle_days int not null default 30;
do $$ begin
  alter table public.tenants add constraint tenants_cycle_days_check check (cycle_days between 1 and 366);
exception when duplicate_object then null; end $$;

create or replace function public.protect_tenant_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor / service role (tú desde Supabase): se permite
  if auth.uid() is not null and not public.is_superadmin() then
    new.status     := old.status;
    new.plan       := old.plan;
    new.expires_at := old.expires_at;
    new.owner_id   := old.owner_id;
    new.price      := old.price;
    new.cycle_days := old.cycle_days;
  end if;
  return new;
end $$;

-- 2) Historial: cada vez que sumas, quitas o cambias días (solo lo ve el superadmin)
create table if not exists public.tenant_renewals (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  kind        text not null default 'renovacion' check (kind in ('activacion','renovacion','ajuste')),
  days        int  not null default 0,
  amount      numeric(10,2),
  note        text,
  expires_before timestamptz,
  expires_after  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists tenant_renewals_tenant_idx on public.tenant_renewals(tenant_id, created_at desc);
alter table public.tenant_renewals enable row level security;
drop policy if exists "superadmin renovaciones" on public.tenant_renewals;
create policy "superadmin renovaciones" on public.tenant_renewals
  for all using (is_superadmin()) with check (is_superadmin());
grant select, insert, update, delete on public.tenant_renewals to authenticated;

-- 3) Mensaje de cobro (tú → el dueño) en los ajustes de la plataforma
update public.platform_settings
   set value = value || jsonb_build_object('mensaje_cobro',
     'Hola {dueño} 👋 Tu catálogo *{negocio}* vence el {vence} ({dias}). La renovación es de *{precio}* por {periodo} días. ¿Te lo renuevo? 🙌')
 where key = 'contacto' and not (value ? 'mensaje_cobro');
