begin;

-- =========================================================
-- 1. COMPANION GROWTH
-- HP here means companion growth HP, not battle health.
-- =========================================================

alter table private.user_companion_progress
  add column if not exists growth_hp bigint not null default 0
    check (growth_hp >= 0),
  add column if not exists companion_level integer not null default 1
    check (companion_level >= 1);


-- HP required to advance FROM a level to the next level.
--
-- Level 1 -> 2 = 100 HP
-- Requirements gradually increase afterward.
create or replace function private.companion_hp_required_for_level(
  p_level integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(
    100 * power(greatest(1, p_level)::numeric, 1.25)
  )::integer;
$$;


create or replace function private.companion_level_from_hp(
  p_total_hp bigint
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
  v_remaining bigint := greatest(0, p_total_hp);
  v_required integer;
begin
  loop
    v_required :=
      private.companion_hp_required_for_level(v_level);

    exit when v_remaining < v_required;

    v_remaining := v_remaining - v_required;
    v_level := v_level + 1;
  end loop;

  return v_level;
end;
$$;


-- =========================================================
-- 2. ALLOW FOOD TO AWARD REAL USER XP
-- =========================================================

do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select constraint_info.conname
    from pg_catalog.pg_constraint as constraint_info
    join pg_catalog.pg_class as table_info
      on table_info.oid = constraint_info.conrelid
    join pg_catalog.pg_namespace as namespace_info
      on namespace_info.oid = table_info.relnamespace
    where namespace_info.nspname = 'private'
      and table_info.relname = 'xp_ledger'
      and constraint_info.contype = 'c'
      and pg_catalog.pg_get_constraintdef(
        constraint_info.oid
      ) ilike '%source_type%'
  loop
    execute format(
      'alter table private.xp_ledger drop constraint %I',
      v_constraint
    );
  end loop;
end
$$;

alter table private.xp_ledger
  add constraint xp_ledger_source_type_check
  check (
    source_type in (
      'relic_collection',
      'mission',
      'companion_food',
      'admin'
    )
  );


-- =========================================================
-- 3. MASTER FOOD CATALOG
--
-- drop_weight:
-- bigger number = more common
--
-- Treats:       common
-- Fruit:        common/uncommon
-- Drinks:       uncommon
-- Full meals:   rare
-- Mythic boost: very rare
-- =========================================================

create table if not exists private.companion_food_catalog (
  food_id text primary key,
  display_name text not null,

  category text not null check (
    category in (
      'treat',
      'fruit',
      'drink',
      'full_meal',
      'mythic'
    )
  ),

  rarity text not null check (
    rarity in (
      'common',
      'uncommon',
      'rare',
      'mythic'
    )
  ),

  companion_hp integer not null
    check (companion_hp > 0),

  user_xp integer not null
    check (user_xp > 0),

  drop_weight integer not null
    check (drop_weight > 0),

  is_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


insert into private.companion_food_catalog (
  food_id,
  display_name,
  category,
  rarity,
  companion_hp,
  user_xp,
  drop_weight
)
values

-- =========================================================
-- TREATS / SWEETS
-- Common, lowest rewards
-- =========================================================
('aurora-pudding',   'Aurora Pudding',   'treat', 'common', 6, 4, 18),
('comet-cupcake',    'Comet Cupcake',    'treat', 'common', 5, 3, 18),
('galaxy-donut',     'Galaxy Donut',     'treat', 'common', 7, 5, 18),
('novah-waffle',     'Novah Waffle',     'treat', 'common', 6, 4, 18),
('pixel-macaron',    'Pixel Macaron',    'treat', 'common', 3, 2, 18),
('star-biscuit',     'Star Biscuit',     'treat', 'common', 2, 1, 18),

-- =========================================================
-- FRUIT / QUICK ENERGY
-- Common + Uncommon
-- =========================================================
('cosmic-berry',       'Cosmic Berry',       'fruit', 'uncommon', 9,  7, 14),
('ember-carrot',       'Ember Carrot',       'fruit', 'common',   8,  6, 14),
('icy-frost-melon',    'Icy Frost Melon',    'fruit', 'uncommon', 10, 8, 14),
('neon-apple',         'Neon Apple',         'fruit', 'common',   6,  5, 14),
('plasma-grapes',      'Plasma Grapes',      'fruit', 'uncommon', 11, 9, 14),
('rainbow-starfruit',  'Rainbow Starfruit',  'fruit', 'uncommon', 12, 10, 14),
('solar-mango',        'Solar Mango',        'fruit', 'common',   7,  6, 14),

-- =========================================================
-- DRINKS / RECOVERY
-- Uncommon
-- =========================================================
('dream-tea',             'Dream Tea',             'drink', 'uncommon', 10, 8, 10),
('electro-water-bottle',  'Electro Water Bottle',  'drink', 'uncommon', 15, 12, 10),
('moon-milk',             'Moon Milk',             'drink', 'uncommon', 12, 10, 10),
('stamina-smooth',        'Stamina Smooth',        'drink', 'uncommon', 14, 11, 10),
('sunbeam-soup',          'Sunbeam Soup',          'drink', 'uncommon', 9,  7, 10),

-- =========================================================
-- PROTEIN / FULL MEALS
-- Rare + high rewards
-- =========================================================
('energy-steak',       'Energy Steak',       'full_meal', 'rare', 38, 32, 3),
('meteor-burger',      'Meteor Burger',      'full_meal', 'rare', 32, 26, 3),
('power-bowl',         'Power Bowl',         'full_meal', 'rare', 28, 23, 3),
('salmon',             'Salmon',             'full_meal', 'rare', 35, 29, 3),
('turbo-drumstick',    'Turbo Drumstick',    'full_meal', 'rare', 40, 34, 3),

-- =========================================================
-- MYTHIC BOOST
-- Very rare + highest rewards
-- =========================================================
('crystal-rock',       'Crystal Rock',       'mythic', 'mythic', 48, 40, 1),
('cyber-lollipop',     'Cyber Lollipop',     'mythic', 'mythic', 45, 38, 1),
('infinity-candy',     'Infinity Candy',     'mythic', 'mythic', 60, 50, 1),
('jelly-beans',        'Jelly Beans',        'mythic', 'mythic', 50, 42, 1),
('quantum-gummy',      'Quantum Gummy',      'mythic', 'mythic', 65, 55, 1),
('stardust-taffy',     'Stardust Taffy',     'mythic', 'mythic', 55, 46, 1),
('time-crystal-cake',  'Time Crystal Cake',  'mythic', 'mythic', 80, 70, 1)

on conflict (food_id)
do update set
  display_name = excluded.display_name,
  category = excluded.category,
  rarity = excluded.rarity,
  companion_hp = excluded.companion_hp,
  user_xp = excluded.user_xp,
  drop_weight = excluded.drop_weight,
  is_enabled = true,
  updated_at = clock_timestamp();


-- =========================================================
-- 4. USER FOOD INVENTORY
--
-- No rows are created for new users.
-- UI will therefore show every catalog item as x0.
--
-- quantity is bigint so duplicates can stack extremely high.
-- =========================================================

create table if not exists public.companion_food_inventory (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  food_id text not null
    references private.companion_food_catalog(food_id),

  quantity bigint not null default 0
    check (quantity >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, food_id)
);

alter table public.companion_food_inventory
  enable row level security;

revoke all
on public.companion_food_inventory
from public, anon;

grant select
on public.companion_food_inventory
to authenticated;

drop policy if exists
  companion_food_inventory_read_own
on public.companion_food_inventory;

create policy
  companion_food_inventory_read_own
on public.companion_food_inventory
for select
to authenticated
using (
  auth.uid() = user_id
);


-- =========================================================
-- 5. MISSION FOOD REWARD LEDGER
--
-- One food reward maximum for each mission completion.
-- =========================================================

create table if not exists private.companion_food_mission_rewards (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  mission_completion_id uuid not null
    references private.daily_mission_completion(id)
    on delete cascade,

  food_id text not null
    references private.companion_food_catalog(food_id),

  quantity_awarded integer not null default 1
    check (quantity_awarded > 0),

  created_at timestamptz not null default now(),

  unique (mission_completion_id)
);


-- =========================================================
-- 6. RANDOM FOOD AFTER SUCCESSFUL MISSION CLAIM
--
-- Weighted random:
-- Treats are common.
-- Full meals are rare.
-- Mythic boosts are very rare.
-- =========================================================

create or replace function
private.reward_random_food_after_mission_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_food_id text;
begin
  if new.status <> 'claimed' then
    return new;
  end if;

  if old.status = 'claimed' then
    return new;
  end if;

  select progress.user_id
  into v_user_id
  from private.user_daily_progress as progress
  where progress.id = new.daily_progress_id;

  if v_user_id is null then
    return new;
  end if;

  -- Guard against any repeated trigger/replay.
  if exists (
    select 1
    from private.companion_food_mission_rewards
    where mission_completion_id = new.id
  ) then
    return new;
  end if;

  -- Weighted random selection.
  --
  -- Larger drop_weight makes a food more likely to win
  -- this random race.
  select catalog.food_id
  into v_food_id
  from private.companion_food_catalog as catalog
  where catalog.is_enabled
  order by
    -ln(greatest(random(), 0.000000001))
    / catalog.drop_weight
  limit 1;

  if v_food_id is null then
    return new;
  end if;

  insert into private.companion_food_mission_rewards (
    user_id,
    mission_completion_id,
    food_id,
    quantity_awarded
  )
  values (
    v_user_id,
    new.id,
    v_food_id,
    1
  );

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_food_id,
    1,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (user_id, food_id)
  do update set
    quantity =
      public.companion_food_inventory.quantity
      + excluded.quantity,
    updated_at = clock_timestamp();

  return new;
end;
$$;


drop trigger if exists
  reward_random_food_after_mission_claim
on private.daily_mission_completion;

create trigger
  reward_random_food_after_mission_claim
after update of status
on private.daily_mission_completion
for each row
when (
  old.status is distinct from new.status
  and new.status = 'claimed'
)
execute function
  private.reward_random_food_after_mission_claim();


-- =========================================================
-- 7. FOOD CONSUMPTION LEDGER
--
-- Every Feed press gets a unique server record.
-- That row becomes the source_id for user XP.
-- =========================================================

create table if not exists private.companion_food_consumptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  companion_id text not null,

  food_id text not null
    references private.companion_food_catalog(food_id),

  companion_hp_awarded integer not null
    check (companion_hp_awarded > 0),

  user_xp_awarded integer not null
    check (user_xp_awarded > 0),

  consumed_at timestamptz not null default now()
);


-- =========================================================
-- 8. SECURE FEED RPC
--
-- One transaction:
--
-- quantity -1
-- companion HP +
-- companion level recalculated
-- user XP ledger +
--
-- No client-selected XP or HP values are accepted.
-- =========================================================

drop function if exists
  public.server_consume_companion_food(text);

create function
public.server_consume_companion_food(
  p_food_id text
)
returns table (
  consumed boolean,
  result_code text,

  food_id text,
  food_name text,
  rarity text,

  hp_awarded integer,
  xp_awarded integer,

  remaining_quantity bigint,

  old_companion_hp bigint,
  new_companion_hp bigint,

  old_companion_level integer,
  new_companion_level integer,

  old_total_xp bigint,
  new_total_xp bigint,

  old_user_level integer,
  new_user_level integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();

  v_food private.companion_food_catalog%rowtype;
  v_companion private.user_companion_progress%rowtype;

  v_consumption_id uuid;

  v_remaining_quantity bigint;

  v_old_hp bigint;
  v_new_hp bigint;

  v_old_companion_level integer;
  v_new_companion_level integer;

  v_old_total_xp bigint;
  v_new_total_xp bigint;

  v_old_user_level integer;
  v_new_user_level integer;
begin

  -- -----------------------------
  -- Authentication
  -- -----------------------------
  if v_user_id is null then
    return query select
      false,
      'UNAUTHORIZED',
      p_food_id,
      null::text,
      null::text,
      0,
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      1,
      1,
      0::bigint,
      0::bigint,
      1,
      1;

    return;
  end if;


  -- -----------------------------
  -- Food definition
  -- -----------------------------
  select *
  into v_food
  from private.companion_food_catalog
  where companion_food_catalog.food_id = p_food_id
    and is_enabled;

  if not found then
    return query select
      false,
      'INVALID_FOOD',
      p_food_id,
      null::text,
      null::text,
      0,
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      1,
      1,
      0::bigint,
      0::bigint,
      1,
      1;

    return;
  end if;


  -- -----------------------------
  -- Lock active companion
  -- -----------------------------
  select *
  into v_companion
  from private.user_companion_progress
  where user_id = v_user_id
  for update;

  if not found
     or v_companion.companion_id is null
  then
    return query select
      false,
      'NO_ACTIVE_COMPANION',
      v_food.food_id,
      v_food.display_name,
      v_food.rarity,
      0,
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      1,
      1,
      0::bigint,
      0::bigint,
      1,
      1;

    return;
  end if;


  -- -----------------------------
  -- Consume exactly one inventory item
  -- -----------------------------
  update public.companion_food_inventory
  set
    quantity = quantity - 1,
    updated_at = clock_timestamp()
  where user_id = v_user_id
    and companion_food_inventory.food_id = p_food_id
    and quantity > 0
  returning quantity
  into v_remaining_quantity;

  if not found then
    return query select
      false,
      'OUT_OF_STOCK',
      v_food.food_id,
      v_food.display_name,
      v_food.rarity,
      0,
      0,
      0::bigint,
      v_companion.growth_hp,
      v_companion.growth_hp,
      v_companion.companion_level,
      v_companion.companion_level,
      0::bigint,
      0::bigint,
      1,
      1;

    return;
  end if;


  -- -----------------------------
  -- Companion HP + Level
  -- -----------------------------
  v_old_hp :=
    greatest(0, v_companion.growth_hp);

  v_new_hp :=
    v_old_hp + v_food.companion_hp;

  v_old_companion_level :=
    private.companion_level_from_hp(
      v_old_hp
    );

  v_new_companion_level :=
    private.companion_level_from_hp(
      v_new_hp
    );

  update private.user_companion_progress
  set
    growth_hp = v_new_hp,
    companion_level = v_new_companion_level,
    updated_at = clock_timestamp()
  where user_id = v_user_id;


  -- -----------------------------
  -- Consumption record
  -- -----------------------------
  insert into private.companion_food_consumptions (
    user_id,
    companion_id,
    food_id,
    companion_hp_awarded,
    user_xp_awarded
  )
  values (
    v_user_id,
    v_companion.companion_id,
    v_food.food_id,
    v_food.companion_hp,
    v_food.user_xp
  )
  returning id
  into v_consumption_id;


  -- -----------------------------
  -- Real lifetime User XP
  -- -----------------------------
  select coalesce(
    sum(xp_delta),
    0
  )::bigint
  into v_old_total_xp
  from private.xp_ledger
  where user_id = v_user_id;

  v_old_user_level :=
    private.player_level_from_xp(
      v_old_total_xp
    );

  insert into private.xp_ledger (
    user_id,
    source_type,
    source_id,
    xp_delta,
    idempotency_key
  )
  values (
    v_user_id,
    'companion_food',
    v_consumption_id,
    v_food.user_xp,
    concat(
      v_user_id,
      ':companion-food:',
      v_consumption_id
    )
  );

  v_new_total_xp :=
    v_old_total_xp + v_food.user_xp;

  v_new_user_level :=
    private.player_level_from_xp(
      v_new_total_xp
    );


  -- -----------------------------
  -- Response
  -- -----------------------------
  return query select
    true,
    'CONSUMED',

    v_food.food_id,
    v_food.display_name,
    v_food.rarity,

    v_food.companion_hp,
    v_food.user_xp,

    v_remaining_quantity,

    v_old_hp,
    v_new_hp,

    v_old_companion_level,
    v_new_companion_level,

    v_old_total_xp,
    v_new_total_xp,

    v_old_user_level,
    v_new_user_level;
end;
$$;


revoke all
on function public.server_consume_companion_food(text)
from public, anon;

grant execute
on function public.server_consume_companion_food(text)
to authenticated;


-- =========================================================
-- 9. RETURN HP + LEVEL WITH EXISTING COMPANION PROGRESS
-- =========================================================

create or replace function
public.server_get_companion_progress(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress private.user_companion_progress%rowtype;
  v_config private.companion_reward_config%rowtype;

  v_level integer;
  v_hp_before_level bigint := 0;
  v_hp_into_level bigint := 0;
  v_hp_required integer := 100;
  v_counter integer;
begin

  select *
  into strict v_config
  from private.companion_reward_config
  where singleton;

  select *
  into v_progress
  from private.user_companion_progress
  where user_id = p_user_id;


  if not found
     or v_progress.companion_id is null
  then
    return jsonb_build_object(
      'companionId', null,

      'bondPoints', 0,
      'bondTier', 1,
      'bondPercent', 0,

      'energy', 0,
      'maximumEnergy',
        v_config.maximum_energy,

      'growthHp', 0,
      'companionLevel', 1,
      'hpIntoLevel', 0,
      'hpRequired', 100
    );
  end if;


  v_level :=
    private.companion_level_from_hp(
      v_progress.growth_hp
    );

  if v_level > 1 then
    for v_counter in 1..(v_level - 1)
    loop
      v_hp_before_level :=
        v_hp_before_level
        + private.companion_hp_required_for_level(
            v_counter
          );
    end loop;
  end if;

  v_hp_into_level :=
    greatest(
      0,
      v_progress.growth_hp
      - v_hp_before_level
    );

  v_hp_required :=
    private.companion_hp_required_for_level(
      v_level
    );


  return jsonb_build_object(
    'companionId',
      v_progress.companion_id,

    'bondPoints',
      greatest(
        0,
        v_progress.bond_points
      ),

    'bondTier',
      floor(
        greatest(
          0,
          v_progress.bond_points
        )::numeric
        / v_config.bond_points_per_tier
      ) + 1,

    'bondPercent',
      least(
        100,
        greatest(
          0,
          floor(
            mod(
              greatest(
                0,
                v_progress.bond_points
              ),
              v_config.bond_points_per_tier
            )::numeric
            * 100
            / v_config.bond_points_per_tier
          )
        )
      ),

    'energy',
      least(
        v_config.maximum_energy,
        greatest(
          0,
          v_progress.energy
        )
      ),

    'maximumEnergy',
      v_config.maximum_energy,

    'growthHp',
      greatest(
        0,
        v_progress.growth_hp
      ),

    'companionLevel',
      v_level,

    'hpIntoLevel',
      v_hp_into_level,

    'hpRequired',
      v_hp_required
  );
end;
$$;

commit;
