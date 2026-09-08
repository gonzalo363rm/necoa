-- Crea "Grupo Familiar" si el usuario aún no pertenece a ninguna familia.
create or replace function public.ensure_own_family()
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_family public.families;
  new_family public.families;
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

  select f.*
  into existing_family
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.user_id = uid
    and fm.status = 'active'
  order by fm.created_at asc
  limit 1;

  if found then
    return existing_family;
  end if;

  insert into public.families (name, created_by)
  values ('Grupo Familiar', uid)
  returning * into new_family;

  insert into public.family_members (family_id, user_id, role, status)
  values (new_family.id, uid, 'owner', 'active');

  insert into public.budget_goals (family_id, living_pct, comfort_pct, savings_pct)
  values (new_family.id, 40, 30, 30);

  return new_family;
end;
$$;

revoke all on function public.ensure_own_family() from public;
grant execute on function public.ensure_own_family() to authenticated;
