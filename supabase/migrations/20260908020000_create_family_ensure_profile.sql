-- Ensure profile exists before creating a family (users who signed up before trigger)
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
