-- ============================================================
-- MISSION TRAILS SECURE TRAIL MEETUPS
-- ============================================================
--
-- Purpose:
-- Stores real persistent Trail Meetups.
--
-- Meetup access requires:
-- - authenticated account
-- - verified ID access
-- - age 18 or older
--
-- Kids Mode and pending accounts are blocked by the database.
-- ============================================================


-- ============================================================
-- PROTECT ACCOUNT ACCESS FIELDS
-- ============================================================
--
-- Purpose:
-- Prevents a normal authenticated client from editing the
-- security fields that unlock Trails and Meetups.
--
-- Trusted SECURITY DEFINER database functions can still
-- change these values when verification succeeds.
-- ============================================================

create or replace function
public.protect_user_onboarding_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if current_user in (
    'authenticated',
    'anon'
  ) then

    if tg_op = 'INSERT' then

      new.account_access_mode :=
        'pending';

      new.id_verification_status :=
        'pending';

      new.id_verified_at :=
        null;

    else

      new.account_access_mode :=
        old.account_access_mode;

      new.id_verification_status :=
        old.id_verification_status;

      new.id_verified_at :=
        old.id_verified_at;

    end if;

  end if;


  return new;
end;
$$;


drop trigger if exists
protect_user_onboarding_access_fields_trigger
on public.user_onboarding;


create trigger
protect_user_onboarding_access_fields_trigger
before insert or update
on public.user_onboarding
for each row
execute function
public.protect_user_onboarding_access_fields();


-- ============================================================
-- VERIFIED ADULT CHECK
-- ============================================================

-- Purpose:
-- Returns true only when the signed-in account:
--
-- 1. has verified Mission Trails access
-- 2. has verified ID status
-- 3. has a valid birthday
-- 4. is at least 18 years old
--
-- Both MM/DD/YYYY and YYYY-MM-DD birthdays are accepted.
create or replace function
public.mission_trails_can_use_meetups()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare

  birthday_text text;

  birthday_date date;

begin

  if auth.uid() is null then
    return false;
  end if;


  select birthday
  into birthday_text
  from public.user_onboarding
  where
    user_id = auth.uid()

    and account_access_mode =
      'verified'

    and id_verification_status =
      'verified';


  if not found then
    return false;
  end if;


  birthday_text :=
    btrim(
      coalesce(
        birthday_text,
        ''
      )
    );


  begin

    -- MM/DD/YYYY
    if birthday_text ~
      '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
    then

      birthday_date :=
        make_date(
          split_part(
            birthday_text,
            '/',
            3
          )::integer,

          split_part(
            birthday_text,
            '/',
            1
          )::integer,

          split_part(
            birthday_text,
            '/',
            2
          )::integer
        );


    -- YYYY-MM-DD
    elsif birthday_text ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then

      birthday_date :=
        birthday_text::date;


    else

      return false;

    end if;


  exception
    when others then

      return false;

  end;


  return (
    birthday_date <=
    (
      current_date -
      interval '18 years'
    )::date
  );

end;
$$;


revoke all
on function
public.mission_trails_can_use_meetups()
from public;


grant execute
on function
public.mission_trails_can_use_meetups()
to authenticated;


-- ============================================================
-- TRAIL MEETUPS
-- ============================================================

create table if not exists
public.trail_meetups (

  id uuid
    primary key
    default gen_random_uuid(),

  -- Purpose:
  -- Stores the REAL OpenStreetMap / provider trail ID.
  trail_id text
    not null,

  title text
    not null,

  meetup_date date
    not null,

  start_time text
    not null,

  meeting_point text
    not null,

  host_user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  host_name text
    not null,

  attendee_count integer
    not null
    default 1,

  max_group_size integer
    not null,

  pace text
    not null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),


  constraint
  trail_meetups_pace_check
  check (
    pace in (
      'relaxed',
      'moderate',
      'fast'
    )
  ),


  constraint
  trail_meetups_group_size_check
  check (
    max_group_size >= 2
    and
    max_group_size <= 100
  ),


  constraint
  trail_meetups_attendee_count_check
  check (
    attendee_count >= 1
    and
    attendee_count <= max_group_size
  )
);


alter table
public.trail_meetups
enable row level security;


grant
select,
insert,
update,
delete
on public.trail_meetups
to authenticated;


-- ============================================================
-- READ MEETUPS
-- ============================================================

-- Purpose:
-- Only verified adults can see current and future Meetups.
--
-- Past Meetups disappear automatically from normal app reads.
drop policy if exists
"Verified adults can read trail meetups"
on public.trail_meetups;


create policy
"Verified adults can read trail meetups"
on public.trail_meetups
for select
to authenticated
using (
  public.mission_trails_can_use_meetups()
  and
  meetup_date >= current_date
);


-- ============================================================
-- CREATE MEETUPS
-- ============================================================

-- Purpose:
-- Verified adults may create a Meetup only under their
-- own authenticated user ID.
drop policy if exists
"Verified adults can create trail meetups"
on public.trail_meetups;


create policy
"Verified adults can create trail meetups"
on public.trail_meetups
for insert
to authenticated
with check (
  public.mission_trails_can_use_meetups()

  and

  host_user_id =
    auth.uid()

  and

  meetup_date >=
    current_date
);


-- ============================================================
-- UPDATE MEETUPS
-- ============================================================

-- Purpose:
-- Only the original host can edit their future Meetup.
drop policy if exists
"Hosts can update own trail meetups"
on public.trail_meetups;


create policy
"Hosts can update own trail meetups"
on public.trail_meetups
for update
to authenticated
using (
  public.mission_trails_can_use_meetups()

  and

  host_user_id =
    auth.uid()
)
with check (
  public.mission_trails_can_use_meetups()

  and

  host_user_id =
    auth.uid()

  and

  meetup_date >=
    current_date
);


-- ============================================================
-- DELETE MEETUPS
-- ============================================================

-- Purpose:
-- Only the original Meetup host can remove the Meetup.
drop policy if exists
"Hosts can delete own trail meetups"
on public.trail_meetups;


create policy
"Hosts can delete own trail meetups"
on public.trail_meetups
for delete
to authenticated
using (
  public.mission_trails_can_use_meetups()

  and

  host_user_id =
    auth.uid()
);


create index if not exists
trail_meetups_trail_date_idx
on public.trail_meetups (
  trail_id,
  meetup_date
);


create index if not exists
trail_meetups_date_idx
on public.trail_meetups (
  meetup_date
);


-- ============================================================
-- MEETUP JOIN REQUESTS
-- ============================================================

create table if not exists
public.trail_meetup_join_requests (

  id uuid
    primary key
    default gen_random_uuid(),

  meetup_id uuid
    not null
    references public.trail_meetups(id)
    on delete cascade,

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  status text
    not null
    default 'requested',

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),


  constraint
  trail_meetup_join_status_check
  check (
    status in (
      'requested',
      'approved',
      'declined'
    )
  ),


  constraint
  trail_meetup_join_unique
  unique (
    meetup_id,
    user_id
  )
);


alter table
public.trail_meetup_join_requests
enable row level security;


grant
select,
insert,
update,
delete
on public.trail_meetup_join_requests
to authenticated;


-- ============================================================
-- READ JOIN REQUESTS
-- ============================================================

-- Purpose:
-- A requester can see their own request.
--
-- A Meetup host can see requests submitted to their Meetup.
drop policy if exists
"Users and hosts can read meetup requests"
on public.trail_meetup_join_requests;


create policy
"Users and hosts can read meetup requests"
on public.trail_meetup_join_requests
for select
to authenticated
using (

  public.mission_trails_can_use_meetups()

  and

  (
    user_id =
      auth.uid()

    or

    exists (
      select 1
      from public.trail_meetups meetup
      where
        meetup.id =
          meetup_id

        and

        meetup.host_user_id =
          auth.uid()
    )
  )
);


-- ============================================================
-- CREATE JOIN REQUEST
-- ============================================================

-- Purpose:
-- Verified adults can request to join a Meetup that has
-- not already expired.
drop policy if exists
"Verified adults can request meetup access"
on public.trail_meetup_join_requests;


create policy
"Verified adults can request meetup access"
on public.trail_meetup_join_requests
for insert
to authenticated
with check (

  public.mission_trails_can_use_meetups()

  and

  user_id =
    auth.uid()

  and

  status =
    'requested'

  and

  exists (
    select 1
    from public.trail_meetups meetup
    where
      meetup.id =
        meetup_id

      and

      meetup.meetup_date >=
        current_date
  )
);


-- ============================================================
-- HOST REQUEST REVIEW
-- ============================================================

-- Purpose:
-- Only the Meetup host can approve or decline requests.
drop policy if exists
"Hosts can review meetup requests"
on public.trail_meetup_join_requests;


create policy
"Hosts can review meetup requests"
on public.trail_meetup_join_requests
for update
to authenticated
using (

  public.mission_trails_can_use_meetups()

  and

  exists (
    select 1
    from public.trail_meetups meetup
    where
      meetup.id =
        meetup_id

      and

      meetup.host_user_id =
        auth.uid()
  )
)
with check (

  public.mission_trails_can_use_meetups()

  and

  status in (
    'approved',
    'declined'
  )
);


-- ============================================================
-- CANCEL JOIN REQUEST
-- ============================================================

-- Purpose:
-- A requester may cancel their own pending request.
drop policy if exists
"Users can cancel own meetup request"
on public.trail_meetup_join_requests;


create policy
"Users can cancel own meetup request"
on public.trail_meetup_join_requests
for delete
to authenticated
using (
  public.mission_trails_can_use_meetups()

  and

  user_id =
    auth.uid()
);


create index if not exists
trail_meetup_join_meetup_idx
on public.trail_meetup_join_requests (
  meetup_id
);


comment on table
public.trail_meetups
is
'Persistent Trail Meetups available only to verified Mission Trails adults.';


comment on table
public.trail_meetup_join_requests
is
'Verified-adult requests to join Mission Trails Trail Meetups.';
