# Playbook: Construção de Apps Web com Vercel + Supabase + React

> Manual de referência baseado na construção do STATE Superapp (abril 2026).
> Use como guia para novos projetos e para reforçar o que já foi aprendido.

---

## 1. A Stack e Por Que Cada Escolha

### Visão geral

```
USUÁRIO
  │
  ▼
VERCEL (hosting + backend serverless)
  ├── Frontend: React + Vite (arquivos estáticos)
  └── Backend: Funções Serverless (pasta /api)
        │
        ├── SUPABASE (banco de dados PostgreSQL)
        ├── VERCEL BLOB (armazenamento de arquivos)
        ├── RESEND (envio de e-mails)
        ├── ANTHROPIC (inteligência artificial)
        ├── PIPEDRIVE (CRM)
        └── GOOGLE CALENDAR (agenda)
```

### Por que cada tecnologia

| Tecnologia | Por quê |
|------------|---------|
| **React 19** | Padrão de mercado para interfaces dinâmicas. Grande ecossistema, componentes reutilizáveis. |
| **Vite 8** | Build ultrarrápido. Substitui o Create React App (obsoleto). Hot reload em milissegundos. |
| **React Router DOM 7** | Navegar entre páginas sem recarregar o browser (SPA - Single Page Application). |
| **Vercel** | Deploy em segundos com GitHub. Funções serverless sem servidor para gerenciar. Auto-HTTPS. Gratuito para começar. |
| **Supabase** | PostgreSQL gerenciado, sem instalar banco de dados. Tem painel visual, real-time, autenticação (usamos a nossa própria). Gratuito para começar. |
| **Vercel Blob** | Armazenamento de arquivos (fotos, PDFs) integrado ao Vercel. Mais simples que AWS S3. |
| **Resend** | API moderna para envio de e-mails transacionais. Mais simples que SendGrid, melhor entregabilidade que Nodemailer. |
| **Anthropic Claude** | IA para gerar propostas. API com modelos Sonnet (mais capaz) e Haiku (mais rápido/barato). |
| **JWT + cookie httpOnly** | Autenticação segura: o token fica num cookie que JavaScript não consegue ler (proteção contra XSS). |
| **TipTap 3** | Editor de texto rico (bold, listas, títulos) baseado em ProseMirror. Pronto para usar, sem reinventar. |

---

## 2. Estrutura de um Projeto

### Como o projeto está organizado

```
meu-app/
├── api/                    ← Backend (funções serverless Vercel)
│   ├── _middleware.js      ← Autenticação compartilhada
│   ├── _supabase.js        ← Cliente do banco (singleton)
│   └── minha-rota.js       ← Cada arquivo = uma rota HTTP
│
├── src/                    ← Frontend (React)
│   ├── main.jsx            ← Ponto de entrada (monta o App no HTML)
│   ├── App.jsx             ← Roteamento principal
│   ├── api.js              ← Wrapper para chamar o backend
│   ├── index.css           ← Variáveis CSS + estilos globais
│   │
│   ├── pages/              ← Páginas completas (uma por rota)
│   ├── components/         ← Componentes reutilizáveis
│   └── hooks/              ← Lógica compartilhada (useAuth, etc.)
│
├── public/                 ← Arquivos estáticos (logo, fontes, favicon)
├── vercel.json             ← Configuração do Vercel (crons, timeouts)
├── vite.config.js          ← Configuração do Vite
├── package.json            ← Dependências
└── .env.example            ← Template das variáveis de ambiente
```

### Regra crítica: arquivos `.js` vs `.jsx`

O Vite 8 usa o compilador **oxc** por padrão, que **não processa JSX em arquivos `.js`**.

- **Arquivo com JSX (HTML dentro do JS) → extensão `.jsx`**
- **Arquivo só com lógica, sem JSX → extensão `.js`**

```
useAuth.js       ✅  (hook, sem JSX)
AuthProvider.jsx ✅  (tem <AuthProvider> em JSX)
useAuth.jsx      ❌  (extensão errada para arquivo sem JSX)
AuthProvider.js  ❌  (vai quebrar no build)
```

---

## 3. Configuração Inicial de um Novo Projeto

### Passo 1: Criar o projeto React

```bash
# Criar projeto com Vite
npm create vite@latest nome-do-app -- --template react

cd nome-do-app
npm install

# Instalar dependências essenciais
npm install react-router-dom
npm install @supabase/supabase-js
npm install bcryptjs jsonwebtoken
```

### Passo 2: Criar repositório no GitHub

```bash
# No terminal, dentro da pasta do projeto
git init
git add .
git commit -m "initial commit"

# Criar repo no GitHub (pelo site ou CLI)
gh repo create nome-do-app --public
git remote add origin https://github.com/seu-usuario/nome-do-app.git
git push -u origin master
```

### Passo 3: Conectar ao Vercel

```bash
# Instalar Vercel CLI (fazer uma vez só)
npm install -g vercel

# Dentro da pasta do projeto, fazer login
vercel login

# Linkar o projeto local com o Vercel
vercel link

# Puxar as variáveis de ambiente do Vercel para o .env local
vercel env pull .env.local
```

> **Importante:** `vercel link` cria uma pasta `.vercel/` com o ID do projeto. Se você já tiver um projeto criado no Vercel com outro nome, use `vercel link --project nome-do-projeto-no-vercel`.

### Passo 4: Configurar o Supabase

1. Acessar [supabase.com](https://supabase.com) → New Project
2. Criar o banco de dados
3. Em Settings → API: copiar `Project URL` e as duas chaves (`anon` e `service_role`)
4. Criar o arquivo `api/_supabase.js`:

```js
// api/_supabase.js
import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabase() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY  // service key no backend (acesso total)
    )
  }
  return _client
}
```

> **Service key vs Anon key:**
> - **Service key:** uso exclusivo no backend (funções serverless). Bypassa Row Level Security. Nunca exponha no frontend.
> - **Anon key:** pode ser usada no frontend, respeita as políticas RLS do Supabase.
> - No nosso app: usamos service key no backend e fazemos nossa própria autenticação por JWT.

---

## 4. Variáveis de Ambiente

### Conceito fundamental

Variáveis de ambiente guardam segredos (chaves de API, senhas) **fora do código**. Nunca commitar segredos no Git.

### Onde ficam

| Local | Arquivo | Uso |
|-------|---------|-----|
| Desenvolvimento local | `.env.local` | Só na sua máquina, nunca no Git |
| Produção Vercel | Dashboard Vercel ou CLI | Injetadas automaticamente no build |

### Adicionar variável no Vercel (CLI)

```bash
# Adicionar para todos os ambientes (production + preview + development)
vercel env add NOME_DA_VARIAVEL

# Adicionar só para produção
vercel env add NOME_DA_VARIAVEL production

# Adicionar para preview com branch específico
vercel env add NOME_DA_VARIAVEL preview master --value "valor" --yes

# Listar todas as variáveis
vercel env ls

# Remover uma variável
vercel env rm NOME_DA_VARIAVEL
```

### Puxar variáveis do Vercel para uso local

```bash
vercel env pull .env.local
```

### Variáveis típicas de um projeto

```bash
# Autenticação
JWT_SECRET=string_aleatoria_longa_minimo_32_chars

# Banco de dados (Supabase)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key
SUPABASE_ANON_KEY=eyJ...     # anon key

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# E-mail
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@seudominio.com

# IA
ANTHROPIC_API_KEY=sk-ant-...

# App
APP_URL=https://seuapp.vercel.app
```

---

## 5. Funções Serverless (Backend)

### Como funciona

Cada arquivo em `api/` vira uma rota HTTP automaticamente no Vercel.

```
api/auth-login.js   →  POST https://seuapp.com/api/auth-login
api/users-list.js   →  GET  https://seuapp.com/api/users-list
api/tasks-save.js   →  POST https://seuapp.com/api/tasks-save
```

### Estrutura básica de uma função

```js
// api/minha-rota.js
import { getSupabase } from './_supabase.js'
import { requireAuth } from './_middleware.js'

export default async function handler(req, res) {
  // 1. Verificar autenticação
  const user = requireAuth(req, res)
  if (!user) return  // requireAuth já respondeu com 401

  // 2. Só aceitar método correto
  if (req.method !== 'POST') return res.status(405).end()

  // 3. Ler dados do body
  const { nome, email } = req.body

  // 4. Validar dados
  if (!nome) return res.status(400).json({ error: 'nome obrigatório' })

  // 5. Interagir com banco
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('minha_tabela')
    .insert({ nome, email })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // 6. Retornar resultado
  return res.status(200).json({ item: data })
}
```

### Funções com tempo longo (IA, processamento)

Por padrão, funções Vercel têm timeout de ~10s. Para IA ou operações longas:

```json
// vercel.json
{
  "functions": {
    "api/claude.js": { "maxDuration": 60 }
  }
}
```

### Cron Jobs

Tarefas automáticas configuradas no `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/minha-tarefa",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Formato cron: `minuto hora dia-mes mes dia-semana`
- `*/20 * * * *` → a cada 20 minutos
- `0 3 1 * *` → dia 1 de cada mês às 3h
- `0 9 * * 1-5` → dias úteis às 9h

Para proteger o endpoint de chamadas externas:
```js
if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).end()
}
```

---

## 6. Autenticação com JWT

### Por que JWT + cookie httpOnly

- **JWT (JSON Web Token):** token assinado que prova quem é o usuário. O backend valida a assinatura sem consultar banco.
- **Cookie httpOnly:** JavaScript do browser não consegue ler. Protege contra ataques XSS que roubam tokens do localStorage.
- **SameSite=Strict:** cookie só é enviado para o mesmo domínio. Protege contra CSRF.

### Fluxo completo

```
1. POST /api/auth-login { email, senha }
   → backend valida bcrypt(senha, hash_no_banco)
   → gera JWT: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })
   → Set-Cookie: token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/

2. Todas as rotas protegidas:
   → lê cookie: req.cookies.token
   → verifica: jwt.verify(token, JWT_SECRET)
   → retorna payload do usuário ou 401

3. Frontend:
   → GET /api/auth-me (cookie é enviado automaticamente)
   → guarda usuário em contexto React (AuthProvider)
   → toda requisição subsequente usa o cookie automaticamente
```

### Implementação do middleware

```js
// api/_middleware.js
import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

export function requireAuth(req, res) {
  try {
    const cookies = parse(req.headers.cookie || '')
    const token = cookies.token
    if (!token) { res.status(401).json({ error: 'não autenticado' }); return null }
    const user = jwt.verify(token, process.env.JWT_SECRET)
    return user
  } catch {
    res.status(401).json({ error: 'token inválido' }); return null
  }
}

export function requireAdmin(req, res) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'staff') {
    res.status(403).json({ error: 'sem permissão' }); return null
  }
  return user
}
```

---

## 7. Banco de Dados (Supabase / PostgreSQL)

### Boas práticas de schema

**Use UUIDs como PK** (não inteiros sequenciais expostos):
```sql
id uuid DEFAULT gen_random_uuid() PRIMARY KEY
```

**Timestamps automáticos:**
```sql
criado_em timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

**JSONB para dados flexíveis:**
```sql
-- Permite adicionar campos sem alterar a tabela
data jsonb
-- Exemplo: briefs guardam todos os campos do evento em data: jsonb
```

### Consultas com Supabase JS v2 — armadilha importante

**`PostgrestFilterBuilder` não implementa `.catch()`.**

```js
// ❌ ERRADO — vai lançar TypeError: .catch is not a function
supabase.from('tabela').insert({}).catch(() => {})

// ✅ CORRETO — usar .then(null, handler) para ignorar erro
supabase.from('tabela').insert({}).then(null, () => {})

// ✅ CORRETO — usar await com try/catch
try {
  const { data, error } = await supabase.from('tabela').insert({}).select().single()
} catch (e) { ... }
```

### FK ambígua no PostgREST (Supabase)

Se uma tabela tem **duas chaves estrangeiras para a mesma tabela**, o PostgREST não sabe qual usar no join automático.

```js
// ❌ Vai retornar erro "could not embed because more than one relationship"
supabase.from('bookings').select('*, users(*)')

// ✅ Especificar qual FK usar pelo nome da constraint
supabase.from('bookings').select('*, users!bookings_user_id_fkey(*)')
```

---

## 8. Frontend: Padrões React

### API wrapper centralizado

```js
// src/api.js
const BASE = ''  // mesmo domínio

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // envia cookie automaticamente
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path, body)  => request('DELETE', path, body),
}
```

Uso:
```js
const data = await api.post('/api/tasks-save', { title: 'Minha tarefa' })
```

### Context para estado global

Use Context API do React para estado compartilhado entre muitos componentes:

```js
// src/hooks/AuthProvider.jsx
import { createContext, useState, useEffect } from 'react'
import { api } from '../api.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/auth-me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

```js
// src/hooks/useAuth.js  (sem JSX, extensão .js)
import { useContext } from 'react'
import { AuthContext } from './AuthProvider.jsx'

export function useAuth() {
  return useContext(AuthContext)
}
```

### Carregamento paralelo de dados

Em vez de aguardar uma requisição para iniciar a próxima:

```js
// ❌ Sequencial (mais lento)
const users  = await api.get('/api/users-list')
const tasks  = await api.get('/api/tasks-list')
const areas  = await api.get('/api/areas-list')

// ✅ Paralelo (3x mais rápido)
const [users, tasks, areas] = await Promise.all([
  api.get('/api/users-list'),
  api.get('/api/tasks-list'),
  api.get('/api/areas-list'),
])

// ✅ Paralelo sem falhar se um erro (Promise.allSettled)
const results = await Promise.allSettled([...])
results.forEach(r => { if (r.status === 'fulfilled') { /* usar r.value */ } })
```

### Roteamento e proteção de rotas

```jsx
// src/App.jsx
function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && user.role !== 'staff') return <Navigate to="/portal" replace />
  return children
}

// Uso:
<Route path="/admin/*" element={
  <AdminRoute>
    <Admin />
  </AdminRoute>
} />
```

---

## 9. Deploy e Fluxo de Trabalho

### Deploy automático (GitHub → Vercel)

1. Vercel fica "ouvindo" o repositório GitHub
2. Qualquer `git push` para `master` dispara um novo build automaticamente
3. Em ~30 segundos o app está atualizado em produção

```bash
# Workflow diário
git add src/components/MeuComponente.jsx
git commit -m "feat: adiciona componente de busca"
git push  # → deploy automático no Vercel
```

### Deploy manual (quando necessário)

```bash
# Dentro da pasta do projeto
npx vercel --prod
```

Use quando:
- O auto-deploy falhou e precisa reforçar
- Quer testar em produção antes de commitar

### Preview deploys

Cada branch ou PR no GitHub gera uma URL de preview no Vercel:
```
https://meu-app-git-feat-nova-funcao.vercel.app
```

Útil para testar antes de fazer merge para master.

### Verificar logs de uma função no Vercel

```bash
vercel logs https://meu-app.vercel.app/api/minha-rota
```

---

## 10. Comandos de Terminal — Referência Rápida

### Git

```bash
git status                        # ver o que mudou
git diff                          # ver as mudanças linha por linha
git add arquivo.jsx               # adicionar arquivo específico ao staging
git add -A                        # adicionar tudo (cuidado com .env!)
git commit -m "feat: descrição"   # criar commit
git push                          # enviar para GitHub (e disparar deploy)
git log --oneline                 # ver histórico resumido
git checkout -b nova-feature      # criar e mudar para nova branch
git merge nome-da-branch          # fazer merge de uma branch
```

### Vercel CLI

```bash
vercel login                      # fazer login
vercel link                       # linkar pasta ao projeto Vercel
vercel link --project nome        # linkar a projeto específico
vercel env ls                     # listar variáveis de ambiente
vercel env add NOME               # adicionar variável (interativo)
vercel env rm NOME                # remover variável
vercel env pull .env.local        # baixar variáveis para uso local
vercel --prod                     # deploy manual para produção
vercel logs URL                   # ver logs de uma função
vercel inspect URL                # inspecionar deployment
```

### npm / Node

```bash
npm install                       # instalar dependências do package.json
npm install nome-pacote           # instalar e adicionar ao package.json
npm install -D nome-pacote        # instalar como dependência de dev
npm run dev                       # rodar servidor de desenvolvimento local
npm run build                     # gerar build de produção
npm run preview                   # testar build localmente
```

---

## 11. Diagrama de Arquitetura

```
╔══════════════════════════════════════════════════════════════════╗
║                         USUÁRIOS                                  ║
║   Admin/Staff           Cliente                  Público          ║
║   /admin/*              /reservas/*              /form            ║
╚══════════════╤══════════════════╤════════════════╤═══════════════╝
               │                  │                │
               ▼                  ▼                ▼
╔══════════════════════════════════════════════════════════════════╗
║                    VERCEL (CDN Global)                            ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │              FRONTEND (React + Vite)                     │   ║
║   │                                                          │   ║
║   │  App.jsx → roteamento → páginas → componentes            │   ║
║   │                                                          │   ║
║   │  Módulos:  Eventos │ Reservas │ Tarefas │ Portal         │   ║
║   │  Nav:      TopNav (horizontal, scroll-hide)              │   ║
║   │  Auth:     cookie httpOnly → useAuth hook                │   ║
║   └──────────────────────┬──────────────────────────────────┘   ║
║                          │ fetch() com credentials: 'include'     ║
║   ┌──────────────────────▼──────────────────────────────────┐   ║
║   │         BACKEND (Vercel Serverless Functions /api)       │   ║
║   │                                                          │   ║
║   │  _middleware.js ← requireAuth / requireAdmin             │   ║
║   │  _supabase.js   ← cliente singleton                      │   ║
║   │                                                          │   ║
║   │  Rotas: auth-* │ briefs-* │ tasks-* │ bookings-* │ ...   │   ║
║   └──┬──────────┬──────────┬────────┬────────┬─────────────┘   ║
║      │          │          │        │        │                    ║
╚══════╪══════════╪══════════╪════════╪════════╪════════════════════╝
       │          │          │        │        │
       ▼          ▼          ▼        ▼        ▼
  ┌─────────┐ ┌───────┐ ┌──────┐ ┌──────┐ ┌───────────┐
  │SUPABASE │ │VERCEL │ │RESEND│ │CLAUDE│ │ PIPEDRIVE │
  │         │ │ BLOB  │ │      │ │  AI  │ │  GOOGLE   │
  │PostgreSQL│ │Arquivos│ │E-mail│ │Haiku │ │ CALENDAR  │
  │  tabelas │ │fotos  │ │      │ │Sonnet│ │           │
  └─────────┘ └───────┘ └──────┘ └──────┘ └───────────┘
```

### Fluxo de uma requisição típica

```
1. Usuário clica em "+ Tarefa" no browser
                │
                ▼
2. React executa handleSave(task)
   → api.post('/api/tasks-save', dadosDaTarefa)
   → fetch('/api/tasks-save', { method:'POST', body: JSON, credentials:'include' })
                │
                ▼ (cookie JWT é enviado automaticamente)
3. Vercel Serverless Function recebe a requisição
   → _middleware.requireAdmin(req, res) verifica JWT do cookie
   → se inválido: retorna 401 e para
   → se válido: continua com dados do usuário
                │
                ▼
4. Função lê req.body, valida campos
                │
                ▼
5. getSupabase().from('tasks').insert({...}).select().single()
   → Supabase executa SQL no PostgreSQL gerenciado
   → retorna { data, error }
                │
                ▼
6. Função retorna res.status(200).json({ task: data })
                │
                ▼
7. React recebe resposta, atualiza estado local
   → setTasks(prev => [...prev, novaTarefa])
   → Interface atualiza sem recarregar a página
```

### Fluxo de autenticação

```
Login:
  browser → POST /api/auth-login { email, senha }
          → bcrypt.compare(senha, hash) 
          → jwt.sign(payload, JWT_SECRET, '7d')
          → Set-Cookie: token=eyJ...; HttpOnly
          ← { user: {...} }

Requests subsequentes:
  browser → qualquer /api/rota-protegida
            [cookie enviado automaticamente pelo browser]
          → _middleware lê cookie
          → jwt.verify(token, JWT_SECRET)
          → retorna payload: { id, email, role }
          → função continua normalmente

Logout:
  browser → POST /api/auth-logout
          → Set-Cookie: token=; Max-Age=0
          ← { ok: true }
          → browser redireciona para /login
```

---

## 12. Integração com IA (Anthropic Claude)

### Estratégia: chamadas em paralelo

```js
// api/claude.js
const [itemsResult, textoResult] = await Promise.all([
  anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: promptItens }]
  }),
  anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // mais rápido para texto
    max_tokens: 1500,
    messages: [{ role: 'user', content: promptTexto }]
  })
])
```

**Por que modelos diferentes?**
- **Sonnet** (mais capaz): para raciocínio complexo, estruturar itens/preços
- **Haiku** (mais rápido e barato): para texto narrativo mais simples

### Proteção contra sobrescrever edições manuais

```js
// Antes de gerar com IA, verificar se o usuário já editou
if (conteudoAtual.length > 7) {
  const confirma = window.confirm('Já existe conteúdo. Substituir com IA?')
  if (!confirma) return
}
```

---

## 13. Notificações no App

### Sistema implementado

1. Backend cria linha em `notifications` ao salvar evento relevante
2. Frontend polling a cada 60s via `setInterval` no hook `useNotifications`
3. Badge no sino mostra contagem de não lidas
4. Clique na notificação: abre o item correspondente (brief, reserva)

### Dropdown com `position: fixed`

Se um elemento pai tem `position: fixed` (como o TopNav), um dropdown filho com `position: absolute` fica "preso" dentro desse contexto. Solução:

```jsx
// Calcular posição absoluta na tela com getBoundingClientRect()
const [dropPos, setDropPos] = useState(null)

function handleClick() {
  const rect = buttonRef.current.getBoundingClientRect()
  setDropPos({ top: rect.bottom, right: window.innerWidth - rect.right })
}

// Dropdown com position: fixed usa coordenadas da tela, não do pai
<div style={{
  position: 'fixed',
  top: dropPos.top,
  right: dropPos.right,
  zIndex: 1000,
}}>
  {/* conteúdo do dropdown */}
</div>
```

---

## 14. E-mail com Resend

```js
// api/send-email.js
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: `STATE <${process.env.FROM_EMAIL}>`,
  to: destinatario,
  subject: 'Assunto do e-mail',
  html: `<h1>Conteúdo</h1><p>Corpo do e-mail em HTML</p>`
})
```

**Por que Resend?**
- API simples (uma linha para enviar)
- Boa entregabilidade (chega no inbox, não no spam)
- Painel limpo para ver e-mails enviados
- Plano gratuito generoso (3.000 e-mails/mês)

---

## 15. Google Calendar OAuth

### Fluxo completo

```
1. Admin clica "Conectar Google Calendar"
2. Frontend redireciona para /api/calendar-oauth?action=auth
3. Backend redireciona para Google OAuth consent screen
4. Usuário autoriza → Google redireciona para /api/calendar-oauth?code=...
5. Backend troca o code pelo access_token + refresh_token
6. refresh_token salvo no banco (app_settings)
7. Para criar eventos: usa refresh_token para obter access_token fresco
```

**Por que salvar refresh_token no banco e não em variável de ambiente?**
- O refresh_token pode ser revogado e renovado pelo usuário
- Variáveis de ambiente são estáticas (precisaria de redeploy para atualizar)
- Banco é dinâmico: atualiza sem redeploy

---

## 16. Boas Práticas e Lições Aprendidas

### O que fazer

- **Componentizar desde o início.** Um componente = uma responsabilidade clara.
- **Centralizar chamadas à API** num único `api.js`. Facilita trocar a URL base ou adicionar autenticação global.
- **Manter estado no componente mais alto** que precisa dele. Não duplicar estado.
- **Usar `Promise.allSettled`** quando carregando múltiplas fontes e o app deve funcionar parcialmente se uma falhar.
- **Validar no backend sempre.** O frontend pode ser manipulado por qualquer pessoa.
- **Nomes descritivos de rotas:** `/api/tasks-save`, `/api/bookings-create` (verbo + substantivo, não genérico).
- **Commitar frequentemente** com mensagens descritivas:
  - `feat:` nova funcionalidade
  - `fix:` correção de bug
  - `chore:` manutenção (deletar arquivos, atualizar dependências)
  - `refactor:` melhorias de código sem mudar comportamento

### O que NÃO fazer

- **❌ Guardar segredos no Git.** Nunca commitar `.env` com chaves reais.
- **❌ Chamar IA em sequência.** Usar `Promise.all` para chamadas paralelas.
- **❌ Autenticação via localStorage.** Usar cookie httpOnly (mais seguro).
- **❌ Chamar o banco diretamente do frontend.** Sempre passar pelo backend.
- **❌ Usar Vercel KV como banco principal.** É key-value simples, não relacional. Use Supabase para dados relacionais.
- **❌ Clonar DOM para imprimir.** Usar `editor.getHTML()` ou CSS de impressão.
- **❌ `supabase.from(...).catch()`** — usar `.then(null, () => {})`.
- **❌ Funções de IA sem `maxDuration`** no `vercel.json` — timeout de ~10s.
- **❌ Estado global espalhado** — centralizar em hooks (`useAuth`, `useBriefs`).

---

## 17. Checklist para um Novo Projeto

```
Setup inicial:
[ ] npm create vite@latest + instalar dependências
[ ] Criar repositório GitHub + git push inicial
[ ] vercel link (conectar ao projeto Vercel)
[ ] Criar projeto no Supabase + criar tabelas
[ ] Configurar variáveis de ambiente no Vercel
[ ] vercel env pull .env.local

Estrutura base:
[ ] api/_supabase.js (cliente singleton)
[ ] api/_middleware.js (requireAuth)
[ ] api/auth-login.js, auth-logout.js, auth-me.js
[ ] src/api.js (wrapper fetch)
[ ] src/hooks/useAuth.js + AuthProvider.jsx
[ ] src/App.jsx com roteamento + proteção de rotas
[ ] src/index.css com variáveis CSS do design system

Antes do primeiro deploy:
[ ] Verificar que .env.local não está no Git (.gitignore)
[ ] Testar login + logout
[ ] Testar criação de dado básico
[ ] npm run build (sem erros)

Manutenção contínua:
[ ] git push (auto-deploy) após cada conjunto de mudanças
[ ] Verificar logs no Vercel se algo quebrar
[ ] vercel env add quando adicionar nova integração
```

---

*Documento gerado em abril 2026. Baseado na construção do STATE Superapp.*
*Projeto em produção: https://app.state.is*
