-- Execute este script no SQL Editor do Supabase

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'waiting', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  type text not null default 'feature' check (type in ('feature', 'bug', 'improvement', 'date', 'study', 'travel', 'health', 'finance', 'personal')),
  category text,
  position integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status text check (from_status is null or from_status in ('not_started', 'in_progress', 'waiting', 'completed')),
  to_status text not null check (to_status in ('not_started', 'in_progress', 'waiting', 'completed')),
  changed_at timestamptz not null default now()
);

create table if not exists public.task_description_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  description text,
  changed_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  file_size bigint,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_date_details (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  age integer,
  sign text,
  address text,
  height text,
  work text,
  met_via text,
  has_children boolean,
  location text,
  date_at date,
  personality_rating smallint check (personality_rating between 1 and 10),
  face_rating smallint check (face_rating between 1 and 10),
  body_rating smallint check (body_rating between 1 and 10),
  sex_rating smallint check (sex_rating between 1 and 10)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

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

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

alter table public.task_attachments
  drop constraint if exists task_attachments_mime_type_check;

create index if not exists idx_tasks_created_at_desc on public.tasks (created_at desc);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_priority on public.tasks (priority);
create index if not exists idx_tasks_type on public.tasks (type);
create index if not exists idx_tasks_category on public.tasks (category);
create index if not exists idx_tasks_position on public.tasks (position);
create index if not exists idx_tasks_deleted_at on public.tasks (deleted_at);
create index if not exists idx_task_status_history_task_id_changed_at
  on public.task_status_history (task_id, changed_at asc);
create index if not exists idx_task_description_history_task_id_changed_at
  on public.task_description_history (task_id, changed_at desc);
create index if not exists idx_subtasks_task_id on public.subtasks (task_id);
create index if not exists idx_subtasks_task_id_position on public.subtasks (task_id, position);
create index if not exists idx_task_attachments_task_id on public.task_attachments (task_id);
create index if not exists idx_task_comments_task_id_created_at on public.task_comments (task_id, created_at);

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

drop trigger if exists subtasks_set_updated_at on public.subtasks;
create trigger subtasks_set_updated_at
before update on public.subtasks
for each row
execute function public.set_updated_at();

-- ── notes ──────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  tags text[],
  is_pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_created_at_desc on public.notes (created_at desc);
create index if not exists idx_notes_pinned_created_at on public.notes (is_pinned, created_at desc);
create index if not exists idx_notes_deleted_at on public.notes (deleted_at);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

notify pgrst, 'reload schema';

-- ── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Usuário',
  avatar_url text,
  accent_color text not null default 'teal'
    check (accent_color in ('teal', 'cyan', 'blue', 'indigo', 'violet', 'fuchsia', 'rose', 'orange', 'amber', 'emerald')),
  display_mode text not null default 'full'
    check (display_mode in ('full', 'compact')),
  task_column_widths jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  file_size bigint,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', false)
on conflict (id) do nothing;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Usuários acessam o próprio perfil" on public.profiles;
create policy "Usuários acessam o próprio perfil" on public.profiles
for all to authenticated
using (id = auth.uid()) with check (id = auth.uid());

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Usuários gerenciam o próprio avatar" on storage.objects;
create policy "Usuários gerenciam o próprio avatar" on storage.objects
for all to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authentication and per-user data isolation (Supabase Auth + RLS)
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_description_history enable row level security;
alter table public.task_date_details enable row level security;
alter table public.task_comments enable row level security;
alter table public.note_attachments enable row level security;

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

drop policy if exists "Usuários acessam anexos próprios" on public.task_attachments;
create policy "Usuários acessam anexos próprios" on public.task_attachments for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = task_attachments.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = task_attachments.task_id and tasks.user_id = auth.uid()));

create policy "Usuários acessam detalhes Date próprios" on public.task_date_details for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = task_date_details.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = task_date_details.task_id and tasks.user_id = auth.uid()));

create policy "Usuários acessam comentários próprios" on public.task_comments for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = task_comments.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = task_comments.task_id and tasks.user_id = auth.uid()));

create policy "Usuários acessam anexos de notas próprios" on public.note_attachments for all to authenticated
using (exists (select 1 from public.notes where notes.id = note_attachments.note_id and notes.user_id = auth.uid()))
with check (exists (select 1 from public.notes where notes.id = note_attachments.note_id and notes.user_id = auth.uid()));

drop policy if exists "Usuários acessam arquivos próprios" on storage.objects;
create policy "Usuários acessam arquivos próprios" on storage.objects for all to authenticated
using (bucket_id = 'task-attachments' and exists (select 1 from public.tasks where tasks.id::text = (storage.foldername(name))[1] and tasks.user_id = auth.uid()))
with check (bucket_id = 'task-attachments' and exists (select 1 from public.tasks where tasks.id::text = (storage.foldername(name))[1] and tasks.user_id = auth.uid()));

create policy "Usuários acessam arquivos de notas próprios" on storage.objects for all to authenticated
using (bucket_id = 'note-attachments' and exists (select 1 from public.notes where notes.id::text = (storage.foldername(name))[1] and notes.user_id = auth.uid()))
with check (bucket_id = 'note-attachments' and exists (select 1 from public.notes where notes.id::text = (storage.foldername(name))[1] and notes.user_id = auth.uid()));

drop policy if exists "task_status_history_user_access" on public.task_status_history;
create policy "task_status_history_user_access" on public.task_status_history for all to authenticated
using (exists (select 1 from public.tasks where tasks.id = task_status_history.task_id and tasks.user_id = auth.uid()))
with check (exists (select 1 from public.tasks where tasks.id = task_status_history.task_id and tasks.user_id = auth.uid()));

drop policy if exists "master_accesses_task_description_history" on public.task_description_history;
create policy "master_accesses_task_description_history" on public.task_description_history
for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'maiqued.18@gmail.com');
