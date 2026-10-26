-- Transfer ownership without leaving the family.
create or replace function public.transfer_family_ownership(fid uuid, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if new_owner_id is null or new_owner_id = uid then
    raise exception 'Elegí a otro miembro del grupo';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = uid
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Solo el creador puede pasar el grupo';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = new_owner_id
      and status = 'active'
  ) then
    raise exception 'Elegí a un miembro activo del grupo';
  end if;

  update public.family_members
  set role = 'owner',
      updated_at = now()
  where family_id = fid
    and user_id = new_owner_id;

  update public.family_members
  set role = 'member',
      updated_at = now()
  where family_id = fid
    and user_id = uid;
end;
$$;

revoke all on function public.transfer_family_ownership(uuid, uuid) from public;
grant execute on function public.transfer_family_ownership(uuid, uuid) to authenticated;
