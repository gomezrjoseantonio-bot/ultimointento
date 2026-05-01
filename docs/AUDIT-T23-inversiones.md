# AUDIT · T23 · Inversiones · estado de partida (sub-tarea 23.1)

> Auditoría inicial requerida por `docs/TAREA-23-inversiones-galeria-fichas.md` § 2.2.
> Fija el punto de partida ANTES de reemplazar las 4 tabs por la galería.

## 1 · Estado de implementación previo a 23.1

Módulo `src/modules/inversiones/` v5 (T20 Fase 3d):

- `InversionesPage.tsx` · contenedor con `<Outlet />` y barra de 4 tabs.
- `pages/ResumenPage.tsx` · KPIs agregados.
- `pages/CarteraPage.tsx` · tabla plana de posiciones.
- `pages/RendimientosPage.tsx` · 4 gráficos genéricos (donut · evolución · etc.).
- `pages/IndividualPage.tsx` · selector + ficha estándar.
- `components/PosicionFormDialog.tsx` · alta/edición posición (modal).
- `components/AportacionFormDialog.tsx` · alta/edición aportación.
- `components/ActualizarValorDialog.tsx` · actualizar valor.
- `components/PosicionDetailDialog.tsx` · detalle (modal · será deprecado al cerrar 23.3).
- `import/ImportarIndexaCapitalPage.tsx` · wrapper legacy.
- `import/ImportarAportacionesPage.tsx` · wrapper legacy.
- `helpers.ts` · cálculos derivados (CAGR · TIR estimada · series gráfico · etc.).
- `types.ts` · `PositionRow` (fila de presentación).
- `InversionesContext.ts` · context outlet.

Botones page-head actuales · `[Importar IndexaCapital]` `[Importar aportaciones]` `[Nueva posición]`.
Tabs · Resumen · Cartera · Rendimientos · Individual.

## 2 · Datos reales del usuario en `inversiones`

Acceso · `inversionesService.getAllPosiciones()` divide entre `activas` (`activo === true`) y `cerradas` (`activo === false`). El store IndexedDB `inversiones` se mantiene intacto en T23.1 · cero borrado · cero migración.

Posiciones identificadas en pantallazos previos del usuario (verificadas contra el flujo actual de Inversiones):

| Nombre | Tipo | Entidad | Valor actual | Total aportado | Notas |
|---|---|---|---|---|---|
| `ORANGE ESPAGNE SA` | `accion` (probable RSU) | empresa Jose | 36.500 € | 0 € | RSU típico · sin coste de adquisición |
| `Plan de pensiones` | `plan_pensiones` | genérico XML | 0 € | s/d | importado del XML AEAT · falta entidad / ISIN / aportaciones |

Cuestiones derivadas:

- Las dos posiciones tienen MUCHOS campos vacíos (sin aportaciones detalladas · sin fecha de compra · sin nº de participaciones · sin entidad real en el caso del plan de pensiones).
- Sparkline imposible · `aportaciones.length < 2` en ambas. La galería renderiza placeholder visual "datos insuficientes para gráfico" según § Z.4 spec.
- `total_aportado = 0` para `ORANGE ESPAGNE SA` rompe el cálculo de `rentabilidad_porcentaje` (división por cero) · el helper actual ya devuelve `0` en ese caso · OK · UI pinta `—`.

Recomendaciones para 23.3 (no para 23.1):

- Priorizar la ficha `<FichaValoracionSimple>` (cubre `plan_pensiones`).
- Priorizar la ficha `<FichaDividendos>` (cubre `accion` · caso RSU).
- `<FichaRendimientoPeriodico>` queda como tercera prioridad · usuario aún no tiene posiciones de ese grupo.

## 3 · Posiciones cerradas · localización de la fuente

`inversionesService.getAllPosiciones()` ya devuelve un campo `cerradas` separado (posiciones del store con `activo === false`). En el snapshot actual del usuario · ese array está VACÍO porque el flujo de cierre todavía no se usa desde la UI · las ventas reales viven en otra parte.

Las **ventas reales** del usuario (que alimentarán "Posiciones cerradas" en 23.4) están en la declaración fiscal importada:

- Tipo de datos · `GananciasPerdidas` en `src/types/declaracionCompleta.ts:263`.
- Sub-arrays:
  - `OperacionFondo[]` · transmisiones de fondos · `valorTransmision` · `valorAdquisicion` · `ganancia` · `retencion` · `nifFondo`.
  - `OperacionCripto[]` · transmisiones de cripto · `moneda` · `valorTransmision` · `valorAdquisicion` · `resultado`.
  - `OperacionTransmision[]` · otras transmisiones (acciones cotizadas · etc.) · `descripcion` · `valorTransmision` · `valorAdquisicion` · `resultado`.
- Acceso · vía `declaracionDistributorService` / `fiscalContextService` (declaraciones IRPF importadas vía XML AEAT).
- También existen agregados anuales en `fiscalSummaryService` (totales de ganancias/pérdidas por ejercicio) que pueden servir de fallback cuando los detalles no estén importados.

Sin embargo · este modelo es **fiscal** · expone `ganancia` · `retencion` · `nifFondo`. **23.4** construirá un adaptador en `src/modules/inversiones/adapters/` que mapee estos registros a la estructura `PosicionCerrada` con narrativa de inversor (`nombre` · `entidad` · `aportado` · `vendido` · `resultado` · `cagr` · `duracionDias` · etc.) y oculte el lenguaje fiscal de la UI · respetando la filosofía § 5.2 de la spec.

## 4 · Fuentes a NO duplicar en T23.1

- Parser XML AEAT · intacto (datos como vienen).
- `inversionesService` · solo se llama · no se modifica (cero migración).
- `operacionFiscalService` · pertenece al módulo Fiscal · **NO** se referencia desde Inversiones (filosofía § 5.2 · puente solo opcional desde la carta cerrada en 23.4).
- DB schema · `DB_VERSION = 65` sigue intacto.

## 5 · Salida 23.1

T23.1 sustituye `InversionesPage` (4 tabs) por `<InversionesGaleria>` (galería 3 cols + cartas heterogéneas + entry-point colapsable a "Posiciones cerradas"). Click en carta → `/inversiones/{id}` con placeholder de ficha (23.3 lo construye). Botón `[Aportar]` (modal selector + AportacionFormDialog) · botón `[Nueva posición]` (wizard placeholder · 23.2 lo construye · por ahora abre el `PosicionFormDialog` directo). Importadores `IndexaCapital` y `Aportaciones` salen del page-head · sus rutas siguen vivas e intocadas.
