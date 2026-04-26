# CLAUDE.md — JP App

## Visão geral

Assistente pessoal do Jorge (founder do STATE Innovation Center) com 5 módulos: Briefing matinal automatizado, Tasks (sync Google Tasks), Calendar (sync Google Calendar), Contatos (CRM pessoal) e Configurações. PWA mobile-first com identidade STATE forte.

## Stack final (não negociável)

```
Frontend:    Vite + React 19 + React Router DOM 7
Linguagem:   TypeScript em strict mode (desde commit 0)
Estilo:      CSS variables + CSS modules (sem Tailwind, sem shadcn)
Backend:     Funções serverless em /api/*.ts (Vercel)
Validação:   Zod (schemas de input em todo handler /api/*)
Banco:       Supabase (PostgreSQL) — SQL puro, sem ORM
Tipos DB:    supabase gen types typescript → src/types/database.ts
Auth:        JWT próprio + cookie httpOnly + bcrypt
IA:          @anthropic-ai/sdk — Haiku para parsing/curadoria, Sonnet para raciocínio pesado
Email:       Resend
Cron:        Vercel Cron (vercel.json)
RSS:         rss-parser
IMAP:        imapflow
Google:      googleapis (Tasks, Calendar, People)
Estado:      Context API + hooks tipados
Drag&Drop:   @dnd-kit/core
Datas:       date-fns + date-fns-tz (timezone-aware)
```

## O que NÃO usar

- ❌ Next.js — usar Vite + serverless
- ❌ Prisma — usar Supabase client + tipos gerados
- ❌ Tailwind / shadcn/ui — identidade autoral, CSS variables do protótipo
- ❌ Supabase Auth — JWT próprio; OAuth Google é só para escopos de API
- ❌ localStorage para auth — cookie httpOnly obrigatório
- ❌ Chamar IA em sequência — Promise.all para chamadas paralelas
- ❌ `.catch()` no Supabase JS — usar `await + try/catch` ou `.then(null, fn)`
- ❌ Funções de IA sem `maxDuration` no vercel.json
- ❌ Estado global espalhado — centralizar em hooks
- ❌ Validar só no frontend — Zod no backend é obrigatório
- ❌ Commitar .env.local — nunca no git

## TypeScript

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```

- `.ts` para lógica pura, `.tsx` para JSX. Vite com oxc não compila JSX em `.ts`
- Sem `any` salvo casos justificados com comentário explicando
- Tipos compartilhados em `src/types/`: `database.ts` (gerado), `api.ts` (z.infer), `domain.ts`

## Zod nos handlers

Todo handler `/api/*.ts`:
1. Define schema Zod no topo
2. `safeParse(req.body)` — retorna 400 se inválido
3. Exporta `z.infer<typeof Schema>` como tipo

Schemas compartilhados em `api/_schemas/`.

## Comandos

```bash
npm run dev          # servidor de desenvolvimento (Vite)
npm run build        # build de produção (tsc + vite build)
npm run preview      # testar build local
npm run db:types     # gerar src/types/database.ts via supabase CLI
npm run test         # rodar Vitest
vercel env pull      # baixar env vars do Vercel para .env.local
vercel dev           # servidor local com funções serverless
```

## Estrutura de pastas

```
jp-app/
├── api/                    # Backend serverless
│   ├── _supabase.ts        # Cliente singleton (service key)
│   ├── _middleware.ts      # requireAuth, requireAdmin
│   ├── _schemas/           # Schemas Zod compartilhados
│   ├── auth-login.ts
│   ├── auth-logout.ts
│   ├── auth-me.ts
│   └── ... (verbo-substantivo.ts)
├── src/
│   ├── main.tsx
│   ├── App.tsx             # Roteamento + AuthProvider
│   ├── api.ts              # Wrapper fetch tipado
│   ├── pages/              # Uma página por rota
│   ├── components/         # layout/, briefing/, tasks/, calendar/, contacts/, common/
│   ├── hooks/              # AuthProvider.tsx, useAuth.ts, useTasks.ts, ...
│   ├── lib/                # dates.ts, nlp/, colors.ts
│   ├── types/              # database.ts, api.ts, domain.ts
│   └── styles/globals.css  # CSS variables do protótipo (fonte da verdade)
├── supabase/migrations/
├── public/
├── vercel.json
├── .env.example
└── CLAUDE.md
```

## Hierarquia de autoridade quando em dúvida

1. Stack → BRIEFING.md seção 2
2. Visual → prototipo.html
3. Schema/endpoints/Calendar → BRIEFING.md seções 4, 5, 6
4. Padrões de código → BRIEFING.md Anexo A (Playbook)

Quando algo não estiver coberto, **pergunte antes de codar**.
