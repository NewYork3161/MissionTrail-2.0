-- ============================================================
-- MISSION TRAILS USER ONBOARDING
-- ============================================================
--
-- Purpose:
-- Stores private onboarding information for each
-- authenticated Mission Trails user.
--
-- This table is separate from public.profiles because
-- onboarding contains account/setup information that does
-- not belong in the user's public-facing profile.
--
-- ============================================================


-- ============================================================
-- CREATE USER ONBOARDING TABLE
-- ============================================================

create table if not exists public.user_onboarding (

  -- Purpose:
  -- Connects this onboarding record to exactly one
  -- Supabase authenticated user.
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  -- Purpose:
  -- Stores the user's onboarding identity/profile fields.
  first_name text,
  last_name text,
  display_name text,

  email text,
  phone text,

  birthday text,

  city text,
  state text,
  country text,

  -- Purpose:
  -- Tracks whether profile setup has been completed.
  profile_complete boolean
    not null
    default false,

  -- Purpose:
  -- Tracks whether the entire onboarding flow is complete.
  onboarding_complete boolean
    not null
    default false,

  -- Purpose:
  -- Records when the onboarding row was first created.
  created_at timestamptz
    not null
    default now(),

  -- Purpose:
  -- Records the most recent onboarding update.
  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- SAFELY ADD MISSING COLUMNS
-- ============================================================
--
-- Purpose:
-- Allows this migration to work safely if a partial
-- user_onboarding table ever exists in another environment.
--
-- ============================================================

alter table public.user_onboarding
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists birthday text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists profile_complete boolean
    not null default false,
  add column if not exists onboarding_complete boolean
    not null default false,
  add column if not exists created_at timestamptz
    not null default now(),
  add column if not exists updated_at timestamptz
    not null default now();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- Purpose:
-- Prevents one Mission Trails account from reading or
-- changing another user's private onboarding record.
--
-- ============================================================

alter table public.user_onboarding
enable row level security;


-- ============================================================
-- DATABASE PERMISSIONS
-- ============================================================

grant select, insert, update
on public.user_onboarding
to authenticated;


-- ============================================================
-- READ OWN ONBOARDING
-- ============================================================
--
-- Purpose:
-- Allows a logged-in user to read only their own row.
--
-- ============================================================

drop policy if exists
"Users can read own onboarding"
on public.user_onboarding;

create policy
"Users can read own onboarding"
on public.user_onboarding
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- CREATE OWN ONBOARDING
-- ============================================================
--
-- Purpose:
-- Allows a logged-in user to create an onboarding row
-- only for their own authenticated account.
--
-- ============================================================

drop policy if exists
"Users can create own onboarding"
on public.user_onboarding;

create policy
"Users can create own onboarding"
on public.user_onboarding
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- ============================================================
-- UPDATE OWN ONBOARDING
-- ============================================================
--
-- Purpose:
-- Allows a logged-in user to update only their own
-- onboarding information.
--
-- ============================================================

drop policy if exists
"Users can update own onboarding"
on public.user_onboarding;

create policy
"Users can update own onboarding"
on public.user_onboarding
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


-- ============================================================
-- INDEX
-- ============================================================
--
-- Purpose:
-- Supports fast account ownership lookups.
--
-- ============================================================

create index if not exists
user_onboarding_user_id_idx
on public.user_onboarding(user_id);


-- ============================================================
-- DATABASE NOTES
-- ============================================================

comment on table public.user_onboarding is
'Private onboarding and account setup information for Mission Trails users.';

comment on column public.user_onboarding.user_id is
'Authenticated Mission Trails user that owns this onboarding record.';

comment on column public.user_onboarding.profile_complete is
'True after required profile setup has been completed.';

comment on column public.user_onboarding.onboarding_complete is
'True after the full Mission Trails onboarding flow has been completed.';
