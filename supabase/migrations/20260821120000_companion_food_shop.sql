begin;

-- =========================================================
-- EXPLORER COIN WALLET
-- =========================================================

create table if not exists private.user_coin_wallet (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  balance bigint not null default 0
    check (balance >= 0),

  lifetime_earned bigint not null default 0
    check (lifetime_earned >= 0),

  lifetime_spent bigint not null default 0
    check (lifetime_spent >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- COIN LEDGER
-- Every coin change gets a permanent server record.
-- =========================================================

create table if not exists private.coin_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  source_type text not null check (
    source_type in (
      'mission',
      'food_purchase',
      'admin',
      'event'
    )
  ),

  source_id text,

  coin_delta bigint not null
    check (coin_delta <> 0),

  balance_after bigint not null
    check (balance_after >= 0),

  created_at timestamptz not null default now()
);

create index if not exists
  coin_ledger_user_created_idx
on private.coin_ledger (
  user_id,
  created_at desc
);


-- =========================================================
-- ADD SHOP SETTINGS TO EXISTING FOOD CATALOG
-- =========================================================

alter table private.companion_food_catalog
  add column if not exists shop_price bigint
    check (
      shop_price is null
      or shop_price > 0
    ),

  add column if not exists purchasable boolean
    not null default false;


-- =========================================================
-- SHOP PRICES
--
-- Common foods:   40 - 90
-- Uncommon:      110 - 180
-- Rare meals:    350 - 550
-- Mythic:        mission/event exclusive
-- =========================================================

update private.companion_food_catalog
set
  purchasable = true,
  shop_price = case food_id

    -- Treats / Common
    when 'aurora-pudding' then 70
    when 'comet-cupcake' then 60
    when 'galaxy-donut' then 80
    when 'novah-waffle' then 70
    when 'pixel-macaron' then 50
    when 'star-biscuit' then 40

    -- Fruit
    when 'cosmic-berry' then 130
    when 'ember-carrot' then 90
    when 'icy-frost-melon' then 150
    when 'neon-apple' then 75
    when 'plasma-grapes' then 165
    when 'rainbow-starfruit' then 180
    when 'solar-mango' then 85

    -- Recovery Drinks
    when 'dream-tea' then 120
    when 'electro-water-bottle' then 180
    when 'moon-milk' then 145
    when 'stamina-smooth' then 165
    when 'sunbeam-soup' then 110

    -- Full Meals
    when 'energy-steak' then 500
    when 'meteor-burger' then 425
    when 'power-bowl' then 350
    when 'salmon' then 450
    when 'turbo-drumstick' then 550

    else shop_price
  end
where rarity in (
  'common',
  'uncommon',
  'rare'
);


-- Mythics stay special.
update private.companion_food_catalog
set
  purchasable = false,
  shop_price = null
where rarity = 'mythic';


-- =========================================================
-- READ CURRENT WALLET
-- =========================================================

create or replace function public.server_get_coin_wallet()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet private.user_coin_wallet%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  insert into private.user_coin_wallet (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (user_id)
  do nothing;

  select *
  into strict v_wallet
  from private.user_coin_wallet
  where user_id = v_user_id;

  return jsonb_build_object(
    'balance', v_wallet.balance,
    'lifetimeEarned', v_wallet.lifetime_earned,
    'lifetimeSpent', v_wallet.lifetime_spent
  );
end;
$$;

revoke all
on function public.server_get_coin_wallet()
from public, anon;

grant execute
on function public.server_get_coin_wallet()
to authenticated;


-- =========================================================
-- READ FOOD SHOP
--
-- Client receives prices from the server.
-- =========================================================

create or replace function public.server_get_companion_food_shop()
returns table (
  food_id text,
  display_name text,
  category text,
  rarity text,
  companion_hp integer,
  user_xp integer,
  shop_price bigint,
  purchasable boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    catalog.food_id,
    catalog.display_name,
    catalog.category,
    catalog.rarity,
    catalog.companion_hp,
    catalog.user_xp,
    catalog.shop_price,
    catalog.purchasable
  from private.companion_food_catalog as catalog
  where catalog.is_enabled
  order by
    case catalog.rarity
      when 'common' then 1
      when 'uncommon' then 2
      when 'rare' then 3
      when 'mythic' then 4
      else 5
    end,
    catalog.display_name;
$$;

revoke all
on function public.server_get_companion_food_shop()
from public, anon;

grant execute
on function public.server_get_companion_food_shop()
to authenticated;


-- =========================================================
-- SECURE FOOD PURCHASE
--
-- IMPORTANT:
-- Client sends ONLY food_id + quantity.
-- Client NEVER supplies price.
-- =========================================================

drop function if exists
  public.server_purchase_companion_food(
    text,
    integer
  );

create function public.server_purchase_companion_food(
  p_food_id text,
  p_quantity integer default 1
)
returns table (
  purchased boolean,
  result_code text,

  food_id text,
  food_name text,

  quantity_purchased integer,
  unit_price bigint,
  total_price bigint,

  old_balance bigint,
  new_balance bigint,

  new_food_quantity bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();

  v_food private.companion_food_catalog%rowtype;
  v_wallet private.user_coin_wallet%rowtype;

  v_total_price bigint;
  v_new_balance bigint;
  v_new_food_quantity bigint;
begin

  -- ---------------------------------------------
  -- Authentication
  -- ---------------------------------------------

  if v_user_id is null then
    return query select
      false,
      'UNAUTHORIZED',
      p_food_id,
      null::text,
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Quantity validation
  -- ---------------------------------------------

  if p_quantity is null
     or p_quantity < 1
     or p_quantity > 99
  then
    return query select
      false,
      'INVALID_QUANTITY',
      p_food_id,
      null::text,
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Load food + SERVER price
  -- ---------------------------------------------

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
      0,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Exclusive food protection
  -- ---------------------------------------------

  if not v_food.purchasable
     or v_food.shop_price is null
  then
    return query select
      false,
      'NOT_PURCHASABLE',
      v_food.food_id,
      v_food.display_name,
      0,
      coalesce(v_food.shop_price, 0),
      0::bigint,
      0::bigint,
      0::bigint,
      0::bigint;

    return;
  end if;


  v_total_price :=
    v_food.shop_price * p_quantity;


  -- ---------------------------------------------
  -- Create wallet if needed
  -- ---------------------------------------------

  insert into private.user_coin_wallet (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (user_id)
  do nothing;


  -- ---------------------------------------------
  -- Lock wallet during purchase
  -- ---------------------------------------------

  select *
  into strict v_wallet
  from private.user_coin_wallet
  where user_id = v_user_id
  for update;


  if v_wallet.balance < v_total_price then
    return query select
      false,
      'INSUFFICIENT_COINS',
      v_food.food_id,
      v_food.display_name,
      0,
      v_food.shop_price,
      v_total_price,
      v_wallet.balance,
      v_wallet.balance,
      coalesce(
        (
          select inventory.quantity
          from public.companion_food_inventory
            as inventory
          where inventory.user_id = v_user_id
            and inventory.food_id = v_food.food_id
        ),
        0
      )::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Spend coins
  -- ---------------------------------------------

  v_new_balance :=
    v_wallet.balance - v_total_price;

  update private.user_coin_wallet
  set
    balance = v_new_balance,
    lifetime_spent =
      lifetime_spent + v_total_price,
    updated_at = clock_timestamp()
  where user_id = v_user_id;


  -- ---------------------------------------------
  -- Add purchased food
  -- ---------------------------------------------

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_food.food_id,
    p_quantity,
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
      + excluded.quantity,

    updated_at = clock_timestamp()

  returning quantity
  into v_new_food_quantity;


  -- ---------------------------------------------
  -- Coin ledger
  -- ---------------------------------------------

  insert into private.coin_ledger (
    user_id,
    source_type,
    source_id,
    coin_delta,
    balance_after
  )
  values (
    v_user_id,
    'food_purchase',
    v_food.food_id,
    -v_total_price,
    v_new_balance
  );


  -- ---------------------------------------------
  -- Success response
  -- ---------------------------------------------

  return query select
    true,
    'PURCHASED',
    v_food.food_id,
    v_food.display_name,
    p_quantity,
    v_food.shop_price,
    v_total_price,
    v_wallet.balance,
    v_new_balance,
    v_new_food_quantity;
end;
$$;


revoke all
on function public.server_purchase_companion_food(
  text,
  integer
)
from public, anon;

grant execute
on function public.server_purchase_companion_food(
  text,
  integer
)
to authenticated;


commit;
