alter table public.tasks drop constraint if exists tasks_status_check;

update public.tasks
set status = case
  when status = 'pending' then 'not_started'
  when status = 'canceled' then 'waiting'
  else status
end;

alter table public.tasks alter column status set default 'not_started';

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('not_started', 'in_progress', 'waiting', 'completed'));
