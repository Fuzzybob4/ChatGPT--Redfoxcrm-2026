-- Webhook upserts ON CONFLICT (provider_payment_id); a partial index can't serve that.
alter table public.payments add constraint payments_provider_payment_id_key unique (provider_payment_id);
drop index if exists public.payments_provider_payment_id_unique;
