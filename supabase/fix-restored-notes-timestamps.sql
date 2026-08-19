-- Correção pontual para as notas cujo updated_at foi alterado na retomada do
-- projeto. Execute no SQL Editor somente após conferir o SELECT abaixo.

select id, content, created_at, updated_at
from public.notes
where updated_at = '2026-08-17 21:29:43.843588+00'::timestamptz
  and created_at in (
    '2026-05-21 21:14:26.092588+00'::timestamptz,
    '2026-08-06 11:37:31.560793+00'::timestamptz
  )
order by created_at;

-- As duas notas exibidas no resultado acima não foram editadas após a criação.
-- Portanto, restaure o updated_at para o created_at delas.
-- Remova o comentário da instrução abaixo depois de conferir o SELECT.
--
-- update public.notes
-- set updated_at = created_at
-- where updated_at = '2026-08-17 21:29:43.843588+00'::timestamptz
--   and created_at in (
--     '2026-05-21 21:14:26.092588+00'::timestamptz,
--     '2026-08-06 11:37:31.560793+00'::timestamptz
--   );
