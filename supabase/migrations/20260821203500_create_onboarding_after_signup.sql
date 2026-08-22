-- ============================================================
-- CREATE ONBOARDING ROW AFTER ACCOUNT SIGNUP
-- ============================================================
--
-- Purpose:
-- Automatically creates a user_onboarding row whenever
-- Supabase creates a new authenticated Mission Trails user.
--
-- This lets the pre-account onboarding flow carry either:
--
--   verified
--   kids
--
-- into account creation safely.
--
-- ============================================================


-- ============================================================
-- CREATE ONBOARDING FUNCTION
-- ============================================================
--
-- Purpose:
-- Reads safe onboarding values stored in Supabase Auth
-- user metadata during signup and creates the private
-- user_onboarding record for that new account.
--
-- ============================================================

create or replace function public.handle_new_user_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare

  -- Purpose:
  -- Holds the requested Mission Trails account access level.
  requested_access_mode text :=
    coalesce(
      new.raw_user_meta_data ->> 'account_access_mode',
      'pending'
    );


  -- Purpose:
  -- Holds the requested ID verification state.
  requested_verification_status text :=
    coalesce(
      new.raw_user_meta_data ->> 'id_verification_status',
      'pending'
    );

begin

  -- ==========================================================
  -- VALIDATE ACCOUNT ACCESS MODE
  -- ==========================================================

  if requested_access_mode not in (
    'pending',
    'verified',
    'kids'
  ) then
    requested_access_mode := 'pending';
  end if;


  -- ==========================================================
  -- VALIDATE ID VERIFICATION STATUS
  -- ==========================================================

  if requested_verification_status not in (
    'pending',
    'verified',
    'skipped_kids'
  ) then
    requested_verification_status := 'pending';
  end if;


  -- ==========================================================
  -- KEEP ACCESS MODE + VERIFICATION STATE CONSISTENT
  -- ==========================================================

  if requested_access_mode = 'kids' then
    requested_verification_status := 'skipped_kids';

  elsif requested_access_mode = 'verified' then
    requested_verification_status := 'verified';

  else
    requested_access_mode := 'pending';
    requested_verification_status := 'pending';
  end if;


  -- ==========================================================
  -- CREATE USER ONBOARDING RECORD
  -- ==========================================================
  --
  -- Purpose:
  -- Creates the private onboarding row owned by the new
  -- Supabase authenticated user.
  --
  -- ==========================================================

  insert into public.user_onboarding (
    user_id,
    first_name,
    last_name,
    display_name,
    email,
    birthday,
    city,
    state,
    country,
    account_access_mode,
    id_verification_status,
    id_verified_at,
    profile_complete,
    onboarding_complete,
    updated_at
  )
  values (
    new.id,

    nullif(
      new.raw_user_meta_data ->> 'first_name',
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'last_name',
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'display_name',
      ''
    ),

    new.email,

    nullif(
      new.raw_user_meta_data ->> 'birthday',
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'city',
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'state',
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'country',
      ''
    ),

    requested_access_mode,

    requested_verification_status,

    case
      when requested_access_mode = 'verified'
      then now()
      else null
    end,

    false,
    false,
    now()
  )

  on conflict (user_id)
  do update set

    first_name =
      coalesce(
        excluded.first_name,
        public.user_onboarding.first_name
      ),

    last_name =
      coalesce(
        excluded.last_name,
        public.user_onboarding.last_name
      ),

    display_name =
      coalesce(
        excluded.display_name,
        public.user_onboarding.display_name
      ),

    email =
      coalesce(
        excluded.email,
        public.user_onboarding.email
      ),

    birthday =
      coalesce(
        excluded.birthday,
        public.user_onboarding.birthday
      ),

    city =
      coalesce(
        excluded.city,
        public.user_onboarding.city
      ),

    state =
      coalesce(
        excluded.state,
        public.user_onboarding.state
      ),

    country =
      coalesce(
        excluded.country,
        public.user_onboarding.country
      ),

    account_access_mode =
      excluded.account_access_mode,

    id_verification_status =
      excluded.id_verification_status,

    id_verified_at =
      excluded.id_verified_at,

    updated_at =
      now();


  return new;

end;
$$;


-- ============================================================
-- PROTECT TRIGGER FUNCTION
-- ============================================================
--
-- Purpose:
-- Prevents app users from manually calling this
-- security-definer database function.
--
-- Supabase itself can still run it through the trigger.
--
-- ============================================================

revoke execute
on function public.handle_new_user_onboarding()
from public, anon, authenticated;


-- ============================================================
-- AUTH USER CREATION TRIGGER
-- ============================================================
--
-- Purpose:
-- Runs the onboarding function automatically immediately
-- after a new Supabase Auth account is created.
--
-- ============================================================

drop trigger if exists
on_auth_user_created_onboarding
on auth.users;


create trigger on_auth_user_created_onboarding
after insert
on auth.users
for each row
execute function public.handle_new_user_onboarding();


comment on function public.handle_new_user_onboarding() is
'Creates the Mission Trails user_onboarding record after Supabase Auth signup.';
