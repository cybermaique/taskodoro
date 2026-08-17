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

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

alter table public.task_attachments
  drop constraint if exists task_attachments_mime_type_check;

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
create index if not exists idx_task_attachments_task_id on public.task_attachments (task_id);

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

-- ── notes ──────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_created_at_desc on public.notes (created_at desc);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- Authentication and per-user data isolation (Supabase Auth + RLS)
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.subtasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.task_attachments enable row level security;

drop policy if exists "Usuários acessam as próprias tarefas" on public.tasks;
create policy "Usuários acessam as próprias tarefas" on public.tasks for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Usuários acessam as próprias notas" on public.notes;
create policy "Usuários acessam as próprias notas" on public.notes for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Usuários acessam subtarefas próprias" on public.subtasks;
create policy "Usuários acessam subtarefas próprias" on public.subtasks for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid()));

drop policy if exists "Usuários acessam sessões próprias" on public.focus_sessions;
create policy "Usuários acessam sessões próprias" on public.focus_sessions for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = focus_sessions.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = focus_sessions.task_id and tasks.user_id = auth.uid()));

drop policy if exists "Usuários acessam anexos próprios" on public.task_attachments;
create policy "Usuários acessam anexos próprios" on public.task_attachments for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = task_attachments.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = task_attachments.task_id and tasks.user_id = auth.uid()));

drop policy if exists "Usuários acessam arquivos próprios" on storage.objects;
create policy "Usuários acessam arquivos próprios" on storage.objects for all to authenticated
using (bucket_id = 'task-attachments' and exists (select 1 from public.tasks where tasks.id::text = (storage.foldername(name))[1] and tasks.user_id = auth.uid()))
with check (bucket_id = 'task-attachments' and exists (select 1 from public.tasks where tasks.id::text = (storage.foldername(name))[1] and tasks.user_id = auth.uid()));
