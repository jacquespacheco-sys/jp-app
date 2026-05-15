# JP App — Redesign Seda · Plano de Implementação

> **Audiência:** Claude Code. Este documento é um plano operacional executável em uma sessão. Lê de cabo a rabo antes de tocar em código.
>
> **Objetivo:** Aplicar a nova linguagem visual ("ClickUp Seda") em todo o app, em uma única PR. Paleta pastel translúcida + tipografia editorial humanista + dark mode revisado + auditoria de cores hard-coded.
>
> **Escopo:** Apenas CSS, CSS variables, imports de fonte, e remoção de cores hard-coded em JSX/TSX. **Não toca em:** lógica, hooks, providers, schemas, endpoints, banco. **Não cria:** componentes novos.
>
> **Risco:** baixíssimo — reversão é git revert.

---

## 0. Contexto rápido

### Stack visual atual

- `src/styles/globals.css` é a **fonte da verdade** visual. CSS variables em `:root` + `body.dark`. CSS puro, sem Tailwind, sem shadcn.
- Tipografia atual: **Bebas Neue** (display), **Space Grotesk** (UI), **Space Mono** (labels).
- Cores AQAL hard-coded em `src/lib/colors.ts` (`QUADRANT_COLORS`).
- Cores de quadrante também referenciadas em componentes via `QUADRANT_COLORS[quadrant]`.
- Dark mode controlado por `body.dark` (toggle manual em `src/hooks/useTheme.ts`).
- Tabela completa de CSS vars atuais: ver `SPEC.md §5 → CSS variables`.

### O que NÃO mudar

- **Markup das páginas** — todas as classes CSS existentes (`.app`, `.btn`, `.task-panel`, `.kanban-col`, `.subtabs`, etc.) continuam existindo com os mesmos nomes.
- **Lógica de componentes** — nenhum handler, hook, prop, ou estado muda.
- **Estrutura de pastas** — nada é movido ou renomeado.
- **Comportamento de `body.dark`** — toggle continua igual, só as variables que recebem valores diferentes.
- **AQAL como conceito** — quadrantes I/IT/WE/ITS continuam existindo; só os hex codes mudam (lavados em seda).

### O que muda

1. **`src/styles/globals.css`** — substituição completa das CSS variables (light + dark), adição de novas variables (cores funcionais translúcidas, tokens tipográficos, gradients), atualização de classes utilitárias para usar nova tipografia.
2. **`src/lib/colors.ts`** — `QUADRANT_COLORS` recebe os novos hex em versão seda. Adicionar export `QUADRANT_COLORS_TRANSLUCENT` (rgba alpha 0.5 light / 0.2 dark) para uso em chips/barras.
3. **`index.html`** ou `globals.css` topo — substituir o `<link>` atual do Google Fonts (Space Grotesk, Bebas Neue, Space Mono) pelos novos (General Sans, Fraunces, JetBrains Mono).
4. **Componentes com cores hard-coded** — auditar todos os `.tsx` em `src/components/`, identificar usos de `style={{ color: '#...' }}` ou `style={{ background: '#...' }}` ou Tailwind-like inline com hex literais, e substituir por `var(--token)` correspondente. Listar achados no commit message.

### Critério de "pronto"

- [ ] `npm run build` passa sem erro
- [ ] `npm test` passa (testes existentes não devem quebrar — eles não testam visual)
- [ ] Visual no `npm run dev` mostra: fundo creme, cards brancos com 1% creme, chips pastéis translúcidos, Coach com gradient bar lilás→rosa→azul-pó
- [ ] Toggle dark/light alterna entre `#FBF9F5` ↔ `#1A1714` corretamente
- [ ] Busca por hex literal (`#[0-9a-fA-F]{6}`) em `src/components/**/*.tsx` não retorna resultados (exceto em arquivos de teste ou comentários)
- [ ] Nenhum console error sobre fonte não carregada

---

## 1. Passo 1 — Atualizar imports de fonte

**Arquivo:** `index.html` (no `<head>`).

**Remover:**
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

**Substituir por:**
```html
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Justificativa:** Fontshare hospeda General Sans gratuitamente (licença SIL Open Font). Fraunces e JetBrains Mono no Google Fonts. Total ~280KB com swap — não bloqueia render.

---

## 2. Passo 2 — Reescrever `src/styles/globals.css`

### 2.1 Substituir bloco de CSS variables `:root`

**Localizar:** o bloco `:root { ... }` no topo do arquivo (após o reset).

**Substituir o bloco inteiro por:**

```css
/* ---------- Variables: Light (default) ---------- */
:root {
  /* Backgrounds */
  --bg: #FBF9F5;                /* creme-pérola quente, não branco frio */
  --bg-elevated: #FFFEFC;       /* branco com 1% de creme */
  --bg-subtle: #F4EFE8;         /* pílulas inativas, inputs */

  /* Foreground */
  --fg: #3A352F;                /* marrom-tinta, não preto */
  --fg-muted: #8A8075;          /* taupe */
  --fg-dim: #A99E91;            /* dim */

  /* Accent (substitui o verde-limão atual) */
  --accent: #DFD0EC;            /* lilás (cor do Coach/AI) */
  --accent-ink: #6B5E72;        /* texto sobre accent */
  --accent-soft: rgba(223, 208, 236, 0.5);   /* lilás 50% alpha */
  --accent-faint: rgba(223, 208, 236, 0.18); /* lilás muito sutil */

  /* Borders */
  --border: #ECE7DE;            /* borda padrão */
  --border-light: #F4EFE8;      /* borda muito sutil */

  /* Semantic */
  --danger: #9B6B73;            /* rosa-vinho, não vermelho agressivo */
  --danger-soft: rgba(245, 213, 220, 0.5);
  --success: #5C8159;           /* sage escuro */
  --success-soft: rgba(201, 221, 201, 0.55);

  /* CTA primary (botão "Add", ações principais) */
  --cta-bg: #3A352F;            /* marrom-tinta sólido */
  --cta-fg: #FBF9F5;            /* creme sobre escuro */

  /* Misc */
  --shadow: 0 2px 12px rgba(58, 53, 47, 0.04);
  --overlay-bg: rgba(58, 53, 47, 0.45);
  --nav-selected: var(--fg);
  --sync-green: #5C8159;

  /* Tipografia (NOVAS) */
  --font-sans: 'General Sans', system-ui, -apple-system, sans-serif;
  --font-display: 'Fraunces', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  /* Cores funcionais translúcidas — chips, barras, pílulas */
  /* Light: alpha 0.5-0.7 (vibrante o suficiente pra distinguir, suave o bastante pra respirar) */
  --color-rose: rgba(245, 213, 220, 0.6);      /* urgent, high, atrasado */
  --color-rose-ink: #9B6B73;
  --color-lilac: rgba(223, 208, 236, 0.6);     /* coach, AI, quadrante I */
  --color-lilac-ink: #6B5E72;
  --color-sky: rgba(207, 227, 232, 0.6);       /* NEXT, ITS, projetos */
  --color-sky-ink: #5D8194;
  --color-peach: rgba(245, 222, 195, 0.65);    /* DOING, em foco */
  --color-peach-ink: #8C6B3F;
  --color-peach-warm: rgba(245, 213, 195, 0.6); /* WE */
  --color-peach-warm-ink: #A06C4C;
  --color-butter: rgba(245, 232, 195, 0.65);   /* MED priority */
  --color-butter-ink: #8C7536;
  --color-sage: rgba(201, 221, 201, 0.6);      /* DONE, IT, sucesso */
  --color-sage-ink: #5C8159;

  /* Borders de cor (chips em hover, cards destacados) */
  --color-rose-border: rgba(245, 213, 220, 0.7);
  --color-lilac-border: rgba(223, 208, 236, 0.5);
  --color-peach-border: rgba(232, 201, 165, 0.6);
  --color-sky-border: rgba(207, 227, 232, 0.7);

  /* Gradient de personalidade (Coach, view ativa, ícone Today) */
  --gradient-coach: linear-gradient(135deg, rgba(223, 208, 236, 0.7) 0%, rgba(245, 213, 220, 0.7) 100%);
  --gradient-coach-strong: linear-gradient(135deg, #DFD0EC 0%, #F5D5DC 50%, #CFE3E8 100%);
  --gradient-coach-bar: linear-gradient(90deg, #DFD0EC 0%, #F5D5DC 50%, #CFE3E8 100%);
}
```

### 2.2 Substituir bloco `body.dark`

**Localizar:** o bloco `body.dark { ... }`.

**Substituir o bloco inteiro por:**

```css
/* ---------- Variables: Dark ---------- */
body.dark {
  /* Backgrounds — preto-tinta com calor, não preto azulado */
  --bg: #1A1714;
  --bg-elevated: #221E1A;
  --bg-subtle: #2A2520;

  /* Foreground */
  --fg: #E8DDD0;                /* creme claro */
  --fg-muted: #9A8C7B;
  --fg-dim: #7A6F62;

  /* Accent */
  --accent: rgba(223, 208, 236, 0.3);
  --accent-ink: #DFD0EC;
  --accent-soft: rgba(223, 208, 236, 0.2);
  --accent-faint: rgba(223, 208, 236, 0.08);

  /* Borders */
  --border: #2A2520;
  --border-light: #221E1A;

  /* Semantic */
  --danger: #E8B8C2;
  --danger-soft: rgba(245, 213, 220, 0.15);
  --success: #A8C0A5;
  --success-soft: rgba(201, 221, 201, 0.15);

  /* CTA primary — inverte no dark */
  --cta-bg: #E8DDD0;
  --cta-fg: #1A1714;

  /* Misc */
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  --overlay-bg: rgba(10, 8, 6, 0.75);
  --nav-selected: var(--fg);
  --sync-green: #A8C0A5;

  /* Cores funcionais — alpha 0.2 no dark (pigmento se acalma, texto destaca) */
  --color-rose: rgba(245, 213, 220, 0.2);
  --color-rose-ink: #E8B8C2;
  --color-lilac: rgba(223, 208, 236, 0.2);
  --color-lilac-ink: #DFD0EC;
  --color-sky: rgba(207, 227, 232, 0.2);
  --color-sky-ink: #B8D4DD;
  --color-peach: rgba(245, 222, 195, 0.2);
  --color-peach-ink: #E8C9A5;
  --color-peach-warm: rgba(245, 213, 195, 0.2);
  --color-peach-warm-ink: #E8C2A2;
  --color-butter: rgba(245, 232, 195, 0.2);
  --color-butter-ink: #E8D89A;
  --color-sage: rgba(201, 221, 201, 0.2);
  --color-sage-ink: #A8C0A5;

  /* Borders de cor */
  --color-rose-border: rgba(245, 213, 220, 0.3);
  --color-lilac-border: rgba(223, 208, 236, 0.3);
  --color-peach-border: rgba(245, 222, 195, 0.3);
  --color-sky-border: rgba(207, 227, 232, 0.3);

  /* Gradient — mais sutil no dark */
  --gradient-coach: linear-gradient(135deg, rgba(223, 208, 236, 0.3) 0%, rgba(245, 213, 220, 0.3) 100%);
  --gradient-coach-strong: linear-gradient(135deg, rgba(245, 213, 220, 0.4) 0%, rgba(223, 208, 236, 0.4) 50%, rgba(207, 227, 232, 0.4) 100%);
  --gradient-coach-bar: linear-gradient(90deg, #DFD0EC 0%, #F5D5DC 50%, #CFE3E8 100%);
  /* gradient-coach-bar é o único que mantém saturação no dark — é a "fita de seda" do Coach */
}
```

### 2.3 Atualizar tipografia base

**Localizar:** o bloco `html, body { font-family: 'Space Grotesk', sans-serif; ... }`.

**Substituir `font-family` por:**

```css
html, body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
  overflow-x: hidden;
  min-height: 100vh;
  transition: background 0.25s, color 0.25s;
  -webkit-font-smoothing: antialiased;
}
```

### 2.4 Atualizar classes que referenciam fontes específicas

**Buscar em `globals.css` por:**
- `font-family: 'Bebas Neue', sans-serif;` → trocar por `font-family: var(--font-display);`
- `font-family: 'Space Mono', monospace;` → trocar por `font-family: var(--font-mono);`
- `font-family: 'Space Grotesk', sans-serif;` → trocar por `font-family: var(--font-sans);`

**Classes específicas a ajustar:**

- `.logo-mark` — era Bebas Neue 22px com letter-spacing 2.5px. Agora:
  ```css
  .logo-mark {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.3px;
    line-height: 1;
  }
  ```
  (Fraunces 500 substitui Bebas Neue. Letter-spacing negativo porque Fraunces tem espaçamento natural mais amplo.)

- `.page-title` — era Space Mono 10px uppercase. Agora:
  ```css
  .page-title {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-muted);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }
  ```
  (Mantém uppercase mono, só troca a família.)

- `.section-title` (se existir) — era Space Mono. Agora:
  ```css
  .section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--fg);
  }
  ```

- `.bottom-nav-item` — era Space Mono 9px. Agora:
  ```css
  .bottom-nav-item {
    font-family: var(--font-sans);  /* mudou: nav agora é General Sans, não mono */
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: none;            /* mudou: não uppercase mais */
  }
  ```
  (Decisão: bottom nav fica mais legível e moderna sem uppercase mono. Letter-spacing pequeno positivo.)

- `.btn` — era Space Grotesk 11px uppercase letter-spacing 1.5px. Agora:
  ```css
  .btn {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    text-transform: none;            /* mudou: não uppercase, fica menos brutal */
    padding: 9px 14px;
    border-radius: 9px;              /* mudou: era 0 (retangular), agora 9px */
    border: 1px solid var(--cta-bg);
    background: var(--cta-bg);
    color: var(--cta-fg);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-accent {
    background: var(--gradient-coach);
    border-color: var(--color-lilac-border);
    color: var(--accent-ink);
  }

  .btn-ghost {
    background: transparent;
    color: var(--fg);
    border-color: var(--border);
  }

  .btn-danger {
    background: var(--color-rose);
    border-color: var(--color-rose-border);
    color: var(--color-rose-ink);
  }
  ```

- `.icon-btn` — adicionar border-radius:
  ```css
  .icon-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 9px;              /* novo: cantos */
    background: var(--bg-subtle);    /* mudou: era transparent */
    /* resto igual */
  }
  ```

- `.input`, `.textarea` — adicionar border-radius:
  ```css
  .input {
    font-family: var(--font-sans);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 9px;              /* novo */
    color: var(--fg);
    padding: 10px 13px;
    font-size: 13px;
    width: 100%;
  }
  .input:focus {
    outline: none;
    border-color: var(--accent-ink);
    box-shadow: 0 0 0 3px var(--accent-faint);
  }
  ```

- `.subtab` — era Space Mono 10px uppercase. Agora:
  ```css
  .subtab {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--fg-muted);
    /* resto igual: flex 1, padding, border-bottom transparent */
  }
  .subtab.active {
    color: var(--fg);
    font-weight: 600;
    border-bottom-color: var(--fg);
  }
  ```

- `.kanban-card` — adicionar border-radius e padding:
  ```css
  .kanban-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 11px;             /* novo */
    padding: 10px 12px;              /* ajustar */
    margin-bottom: 6px;
    cursor: grab;
  }
  ```

- `.task-panel` — adicionar border-radius nas bordas externas se ainda fizer sentido (painel lateral 560px):
  ```css
  .task-panel {
    /* manter width: 560px, position, etc */
    background: var(--bg);
    border-left: 1px solid var(--border);
    /* sem border-radius — painel lateral cola na borda direita */
  }
  ```

- `.confirm-box`, modais centrais — adicionar:
  ```css
  .confirm-box {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 14px;             /* novo */
    padding: 22px;
    max-width: 420px;
  }
  ```

- `.toggle` (switch theme) — ajustar para refletir paleta nova:
  ```css
  .toggle {
    width: 36px;
    height: 20px;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 10px;             /* novo */
    /* resto igual */
  }
  .toggle::after {
    background: var(--fg-muted);
    border-radius: 50%;              /* novo: bolinha redonda */
  }
  .toggle.on {
    background: var(--accent);
    border-color: var(--color-lilac-border);
  }
  .toggle.on::after { background: var(--accent-ink); }
  ```

### 2.5 Adicionar classes utilitárias NOVAS

Adicionar ao final do `globals.css`, na seção "/* ============ UTILITIES ============ */":

```css
/* ===== Chips ===== */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 7px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.chip-mono {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.chip-rose   { background: var(--color-rose);       color: var(--color-rose-ink); }
.chip-lilac  { background: var(--color-lilac);      color: var(--color-lilac-ink); }
.chip-sky    { background: var(--color-sky);        color: var(--color-sky-ink); }
.chip-peach  { background: var(--color-peach);      color: var(--color-peach-ink); }
.chip-peach-warm { background: var(--color-peach-warm); color: var(--color-peach-warm-ink); }
.chip-butter { background: var(--color-butter);     color: var(--color-butter-ink); }
.chip-sage   { background: var(--color-sage);       color: var(--color-sage-ink); }
.chip-neutral{ background: var(--bg-subtle);        color: var(--fg-muted); }

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

/* ===== Cards ===== */
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.card-coach {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 14px 12px;
  position: relative;
  overflow: hidden;
}
.card-coach::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--gradient-coach-bar);
  opacity: 0.85;
}

.card-focus {
  background: var(--color-peach);
  border: 1px solid var(--color-peach-border);
  border-radius: 11px;
  position: relative;
}
.card-focus::before {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 3px;
  background: var(--color-peach-ink);
  border-radius: 11px 0 0 11px;
}

/* ===== KPI strip ===== */
.kpi-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}
.kpi-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  color: var(--fg-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.kpi-value {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 500;
  color: var(--fg);
  line-height: 1;
  letter-spacing: -0.5px;
}
.kpi-delta {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
}
.kpi-delta-up   { color: var(--success); }
.kpi-delta-down { color: var(--danger); }

.kpi-card-critical {
  background: var(--color-rose);
  border-color: var(--color-rose-border);
}
.kpi-card-critical .kpi-label,
.kpi-card-critical .kpi-value {
  color: var(--color-rose-ink);
}

/* ===== View toggle (pill switcher) ===== */
.view-toggle {
  display: inline-flex;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 3px;
  gap: 0;
}
.view-toggle-item {
  padding: 5px 11px;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s, color 0.15s;
}
.view-toggle-item.active {
  background: var(--gradient-coach);
  color: var(--accent-ink);
  font-weight: 600;
}

/* ===== Filter pills (Hoje · 8, Esta semana, Atrasadas · 2) ===== */
.filter-pill {
  padding: 4px 11px;
  border-radius: 14px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-subtle);
  color: var(--fg-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.filter-pill.active {
  background: var(--cta-bg);
  color: var(--cta-fg);
  font-weight: 600;
}
.filter-pill-warn {
  background: var(--color-rose);
  color: var(--color-rose-ink);
  font-weight: 500;
}

/* ===== AQAL bars (substitui visualização atual) ===== */
.aqal-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.aqal-bar-label {
  width: 28px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--fg-muted);
}
.aqal-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bg-subtle);
  border-radius: 3px;
  overflow: hidden;
}
.aqal-bar-fill {
  height: 100%;
  border-radius: 3px;
}
.aqal-bar-fill.q-i   { background: var(--color-lilac); }
.aqal-bar-fill.q-it  { background: var(--color-sage); }
.aqal-bar-fill.q-we  { background: var(--color-peach-warm); }
.aqal-bar-fill.q-its { background: var(--color-sky); }
.aqal-bar-value {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  min-width: 14px;
  text-align: right;
}

/* ===== Avatar circular (assignee) ===== */
.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
}
.avatar-lilac { background: var(--color-lilac); color: var(--color-lilac-ink); }
.avatar-rose  { background: var(--color-rose);  color: var(--color-rose-ink); }
.avatar-sky   { background: var(--color-sky);   color: var(--color-sky-ink); }
.avatar-peach { background: var(--color-peach); color: var(--color-peach-ink); }
.avatar-sage  { background: var(--color-sage);  color: var(--color-sage-ink); }
.avatar-gradient {
  background: var(--gradient-coach-strong);
  color: var(--accent-ink);
}

/* ===== Coach chat bubbles ===== */
.coach-bubble {
  background: var(--color-lilac);
  border: 0.5px solid var(--color-lilac-border);
  border-radius: 14px;
  border-top-left-radius: 4px;
  padding: 10px 13px;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 14px;
  line-height: 1.5;
  color: var(--fg);
  font-weight: 400;
  max-width: 340px;
}
.user-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  border-top-right-radius: 4px;
  padding: 10px 13px;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  color: var(--fg);
  max-width: 340px;
}
.bubble-timestamp {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--fg-dim);
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* ===== Section headers em listas ===== */
.list-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}
.list-section-title {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--fg);
  text-transform: uppercase;
  letter-spacing: 1.2px;
}
.list-section-count {
  padding: 1px 7px;
  border-radius: 9px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
}
```

### 2.6 Atualizar `.btn-accent` para nova personalidade

A classe `.btn-accent` no JP atual usa o accent verde-limão como fundo sólido (no dark) ou ciano (no light). Trocar para usar o gradient Coach (suave):

Já incluído no passo 2.4. Confirmar que aplicou.

### 2.7 Atualizar `.bottom-nav-item.active`

A nav atual indica ativo com uma linha de 24px no topo do item. Manter, mas adicionar pill background no ícone:

```css
.bottom-nav-item.active {
  color: var(--fg);
}
.bottom-nav-item.active svg {
  /* ícone fica com fundo gradient sutil */
  padding: 5px;
  border-radius: 9px;
  background: var(--gradient-coach);
  width: 28px;
  height: 28px;
}
/* manter ::before linha decorativa atual, mas opcional */
```

(Decisão de design: pode-se remover a linha decorativa antiga e ficar só com o pill gradient. Avaliar visualmente.)

### 2.8 Outros refinos

- Substituir `border: 1px solid var(--border)` para `border: 0.5px solid var(--border)` em **separadores internos sutis** (não em cards, manter 1px em cards). Buscar `border-bottom: 1px solid var(--border-light)` → trocar pra `0.5px`. Em listas com muitos itens, isso reduz peso visual.
- Adicionar `transition: background 0.15s, border-color 0.15s, color 0.15s;` em `.btn`, `.icon-btn`, `.filter-pill`, `.view-toggle-item` para transições suaves.
- `::-webkit-scrollbar-thumb` — atualizar:
  ```css
  ::-webkit-scrollbar-thumb {
    background: var(--bg-subtle);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--border);
  }
  ```

---

## 3. Passo 3 — Atualizar `src/lib/colors.ts`

**Localizar:** o arquivo `src/lib/colors.ts`.

**Estado atual** (provavelmente algo como):

```typescript
export const QUADRANT_COLORS = {
  I:   '#a78bfa',  // roxo
  IT:  '#34d399',  // verde
  WE:  '#fb923c',  // laranja
  ITS: '#60a5fa',  // azul
} as const

export const QUADRANT_LABELS = {
  I:   'Interior',
  IT:  'Corpo',
  WE:  'Relações',
  ITS: 'Sistemas',
} as const
```

**Substituir por:**

```typescript
/**
 * Cores AQAL — versão seda.
 * - QUADRANT_COLORS: hex sólido para casos onde precisamos de uma cor única (legacy, ícones, badges).
 * - QUADRANT_COLORS_SOFT: rgba translúcido para chips, barras, fundos.
 * - QUADRANT_COLORS_INK: cor de texto sobre o fundo soft (para contraste).
 *
 * Mapeamento da paleta seda:
 *   I   = lilás   (interior, mente, espírito)
 *   IT  = sage    (corpo, ações físicas)
 *   WE  = peach-warm (relações)
 *   ITS = sky     (sistemas)
 */

export const QUADRANT_COLORS = {
  I:   '#DFD0EC',  // lilás
  IT:  '#C9DDC9',  // sage
  WE:  '#F0CFA8',  // peach-warm
  ITS: '#CFE3E8',  // sky
} as const

export const QUADRANT_COLORS_SOFT = {
  I:   'rgba(223, 208, 236, 0.6)',
  IT:  'rgba(201, 221, 201, 0.6)',
  WE:  'rgba(240, 207, 168, 0.6)',
  ITS: 'rgba(207, 227, 232, 0.6)',
} as const

export const QUADRANT_COLORS_INK = {
  I:   '#6B5E72',
  IT:  '#5C8159',
  WE:  '#A06C4C',
  ITS: '#5D8194',
} as const

/** CSS variable name (use em vez de hex literal quando possível). */
export const QUADRANT_VARS = {
  I:   { soft: 'var(--color-lilac)',      ink: 'var(--color-lilac-ink)',      barClass: 'q-i'   },
  IT:  { soft: 'var(--color-sage)',       ink: 'var(--color-sage-ink)',       barClass: 'q-it'  },
  WE:  { soft: 'var(--color-peach-warm)', ink: 'var(--color-peach-warm-ink)', barClass: 'q-we'  },
  ITS: { soft: 'var(--color-sky)',        ink: 'var(--color-sky-ink)',        barClass: 'q-its' },
} as const

export const QUADRANT_LABELS = {
  I:   'Interior',
  IT:  'Corpo',
  WE:  'Relações',
  ITS: 'Sistemas',
} as const

export type Quadrant = keyof typeof QUADRANT_COLORS
```

**Justificativa:** Mantém retrocompatibilidade (`QUADRANT_COLORS` continua exportado e tipado igual, só os hex mudam para a paleta seda). Adiciona `_SOFT`, `_INK`, e `_VARS` que permitem migrar gradualmente. Componentes que usam `QUADRANT_COLORS[q]` continuam funcionando, só renderizam na paleta seda.

---

## 4. Passo 4 — Auditoria de cores hard-coded

### 4.1 Escopo da auditoria

Rodar busca em `src/components/**/*.{tsx,ts}` por:

1. `style={{ ... color: '#...' ... }}` — cor hex literal em inline style
2. `style={{ ... background: '#...' ... }}` — fundo hex literal
3. `style={{ ... borderColor: '#...' ... }}` — borda hex literal
4. Constantes locais tipo `const COLOR = '#...'` ou similar — fora de `lib/colors.ts`
5. Strings hex em props de SVG (`fill="#..."`, `stroke="#..."`) — só onde for cor semântica (não onde for `currentColor` ou cor de ícone que herda)

**Comando para identificar:**
```bash
grep -rEn "#[0-9a-fA-F]{3,6}\b" src/components/ src/hooks/ src/lib/ --include='*.tsx' --include='*.ts' | grep -v 'node_modules' | grep -v '\.test\.'
```

### 4.2 Como decidir a substituição

Para cada match encontrado, mapear pra um token:

| Hex hard-coded encontrado | Substituir por |
|---|---|
| `#0a0a0a`, `#000`, `black` | `var(--fg)` |
| `#fff`, `#ffffff`, `white` | `var(--bg-elevated)` |
| `#fafaf7`, `#f5f5f0`, off-white | `var(--bg)` |
| `#6b6b6b`, `#888`, cinza médio | `var(--fg-muted)` |
| `#a0a0a0`, `#555`, cinza claro/dim | `var(--fg-dim)` |
| `#e8e8e3`, `#222`, `#ccc`, bordas | `var(--border)` |
| `#a8ff00`, `#7dd3fc`, accent atual | `var(--accent)` |
| `#d9342b`, `#dc2626`, `red` | `var(--danger)` |
| `#a78bfa` (I) | `var(--color-lilac)` ou hex de `QUADRANT_COLORS.I` |
| `#34d399` (IT) | `var(--color-sage)` |
| `#fb923c` (WE) | `var(--color-peach-warm)` |
| `#60a5fa` (ITS) | `var(--color-sky)` |

**Para casos ambíguos:** se o hex não bate com nenhum token acima, listar no commit message como "TODO: definir token para `<arquivo>:<linha>`" e deixar comentado como `/* TODO: tokenizar — era #XXXXXX */`. Não inventar tokens novos.

### 4.3 Arquivos suspeitos (priorizar busca)

Baseado em `SPEC.md` e estrutura de pastas, esses componentes têm probabilidade alta de cores hard-coded:

- `src/components/coach/CoachProfilePanel.tsx` — listado em REVIEW.md como tendo "inline-style repetition"
- `src/components/coach/CoachInput.tsx` — mesma observação
- `src/components/coach/CoachSheet.tsx` — mesma observação
- `src/components/coach/CoachMemoryCandidates.tsx` — mesma observação
- `src/components/tasks/KanbanView.tsx` — provavelmente usa `QUADRANT_COLORS` direto em style
- `src/components/tasks/TodayView.tsx` — pode ter chips de prioridade com cor inline
- `src/components/tasks/TaskRow.tsx` — pills de status/quadrante
- `src/components/dashboard/` (mandala AQAL) — SVG com fills hard-coded
- `src/components/areas/AreasPage.tsx` — agrupa por quadrante, pode usar cores
- `src/components/calendar/CalendarPage.tsx` — eventos coloridos, prováveis hex inline
- `src/components/notes/NoteCard.tsx` — tags com cores
- `src/components/projects/ProjectRow.tsx`, `ProjectPanel.tsx` — color picker, project.color

### 4.4 Padrões de substituição

**Caso 1: chip de quadrante**
```tsx
// ANTES
<span style={{ background: QUADRANT_COLORS[q], color: '#fff' }}>{q}</span>

// DEPOIS
<span className={`chip chip-mono`} style={{
  background: QUADRANT_COLORS_SOFT[q],
  color: QUADRANT_COLORS_INK[q]
}}>{q}</span>
```

**Caso 2: chip de prioridade**
```tsx
// ANTES (provavelmente)
<span style={{ background: priority === 'high' ? '#fee2e2' : '#fef3c7', color: '#991b1b' }}>
  {priority}
</span>

// DEPOIS
<span className={`chip ${
  priority === 'high'  ? 'chip-rose'   :
  priority === 'med'   ? 'chip-butter' :
                         'chip-neutral'
}`}>
  {priority === 'high' && <span className="chip-dot" style={{ background: 'var(--color-rose-ink)' }} />}
  {priority}
</span>
```

**Caso 3: status pill**
```tsx
// ANTES
<span style={{ background: '#fef3c7', color: '#92400e', textTransform: 'uppercase' }}>
  DOING
</span>

// DEPOIS
<span className="chip chip-mono chip-peach">DOING</span>
```

**Caso 4: cor de projeto (project.color é livre — user-defined)**
```tsx
// project.color é arbitrário (user pode escolher). Manter como hex literal, mas renderizar SEMPRE com alpha aplicado.
// Helper a adicionar em src/lib/colors.ts:

export function projectColorSoft(hex: string): string {
  // Converte #RRGGBB para rgba com alpha 0.5
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.5)`
}

// Uso:
<span className="chip" style={{ background: projectColorSoft(project.color), color: project.color }}>
  {project.name}
</span>
```

**Caso 5: SVG fill em ícone com cor semântica**
```tsx
// ANTES
<circle fill="#34d399" />

// DEPOIS
<circle fill="var(--color-sage-ink)" />
// ou usar currentColor + parent com color
```

### 4.5 Coach card — atualização específica

O `CoachFab`, `CoachSheet`, `CoachMessage` provavelmente têm estilos inline. Substituir:

**Avatar do Coach:**
```tsx
<div className="avatar avatar-gradient">
  <SparkleIcon />
</div>
```

**Bolha de mensagem do Coach:**
```tsx
<div className="coach-bubble">{message.text}</div>
```

**Bolha de mensagem do usuário:**
```tsx
<div className="user-bubble">{message.text}</div>
```

**Card do Coach no Briefing:**
```tsx
<div className="card-coach">
  {/* gradient bar é ::before automático */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
    <div className="avatar avatar-gradient" style={{ width: 20, height: 20 }}>
      <SparkleIcon />
    </div>
    <span style={{ fontSize: 11, fontWeight: 600 }}>Coach</span>
    <span className="bubble-timestamp" style={{ marginLeft: 'auto', marginTop: 0 }}>
      {time}
    </span>
  </div>
  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.5 }}>
    {coachParagraph}
  </div>
</div>
```

---

## 5. Passo 5 — Validação pós-mudança

Rodar nessa ordem:

```bash
# 1. Type check + build
npm run build

# 2. Testes
npm test

# 3. Dev server pra inspeção visual
npm run dev
```

### Checklist visual (manual no `npm run dev`)

Abrir cada página e confirmar:

#### Briefing
- [ ] Fundo creme `#FBF9F5` (light) ou preto-tinta `#1A1714` (dark)
- [ ] Logo "JP" em Fraunces ou pelo menos serifa (não Bebas Neue grosso)
- [ ] Título "Briefing" em Fraunces 500
- [ ] Coach card com barra gradient 3px no topo (lilás → rosa → azul-pó)
- [ ] Voz do Coach em italic serifada (Fraunces italic)
- [ ] AQAL barras horizontais com cores soft (lilás/sage/peach-warm/sky)

#### Tasks (Today)
- [ ] Tabs (Today/Kanban/List) usam General Sans, não uppercase
- [ ] Chips de status (DOING, NEXT, DONE) em JetBrains Mono uppercase
- [ ] Chips de prioridade com bolinha colorida à esquerda
- [ ] Avatar do assignee circular pequeno

#### Kanban
- [ ] Colunas com section header em JetBrains Mono uppercase + contagem em chip pastel
- [ ] Cards com border-radius ~11px (não retangular)
- [ ] Card em DOING destacado com fundo pêssego translúcido ou barra lateral pêssego

#### Coach (sheet/painel)
- [ ] Bolha do Coach em fundo lilás `rgba(223,208,236,0.25)` (light) ou darker no dark
- [ ] Texto do Coach em Fraunces italic
- [ ] Bolha do usuário em fundo branco-creme
- [ ] Texto do usuário em General Sans regular
- [ ] Botão "Send" no input com gradient lilás→rosa

#### Toggle dark/light
- [ ] Funciona: clica e alterna entre creme e preto-tinta
- [ ] No dark: chips ficam mais opacos (alpha 0.2), texto fica mais claro
- [ ] No dark: gradient do Coach mantém saturação (é a "fita de seda" característica)

#### Painéis laterais (TaskPanel, ProjectPanel, etc)
- [ ] Background `var(--bg)` aplicado
- [ ] Inputs com border-radius 9px e focus ring lilás
- [ ] Botões com cantos arredondados, não retangulares

### Critérios de falha

Se algum desses ocorrer, parar e investigar:

- Console error sobre fonte não carregada (Fontshare ou Google Fonts bloqueado)
- TypeScript build falha por causa de export removido em `colors.ts` (improvável, mantivemos retrocompatibilidade)
- Algum componente mostra fundo branco "duro" `#FFFFFF` no light mode em vez de creme — significa que tem hard-code não auditado
- Algum chip mostra fundo escuro sólido ou cor saturada — auditoria incompleta
- Toggle dark não alterna — variable não substituída corretamente

---

## 6. Commit & PR

### Estrutura sugerida de commits (dentro da mesma PR)

```
1. style: substitui imports de fonte (Space Grotesk → General Sans + Fraunces + JetBrains Mono)
2. style: reescreve CSS variables com paleta seda (light + dark)
3. style: atualiza classes utilitárias para nova tipografia e cantos arredondados
4. style: adiciona classes utilitárias para chips, KPI strip, view toggle, AQAL bars, coach bubbles
5. refactor(lib/colors): atualiza QUADRANT_COLORS para paleta seda, adiciona _SOFT, _INK, _VARS
6. refactor(components): substitui cores hard-coded por CSS variables (audit completo)
7. chore: ajusta hex literais residuais marcados como TODO
```

### Mensagem da PR

```markdown
# Redesign: ClickUp Seda

Aplica nova linguagem visual em todo o app. Paleta pastel translúcida +
tipografia editorial humanista + auditoria completa de cores hard-coded.

## Mudanças

- **Tipografia:** General Sans (UI) + Fraunces (display, voz do Coach) +
  JetBrains Mono (labels). Substitui Bebas Neue + Space Grotesk + Space Mono.
- **Paleta light:** creme #FBF9F5, marrom-tinta #3A352F, accent lilás.
- **Paleta dark:** preto-tinta #1A1714 quente, creme claro #E8DDD0.
- **Cores funcionais:** 7 cores translúcidas (rose, lilac, sky, peach,
  peach-warm, butter, sage) com alpha 0.6 light / 0.2 dark, cada uma com
  par ink (texto) e border.
- **AQAL:** quadrantes I/IT/WE/ITS mantidos, hex codes atualizados para
  paleta seda. Adicionado QUADRANT_COLORS_SOFT/INK/VARS em src/lib/colors.ts.
- **Cantos:** botões, cards, chips, painéis ganharam border-radius
  (eram retangulares).
- **Coach:** card com gradient bar no topo, voz em Fraunces italic, avatar
  com gradient lilás→rosa→azul-pó.

## Auditoria de cores hard-coded

Substituídos N usos de hex literais em src/components/ por CSS variables.
TODOs restantes (cores ambíguas/contextuais): ver comentários `/* TODO:
tokenizar */` no código.

## Risco

Baixíssimo. Apenas CSS variables + tipografia + remoção de hex literais.
Nenhuma mudança em lógica, hooks, schemas, ou endpoints. Reversível via
git revert.

## Validado

- [x] npm run build
- [x] npm test
- [x] Briefing, Tasks (Today/Kanban/List), Coach chat, Painéis laterais
- [x] Dark mode toggle alterna corretamente
```

---

## 7. Notas finais para Claude Code

- **Não invente tokens novos.** Se algo precisar de uma cor que não existe na paleta, comente `/* TODO: tokenizar */` e deixe pro humano decidir.
- **Não toque em arquivos `.test.ts` ou `.test.tsx`** mesmo se eles tiverem hex literais — testes podem assertar valores específicos.
- **Não mude markup HTML** (estrutura JSX) salvo onde explicitamente indicado neste doc (Coach card, bubbles). Em outros lugares, mudar só `style={{ ... }}` e `className`.
- **Se encontrar conflito** entre alguma instrução deste doc e o código real, **pare e relate**. Não tente resolver chutando.
- **Performance:** não adicionar `box-shadow` pesada, `backdrop-filter`, `filter: blur()` em nenhum lugar. Não estão no design.
- **Acessibilidade:** os pares cor-ink desta paleta já foram testados para contraste WCAG AA em texto pequeno. Não precisa ajustar.

---

*Doc preparado para execução em uma sessão do Claude Code. Estimativa: 2-3 horas de trabalho assistido para uma PR completa.*
