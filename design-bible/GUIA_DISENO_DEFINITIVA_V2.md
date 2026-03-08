# GUÍA DE DISEÑO DEFINITIVA ATLAS v2

> Documento base oficial para implementación UI en toda la app. Reemplaza v1.

## 1) Colores (tokens obligatorios)

### Marca
- `--blue: #042C5E` (acciones principales, nav activa, foco)
- `--teal: #1DA0BA` (acento puntual)

### Neutros
- `--n-900: #1A2332` (sidebar bg)
- `--n-800: #253047` (sidebar item hover)
- `--n-700: #303A4C` (texto principal)
- `--n-500: #6C757D` (texto secundario)
- `--n-300: #C8D0DC` (bordes)
- `--n-100: #EEF1F5` (headers de tabla, zebra)
- `--n-50:  #F8F9FA` (fondo de página)
- `--white: #FFFFFF`

### Semánticos (solo datos/validación)
- `--s-positive: #1A7A3C` / `--s-positive-bg: #E8F5ED`
- `--s-negative: #B91C1C` / `--s-negative-bg: #FEE9E9`
- `--s-warning: #92620A` / `--s-warning-bg: #FEF3DC`
- `--s-neutral: #374151` / `--s-neutral-bg: #F3F4F6`

## 2) Tipografía
- Familia UI: `IBM Plex Sans` (fallback `Inter`, `system-ui`).
- Familia técnica: `IBM Plex Mono`.
- Escala: `--text-xs:12`, `--text-sm:13`, `--text-base:15`, `--text-md:17`, `--text-lg:20`, `--text-xl:24`, `--text-2xl:32`.
- Regla global: `font-variant-numeric: tabular-nums` en datos numéricos.

## 3) Espaciado y radios
- Grid base 4px.
- Radios: `--r-sm:4px`, `--r-md:8px`, `--r-lg:12px`, `--r-xl:16px`.
- Medidas fijas:
  - Sidebar desktop: `--sidebar-width: 256px`
  - Topbar: `--topbar-height: 64px`
  - Touch target mínimo: `44x44px`

## 4) Botones
- Variantes: `primary`, `secondary`, `ghost`, `destructive`.
- Padding base: `10px 16px`.
- Tamaños: `sm = 6px 12px`, `lg = 13px 24px`.
- Radio único: `8px`.
- Un solo botón primario por vista/formulario.

## 5) Chips y badges
- Clases base: `atlas-chip-default`, `atlas-chip-active`, `atlas-chip-positive`, `atlas-chip-negative`, `atlas-chip-warning`.
- Usar color oscuro sobre fondo claro (nunca color saturado directo).

## 6) Iconografía
- Librería única: `lucide-react`.
- Tamaños permitidos: 16, 20, 24, 48.
- Reglas de significado único por icono en la app.

## 7) Interacción
- Focus único en toda la app:
  - `outline: 2px solid var(--blue)`
  - `outline-offset: 2px`
  - `box-shadow: 0 0 0 4px var(--focus-ring)` con `--focus-ring: rgba(4,44,94,0.12)`
- Hover:
  - primary: `--blue-hover` (`#031F47`)
  - secondary: `rgba(4,44,94,0.06)`
  - sidebar item: `--n-800`

## 8) Lo que nunca se hace
- No hardcodear colores (`#042C5E`, `rgb(...)`) fuera de tokens.
- No usar semánticos para decoración.
- No reutilizar el mismo icono para conceptos distintos.
- No usar más de un botón primario por vista.
- No usar librerías de iconos fuera de `lucide-react`.
- Color prohibido explícito: `#09182E`.

