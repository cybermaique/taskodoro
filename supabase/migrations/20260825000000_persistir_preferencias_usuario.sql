-- Migra a preferência de visualização e as larguras do Kanban para o perfil.
alter table public.profiles
  add column if not exists display_mode text not null default 'full';

alter table public.profiles
  add column if not exists task_column_widths jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'compact_mode'
  ) then
    update public.profiles
    set display_mode = case when compact_mode then 'compact' else 'full' end
    where display_mode = 'full';
  end if;
end $$;

alter table public.profiles
  drop constraint if exists profiles_accent_color_check;

alter table public.profiles
  add constraint profiles_accent_color_check
  check (accent_color in ('teal', 'cyan', 'blue', 'indigo', 'violet', 'fuchsia', 'rose', 'orange', 'amber', 'emerald'));

alter table public.profiles
  drop constraint if exists profiles_display_mode_check;

alter table public.profiles
  add constraint profiles_display_mode_check
  check (display_mode in ('full', 'compact'));

alter table public.profiles drop column if exists compact_mode;

notify pgrst, 'reload schema';
