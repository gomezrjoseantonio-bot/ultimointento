# GUÍA DE DISEÑO DEFINITIVA ATLAS v3

> Fuente única de verdad para tokens, componentes, gráficos, iconografía y reglas de interacción.
>
> Esta guía **reemplaza v2** y consolida v1, v2 y addendums.

## 1) Tokens (única fuente de verdad)

### Marca
- `--blue: #042C5E`
- `--teal: #1DA0BA` (solo acento UI, **nunca** en importes financieros)

### Neutros
- `--n-900: #1A2332`
- `--n-800: #253047`
- `--n-700: #303A4C`
- `--n-500: #6C757D`
- `--n-300: #C8D0DC`
- `--n-200: #DDE3EC`
- `--n-100: #EEF1F5`
- `--n-50: #F8F9FA`
- `--white: #FFFFFF`

### Semánticos
- `--s-pos: #1A7A3C` / `--s-pos-bg: #E8F5ED`
- `--s-neg: #B91C1C` / `--s-neg-bg: #FEE9E9`
- `--s-warn: #92620A` / `--s-warn-bg: #FEF3DC`
- `--s-neu: #374151` / `--s-neu-bg: #F3F4F6`

### Gráficos
- `--c1: #042C5E`
- `--c2: #5B8DB8`
- `--c3: #1DA0BA`
- `--c4: #A8C4DE`
- `--c5: #C8D0DC`
- `--c6: #303A4C`

### Tipografía
- UI: `IBM Plex Sans`
- Técnica: `IBM Plex Mono`
- Escala: `--t-xs`, `--t-sm`, `--t-base`, `--t-md`, `--t-lg`, `--t-xl`, `--t-2xl`

### Espaciado / radios
- Grid base: 4px (`--s1` ... `--s12`)
- Radios: `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`

---

## 2) Reglas obligatorias de color

- Prohibido hardcodear colores en componentes.
- `#09182E` está prohibido (bloqueo de CI).
- Semánticos solo para estado/validación/datos financieros positivos-negativos.
- Datos base de ingresos/gastos no son semánticos por defecto.
- `--teal` es acento de interfaz; no se usa para KPIs o importes.

---

## 3) Componentes base

### Botones
- Variantes: `primary`, `secondary`, `ghost`, `danger`, `icon`
- Tamaños:
  - `sm: 6px 12px`
  - `md: 10px 16px`
  - `lg: 13px 24px`
- Radio único: `--r-md`
- Máximo un botón primario por vista/formulario.

### Inputs
- Base: `9px 16px`, `1.5px solid --n-300`, `--r-md`
- Focus obligatorio: `border --blue + outline 2px + focus-ring`
- Error: borde `--s-neg`

### Chips
- `3px 10px`, `--r-sm`, `--t-xs/600`
- Estados con semánticos (`pos/neg/warn/neu`)

---

## 4) Cabeceras, tabs e iconografía

### Cabecera canónica de página
1. Icono de sección (40x40)
2. H1
3. Subtítulo (opcional)
4. Acción primaria (opcional)
5. Tabs (si aplica)

### Regla ⓘ
- `ⓘ` y subtítulo son mutuamente excluyentes.

### Tabs
- **Underline**: navegación entre vistas.
- **Pill**: selector de modo/período (máx. 4, sin iconos).

### Iconografía
- Librería única: `lucide-react`.
- Tamaños: 16/20/24/48.
- Un icono = un significado.
- Acciones destructivas siempre en menú kebab + confirmación modal.

---

## 5) Gráficos

- Paleta fija de 6 colores (`c1..c6`).
- Asignación estable:
  - 2 series: `c1 + c5`
  - 3 series: `c1 + c3 + c5`
  - Donut: orden `c1→c2→c3→c4→c5→c6`
- Categoría mayor debe usar `c1`.
- Categoría residual/"otros" debe usar `c5`.

---

## 6) Interacción y accesibilidad

- Focus ring único:
  - `outline: 2px solid var(--blue)`
  - `outline-offset: 2px`
  - `box-shadow: 0 0 0 4px var(--focus-ring)`
- Transiciones estándar: `all 150ms ease`
- Contraste mínimo WCAG AA (4.5:1)
- Touch target mínimo: `44x44`

---

## 7) Checklist de cumplimiento rápido

- [ ] Sin hardcoded colors
- [ ] Sin iconos fuera de Lucide
- [ ] Sin uso de `--teal` en importes
- [ ] Tabs siempre bajo H1/subtítulo
- [ ] `ⓘ` y subtítulo no conviven
- [ ] Un único botón primary por pantalla
- [ ] Acción de eliminar dentro de kebab + modal
- [ ] Focus states visibles en todos los interactivos
- [ ] Escala tipográfica y espaciado por tokens

---

## 8) Estado de versión

- Estado actual: **v3.0**
- Documento sustituido: `GUIA_DISENO_DEFINITIVA_V2.md`
