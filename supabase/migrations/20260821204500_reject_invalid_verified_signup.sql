-- ============================================================
-- REQUIRE VALID TICKET FOR VERIFIED SIGNUP
-- ============================================================
--
-- Purpose:
-- Prevents the verified signup path from silently creating
-- a pending account when its verification ticket is missing,
-- expired, reused, forged, or bound to different identity data.
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
  -- Reads the requested mode only so Kids Mode can remain
  -- an intentional reduced-access signup option.
  requested_access_mode text :=
    coalesce(
      new.raw_user_meta_data ->> 'account_access_mode',
      'pending'
    );


  -- Purpose:
  -- Holds the secret one-time verification ticket supplied
  -- during account signup.
  verification_ticket text :=
    nullif(
      new.raw_user_meta_data ->> 'verification_ticket',
      ''
    );


  -- Purpose:
  -- Normalizes signup identity information so it can be
  -- compared against the identity bound to the ticket.
  signup_first_name text :=
    lower(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'first_name',
          ''
        )
      )
    );


  signup_last_name text :=
    lower(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'last_name',
          ''
        )
      )
    );


  signup_birthday text :=
    lower(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'birthday',
          ''
        )
      )
    );


  final_access_mode text :=
    'pending';


  final_verification_status text :=
    'pending';


  matched_ticket_id uuid;

begin

  -- ==========================================================
  -- KIDS MODE
  -- ==========================================================
  --
  -- Purpose:
  -- Kids Mode is allowed without identity verification because
  -- it cannot access Trails or Meetups.
  --
  -- ==========================================================

  if requested_access_mode = 'kids' then

    final_access_mode :=
      'kids';

    final_verification_status :=
      'skipped_kids';


  else

    -- ========================================================
    -- VALIDATE SERVER VERIFICATION TICKET
    -- ========================================================
    --
    -- Purpose:
    -- Client metadata saying "verified" is deliberately ignored.
    --
    -- Only possession of an unused, unexpired ticket created by
    -- the verification server can unlock verified access.
    --
    -- The UPDATE also claims the ticket atomically so it cannot
    -- be reused by another account.
    --
    -- ========================================================

    if verification_ticket is not null then

      update public.onboarding_verification_tickets
      set
        claimed_at =
          now(),

        claimed_user_id =
          new.id

      where
        token_hash =
          encode(
            extensions.digest(
              verification_ticket,
              'sha256'
            ),
            'hex'
          )

        and claimed_at is null

        and expires_at >
          now()

        and first_name_norm =
          signup_first_name

        and last_name_norm =
          signup_last_name

        and birthday_norm =
          signup_birthday

      returning id
      into matched_ticket_id;

    end if;


    -- ========================================================
    -- GRANT VERIFIED ACCESS
    -- ========================================================

    if matched_ticket_id is not null then

      final_access_mode :=
        'verified';

      final_verification_status :=
        'verified';

    else

      -- Purpose:
      -- A signup that explicitly came from the verified
      -- onboarding path must have a valid server-issued ticket.
      --
      -- Raising here rolls back auth.users creation so an
      -- expired or forged ticket cannot create a confusing
      -- partially-verified account.
      if requested_access_mode = 'verified' then

        raise exception
          using
            errcode = 'P0001',
            message =
              'VERIFICATION_TICKET_INVALID_OR_EXPIRED';

      end if;


      -- Purpose:
      -- Non-verified onboarding paths remain pending unless
      -- they explicitly selected Kids Mode above.
      final_access_mode :=
        'pending';

      final_verification_status :=
        'pending';

    end if;

  end if;


  -- ==========================================================
  -- CREATE USER ONBOARDING RECORD
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

    final_access_mode,

    final_verification_status,

    case
      when final_access_mode = 'verified'
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


  -- ==========================================================
  -- REMOVE SECRET / ACCESS CLAIMS FROM AUTH METADATA
  -- ==========================================================
  --
  -- Purpose:
  -- user_onboarding becomes the trusted access source.
  --
  -- The temporary ticket and client-requested access values
  -- should not remain stored in Auth metadata.
  --
  -- ==========================================================

  update auth.users
  set raw_user_meta_data =
    coalesce(
      raw_user_meta_data,
      '{}'::jsonb
    )
    - 'verification_ticket'
    - 'account_access_mode'
    - 'id_verification_status'

  where id =
    new.id;


  return new;

end;
$$;

revoke execute
on function public.handle_new_user_onboarding()
from public, anon, authenticated;

comment on function public.handle_new_user_onboarding() is
'Creates onboarding records and rejects verified signup unless a valid single-use verification ticket is consumed.';
