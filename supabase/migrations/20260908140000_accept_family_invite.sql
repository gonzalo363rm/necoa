-- Accept a family invite by token (authenticated user whose email matches the invite).
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

  if invite_row.status <> 'pending' then
    raise exception 'Esta invitación ya no está pendiente';
  end if;

  if invite_row.expires_at <= now() then
    update public.family_invites set status = 'expired' where id = invite_row.id;
    raise exception 'Esta invitación expiró';
  end if;

  if lower(invite_row.email) <> user_email then
    raise exception 'Esta invitación fue enviada a otro email (%). Iniciá sesión con esa cuenta.', invite_row.email;
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

  select * into result_family from public.families where id = invite_row.family_id;
  return result_family;
end;
$$;

revoke all on function public.accept_family_invite(text) from public;
grant execute on function public.accept_family_invite(text) to authenticated;
