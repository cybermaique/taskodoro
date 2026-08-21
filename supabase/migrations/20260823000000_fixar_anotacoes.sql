-- Permite destacar anotações de uso frequente em uma área minimalista.
alter table public.notes
  add column if not exists is_pinned boolean not null default false;

create index if not exists idx_notes_pinned_created_at
  on public.notes (is_pinned, created_at desc);

notify pgrst, 'reload schema';
