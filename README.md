# Taskodoro

App pessoal de produtividade com tarefas persistidas no Supabase, subtarefas e Pomodoro.

## Stack

- Next.js 16 (App Router, compatível com requisito 14+)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase (Postgres)
- Vercel
- ESLint

## O que está implementado

- CRUD completo de tarefas
- Prioridade: `low | medium | high`
- Categoria (sugestões + entrada livre)
- Data limite (`due_date`)
- Subtarefas por tarefa (criar, concluir, remover)
- CTA para concluir tarefa quando 100% das subtarefas estiverem concluídas
- Filtros: status, prioridade, categoria e busca textual
- Agrupamento por prazo: `Vencidas`, `Hoje`, `Semana`, `Depois`, `Sem prazo`
- Pomodoro integrado a tarefa ativa (mantido)
- Alertas sonoros, visuais, notificação e título piscando
- Dark mode
- Proteção opcional via `APP_PASSWORD`

## Estrutura principal

```txt
app/
  api/
    access/route.ts
    tasks/route.ts
    tasks/[id]/route.ts
    tasks/[id]/subtasks/route.ts
    subtasks/[id]/route.ts
  layout.tsx
  page.tsx
components/
  dashboard.tsx
  task-form.tsx
  tasks-list.tsx
  pomodoro-panel.tsx
hooks/
  use-pomodoro.ts
lib/
  tasks.ts
  format.ts
types/
  task.ts
supabase/
  schema.sql
```

## 1) Supabase (novo projeto)

1. Crie o projeto no Supabase.
2. SQL Editor -> execute [`supabase/schema.sql`](supabase/schema.sql).
3. Em `Settings > API Keys`, copie:
- Project URL
- `service_role` key

## 2) Migração incremental (projeto que já tinha a V1 antiga)

Se você já tinha a tabela `tasks` antiga, rode este SQL:

```sql
alter table public.tasks
  add column if not exists priority text not null default 'medium',
  add column if not exists category text,
  add column if not exists due_date date;

alter table public.tasks
  drop constraint if exists tasks_priority_check;

alter table public.tasks
  add constraint tasks_priority_check check (priority in ('low', 'medium', 'high'));

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_priority on public.tasks (priority);
create index if not exists idx_tasks_category on public.tasks (category);
create index if not exists idx_subtasks_task_id on public.subtasks (task_id);

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
```

## 3) Variáveis de ambiente

Copie `.env.example` para `.env.local` (ou `.env`) e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
APP_PASSWORD=
```

`APP_PASSWORD` é opcional.

## 4) Rodar localmente

```bash
npm install
npm run dev
```

## 5) Deploy na Vercel

1. Suba para GitHub.
2. Importe o repo na Vercel.
3. Configure variáveis:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PASSWORD` (opcional)
4. Deploy.

## 6) Validação

```bash
npm run lint
npm run build
```

Status atual:
- `npm run lint` OK
- `npm run build` OK

## 7) Migração final para produtividade completa

Se o banco já existe, rode este SQL no Supabase antes de usar a versão final:

```sql
alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add column if not exists priority text not null default 'medium',
  add column if not exists category text,
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists planned_for date,
  add column if not exists estimated_minutes integer,
  add column if not exists focused_seconds integer not null default 0,
  add column if not exists pomodoro_count integer not null default 0,
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurring_parent_id uuid references public.tasks(id) on delete set null;

alter table public.tasks
  add constraint tasks_status_check check (status in ('pending', 'in_progress', 'completed', 'canceled'));

alter table public.tasks
  drop constraint if exists tasks_priority_check;

alter table public.tasks
  add constraint tasks_priority_check check (priority in ('low', 'medium', 'high'));

alter table public.tasks
  drop constraint if exists tasks_estimated_minutes_check;

alter table public.tasks
  add constraint tasks_estimated_minutes_check check (estimated_minutes is null or estimated_minutes > 0);

alter table public.tasks
  drop constraint if exists tasks_focused_seconds_check;

alter table public.tasks
  add constraint tasks_focused_seconds_check check (focused_seconds >= 0);

alter table public.tasks
  drop constraint if exists tasks_pomodoro_count_check;

alter table public.tasks
  add constraint tasks_pomodoro_count_check check (pomodoro_count >= 0);

alter table public.tasks
  drop constraint if exists tasks_recurrence_check;

alter table public.tasks
  add constraint tasks_recurrence_check check (recurrence in ('none', 'daily', 'weekly', 'monthly'));

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  completed_cycle boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_planned_for on public.tasks (planned_for);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
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
```
