begin;

-- =========================================================
-- MISSION TRAILS COMPANION CARE SYSTEM
-- =========================================================
-- Purpose:
-- Adds Tamagotchi-style care stats to companions.
--
-- New stats:
-- Hunger
-- Happiness
-- Health
-- Last fed time
-- Care streak
--
-- Feeding also connects safely to Explorer Score.
-- =========================================================


-- =========================================================
-- 1. ADD CARE STATS TO THE EXISTING COMPANION
-- =========================================================

alter table private.user_companion_progress
  add column if not exists hunger integer not null default 100
    check (hunger between 0 and 100),

  add column if not exists happiness integer not null default 100
    check (happiness between 0 and 100),

  add column if not exists care_health integer not null default 100
    check (care_health between 0 and 100),

  add column if not exists care_streak integer not null default 0
    check (care_streak >= 0),

  add column if not exists last_fed_at timestamptz,

  add column if not exists last_healthy_date date,

  add column if not exists care_updated_at timestamptz
    not null default now();


-- =========================================================
-- 2. CARE EVENT HISTORY
-- =========================================================
-- Purpose:
-- Keeps a history of companion care actions.
--
-- This will later help:
-- Leaderboards
-- Companion profile history
-- Anti-cheat checks
-- Achievements
-- =========================================================

create table if not exists private.companion_care_events (
  id uuid primary key default extensions.gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  companion_id text not null,

  event_type text not null
    check (
      event_type in (
        'feed',
        'healthy_day',
        'play',
        'pet',
        'walk',
        'mission'
      )
    ),

  food_consumption_id uuid
    references private.companion_food_consumptions(id)
    on delete set null,

  food_id text,

  hunger_change integer not null default 0,
  happiness_change integer not null default 0,
  health_change integer not null default 0,
  bond_change integer not null default 0,

  created_at timestamptz not null default now(),

  unique (food_consumption_id)
);


create index if not exists
  companion_care_events_user_time_idx
on private.companion_care_events (
  user_id,
  created_at desc
);


-- =========================================================
-- 3. HEALTHY DAY HISTORY
-- =========================================================
-- One healthy-day reward maximum per player per day.
-- =========================================================

create table if not exists private.companion_care_days (
  id uuid primary key default extensions.gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  companion_id text not null,

  local_date date not null,

  hunger integer not null,
  happiness integer not null,
  care_health integer not null,

  created_at timestamptz not null default now(),

  unique (user_id, local_date)
);


-- =========================================================
-- 4. FOOD LEADERBOARD BALANCE
-- =========================================================
--
-- OLD SYSTEM:
-- Rare food could give much more USER XP.
--
-- Problem:
-- If that food can be purchased with Explorer Coins,
-- players could indirectly BUY leaderboard score.
--
-- NEW SYSTEM:
-- Food rarity affects the companion strongly.
--
-- Feeding itself gives a fixed Explorer Score reward,
-- with a daily maximum.
-- =========================================================


-- Allow the old food XP field to safely become zero.
alter table private.companion_food_catalog
  drop constraint if exists
  companion_food_catalog_user_xp_check;

alter table private.companion_food_catalog
  add constraint
  companion_food_catalog_user_xp_check
  check (user_xp >= 0);


-- Food consumption records can also contain zero legacy XP.
alter table private.companion_food_consumptions
  drop constraint if exists
  companion_food_consumptions_user_xp_awarded_check;

alter table private.companion_food_consumptions
  add constraint
  companion_food_consumptions_user_xp_awarded_check
  check (user_xp_awarded >= 0);


-- The OLD variable food XP is retired.
--
-- Food still gives Growth HP.
-- Explorer Score is now awarded by the central score engine.
update private.companion_food_catalog
set
  user_xp = 0,
  updated_at = clock_timestamp();


-- Preserve old food XP as historical Companion leaderboard data.
update private.xp_ledger
set
  event_code =
    coalesce(
      event_code,
      'legacy_companion_food'
    ),

  score_category =
    coalesce(
      score_category,
      'companion'
    )
where source_type = 'companion_food';


-- =========================================================
-- 5. LIMIT FEEDING LEADERBOARD POINTS
-- =========================================================
--
-- Feeding:
-- +20 Explorer Score
--
-- Maximum:
-- 200 Explorer Score from feeding per day.
--
-- Players can still feed after the cap.
-- Their companion still receives the food benefits.
-- They simply stop farming leaderboard points.
-- =========================================================

update private.explorer_score_rules
set
  points = 20,
  cap_group = 'companion_feed_daily',
  cap_period = 'daily',
  cap_points = 200,
  updated_at = clock_timestamp()
where event_code = 'companion_feed';


-- Favorite food will eventually add another +15,
-- but it shares the SAME daily cap.
update private.explorer_score_rules
set
  points = 15,
  cap_group = 'companion_feed_daily',
  cap_period = 'daily',
  cap_points = 200,
  updated_at = clock_timestamp()
where event_code =
  'companion_favorite_food_bonus';


-- =========================================================
-- 6. CARE DECAY
-- =========================================================
--
-- Purpose:
-- Companion stats slowly fall as real time passes.
--
-- Hunger:
-- loses about 1 point per hour
--
-- Happiness:
-- loses about 1 point every 2 hours
--
-- Health:
-- begins slowly dropping when Hunger gets very low
--
-- We do NOT need a background timer.
--
-- The server calculates decay whenever the companion
-- is checked or fed.
-- =========================================================

create or replace function
private.refresh_companion_care(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress
    private.user_companion_progress%rowtype;

  v_elapsed_hours integer;

  v_new_hunger integer;
  v_new_happiness integer;
  v_health_loss integer;
begin

  select *
  into v_progress
  from private.user_companion_progress
  where user_id = p_user_id
  for update;


  -- No companion means there is nothing to decay.
  if not found
    or v_progress.companion_id is null
  then
    return;
  end if;


  -- Find the number of COMPLETE hours since the
  -- companion care stats were last updated.
  v_elapsed_hours :=
    floor(
      extract(
        epoch from (
          clock_timestamp()
          - v_progress.care_updated_at
        )
      ) / 3600
    )::integer;


  if v_elapsed_hours <= 0 then
    return;
  end if;


  -- Hunger drops about 1 point every hour.
  v_new_hunger :=
    greatest(
      0,
      v_progress.hunger
      - v_elapsed_hours
    );


  -- Happiness drops more slowly.
  v_new_happiness :=
    greatest(
      0,
      v_progress.happiness
      - floor(
          v_elapsed_hours / 2.0
        )::integer
    );


  -- Health starts dropping slowly if hunger gets
  -- dangerously low.
  v_health_loss :=
    case
      when v_new_hunger < 25
        then floor(
          v_elapsed_hours / 6.0
        )::integer
      else 0
    end;


  update private.user_companion_progress
  set
    hunger = v_new_hunger,

    happiness =
      v_new_happiness,

    care_health =
      greatest(
        0,
        care_health
        - v_health_loss
      ),

    -- Keep partial hours instead of throwing them away.
    care_updated_at =
      care_updated_at
      + make_interval(
          hours => v_elapsed_hours
        ),

    updated_at =
      clock_timestamp()

  where user_id = p_user_id;

end;
$$;


-- =========================================================
-- 7. CHECK FOR A HEALTHY COMPANION DAY
-- =========================================================
--
-- Healthy Day requirements:
--
-- Hunger 50+
-- Happiness 50+
-- Health 60+
-- Companion was fed today
--
-- Reward:
-- +100 Explorer Score
--
-- Only once per local day.
-- =========================================================

create or replace function
private.check_companion_healthy_day(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress
    private.user_companion_progress%rowtype;

  v_context record;

  v_inserted integer := 0;

  v_new_streak integer := 0;

  v_streak_event text;
begin

  perform
    private.refresh_companion_care(
      p_user_id
    );


  select *
  into v_progress
  from private.user_companion_progress
  where user_id = p_user_id
  for update;


  if not found
    or v_progress.companion_id is null
  then
    return false;
  end if;


  select *
  into strict v_context
  from private.user_local_context(
    p_user_id,
    clock_timestamp()
  );


  -- Companion must have been fed TODAY.
  if v_progress.last_fed_at is null
    or (
      v_progress.last_fed_at
      at time zone
      v_context.timezone_name
    )::date
    <> v_context.local_date
  then
    return false;
  end if;


  -- Companion must be in good condition.
  if v_progress.hunger < 50
    or v_progress.happiness < 50
    or v_progress.care_health < 60
  then
    return false;
  end if;


  -- Try to save today's healthy day.
  insert into private.companion_care_days (
    user_id,
    companion_id,
    local_date,
    hunger,
    happiness,
    care_health
  )
  values (
    p_user_id,
    v_progress.companion_id,
    v_context.local_date,
    v_progress.hunger,
    v_progress.happiness,
    v_progress.care_health
  )
  on conflict (
    user_id,
    local_date
  )
  do nothing;


  get diagnostics
    v_inserted = row_count;


  -- Already received today's healthy-day credit.
  if v_inserted = 0 then
    return false;
  end if;


  -- Continue streak if yesterday was also healthy.
  if v_progress.last_healthy_date
    = v_context.local_date - 1
  then

    v_new_streak :=
      v_progress.care_streak + 1;

  else

    v_new_streak := 1;

  end if;


  update private.user_companion_progress
  set
    care_streak = v_new_streak,
    last_healthy_date =
      v_context.local_date,
    updated_at =
      clock_timestamp()

  where user_id = p_user_id;


  -- Award the daily healthy companion score.
  perform
    public.server_award_explorer_score(
      p_user_id,
      'companion_healthy_day',
      concat(
        v_progress.companion_id,
        ':',
        v_context.local_date
      ),
      jsonb_build_object(
        'companionId',
        v_progress.companion_id,

        'careStreak',
        v_new_streak
      )
    );


  -- Award special streak milestones.
  v_streak_event :=
    case v_new_streak
      when 3
        then 'companion_care_streak_3'
      when 7
        then 'companion_care_streak_7'
      when 14
        then 'companion_care_streak_14'
      when 30
        then 'companion_care_streak_30'
      else null
    end;


  if v_streak_event is not null then

    perform
      public.server_award_explorer_score(
        p_user_id,
        v_streak_event,
        concat(
          v_progress.companion_id,
          ':streak:',
          v_new_streak,
          ':',
          v_context.local_date
        ),
        jsonb_build_object(
          'companionId',
          v_progress.companion_id,

          'careStreak',
          v_new_streak
        )
      );

  end if;


  return true;

end;
$$;


-- =========================================================
-- 8. APPLY FOOD TO CARE STATS
-- =========================================================
--
-- This trigger runs ONLY after the secure Feed RPC creates
-- a successful food-consumption record.
--
-- The phone does not choose these stat values.
-- =========================================================

create or replace function
private.apply_companion_care_after_food()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text;

  v_hunger integer := 0;
  v_happiness integer := 0;
  v_health integer := 0;
  v_bond integer := 0;
begin

  select category
  into v_category
  from private.companion_food_catalog
  where food_id = new.food_id;


  if v_category is null then
    return new;
  end if;


  -- First apply any time-based decay.
  perform
    private.refresh_companion_care(
      new.user_id
    );


  -- ---------------------------------------------
  -- TREATS
  -- Mostly happiness.
  -- ---------------------------------------------
  if v_category = 'treat' then

    v_hunger := 8;
    v_happiness := 15;
    v_health := 2;
    v_bond := 3;


  -- ---------------------------------------------
  -- FRUIT
  -- Balanced light food.
  -- ---------------------------------------------
  elsif v_category = 'fruit' then

    v_hunger := 15;
    v_happiness := 8;
    v_health := 5;
    v_bond := 4;


  -- ---------------------------------------------
  -- DRINKS
  -- Better recovery.
  -- ---------------------------------------------
  elsif v_category = 'drink' then

    v_hunger := 10;
    v_happiness := 5;
    v_health := 8;
    v_bond := 3;


  -- ---------------------------------------------
  -- FULL MEALS
  -- Best normal hunger restoration.
  -- ---------------------------------------------
  elsif v_category = 'full_meal' then

    v_hunger := 35;
    v_happiness := 10;
    v_health := 10;
    v_bond := 5;


  -- ---------------------------------------------
  -- MYTHIC
  -- Strong companion boost.
  --
  -- Notice:
  -- It does NOT give extra leaderboard score.
  -- ---------------------------------------------
  elsif v_category = 'mythic' then

    v_hunger := 45;
    v_happiness := 20;
    v_health := 15;
    v_bond := 8;

  end if;


  -- Update the actual companion.
  update private.user_companion_progress
  set
    hunger =
      least(
        100,
        hunger + v_hunger
      ),

    happiness =
      least(
        100,
        happiness + v_happiness
      ),

    care_health =
      least(
        100,
        care_health + v_health
      ),

    bond_points =
      bond_points + v_bond,

    last_fed_at =
      clock_timestamp(),

    updated_at =
      clock_timestamp()

  where user_id = new.user_id
    and companion_id is not null;


  -- Save a care history record.
  insert into private.companion_care_events (
    user_id,
    companion_id,
    event_type,
    food_consumption_id,
    food_id,
    hunger_change,
    happiness_change,
    health_change,
    bond_change
  )
  values (
    new.user_id,
    new.companion_id,
    'feed',
    new.id,
    new.food_id,
    v_hunger,
    v_happiness,
    v_health,
    v_bond
  )
  on conflict (
    food_consumption_id
  )
  do nothing;


  -- Fixed Explorer Score for feeding.
  --
  -- The Explorer Score Engine handles:
  -- duplicates
  -- daily cap
  -- total score
  perform
    public.server_award_explorer_score(
      new.user_id,
      'companion_feed',
      new.id::text,
      jsonb_build_object(
        'companionId',
        new.companion_id,

        'foodId',
        new.food_id,

        'foodCategory',
        v_category
      )
    );


  -- See if this feeding action completed today's
  -- healthy-companion requirement.
  perform
    private.check_companion_healthy_day(
      new.user_id
    );


  return new;

end;
$$;


drop trigger if exists
  companion_care_after_food
on private.companion_food_consumptions;


create trigger
  companion_care_after_food

after insert
on private.companion_food_consumptions

for each row
execute function
  private.apply_companion_care_after_food();


-- =========================================================
-- 9. SERVER READ FUNCTION
-- =========================================================
--
-- Purpose:
-- Lets trusted Mission Trails backend code read the current
-- Tamagotchi care stats.
-- =========================================================

create or replace function
public.server_get_companion_care(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress
    private.user_companion_progress%rowtype;
begin

  -- Apply real-time decay first.
  perform
    private.refresh_companion_care(
      p_user_id
    );


  select *
  into v_progress
  from private.user_companion_progress
  where user_id = p_user_id;


  if not found
    or v_progress.companion_id is null
  then

    return jsonb_build_object(
      'companionId', null,
      'hunger', 0,
      'happiness', 0,
      'health', 0,
      'careStreak', 0,
      'lastFedAt', null,
      'lastHealthyDate', null
    );

  end if;


  return jsonb_build_object(
    'companionId',
    v_progress.companion_id,

    'hunger',
    v_progress.hunger,

    'happiness',
    v_progress.happiness,

    'health',
    v_progress.care_health,

    'careStreak',
    v_progress.care_streak,

    'lastFedAt',
    v_progress.last_fed_at,

    'lastHealthyDate',
    v_progress.last_healthy_date
  );

end;
$$;


-- =========================================================
-- 10. SECURITY
-- =========================================================
-- Mobile users cannot manually award themselves care points.
-- =========================================================

revoke all
on function public.server_get_companion_care(uuid)
from public, anon, authenticated;

grant execute
on function public.server_get_companion_care(uuid)
to service_role;


commit;
