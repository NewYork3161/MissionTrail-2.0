-- ============================================================
-- REPAIR + VERIFY EXISTING MISSION TRAILS ACCOUNT
-- ============================================================
--
-- Purpose:
-- Allows an older signed-in account with no user_onboarding
-- row to securely create that row after successful Photo ID
-- verification.
--
-- A valid server-issued verification ticket is still required.
-- ============================================================


drop function if exists
public.redeem_existing_user_verification_ticket(text);


-- Purpose:
-- Validates the trusted ID ticket, creates a missing onboarding
-- profile when necessary, and grants verified access.
create or replace function
public.redeem_existing_user_verification_ticket(
  p_verification_ticket text,
  p_first_name text,
  p_last_name text,
  p_birthday text,
  p_display_name text,
  p_city text,
  p_state text,
  p_country text,
  p_questionnaire_answers jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare

  current_user_id uuid :=
    auth.uid();

  current_email text;

  normalized_first_name text :=
    lower(
      btrim(
        coalesce(
          p_first_name,
          ''
        )
      )
    );

  normalized_last_name text :=
    lower(
      btrim(
        coalesce(
          p_last_name,
          ''
        )
      )
    );

  normalized_birthday text :=
    lower(
      btrim(
        coalesce(
          p_birthday,
          ''
        )
      )
    );

  matched_ticket_id uuid;

  questionnaire_is_complete boolean :=
    false;

begin

  -- ==========================================================
  -- REQUIRE SIGNED-IN ACCOUNT
  -- ==========================================================

  if current_user_id is null then

    raise exception
      'You must be signed in to verify this account.';

  end if;


  -- ==========================================================
  -- REQUIRE IDENTITY INFORMATION
  -- ==========================================================

  if normalized_first_name = ''
     or normalized_last_name = ''
     or normalized_birthday = '' then

    raise exception
      'Verified identity information is incomplete.';

  end if;


  -- ==========================================================
  -- REQUIRE SECURE TICKET
  -- ==========================================================

  if p_verification_ticket is null
     or btrim(p_verification_ticket) = '' then

    raise exception
      'A verification ticket is required.';

  end if;


  -- ==========================================================
  -- VALIDATE + CLAIM THE TRUSTED SERVER TICKET
  -- ==========================================================

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
      normalized_first_name

    and last_name_norm =
      normalized_last_name

    and birthday_norm =
      normalized_birthday

  returning id
  into matched_ticket_id;


  if matched_ticket_id is null then

    raise exception
      'Verification ticket is invalid, expired, already used, or does not match the verified identity.';

  end if;


  -- ==========================================================
  -- GET CURRENT ACCOUNT EMAIL
  -- ==========================================================

  select email
  into current_email
  from auth.users
  where id =
    current_user_id;


  -- ==========================================================
  -- QUESTIONNAIRE STATUS
  -- ==========================================================

  questionnaire_is_complete :=
    p_questionnaire_answers is not null
    and jsonb_typeof(
      p_questionnaire_answers
    ) = 'object'
    and p_questionnaire_answers <> '{}'::jsonb;


  -- ==========================================================
  -- CREATE OR REPAIR ONBOARDING PROFILE
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

    questionnaire_answers,
    questionnaire_complete,
    questionnaire_completed_at,

    updated_at
  )

  values (

    current_user_id,

    nullif(
      btrim(p_first_name),
      ''
    ),

    nullif(
      btrim(p_last_name),
      ''
    ),

    nullif(
      btrim(p_display_name),
      ''
    ),

    current_email,

    nullif(
      btrim(p_birthday),
      ''
    ),

    nullif(
      btrim(p_city),
      ''
    ),

    nullif(
      btrim(p_state),
      ''
    ),

    nullif(
      btrim(p_country),
      ''
    ),

    'verified',

    'verified',

    now(),

    coalesce(
      p_questionnaire_answers,
      '{}'::jsonb
    ),

    questionnaire_is_complete,

    case
      when questionnaire_is_complete
      then now()
      else null
    end,

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
      'verified',

    id_verification_status =
      'verified',

    id_verified_at =
      now(),

    questionnaire_answers =
      case
        when questionnaire_is_complete
        then excluded.questionnaire_answers
        else public.user_onboarding.questionnaire_answers
      end,

    questionnaire_complete =
      case
        when questionnaire_is_complete
        then true
        else public.user_onboarding.questionnaire_complete
      end,

    questionnaire_completed_at =
      case
        when questionnaire_is_complete
        then coalesce(
          public.user_onboarding.questionnaire_completed_at,
          now()
        )
        else public.user_onboarding.questionnaire_completed_at
      end,

    updated_at =
      now();


  return true;

end;
$$;


revoke execute
on function
public.redeem_existing_user_verification_ticket(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public, anon;


grant execute
on function
public.redeem_existing_user_verification_ticket(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to authenticated;
