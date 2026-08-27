-- ============================================================
-- UPGRADE EXISTING KIDS ACCOUNT AFTER VERIFIED PHOTO ID
-- ============================================================
--
-- Purpose:
-- Allows an already signed-in Kids Mode account to become
-- verified only after consuming a valid server-issued ID
-- verification ticket.
--
-- The client CANNOT simply set itself to verified.
-- ============================================================


-- Purpose:
-- Securely consumes a valid verification ticket for the
-- currently authenticated account and unlocks Trails/Meetups.
create or replace function
public.redeem_existing_user_verification_ticket(
  p_verification_ticket text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare

  current_user_id uuid :=
    auth.uid();

  stored_first_name text;

  stored_last_name text;

  stored_birthday text;

  matched_ticket_id uuid;

begin

  -- ----------------------------------------------------------
  -- REQUIRE AUTHENTICATED USER
  -- ----------------------------------------------------------

  if current_user_id is null then
    raise exception
      'You must be signed in to upgrade an existing account.';
  end if;


  -- ----------------------------------------------------------
  -- REQUIRE TICKET
  -- ----------------------------------------------------------

  if p_verification_ticket is null
     or btrim(p_verification_ticket) = '' then

    raise exception
      'A valid verification ticket is required.';

  end if;


  -- ----------------------------------------------------------
  -- LOAD TRUSTED ACCOUNT IDENTITY
  -- ----------------------------------------------------------

  select
    lower(
      btrim(
        coalesce(first_name, '')
      )
    ),

    lower(
      btrim(
        coalesce(last_name, '')
      )
    ),

    lower(
      btrim(
        coalesce(birthday, '')
      )
    )

  into
    stored_first_name,
    stored_last_name,
    stored_birthday

  from public.user_onboarding

  where user_id =
    current_user_id;


  if not found then
    raise exception
      'Onboarding profile was not found.';
  end if;


  -- ----------------------------------------------------------
  -- ATOMICALLY VALIDATE + CLAIM TICKET
  -- ----------------------------------------------------------

  update public.onboarding_verification_tickets

  set
    claimed_at =
      now(),

    claimed_user_id =
      current_user_id

  where

    token_hash =
      encode(
        extensions.digest(
          p_verification_ticket,
          'sha256'
        ),
        'hex'
      )

    and claimed_at is null

    and expires_at >
      now()

    and first_name_norm =
      stored_first_name

    and last_name_norm =
      stored_last_name

    and birthday_norm =
      stored_birthday

  returning id
  into matched_ticket_id;


  -- ----------------------------------------------------------
  -- REJECT INVALID / EXPIRED / MISMATCHED TICKET
  -- ----------------------------------------------------------

  if matched_ticket_id is null then

    raise exception
      'Verification ticket is invalid, expired, already used, or does not match this account.';

  end if;


  -- ----------------------------------------------------------
  -- GRANT VERIFIED ACCESS
  -- ----------------------------------------------------------

  update public.user_onboarding

  set
    account_access_mode =
      'verified',

    id_verification_status =
      'verified',

    id_verified_at =
      now(),

    updated_at =
      now()

  where user_id =
    current_user_id;


  return true;

end;
$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke execute
on function
public.redeem_existing_user_verification_ticket(text)
from public, anon;


grant execute
on function
public.redeem_existing_user_verification_ticket(text)
to authenticated;


comment on function
public.redeem_existing_user_verification_ticket(text)
is
'Consumes a trusted server-issued ID verification ticket and upgrades the current authenticated account from restricted access to verified access.';
