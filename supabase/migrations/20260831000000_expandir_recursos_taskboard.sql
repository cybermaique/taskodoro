alter table public.tasks add column if not exists position integer;
alter table public.tasks add column if not exists deleted_at timestamptz;
with ranked_tasks as (
  select id, row_number() over (partition by user_id order by created_at desc, id desc) - 1 as position
  from public.tasks
)
update public.tasks as tasks set position = ranked_tasks.position
from ranked_tasks where tasks.id = ranked_tasks.id and tasks.position is null;
alter table public.tasks alter column position set default 0;
alter table public.tasks alter column position set not null;
create index if not exists idx_tasks_position on public.tasks (position);
create index if not exists idx_tasks_deleted_at on public.tasks (deleted_at);

alter table public.task_attachments add column if not exists file_size bigint;
alter table public.task_attachments add column if not exists last_viewed_at timestamptz;

alter table public.notes add column if not exists deleted_at timestamptz;
create index if not exists idx_notes_deleted_at on public.notes (deleted_at);

create table if not exists public.task_date_details (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  age integer, sign text, address text, height text, work text, has_children boolean,
  location text, date_at date,
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
create index if not exists idx_task_comments_task_id_created_at on public.task_comments (task_id, created_at);

create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  file_name text not null, mime_type text not null, storage_path text not null unique,
  file_size bigint, created_at timestamptz not null default now()
);
insert into storage.buckets (id, name, public) values ('note-attachments', 'note-attachments', false) on conflict (id) do nothing;

alter table public.task_date_details enable row level security;
alter table public.task_comments enable row level security;
alter table public.note_attachments enable row level security;
create policy "Usuários acessam detalhes Date próprios" on public.task_date_details for all to authenticated using (exists (select 1 from public.tasks where tasks.id = task_date_details.task_id and tasks.user_id = auth.uid())) with check (exists (select 1 from public.tasks where tasks.id = task_date_details.task_id and tasks.user_id = auth.uid()));
create policy "Usuários acessam comentários próprios" on public.task_comments for all to authenticated using (exists (select 1 from public.tasks where tasks.id = task_comments.task_id and tasks.user_id = auth.uid())) with check (exists (select 1 from public.tasks where tasks.id = task_comments.task_id and tasks.user_id = auth.uid()));
create policy "Usuários acessam anexos de notas próprios" on public.note_attachments for all to authenticated using (exists (select 1 from public.notes where notes.id = note_attachments.note_id and notes.user_id = auth.uid())) with check (exists (select 1 from public.notes where notes.id = note_attachments.note_id and notes.user_id = auth.uid()));
create policy "Usuários acessam arquivos de notas próprios" on storage.objects for all to authenticated using (bucket_id = 'note-attachments' and exists (select 1 from public.notes where notes.id::text = (storage.foldername(name))[1] and notes.user_id = auth.uid())) with check (bucket_id = 'note-attachments' and exists (select 1 from public.notes where notes.id::text = (storage.foldername(name))[1] and notes.user_id = auth.uid()));
notify pgrst, 'reload schema';
