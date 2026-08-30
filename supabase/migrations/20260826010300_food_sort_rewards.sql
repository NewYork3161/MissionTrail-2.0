begin;

-- =========================================================
-- MISSION TRAILS - FOOD SORT REWARDS
-- =========================================================
-- Purpose:
-- Gives Companion Food Sort real server-owned rewards.
--
-- Level 1 win:
-- +50 Explorer Score
-- +1 Ember Carrot
-- +1 Aurora Pudding
-- +5 Companion Bond
-- +5 Companion Happiness
--
-- Free food / companion rewards:
-- Maximum 3 rewarded wins per day.
--
-- Players may keep playing afterward for game score and
-- capped Explorer Score.
-- =========================================================


-- =========================================================
-- 1. FOOD SORT GAME RUNS
-- =========================================================

create table if not exists private.food_sort_runs (
  id uuid primary key
    default extensions.gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  level_id text not null
    default 'level-1',

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'completed',
        'abandoned'
      )
    ),

  score integer not null
    default 0
    check (
      score between 0 and 10000000
    ),

  moves_remaining integer
    check (
      moves_remaining
      between 0 and 20
    ),

  rewarded boolean not null
    default false,

  started_at timestamptz not null
    default now(),

  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- Purpose:
-- Makes recent game-history checks fast.
create index if not exists
  food_sort_runs_user_time_idx
on private.food_sort_runs (
  user_id,
  started_at desc
);


-- Only one active Food Sort run at a time.
create unique index if not exists
  food_sort_one_active_run_per_user
on private.food_sort_runs (
  user_id
)
where status = 'active';


-- =========================================================
-- 2. FOOD REWARD HISTORY
-- =========================================================

create table if not exists
private.food_sort_reward_items (
  run_id uuid not null
    references private.food_sort_runs(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  food_id text not null
    references private.companion_food_catalog(food_id),

  quantity integer not null
    check (quantity > 0),

  created_at timestamptz not null
    default now(),

  primary key (
    run_id,
    food_id
  )
);


-- =========================================================
-- 3. START FOOD SORT
-- =========================================================
--
-- Purpose:
-- Creates a server record when Level 1 starts.
--
-- Starting a new game automatically abandons an unfinished
-- previous game.
-- =========================================================

create or replace function
public.server_start_food_sort_run()
returns table (
  run_id uuid,
  started boolean,
  result_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_run_id uuid;
begin

  if v_user_id is null then

    return query
    select
      null::uuid,
      false,
      'UNAUTHORIZED'::text;

    return;

  end if;


  -- Abandon an old unfinished run.
  update private.food_sort_runs
  set
    status = 'abandoned',
    updated_at = clock_timestamp()
  where user_id = v_user_id
    and status = 'active';


  -- Create the new game run.
  insert into private.food_sort_runs (
    user_id,
    level_id,
    status
  )
  values (
    v_user_id,
    'level-1',
    'active'
  )
  returning id
  into v_run_id;


  return query
  select
    v_run_id,
    true,
    'STARTED'::text;

end;
$$;


-- =========================================================
-- 4. COMPLETE FOOD SORT
-- =========================================================
--
-- IMPORTANT:
-- The phone never chooses:
-- - Explorer Score amount
-- - Food type
-- - Food quantity
-- - Bond amount
-- - Happiness amount
--
-- Those rewards are all controlled here.
--
-- This MVP prevents:
-- duplicate claims
-- fake reward amounts
-- unlimited free-food farming
--
-- Later we can make the server replay every game move for
-- stronger tournament-level anti-cheat.
-- =========================================================

create or replace function
public.server_complete_food_sort_run(
  p_run_id uuid,
  p_score integer,
  p_moves_remaining integer
)
returns table (
  completed boolean,
  rewarded boolean,
  result_code text,
  explorer_points integer,
  carrot_quantity integer,
  treat_quantity integer,
  rewarded_wins_today integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_run
    private.food_sort_runs%rowtype;

  v_context record;

  v_previous_rewards integer := 0;

  v_points_result jsonb;

  v_points integer := 0;

  v_companion_id text;
begin

  -- -----------------------------------------
  -- LOGIN CHECK
  -- -----------------------------------------

  if v_user_id is null then

    return query
    select
      false,
      false,
      'UNAUTHORIZED'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- -----------------------------------------
  -- BASIC GAME VALUE CHECK
  -- -----------------------------------------

  if p_score < 0
    or p_score > 10000000
    or p_moves_remaining < 0
    or p_moves_remaining > 20
  then

    return query
    select
      false,
      false,
      'INVALID_GAME_RESULT'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- -----------------------------------------
  -- LOAD THIS PLAYER'S GAME
  -- -----------------------------------------

  select *
  into v_run
  from private.food_sort_runs
  where id = p_run_id
    and user_id = v_user_id
  for update;


  if not found then

    return query
    select
      false,
      false,
      'RUN_NOT_FOUND'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- Already completed means no second reward.
  if v_run.status = 'completed' then

    return query
    select
      true,
      v_run.rewarded,
      'ALREADY_COMPLETED'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  if v_run.status <> 'active' then

    return query
    select
      false,
      false,
      'RUN_NOT_ACTIVE'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- A Level 1 win cannot realistically happen instantly.
  -- This blocks simple instant-reward spam.
  if clock_timestamp()
    < v_run.started_at
      + interval '15 seconds'
  then

    return query
    select
      false,
      false,
      'RUN_TOO_FAST'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- -----------------------------------------
  -- SAVE THE COMPLETED RUN
  -- -----------------------------------------

  update private.food_sort_runs
  set
    status = 'completed',
    score = p_score,
    moves_remaining =
      p_moves_remaining,
    completed_at =
      clock_timestamp(),
    updated_at =
      clock_timestamp()
  where id = v_run.id;


  -- -----------------------------------------
  -- AWARD EXPLORER SCORE
  -- -----------------------------------------
  --
  -- The existing Explorer Score Engine decides
  -- the amount and daily cap.
  -- -----------------------------------------

  v_points_result :=
    public.server_award_explorer_score(
      v_user_id,
      'food_sort_win',
      v_run.id::text,
      jsonb_build_object(
        'levelId',
        v_run.level_id,
        'gameScore',
        p_score,
        'movesRemaining',
        p_moves_remaining
      )
    );


  v_points :=
    coalesce(
      (
        v_points_result
        ->> 'awardedPoints'
      )::integer,
      0
    );


  -- -----------------------------------------
  -- GET PLAYER'S LOCAL DAY
  -- -----------------------------------------

  select *
  into strict v_context
  from private.user_local_context(
    v_user_id,
    clock_timestamp()
  );


  -- Count previous FREE-FOOD rewards today.
  select count(*)
  into v_previous_rewards
  from private.food_sort_runs
  where user_id = v_user_id
    and rewarded = true
    and id <> v_run.id
    and completed_at is not null
    and (
      completed_at
      at time zone
      v_context.timezone_name
    )::date
      = v_context.local_date;


  -- =====================================================
  -- 3 FREE-REWARD WINS MAXIMUM PER DAY
  -- =====================================================

  if v_previous_rewards >= 3 then

    return query
    select
      true,
      false,
      'SCORE_ONLY'::text,
      v_points,
      0,
      0,
      v_previous_rewards;

    return;

  end if;


  -- -----------------------------------------
  -- EMBER CARROT x1
  -- -----------------------------------------

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'ember-carrot',
    1,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (
    user_id,
    food_id
  )
  do update set
    quantity =
      public.companion_food_inventory.quantity
      + 1,

    updated_at =
      clock_timestamp();


  insert into private.food_sort_reward_items (
    run_id,
    user_id,
    food_id,
    quantity
  )
  values (
    v_run.id,
    v_user_id,
    'ember-carrot',
    1
  )
  on conflict do nothing;


  -- -----------------------------------------
  -- AURORA PUDDING x1
  -- -----------------------------------------

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'aurora-pudding',
    1,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (
    user_id,
    food_id
  )
  do update set
    quantity =
      public.companion_food_inventory.quantity
      + 1,

    updated_at =
      clock_timestamp();


  insert into private.food_sort_reward_items (
    run_id,
    user_id,
    food_id,
    quantity
  )
  values (
    v_run.id,
    v_user_id,
    'aurora-pudding',
    1
  )
  on conflict do nothing;


  -- -----------------------------------------
  -- COMPANION PLAY REWARD
  -- -----------------------------------------
  --
  -- First refresh any time-based care decay.
  -- -----------------------------------------

  perform
    private.refresh_companion_care(
      v_user_id
    );


  select companion_id
  into v_companion_id
  from private.user_companion_progress
  where user_id = v_user_id;


  if v_companion_id is not null then

    update private.user_companion_progress
    set
      bond_points =
        bond_points + 5,

      happiness =
        least(
          100,
          happiness + 5
        ),

      updated_at =
        clock_timestamp()
    where user_id = v_user_id;


    -- Save a readable care-history event.
    insert into private.companion_care_events (
      user_id,
      companion_id,
      event_type,
      happiness_change,
      bond_change
    )
    values (
      v_user_id,
      v_companion_id,
      'play',
      5,
      5
    );

  end if;


  -- Mark this run as one of today's rewarded wins.
  update private.food_sort_runs
  set
    rewarded = true,
    updated_at =
      clock_timestamp()
  where id = v_run.id;


  return query
  select
    true,
    true,
    'REWARDED'::text,

    v_points,

    1,
    1,

    v_previous_rewards + 1;

end;
$$;


-- =========================================================
-- 5. SECURITY
-- =========================================================

revoke all
on function
public.server_start_food_sort_run()
from public, anon, authenticated;

grant execute
on function
public.server_start_food_sort_run()
to authenticated;


revoke all
on function
public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
from public, anon, authenticated;

grant execute
on function
public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
to authenticated;


commit;
