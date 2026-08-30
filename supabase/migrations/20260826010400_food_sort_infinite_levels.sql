begin;

-- =========================================================
-- MISSION TRAILS - INFINITE FOOD SORT LEVELS
-- =========================================================
-- Purpose:
-- Saves each player's Food Sort progression permanently.
--
-- Food Sort can now continue:
-- Level 1
-- Level 2
-- Level 3
-- ...
-- Level 1000
-- Level 10000
-- forever.
-- =========================================================


-- =========================================================
-- 1. SAVE THE LEVEL NUMBER ON EACH GAME RUN
-- =========================================================

alter table private.food_sort_runs
  add column if not exists level_number integer
  not null default 1
  check (level_number >= 1);


-- =========================================================
-- 2. PLAYER FOOD SORT PROGRESS
-- =========================================================

create table if not exists private.food_sort_progress (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  current_level integer not null
    default 1
    check (current_level >= 1),

  highest_level integer not null
    default 1
    check (highest_level >= 1),

  total_wins integer not null
    default 0
    check (total_wins >= 0),

  highest_score integer not null
    default 0
    check (highest_score >= 0),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- =========================================================
-- 3. READ FOOD SORT PROGRESS
-- =========================================================
-- Purpose:
-- Returns the player's permanent Food Sort level.
-- =========================================================

create or replace function
public.server_get_food_sort_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_progress
    private.food_sort_progress%rowtype;
begin

  if v_user_id is null then
    return jsonb_build_object(
      'authorized', false,
      'currentLevel', 1,
      'highestLevel', 1,
      'totalWins', 0,
      'highestScore', 0
    );
  end if;


  insert into private.food_sort_progress (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (
    user_id
  )
  do nothing;


  select *
  into strict v_progress
  from private.food_sort_progress
  where user_id =
    v_user_id;


  return jsonb_build_object(
    'authorized', true,

    'currentLevel',
    v_progress.current_level,

    'highestLevel',
    v_progress.highest_level,

    'totalWins',
    v_progress.total_wins,

    'highestScore',
    v_progress.highest_score
  );

end;
$$;


-- =========================================================
-- 4. START THE PLAYER'S CURRENT LEVEL
-- =========================================================
-- Purpose:
-- Food Sort level numbers come from Supabase,
-- not from a number supplied by the phone.
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

  v_level integer;
begin

  if v_user_id is null then

    return query
    select
      null::uuid,
      false,
      'UNAUTHORIZED'::text;

    return;

  end if;


  -- Make sure this player has a progression row.
  insert into private.food_sort_progress (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (
    user_id
  )
  do nothing;


  -- The SERVER decides which level the player is on.
  select current_level
  into strict v_level
  from private.food_sort_progress
  where user_id =
    v_user_id;


  -- Only one active game is allowed.
  update private.food_sort_runs
  set
    status =
      'abandoned',

    updated_at =
      clock_timestamp()
  where user_id =
    v_user_id

    and status =
      'active';


  insert into private.food_sort_runs (
    user_id,
    level_id,
    level_number,
    status
  )
  values (
    v_user_id,

    concat(
      'level-',
      v_level
    ),

    v_level,

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
-- 5. ADVANCE LEVEL AFTER A REAL COMPLETION
-- =========================================================
-- Purpose:
-- Every time a run changes from active to completed:
--
-- total wins +1
-- highest score updates
-- highest completed level updates
-- next level unlocks
--
-- Triggering on the database status change prevents
-- the phone from directly editing progression.
-- =========================================================

create or replace function
private.advance_food_sort_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if
    old.status <> 'completed'
    and
    new.status = 'completed'
  then

    insert into private.food_sort_progress (
      user_id,
      current_level,
      highest_level,
      total_wins,
      highest_score
    )
    values (
      new.user_id,

      new.level_number + 1,

      new.level_number,

      1,

      new.score
    )
    on conflict (
      user_id
    )
    do update set

      current_level =
        greatest(
          private.food_sort_progress.current_level,
          new.level_number + 1
        ),

      highest_level =
        greatest(
          private.food_sort_progress.highest_level,
          new.level_number
        ),

      total_wins =
        private.food_sort_progress.total_wins
        + 1,

      highest_score =
        greatest(
          private.food_sort_progress.highest_score,
          new.score
        ),

      updated_at =
        clock_timestamp();

  end if;


  return new;

end;
$$;


drop trigger if exists
  food_sort_advance_progress
on private.food_sort_runs;


create trigger
  food_sort_advance_progress

after update of status
on private.food_sort_runs

for each row
execute function
  private.advance_food_sort_progress();


-- =========================================================
-- 6. SECURITY
-- =========================================================

revoke all
on function
public.server_get_food_sort_progress()
from public, anon, authenticated;

grant execute
on function
public.server_get_food_sort_progress()
to authenticated;


revoke all
on function
public.server_start_food_sort_run()
from public, anon, authenticated;

grant execute
on function
public.server_start_food_sort_run()
to authenticated;


commit;
