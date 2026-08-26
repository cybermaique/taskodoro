-- Mantém a ordem personalizada das anotações fixadas.
alter table public.notes
  add column if not exists pinned_position integer;

with ranked_pinned_notes as (
  select
    id,
    row_number() over (order by updated_at desc, id desc) - 1 as pinned_position
  from public.notes
  where is_pinned = true
)
update public.notes as notes
set pinned_position = ranked_pinned_notes.pinned_position
from ranked_pinned_notes
where notes.id = ranked_pinned_notes.id
  and notes.pinned_position is null;

create index if not exists idx_notes_pinned_position
  on public.notes (is_pinned, pinned_position);

notify pgrst, 'reload schema';
