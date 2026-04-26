# GUÍA DE DISEÑO ATLAS · V5

> Sistema visual cerrado para implementación · sucesor de `GUIA_DISENO_DEFINITIVA_V4.md`
>
> Incorpora todo lo aprendido en Mi Plan v3 · es de aplicación obligatoria.
>
> Si esta guía contradice algo de la V4 · prevalece la V5.

---

## ÍNDICE

1. Filosofía y reglas inviolables
2. Tokens · paleta · tipografía · espaciado
3. Layout base · sidebar · topbar · main
4. Page head
5. Tabs de sub-módulos
6. Cards · base y variantes
7. KPIs strip · CRÍTICO
8. Hero patterns · 4 variantes
9. Bloques especiales · alerta · ruta · empty · timeline
10. Estados visuales por dominio
11. Tipologías y colores por dominio
12. Componentes reusables
13. Iconografía
14. SVG patterns · CRÍTICO coordenadas
15. Animaciones permitidas
16. Plantilla base de archivo nuevo
17. Checklist obligatorio antes de cerrar

---

## 1 · Filosofía y reglas inviolables

ATLAS es **sobrio · profesional · honesto**. No es app de banca alegre · no es gamificación con badges · no es dashboard juguete. Es la herramienta de gestión de patrimonio de alguien que está jugando con su libertad financiera.

### 6 reglas inviolables

1. **Solo paleta Oxford Gold** · navy + oro + grises + 4 acentos semánticos (pos · neg · warn · brand-wash). **Cero rojo/verde/amarillo/púrpura ajenos** salvo el subset semántico permitido.
2. **Cero hex hardcoded** · siempre vía CSS variables (`--brand` · `--gold` · `--ink`).
3. **Tipografía estricta** · IBM Plex Sans (UI) + JetBrains Mono (números) + Inter (alternativa moderna fallback).
4. **HORIZON / PULSE están eliminados** · cualquier referencia a esos conceptos es bug.
5. **Cuando color ya transmite significado · NO repetir en texto** y viceversa. Ej · `por debajo del ritmo` rojo NO debe llamarse "Por debajo del ritmo · ALERTA".
6. **Lucide-react · una iconografía única** · 1 icono fijo por concepto (ver sección 13).

### Lo que NO hacemos nunca

- No emojis en UI (sí en toasts ocasionales sin abuso)
- No iconos al H1 del page head
- No headers navy en pantallas SUPERVISIÓN (solo blanco)
- No headers blancos en pantallas GESTIÓN (solo navy con KPIs)
- No cards con saturated brand-wash en fondo
- No comentarios verbosos al usuario · `·` separador siempre
- No fuegos artificiales · no celebraciones · no exclamaciones

---

## 2 · Tokens

### 2.1 · Paleta Oxford Gold (única autorizada)

```css
:root {
  /* Backgrounds */
  --bg: #F5F4F1;        /* fondo página · beige cálido */
  --card: #FFFFFF;      /* card primaria */
  --card-alt: #FBFAF6;  /* card secundaria · footer · hover sutil */

  /* Líneas */
  --line: #E6E3DC;      /* borde card */
  --line-2: #EFECE5;    /* separador interno */
  --line-3: #F3F1EB;    /* separador muy sutil */

  /* Tinta · 5 niveles */
  --ink: #141B2E;       /* títulos · valor principal */
  --ink-2: #2C3547;     /* texto principal */
  --ink-3: #5B6474;     /* texto secundario */
  --ink-4: #8A92A0;     /* placeholder · subtítulos */
  --ink-5: #B8BEC8;     /* iconos sutiles · borde hover */

  /* Brand · navy Oxford */
  --brand: #1E2954;     /* navy principal */
  --brand-2: #2A3875;   /* navy hover */
  --brand-ink: #0C1230; /* navy oscuro · sidebar */
  --brand-wash: #E8EAF0;/* navy tinted · chips · backgrounds */

  /* Gold · acento oro Oxford */
  --gold: #B88A3E;      /* oro principal */
  --gold-2: #C59A47;    /* oro hover · gradient */
  --gold-soft: #D9B576; /* oro suave · borders sutiles */
  --gold-wash: #F3EAD6; /* oro tinted · chips · backgrounds */
  --gold-ink: #7C5C1F;  /* oro oscuro · texto sobre oro-wash */

  /* Acentos semánticos */
  --pos: #1E6B3A;       /* positivo · ahorro · ingreso */
  --pos-wash: #E4F0E8;  /* positivo tinted */

  --neg: #A43328;       /* negativo · gasto · alerta · fallado */
  --neg-wash: #F5E3E0;  /* negativo tinted */

  --warn: #8A6213;      /* advertencia · ámbar · en-riesgo */
  --warn-wash: #F5ECD6; /* advertencia tinted */
}
```

### 2.2 · Cuándo usar cada acento

| Color | Para qué | Ejemplos |
|---|---|---|
| `--brand` (navy) | Identidad · seguridad · lectura | Compromisos · custodia · saldos |
| `--gold` (oro fuerte) | Pregunta-meta · acento principal | Libertad financiera · CTA principal |
| `--gold-soft` (oro suave) | Variante secundaria · planificación | Reforma · retos · objetivos secundarios |
| `--pos` (verde) | Ingreso · ganancia · completado | Rentas · cumplido · al-día |
| `--neg` (rojo) | Pérdida · alerta · fallado | Gastos negativos · vacío crítico · fallado |
| `--warn` (ámbar) | Riesgo · atención · parcial | En riesgo · parcial · sin asignar |

### 2.3 · Tipografía

```css
/* Imports · siempre desde Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* Reglas de uso */
body { font-family: 'Inter', system-ui, sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
```

**Regla de cuándo usar Mono:**
- TODOS los números financieros (importes · porcentajes · ratios)
- Fechas en formato compacto (`30 jun` · `dic 2027` · `2040`)
- Referencias catastrales · IBANs · NIFs
- Códigos de identificación (`OBJ-01` · `····2715`)

**Pesos:**
- 400 · texto base · subtítulos
- 500 · texto medio · labels
- 600 · negrita ligera · énfasis
- 700 · negrita fuerte · títulos · valores

### 2.4 · Tamaños tipográficos canónicos

```
H1 page-head           26px / 700 / -0.025em
H2 sec-title           16px / 700 / -0.015em
H3 card-tit            16px / 700 / -0.015em
Texto base             13.5px / 400 / -0.005em
Subtítulos             12px-13px / 400 / --ink-3
Labels                 10.5px-11.5px / 600 / --ink-4
Etiquetas chips        9.5px-11px / 700 / +0.08em uppercase

VALORES grandes (KPIs estrella)    32px / 700 / -0.03em / Mono
VALORES medianos (cards)           22px / 700 / -0.025em / Mono
VALORES inline (filas tabla)       13px / 600 / Mono
```

### 2.5 · Espaciado (escala 4px)

```
Gap entre cards de un grid:  14-16px
Padding interno card:        16-22px
Padding banda KPIs:          14px 18px
Padding page head bottom:    14px (con border-bottom 1px)
Margen entre secciones:      16-22px
```

### 2.6 · Border radius

```
.card                     11px (cards principales)
.card pequeñas/inputs      9px
.btn                       7px
.chip                     11px-14px (pill rounded)
.icon-btn                  8px
```

### 2.7 · Sombras (sutiles · sin abuso)

```css
.card-hover     box-shadow: 0 1px 3px rgba(0,0,0,0.04);
.card-active    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
.timeline-sello box-shadow: 0 1px 3px rgba(30,107,58,0.25);  /* color por estado */
.banner-prom    box-shadow: 0 2px 6px rgba(184,138,62,0.3);
```

---

## 3 · Layout base

### 3.1 · Estructura general

```html
<body>
  <div class="app">  <!-- grid 240px + 1fr -->
    <aside class="side"><!-- sidebar fija --></aside>
    <main class="main"><!-- contenido --></main>
  </div>
  <div class="toast" id="toast"></div>
</body>
```

```css
.app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.main { padding: 22px 32px 60px; max-width: 1520px; }
```

### 3.2 · Sidebar canónico · 11 items en este orden EXACTO

```
[Atlas brand]
─────────────
Panel
─── MIS ACTIVOS ──
Inmuebles
Inversiones
Tesorería
Financiación
Personal
─── OPERATIVA ──
Contratos
Mi Plan
Fiscal
Archivo
─── (separador) ──
Ajustes
─────────────
[avatar José Antonio]
```

**Activo** · solo UNO marcado con `class="active"` · borde izquierdo oro `inset 2px 0 0 var(--gold)` + icono en oro · color blanco · fondo `rgba(255,255,255,.07)`.

```css
.side { background: var(--brand-ink); padding: 22px 0; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; overflow-y: auto; }
.nav a { display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 7px; color: #B9BFCC; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.nav a:hover { background: rgba(255,255,255,.04); color: #FFFFFF; }
.nav a.active { background: rgba(255,255,255,.07); color: #FFFFFF; box-shadow: inset 2px 0 0 var(--gold); padding-left: 10px; }
.nav a.active svg { color: var(--gold); }
```

### 3.3 · Topbar

Search box flexible + 2 icon-buttons (notificaciones · ayuda).

```html
<div class="topbar">
  <div class="search">
    <svg>[search icon]</svg>
    <input placeholder="Buscar inmueble, contrato, movimiento..." />
    <span class="kbd">⌘K</span>
  </div>
  <div class="tb-actions">
    <button class="icon-btn">[bell]</button>
    <button class="icon-btn">[help]</button>
  </div>
</div>
```

---

## 4 · Page head

### 4.1 · Variante con breadcrumb (sub-páginas)

```html
<div class="page-head">
  <div>
    <div class="breadcrumb">
      <span class="back-btn">[chevron] Volver</span>
      <a>Mi Plan</a>
      <svg>[chevron]</svg>
      <span style="color:var(--ink-3); font-weight:600;">Objetivos</span>
    </div>
    <h1>Objetivos</h1>
    <div class="page-sub">subtítulo descriptivo · conciso</div>
  </div>
  <div class="tb-actions">
    <button class="btn btn-ghost">[icono] Acción secundaria</button>
    <button class="btn btn-gold">[icono] Acción principal</button>
  </div>
</div>
```

### 4.2 · Variante sin breadcrumb (landing / pantallas raíz)

```html
<div class="page-head">
  <div>
    <h1>Mi Plan</h1>
    <div class="page-sub">subtítulo · datos al cierre de <strong>abril 2026</strong> · revisado <strong>hoy</strong></div>
  </div>
  <div class="tb-actions">[botones]</div>
</div>
```

### 4.3 · CSS

```css
.page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--line-2); }
.page-head h1 { font-size: 26px; font-weight: 700; color: var(--ink); letter-spacing: -0.025em; line-height: 1.1; }
.page-sub { font-size: 13px; color: var(--ink-3); margin-top: 4px; }
.page-sub strong { color: var(--ink-2); font-weight: 600; }
```

### 4.4 · Botones del page head

```css
.btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.12s; border: 1px solid transparent; }
.btn-ghost { color: var(--ink-2); background: var(--card); border-color: var(--line); }
.btn-ghost:hover { border-color: var(--ink-5); }
.btn-gold { color: #fff; background: var(--gold); border-color: var(--gold); }
.btn-gold:hover { background: var(--gold-ink); border-color: var(--gold-ink); }
```

**Patrón:**
- Acción principal · `btn-gold` · siempre a la derecha
- Acción secundaria · `btn-ghost` · a la izquierda de la principal
- Máximo 2 botones · si hay más · uno se mueve a un menú o a la card específica

---

## 5 · Tabs de sub-módulos

Cuando un módulo tiene varias vistas (Mi Plan tiene 5 + landing) · barra horizontal de tabs underline.

```html
<div class="submod-tabs">
  <button onclick="...">[icono] Proyección</button>
  <button class="active">[icono] Libertad financiera</button>
  <button>[icono] Objetivos</button>
  <button>[icono] Fondos de ahorro</button>
  <button>[icono] Retos</button>
</div>
```

```css
.submod-tabs { display: flex; gap: 0; margin-bottom: 18px; border-bottom: 1px solid var(--line-2); }
.submod-tabs button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; font-size: 13.5px; font-weight: 600; color: var(--ink-4); border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; }
.submod-tabs button:hover { color: var(--ink-2); }
.submod-tabs button.active { color: var(--ink); border-bottom-color: var(--gold); }
```

**Reglas:**
- Sólo UNA tab activa
- Border bottom oro fuerte para activa · transparent para inactivas
- Ícono pequeño 14px junto al label
- Colores · activa = `--ink` · inactiva = `--ink-4` · hover = `--ink-2`

---

## 6 · Cards · base y variantes

### 6.1 · Card base

```html
<div class="card">
  <!-- contenido -->
</div>
```

```css
.card { background: var(--card); border: 1px solid var(--line); border-radius: 11px; padding: 16px 20px; }
```

### 6.2 · Card con borde superior por tipo (CRÍTICO)

Pattern reutilizado en Objetivos · Fondos · Retos · Libertad. El borde superior **comunica la naturaleza** de la card antes de leer.

```css
.card-tipo { border-top-width: 3px; }
.card-tipo.brand    { border-top-color: var(--brand); }
.card-tipo.gold     { border-top-color: var(--gold); }
.card-tipo.gold-soft{ border-top-color: var(--gold-soft); }
.card-tipo.pos      { border-top-color: var(--pos); }
.card-tipo.neg      { border-top-color: var(--neg); }
.card-tipo.warn     { border-top-color: var(--warn); }
```

### 6.3 · Card con header + body + foot

Pattern para cards con info densa (objetivo · fondo · reto):

```html
<div class="card card-tipo gold">
  <div class="card-hd">
    <!-- icono + título + tipo + estado -->
  </div>
  <div class="card-numbers">
    <!-- valor actual → meta -->
  </div>
  <div class="card-body">
    <!-- progreso · contenido principal -->
  </div>
  <div class="card-foot">
    <!-- vínculos · acciones -->
  </div>
</div>
```

**CSS importante:**
```css
.card { display: flex; flex-direction: column; }   /* permite que foot sea margin-top: auto */
.card-foot { margin-top: auto; padding-top: 12px; }
```

### 6.4 · Card con icono + título + tipo + estado en cabecera

```html
<div class="card-hd">
  <div class="card-hd-left">
    <div class="card-icon brand">[svg]</div>
    <div class="card-hd-info">
      <div class="card-tipo-label">Tipo</div>
      <div class="card-nom">Nombre principal</div>
      <div class="card-cat">Descripción contextual</div>
    </div>
  </div>
  <span class="card-estado en-progreso">Estado</span>
</div>
```

**Iconos por tipo · pattern reutilizado:**
```css
.card-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-icon.brand    { background: var(--brand-wash); color: var(--brand); }
.card-icon.gold     { background: var(--gold-wash); color: var(--gold-ink); }
.card-icon.gold-soft{ background: #F3EBDB; color: #8A6926; }
.card-icon.gris     { background: var(--card-alt); color: var(--ink-3); border: 1px solid var(--line); }
```

### 6.5 · Card landing (resumen módulo · clickable a tab)

Variante de card más compacta · formato común para grids de "atajos" (Landing Mi Plan · Panel general).

```html
<div class="lan-card libertad">
  <div class="lan-card-hd">
    <div class="lan-card-icon">[svg]</div>
    <div class="lan-card-arrow">[chevron]</div>
  </div>
  <div class="lan-card-tit">Libertad financiera</div>
  <div class="lan-card-val">49%</div>
  <div class="lan-card-sub">subtítulo descriptivo</div>
  <div class="lan-card-foot">
    <span class="lan-card-foot-lab">Próxima fecha</span>
    <span class="lan-card-foot-pill gold">2040 · en 14 años</span>
  </div>
</div>
```

```css
.lan-card { background: var(--card); border: 1px solid var(--line); border-radius: 11px; padding: 16px 18px 14px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; border-top-width: 3px; display: flex; flex-direction: column; min-height: 220px; }
.lan-card:hover { border-color: var(--ink-5); box-shadow: 0 1px 4px rgba(0,0,0,0.05); transform: translateY(-1px); }
.lan-card-arrow { width: 26px; height: 26px; border-radius: 50%; background: var(--card-alt); border: 1px solid var(--line-2); display: flex; align-items: center; justify-content: center; color: var(--ink-4); transition: all 0.15s; }
.lan-card:hover .lan-card-arrow { background: var(--brand); border-color: var(--brand); color: #fff; }
```

---

## 7 · KPIs strip · CRÍTICO

Banda horizontal de 3-4 KPIs · separadores verticales · sin gap entre celdas.

### 7.1 · HTML pattern

```html
<div class="kpi-strip">
  <div class="kpi">
    <div class="kpi-lab">Label corto</div>
    <div class="kpi-val brand">VALOR</div>
    <div class="kpi-sub">subtítulo descriptivo</div>
  </div>
  <!-- 3 más -->
</div>
```

### 7.2 · CSS · LECCIÓN APRENDIDA · obligatorio

```css
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.kpi { padding: 14px 18px; border-right: 1px solid var(--line-2); display: flex; flex-direction: column; min-height: 92px; }
.kpi:last-child { border-right: none; }
.kpi-lab { font-size: 11.5px; color: var(--ink-3); font-weight: 600; letter-spacing: .03em; }
.kpi-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: var(--ink); margin-top: 5px; letter-spacing: -0.025em; line-height: 1.15; }
.kpi-val.warn { color: var(--warn); }
.kpi-val.brand { color: var(--brand); }
.kpi-val.gold { color: var(--gold-ink); }
.kpi-val.pos { color: var(--pos); }
.kpi-sub { font-size: 11px; color: var(--ink-4); margin-top: auto; padding-top: 6px; line-height: 1.35; }
```

### 7.3 · CRÍTICO · 4 reglas

1. **`display: flex; flex-direction: column;`** en `.kpi` · NO grid interno
2. **`min-height: 92px;`** en `.kpi` · garantiza altura uniforme desde el primer pintado · sin depender de que el grid resuelva alturas
3. **`line-height: 1.15;`** en `.kpi-val` · evita que números con descender ("30 jun" tiene "j") midan más alto que números sin descender ("4")
4. **`margin-top: auto;`** en `.kpi-sub` · empuja el subtítulo al fondo del contenedor flex · si un sub rompe a 2 líneas las otras celdas crecen y los 4 siguen alineados

**Sin estas 4 reglas · los subtítulos quedan desalineados** cuando los textos tienen distinta longitud. Documentado en sesión Mi Plan v3 · Jose lo detectó dos veces · `image · 1777140460001` y `image · 1777140922386`.

### 7.4 · KPIs estrella · variante para hero

Versión más grande (32px valor · 130px alto · borde superior por tipo).

```css
.kpi-estrella { background: var(--card); border: 1px solid var(--line); border-radius: 11px; padding: 18px 20px; border-top: 3px solid; display: flex; flex-direction: column; min-height: 130px; }
.kpi-estrella .kpi-val { font-size: 32px; }
```

---

## 8 · Hero patterns · 4 variantes canónicas

### 8.1 · Hero compacto (Landing)

1 línea narrativa fuerte + 4 mini stats horizontales + CTA. Borde superior oro.

```html
<div class="hero-compact">
  <div class="hero-c-grid">  <!-- 1.3fr 1fr -->
    <div>
      <div class="hero-c-tag">Etiqueta · estimada</div>
      <div class="hero-c-titulo">Frase narrativa potente con <strong>énfasis</strong></div>
      <div class="hero-c-sub">contexto + cifras clave</div>
      <button class="hero-c-cta">CTA →</button>
    </div>
    <div class="hero-c-stats">  <!-- 2 col x 2 row -->
      [4 stats]
    </div>
  </div>
</div>
```

### 8.2 · Hero con toggle escenario (Libertad)

Toggle prominente arriba que cambia números en vivo + 4 KPIs estrella debajo + gráfico SVG.

```html
<div class="esc-bar">
  <span class="esc-lab">Escenario</span>
  <div class="esc-toggle">
    <button data-esc="alquiler">[icono] Alquiler en Madrid</button>
    <button class="active" data-esc="propia">[icono] Casa propia (objetivo)</button>
  </div>
  <div class="esc-info"><strong>...</strong>...</div>
</div>
```

```css
.esc-toggle { display: flex; gap: 4px; padding: 4px; background: var(--card-alt); border: 1px solid var(--line-2); border-radius: 8px; }
.esc-toggle button { padding: 7px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); border-radius: 6px; cursor: pointer; }
.esc-toggle button.active { background: var(--brand); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.esc-toggle button.active svg { color: var(--gold); }
```

### 8.3 · Hero con barra de progreso grande (Retos · reto activo)

Card grande · borde top oro · 3 niveles · cabecera con tags · cuerpo con título y desc · banda con progreso + stats · footer con vínculos + acciones.

```html
<div class="reto-hero">
  <div class="reto-hero-hd">[tags]</div>
  <div class="reto-hero-body"><h2>Título</h2><p>Desc</p></div>
  <div class="reto-hero-grid">  <!-- 1.4fr 1fr -->
    <div class="reto-prog-block">[progreso grande]</div>
    <div class="reto-hero-stats">[3 stats]</div>
  </div>
  <div class="reto-hero-foot">[vínculos] [acciones]</div>
</div>
```

### 8.4 · Hero con gráfico SVG (Proyección · Libertad)

Header card · leyenda · SVG ancho completo · ancho mínimo 920-940px con scroll.

```html
<div class="grafico-hero">
  <div class="grafico-hd">[título + subtítulo]</div>
  <div class="grafico-leyenda">[items]</div>
  <div class="grafico-svg-wrap">
    <svg viewBox="0 0 1200 480">[contenido]</svg>
  </div>
</div>
```

```css
.grafico-svg-wrap { padding: 16px 22px 8px; overflow-x: auto; }
.grafico-svg-wrap svg { width: 100%; min-width: 940px; display: block; }
```

---

## 9 · Bloques especiales

### 9.1 · Banda alerta del momento

Aparece en landing o cabecera de tab cuando hay algo que requiere atención.

```html
<div class="alerta">
  <div class="alerta-icon">[svg]</div>
  <div class="alerta-body">
    <span class="alerta-tag">Atención</span>
    <span class="alerta-text"><strong>17.600 €</strong>... texto descriptivo</span>
  </div>
  <button class="alerta-cta">CTA →</button>
</div>
```

```css
.alerta { background: var(--gold-wash); border: 1px solid #E8D49B; border-radius: 9px; padding: 13px 18px; display: flex; align-items: center; gap: 14px; }
.alerta-icon { width: 32px; height: 32px; border-radius: 50%; background: var(--card); border: 1px solid var(--gold); display: flex; align-items: center; justify-content: center; color: var(--gold-ink); flex-shrink: 0; }
.alerta-tag { font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-ink); padding: 2px 8px; border-radius: 4px; background: rgba(184,138,62,0.18); display: inline-block; margin-right: 10px; }
.alerta-cta { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; background: var(--gold); color: #fff; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
```

### 9.2 · Bloque "ruta" sí/no/pausa (Objetivos)

Bloque destacado dentro de card que dice si vas en ruta · 3 estados visuales:

```html
<div class="obj-ruta no-ruta">
  <svg>[icono]</svg>
  <div>
    <span class="obj-ruta-title">No vas en ruta</span>
    te faltan <strong>319 €/mes</strong> para llegar a tiempo · sube capacidad de ahorro
  </div>
</div>
```

```css
.obj-ruta { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 8px; font-size: 12px; line-height: 1.45; }
.obj-ruta.si-ruta  { background: var(--pos-wash);  color: var(--pos);  border: 1px solid #C0DBC8; }
.obj-ruta.no-ruta  { background: var(--warn-wash); color: var(--warn); border: 1px solid #E8D49B; }
.obj-ruta.en-pausa { background: var(--card-alt);  color: var(--ink-3); border: 1px solid var(--line-2); }
.obj-ruta svg { flex-shrink: 0; margin-top: 1px; }

/* CRÍTICO · LECCIÓN APRENDIDA · solo el título es block */
.obj-ruta-title { font-weight: 700; display: block; margin-bottom: 2px; }
.obj-ruta strong { font-weight: 700; }   /* inline · NO block */
```

**Por qué importa** · si pones `display: block` en `.obj-ruta strong`, el bold de la cifra dentro del párrafo cae en una línea propia y rompe el flujo del texto. Solo el TÍTULO debe ser block · documentado en sesión Mi Plan v3 · `image · 1777140693722`.

### 9.3 · Empty state (fondo sin cuentas · etc)

Bloque dashed centrado dentro de card cuando algo está vacío.

```html
<div class="empty-state">
  Aún no hay cuenta asignada a este fondo
  <br>
  <a class="empty-cta">+ asigna una cuenta para alimentar este fondo</a>
</div>
```

```css
.empty-state { padding: 18px 20px; text-align: center; color: var(--ink-4); font-size: 12px; line-height: 1.5; border: 1px dashed var(--line); border-radius: 7px; margin: 8px 20px; }
.empty-cta { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--gold-ink); cursor: pointer; }
.empty-cta:hover { text-decoration: underline; }
```

### 9.4 · Timeline horizontal de sellos (Retos histórico)

12 sellos circulares horizontales con línea base · estados por color.

```html
<div class="timeline">
  <div class="timeline-item">
    <span class="timeline-mes">may 25</span>
    <div class="timeline-sello completado">[svg]</div>
    <span class="timeline-titulo">Cancelar 4 suscripciones</span>
  </div>
  <!-- 12 items -->
</div>
```

```css
.timeline { display: flex; align-items: flex-start; gap: 0; position: relative; padding: 8px 4px 4px; }
.timeline::before { content: ''; position: absolute; left: 30px; right: 30px; top: 32px; height: 2px; background: linear-gradient(90deg, var(--line), var(--line-2)); border-radius: 1px; z-index: 0; }
.timeline-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; z-index: 1; cursor: pointer; transition: transform 0.12s; padding: 4px; }
.timeline-item:hover { transform: translateY(-2px); }
.timeline-sello { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: box-shadow 0.12s; }
.timeline-sello.completado { background: var(--pos);  color: #fff; box-shadow: 0 1px 3px rgba(30,107,58,0.25); }
.timeline-sello.parcial    { background: var(--warn); color: #fff; box-shadow: 0 1px 3px rgba(138,98,19,0.25); }
.timeline-sello.fallado    { background: var(--neg);  color: #fff; box-shadow: 0 1px 3px rgba(164,51,40,0.25); }
.timeline-sello.activo     { background: var(--brand); color: var(--gold); border: 2.5px solid var(--gold); animation: pulso 2.4s ease-in-out infinite; }
.timeline-sello.futuro     { background: transparent; border: 1.5px dashed var(--ink-5); color: var(--ink-4); }

@keyframes pulso { 0%, 100% { box-shadow: 0 2px 6px rgba(184,138,62,0.3); } 50% { box-shadow: 0 2px 14px rgba(184,138,62,0.55); } }
```

---

## 10 · Estados visuales por dominio

Cada dominio tiene su set de estados estandarizado. **No inventar nuevos estados sin pasar por esta tabla.**

### 10.1 · Objetivos

| Estado | Color de fondo | Color de texto | Cuándo |
|---|---|---|---|
| `en-progreso` | `--brand-wash` | `--brand` | Default activo |
| `en-riesgo` | `--warn-wash` | `--warn` | Ritmo bajo · gap detectado |
| `en-pausa` | `--card-alt` | `--ink-3` | Decisión pendiente |
| `completado` | `--pos-wash` | `--pos` | Meta alcanzada |

### 10.2 · Fondos

| Estado | Color | Cuándo |
|---|---|---|
| `al-dia` | pos | Va por encima del ritmo |
| `por-debajo` | warn | Ritmo bajo el necesario |
| `sin-meta` | gris | Fondo sin objetivo asociado |
| `vacio` | neg | 0% de progreso · alerta |

### 10.3 · Retos

| Estado | Color | Cuándo |
|---|---|---|
| `completado` | pos · tic blanco | Cumplido al 100% |
| `parcial` | warn · dash blanco | Cumplido al 50-99% |
| `fallado` | neg · cruz blanca | Cumplido al <50% o no cumplido |
| `activo` | brand+gold · pulsante | Reto en curso |
| `futuro` | dashed · gris | Programado |

### 10.4 · Contratos / Disponibilidad (de la guía V4 · sigue vigente)

| Estado | Color | Cuándo |
|---|---|---|
| disponible AHORA | rojo (--neg) | Habitación libre · pérdida activa |
| vence <30d | ámbar (--warn) | Avisar · negociar |
| vence 30-90d | gris | Neutro · pre-aviso |

---

## 11 · Tipologías y colores por dominio

Cuándo aplicar borde superior / lateral por tipo de entidad.

### 11.1 · Objetivos · 4 tipos

```css
.obj-card.acumular  { border-top-color: var(--gold-soft); }
.obj-card.amortizar { border-top-color: var(--brand); }
.obj-card.comprar   { border-top-color: var(--gold); }
.obj-card.reducir   { border-top-color: var(--ink-3); }
```

### 11.2 · Fondos · 5 tipos

```css
.fondo-card.colchon   { border-top-color: var(--brand); }
.fondo-card.compra    { border-top-color: var(--gold); }
.fondo-card.reforma   { border-top-color: var(--gold-soft); }
.fondo-card.impuestos { border-top-color: #6E7C8E; }
.fondo-card.capricho  { border-top-color: var(--gold-soft); }
.fondo-card.custom    { border-top-color: var(--ink-3); }
```

### 11.3 · Retos · 4 tipos (sugerencias)

```css
.sug-card.ahorro     { border-left-color: var(--pos); }
.sug-card.ejecucion  { border-left-color: var(--gold); }
.sug-card.disciplina { border-left-color: var(--brand); }
.sug-card.revision   { border-left-color: var(--ink-3); }
```

### 11.4 · Landing · cards de tab

```css
.lan-card.proyeccion { border-top-color: var(--brand); }
.lan-card.libertad   { border-top-color: var(--gold); }       /* corona del módulo */
.lan-card.objetivos  { border-top-color: var(--gold-soft); }
.lan-card.fondos     { border-top-color: var(--brand); }
.lan-card.retos      { border-top-color: var(--gold-soft); }
```

**Regla de jerarquía** · solo UNA card por landing puede llevar oro fuerte (`--gold`) · debe ser la "corona" del módulo (la pregunta-meta · Libertad financiera en Mi Plan).

---

## 12 · Componentes reusables

### 12.1 · Toast

```html
<div class="toast" id="toast"></div>

<script>
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2400);
  }
</script>
```

```css
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--brand-ink); color: #fff; padding: 11px 18px; border-radius: 8px; font-size: 12.5px; opacity: 0; transition: all 0.2s; pointer-events: none; z-index: 100; max-width: 480px; }
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
```

### 12.2 · Botones

3 niveles de jerarquía:
- `.btn-gold` · acción principal · bg oro · texto blanco
- `.btn-ghost` · acción secundaria · bg blanco · borde gris
- `.btn-text` · acción terciaria · solo texto en color brand

```css
.btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.12s; border: 1px solid transparent; }
.btn-ghost { color: var(--ink-2); background: var(--card); border-color: var(--line); }
.btn-ghost:hover { border-color: var(--ink-5); }
.btn-gold { color: #fff; background: var(--gold); border-color: var(--gold); }
.btn-gold:hover { background: var(--gold-ink); border-color: var(--gold-ink); }
```

### 12.3 · Pills / chips

```css
.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 4px 10px; border-radius: 12px; flex-shrink: 0; white-space: nowrap; }
.chip.brand   { background: var(--brand-wash); color: var(--brand); }
.chip.gold    { background: var(--gold-wash); color: var(--gold-ink); }
.chip.pos     { background: var(--pos-wash); color: var(--pos); }
.chip.warn    { background: var(--warn-wash); color: var(--warn); }
.chip.neg     { background: var(--neg-wash); color: var(--neg); }
.chip.gris    { background: var(--card-alt); color: var(--ink-3); border: 1px solid var(--line-2); }
```

### 12.4 · Vínculos cross-module (botón al pie de card)

```html
<a class="vinculo-link" onclick="event.stopPropagation(); showToast('Saltar a ...')">
  <svg>[icono módulo destino]</svg>
  Texto destino
</a>
```

```css
.vinculo-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--brand); padding: 4px 10px; border-radius: 6px; background: var(--card); border: 1px solid var(--line); transition: all 0.12s; flex-shrink: 0; }
.vinculo-link:hover { border-color: var(--brand); }
.vinculo-link.muted { color: var(--ink-3); border-style: dashed; }
.vinculo-link.muted:hover { border-color: var(--gold); color: var(--gold-ink); }
```

**Regla CRÍTICA** · siempre `event.stopPropagation()` cuando la card es clickable y dentro hay un vínculo distinto. Lección aprendida en Fondos v3.

### 12.5 · Bancos · dot color (CRÍTICO)

Identificación visual rápida de cuenta bancaria por color oficial:

```css
.bank-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bank-dot.santander { background: #EC0000; }  /* rojo Santander */
.bank-dot.sabadell  { background: #024EA5; }  /* azul Sabadell */
.bank-dot.unicaja   { background: #009639; }  /* verde Unicaja */
.bank-dot.bbva      { background: #004481; }  /* azul BBVA */
.bank-dot.ing       { background: #FF6200; }  /* naranja ING */
.bank-dot.caixabank { background: #0F4C81; }
```

**Importante** · los colores rojo/verde aquí son aceptados porque son **identidad de marca · no semántica de estado**. No confundir con estados.

### 12.6 · Tag de tipo (Mono · uppercase · pequeño)

```css
.tipo-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.card.tipo .tipo-tag { color: var(--ink-4); }   /* default · hereda color por tipo */
```

---

## 13 · Iconografía · Lucide-react

**Una iconografía única · 1 icono por concepto.** No usar otros sets · no improvisar.

### 13.1 · Diccionario de iconos canónicos

| Concepto | Icono Lucide | SVG manual (paths) |
|---|---|---|
| Panel | `layout-grid` | 4 rectángulos en cuadrícula |
| Inmuebles | `building-2` | edificio + entrada |
| Inversiones | `trending-up` | línea ascendente |
| Tesorería | `wallet` | rectángulo + línea |
| Financiación | `landmark` | columnas griegas |
| Personal | `users` | 2 personas |
| Contratos | `file-text` | documento |
| Mi Plan | `compass` | brújula |
| Fiscal | `monitor` | ordenador |
| Archivo | `folder` | carpeta |
| Ajustes | `settings` | engranaje |
| Proyección | `line-chart` | gráfico ejes |
| Libertad financiera | `move-horizontal` | flechas izq-der |
| Objetivos | `target` | diana 3 anillos |
| Fondos de ahorro | `package` | paquete cúbico |
| Retos | `star` | estrella 5 puntas |
| Colchón | `shield` | escudo |
| Compra (vivienda) | `home` | casa |
| Reforma | `wrench` | llave inglesa |
| Impuestos | `monitor` | ordenador |
| Capricho | `gift` | regalo |
| Acumular | `package` | paquete |
| Amortizar | `landmark` | columnas |
| Comprar | `home` | casa |
| Reducir | `trending-down` | línea descendente |

### 13.2 · Tamaños canónicos

```
sidebar nav:        17px stroke 1.7
card icon:          18px stroke 1.8
card-icon contenedor: 36px (con padding interno)
botón:              13-14px stroke 2
breadcrumb chevron: 10-12px stroke 2
arrow circular:     11px stroke 2.5
```

### 13.3 · Stroke

Siempre `stroke="currentColor"` · `fill="none"` salvo iconos llenos (estrella · estado) · `stroke-width` entre 1.7 (decorativo) y 2.5 (botones/CTAs).

---

## 14 · SVG patterns · CRÍTICO coordenadas

Tres patterns canónicos repetidos en Mi Plan: waterfall · gantt timeline · trayectoria líneas cruzándose.

### 14.1 · Regla de coordenadas · LECCIÓN APRENDIDA

Para gráficos con eje Y de €/mes:

```
Y = max_y - (valor / range_y) × height_disponible
```

**Ejemplo concreto · Libertad financiera · viewBox 0 0 1200 480:**
- Eje Y · 0 a 5.000 €/mes
- Y=420 representa 0 €
- Y=40 representa 5.000 €
- Height disponible · 380 (de 420 a 40)
- Range · 5.000

```javascript
function valToY(val) {
  return 420 - (val / 5000) * 380;
}

valToY(1707) === 290.3   // renta pasiva inicial · ABAJO
valToY(3500) === 154     // gastos vida inicial · ARRIBA
valToY(4030) === 113.7   // punto cruce libertad
```

**ERROR común documentado** · puse 354 para 3.500 €/mes pensando que era abajo · pero es ARRIBA del 1.707. Resultado · la línea de gastos vida quedaba debajo de la de renta pasiva · cruce inexistente · narrativa rota. Documentado en `image · 1777144521935`.

### 14.2 · Waterfall mensual (Proyección)

Pattern de barras verticales con resultado caja del mes · positivos hacia arriba · negativos hacia abajo · clickable.

Estructura SVG · 12 barras + grid horizontal + labels meses + linea cero.

### 14.3 · Gantt timeline 6 filas (Proyección · vista Pulso)

6 filas horizontales con marcadores circulares por mes · radio proporcional al importe · anillo oro punteado en marcadores estacionales.

```html
<g onclick="showToast('...')">
  <!-- marker normal · radio 7 -->
  <circle cx="200" cy="85" r="7" fill="#1E6B3A" stroke="#fff" stroke-width="1.5"/>
  
  <!-- marker estacional · doble · anillo oro -->
  <circle cx="600" cy="85" r="14" fill="none" stroke="#B88A3E" stroke-width="2" stroke-dasharray="2 1.5"/>
  <circle cx="600" cy="85" r="12" fill="#1E6B3A" stroke="#fff" stroke-width="1.5"/>
</g>
```

### 14.4 · Trayectoria líneas cruzándose (Libertad financiera)

2 líneas SVG path · una sube por escalones (renta pasiva) · otra sube suave por inflación (gastos vida) · cruce marcado con anillo oro grande + banner.

```html
<!-- Línea gastos · navy · 1.0% anual -->
<path d="M 80 154 L 320 143 L 560 132 L 800 120 L 920 114 L 1160 102" 
      fill="none" stroke="#1E2954" stroke-width="2.5"/>

<!-- Línea renta pasiva · verde · escalones por hitos -->
<path d="M 80 290 L 260 278 L 440 210 L 620 192 L 800 181 L 920 114 L 1160 89" 
      fill="none" stroke="#1E6B3A" stroke-width="2.8"/>

<!-- Punto cruce -->
<line x1="920" y1="40" x2="920" y2="420" stroke="#B88A3E" stroke-dasharray="4 4" opacity="0.55"/>
<circle cx="920" cy="114" r="14" fill="none" stroke="#B88A3E" stroke-width="2" stroke-dasharray="2 2"/>
<circle cx="920" cy="114" r="9" fill="#B88A3E" stroke="#fff" stroke-width="2.5"/>

<!-- Banner libertad · ancho suficiente -->
<g transform="translate(920, 64)">
  <rect x="-90" y="-26" width="180" height="40" rx="6" fill="#7C5C1F" stroke="#B88A3E"/>
  <text x="0" y="-9" text-anchor="middle" fill="#F3EAD6">PUNTO LIBERTAD</text>
  <text x="0" y="9" text-anchor="middle" fill="#fff">2040 · 4.030 €/mes</text>
</g>
```

**Regla del banner** · width 180px mínimo si lleva año + cifra. Banners más estrechos cortan el texto · documentado.

### 14.5 · Etiquetas finales · DENTRO del viewBox

```html
<!-- MAL · fuera del viewBox · se cortan -->
<text x="1170" y="100">4.250</text>

<!-- BIEN · dentro · text-anchor end -->
<text x="1148" y="100" text-anchor="end">4.250</text>
```

---

## 15 · Animaciones permitidas

Solo 2 animaciones · y solo donde aporta · sin abusar.

### 15.1 · Pulso · sello activo (Retos)

```css
@keyframes pulso { 
  0%, 100% { box-shadow: 0 2px 6px rgba(184,138,62,0.3); } 
  50%      { box-shadow: 0 2px 14px rgba(184,138,62,0.55); } 
}
.timeline-sello.activo { animation: pulso 2.4s ease-in-out infinite; }
```

### 15.2 · Hover transform · cards clickables

```css
.lan-card { transition: transform 0.15s; }
.lan-card:hover { transform: translateY(-1px); }
```

**Prohibidas** · spring animations · particle effects · confetti · zooms agresivos · color shifts dramáticos.

---

## 16 · Plantilla base de archivo nuevo

Cada nuevo mockup HTML arranca desde esta estructura mínima:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Atlas · {Módulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* === TOKENS · pegar :root completo de sección 2.1 === */
  :root { ... }

  /* === BASE === */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--bg); color: var(--ink-2); font-family: 'Inter', system-ui, sans-serif; font-size: 13.5px; line-height: 1.5; -webkit-font-smoothing: antialiased; letter-spacing: -0.005em; }
  a { color: inherit; text-decoration: none; }
  button { font: inherit; background: none; border: none; cursor: pointer; color: inherit; }

  /* === LAYOUT === */
  .app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
  /* sidebar + main ... */

  /* === ESPECÍFICOS DE LA TAB === */
  /* ... */
</style>
</head>
<body>

<div class="app">
  <aside class="side"><!-- 11 items canónicos --></aside>

  <main class="main">
    <!-- topbar -->
    <!-- page head -->
    <!-- tabs sub-módulos (si aplica) -->
    <!-- contenido específico -->
  </main>
</div>

<div class="toast" id="toast"></div>

<script>
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2400);
  }
</script>

</body>
</html>
```

**Regla** · nunca empezar de cero · siempre copiar un mockup cerrado de Mi Plan v3 (ej. `atlas-mi-plan-objetivos-v3.html`) y modificar.

---

## 17 · Checklist obligatorio antes de cerrar un mockup

Aplica antes de entregar a Jose o de pasar a CC. **Si algo de esto falla · NO se entrega.**

### Tokens
- [ ] No hex hardcoded · todo vía variables
- [ ] No colores fuera de la paleta Oxford Gold
- [ ] Tipografía · IBM Plex Sans + JetBrains Mono Mono solo
- [ ] Tabular nums activado en `.mono` · `font-variant-numeric: tabular-nums`

### Layout
- [ ] Sidebar 11 items en orden canónico · 1 activo correcto
- [ ] Topbar con search y 2 icon-buttons
- [ ] Main padding 22px 32px 60px · max-width 1520px

### Page head
- [ ] H1 sin icono
- [ ] Sub con datos contextuales · sin frase decorativa
- [ ] Botones · acción principal `btn-gold` derecha · secundaria `btn-ghost` · máximo 2

### Tabs sub-módulos (si aplica)
- [ ] Solo 1 active · border-bottom oro
- [ ] Iconos 14px junto a label

### KPIs strip
- [ ] `display: flex; flex-direction: column; min-height: 92px;` en `.kpi`
- [ ] `line-height: 1.15;` en `.kpi-val`
- [ ] `margin-top: auto; padding-top: 6px;` en `.kpi-sub`
- [ ] Subtítulos alineados al ras inferior aunque varíe la longitud

### Cards
- [ ] Border superior por tipo · usando colores de paleta
- [ ] Estados visuales del set canónico (sección 10) · sin inventar nuevos
- [ ] Footer con `margin-top: auto` para uniformar altura
- [ ] `event.stopPropagation()` en vínculos internos si la card es clickable

### Bloques especiales
- [ ] Banda alerta solo cuando hay alerta del momento real
- [ ] Bloque ruta · título con clase `obj-ruta-title` (block) · `<strong>` interno inline
- [ ] Empty state dashed cuando algo está vacío

### SVG (si aplica)
- [ ] Coordenadas Y validadas con la fórmula · `Y = max - (val/range × height)`
- [ ] Líneas cruzándose · valor inicial menor está EN Y MAYOR (más abajo)
- [ ] Banners con width suficiente para el texto · 180px mínimo si lleva cifra
- [ ] Etiquetas finales con `text-anchor="end"` y `x` dentro del viewBox

### Animaciones
- [ ] Solo `pulso` (sello activo Retos) y `transform translateY(-1px)` (hover cards)
- [ ] Sin spring · particle · confetti · color shifts

### Iconos
- [ ] Lucide-react vocabulario · 1 icono por concepto (sección 13)
- [ ] No icono al H1
- [ ] Stroke entre 1.7 y 2.5

### Texto
- [ ] Separador `·` (no `–` · no `—` · no `|`)
- [ ] Sin emojis salvo casos justificados
- [ ] Cuando color comunica estado · NO repetir en texto
- [ ] Sub-titles en `--ink-4` · no en color principal

### Toast
- [ ] Toast con id `toast` · función `showToast(msg)` definida
- [ ] Todas las acciones que no llevan a otra pantalla muestran toast con info útil

### Responsive (mínimo)
- [ ] SVG con `min-width` y wrapper `overflow-x: auto`
- [ ] Grids con `gap` · no margins
- [ ] Tabla con `overflow-x: auto` si tiene > 6 columnas

---

## CIERRE

Esta guía es **vinculante** para cualquier mockup nuevo o tarea CC. Cualquier desviación requiere validación explícita de Jose y · si se acepta · actualización de esta guía a V6.

Documentos relacionados:
- `HANDOFF-V4-atlas.md` · estado del proyecto · próximas fases
- `ATLAS-Personal-modelo-datos-v1.md` · modelo de datos Personal · 14 axiomas
- `ATLAS-mapa-54-stores.md` · inventario stores · partida Fase 3

Mockups de referencia (Mi Plan v3 cerrado · ejemplares):
- `atlas-mi-plan-landing-v3.html` · pattern landing
- `atlas-mi-plan-proyeccion-v3.html` · pattern SVG waterfall + gantt + plurianual
- `atlas-mi-plan-libertad-v3.html` · pattern toggle escenario + KPIs estrella + simulador
- `atlas-mi-plan-objetivos-v3.html` · pattern cards con borde superior + ruta sí/no
- `atlas-mi-plan-fondos-v3.html` · pattern hero distribución + cards con composición
- `atlas-mi-plan-retos-v3.html` · pattern hero reto activo + timeline 12 sellos

**Fin · GUÍA-DISENO-V5-atlas.md**
