-- Perfil leve por usuário para personalização e preferências de usabilidade.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Usuário',
  avatar_url text,
  accent_color text not null default 'teal'
    check (accent_color in ('teal', 'violet', 'amber', 'rose')),
  compact_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

notify pgrst, 'reload schema';
