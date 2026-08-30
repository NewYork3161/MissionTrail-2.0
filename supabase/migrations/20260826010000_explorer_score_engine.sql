begin;

-- =========================================================
-- MISSION TRAILS EXPLORER SCORE ENGINE
-- =========================================================
-- Purpose:
-- Expands the existing XP system so games, companions,
-- trails, eggs, bonding, and other features can safely
-- award Explorer Score.
--
-- IMPORTANT:
-- Explorer Score uses the existing XP ledger.
-- We are NOT creating a second competing score system.
-- =========================================================


-- ---------------------------------------------------------
-- 1. EXPAND THE TYPES OF ACTIVITIES THAT CAN GIVE POINTS
-- ---------------------------------------------------------

-- The old XP ledger only allowed:
-- relic_collection, mission, and admin.
--
-- We now allow the rest of Mission Trails too.
alter table private.xp_ledger
  drop constraint if exists xp_ledger_source_type_check;

alter table private.xp_ledger
  add constraint xp_ledger_source_type_check
  check (
    source_type in (
      'relic_collection',
      'mission',
      'admin',
      'distance',
      'companion',
      'game',
      'egg',
      'trail',
      'meetup',
      'purchase_bonus'
    )
  );


-- ---------------------------------------------------------
-- 2. ADD EXTRA DETAILS TO THE EXISTING XP LEDGER
-- ---------------------------------------------------------

alter table private.xp_ledger
  add column if not exists event_code text,
  add column if not exists score_category text,
  add column if not exists cap_group text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;


-- Purpose: Makes leaderboard/category searches faster.
create index if not exists xp_ledger_category_time_idx
  on private.xp_ledger (
    user_id,
    score_category,
    created_at desc
  );


-- Purpose: Makes daily and weekly reward-cap checks faster.
create index if not exists xp_ledger_cap_group_time_idx
  on private.xp_ledger (
    user_id,
    cap_group,
    created_at desc
  )
  where cap_group is not null;


-- ---------------------------------------------------------
-- 3. CREATE THE MASTER EXPLORER SCORE RULE BOOK
-- ---------------------------------------------------------
--
-- IMPORTANT:
-- The phone does NOT decide how many points something gives.
--
-- The server looks in this table.
-- This helps stop cheating and lets us rebalance later.
-- ---------------------------------------------------------

create table if not exists private.explorer_score_rules (
  event_code text primary key,

  source_type text not null
    check (
      source_type in (
        'distance',
        'companion',
        'game',
        'egg',
        'trail',
        'meetup',
        'purchase_bonus'
      )
    ),

  category text not null
    check (
      category in (
        'travel',
        'companion',
        'games',
        'eggs',
        'trails',
        'meetups',
        'support'
      )
    ),

  points integer not null
    check (points >= 0),

  -- Events sharing this group share the same reward limit.
  -- Example: all Food Sort rewards use food_sort_daily.
  cap_group text,

  -- none = unlimited
  -- daily = resets each UTC day
  -- weekly = resets each UTC week
  cap_period text not null default 'none'
    check (cap_period in ('none', 'daily', 'weekly')),

  cap_points integer,

  is_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (
      cap_period = 'none'
      and cap_points is null
      and cap_group is null
    )
    or
    (
      cap_period <> 'none'
      and cap_points is not null
      and cap_points > 0
      and cap_group is not null
    )
  )
);


comment on table private.explorer_score_rules is
  'Server-owned point values for Mission Trails Explorer Score events.';


-- ---------------------------------------------------------
-- 4. STARTER POINT VALUES
-- ---------------------------------------------------------
--
-- Existing mission and relic rewards stay in their current
-- systems so we do NOT accidentally reward them twice.
-- ---------------------------------------------------------

insert into private.explorer_score_rules (
  event_code,
  source_type,
  category,
  points,
  cap_group,
  cap_period,
  cap_points
)
values

  -- WALKING / TRAVEL
  -- Four quarter-mile rewards = 100 points per verified mile.
  (
    'distance_quarter_mile',
    'distance',
    'travel',
    25,
    null,
    'none',
    null
  ),

  -- COMPANION CARE
  (
    'companion_feed',
    'companion',
    'companion',
    20,
    null,
    'none',
    null
  ),

  -- Favorite food is a BONUS.
  -- Normal feed 20 + favorite bonus 15 = 35 total.
  (
    'companion_favorite_food_bonus',
    'companion',
    'companion',
    15,
    null,
    'none',
    null
  ),

  (
    'companion_healthy_day',
    'companion',
    'companion',
    100,
    'healthy_companion_daily',
    'daily',
    100
  ),

  (
    'bond_level_up',
    'companion',
    'companion',
    200,
    null,
    'none',
    null
  ),

  (
    'companion_care_streak_3',
    'companion',
    'companion',
    200,
    null,
    'none',
    null
  ),

  (
    'companion_care_streak_7',
    'companion',
    'companion',
    500,
    null,
    'none',
    null
  ),

  (
    'companion_care_streak_14',
    'companion',
    'companion',
    1000,
    null,
    'none',
    null
  ),

  (
    'companion_care_streak_30',
    'companion',
    'companion',
    2500,
    null,
    'none',
    null
  ),

  -- COMPANION FOOD SORT
  (
    'food_sort_win',
    'game',
    'games',
    50,
    'food_sort_daily',
    'daily',
    500
  ),

  -- Perfect adds another 50.
  -- Win 50 + perfect bonus 50 = 100 total.
  (
    'food_sort_perfect_bonus',
    'game',
    'games',
    50,
    'food_sort_daily',
    'daily',
    500
  ),

  (
    'food_sort_daily_challenge',
    'game',
    'games',
    150,
    'food_sort_daily',
    'daily',
    500
  ),

  -- EGGS
  (
    'egg_found',
    'egg',
    'eggs',
    125,
    null,
    'none',
    null
  ),

  (
    'egg_hatched',
    'egg',
    'eggs',
    300,
    null,
    'none',
    null
  ),

  -- TRAILS
  (
    'trail_discovered',
    'trail',
    'trails',
    200,
    null,
    'none',
    null
  ),

  (
    'trail_completed',
    'trail',
    'trails',
    400,
    null,
    'none',
    null
  ),

  -- MEETUPS
  (
    'meetup_attended',
    'meetup',
    'meetups',
    300,
    null,
    'none',
    null
  ),

  -- COIN PURCHASE SUPPORT BONUS
  -- Maximum 300 Explorer Score per week.
  (
    'purchase_support_bonus',
    'purchase_bonus',
    'support',
    100,
    'purchase_bonus_weekly',
    'weekly',
    300
  )

on conflict (event_code)
do update set
  source_type = excluded.source_type,
  category = excluded.category,
  points = excluded.points,
  cap_group = excluded.cap_group,
  cap_period = excluded.cap_period,
  cap_points = excluded.cap_points,
  is_enabled = true,
  updated_at = now();


-- ---------------------------------------------------------
-- 5. SERVER-ONLY FUNCTION THAT AWARDS EXPLORER SCORE
-- ---------------------------------------------------------
--
-- Purpose:
-- Every new Mission Trails feature can eventually call this
-- function instead of directly editing the user's score.
--
-- The server:
-- 1. Finds the official point value.
-- 2. Checks duplicate rewards.
-- 3. Checks daily/weekly limits.
-- 4. Adds the reward to the existing XP ledger.
-- 5. Returns the new Explorer Score.
-- ---------------------------------------------------------

create or replace function public.server_award_explorer_score(
  p_user_id uuid,
  p_event_code text,
  p_source_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule private.explorer_score_rules%rowtype;

  v_idempotency_key text;

  v_now timestamptz := clock_timestamp();
  v_period_start timestamptz;

  v_points_already_earned bigint := 0;
  v_points_to_award integer := 0;

  v_inserted_id uuid;
  v_total_score bigint := 0;
  v_cap_remaining integer;
begin

  -- A real user is required.
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;


  -- Every reward needs a unique source.
  -- Example:
  -- food-sort-level-12-attempt-123
  if coalesce(trim(p_source_key), '') = '' then
    raise exception 'source_key_required';
  end if;


  -- Find the official server-owned point value.
  select *
  into v_rule
  from private.explorer_score_rules
  where event_code = p_event_code
    and is_enabled = true;


  if not found then
    raise exception 'unknown_or_disabled_explorer_event';
  end if;


  -- Creates a unique key so the same reward cannot be
  -- collected twice.
  v_idempotency_key :=
    concat(
      'explorer:',
      p_event_code,
      ':',
      p_source_key
    );


  -- If this exact reward was already awarded,
  -- return safely without awarding it again.
  if exists (
    select 1
    from private.xp_ledger
    where user_id = p_user_id
      and idempotency_key = v_idempotency_key
  ) then

    select coalesce(sum(xp_delta), 0)::bigint
    into v_total_score
    from private.xp_ledger
    where user_id = p_user_id;

    return jsonb_build_object(
      'eventCode', p_event_code,
      'category', v_rule.category,
      'awardedPoints', 0,
      'totalExplorerScore', v_total_score,
      'duplicate', true,
      'capped', false
    );
  end if;


  -- Start with the normal point reward.
  v_points_to_award := v_rule.points;


  -- DAILY CAP
  if v_rule.cap_period = 'daily' then

    v_period_start :=
      date_trunc(
        'day',
        v_now at time zone 'UTC'
      ) at time zone 'UTC';

  -- WEEKLY CAP
  elsif v_rule.cap_period = 'weekly' then

    v_period_start :=
      date_trunc(
        'week',
        v_now at time zone 'UTC'
      ) at time zone 'UTC';

  end if;


  -- If this reward has a cap, calculate how many points
  -- the player has already earned from this reward group.
  if v_rule.cap_period <> 'none' then

    select coalesce(sum(xp_delta), 0)::bigint
    into v_points_already_earned
    from private.xp_ledger
    where user_id = p_user_id
      and cap_group = v_rule.cap_group
      and created_at >= v_period_start;


    -- Never allow the reward to pass the cap.
    v_points_to_award :=
      least(
        v_rule.points,
        greatest(
          0,
          v_rule.cap_points - v_points_already_earned
        )::integer
      );


    v_cap_remaining :=
      greatest(
        0,
        v_rule.cap_points
          - v_points_already_earned
          - v_points_to_award
      )::integer;

  end if;


  -- The player already reached this reward group's cap.
  if v_points_to_award <= 0 then

    select coalesce(sum(xp_delta), 0)::bigint
    into v_total_score
    from private.xp_ledger
    where user_id = p_user_id;

    return jsonb_build_object(
      'eventCode', p_event_code,
      'category', v_rule.category,
      'awardedPoints', 0,
      'totalExplorerScore', v_total_score,
      'duplicate', false,
      'capped', true,
      'capRemaining', 0
    );
  end if;


  -- Save the Explorer Score reward.
  --
  -- source_id uses a generated UUID because the safer,
  -- human-readable duplicate protection lives in
  -- idempotency_key.
  insert into private.xp_ledger (
    user_id,
    source_type,
    source_id,
    xp_delta,
    idempotency_key,
    event_code,
    score_category,
    cap_group,
    metadata
  )
  values (
    p_user_id,
    v_rule.source_type,
    extensions.gen_random_uuid(),
    v_points_to_award,
    v_idempotency_key,
    p_event_code,
    v_rule.category,
    v_rule.cap_group,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict do nothing
  returning id into v_inserted_id;


  -- Another request may have awarded the same event
  -- at the exact same time.
  if v_inserted_id is null then

    select coalesce(sum(xp_delta), 0)::bigint
    into v_total_score
    from private.xp_ledger
    where user_id = p_user_id;

    return jsonb_build_object(
      'eventCode', p_event_code,
      'category', v_rule.category,
      'awardedPoints', 0,
      'totalExplorerScore', v_total_score,
      'duplicate', true,
      'capped', false
    );
  end if;


  -- Calculate the player's new lifetime Explorer Score.
  select coalesce(sum(xp_delta), 0)::bigint
  into v_total_score
  from private.xp_ledger
  where user_id = p_user_id;


  return jsonb_build_object(
    'eventCode', p_event_code,
    'category', v_rule.category,
    'awardedPoints', v_points_to_award,
    'totalExplorerScore', v_total_score,
    'duplicate', false,
    'capped', false,
    'capRemaining', v_cap_remaining
  );
end;
$$;


comment on function public.server_award_explorer_score(
  uuid,
  text,
  text,
  jsonb
) is
  'Server-only Explorer Score award function with duplicate and reward-cap protection.';


-- ---------------------------------------------------------
-- 6. SECURITY
-- ---------------------------------------------------------
--
-- The mobile app CANNOT directly call this function.
-- Trusted backend code will call it after verifying an event.
-- ---------------------------------------------------------

revoke all
on function public.server_award_explorer_score(
  uuid,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.server_award_explorer_score(
  uuid,
  text,
  text,
  jsonb
)
to service_role;


commit;
