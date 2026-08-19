-- Restaura a visibilidade de dados criados antes da coluna user_id.
-- É seguro executar somente quando este projeto possuir UMA conta em auth.users.
-- Se houver mais de uma conta, o script falha sem alterar nada.

begin;

do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  select count(*) into owner_count from auth.users;

  if owner_count <> 1 then
    raise exception
      'Foram encontradas % contas. Defina manualmente o user_id dos dados antigos para a conta correta.',
      owner_count;
  end if;

  select id into owner_id from auth.users limit 1;

  update public.tasks
  set user_id = owner_id
  where user_id is null;

  update public.notes
  set user_id = owner_id
  where user_id is null;
end;
$$;

commit;

notify pgrst, 'reload schema';
