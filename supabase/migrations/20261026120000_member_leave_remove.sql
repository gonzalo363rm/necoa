-- Leave / remove members without deleting family data.
-- Memberships go to status = 'left'; re-inviting reactivates them.

create or replace function public.leave_family(fid uuid, new_owner_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_role public.member_role;
  other_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select role
  into my_role
  from public.family_members
  where family_id = fid
    and user_id = uid
    and status = 'active';

  if not found then
    raise exception 'No sos miembro activo de este grupo';
  end if;

  if my_role = 'owner' then
    select count(*)::int
    into other_count
    from public.family_members
    where family_id = fid
      and user_id <> uid
      and status = 'active';

    if other_count > 0 then
      if new_owner_id is null then
        raise exception 'Elegí a quién pasarle el grupo';
      end if;

      if new_owner_id = uid then
        raise exception 'Elegí a otro miembro del grupo';
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
          status = 'left',
          updated_at = now()
      where family_id = fid
        and user_id = uid;
    else
      -- Solo en el grupo: no tiene sentido salir
      raise exception 'Sos el único miembro del grupo';
    end if;
  else
    update public.family_members
    set status = 'left',
        updated_at = now()
    where family_id = fid
      and user_id = uid;
  end if;
end;
$$;

revoke all on function public.leave_family(uuid, uuid) from public;
grant execute on function public.leave_family(uuid, uuid) to authenticated;

create or replace function public.remove_family_member(fid uuid, member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if member_user_id is null or member_user_id = uid then
    raise exception 'No podés eliminarte a vos mismo';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = uid
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Solo el creador puede eliminar miembros';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = member_user_id
      and status = 'active'
  ) then
    raise exception 'Ese miembro no está activo en el grupo';
  end if;

  update public.family_members
  set status = 'left',
      updated_at = now()
  where family_id = fid
    and user_id = member_user_id;

  select lower(email)
  into target_email
  from public.profiles
  where id = member_user_id;

  if target_email is not null and target_email <> '' then
    update public.family_invites
    set status = 'revoked',
        updated_at = now()
    where family_id = fid
      and lower(email) = target_email
      and status = 'pending';
  end if;
end;
$$;

revoke all on function public.remove_family_member(uuid, uuid) from public;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;

-- Accept invite: soft-leave other families; never delete families/data.
create or replace function public.accept_family_invite(invite_token text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite_row public.family_invites;
  user_email text;
  result_family public.families;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if invite_token is null or length(trim(invite_token)) = 0 then
    raise exception 'Invite token required';
  end if;

  select lower(coalesce(u.email, ''))
  into user_email
  from auth.users u
  where u.id = uid;

  if user_email is null or user_email = '' then
    raise exception 'User email not found';
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

  select *
  into invite_row
  from public.family_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invitación no encontrada';
  end if;

  if lower(invite_row.email) <> user_email then
    raise exception 'Esta invitación fue enviada a otro email (%). Iniciá sesión con esa cuenta.', invite_row.email;
  end if;

  if invite_row.status = 'accepted' then
    if exists (
      select 1 from public.family_members
      where family_id = invite_row.family_id
        and user_id = uid
        and status = 'active'
    ) then
      update public.family_members
      set status = 'left',
          updated_at = now()
      where user_id = uid
        and family_id <> invite_row.family_id
        and status = 'active';

      select * into result_family from public.families where id = invite_row.family_id;
      return result_family;
    end if;
    raise exception 'Esta invitación ya no está pendiente';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'Esta invitación ya no está pendiente';
  end if;

  if invite_row.expires_at <= now() then
    update public.family_invites set status = 'expired' where id = invite_row.id;
    raise exception 'Esta invitación expiró';
  end if;

  insert into public.family_members (family_id, user_id, role, status)
  values (invite_row.family_id, uid, 'member', 'active')
  on conflict (family_id, user_id) do update
    set status = 'active',
        -- Si ya fue owner y salió, al reinvitar vuelve como member
        role = 'member',
        updated_at = now();

  update public.family_invites
  set status = 'accepted',
      updated_at = now()
  where id = invite_row.id;

  -- Soft-leave other active memberships; keep personal groups dormant
  update public.family_members
  set status = 'left',
      updated_at = now()
  where user_id = uid
    and family_id <> invite_row.family_id
    and status = 'active';

  select * into result_family from public.families where id = invite_row.family_id;
  return result_family;
end;
$$;

-- Prefer reactivating a dormant personal family over creating a new one.
create or replace function public.ensure_own_family()
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_family public.families;
  dormant_family public.families;
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

  -- Reactivate newest personal dormant family (created by me, no other active members)
  select f.*
  into dormant_family
  from public.families f
  join public.family_members fm
    on fm.family_id = f.id
   and fm.user_id = uid
   and fm.status = 'left'
  where f.created_by = uid
    and not exists (
      select 1
      from public.family_members other
      where other.family_id = f.id
        and other.status = 'active'
    )
  order by f.updated_at desc, f.created_at desc
  limit 1;

  if found then
    update public.family_members
    set status = 'active',
        role = 'owner',
        updated_at = now()
    where family_id = dormant_family.id
      and user_id = uid;

    return dormant_family;
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
