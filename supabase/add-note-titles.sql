-- Execute uma vez no SQL Editor para adicionar títulos às anotações existentes.
-- Não remove anotações nem altera created_at/updated_at.

begin;

alter table public.notes add column if not exists title text;

do $$
declare
  has_updated_at_trigger boolean;
begin
  select exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.notes'::regclass
      and tgname = 'notes_set_updated_at'
      and not tgisinternal
  ) into has_updated_at_trigger;

  if has_updated_at_trigger then
    execute 'alter table public.notes disable trigger notes_set_updated_at';
  end if;

  update public.notes
  set title = coalesce(
    nullif(
      left(
        (
          select regexp_replace(btrim(line), '^#+\s*', '')
          from regexp_split_to_table(notes.content, E'\\r?\\n') as line
          where btrim(line) <> ''
            and btrim(line) !~ '^[#=_*[:space:]-]+$'
          limit 1
        ),
        160
      ),
      ''
    ),
    'Anotação sem título'
  )
  where title is null or btrim(title) = '';

  if has_updated_at_trigger then
    execute 'alter table public.notes enable trigger notes_set_updated_at';
  end if;
end;
$$;

alter table public.notes alter column title set not null;

commit;

notify pgrst, 'reload schema';
