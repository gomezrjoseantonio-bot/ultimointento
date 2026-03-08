# Auditoría exhaustiva de cumplimiento — Guía de Diseño ATLAS v3 (actualizada)

Fecha: 2026-03-08  
Alcance: revisión integral de `src/` contra `design-bible/GUIA_DISENO_DEFINITIVA_V3.md`.

> Este informe lista **todo el incumplimiento detectable por análisis estático** y lo cruza contra el requisito específico.

## 1) Evidencias ejecutadas

- `npm run lint:atlas` → 32 errores + 395 warnings en 283 archivos.
- `npm run test:accessibility` → 81 icon-only sin `aria-label` y 47 `div` con `onClick` (exit 1).
- Escaneo línea a línea contra requisitos v3 → **1547 hallazgos** con archivo/línea/requisito/evidencia.
- Inventario completo para PR único:
  - `AUDITORIA_V3_HALLAZGOS_DETALLADOS.md`
  - `AUDITORIA_V3_HALLAZGOS_DETALLADOS.csv`

## 2) Matriz de incumplimiento (requisito → total exacto)

| Requisito ID | Requisito v3 | Incidencias | Archivos | Estado |
|---|---|---:|---:|---|
| `V3-2-COLOR-HARDCODE` | Guía v3 §2: prohibido hardcodear colores en componentes. | 334 | 70 | ❌ Incumple |
| `V3-2-COLOR-09182E` | Guía v3 §2: `#09182E` está prohibido. | 0 | 0 | ✅ Cumple |
| `V3-2-TEAL-IMPORTE` | Guía v3 §2: `--teal` no se usa en KPIs/importes. | 21 | 5 | ❌ Incumple |
| `V3-2-DARK-OVERLAY` | Guía v3 §2: consistencia de paleta (sin overlays oscuros legacy). | 39 | 21 | ❌ Incumple |
| `V3-3-BUTTON-STANDARD` | Guía v3 §3: botones en variantes estándar (`primary/secondary/ghost/danger/icon`). | 920 | 243 | ❌ Incumple |
| `V3-3-INPUT-FOCUS` | Guía v3 §3: focus obligatorio en inputs (border + outline + ring). | 16 | 7 | ❌ Incumple |
| `V3-4-ICONS-LUCIDE` | Guía v3 §4: iconografía exclusiva `lucide-react`. | 0 | 0 | ✅ Cumple |
| `V3-4-DELETE-KEBAB` | Guía v3 §4: destructivos en kebab + confirmación modal. | 2 | 2 | ❌ Incumple |
| `V3-4-INFO-SUBTITLE` | Guía v3 §4: `ⓘ` y subtítulo no conviven. | 0 | 0 | ✅ Cumple |
| `V3-5-CHART-PALETTE` | Guía v3 §5: paleta/orden estable de gráficos c1..c6. | 54 | 14 | ❌ Incumple |
| `V3-6-ARIA-ICON-BUTTON` | Guía v3 §6: icon-only con nombre accesible. | 81 | 59 | ❌ Incumple |
| `V3-6-DIV-ONCLICK` | Guía v3 §6: interacción semántica (evitar `div onClick`). | 47 | 37 | ❌ Incumple |
| `V3-6-TOUCH-44` | Guía v3 §6: touch target mínimo 44x44. | 33 | 19 | ❌ Incumple |

## 3) Foco solicitado por negocio: Nómina y gráficas

### 3.1 Incumplimiento específico en gráfica de nómina

- En gráfico de distribución mensual de nómina se usa `c1 + c2` para 2 series (`base` y `paga extra`).
- La guía v3 exige para 2 series: **`c1 + c5`**.
- Este punto queda trazado como incumplimiento de `V3-5-CHART-PALETTE`.

### 3.2 Todo lo no conforme detectado en archivos de nómina

- `V3-5-CHART-PALETTE`: 18 incidencias.
- `V3-3-BUTTON-STANDARD`: 17 incidencias.
- `V3-2-COLOR-HARDCODE`: 17 incidencias.

## 4) Inventario completo (“todo TODO”)

El detalle completo por archivo/línea/requisito/evidencia está en:

- `AUDITORIA_V3_HALLAZGOS_DETALLADOS.md`
- `AUDITORIA_V3_HALLAZGOS_DETALLADOS.csv`

### Top 40 archivos con más incumplimientos

| Archivo | Incidencias |
|---|---:|
| `src/components/treasury/treasury-reconciliation.css` | 88 |
| `src/components/personal/nomina/NominaForm.tsx` | 44 |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 33 |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 24 |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 21 |
| `src/components/documents/DocumentViewer.tsx` | 19 |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 18 |
| `src/index.css` | 17 |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 17 |
| `src/components/dashboard/PulseDashboardHero.tsx` | 16 |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 16 |
| `src/components/inbox/DocumentActions.tsx` | 15 |
| `src/components/dashboard/DashboardBlockBase.tsx` | 15 |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 15 |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 15 |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 15 |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 15 |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 14 |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 14 |
| `src/components/atlas/AtlasComponents.tsx` | 13 |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 13 |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 13 |
| `src/components/inbox/PendingQueue.tsx` | 12 |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 12 |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 12 |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 12 |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 11 |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 11 |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 11 |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 11 |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 11 |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 11 |
| `src/pages/DesignBiblePage.tsx` | 10 |
| `src/modules/personal/components/ProfileView.tsx` | 10 |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 10 |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 10 |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 10 |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 10 |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 10 |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 10 |

## 5) Observación sobre “títulos con iconos sombreados”

- Se detecta uso amplio de `shadow-*` en cabeceras/cards/modales, pero la Guía v3 no explicita una prohibición textual genérica de sombra en icono de título.
- Por tanto, este punto se deja trazado como **hallazgo de consistencia visual** a validar con criterio UX, no como incumplimiento automático inequívoco de una regla literal v3.

## 6) Conclusión

La app **sigue incumpliendo** la guía v3. El inventario adjunto permite ejecutar un **único PR de remediación** sin perder trazabilidad de requisito.
