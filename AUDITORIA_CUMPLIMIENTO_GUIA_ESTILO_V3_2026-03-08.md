# Auditoría exhaustiva de cumplimiento — Guía de Diseño ATLAS v3

Fecha: 2026-03-08  
Alcance: revisión estática de toda la app (`src/`) contra la guía oficial `design-bible/GUIA_DISENO_DEFINITIVA_V3.md`.

## 1) Metodología ejecutada

Se aplicaron 3 niveles de validación:

1. **Validación automática del sistema de diseño** con `npm run lint:atlas`.
2. **Validación automática de accesibilidad** con `npm run test:accessibility`.
3. **Barridos adicionales de código** (regex y conteos) para cubrir obligaciones explícitas de la guía v3.

### Resultado agregado de validaciones automáticas

- `lint:atlas`: **32 errores** bloqueantes y **395 warnings** en **283 archivos**.
- Distribución de errores bloqueantes:
  - 27 por dark theme/overlay.
  - 3 por tipografías no permitidas según el linter.
  - 2 por patrones de ayuda inválidos.
- Top warnings:
  - 273 incidencias por patrón de botón no estandarizado.
  - 117 incidencias por colores hardcodeados.
  - 5 incidencias por `alert/confirm/prompt` del navegador.

### Barrido adicional en `src/` (conteo global)

- Archivos analizados (`.ts/.tsx/.js/.jsx/.css`): **682**.
- Coincidencias de hex hardcodeado: **238**.
- Coincidencias `rgb/rgba`: **124**.
- Coincidencias de clases/constructos oscuros (`dark:`, `bg-black`, `bg-opacity-*`): **13**.
- Imports de iconos no permitidos (`@heroicons/react`, `react-icons`, etc.): **0**.
- Uso de `alert/confirm/prompt`: **5**.
- `toLocale*` no `es-ES`: **0** detectados por patrón.
- Botones icon-only sin `aria-label` (heurístico): **99**.
- `div` con `onClick` (heurístico): **48**.

---

## 2) Matriz de cumplimiento contra Guía v3

## 2.1 Tokens (fuente única) y reglas de color

**Estado: INCUMPLIMIENTO CRÍTICO.**

Requisitos v3 relevantes:
- Prohibido hardcodear colores.
- `#09182E` prohibido.
- Uso semántico restringido.
- `--teal` sólo como acento UI, no para importes/KPIs financieros.

Hallazgos:
- Hay un volumen alto de colores hardcodeados (hex + rgba), incompatible con el principio de token único.
- No se detectó uso de `#09182E` (cumplido ese punto concreto).
- Se detecta uso de teal en señalización de importes/ingresos (`.movement-ingreso { color: var(--teal-500) }`), lo que contradice la regla de no usar teal para valores financieros.

## 2.2 Tipografía

**Estado: INCUMPLIMIENTO / INCONSISTENCIA DE GOBERNANZA.**

Requisito v3: familia base `IBM Plex Sans` y técnica `IBM Plex Mono`.

Hallazgos:
- En `index.css` se define correctamente `--font-base` con `IBM Plex Sans` y `--font-mono` con `IBM Plex Mono`.
- Pero el proyecto sigue importando `@fontsource/inter` en arranque global.
- Además, el linter corporativo actual todavía valida “Inter only”, en conflicto directo con la guía v3.

Conclusión: hay **desalineación entre guía oficial y tooling de cumplimiento**.

## 2.3 Componentes base (botones, inputs, chips)

**Estado: INCUMPLIMIENTO ALTO.**

Hallazgos:
- 273 warnings de botón no estandarizado indican adopción incompleta del componente canónico/estilos de botón.
- Se mantiene presencia de estilos legacy y variantes heterogéneas en múltiples módulos.
- La regla “un solo botón primary por vista/formulario” no puede cerrarse al 100% con validación estática; requiere revisión visual por pantalla y flujos.

## 2.4 Cabeceras, tabs e iconografía

**Estado: PARCIAL.**

Hallazgos:
- No se detectan imports de librerías de iconos prohibidas en `src` (cumplimiento positivo para librería única).
- No existe actualmente una regla automática robusta que garantice en todo el código:
  - jerarquía canónica de cabecera (icono + H1 + subtítulo + acción + tabs),
  - exclusión mutua `ⓘ` vs subtítulo,
  - tabs siempre bajo H1/subtítulo.

Conclusión: cumplimiento **no demostrable de forma global** sin auditoría visual funcional por rutas.

## 2.5 Gráficos

**Estado: PARCIAL / RIESGO.**

Requisito v3: paleta fija `c1..c6` y asignaciones estables por nº de series.

Hallazgos:
- Existen componentes que sí consumen tokens de gráfica.
- Pero también aparecen clases/colores no normalizados en partes de la app, lo que sugiere potencial incumplimiento de asignación estable en algunos gráficos.
- No hay test automático dedicado que valide orden y asignación de series (`c1..c6`) en todos los gráficos.

## 2.6 Interacción y accesibilidad

**Estado: INCUMPLIMIENTO ALTO.**

Requisitos v3: focus visible uniforme, WCAG AA, touch target mínimo 44x44.

Hallazgos automáticos:
- 81 botones icon-only sin `aria-label` (script de accesibilidad).
- 47 `div` con `onClick` sin garantías de semántica/teclado.
- El test reporta contraste insuficiente para el token `--warn` frente a fondo blanco.
- Hay estilos focus presentes globalmente, pero la cobertura en todos los interactivos no está garantizada por test end-to-end.

---

## 3) Conclusión ejecutiva

La app **NO cumple actualmente** de forma integral con las obligaciones de la Guía de Diseño v3.

Principales bloqueadores:
1. Alto volumen de deuda de estilos (colores hardcodeados y botones no canónicos).
2. Errores bloqueantes de tema/overlay oscuro detectados por linter.
3. Deuda de accesibilidad (aria-labels, semántica de controles interactivos).
4. Inconsistencia de gobernanza: la guía v3 y el linter corporativo no están alineados en tipografía.

---

## 4) Plan de remediación obligatorio (priorizado)

### Fase 0 — Gobernanza (inmediata)
1. Alinear `scripts/atlas-lint.js` con la Guía v3 (tipografía IBM Plex, reglas reales vigentes).
2. Congelar nuevas pantallas fuera de design system hasta cerrar errores bloqueantes.

### Fase 1 — Bloqueantes CI (48-72h)
1. Eliminar los 32 errores de `lint:atlas`.
2. Corregir dark overlays y patrones de ayuda inválidos.
3. Añadir regla automática para prohibir teal en importes/KPI financieros.

### Fase 2 — Diseño base (1 sprint)
1. Migrar botones a componente canónico y reducir warnings masivos.
2. Sustituir hardcoded colors por tokens.
3. Revisar cabeceras/tabs por plantilla canónica.

### Fase 3 — Accesibilidad (1 sprint)
1. Eliminar icon-only sin `aria-label`.
2. Reemplazar `div onClick` por `button` o controles accesibles equivalentes.
3. Ejecutar auditoría manual por teclado + lector de pantalla por rutas críticas.

---

## 5) Evidencias específicas (muestras)

- Guía v3 define prohibición de hardcoded colors y uso restringido de teal en importes.
- `src/index.css` contiene `movement-ingreso` coloreado en teal.
- `src/index.css` define tipografía IBM Plex pero también se importan fuentes Inter.
- El tooling disponible (`scripts/atlas-lint.js` y `scripts/test-accessibility.js`) confirma deuda de cumplimiento en diseño y accesibilidad.

