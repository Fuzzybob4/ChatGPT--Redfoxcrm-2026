-- Business plan, and allow every Stripe subscription status in our mirror table.
alter table public.subscriptions drop constraint if exists subscriptions_plan_type_check;
alter table public.subscriptions add constraint subscriptions_plan_type_check check (plan_type = any (array['starter','professional','business','enterprise']));
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (status = any (array['active','cancelled','canceled','suspended','trial','trialing','past_due','unpaid','incomplete','incomplete_expired','paused']));
