-- Orden manual de items (mayor = más arriba; los nuevos van al tope).

alter table public.list_items
  add column if not exists sort_order int not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by category_id
      order by created_at asc
    ) as rn
  from public.list_items
)
update public.list_items i
set sort_order = ranked.rn
from ranked
where i.id = ranked.id;

create index if not exists list_items_category_sort_idx
  on public.list_items (category_id, sort_order desc);
