# Taskboard

Organizador pessoal de tarefas, subtarefas, anexos e anotações, persistido no Supabase.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase (Postgres e Storage)
- Vercel
- ESLint

## Recursos

- CRUD de tarefas com prioridade, categoria, prazo, planejamento e recorrência
- Subtarefas por tarefa
- Anexos em tarefas
- Filtros, busca, agrupamento por prazo e ordenação manual
- Anotações com tags, prévia para textos extensos e visualização de JSON
- Títulos obrigatórios e datas de criação/atualização nas anotações
- Tema claro/escuro e proteção opcional via `APP_PASSWORD`

## Configuração

1. Crie um projeto no Supabase.
2. No SQL Editor, execute [`supabase/schema.sql`](supabase/schema.sql).
3. Crie `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
APP_PASSWORD=uma_senha_opcional
```

4. Instale e execute:

```bash
npm install
npm run dev
```

## Atualização de projeto existente

Não execute `schema.sql` novamente em um projeto que já possui dados: ele é o bootstrap de um projeto novo e também recria as políticas de acesso.

Para remover o recurso antigo de Pomodoro, execute apenas [`supabase/remove-pomodoro.sql`](supabase/remove-pomodoro.sql). O script remove campos e o histórico de sessões; essa exclusão é permanente.

Se `schema.sql` foi executado numa base existente e as tarefas/anotações desapareceram, execute [`supabase/restore-legacy-data-ownership.sql`](supabase/restore-legacy-data-ownership.sql). Ele reassocia dados sem `user_id` à única conta do projeto, sem apagar registros.

Para adicionar títulos às anotações de uma base já existente, execute [`supabase/add-note-titles.sql`](supabase/add-note-titles.sql). Ele cria títulos a partir do primeiro trecho útil de cada anotação, sem mudar as datas registradas.
