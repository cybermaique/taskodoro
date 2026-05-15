-- Execute este script no SQL Editor do Supabase

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'canceled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  category text,
  due_date date,
  planned_for date,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  focused_seconds integer not null default 0 check (focused_seconds >= 0),
  pomodoro_count integer not null default 0 check (pomodoro_count >= 0),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  recurring_parent_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  pomodoro_minutes integer check (pomodoro_minutes is null or pomodoro_minutes > 0),
  break_minutes integer check (break_minutes is null or break_minutes > 0)
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  completed_cycle boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_created_at_desc on public.tasks (created_at desc);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_planned_for on public.tasks (planned_for);
create index if not exists idx_tasks_priority on public.tasks (priority);
create index if not exists idx_tasks_category on public.tasks (category);
create index if not exists idx_tasks_recurrence on public.tasks (recurrence);
create index if not exists idx_subtasks_task_id on public.subtasks (task_id);
create index if not exists idx_focus_sessions_task_id on public.focus_sessions (task_id);
create index if not exists idx_focus_sessions_started_at on public.focus_sessions (started_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists subtasks_set_updated_at on public.subtasks;
create trigger subtasks_set_updated_at
before update on public.subtasks
for each row
execute function public.set_updated_at();

notify pgrst, 'reload schema';
