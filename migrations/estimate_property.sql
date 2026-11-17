alter table public.estimates add column if not exists property_id uuid references public.customer_properties(id) on delete set null;
