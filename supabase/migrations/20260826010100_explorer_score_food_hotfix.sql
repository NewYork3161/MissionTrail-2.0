begin;

-- =========================================================
-- EXPLORER SCORE + COMPANION FOOD HOTFIX
-- =========================================================
-- Purpose:
-- Keeps the existing companion feeding XP system working
-- with the new Explorer Score system.
--
-- The current Feed function uses:
-- source_type = 'companion_food'
--
-- So companion_food must stay in the allowed XP types.
-- =========================================================

alter table private.xp_ledger
  drop constraint if exists xp_ledger_source_type_check;

alter table private.xp_ledger
  add constraint xp_ledger_source_type_check
  check (
    source_type in (
      'relic_collection',
      'mission',
      'companion_food',
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

commit;
