-- Accepting an invite while owning another family with active members
-- requires choosing who takes over that family.

create or replace function public.invite_owner_handoff_candidates(invite_token text)
returns table (family_id uuid, family_name text, user_id uuid, display_name text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite_row public.family_invites;
  user_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(coalesce(u.email, '')) into user_email from auth.users u where u.id = uid;

  select * into invite_row from public.family_invites where token = invite_token;
  if not found or lower(invite_row.email) <> user_email then
    raise exception 'Invitación no encontrada';
  end if;

  return query
  select f.id, f.name, other.user_id, p.display_name, p.email
  from public.family_members mine
  join public.families f on f.id = mine.family_id
  join public.family_members other
    on other.family_id = mine.family_id
   and other.user_id <> uid
   and other.status = 'active'
  left join public.profiles p on p.id = other.user_id
  where mine.user_id = uid
    and mine.status = 'active'
    and mine.role = 'owner'
    and mine.family_id <> invite_row.family_id
  order by f.name, other.created_at;
end;
$$;

revoke all on function public.invite_owner_handoff_candidates(text) from public;
grant execute on function public.invite_owner_handoff_candidates(text) to authenticated;

-- Internal: hand off ownership of every other family uid owns, then soft-leave them.
create or replace function public.leave_other_families(uid uuid, keep_family_id uuid, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owned record;
begin
  for owned in
    select mine.family_id
    from public.family_members mine
    where mine.user_id = uid
      and mine.status = 'active'
      and mine.role = 'owner'
      and mine.family_id <> keep_family_id
      and exists (
        select 1 from public.family_members other
        where other.family_id = mine.family_id
          and other.user_id <> uid
          and other.status = 'active'
      )
  loop
    if new_owner_id is null or not exists (
      select 1 from public.family_members cand
      where cand.family_id = owned.family_id
        and cand.user_id = new_owner_id
        and cand.user_id <> uid
        and cand.status = 'active'
    ) then
      raise exception 'OWNER_HANDOFF_REQUIRED: Elegí quién queda a cargo de tu grupo actual';
    end if;

    update public.family_members
    set role = 'owner', updated_at = now()
    where family_id = owned.family_id
      and user_id = new_owner_id;

    update public.family_members
    set role = 'member', updated_at = now()
    where family_id = owned.family_id
      and user_id = uid;
  end loop;

  update public.family_members
  set status = 'left', updated_at = now()
  where user_id = uid
    and family_id <> keep_family_id
    and status = 'active';
end;
$$;

revoke all on function public.leave_other_families(uuid, uuid, uuid) from public;
revoke all on function public.leave_other_families(uuid, uuid, uuid) from anon, authenticated;

drop function if exists public.accept_family_invite(text);

create or replace function public.accept_family_invite(invite_token text, new_owner_id uuid default null)
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
      perform public.leave_other_families(uid, invite_row.family_id, new_owner_id);
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

  -- Runs first so a missing successor aborts before joining
  perform public.leave_other_families(uid, invite_row.family_id, new_owner_id);

  insert into public.family_members (family_id, user_id, role, status)
  values (invite_row.family_id, uid, 'member', 'active')
  on conflict (family_id, user_id) do update
    set status = 'active',
        role = 'member',
        updated_at = now();

  update public.family_invites
  set status = 'accepted',
      updated_at = now()
  where id = invite_row.id;

  select * into result_family from public.families where id = invite_row.family_id;
  return result_family;
end;
$$;

revoke all on function public.accept_family_invite(text, uuid) from public;
grant execute on function public.accept_family_invite(text, uuid) to authenticated;
