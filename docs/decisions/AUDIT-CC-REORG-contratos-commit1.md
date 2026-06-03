# Audit · CC · REORG · Reorganización pestaña Contratos · Commit 1

> Verificación grep previa (§ 0.4 spec) + reporte obligatorio (§ 0.5).
> Commit 1 es **audit-only · sin cambios de código**. Stop-and-wait entre commits.

## Reporte § 0.5

| Verificación | Resultado | Implicación |
|---|---|---|
| **Pestaña Contratos · path raíz** | `src/modules/inmuebles/pages/ContratosListPage.tsx` (+ componentes en `src/modules/inmuebles/components/contratos/`) | Aquí se aplica el refactor |
| **Tabs actuales · nombres exactos** | `disponibilidad` · `tablero` · `activos` · `historico` · `conciliar` (`ContratosListPage.tsx:37-39`). Renderizan con count badges. | Añadir `proximos` + `analisis`, eliminar `tablero`, renombrar `activos`→`vigentes`, quitar badges |
| **Campo `documentoFirmado` en Contract** | **NO existe.** Hoy se infiere la firma vía `estadoContrato==='sin_firmar'` o helper `estaFirmado()` (`firma.estado==='firmado'` ‖ `fechaFirmaContrato`). Existe `origenImportacion: 'rentila' \| 'plantilla_atlas'`. | Añadir flag en Commit 2 (no DB bump). Migración: `false` si `estadoContrato==='sin_firmar'` u `origenImportacion` presente |
| **Función `getEstadoEfectivo` o similar** | **NO existe.** Cercano: `isContratoActivo()`, `isContratoFinalizado()`, `calcularEstadoChip()`, `esFechaIndefinida()`, y `FECHA_FIN_INDEFINIDO = '2099-12-31'` (`contractService.ts:23`). | Crear `getEstadoEfectivo` en Commit 3 reutilizando el sentinel `2099-12-31` |
| **DrawerContrato existente · qué muestra** | `DrawerFichaContrato.tsx` (ficha vigente), `historico/DrawerExContrato.tsx` (variante **finalizado**: "Invitar a volver" / "Reactivar contrato" / motivo de salida), `ContratosDrawer.tsx`, + `DrawerLibres/Vencen/AnalisisAnual`. **No hay variante `proximo`.** | Unificar en `DrawerContrato` con prop `variant` (Commit 6). Base "finalizado" ya fiel a producción |
| **KPI strip canónico ATLAS · path** | Patrón `kpiStrip` en `src/modules/fiscal/v2/*KpiStrip.tsx`. Hero navy GESTIÓN existente en `FiscalInmueblePage.module.css:31` (`background: var(--atlas-v5-brand-ink)`). Hoy Contratos usa `KpiContratoCard` en zona blanca (NO navy). | Reutilizar patrón fiscal v2 para la banda navy del Commit 4 |
| **Página Contratos · tipo** | **GESTIÓN** confirmado. Hoy sin header navy (usa `PageHead` blanco + `kpiStrip` blanco). | Añadir banda navy `top-hero` con 4 KPIs (regla guía V5 §1) |
| **Bug días negativos · línea exacta** | `TablaActivos.tsx:53-59` → `claseDiasRestantes()`: `if (dias < 0) return styles.daysNeg`. Alimentado por `diasRestantes()` (`:45`) y columna "Días" (header `:87`, render `:100`). | Eliminar en Commit 4/5: finalizados ya no estarán en Vigentes; "Días" → "Fin" con chip ≤30d |
| **Datos Jose · 60 Rentila · conteo por estado efectivo** | **No accesible desde el repo** (datos producción en IndexedDB del navegador). Hoy van TODOS a Activos porque `activosTab = [...activos, ...sinFirmar]` (`:163`) sin filtro de fecha. | El mapeo correcto lo garantiza `getEstadoEfectivo` (Commit 3). E2E con datos simulados validará 8 vigentes / próximos / 50 histórico |

## Hallazgos adicionales

1. **Tokens** — Canónicos globales en `src/design-system/v5/tokens.css` con prefijo **`--atlas-v5-*`** (`--atlas-v5-brand-ink: #0C1230`, `--atlas-v5-gold: #B88A3E`, etc). La spec usa `var(--brand-ink)`/`var(--gold)` sin prefijo (solo existen como alias local en un módulo wizard). → En implementación se traduce a `--atlas-v5-*`. **No es bloqueo**: los tokens SÍ están centralizados. DB version actual: **78**.
2. **Causa raíz del bug producción** — `ContratosListPage.tsx:159-163`: los `sin_firmar` se inyectan en Activos sin filtro de fecha. Por eso 60 Rentila finalizados aparecen como "Activos sin firmar". `getEstadoEfectivo` por fechas lo resuelve de raíz.
3. **Reutilizable** — `calcularLibresAhora`, `filtrosVencimiento`, `inquilinoUtils` (color avatar determinista + iniciales), `mapearTipoContrato`, `TabHistorico` (agrupación parcial · revisar en Commit 5).

## Plan de commits (stop-and-wait)

1. ✅ `chore(audit)` · este reporte
2. `feat(contratos)` · `documentoFirmado` + migración suave (no DB bump)
3. `feat(contratos)` · `getEstadoEfectivo` + `useContratosByTab` + KPIs
4. `feat(contratos)` · banda navy + page head limpio · fix días negativos
5. `feat(contratos)` · reorg tabs (Vigentes/Próximos/Histórico · sin Tablero)
6. `feat(contratos)` · drawer 3 variantes
7. `feat(contratos)` · tab Análisis · 4 bloques
8. `feat(contratos)` · integración + cleanup + E2E
9. `docs(contratos)` · guía servicios + handoff
