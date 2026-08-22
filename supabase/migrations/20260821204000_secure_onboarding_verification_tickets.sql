-- ============================================================
-- SECURE ONBOARDING VERIFICATION TICKETS
-- ============================================================
--
-- Purpose:
-- Prevents the client app from granting itself verified access.
--
-- A successful server-side ID information match will receive
-- a short-lived random ticket.
--
-- During account signup the database:
--
-- 1. hashes the supplied ticket
-- 2. finds the matching server-created ticket
-- 3. verifies it has not expired
-- 4. verifies it has not already been used
-- 5. verifies the identity fields match
-- 6. marks the ticket as consumed
-- 7. grants verified access
--
-- Kids Mode does not require a ticket because it grants
-- fewer permissions, not more.
--
-- ============================================================


-- ============================================================
-- CRYPTO SUPPORT
-- ============================================================
--
-- Purpose:
-- Provides SHA-256 hashing used to compare verification
-- tickets without storing the raw secret ticket.
--
-- ============================================================

create extension if not exists pgcrypto
with schema extensions;


-- ============================================================
-- VERIFICATION TICKET TABLE
-- ============================================================

create table if not exists public.onboarding_verification_tickets (

  id uuid
    primary key
    default gen_random_uuid(),

  -- Purpose:
  -- Stores SHA-256 of the secret ticket.
  -- The raw ticket is never stored in the database.
  token_hash text
    not null
    unique,

  -- Purpose:
  -- Binds the ticket to the onboarding identity information
  -- that successfully matched the submitted ID.
  first_name_norm text
    not null,

  last_name_norm text
    not null,

  birthday_norm text
    not null,

  created_at timestamptz
    not null
    default now(),

  -- Purpose:
  -- Makes verification tickets temporary.
  expires_at timestamptz
    not null
    default (
      now() + interval '15 minutes'
    ),

  -- Purpose:
  -- A non-null value means this ticket has already been used.
  claimed_at timestamptz,

  -- Purpose:
  -- Records which newly-created account consumed the ticket.
  claimed_user_id uuid
    references auth.users(id)
    on delete set null
);


-- ============================================================
-- TICKET TABLE SECURITY
-- ============================================================
--
-- Purpose:
-- Normal app users must never be able to read, create,
-- edit, or claim verification tickets themselves.
--
-- ============================================================

alter table
public.onboarding_verification_tickets
enable row level security;


revoke all
on public.onboarding_verification_tickets
from anon, authenticated;


-- Purpose:
-- Allows only Supabase's trusted service role, used by
-- the verification Edge Function, to create tickets.
grant insert
on public.onboarding_verification_tickets
to service_role;


create index if not exists
onboarding_verification_tickets_expiration_idx
on public.onboarding_verification_tickets (
  expires_at
);


create index if not exists
onboarding_verification_tickets_claimed_idx
on public.onboarding_verification_tickets (
  claimed_at
);


-- ============================================================
-- SECURE AUTH SIGNUP HANDLER
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
      -- Missing, expired, reused, forged, or mismatched tickets
      -- always fall back to pending access.
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


-- ============================================================
-- PROTECT SIGNUP FUNCTION
-- ============================================================

revoke execute
on function public.handle_new_user_onboarding()
from public, anon, authenticated;


comment on table
public.onboarding_verification_tickets is
'Short-lived single-use server-issued tickets for pre-account onboarding identity information matches.';


comment on function
public.handle_new_user_onboarding() is
'Creates user onboarding records and grants verified access only when a valid server-issued verification ticket is consumed.';
