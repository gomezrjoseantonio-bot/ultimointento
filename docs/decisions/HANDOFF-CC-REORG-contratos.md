# Handoff · CC · REORG · Reorganización pestaña Contratos

> PR único · 9 commits secuenciales · rama `claude/nice-clarke-j4HLZ`.
> Mockup vinculante: `docs/mockups/atlas-contratos-reorg-v5.html`.
> Reglas de diseño: `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` § 17.
> Audit previo (§ 0.5): `docs/decisions/AUDIT-CC-REORG-contratos-commit1.md`.

## 1 · Problema (producción 02-06-26)

60 contratos importados de Rentila aparecían como **SIN FIRMAR en Activos** con
fechas pasadas, mostrando **días negativos** (p. ej. `-1139 d`). Causa raíz:
`activosTab = [...activos, ...sinFirmar]` inyectaba los `sin_firmar` en la
pestaña Activos **sin filtro de fecha**. Además: KPIs redundantes en zona
blanca, sin distinción entre contratos VIVOS e HISTÓRICO.

## 2 · Decisión de diseño · estado EFECTIVO por fechas

El estado de un contrato (`vigente` / `proximo` / `finalizado`) **se calcula en
runtime a partir de `fechaInicio`/`fechaFin`**, NO se lee de `estadoContrato`.

- `fechaFin` nula o sentinel `2099-12-31` → nunca `finalizado` (reusa
  `esFechaIndefinida`).
- `fechaInicio === hoy` → `vigente`; `fechaFin === hoy` → `vigente` (último día).
- Auto-promoción: un `proximo` pasa a `vigente` solo al releer cuando llega su
  `fechaInicio`. **Sin job nocturno.**
- Caché por sesión vía `WeakMap` (invalidada al cambiar de día); `hoy`
  inyectable para tests deterministas.

API: `src/modules/inmuebles/utils/estadoEfectivoService.ts`
(`getEstadoEfectivo`, `diasHastaFin`, `filtrarPorEstadoEfectivo`,
`calcularUnidadesArrendables`).

## 3 · Commits

| # | Tipo | Resumen | Hash |
|---|------|---------|------|
| 1 | `chore(audit)` | Verificación grep + reporte § 0.5 | `7037bc6` |
| 2 | `feat` | `Contract.documentoFirmado` + `backfillDocumentoFirmado` (migración suave, sin DB bump) | `98412bf` |
| 3 | `feat` | `getEstadoEfectivo` + `useContratosByTab`/`useContratosKPIs` + `kpisContratosService` | `4830428` |
| 4 | `feat` | Banda navy `ContratosTopHero` (4 KPIs) + page head limpio + fix días negativos | `a6ebe8f` |
| 5 | `feat` | Reorg de tabs por estado efectivo · sin Tablero · `TabProximos` | `6acf54c` |
| 6 | `feat` | Drawer ficha · 3 variantes por estado efectivo | `7bfff1c` |
| 7 | `feat` | Tab Análisis · 4 bloques (`TabAnalisis` + `analisisContratosService`) | `526c687` |
| 8 | `chore` | Cleanup de código muerto + test de integración E2E | `0535386` |
| 9 | `docs` | Este handoff | _(este commit)_ |

## 4 · Estructura final

**Tabs** (texto puro, sin contadores): Disponibilidad · **Vigentes** · **Próximos**
· Histórico · **Análisis** · Por conciliar. URLs antiguas redirigen
(`activos`/`tablero`/`acciones` → `vigentes`).

**Banda navy GESTIÓN** (`ContratosTopHero`): Vigentes · Ocupación · Renta
mensual/anual · Vencen 30 días. Única fuente de stats (`useContratosKPIs`).

**Drawer ficha** (`DrawerFichaContrato`): etiqueta, stat contextual, acción de
footer y bloqueo de edición según estado efectivo.

### Componentes nuevos
- `utils/estadoEfectivoService.ts`, `utils/kpisContratosService.ts`,
  `utils/analisisContratosService.ts`
- `hooks/useContratosByTab.ts` (`useContratosByTab`, `useContratosKPIs`)
- `components/contratos/ContratosTopHero.tsx`, `TabProximos.tsx`, `TabAnalisis.tsx`

### Componentes eliminados (superados por la reorg)
`TabTablero`, `DrawerAnalisisAnual`, `KpiContratoCard`, `DrawerLibres`,
`DrawerVencen`, `utils/filtrosVencimiento` — con sus tests.

## 5 · Cómo probar
- `npx tsc --noEmit` → 0 errores.
- `CI=true npx react-scripts test src/modules/inmuebles --watchAll=false`
  → suites de contratos en verde (incluye E2E `ContratosListPage.integration`).
- Manual: abrir `/contratos`. Verificar que ningún Rentila finalizado aparece
  en Vigentes, que no hay días negativos y que la banda navy cuadra.

## 6 · Follow-ups conocidos (fuera de alcance de este PR)

1. **Tabla Vigentes · columnas del mockup** — `TablaActivos` conserva sus
   columnas actuales; el mockup v5 pide 7 columnas sin Estado/Habitación/
   Documento. El bug de días negativos SÍ está resuelto ("Vencido").
2. **Unificar drawer finalizado** — existe `historico/DrawerExContrato.tsx`
   (variante ex-inquilino, ya en producción) en paralelo a la variante
   `finalizado` de `DrawerFichaContrato`. Conviene unificar.
3. **Migración persistida de `estadoContrato`** — pospuesta (decisión Jose). El
   estado se deriva por fechas en runtime; el dato persistido no se migra.
4. **Análisis · datos comparativos reales** — el bloque 2 muestra el resumen
   actual; la proyección año-vs-año del mockup requiere histórico de ingresos.
   El bloque 1 muestra la tira de 12 meses del año en curso (el mockup dibuja
   24 meses · 12 atrás + 12 adelante).
5. **Acciones reales** — KPIs de la banda navy son display-only y las acciones
   del footer del drawer son toasts placeholder (T3.x/T4 ya referenciados).

## 7 · Notas técnicas
- **Sin DB bump** · versión sigue en **78**. `documentoFirmado` se rellena con
  migración suave idempotente en keyval (no en `onupgradeneeded`).
- **Tokens** · solo `--atlas-v5-*` (sin hex sueltos en los componentes nuevos).
