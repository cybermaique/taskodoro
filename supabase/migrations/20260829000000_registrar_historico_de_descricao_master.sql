create table if not exists public.task_description_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  description text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_task_description_history_task_id_changed_at
  on public.task_description_history (task_id, changed_at desc);

alter table public.task_description_history enable row level security;

drop policy if exists "master_accesses_task_description_history" on public.task_description_history;
create policy "master_accesses_task_description_history" on public.task_description_history
for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'maiqued.18@gmail.com');

create or replace function public.record_master_task_description_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) = 'maiqued.18@gmail.com'
    and new.description is distinct from old.description then
    insert into public.task_description_history (task_id, description)
    values (old.id, old.description);
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_master_description_history on public.tasks;
create trigger tasks_master_description_history
after update of description on public.tasks
for each row
execute function public.record_master_task_description_history();

notify pgrst, 'reload schema';
