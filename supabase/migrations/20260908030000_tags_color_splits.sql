-- Tags: icon nullable + color; transaction splits multi-pagador; more system tags

alter table public.tags alter column icon drop not null;
alter table public.tags alter column icon drop default;
alter table public.tags add column if not exists color text;

alter table public.tag_overrides alter column icon drop not null;
alter table public.tag_overrides add column if not exists color text;

create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  share_pct numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  created_at timestamptz not null default now(),
  unique (transaction_id, user_id)
);

create index if not exists transaction_splits_user_idx on public.transaction_splits (user_id);
create index if not exists transaction_splits_tx_idx on public.transaction_splits (transaction_id);

alter table public.transaction_splits enable row level security;

create policy "transaction_splits_select" on public.transaction_splits
  for select to authenticated using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_family_member(t.family_id)
    )
  );
create policy "transaction_splits_insert" on public.transaction_splits
  for insert to authenticated with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_family_member(t.family_id)
    )
  );
create policy "transaction_splits_update" on public.transaction_splits
  for update to authenticated using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_family_member(t.family_id)
    )
  );
create policy "transaction_splits_delete" on public.transaction_splits
  for delete to authenticated using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_family_member(t.family_id)
    )
  );

insert into public.transaction_splits (transaction_id, user_id, share_pct)
select t.id, t.paid_by, 100
from public.transactions t
where not exists (
  select 1 from public.transaction_splits s where s.transaction_id = t.id
)
on conflict do nothing;

insert into public.tags (name, icon, category, is_system, family_id, color) values
  ('Alquiler', 'home', 'living', true, null, '#0D9488'),
  ('Expensas', 'building-2', 'living', true, null, '#14B8A6'),
  ('Agua', 'droplets', 'living', true, null, '#0284C7'),
  ('Salud', 'heart-pulse', 'living', true, null, '#DC2626'),
  ('Farmacia', 'pill', 'living', true, null, '#E11D48'),
  ('Educación', 'graduation-cap', 'living', true, null, '#7C3AED'),
  ('Transporte', 'bus', 'living', true, null, '#2563EB'),
  ('Nafta', 'fuel', 'living', true, null, '#1D4ED8'),
  ('Seguro', 'shield', 'living', true, null, '#4338CA'),
  ('Impuestos', 'landmark', 'living', true, null, '#334155'),
  ('Supermercado', 'shopping-cart', 'living', true, null, '#059669'),
  ('Verdulería', 'apple', 'living', true, null, '#16A34A'),
  ('Panadería', 'croissant', 'living', true, null, '#CA8A04'),
  ('Ropa', 'shirt', 'comfort', true, null, '#DB2777'),
  ('Streaming', 'tv', 'comfort', true, null, '#9333EA'),
  ('Salidas', 'party-popper', 'comfort', true, null, '#EA580C'),
  ('Café', 'coffee', 'comfort', true, null, '#A16207'),
  ('Delivery', 'bike', 'comfort', true, null, '#F97316'),
  ('Viajes', 'plane', 'comfort', true, null, '#0891B2'),
  ('Hotel', 'hotel', 'comfort', true, null, '#0E7490'),
  ('Gimnasio', 'dumbbell', 'comfort', true, null, '#65A30D'),
  ('Mascotas', 'paw-print', 'comfort', true, null, '#B45309'),
  ('Regalos', 'gift', 'comfort', true, null, '#C026D3'),
  ('Suscripciones', 'repeat', 'comfort', true, null, '#7E22CE'),
  ('Tecnología', 'laptop', 'comfort', true, null, '#475569'),
  ('Hogar', 'sofa', 'living', true, null, '#78716C'),
  ('Limpieza', 'sparkles', 'living', true, null, '#0F766E'),
  ('Peluquería', 'scissors', 'comfort', true, null, '#BE185D'),
  ('Parking', 'parking-circle', 'living', true, null, '#1E40AF'),
  ('Varios', 'circle-ellipsis', 'other', true, null, '#64748B')
on conflict do nothing;

update public.tags set color = coalesce(color, '#0D9488') where name = 'Comida' and is_system;
update public.tags set color = coalesce(color, '#D97706') where name = 'Restaurante' and is_system;
update public.tags set color = coalesce(color, '#7C3AED') where name = 'Juegos' and is_system;
update public.tags set color = coalesce(color, '#2563EB') where name = 'Auto' and is_system;
update public.tags set color = coalesce(color, '#CA8A04') where name = 'Luz' and is_system;
update public.tags set color = coalesce(color, '#EA580C') where name = 'Gas' and is_system;
update public.tags set color = coalesce(color, '#0284C7') where name = 'Internet' and is_system;
update public.tags set color = coalesce(color, '#6366F1') where name = 'Datos' and is_system;
update public.tags set color = coalesce(color, '#64748B') where name = 'Otros' and is_system;
