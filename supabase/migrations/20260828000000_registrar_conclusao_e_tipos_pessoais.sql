alter table public.subtasks
  add column if not exists completed_at timestamptz;

update public.subtasks
set completed_at = updated_at
where is_completed = true and completed_at is null;

alter table public.tasks
  drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('feature', 'bug', 'improvement', 'task', 'date', 'study', 'travel', 'health', 'finance', 'personal'));

update public.tasks
set type = case
  when lower(coalesce(category, '')) in ('estudo', 'estudos') then 'study'
  when lower(coalesce(category, '')) = 'viagem' then 'travel'
  when lower(coalesce(category, '')) in ('saúde', 'saude') then 'health'
  when lower(coalesce(category, '')) = 'financeiro' then 'finance'
  else 'personal'
end
where lower(coalesce(category, '')) in ('pessoal', 'estudo', 'estudos', 'viagem', 'saúde', 'saude', 'financeiro', 'casa', 'conteúdo', 'conteudo', 'outros')
  and type in ('feature', 'bug', 'improvement', 'task');

update public.tasks
set category = case
  when lower(coalesce(category, '')) in ('pessoal', 'estudo', 'estudos', 'viagem', 'saúde', 'saude', 'financeiro', 'casa', 'conteúdo', 'conteudo', 'outros') then 'pessoal'
  else 'trabalho'
end;

alter table public.tasks
  drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('feature', 'bug', 'improvement', 'task', 'date', 'study', 'travel', 'health', 'finance', 'personal'));

notify pgrst, 'reload schema';
