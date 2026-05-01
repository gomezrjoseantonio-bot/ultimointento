# TAREA CC · TAREA 22 · Reconstrucción Dashboard + Sidebar + Topbar · v2

> **Versión** · v2 (sustituye v1) · incorpora § Z Tokens canónicos · § AA mapeo iconos SVG→Lucide · decisión γ (composición sin Financiación)
>
> **Tipo** · refactor de UI viva · cierra deuda T20 detectada en auditoría post-cierre
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama base** · cada sub-tarea desde `main` actualizado tras la anterior · NO rama madre · NO acumular
>
> **Alcance global** · llevar la UI implementada del Panel + Sidebar + Topbar al estado del mockup `atlas-panel.html` aprobado y la guía v5 secciones 3.2-3.3 · sustituir headers obsoletos del sidebar (`SUPERVISIÓN` · `GESTIÓN` · `DOCS`) por la nueva agrupación canónica (`MIS ACTIVOS` + `OPERATIVA` + separador limpio para Ajustes) · añadir topbar global con search box ⌘K + bell + help · reconstruir Dashboard con sus 8 secciones del mockup
>
> **Tiempo estimado total** · 12-18h Copilot · 5-8h revisión Jose
>
> **Prioridad** · ALTA · pantalla cabecera de la app
>
> **Predecesores cerrados** · T15 ✅ · T14 ✅ · T20 ✅ (con sombras)
>
> **DB** · NO se toca schema · DB_VERSION sigue en 65 · 40 stores
>
> **Stores tocados** · ninguno · es refactor visual sobre datos existentes

---

## 0 · Reglas inviolables (idénticas T17 / T20 / T15 / T14 / T9)

### 0.1 · STOP-AND-WAIT estricto entre sub-tareas
CC implementa una sub-tarea · publica PR · DETIENE EJECUCIÓN · espera revisión Jose en deploy preview · NO empieza la siguiente hasta merge + autorización.

### 0.2 · NO inventar
Si CC encuentra ambigüedad · PARAR · comentar PR · esperar input. Si encuentra bug fuera de scope · documentar TODO · seguir.

### 0.3 · Datos del usuario intactos · T22 no migra ningún dato

### 0.4 · Mockup + guía v5 son ley
- Mockup vigente · `docs/audit-inputs/atlas-panel.html` (693 líneas validado)
- Guía vigente · `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` secciones 3.2 y 3.3
- Si conflicto · prevalece guía v5

### 0.5 · Cero hex hardcoded · tokens canónicos obligatorios (ver § Z)

### 0.6 · Aprovechar biblioteca v5 ya construida (T20.0)
Tokens en `src/design-system/v5/tokens.css` con prefijo `--atlas-v5-*` · idénticos al mockup. Componentes ya en biblioteca · `<PageHead>` · `<CardV5>` · `<KPIStrip>` · `<KPI>` · `<HeroBanner>` · `<MoneyValue>` · `<DateLabel>` · `<Pill>` · `<IconButton>`. Iconografía en `src/design-system/v5/icons.ts` · ampliar si T22 requiere conceptos no presentes.

---

## Z · Tokens y dimensiones canónicas (CITAS LITERALES DEL MOCKUP)

**Esta sección es fuente de verdad.** Todos los valores aquí citados provienen del CSS del mockup líneas 10-241. CC debe usar EXACTAMENTE estos valores · sin aproximar · sin redondear · sin "mejorar".

### Z.1 · Mapeo tokens mockup ↔ biblioteca v5

| Token mockup | Hex | Token biblioteca v5 |
|---|---|---|
| `--bg` | `#F5F4F1` | `--atlas-v5-bg` |
| `--card` | `#FFFFFF` | `--atlas-v5-card` |
| `--card-alt` | `#FBFAF6` | `--atlas-v5-card-alt` |
| `--line` | `#E6E3DC` | `--atlas-v5-line` |
| `--line-2` | `#EFECE5` | `--atlas-v5-line-2` |
| `--ink` | `#141B2E` | `--atlas-v5-ink` |
| `--ink-2` | `#2C3547` | `--atlas-v5-ink-2` |
| `--ink-3` | `#5B6474` | `--atlas-v5-ink-3` |
| `--ink-4` | `#8A92A0` | `--atlas-v5-ink-4` |
| `--ink-5` | `#B8BEC8` | `--atlas-v5-ink-5` |
| `--brand` | `#1E2954` | `--atlas-v5-brand` |
| `--brand-2` | `#2A3875` | `--atlas-v5-brand-2` |
| `--brand-ink` | `#0C1230` | `--atlas-v5-brand-ink` |
| `--brand-wash` | `#E8EAF0` | `--atlas-v5-brand-wash` |
| `--gold` | `#B88A3E` | `--atlas-v5-gold` |
| `--gold-2` | `#C59A47` | `--atlas-v5-gold-2` |
| `--gold-wash` | `#F3EAD6` | `--atlas-v5-gold-wash` |
| `--gold-ink` | `#7C5C1F` | `--atlas-v5-gold-ink` |
| `--pos` | `#1E6B3A` | `--atlas-v5-pos` |
| `--pos-wash` | `#E4F0E8` | `--atlas-v5-pos-wash` |
| `--neg` | `#A43328` | `--atlas-v5-neg` |
| `--neg-wash` | `#F5E3E0` | `--atlas-v5-neg-wash` |
| `--warn` | `#8A6213` | `--atlas-v5-warn` |
| `--warn-wash` | `#F5ECD6` | `--atlas-v5-warn-wash` |

**Mapping de activos por color (mockup §85-105):**

| Activo | Color token | Uso |
|---|---|---|
| Inmuebles | `--brand` (navy) | segmento composición · borde card pulso |
| Inversiones | `--gold` (oro) | segmento composición · borde card pulso |
| Tesorería | `--pos` (verde) | segmento composición · borde card pulso |
| Financiación | `--neg` (rojo) | borde card pulso · NO está en barra composición (γ) |

### Z.2 · Tipografías (mockup §23-24)

```css
font-family: 'Inter', system-ui, sans-serif;        /* UI body */
font-family: 'JetBrains Mono', monospace;            /* números técnicos · clase .mono */
font-variant-numeric: tabular-nums;                  /* SIEMPRE en JetBrains Mono */
```

Body global · `font-size: 13.5px` · `line-height: 1.5` · `letter-spacing: -0.005em` · `-webkit-font-smoothing: antialiased`.

### Z.3 · Layout app (mockup §28)

```css
.app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.main { padding: 22px 32px 48px; max-width: 1520px; }
```

### Z.4 · Sidebar dimensiones canónicas (mockup §31-49)

```css
.side { background: var(--brand-ink); padding: 22px 0; height: 100vh; sticky; overflow-y: auto; }

.brand { padding: 4px 22px 20px; border-bottom: 1px solid rgba(255,255,255,.06); }
.brand-mark { width: 32px; height: 32px; border-radius: 8px;
              background: linear-gradient(135deg, #E8D9AE, #B88A3E);
              color: var(--brand-ink); font-weight: 700; font-size: 15px; }
.brand-name { color: #FFFFFF; font-weight: 700; font-size: 17px; line-height: 1; letter-spacing: -0.015em; }
.brand-sub { font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
             color: rgba(255,255,255,.42); margin-top: 3px; }

.nav-section { padding: 20px 22px 6px; font-size: 10px; font-weight: 600;
               letter-spacing: .2em; text-transform: uppercase;
               color: rgba(255,255,255,.38); }
.nav-sep { margin: 14px 22px 4px; border-top: 1px solid rgba(255,255,255,.06); }

.nav { display: flex; flex-direction: column; gap: 1px; padding: 0 12px; }
.nav a { padding: 9px 12px; border-radius: 7px; gap: 11px;
         color: #B9BFCC; font-size: 13.5px; font-weight: 500; }
.nav a:hover { background: rgba(255,255,255,.04); color: #FFFFFF; }
.nav a.active { background: rgba(255,255,255,.07); color: #FFFFFF;
                box-shadow: inset 2px 0 0 var(--gold); padding-left: 10px; }
.nav a.active svg { color: var(--gold); }
.nav a svg { flex-shrink: 0; opacity: .85; }

.side-foot { margin-top: auto; padding: 14px 22px 4px;
             border-top: 1px solid rgba(255,255,255,.06); }
.avatar { width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #E8D9AE, #B88A3E);
          color: var(--brand-ink); font-weight: 700; font-size: 12px; }
.side-foot-name { font-size: 13px; color: #FFFFFF; font-weight: 600; line-height: 1.15; }
.side-foot-sub { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 1px; }
```

### Z.5 · Topbar dimensiones canónicas (mockup §53-62)

```css
.topbar { display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 22px; gap: 16px; }
.search { flex: 1; max-width: 440px; gap: 10px;
          background: var(--card); border: 1px solid var(--line); border-radius: 9px;
          padding: 8px 12px; }
.search input { font-size: 13px; color: var(--ink); background: transparent; }
.search svg { color: var(--ink-4); }
.kbd { font-family: 'JetBrains Mono', monospace; font-size: 10px;
       padding: 2px 6px; border: 1px solid var(--line); border-radius: 4px;
       color: var(--ink-4); background: var(--bg); }
.tb-actions { gap: 10px; }
.icon-btn { width: 38px; height: 38px; border-radius: 8px;
            background: var(--card); border: 1px solid var(--line);
            color: var(--ink-2); }
.icon-btn:hover { border-color: var(--ink-5); }
.badge { position: absolute; top: -4px; right: -4px;
         background: var(--gold); color: #fff;
         font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 8px; }
.badge.neg { background: var(--neg); }
```

### Z.6 · Page-head saludo (mockup §65-71)

```css
.page-head { margin-bottom: 20px; gap: 20px; align-items: flex-end; }
h1 { font-size: 28px; font-weight: 700; color: var(--ink);
     line-height: 1.05; letter-spacing: -0.025em; }
.saludo-sub { font-size: 13.5px; color: var(--ink-4); margin-top: 6px; font-weight: 400; }
.saludo-sub strong { color: var(--ink-2); font-weight: 600; }
.btn { padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
       border: 1px solid transparent; gap: 8px; }
.btn-ghost { background: var(--card); color: var(--ink-2); border-color: var(--line); }
.btn-ghost:hover { border-color: var(--ink-5); }
```

### Z.7 · Hero patrimonial (mockup §73-83)

```css
.hero-patrimonial { background: var(--card); border: 1px solid var(--line);
                    border-top: 3px solid var(--gold);   /* CRÍTICO · borde superior oro */
                    border-radius: 12px; padding: 28px 32px; margin-bottom: 22px; }
.hero-head { display: flex; justify-content: space-between; align-items: flex-start;
             margin-bottom: 20px; }
.hero-lab { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em;
            color: var(--ink-4); font-weight: 600; }
.hero-valor { font-family: 'JetBrains Mono', monospace;
              font-size: 44px; font-weight: 700;
              color: var(--ink); letter-spacing: -0.035em; line-height: 1;
              margin-top: 10px; font-variant-numeric: tabular-nums; }
.hero-delta { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;
              font-family: 'JetBrains Mono', monospace;
              font-size: 13px; font-weight: 600; color: var(--pos); }
.hero-delta.neg { color: var(--neg); }
.hero-delta-meta { color: var(--ink-4); font-weight: 500; }
.hero-meta-right { text-align: right; }
.hero-meta-lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em;
                 color: var(--ink-4); font-weight: 600; }
.hero-meta-val { font-family: 'JetBrains Mono', monospace;
                 font-size: 14px; font-weight: 600; color: var(--ink-2); margin-top: 4px; }
```

**Color valor patrimonial neto** · siempre `var(--ink)` (navy oscuro · no oro · no rojo). Acento oro vive en `border-top: 3px` y flecha del delta.

### Z.8 · Composición barra · DECISIÓN γ · 3 segmentos solo activos (mockup §85-105)

```css
.comp-barra { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line-2); }
.comp-head { display: flex; justify-content: space-between; align-items: center;
             margin-bottom: 10px; }
.comp-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
              color: var(--ink-4); font-weight: 600; }
.comp-track { display: flex; height: 12px;     /* CRÍTICO altura barra */
              border-radius: 6px; overflow: hidden; gap: 2px; }
.comp-seg { height: 100%; cursor: pointer; transition: opacity .14s; }
.comp-seg:hover { opacity: .85; }
.comp-seg.inmuebles { background: var(--brand); }
.comp-seg.inversiones { background: var(--gold); }
.comp-seg.tesoreria { background: var(--pos); }
/* DECISIÓN γ · NO existe .comp-seg.financiacion */

.comp-leg { display: flex; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
.comp-leg-item { display: flex; align-items: center; gap: 8px; font-size: 11.5px; }
.comp-leg-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.comp-leg-dot.inmuebles { background: var(--brand); }
.comp-leg-dot.inversiones { background: var(--gold); }
.comp-leg-dot.tesoreria { background: var(--pos); }
.comp-leg-nom { color: var(--ink-3); font-weight: 500; }
.comp-leg-val { color: var(--ink); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.comp-leg-pct { color: var(--ink-4); font-family: 'JetBrains Mono', monospace; font-weight: 500; }
```

**DECISIÓN γ · CRÍTICA** · Barra = solo 3 segmentos activos · Inmuebles + Inversiones + Tesorería. Suma porcentajes = 100% sobre **activos brutos** (no patrimonio neto). Financiación en KPI derecho del hero como "Deuda Viva". Etiqueta "Otros" eliminada.

Texto subtítulo hero · cambiar de "↗ activos - deuda · consolidado" a "↗ activos brutos · sin deuda".

### Z.9 · Cards Pulso 4 activos (mockup §111-130)

```css
.activos-grid { display: grid; grid-template-columns: repeat(4, 1fr);
                gap: 14px; margin-bottom: 22px; }
.activo-card { background: var(--card); border: 1px solid var(--line);
               border-radius: 11px; padding: 18px 20px; cursor: pointer;
               transition: all .14s; position: relative; overflow: hidden; }
.activo-card:hover { border-color: var(--gold); transform: translateY(-1px);
                     box-shadow: 0 4px 10px rgba(14,20,35,0.04); }
.activo-card.inmuebles { border-left: 3px solid var(--brand); padding-left: 19px; }
.activo-card.inversiones { border-left: 3px solid var(--gold); padding-left: 19px; }
.activo-card.tesoreria { border-left: 3px solid var(--pos); padding-left: 19px; }
.activo-card.financiacion { border-left: 3px solid var(--neg); padding-left: 19px; }
.activo-head { margin-bottom: 12px; }
.activo-nom { font-size: 12px; color: var(--ink-2); font-weight: 600;
              text-transform: uppercase; letter-spacing: 0.1em; }
.activo-icon { color: var(--ink-4); }
.activo-val { font-family: 'JetBrains Mono', monospace;
              font-size: 22px; font-weight: 700; color: var(--ink);
              letter-spacing: -0.025em; line-height: 1; font-variant-numeric: tabular-nums; }
.activo-val.neg { color: var(--neg); }
.activo-delta { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 11.5px; font-weight: 600; color: var(--pos); }
.activo-delta.neg { color: var(--neg); }
.activo-delta.muted { color: var(--ink-4); font-weight: 500; }
.activo-extra { margin-top: 14px; padding-top: 12px;
                border-top: 1px solid var(--line-2);
                display: flex; justify-content: space-between; align-items: center; }
.activo-extra-lab { font-size: 11px; color: var(--ink-4); }
.activo-extra-val { font-family: 'JetBrains Mono', monospace;
                    font-size: 12px; font-weight: 600; color: var(--ink-2); }
.activo-cta { font-size: 11px; color: var(--gold); font-weight: 600; margin-top: 8px;
              opacity: 0; transition: opacity .14s; }
.activo-card:hover .activo-cta { opacity: 1; }
```

Responsive · 4 cols >1100px · 2 cols 700-1100px · 1 col <700px.

### Z.10 · Pulso del mes (mockup §132-140)

```css
.pulso { background: var(--card); border: 1px solid var(--line);
         border-radius: 11px; padding: 18px 22px; margin-bottom: 22px;
         display: grid; grid-template-columns: auto repeat(4, 1fr);
         gap: 28px; align-items: center; }
.pulso-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
               color: var(--ink-4); font-weight: 700;
               border-right: 1px solid var(--line-2); padding-right: 20px; }
.pulso-title .mes { display: block; color: var(--ink);
                    font-size: 13px; letter-spacing: -0.005em;
                    text-transform: none; font-weight: 600; margin-top: 2px; }
.pulso-item { display: flex; flex-direction: column; gap: 3px; }
.pulso-lab { font-size: 10.5px; color: var(--ink-4);
             text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
.pulso-val { font-family: 'JetBrains Mono', monospace;
             font-size: 17px; font-weight: 700; color: var(--ink);
             letter-spacing: -0.015em; }
.pulso-val.pos { color: var(--pos); }
.pulso-val.neg { color: var(--neg); }
```

### Z.11 · Two-cols · alertas + Mi Plan (mockup §142-190)

```css
.two-cols { display: grid; grid-template-columns: 1.5fr 1fr;
            gap: 14px; margin-bottom: 22px; }

.card { background: var(--card); border: 1px solid var(--line);
        border-radius: 12px; padding: 22px; }
.card-hd { display: flex; justify-content: space-between; align-items: flex-start;
           margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 700; color: var(--ink);
              letter-spacing: -0.015em; }
.card-sub { font-size: 12px; color: var(--ink-4); margin-top: 3px; }
.card-action { font-size: 12px; color: var(--gold); padding: 4px 8px; border-radius: 6px;
               font-weight: 500; cursor: pointer; }
.card-action:hover { background: var(--gold-wash); }

/* Alertas */
.alerta { display: grid; grid-template-columns: 34px 1fr auto; gap: 14px;
          padding: 14px 0; border-bottom: 1px solid var(--line-2);
          align-items: center; cursor: pointer; }
.alerta:last-child { border-bottom: none; padding-bottom: 0; }
.alerta:first-child { padding-top: 0; }
.alerta:hover .alerta-title { color: var(--gold); }
.alerta-icon { width: 34px; height: 34px; border-radius: 8px; }
.alerta-icon.neg { background: var(--neg-wash); color: var(--neg); }
.alerta-icon.warn { background: var(--gold-wash); color: var(--gold-ink); }
.alerta-icon.pos { background: var(--pos-wash); color: var(--pos); }
.alerta-icon.muted { background: var(--bg); color: var(--ink-3); }
.alerta-title { font-size: 13.5px; font-weight: 600; color: var(--ink);
                letter-spacing: -0.005em; }
.alerta-meta { font-size: 11.5px; color: var(--ink-4); margin-top: 3px;
               font-family: 'JetBrains Mono', monospace; line-height: 1.4; }
.alerta-meta strong { color: var(--ink-2); font-weight: 600; }
.alerta-right { text-align: right; font-family: 'JetBrains Mono', monospace;
                font-size: 12.5px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.alerta-right.neg { color: var(--neg); }
.alerta-right.warn { color: var(--warn); }
.alerta-right.pos { color: var(--pos); }
.alerta-right-sub { font-size: 10.5px; color: var(--ink-4); margin-top: 3px; font-weight: 500; }

/* Mi Plan */
.plan-meta-grande { text-align: center; padding: 10px 0 18px;
                    border-bottom: 1px solid var(--line-2); }
.plan-meta-lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.14em;
                 color: var(--ink-4); font-weight: 600; margin-bottom: 8px; }
.plan-meta-val { font-family: 'JetBrains Mono', monospace;
                 font-size: 36px; font-weight: 700; color: var(--ink);
                 letter-spacing: -0.03em; line-height: 1; }
.plan-meta-sub { font-size: 12px; color: var(--ink-3); margin-top: 8px; font-weight: 500; }
.plan-meta-sub strong { color: var(--gold-ink); font-weight: 700; }
.plan-progreso-head { margin-bottom: 8px; }
.plan-progreso-lab { font-size: 11px; color: var(--ink-4);
                     text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
.plan-progreso-pct { font-family: 'JetBrains Mono', monospace;
                     font-size: 13px; font-weight: 700; color: var(--ink); }
.plan-track { height: 8px; background: var(--bg); border-radius: 4px;
              border: 1px solid var(--line-2); overflow: hidden; }
.plan-fill { height: 100%; background: var(--gold); border-radius: 4px; }
.plan-item { padding: 10px 0; border-bottom: 1px solid var(--line-2);
             display: flex; justify-content: space-between; align-items: center; }
.plan-item:last-child { border-bottom: none; }
.plan-item-lab { font-size: 12px; color: var(--ink-3); font-weight: 500; }
.plan-item-val { font-family: 'JetBrains Mono', monospace;
                 font-size: 13px; font-weight: 700; color: var(--ink); }
```

### Z.12 · Mini-timeline 12 meses (mockup §192-235)

```css
.mini-timeline { background: var(--card); border: 1px solid var(--line);
                 border-radius: 11px; padding: 18px 22px; margin-bottom: 14px; }
.mini-tl-head { margin-bottom: 14px; }
.mini-tl-title { font-size: 13px; font-weight: 700; color: var(--ink);
                 letter-spacing: -0.01em; }
.mini-tl-sub { font-size: 11.5px; color: var(--ink-4); margin-top: 2px; }
.mini-tl-stack { position: relative; }

/* Fila 1 · MESES */
.mini-tl-months-row { display: grid; grid-template-columns: repeat(12, 1fr);
                      border: 1px solid var(--line-2); border-radius: 5px;
                      background: var(--bg); height: 26px; position: relative; }
.mini-tl-month { text-align: center; font-family: 'JetBrains Mono', monospace;
                 font-size: 10px; color: var(--ink-3); padding-top: 7px;
                 border-left: 1px solid var(--line-2);
                 font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.mini-tl-month:first-child { border-left: none; }

/* Fila 2 · EVENTOS */
.mini-tl-events-row { position: relative; height: 34px; margin-top: 6px; }
.mini-tl-events-row::before { content: ''; position: absolute; left: 0; right: 0;
                              top: 50%; height: 1px; background: var(--line-2); }

/* Línea HOY · roja */
.mini-tl-today { position: absolute; top: 0; bottom: 0; width: 2px;
                 background: var(--neg); z-index: 5; pointer-events: none; }
.mini-tl-today-lab { position: absolute; top: -10px; left: 50%;
                     transform: translateX(-50%);
                     font-family: 'JetBrains Mono', monospace;
                     font-size: 8.5px; font-weight: 700; color: #fff;
                     background: var(--neg); padding: 1px 5px; border-radius: 3px;
                     letter-spacing: 0.06em; white-space: nowrap; }

/* Eventos */
.mini-tl-evento { position: absolute; top: 50%; transform: translateY(-50%);
                  display: inline-flex; align-items: center; gap: 5px;
                  padding: 4px 9px; border-radius: 5px; cursor: pointer;
                  font-family: 'JetBrains Mono', monospace;
                  font-size: 10px; font-weight: 700; color: #fff;
                  transition: transform .1s, box-shadow .1s; white-space: nowrap; }
.mini-tl-evento:hover { transform: translateY(-50%) scale(1.05);
                        box-shadow: 0 3px 8px rgba(14,20,35,0.15); z-index: 10; }
.mini-tl-evento.fiscal { background: var(--brand); }
.mini-tl-evento.contrato { background: var(--gold); }
.mini-tl-evento.deuda { background: var(--neg); }
.mini-tl-evento.devolucion { background: var(--pos); }
.mini-tl-evento.stack-b { top: calc(50% + 16px); }   /* 2º carril si solapan */

.mini-tl-leg { margin-top: 14px; padding-top: 12px;
               border-top: 1px solid var(--line-2);
               display: flex; gap: 18px; flex-wrap: wrap;
               font-size: 11px; color: var(--ink-3); }
.mini-tl-leg-item { display: flex; align-items: center; gap: 6px; }
.mini-tl-leg-mini { width: 12px; height: 10px; border-radius: 2px; }
.mini-tl-leg-mini.fiscal { background: var(--brand); }
.mini-tl-leg-mini.contrato { background: var(--gold); }
.mini-tl-leg-mini.deuda { background: var(--neg); }
.mini-tl-leg-mini.devolucion { background: var(--pos); }
```

---

## AA · Mapeo SVG mockup → Lucide-react

CC mapea cada SVG inline del mockup a su componente Lucide. Si una entrada falta en `src/design-system/v5/icons.ts` · CC la añade en T22.1 documentando en PR. **Tamaño de iconos · respetar el del mockup en cada caso**.

### AA.1 · Sidebar entries (16x16 stroke 1.7)

| Concepto | SVG resumen mockup | Lucide |
|---|---|---|
| Panel | 4 rects asimétricos | `LayoutGrid` |
| Inmuebles | rect 16x20 + path techo | `Building2` |
| Inversiones | grid + linea ascendente | `TrendingUp` |
| Tesorería | rect + line horizontal | `Wallet` |
| Financiación | base + columnas + techo | `Landmark` |
| Personal | (mockup tiene bug · usa Building2) | `User` ← CORREGIR · ver § AA.9 |
| Contratos | doc esquina doblada | `FileText` |
| Mi Plan | flechas izq/der | `Compass` |
| Fiscal | doc esquina doblada | `Receipt` |
| Archivo | rect con líneas dentro | `Archive` |
| Ajustes | engranaje | `Settings` |

### AA.2 · Topbar (16x16 stroke 2 · 14x14 stroke 1.8)

| Concepto | Lucide |
|---|---|
| Search input | `Search` |
| Bell notificaciones | `Bell` |
| Help ayuda | `HelpCircle` |

### AA.3 · Botón "Últimos 30 días" (14x14 stroke 1.8)

| Concepto | Lucide |
|---|---|
| Reloj | `Clock` |

### AA.4 · Activo cards · iconos derecha (18x18 stroke 1.7)

| Card | Lucide |
|---|---|
| Inmuebles | `Building2` (consistencia con sidebar) |
| Inversiones | `TrendingUp` |
| Tesorería | `Wallet` |
| Financiación | `Landmark` |

### AA.5 · CTA arrows (10x10 stroke 2.5)

| Concepto | Lucide |
|---|---|
| "Ver detalle →" | `ArrowRight` |

### AA.6 · Alertas iconos según severidad (10x10 stroke 2.2)

| Severidad | Lucide | Fondo · Color icono |
|---|---|---|
| Crítica (deuda) | `FileText` | `--neg-wash` · `--neg` |
| Pos (devolución listo) | `FileText` | `--pos-wash` · `--pos` |
| Warn (contrato vence) | `Calendar` | `--gold-wash` · `--gold-ink` |
| Warn (obligación próx) | `FileText` | `--gold-wash` · `--gold-ink` |
| Muted (info menor) | `AlertTriangle` | `--bg` · `--ink-3` |

### AA.7 · Timeline · eventos chip (10x10)

| Categoría | Lucide | Background chip |
|---|---|---|
| Fiscal | `FileText` | `--brand` |
| Contrato | `Calendar` | `--gold` |
| Deuda | `AlertTriangle` | `--neg` |
| Devolución | `Banknote` (alt · `Inbox`) | `--pos` |

### AA.8 · Iconos auxiliares

| Uso | Lucide |
|---|---|
| Flecha delta positiva | `ArrowUpRight` |
| Flecha delta negativa | `ArrowDownRight` |
| Flecha CTA card | `ArrowRight` |
| Sidebar collapse expandir | `ChevronsLeft` / `ChevronsRight` |

### AA.9 · Excepción Personal

⚠ El mockup tiene un BUG · sidebar reusa icono Inmuebles para Personal. CC NO replica el bug · usa `User` para Personal según convención general.

---

## 1 · Datos verificados (auditoría inicial Claude)

### 1.1 · Sidebar implementado vs guía v5
3 headers obsoletos (`SUPERVISIÓN` · `GESTIÓN` · `DOCS`) sustituidos por agrupación canónica `MIS ACTIVOS` + `OPERATIVA` + separador limpio.

### 1.2 · Topbar implementada
NO existe · 22.1 la construye desde cero.

### 1.3 · Dashboard implementado
~30% del mockup. 8 secciones · faltan 5 enteras + 3 parciales.

### 1.4 · Tokens biblioteca v5 vs mockup
Coinciden 1:1 · solo cambia prefijo `--atlas-v5-*`. Ver § Z.1.

---

## 2 · SUB-TAREA 22.1 · Sidebar nuevo + Topbar global

### 2.1 · Sidebar (ver § Z.4 dimensiones · § AA.1 iconos)

```
[Atlas brand]
─────────────
Panel                              ← sin grupo

─── MIS ACTIVOS ──                 ← .nav-section
Inmuebles · Inversiones · Tesorería · Financiación · Personal

─── OPERATIVA ──                   ← .nav-section
Contratos · Mi Plan · Fiscal · Archivo

─── separador limpio ──            ← .nav-sep
Ajustes

─────────────
[Avatar Usuario Demo · free]
```

#### Reglas estrictas
- 11 items en orden EXACTO
- Headers `MIS ACTIVOS` y `OPERATIVA` clase `.nav-section` con tokens § Z.4
- Separador antes de Ajustes · `.nav-sep` sin texto
- Item activo · `inset 2px 0 0 var(--gold)` + icono oro + fondo `rgba(255,255,255,.07)`
- Iconos · § AA.1 · 16x16 stroke 1.7

### 2.2 · Topbar global (ver § Z.5 · § AA.2)

```html
<div class="topbar">
  <div class="search">
    <Search size={16} />
    <input placeholder="Buscar inmueble, contrato, movimiento..." />
    <span class="kbd">⌘K</span>
  </div>
  <div class="tb-actions">
    <button class="icon-btn"><Bell size={16} /><span class="badge">12</span></button>
    <button class="icon-btn"><HelpCircle size={16} /></button>
  </div>
</div>
```

- Persistente en TODAS pantallas
- Search ⌘K stub · placeholder dropdown "Buscar próximamente"
- Bell click stub · "Sin notificaciones"
- Help click stub · "Centro de ayuda · próximamente"
- Badge bell hardcoded `12` · TODO real

### 2.3 · Layout
```
[Sidebar 240px] | [Topbar V5 · padding 22px 32px]
                | ──────────────────────
                | [Outlet · módulo]
```

### 2.4 · Verificación 22.1
- [ ] tsc + build pasa
- [ ] 11 items en orden exacto · 2 headers + 1 separador · sin headers obsoletos
- [ ] Item activo correcto
- [ ] Iconos § AA.1
- [ ] Topbar visible TODAS pantallas
- [ ] Stubs no rompen
- [ ] Cero hex hardcoded
- [ ] Cero ruptura otros módulos

### 2.5 · PR 22.1
Título · `feat(layout): T22.1 · sidebar v5 nueva agrupación + topbar global`

**STOP-AND-WAIT**

---

## 3 · SUB-TAREA 22.2 · Saludo + Hero patrimonial + Composición γ

### 3.1 · Saludo (§ Z.6)

```tsx
<div className="page-head">
  <div>
    <h1>{saludoHoraria}, {nombreUsuario}</h1>
    <p className="saludo-sub">
      hoy es <strong>{fechaHoy}</strong>
      {campañaIRPF && <> · {campañaIRPF}</>}
      {nAtenciones > 0 && <> · <strong>{nAtenciones} {pluralizar('cosa pide', nAtenciones)} tu atención</strong></>}
    </p>
  </div>
  <button className="btn btn-ghost"><Clock size={14} /> Últimos 30 días</button>
</div>
```

- `saludoHoraria` · "Buenos días" (00-12) · "Buenas tardes" (12-20) · "Buenas noches" (20-24)
- `nombreUsuario` · `getFiscalContext().nombre` · fallback "usuario"
- `fechaHoy` · "viernes, 1 de mayo de 2026"
- `campañaIRPF` · si fecha ∈ campaña · "campaña IRPF {ejercicio} activa" · si no · NO mostrar
- `nAtenciones` · contador desde sección 6 · si no construida · 0 + TODO

### 3.2 · Hero patrimonial (§ Z.7)

```tsx
<div className="hero-patrimonial">
  <div className="hero-head">
    <div>
      <div className="hero-lab">PATRIMONIO NETO</div>
      <div className="hero-valor">{formatMoney(patrimonioNeto)}</div>
      <div className={`hero-delta ${delta30d.sign === 'neg' ? 'neg' : ''}`}>
        {delta30d.sign === 'pos' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {formatDelta(delta30d.valor)} ({formatPercent(delta30d.pct)})
        <span className="hero-delta-meta">últimos 30 días</span>
      </div>
    </div>
    <div className="hero-meta-right">
      <div className="hero-meta-lab">ACTIVOS TOTALES</div>
      <div className="hero-meta-val">{formatMoney(activosTotales)}</div>
      <div className="hero-meta-lab" style={{marginTop: 10}}>DEUDA VIVA</div>
      <div className="hero-meta-val" style={{color: 'var(--neg)'}}>{formatMoney(deudaViva)}</div>
    </div>
  </div>
</div>
```

- Card `border-top: 3px solid var(--gold)`
- Valor color `var(--ink)` siempre (delta cambia color)
- Si no hay histórico 30d · `<div className="hero-delta muted">sin histórico suficiente</div>`

### 3.3 · Composición barra · γ · 3 segmentos solo activos (§ Z.8)

```tsx
<div className="comp-barra">
  <div className="comp-head">
    <div className="comp-title">COMPOSICIÓN DEL PATRIMONIO</div>
    <div className="comp-title" style={{textTransform: 'none', letterSpacing: 0}}>
      click en un segmento para ver detalle del módulo
    </div>
  </div>
  <div className="comp-track">
    <div className="comp-seg inmuebles" style={{width: `${pctInm}%`}} onClick={...} />
    <div className="comp-seg inversiones" style={{width: `${pctInv}%`}} onClick={...} />
    <div className="comp-seg tesoreria" style={{width: `${pctTes}%`}} onClick={...} />
    {/* γ · NO segmento financiacion */}
  </div>
  <div className="comp-leg">
    <LegendItem className="inmuebles" name="Inmuebles" val={valInm} pct={pctInm} />
    <LegendItem className="inversiones" name="Inversiones" val={valInv} pct={pctInv} />
    <LegendItem className="tesoreria" name="Tesorería" val={valTes} pct={pctTes} />
    {/* γ · NO leyenda Otros · NO leyenda Financiacion */}
  </div>
</div>
```

#### Cálculos
```typescript
const activosBrutos = valInm + valInv + valTes;
const pctInm = (valInm / activosBrutos) * 100;
const pctInv = (valInv / activosBrutos) * 100;
const pctTes = (valTes / activosBrutos) * 100;
// suma === 100 siempre
const activosTotales = activosBrutos;
const deudaViva = sumPrestamosVivos();   // negativo
const patrimonioNeto = activosTotales + deudaViva;
```

#### Componente reutilizable
`<CompositionBar>` en biblioteca v5 · `src/design-system/v5/CompositionBar.tsx`:

```typescript
interface CompositionBarProps {
  segments: Array<{
    key: string;
    label: string;
    value: number;
    color: 'brand' | 'gold' | 'pos' | 'neg' | 'ink-3';
    onClick?: () => void;
  }>;
  total?: number;
  showLegend?: boolean;
}
```

### 3.4 · Verificación 22.2
- [ ] tsc + build pasa
- [ ] Saludo personalizado con nombre real · saludo según hora día
- [ ] Línea contexto · fecha + campaña + atenciones
- [ ] Hero · valor color ink · delta color por signo · placeholder muted si no histórico · activos+deuda derecha
- [ ] Composición · 3 segmentos NO Financiación NO Otros · porcentajes 100% sobre activos brutos
- [ ] Click segmento navega
- [ ] Cero hex hardcoded

### 3.5 · PR 22.2
Título · `feat(panel): T22.2 · saludo + hero patrimonial + composición (γ · 3 activos)`

**STOP-AND-WAIT**

---

## 4 · SUB-TAREA 22.3 · Pulso 4 activos (§ Z.9 · § AA.4)

```tsx
<div className="activo-card inmuebles" onClick={...}>
  <div className="activo-head">
    <div className="activo-nom">Inmuebles</div>
    <div className="activo-icon"><Building2 size={18} strokeWidth={1.7} /></div>
  </div>
  <div className="activo-val">{formatMoney(valInm)}</div>
  <div className={`activo-delta ${delta.sign === 'neg' ? 'neg' : ''}`}>
    {delta.sign === 'pos' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
    {formatPercent(delta.pct)} últimos 30 días
  </div>
  <div className="activo-extra">
    <span className="activo-extra-lab">Rdto neto mes</span>
    <span className="activo-extra-val">{formatMoney(rdtoNetoMes)}</span>
  </div>
  <div className="activo-cta">Ver detalle <ArrowRight size={10} strokeWidth={2.5} /></div>
</div>
```

### Métricas extra
| Card | Métrica | Fuente |
|---|---|---|
| Inmuebles | Rdto neto mes | servicio inmuebles · si no · "—" + TODO |
| Inversiones | Rentab. YTD | servicio inversiones · si no · "—" + TODO |
| Tesorería | Meses colchón X de 12 | tesoreria/gastoMedio · si no · "—" + TODO |
| Financiación | Cuota mes | sum cuotas vivas · si no · "—" + TODO |

Componente `<PulseAssetCard>` en `src/modules/panel/components/`.

Responsive · 4/2/1 cols.

### Verificación · PR 22.3
**STOP-AND-WAIT**

---

## 5 · SUB-TAREA 22.4 · Pulso del mes (§ Z.10)

```tsx
<div className="pulso">
  <div className="pulso-title">PULSO DEL MES <span className="mes">{mes} {año}</span></div>
  <div className="pulso-item"><div className="pulso-lab">Ingresos cobrados</div>
    <div className="pulso-val pos">{formatMoney(ing)}</div></div>
  <div className="pulso-item"><div className="pulso-lab">Gastos totales</div>
    <div className="pulso-val neg">{formatMoney(gas)}</div></div>
  <div className="pulso-item"><div className="pulso-lab">Cashflow neto</div>
    <div className={`pulso-val ${cf >= 0 ? 'pos' : 'neg'}`}>{formatMoney(cf)}</div></div>
  <div className="pulso-item"><div className="pulso-lab">Saldo fin mes previsto</div>
    <div className="pulso-val">{formatMoney(saldoFin)}</div></div>
</div>
```

Datos · ingresos = sum treasuryEvents > 0 mes · gastos = sum |treasuryEvents < 0| mes · cashflow = ingresos - gastos · saldo fin · proyección si disponible · si no saldoActual + tooltip.

**STOP-AND-WAIT**

---

## 6 · SUB-TAREA 22.5 · Piden tu atención (§ Z.11 · § AA.6)

```tsx
<div className="card">
  <div className="card-hd">
    <div>
      <div className="card-title">Piden tu atención</div>
      <div className="card-sub">{N} cosas piden tu atención · ordenadas por urgencia</div>
    </div>
    <button className="card-action">Ver todas →</button>
  </div>
  {alertas.map(a => (
    <div className="alerta" onClick={() => navigate(a.href)}>
      <div className={`alerta-icon ${a.severity}`}>{iconBySeverity(a)}</div>
      <div className="alerta-body">
        <div className="alerta-title">{a.title}</div>
        <div className="alerta-meta">{a.meta}</div>
      </div>
      <div className={`alerta-right ${a.valueSeverity}`}>
        {formatMoney(a.value)}
        <div className="alerta-right-sub">{a.timeWindow}</div>
      </div>
    </div>
  ))}
</div>
```

### Lógica
MAX 5 alertas · prioridad:
1. Deudas ejecutiva/apremio · `severity='neg'`
2. Borradores fiscales listos · `severity='pos'`
3. Obligaciones fiscales próximas (30d) · `severity='warn'`
4. Contratos vencer (60d) · `severity='warn'`
5. Pagos vencidos sin conciliar · `severity='neg'`

Si 0 alertas · empty state "Sin atenciones · todo al día" + `CheckCircle` color `--pos`.

Componente `<AttentionList>` en módulo Panel.

**STOP-AND-WAIT**

---

## 7 · SUB-TAREA 22.6 · Mi Plan brújula (§ Z.11)

```tsx
<div className="card">
  <div className="card-hd">
    <div>
      <div className="card-title">Mi Plan · brújula</div>
      <div className="card-sub">progreso hacia libertad financiera</div>
    </div>
    <button className="card-action" onClick={() => navigate('/mi-plan')}>Ver plan completo →</button>
  </div>
  <div className="plan-meta-grande">
    <div className="plan-meta-lab">RENTA PASIVA CUBRE</div>
    <div className="plan-meta-val">{pctCobertura}%</div>
    <div className="plan-meta-sub">de tus gastos · llegada estimada <strong>{año}</strong></div>
  </div>
  <div className="plan-progreso">
    <div className="plan-progreso-head">
      <span className="plan-progreso-lab">PROGRESO A META</span>
      <span className="plan-progreso-pct">{pctCobertura}/100</span>
    </div>
    <div className="plan-track"><div className="plan-fill" style={{width: `${pctCobertura}%`}} /></div>
  </div>
  <div className="plan-items">
    <div className="plan-item"><span className="plan-item-lab">Meses colchón</span>
      <span className="plan-item-val">{mc} de 24</span></div>
    <div className="plan-item"><span className="plan-item-lab">Renta pasiva mensual</span>
      <span className="plan-item-val">{formatMoney(rp)}</span></div>
    <div className="plan-item"><span className="plan-item-lab">Gasto vida mensual</span>
      <span className="plan-item-val">{formatMoney(gv)}</span></div>
    <div className="plan-item"><span className="plan-item-lab">Inmuebles activos</span>
      <span className="plan-item-val">{ni} de {meta}</span></div>
  </div>
</div>
```

Datos · pctCobertura = (rp/gv)*100 · año estimado · simulador Mi Plan · si no · "—" + TODO.

Componente `<MiPlanCompass>` en módulo Panel.

**STOP-AND-WAIT**

---

## 8 · SUB-TAREA 22.7 · Timeline 12 meses (§ Z.12 · § AA.7)

```tsx
<div className="mini-timeline">
  <div className="mini-tl-head">
    <div>
      <div className="mini-tl-title">Próximos 12 meses · hitos relevantes</div>
      <div className="mini-tl-sub">fiscal · contratos · deudas · devoluciones</div>
    </div>
  </div>
  <div className="mini-tl-stack">
    <div className="mini-tl-months-row">
      {meses.map(m => <div className="mini-tl-month">{m.label}</div>)}
    </div>
    <div className="mini-tl-events-row">
      <div className="mini-tl-today" style={{left: `${posicionHoy}%`}}>
        <span className="mini-tl-today-lab">HOY</span>
      </div>
      {hitos.map(h => (
        <div className={`mini-tl-evento ${h.categoria} ${h.stack ? 'stack-b' : ''}`}
             style={{left: `${h.pos}%`}} onClick={() => navigate(h.href)}>
          {iconByCategoria(h.categoria)}
          {h.label}
        </div>
      ))}
    </div>
  </div>
  <div className="mini-tl-leg">
    <div className="mini-tl-leg-item"><div className="mini-tl-leg-mini fiscal" />Obligación fiscal</div>
    <div className="mini-tl-leg-item"><div className="mini-tl-leg-mini contrato" />Contrato</div>
    <div className="mini-tl-leg-item"><div className="mini-tl-leg-mini deuda" />Deuda crítica</div>
    <div className="mini-tl-leg-item"><div className="mini-tl-leg-mini devolucion" />Devolución</div>
  </div>
</div>
```

Datos · obligaciones fiscales próximas + contratos vencer 365d + plazos deuda + IRPF/IVA pendientes cobrar.

Posicionamiento · 12 meses · día actual / días totales · si dos hitos < 5% distancia · `stack-b`.

Componente `<YearTimeline>` en módulo Panel.

**STOP-AND-WAIT**

---

## 9 · SUB-TAREA 22.8 · Cierre · e2e + docs

### Verificación e2e (`docs/T22-end-to-end-verification.md`)
1. `/panel` · 8 secciones renderizando datos reales
2. Click segmento composición · navega
3. Click card pulso · navega
4. Click alerta · navega
5. Click hito timeline · navega
6. Resize · 4/2/1 cols
7. grep cero hex hardcoded
8. Topbar persiste navegación
9. Sidebar nuevo en TODOS módulos

### Checklist v5
Pasar `GUIA-DISENO-V5-atlas.md` sección 17 punto por punto.

### Documentación
- `docs/T22-cierre.md` · resumen · diff visual antes/después · TODOs documentados
- `docs/TAREA-20-pendientes.md` · marcar Dashboard/Sidebar como cerrados

### PR 22.8
Título · `chore(panel): T22.8 · cierre + docs + e2e · TAREA 22 ✅`

---

## 10 · Criterios de aceptación globales T22

- [ ] 8 sub-tareas mergeadas con stop-and-wait
- [ ] DB_VERSION en 65
- [ ] Sidebar v5 nueva agrupación funcional TODOS módulos
- [ ] Topbar global con search ⌘K + bell + help (stubs)
- [ ] Panel 8 secciones implementadas con tokens § Z
- [ ] Iconografía 100% mapeada § AA
- [ ] Composición 3 segmentos solo activos (γ)
- [ ] Datos reales · placeholders coherentes · TODOs
- [ ] Cero hex hardcoded
- [ ] Cero ruptura otros módulos
- [ ] Checklist v5 pasada

---

## 11 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Cambiar layout root rompe módulos | Media | 22.1 cambio mínimo · validar varias rutas antes mergear |
| Datos insuficientes | Alta | Placeholders · TODOs · NO inventar |
| Componentes específicos duplican biblioteca | Media | CC documenta ubicación |
| Topbar choca cabeceras módulos | Media | Probar 5 módulos antes mergear |
| Mi Plan no expone simulador | Alta | Placeholder + TODO |
| Servicios alertas no existen | Alta | Lógica simple sobre stores · TODO servicio dedicado |
| Iconos Lucide no exactos | Media | § AA fuerza match · CC documenta alternativas |

---

## 12 · Lo que esta tarea NO hace

- ❌ NO modifica datos del usuario
- ❌ NO añade features nuevas
- ❌ NO sube DB_VERSION
- ❌ NO toca otros módulos · excepto sidebar+topbar
- ❌ NO implementa funcionalidad real búsqueda · bell · help
- ❌ NO refactoriza servicios
- ❌ NO migra código legacy
- ❌ NO toca biblioteca v5 salvo añadir componentes nuevos genuinos
- ❌ NO añade segmento "Otros" en composición · γ aplicada
- ❌ NO replica bug mockup Personal=Building2 · § AA.9 fuerza User

---

## 13 · Después de T22

1. T9 paralelo · cuando cierre · descongelar T8 · T10
2. Validación IRPF post-T14 (cuando UIs lo permitan)
3. Servicios agregadores nuevos (alertas · timeline · Mi Plan KPIs) · tareas dedicadas
4. Patrón T22 a Tesorería · Inmuebles · Mi Plan si aparecen sombras

---

**Fin de spec T22 v2 · 8 sub-tareas con stop-and-wait estricto · tokens canónicos § Z fuente de verdad · iconografía 100% mapeada § AA · decisión γ aplicada.**
