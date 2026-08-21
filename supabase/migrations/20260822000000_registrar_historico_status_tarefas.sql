create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status text check (from_status is null or from_status in ('not_started', 'in_progress', 'waiting', 'completed')),
  to_status text not null check (to_status in ('not_started', 'in_progress', 'waiting', 'completed')),
  changed_at timestamptz not null default now()
);

create index if not exists idx_task_status_history_task_id_changed_at
  on public.task_status_history (task_id, changed_at asc);

alter table public.task_status_history enable row level security;

drop policy if exists "Usuários acessam histórico próprio" on public.task_status_history;
create policy "Usuários acessam histórico próprio" on public.task_status_history
for all to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_status_history.task_id
      and tasks.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_status_history.task_id
      and tasks.user_id = auth.uid()
  )
);

create or replace function public.record_task_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (task_id, from_status, to_status, changed_at)
    values (new.id, null, new.status, new.created_at);
  elsif new.status is distinct from old.status then
    insert into public.task_status_history (task_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_status_history on public.tasks;
create trigger tasks_status_history
after insert or update of status on public.tasks
for each row
execute function public.record_task_status_history();

insert into public.task_status_history (task_id, from_status, to_status, changed_at)
select tasks.id, null, tasks.status, tasks.created_at
from public.tasks
where not exists (
  select 1
  from public.task_status_history
  where task_status_history.task_id = tasks.id
);

notify pgrst, 'reload schema';
