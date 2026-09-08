-- Necoa schema: families, tags, goals, transactions
create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner', 'member');
create type public.member_status as enum ('active', 'left');
create type public.invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.tag_category as enum ('living', 'comfort', 'other');
create type public.transaction_type as enum ('expense', 'income');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status public.invite_status not null default 'pending',
  invited_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create table public.budget_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families (id) on delete cascade,
  living_pct numeric(5,2) not null default 40 check (living_pct >= 0 and living_pct <= 100),
  comfort_pct numeric(5,2) not null default 30 check (comfort_pct >= 0 and comfort_pct <= 100),
  savings_pct numeric(5,2) not null default 30 check (savings_pct >= 0 and savings_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_goals_sum_100 check (living_pct + comfort_pct + savings_pct = 100)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  category public.tag_category not null default 'other',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tags_system_name_uidx on public.tags (name) where is_system = true and family_id is null;
create unique index tags_family_name_uidx on public.tags (family_id, name) where family_id is not null;

create table public.tag_overrides (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  name text,
  icon text,
  category public.tag_category,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, tag_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS',
  occurred_at date not null default (timezone('utc', now()))::date,
  paid_by uuid not null references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  tag_id uuid references public.tags (id),
  note text,
  installment_current int check (installment_current is null or installment_current >= 1),
  installment_total int check (installment_total is null or installment_total >= 1),
  category_override public.tag_category check (category_override is null or category_override in ('living', 'comfort')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_family_occurred_idx on public.transactions (family_id, occurred_at desc);
create index transactions_family_paid_by_idx on public.transactions (family_id, paid_by);
create index transactions_family_type_idx on public.transactions (family_id, type);
create index family_members_user_idx on public.family_members (user_id);
create index family_invites_email_idx on public.family_invites (lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger families_updated_at before update on public.families
  for each row execute function public.set_updated_at();
create trigger family_members_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();
create trigger family_invites_updated_at before update on public.family_invites
  for each row execute function public.set_updated_at();
create trigger budget_goals_updated_at before update on public.budget_goals
  for each row execute function public.set_updated_at();
create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();
create trigger tag_overrides_updated_at before update on public.tag_overrides
  for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.create_family_with_defaults(family_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family public.families;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url)
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.raw_user_meta_data->>'avatar_url'
  from auth.users u
  where u.id = uid
  on conflict (id) do nothing;

  insert into public.families (name, created_by)
  values (family_name, uid)
  returning * into new_family;

  insert into public.family_members (family_id, user_id, role, status)
  values (new_family.id, uid, 'owner', 'active');

  insert into public.budget_goals (family_id, living_pct, comfort_pct, savings_pct)
  values (new_family.id, 40, 30, 30);

  return new_family;
end;
$$;

insert into public.tags (name, icon, category, is_system, family_id) values
  ('Comida', 'utensils', 'living', true, null),
  ('Restaurante', 'utensils-crossed', 'comfort', true, null),
  ('Juegos', 'gamepad-2', 'comfort', true, null),
  ('Auto', 'car', 'living', true, null),
  ('Luz', 'zap', 'living', true, null),
  ('Gas', 'flame', 'living', true, null),
  ('Internet', 'wifi', 'living', true, null),
  ('Datos', 'smartphone', 'living', true, null),
  ('Otros', 'more-horizontal', 'other', true, null);

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.budget_goals enable row level security;
alter table public.tags enable row level security;
alter table public.tag_overrides enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "families_select_member" on public.families
  for select to authenticated using (public.is_family_member(id));
create policy "families_update_member" on public.families
  for update to authenticated using (public.is_family_member(id));

create policy "family_members_select" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));
create policy "family_members_insert_self" on public.family_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "family_invites_select" on public.family_invites
  for select to authenticated using (
    public.is_family_member(family_id) or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
create policy "family_invites_insert" on public.family_invites
  for insert to authenticated with check (public.is_family_member(family_id) and invited_by = auth.uid());
create policy "family_invites_update" on public.family_invites
  for update to authenticated using (public.is_family_member(family_id) or lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

create policy "budget_goals_select" on public.budget_goals
  for select to authenticated using (public.is_family_member(family_id));
create policy "budget_goals_update" on public.budget_goals
  for update to authenticated using (public.is_family_member(family_id));

create policy "tags_select" on public.tags
  for select to authenticated using (is_system = true or (family_id is not null and public.is_family_member(family_id)));
create policy "tags_insert_family" on public.tags
  for insert to authenticated with check (family_id is not null and public.is_family_member(family_id) and is_system = false);
create policy "tags_update_family" on public.tags
  for update to authenticated using (family_id is not null and public.is_family_member(family_id) and is_system = false);
create policy "tags_delete_family" on public.tags
  for delete to authenticated using (family_id is not null and public.is_family_member(family_id) and is_system = false);

create policy "tag_overrides_all" on public.tag_overrides
  for all to authenticated using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "transactions_select" on public.transactions
  for select to authenticated using (public.is_family_member(family_id));
create policy "transactions_insert" on public.transactions
  for insert to authenticated with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy "transactions_update" on public.transactions
  for update to authenticated using (public.is_family_member(family_id));
create policy "transactions_delete" on public.transactions
  for delete to authenticated using (public.is_family_member(family_id));
