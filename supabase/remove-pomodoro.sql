-- Remove dados e estrutura do Pomodoro de um projeto Supabase já existente.
-- Atenção: esta operação apaga permanentemente o histórico de sessões de foco.

drop table if exists public.focus_sessions;

alter table public.tasks
  drop column if exists focused_seconds,
  drop column if exists pomodoro_count,
  drop column if exists pomodoro_minutes,
  drop column if exists break_minutes;

notify pgrst, 'reload schema';
