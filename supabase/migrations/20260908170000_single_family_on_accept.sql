-- Un solo grupo por usuario: al aceptar invite, salir de los demás y borrar huérfanos.
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
      -- Consolidar: quedarse solo en este grupo
      delete from public.family_members
      where user_id = uid
        and family_id <> invite_row.family_id;

      delete from public.families f
      where not exists (
        select 1 from public.family_members fm
        where fm.family_id = f.id and fm.status = 'active'
      );

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
        updated_at = now();

  update public.family_invites
  set status = 'accepted',
      updated_at = now()
  where id = invite_row.id;

  -- Un usuario = un grupo: salir de cualquier otro
  delete from public.family_members
  where user_id = uid
    and family_id <> invite_row.family_id;

  delete from public.families f
  where not exists (
    select 1 from public.family_members fm
    where fm.family_id = f.id and fm.status = 'active'
  );

  select * into result_family from public.families where id = invite_row.family_id;
  return result_family;
end;
$$;
