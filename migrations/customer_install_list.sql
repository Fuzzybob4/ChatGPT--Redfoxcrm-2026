-- Office can hand-edit a customer's install list for the season without
-- touching the invoice (or Square). When set for the current season, this list
-- is what the office page and the crew job page show.
alter table public.customers
  add column if not exists install_items jsonb,
  add column if not exists install_items_season date,
  add column if not exists install_items_updated_at timestamptz;
