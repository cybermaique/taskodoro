update public.tasks
set type = 'feature'
where type = 'task';

alter table public.tasks
  drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('feature', 'bug', 'improvement', 'date', 'study', 'travel', 'health', 'finance', 'personal'));

alter table public.tasks
  alter column type set default 'feature';

notify pgrst, 'reload schema';
