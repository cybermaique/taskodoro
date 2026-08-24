alter table public.tasks
  add column if not exists type text not null default 'task';

alter table public.tasks
  drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('feature', 'bug', 'improvement', 'task'));

create index if not exists idx_tasks_type on public.tasks (type);

notify pgrst, 'reload schema';
