# Lessons Learned — JP App

Registro de aprendizados técnicos relevantes para guiar futuros projetos.

---

## 1. TypeScript: exactOptionalPropertyTypes é rígido e vale a pena

**O que aconteceu:** `prop?: T` e `prop: T | undefined` são tipos diferentes com esta flag ativa. Passar `{ key: value | undefined }` onde se espera `{ key?: T }` gera erro de compilação.

**Regra:** Sempre usar spread condicional: `...(val != null ? { key: val } : {})`. Nunca `key: val ?? undefined`.

**Por que vale:** Força o código a ser explícito sobre "campo ausente" vs "campo com valor undefined". Pega bugs reais em tempo de compilação.

---

## 2. Supabase upsert: CONSTRAINT vs índice parcial

**O que aconteceu:** `onConflict: 'user_id,google_contact_id'` falhou com 3615 contatos porque havia um índice parcial (`WHERE google_contact_id IS NOT NULL`), não uma UNIQUE CONSTRAINT.

**Regra:** Para usar como arbiter em upsert, precisa de `ALTER TABLE ADD CONSTRAINT ... UNIQUE (col1, col2)` — não basta `CREATE UNIQUE INDEX`.

**Migrações:** Sempre verificar se o índice já existe antes de criar: `IF NOT EXISTS` ou checar no schema.

---

## 3. Google OAuth: mudança de escopo exige re-autorização

**O que aconteceu:** Mudamos `contacts.readonly` → `contacts` para habilitar write-back. Mas usuários que já autorizaram com o escopo antigo continuam com o token antigo — write-back silenciosamente falha.

**Regra:** Ao adicionar escopos OAuth, forçar re-autorização com `prompt: 'consent'` (já configurado) E comunicar ao usuário que ele precisa reconectar.

**Diagnóstico:** Adicionar `console.warn` explícito quando `google_refresh_token` ou `google_calendar_id` está null, antes do bloco try/catch. Erros silenciosos são perigosos.

---

## 4. Google write-back: sempre best-effort

**Padrão adotado:** Salvar localmente primeiro (Supabase). Depois tentar push para Google em bloco try/catch separado. Erro no Google NÃO falha o request.

**Por que:** Google API pode ter rate limit, token expirado, permissão revogada. O app local sempre funciona offline/degradado.

**Logging:** O catch deve logar com suficiente detalhe para debugging: `e.message` + `e.response?.data` para erros de API.

---

## 5. ESM em api/: extensões .js são obrigatórias

**Stack:** `@vercel/node` com `tsconfig.json` usando `"module": "NodeNext"`. Nesse modo, mesmo que os arquivos sejam `.ts`, os imports DEVEM usar extensão `.js`.

**Regra:** Todo import interno em `api/` deve terminar em `.js`: `import { fn } from './_module.js'`.

**Erro típico:** `ERR_MODULE_NOT_FOUND` em runtime mesmo com TypeScript compilando.

---

## 6. Strings duplicadas em JSX causam edição ambígua

**O que aconteceu:** `TasksPage.tsx` tinha dois `<Topbar title="Tasks" actions={<ThemeToggle />} />` idênticos (um no loading state, outro no render principal). Tentar editar um gerava erro "Found 2 matches".

**Regra:** Extrair JSX complexo para variável antes do return:
```tsx
const actions = <div>...</div>
// depois: <Topbar actions={actions} />
```

Isso também melhora legibilidade e evita duplicação.

---

## 7. Dois passos para merge semantics no sync Google

**Problema:** Sincronizar do Google não deve sobrescrever edições locais do usuário (ex: company/role que o usuário preencheu no app e que o Google não tem).

**Solução (two-pass upsert):**
- Pass 1: `ignoreDuplicates: true` — insere novos contatos com TODOS os campos (incluindo os do Google)
- Pass 2: sem ignoreDuplicates — atualiza existentes com APENAS campos de identidade (nome, email, phone, birthday) — NÃO sobrescreve company/role

**Regra geral:** Em qualquer sync bidirecional, definir explicitamente quais campos o Google "owns" vs quais o usuário "owns".

---

## 8. Bottom nav CSS: fixed positioning com subtabs acima

**Arquitetura adotada:**
```css
.app { padding-bottom: 116px; }  /* 56px nav + 56px subtabs + margin */
.bottom-nav { position: fixed; bottom: 0; height: 56px; z-index: 20; }
.subtabs { position: fixed; bottom: 56px; z-index: 19; }
```

**Regra:** Qualquer conteúdo fixo no bottom requer `padding-bottom` equivalente no `.app` para evitar overlap com conteúdo.

---

## 9. NLP com Claude Haiku para parsing de linguagem natural

**Padrão:** Para features de input em linguagem natural (ex: "Reunião com João amanhã às 15h"), usar Claude Haiku (rápido, barato) para converter para JSON estruturado.

**Validação:** Sempre validar o output do modelo com Zod antes de usar — LLMs podem retornar formatos inesperados.

**Prompt:** Incluir data atual no prompt system para referências relativas como "amanhã", "sexta".

---

## 10. Backup e persistência no Supabase

**Banco:** Supabase no plano Pro tem backups automáticos diários (point-in-time recovery). No plano Free, não há backup automático — fazer export manual periodicamente.

**Storage:** Supabase Storage não tem backup automático nem no Pro. Para arquivos críticos (áudios, imagens), considerar replicação manual ou usar um bucket S3 externo.

**Recomendação:** Para dados críticos, criar script de export (pg_dump) e agendar via cron externo ou Vercel Cron.

---

## 11. PWA e service worker

**Setup atual:** Vite PWA plugin com `workbox-window`. Manifest configurado com ícones e `display: standalone`.

**Gotcha:** Service workers cacheiam assets agressivamente. Durante desenvolvimento, desabilitar SW ou usar modo "Update on reload" no DevTools.

**iOS:** `<meta name="apple-mobile-web-app-capable" content="yes">` é necessário para modo standalone no Safari.

---

## 12. Convenção de nomes para API handlers

**Padrão:** `verbo-substantivo.ts` — ex: `notes-save.ts`, `contacts-sync.ts`, `events-delete.ts`.

**Nunca:** `saveNote.ts`, `NoteController.ts`, `api/notes/save.ts` (Vercel routes flat por padrão).

**Schemas compartilhados:** `api/_schemas/nome.ts` — exportar schema Zod + tipo inferido.

---

## 13. Tiptap: CSS manual necessário

Tiptap não inclui estilos por padrão. É preciso estilizar `.ProseMirror` manualmente:
- `outline: none` para remover foco padrão
- Estilos para `h2`, `h3`, `ul`, `ol`, `blockquote`, `code`
- Placeholder via `::before` no primeiro parágrafo vazio

O `StarterKit` inclui: bold, italic, strike, code, codeBlock, heading, bulletList, orderedList, blockquote, horizontalRule, hardBreak, history (undo/redo).

---

## 14. Audio recording: MediaRecorder API

**Browser API:** `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`.

**Formato:** `audio/webm` funciona em Chrome/Edge. Safari suporta `audio/mp4`. Para compatibilidade máxima, verificar `MediaRecorder.isTypeSupported()`.

**Upload:** Converter Blob para base64 via `FileReader` e enviar como JSON é mais simples que multipart/form-data em Vercel serverless.

---

## Para próximos apps

1. Definir `exactOptionalPropertyTypes: true` desde o início e adotar spread condicional como padrão
2. Criar UNIQUE CONSTRAINTs (não índices) para campos usados em upsert
3. Sempre testar OAuth com re-autorização quando adicionar escopos
4. Extrair actions do Topbar para variável — nunca inline JSX complexo dentro de props
5. Documentar no CLAUDE.md os escopos OAuth necessários para cada integração
6. Para sync bidirecional: definir explicitamente quem "owns" cada campo antes de implementar
7. Logging diagnóstico nos pontos de falha silenciosa (best-effort blocks) desde o início
