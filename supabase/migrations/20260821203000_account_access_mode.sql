-- ============================================================
-- MISSION TRAILS ACCOUNT ACCESS MODE
-- ============================================================
--
-- Purpose:
-- Stores whether a user has completed ID verification
-- or is using the app in Kids Mode.
--
-- Kids Mode:
-- - Can use the normal app
-- - Cannot access Trails
-- - Cannot access Meetups
--
-- ============================================================

alter table public.user_onboarding
add column if not exists account_access_mode text
not null default 'pending';

alter table public.user_onboarding
add column if not exists id_verification_status text
not null default 'pending';

alter table public.user_onboarding
add column if not exists id_verified_at timestamptz;


-- ============================================================
-- VALID ACCOUNT ACCESS MODES
-- ============================================================

do $$
begin
  alter table public.user_onboarding
  add constraint user_onboarding_account_access_mode_check
  check (
    account_access_mode in (
      'pending',
      'verified',
      'kids'
    )
  );
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- VALID ID VERIFICATION STATES
-- ============================================================

do $$
begin
  alter table public.user_onboarding
  add constraint user_onboarding_id_verification_status_check
  check (
    id_verification_status in (
      'pending',
      'verified',
      'skipped_kids'
    )
  );
exception
  when duplicate_object then null;
end $$;


-- Purpose:
-- Makes account-access lookups faster when Mission Trails
-- checks whether Trails and Meetups should be available.
create index if not exists
user_onboarding_account_access_mode_idx
on public.user_onboarding(account_access_mode);


comment on column public.user_onboarding.account_access_mode is
'Controls Mission Trails feature access: pending, verified, or kids.';

comment on column public.user_onboarding.id_verification_status is
'Tracks ID verification state: pending, verified, or skipped_kids.';

comment on column public.user_onboarding.id_verified_at is
'Time when ID verification was successfully completed.';
