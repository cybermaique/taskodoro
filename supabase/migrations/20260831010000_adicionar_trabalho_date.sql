alter table public.task_date_details
  add column if not exists work text;

notify pgrst, 'reload schema';
