begin;

-- =========================================================
-- HATCHED COMPANION ROSTER
-- =========================================================
-- Stores every actual companion instance a user hatches.
-- user_companion_progress remains the active-companion
-- progression record used by missions, food, HP and Bond.
-- =========================================================

create table if not exists private.user_hatched_companions (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  instance_id text not null,
  companion_id text not null,
  egg_id text not null,

  hatched_at timestamptz not null,
  created_at timestamptz not null default now(),

  primary key (user_id, instance_id)
);

create index if not exists
  user_hatched_companions_user_companion_idx
on private.user_hatched_companions (
  user_id,
  companion_id
);


-- =========================================================
-- REGISTER A REAL HATCH
-- =========================================================
-- The authenticated user is derived from auth.uid().
-- The client never supplies another user's id.
--
-- The FIRST registered hatch becomes active automatically.
-- Later hatches are added to the roster without replacing
-- the currently active companion.
-- =========================================================

create or replace function public.server_register_hatched_companion(
  p_instance_id text,
  p_companion_id text,
  p_egg_id text,
  p_hatched_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config private.companion_reward_config%rowtype;
  v_active_companion_id text;
begin
  if v_user_id is null then
    raise exception using
      message = 'UNAUTHORIZED',
      errcode = '42501';
  end if;

  if p_instance_id is null
     or btrim(p_instance_id) = ''
     or p_companion_id is null
     or btrim(p_companion_id) = ''
     or p_egg_id is null
     or btrim(p_egg_id) = ''
  then
    raise exception using
      message = 'INVALID_COMPANION_HATCH',
      errcode = '22023';
  end if;

  insert into private.user_hatched_companions (
    user_id,
    instance_id,
    companion_id,
    egg_id,
    hatched_at
  )
  values (
    v_user_id,
    p_instance_id,
    p_companion_id,
    p_egg_id,
    coalesce(p_hatched_at, clock_timestamp())
  )
  on conflict (user_id, instance_id)
  do nothing;

  select *
  into strict v_config
  from private.companion_reward_config
  where singleton;

  -- Create companion progress if the user does not have it.
  -- If the row already exists but has no active companion,
  -- make this hatch active.
  insert into private.user_companion_progress (
    user_id,
    companion_id,
    energy
  )
  values (
    v_user_id,
    p_companion_id,
    v_config.maximum_energy
  )
  on conflict (user_id)
  do update
  set
    companion_id = coalesce(
      private.user_companion_progress.companion_id,
      excluded.companion_id
    ),
    updated_at = clock_timestamp();

  select companion_id
  into v_active_companion_id
  from private.user_companion_progress
  where user_id = v_user_id;

  return jsonb_build_object(
    'registered', true,
    'instanceId', p_instance_id,
    'companionId', p_companion_id,
    'activeCompanionId', v_active_companion_id
  );
end;
$$;


-- =========================================================
-- SELECT AN OWNED COMPANION
-- =========================================================
-- Only an instance that the authenticated user actually
-- owns in user_hatched_companions may be activated.
-- =========================================================

create or replace function public.server_set_active_companion(
  p_instance_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_companion_id text;
  v_config private.companion_reward_config%rowtype;
begin
  if v_user_id is null then
    raise exception using
      message = 'UNAUTHORIZED',
      errcode = '42501';
  end if;

  select companion_id
  into v_companion_id
  from private.user_hatched_companions
  where user_id = v_user_id
    and instance_id = p_instance_id;

  if not found then
    raise exception using
      message = 'COMPANION_NOT_OWNED',
      errcode = '42501';
  end if;

  select *
  into strict v_config
  from private.companion_reward_config
  where singleton;

  insert into private.user_companion_progress (
    user_id,
    companion_id,
    energy
  )
  values (
    v_user_id,
    v_companion_id,
    v_config.maximum_energy
  )
  on conflict (user_id)
  do update
  set
    companion_id = excluded.companion_id,
    updated_at = clock_timestamp();

  return jsonb_build_object(
    'active', true,
    'instanceId', p_instance_id,
    'companionId', v_companion_id
  );
end;
$$;


-- =========================================================
-- SECURITY
-- =========================================================

revoke all
on function public.server_register_hatched_companion(
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.server_register_hatched_companion(
  text,
  text,
  text,
  timestamptz
)
to authenticated;


revoke all
on function public.server_set_active_companion(text)
from public, anon;

grant execute
on function public.server_set_active_companion(text)
to authenticated;

commit;
