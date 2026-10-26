-- Listas de recordatorios (compras/pagos) por familia y mes.

create table public.list_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  repeat_months int null check (repeat_months is null or repeat_months >= 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  category_id uuid not null references public.list_categories (id) on delete cascade,
  name text not null,
  repeat_mode text not null default 'inherit'
    check (repeat_mode in ('inherit', 'custom')),
  repeat_months int null check (repeat_months is null or repeat_months >= 1),
  start_month date not null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint list_items_start_month_first_day check (date_trunc('month', start_month)::date = start_month)
);

create table public.list_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  item_id uuid not null references public.list_items (id) on delete cascade,
  month date not null,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'skipped')),
  done_at timestamptz null,
  done_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint list_entries_month_first_day check (date_trunc('month', month)::date = month),
  constraint list_entries_item_month_unique unique (item_id, month)
);

create index list_categories_family_idx on public.list_categories (family_id);
create index list_items_family_idx on public.list_items (family_id);
create index list_items_category_idx on public.list_items (category_id);
create index list_entries_family_month_idx on public.list_entries (family_id, month);
create index list_entries_item_idx on public.list_entries (item_id);

alter table public.list_categories enable row level security;
alter table public.list_items enable row level security;
alter table public.list_entries enable row level security;

create policy "list_categories_all" on public.list_categories
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "list_items_all" on public.list_items
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "list_entries_all" on public.list_entries
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- Genera entradas del mes para items activos que tocan según su regla de repetición.
create or replace function public.ensure_list_entries(fid uuid, month_start date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m date := date_trunc('month', month_start)::date;
begin
  if not public.is_family_member(fid) then
    raise exception 'Not a family member';
  end if;

  insert into public.list_entries (family_id, item_id, month, status)
  select
    i.family_id,
    i.id,
    m,
    'pending'
  from public.list_items i
  join public.list_categories c on c.id = i.category_id
  where i.family_id = fid
    and i.archived_at is null
    and i.start_month <= m
    and (
      case
        when i.repeat_mode = 'custom' then i.repeat_months
        else c.repeat_months
      end
    ) is null
    and i.start_month = m

  union all

  select
    i.family_id,
    i.id,
    m,
    'pending'
  from public.list_items i
  join public.list_categories c on c.id = i.category_id
  where i.family_id = fid
    and i.archived_at is null
    and i.start_month <= m
    and (
      case
        when i.repeat_mode = 'custom' then i.repeat_months
        else c.repeat_months
      end
    ) is not null
    and mod(
      (extract(year from m)::int - extract(year from i.start_month)::int) * 12
        + (extract(month from m)::int - extract(month from i.start_month)::int),
      case
        when i.repeat_mode = 'custom' then i.repeat_months
        else c.repeat_months
      end
    ) = 0
  on conflict (item_id, month) do nothing;
end;
$$;

grant execute on function public.ensure_list_entries(uuid, date) to authenticated;
