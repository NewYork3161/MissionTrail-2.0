begin;

-- =========================================================
-- EXPLORER COIN IN-APP PURCHASE SYSTEM
--
-- Purpose:
-- Connects verified Apple / Google purchases to the existing
-- Explorer Coin wallet and permanent coin ledger.
--
-- IMPORTANT:
-- The phone NEVER gets permission to directly add coins.
-- Only the secure backend can call the credit function below.
-- =========================================================


-- =========================================================
-- ALLOW IAP PURCHASES IN THE EXISTING COIN LEDGER
-- =========================================================

alter table private.coin_ledger
  drop constraint if exists coin_ledger_source_type_check;

alter table private.coin_ledger
  add constraint coin_ledger_source_type_check
  check (
    source_type in (
      'mission',
      'food_purchase',
      'iap_purchase',
      'admin',
      'event'
    )
  );


-- =========================================================
-- STORE PRODUCTS
--
-- Purpose:
-- The SERVER decides how many coins each store product gives.
-- The client cannot choose the number of coins.
-- =========================================================

create table if not exists private.iap_products (
  id uuid primary key default gen_random_uuid(),

  platform text not null
    check (
      platform in (
        'ios',
        'android'
      )
    ),

  product_id text not null,

  coin_amount bigint not null
    check (coin_amount > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    platform,
    product_id
  )
);


-- =========================================================
-- REGISTER FIRST APPLE PRODUCT
--
-- Apple App Store Connect:
-- 500 Explorer Coins
-- Product ID:
-- com.missiontrails.explorercoins.500
-- =========================================================

insert into private.iap_products (
  platform,
  product_id,
  coin_amount,
  is_active
)
values (
  'ios',
  'com.missiontrails.explorercoins.500',
  500,
  true
)
on conflict (
  platform,
  product_id
)
do update set
  coin_amount = excluded.coin_amount,
  is_active = excluded.is_active,
  updated_at = clock_timestamp();


-- =========================================================
-- VERIFIED IAP TRANSACTIONS
--
-- Purpose:
-- Saves every store transaction that already awarded coins.
--
-- The unique transaction rule prevents one Apple purchase
-- from being redeemed over and over.
-- =========================================================

create table if not exists private.iap_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  platform text not null
    check (
      platform in (
        'ios',
        'android'
      )
    ),

  store_transaction_id text not null,

  product_id text not null,

  coins_granted bigint not null
    check (coins_granted > 0),

  environment text,

  purchase_date timestamptz,

  verified_at timestamptz not null
    default clock_timestamp(),

  created_at timestamptz not null
    default clock_timestamp(),

  unique (
    platform,
    store_transaction_id
  ),

  foreign key (
    platform,
    product_id
  )
  references private.iap_products (
    platform,
    product_id
  )
);


create index if not exists
  iap_transactions_user_created_idx
on private.iap_transactions (
  user_id,
  created_at desc
);


-- =========================================================
-- CREDIT A VERIFIED STORE PURCHASE
--
-- Purpose:
-- Called ONLY by our secure backend AFTER Apple/Google
-- verifies that the transaction is real.
--
-- It:
-- 1. Finds the server-owned product/coin amount.
-- 2. Blocks duplicate transaction IDs.
-- 3. Creates the user's wallet if needed.
-- 4. Locks the wallet.
-- 5. Adds the Explorer Coins.
-- 6. Updates lifetime earned coins.
-- 7. Adds a permanent ledger record.
-- =========================================================

drop function if exists
  public.server_credit_verified_iap(
    uuid,
    text,
    text,
    text,
    text,
    timestamptz
  );


create function public.server_credit_verified_iap(
  p_user_id uuid,
  p_platform text,
  p_store_transaction_id text,
  p_product_id text,
  p_environment text default null,
  p_purchase_date timestamptz default null
)
returns table (
  granted boolean,
  result_code text,
  coins_granted bigint,
  new_balance bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product private.iap_products%rowtype;
  v_wallet private.user_coin_wallet%rowtype;

  v_transaction_id uuid;
  v_existing_transaction private.iap_transactions%rowtype;

  v_new_balance bigint;
begin

  -- ---------------------------------------------
  -- Basic validation
  -- ---------------------------------------------

  if p_user_id is null
     or p_platform is null
     or p_store_transaction_id is null
     or btrim(p_store_transaction_id) = ''
     or p_product_id is null
     or btrim(p_product_id) = ''
  then
    return query select
      false,
      'INVALID_REQUEST',
      0::bigint,
      0::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Load SERVER-owned product information
  --
  -- The client cannot tell us how many coins
  -- should be granted.
  -- ---------------------------------------------

  select *
  into v_product
  from private.iap_products
  where iap_products.platform = p_platform
    and iap_products.product_id = p_product_id
    and iap_products.is_active;

  if not found then
    return query select
      false,
      'INVALID_PRODUCT',
      0::bigint,
      0::bigint;

    return;
  end if;


  -- ---------------------------------------------
  -- Register transaction FIRST
  --
  -- UNIQUE(platform, store_transaction_id)
  -- prevents the same purchase from being
  -- credited twice.
  -- ---------------------------------------------

  insert into private.iap_transactions (
    user_id,
    platform,
    store_transaction_id,
    product_id,
    coins_granted,
    environment,
    purchase_date
  )
  values (
    p_user_id,
    p_platform,
    p_store_transaction_id,
    p_product_id,
    v_product.coin_amount,
    p_environment,
    p_purchase_date
  )
  on conflict (
    platform,
    store_transaction_id
  )
  do nothing
  returning id
  into v_transaction_id;


  -- ---------------------------------------------
  -- Transaction was already used
  -- ---------------------------------------------

  if v_transaction_id is null then

    select *
    into v_existing_transaction
    from private.iap_transactions
    where platform = p_platform
      and store_transaction_id =
        p_store_transaction_id;

    select *
    into v_wallet
    from private.user_coin_wallet
    where user_id = p_user_id;

    return query select
      false,
      'ALREADY_GRANTED',
      coalesce(
        v_existing_transaction.coins_granted,
        0
      ),
      coalesce(
        v_wallet.balance,
        0
      );

    return;
  end if;


  -- ---------------------------------------------
  -- Create wallet if the user does not have one
  -- ---------------------------------------------

  insert into private.user_coin_wallet (
    user_id
  )
  values (
    p_user_id
  )
  on conflict (
    user_id
  )
  do nothing;


  -- ---------------------------------------------
  -- Lock wallet while changing the balance
  --
  -- This prevents two simultaneous purchases
  -- from overwriting each other.
  -- ---------------------------------------------

  select *
  into strict v_wallet
  from private.user_coin_wallet
  where user_id = p_user_id
  for update;


  -- ---------------------------------------------
  -- Add purchased Explorer Coins
  -- ---------------------------------------------

  v_new_balance :=
    v_wallet.balance
    + v_product.coin_amount;


  update private.user_coin_wallet
  set
    balance = v_new_balance,

    lifetime_earned =
      lifetime_earned
      + v_product.coin_amount,

    updated_at =
      clock_timestamp()

  where user_id = p_user_id;


  -- ---------------------------------------------
  -- Permanent Explorer Coin ledger record
  -- ---------------------------------------------

  insert into private.coin_ledger (
    user_id,
    source_type,
    source_id,
    coin_delta,
    balance_after
  )
  values (
    p_user_id,
    'iap_purchase',
    p_platform || ':' || p_store_transaction_id,
    v_product.coin_amount,
    v_new_balance
  );


  -- ---------------------------------------------
  -- Successful credit
  -- ---------------------------------------------

  return query select
    true,
    'GRANTED',
    v_product.coin_amount,
    v_new_balance;

end;
$$;


-- =========================================================
-- SECURITY
--
-- The mobile app is NOT allowed to call this function.
-- Only Supabase's server/service role may execute it.
-- =========================================================

revoke all
on function public.server_credit_verified_iap(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;


grant execute
on function public.server_credit_verified_iap(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
)
to service_role;


commit;
