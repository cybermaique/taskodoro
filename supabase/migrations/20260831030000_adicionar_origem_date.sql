alter table public.task_date_details
  add column if not exists met_via text;

notify pgrst, 'reload schema';
