-- Persiste a ordem exibida das subtarefas para permitir reordenação por drag-and-drop.

alter table public.subtasks
  add column if not exists position integer;

with ranked_subtasks as (
  select
    id,
    row_number() over (
      partition by task_id
      order by created_at asc, id asc
    ) - 1 as position
  from public.subtasks
)
update public.subtasks as subtasks
set position = ranked_subtasks.position
from ranked_subtasks
where subtasks.id = ranked_subtasks.id
  and subtasks.position is null;

alter table public.subtasks
  alter column position set default 0,
  alter column position set not null;

create index if not exists idx_subtasks_task_id_position
  on public.subtasks (task_id, position);
