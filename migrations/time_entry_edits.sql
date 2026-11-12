-- Office edits to crew time: who, when, why, and the original times.
alter table public.time_entries
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid,
  add column if not exists edit_note text,
  add column if not exists original_clock_in timestamptz,
  add column if not exists original_clock_out timestamptz;
