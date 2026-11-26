-- ============================================================================
-- NUBCONNECT — Migration 016: extend marketplace categories
--
-- Adds the two categories required by the product spec that the original
-- seed (003) did not include. Idempotent; additive only — no rows are
-- modified or removed.
-- ============================================================================

INSERT INTO marketplace_categories (slug, name) VALUES
  ('bicycles-transport', 'Bicycles & Transport'),
  ('services',           'Services')
ON CONFLICT (slug) DO NOTHING;
