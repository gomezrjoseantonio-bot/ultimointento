# T22 · Cierre · Reconstrucción Dashboard + Sidebar + Topbar

> **TAREA** · 22 · v2 · Cierre formal
>
> **Fecha cierre** · 2026-05-01
>
> **Sub-tareas** · 22.1 → 22.8 (8 sub-tareas con stop-and-wait ✅)
>
> **DB_VERSION** · 65 (sin cambios · solo refactor visual)

---

## Resumen ejecutivo

La TAREA 22 reconstruyó completamente el Dashboard (`/panel`), el Sidebar y el Topbar global
del sistema ATLAS, siguiendo las especificaciones del mockup Oxford Gold V5 y los tokens
canónicos § Z. Se entregó en 8 sub-tareas con revisión explícita stop-and-wait en cada una.

### Alcance entregado

| Sub-tarea | Descripción | PR |
|-----------|-------------|-----|
| 22.1 | Sidebar V5 nueva agrupación funcional + Topbar global | ✅ mergeado |
| 22.2 | Saludo + Hero patrimonial + Composición γ | ✅ mergeado |
| 22.3 | Grid 4 activos · PulseAssetCard | ✅ mergeado |
| 22.4 | Pulso del mes | ✅ mergeado |
| 22.5 | Piden tu atención · AttentionList | ✅ mergeado |
| 22.6 | Mi Plan brújula · MiPlanCompass | ✅ mergeado |
| 22.7 | Timeline 12 meses · YearTimeline | ✅ mergeado |
| 22.8 | Cierre · e2e + docs | ✅ este PR |

---

## Diff visual antes / después

### Antes (Dashboard legacy `HorizonPanel`)

- Sidebar con estructura plana sin agrupación funcional
- Sin topbar global persistente
- Panel con un único bloque de KPIs financieros genéricos
- Sin sección de composición de patrimonio
- Sin grid de activos pulsados
- Sin pulso del mes con cashflow
- Sin lista de alertas priorizadas
- Sin brújula Mi Plan
- Sin timeline de hitos anuales
- Colores hardcoded en varios componentes

### Después (Panel V5 + Sidebar V5 + Topbar V5)

- **Sidebar V5** · 11 items en orden canónico · 2 headers (`Mis activos` · `Operativa`) + separador antes de Ajustes · item activo con indicador oro · iconos § AA.1 16×16 stroke 1.7
- **Topbar global** · Search ⌘K (stub + CommandPalette real) · Bell con badge 12 (TODO dinámico) · Help icon (stub) · persistente en TODAS las pantallas
- **Panel 8 secciones** implementadas con tokens § Z:
  1. `Saludo + fecha + campaña IRPF` (§ Z.6)
  2. `Hero patrimonial` · valor neto + activos + deuda (§ Z.7)
  3. `Composición γ` · 3 segmentos activos sin Financiación (§ Z.8 · decisión γ)
  4. `Grid 4 activos` · PulseAssetCard × 4 (§ Z.9)
  5. `Pulso del mes` · ingresos · gastos · cashflow · saldo fin (§ Z.10)
  6. `Piden tu atención` · AttentionList · MAX 5 alertas (§ Z.11)
  7. `Mi Plan brújula` · MiPlanCompass (§ Z.11)
  8. `Timeline 12 meses` · YearTimeline · hitos fiscales + financiación (§ Z.12)
- **Iconografía 100% mapeada** § AA · cero iconos fuera del vocabulario Lucide-react
- **Cero hex hardcoded** en `src/modules/panel/` y `src/design-system/v5/` (excl. tokens.css)
- **Cero ruptura** de otros módulos · solo se modifica layout + panel + design-system/v5

---

## Archivos modificados / creados

### Nuevos (T22)

| Archivo | Sub-tarea | Descripción |
|---------|-----------|-------------|
| `src/design-system/v5/TopbarV5.tsx` | 22.1 | Topbar global con search · bell · help |
| `src/design-system/v5/TopbarV5.module.css` | 22.1 | Estilos TopbarV5 con tokens § Z.5 |
| `src/design-system/v5/tokens.css` | 22.1 | Tokens canónicos § Z · paleta Oxford Gold V5 |
| `src/design-system/v5/CompositionBar.tsx` | 22.2 | Barra composición patrimonio γ |
| `src/design-system/v5/CompositionBar.module.css` | 22.2 | Estilos CompositionBar |
| `src/design-system/v5/icons.ts` | 22.1 | Mapeo § AA SVG mockup → Lucide-react |
| `src/modules/panel/PanelPage.tsx` | 22.2–22.7 | Panel V5 · 8 secciones |
| `src/modules/panel/PanelPage.module.css` | 22.2–22.7 | Estilos panel · grid responsive |
| `src/modules/panel/components/PulseAssetCard.tsx` | 22.3 | Card activo pulsado |
| `src/modules/panel/components/PulseAssetCard.module.css` | 22.3 | Estilos PulseAssetCard |
| `src/modules/panel/components/PulsoDelMes.tsx` | 22.4 | Pulso financiero del mes |
| `src/modules/panel/components/PulsoDelMes.module.css` | 22.4 | Estilos PulsoDelMes |
| `src/modules/panel/components/AttentionList.tsx` | 22.5 | Lista alertas priorizadas |
| `src/modules/panel/components/AttentionList.module.css` | 22.5 | Estilos AttentionList |
| `src/modules/panel/components/MiPlanCompass.tsx` | 22.6 | Brújula Mi Plan |
| `src/modules/panel/components/MiPlanCompass.module.css` | 22.6 | Estilos MiPlanCompass |
| `src/modules/panel/components/YearTimeline.tsx` | 22.7 | Timeline hitos anuales |
| `src/modules/panel/components/YearTimeline.module.css` | 22.7 | Estilos YearTimeline |

### Modificados (T22)

| Archivo | Sub-tarea | Cambio |
|---------|-----------|--------|
| `src/components/navigation/Sidebar.tsx` | 22.1 | Agrupación V5 · 2 headers + separador · item activo oro |
| `src/layouts/MainLayout.tsx` | 22.1 | Integra TopbarV5 global |
| `src/config/navigation.ts` | 22.1 | Secciones `panel` · `mis-activos` · `operativa` · `ajustes` |

### Documentación (T22.8)

| Archivo | Descripción |
|---------|-------------|
| `docs/T22-end-to-end-verification.md` | Checklist e2e 9 puntos |
| `docs/T22-cierre.md` | Este documento |
| `docs/TAREA-20-pendientes.md` | Dashboard/Sidebar marcados como cerrados (T22) |

---

## TODOs documentados (stubs formales)

Los siguientes TODOs quedan registrados como deuda técnica deliberada.
No bloquean el cierre de T22 · se resuelven en tareas dedicadas.

### TODO-T22-01 · Búsqueda real TopbarV5

**Archivo** · `src/design-system/v5/TopbarV5.tsx` · línea ~20 y ~28 y ~142

**Descripción** · La barra de búsqueda en Topbar abre CommandPalette (⌘K) cuando está disponible.
La integración con un servicio de búsqueda semántica real (full-text sobre stores IndexedDB) es una tarea futura dedicada.

**Cierre en** · Tarea dedicada búsqueda semántica.

---

### TODO-T22-02 · Panel notificaciones Bell dinámico

**Archivo** · `src/design-system/v5/TopbarV5.tsx` · línea ~22 y ~35 y ~153 y ~175

**Descripción** · El badge del bell está hardcodeado a `12`. El panel de notificaciones
muestra un stub "Sin notificaciones". Se necesita un store/servicio de notificaciones
para alimentar el badge y la lista en tiempo real.

**Cierre en** · Tarea dedicada servicio notificaciones.

---

### TODO-T22-03 · Centro de ayuda real

**Archivo** · `src/design-system/v5/TopbarV5.tsx` · línea ~24 y ~42 y ~227

**Descripción** · El botón help abre un stub "Centro de ayuda · próximamente".
Se necesita conectar con documentación / intercom / modal de ayuda real.

**Cierre en** · Tarea dedicada centro de ayuda.

---

### TODO-T22-04 · Alertas reales AttentionList

**Archivo** · `src/modules/panel/components/AttentionList.tsx` · líneas 8-10
**Archivo** · `src/modules/panel/PanelPage.tsx` · líneas 200-216

**Descripción** · Las alertas de AttentionList se construyen actualmente sobre lógica
directa de stores (deudas ejecutivas · borradores IRPF listos · obligaciones fiscales próximas 30d).
No hay servicio centralizado de alertas. Las tres categorías están documentadas como stubs.

**Cierre en** · Tarea dedicada servicio alertas.

---

### TODO-T22-05 · Proyección saldo fin de mes PulsoDelMes

**Archivo** · `src/modules/panel/components/PulsoDelMes.tsx` · líneas 12 y 30 y 92
**Archivo** · `src/modules/panel/PanelPage.tsx` · líneas 174 y 192

**Descripción** · El saldo fin de mes en PulsoDelMes usa el saldo actual de tesorería
como proxy. La proyección real requiere conectar con el servicio `budgetProjection`
de Mi Plan (ya implementado en T20.3c).

**Cierre en** · Sprint posterior de integración Mi Plan ↔ Tesorería.

---

### TODO-T22-06 · Año libertad + meta inmuebles MiPlanCompass

**Archivo** · `src/modules/panel/components/MiPlanCompass.tsx` · líneas 9 y 14 y 36 y 122
**Archivo** · `src/modules/panel/PanelPage.tsx` · líneas 279-302

**Descripción** · `añoLibertad` y `metaInmuebles` muestran "—" / null porque el simulador
Mi Plan no expone todavía una API pública para estos valores.

**Cierre en** · Tarea dedicada simulador Mi Plan KPIs · T22 §13 punto 3.

---

### TODO-T22-07 · Deltas reales PulseAssetCard

**Archivo** · `src/modules/panel/components/PulseAssetCard.tsx` · línea 117

**Descripción** · El delta últimos 30 días de cada activo muestra null ("—") porque
no hay servicio de historial de valores por activo.

**Cierre en** · Tarea dedicada historial valoraciones.

---

### TODO-T22-08 · Hitos obligaciones fiscales YearTimeline

**Archivo** · `src/modules/panel/components/YearTimeline.tsx` · línea 120

**Descripción** · Los hitos fiscales del timeline se construyen sobre datos del store `fiscal`.
Un servicio dedicado de obligaciones fiscales permitiría mayor granularidad.

**Cierre en** · Tarea dedicada servicio obligaciones fiscales.

---

## Criterios de aceptación T22 · estado final

- [x] 8 sub-tareas mergeadas con stop-and-wait
- [x] DB_VERSION en 65 (sin tocar)
- [x] Sidebar V5 nueva agrupación funcional TODOS módulos
- [x] Topbar global con search ⌘K + bell + help (stubs documentados § TODO-T22-01/02/03)
- [x] Panel 8 secciones implementadas con tokens § Z
- [x] Iconografía 100% mapeada § AA
- [x] Composición 3 segmentos solo activos (γ)
- [x] Datos reales · placeholders coherentes · TODOs
- [x] Cero hex hardcoded
- [x] Cero ruptura otros módulos
- [x] Checklist v5 (§ GUIA-DISENO-V5-atlas.md · sección 17) pasada

---

## Checklist V5 · § GUIA-DISENO-V5-atlas.md · sección 17

### Tokens
- [x] No hex hardcoded · todo vía variables (0 hits en grep)
- [x] No colores fuera de la paleta Oxford Gold (tokens.css es la fuente)
- [x] Tipografía · IBM Plex Sans + JetBrains Mono solo
- [x] Tabular nums activado en `.mono` · `font-variant-numeric: tabular-nums`

### Layout
- [x] Sidebar 11 items en orden canónico · 1 activo correcto
- [x] Topbar con search y 2 icon-buttons (bell + help)
- [x] Main padding 22px 32px 60px · max-width implementado en PanelPage.module.css

### Page head
- [x] H1 sin icono (PageHead sin icono en Panel)
- [x] Sub con datos contextuales · sin frase decorativa
- [x] Botones · acción principal `btn-gold` derecha · máximo 2

### KPIs strip
- [x] `display: flex; flex-direction: column; min-height: 92px;` en `.kpi` (KPIStrip.module.css)
- [x] `line-height: 1.15;` en `.kpi-val`
- [x] `margin-top: auto; padding-top: 6px;` en `.kpi-sub`
- [x] Subtítulos alineados al ras inferior

### Cards
- [x] Border superior por tipo · usando colores de paleta
- [x] Estados visuales del set canónico
- [x] Footer con `margin-top: auto`
- [x] `event.stopPropagation()` en vínculos internos si card clickable

### Bloques especiales
- [x] Banda alerta solo cuando hay alerta real (AttentionList condicional)
- [x] Empty state dashed cuando algo está vacío (EmptyState component)

### SVG (no aplica · T22 no introduce SVGs nuevos)
- [n/a] Coordenadas Y validadas

### Animaciones
- [x] Solo `pulso` y `transform translateY(-1px)` · sin spring/particle/confetti

### Iconos
- [x] Lucide-react vocabulario · 1 icono por concepto (§ AA mapeo)
- [x] No icono al H1
- [x] Stroke entre 1.7 y 2.5

### Texto
- [x] Separador `·` (no `–` · no `—` · no `|`)
- [x] Sin emojis salvo casos justificados
- [x] Sub-titles en `--ink-4`

### Toast
- [x] Toast con id `toast` · función `showToast(msg)` definida (Toast.tsx en design-system/v5)

### Responsive
- [x] Grids con `gap` · no margins (PanelPage.module.css)
- [x] No overflow horizontal

---

*Fin T22-cierre.md · TAREA 22 ✅*
