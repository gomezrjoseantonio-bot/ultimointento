# AUDITORÍA · Mapa real del pipeline PRESENTE-FUTURO

> **Fecha** · 2026-06-07
> **Tipo** · auditoría SOLO-GREP · CERO CÓDIGO (no se ha tocado ni una línea de código de la app)
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama `main` (HEAD `e74741b`)
> **Objetivo** · saber QUÉ EXISTE · QUÉ FUNCIONA · QUÉ ESTÁ DUPLICADO · QUÉ FALTA de cada pieza del modelo presente-futuro, ANTES de escribir ningún documento canónico ni spec.
> **Regla aplicada** · lo que no se encuentra → "NO EXISTE". No se interpreta ni se propone solución. Los resultados inesperados se reportan tal cual.

---

## Tabla por pieza del modelo

| # | Pieza del modelo | ¿Existe? | Path(s) reales | ¿End-to-end o muerto/desconectado? | Duplicidades |
|---|---|---|---|---|---|
| 1.0 | DB_VERSION + stores | **Sí** | `src/services/db.ts:32` (`DB_VERSION = 78`); comentario declara "45 stores totales" | Vivo. **Discrepancia a reportar:** `grep -c createObjectStore\|objectStore(` = **129** ocurrencias (incluye llamadas de acceso `objectStore(...)` y `createObjectStore` repetidos en bloques de upgrade *fresh* vs *migración*), no 45 stores. | `createObjectStore` aparece duplicado para `escenarios`, `planesPensiones`, `aportacionesPlan`, `traspasosPlanPensiones` (bloques de upgrade distintos — ver §DUPLICADOS) |
| 1.1 | Alta foto actual (por bloque) | **Parcial** | Inmueble: `src/pages/inmuebles/InmueblePage.tsx` (`valorCatastralConstruccion`, `purchaseDate`). Inversiones: `src/modules/horizon/inversiones/components/PosicionForm.tsx`, `AportacionForm.tsx` (`costeAdquisicion` FIFO, `fechaCompra`). Cuentas: `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` (`openingBalance` + `openingBalanceDate`). Contratos: `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx`. | Altas **por módulo** vivas. **NO existe** alta guiada / onboarding "día 0" unificada (0 matches de `foto actual`/`primer uso`/`empezar de cero`/`getting started`). **Hallazgo lateral a reportar:** `src/modules/mi-plan/wizards/utils/getCurrentSaldoCuenta.ts:2-6` documenta que `openingBalance` "está mal". | — |
| 1.2 | Generación previsiones (contratos/préstamos/recurrentes) | **Sí** | Motor: `src/modules/horizon/tesoreria/services/treasurySyncService.ts` (`generateMonthlyForecasts`, sección 3 = contratos activos, 4 = nóminas, + préstamos/recurrentes/autónomos). Orquestador: `src/services/treasuryBootstrapService.ts` (forward-only, 24m, idempotente). Recurrentes: `src/services/personal/compromisosRecurrentesService.ts` (`regenerarEventosCompromiso`). Vivienda: `src/services/personal/viviendaHabitualService.ts`. | End-to-end. Disparado desde Tesorería, Inmuebles, Personal (`grep treasuryBootstrap` → 8 ficheros UI). **Contradicción documental a reportar:** la cabecera de `treasuryBootstrapService.ts:16-19` declara "Contratos / alquileres (T31.no) FUERA DE SCOPE", pero `generateMonthlyForecasts` **sí** procesa contratos (sección 3 `sourceType: 'contrato'`). | **`treasuryCreationService.ts` vs `enhancedTreasuryCreationService.ts` vs `treasurySyncService`/`treasuryBootstrap`** (ver §DUPLICADOS) |
| 1.3 | Confirmación (CSB43 · conciliación · punteo manual) | **Sí (parcial CSB43)** | Importador extractos: `src/services/universalBankImporter/` (xls/csv), `src/modules/horizon/tesoreria/import/BankStatementUploadPage.tsx`, `src/services/bankStatementOrchestrator.ts`. Conciliación: `src/services/treasuryConfirmationService.ts` (estados `predicted`→`executed`/`conciliado`, `estadoTesoreria: 'confirmed'`), `fiscalConciliationService.ts`, `budgetMatchingService.ts`, `movementSuggestionService.ts`. Punteo manual UI: `src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx`, `src/components/treasury/TreasuryReconciliationView.tsx` (botón "Puntear"), `MovimientosTab.tsx`. | Vivo. **A reportar:** NO hay fichero `*csb*` dedicado; formato CSB43/N43 referenciado en `IntegracionesPage.tsx`, `bankStatementOrchestrator.ts`, `bankProfileMatcher.ts`. **NO existe** estado literal `'desviado'` en eventos (solo en `db.ts`); la desviación se calcula en cierre (`fiscalYearLifecycleService.RevisionCierreEjercicio.totalDesviacion`). | — |
| 1.4 | Acumulación ejercicio en curso (estimación IRPF viva) | **Sí** | `src/services/estimacionFiscalEnCursoService.ts` (T23). Lee de `treasuryEvents`, `movements`, `gastosInmuebleService`, `contracts`, `properties` (líneas 83-168). Usa `calcularDeclaracionIRPF`. Niveles de confianza por meses con datos. | End-to-end. Consumido por `src/modules/fiscal/helpers.ts`, `src/contexts/FiscalContext.tsx`, `src/services/fiscalResolverService.ts`, `FichaPlanPensiones.tsx`. | — |
| 1.5 | Eventos vitales (venta inmueble · venta activo · contrato · mejora · PP) | **Sí** | Venta inmueble: `src/services/propertySaleService.ts` (`preparePropertySale`/`confirmPropertySale`/`simulatePropertySale`; cascada toca `prestamos`, `compromisosRecurrentes`, `gastosInmueble`, `treasuryEvents` — línea 689; liquida préstamos vinculados `getLinkedLoansForPropertySale`) + `src/modules/fiscal/v2/FiscalVentaPage.tsx` + `src/pages/GestionInmuebles/venta/`. Ganancia: `gananciaPatrimonialService.ts`. Venta activo financiero: `src/modules/inversiones/components/modal/VenderModal.tsx` + `src/services/inversionesFiscalService.ts` (`calcularGananciaPerdidaFIFO`, `calcularGananciasPerdidasEjercicio`, arrastres minusvalías). Nuevo contrato: `NuevoContratoWizard.tsx`. Mejora: `src/services/mejorasInmuebleService.ts` + `LineasAnualesTab.tsx` (alta/edit/eliminar). PP auto al confirmar nómina (G-07): `src/services/personal/nominaAportacionHook.ts` (`onNominaConfirmada`). | Vivo end-to-end en todas las sub-piezas. | — |
| 1.6 | Corte 1 enero + snapshot | **Parcial** | Snapshot: `src/services/snapshotDeclaracionService.ts` (`crearSnapshotDeclaracion`). Cierre: `src/services/fiscalLifecycleService.ts` y `src/services/fiscalYearLifecycleService.ts` (`RevisionCierreEjercicio.puedeCerrar`). Estados: `src/services/fiscalResolverService.ts:28` (`'en_curso' \| 'pendiente' \| 'declarado'`). | Cierre/snapshot **manual** vivo. **NO existe** corte automático 1-enero / rollover / "nace año nuevo previsto" (0 matches útiles de `cierreAnual`/`rollover`/`1 de enero`/`año nuevo` fuera de snapshot). | **`fiscalLifecycleService.ts` vs `fiscalYearLifecycleService.ts`** (ver §DUPLICADOS) |
| 1.7 | Pre-declaración | **Sí** | `src/services/preDeclaracionService.ts` + `src/modules/horizon/fiscalidad/declaracion/PreDeclaracionView.tsx`. Motor IRPF: `src/services/irpfCalculationService.ts`. Simulador: `src/services/simuladorFiscalService.ts` + `SimuladorPage.tsx`. | Vivo y conectado (View consume el service). | (simulador vs pre-declaración: funciones distintas, no duplicado) |
| 1.8 | Proyección 20 años (patrimonial) | **Parcial / casi NO** | Operativa 12m: `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` (12 meses) y `src/modules/mi-plan/services/budgetProjection.ts` (12m). Multi-año: `src/services/libertadService.ts` (`proyectarRentaPasivaLibertad`, mes a mes hasta `horizonteAnios`) vía `useProyeccionLibertad` → `LibertadPage.tsx`. | `libertadService` **limitado**: lanza error salvo `alcanceRentaPasiva='alquiler-neto'` y `reglaCruce='simple'` ("se implementará en fases posteriores"). **NO existe** proyección patrimonial completa a 20 años multi-activo. `escenariosService.ts` es singleton de KPIs/hitos, no motor de proyección. | **`proyeccionMensualService` vs `budgetProjection`** (dos proyecciones 12m) |
| 1.9 | Enchufe `arrastresIn` | **Parcial (definido vacío · esperado)** | Tipo: `src/services/db.ts:2150` (`ejerciciosFiscalesCoord[año].arrastresIn`). Escribe/lee: `src/services/ejercicioResolverService.ts` (`getArrastresParaAño`, propaga `arrastresOut`→`arrastresIn`), `src/modules/fiscal/v2/helpers/arrastresVivosService.ts`. | Default `fuente: 'ninguno'` (vacío). `ejercicioResolverService.ts:128` comenta "el motor IRPF se conectará en Fase 2". Solo propaga entre ejercicios ATLAS; **NO** hay enchufe del pasado real → coincide con el modelo (definido pero vacío en presente-futuro). | — |
| 1.10 | Inversiones (valoraciones + coste origen) | **Sí** | `src/services/valoracionesService.ts`: `getValorActual`, `getSerie`, `getValorAFecha`, `upsertByDate`, `bulkInsert`, `getPatrimonioTotal`, `getPatrimonioPorTipo`, `getPatrimonioPorSubtipoInversion`, CRUD + soft-delete. Coste origen: `AportacionForm.tsx`/`PosicionForm.tsx` (`costeAdquisicion` FIFO) + `inversionesFiscalService.ts`. | Vivo. Consumido por `Valoraciones.tsx`, `ImportarValoraciones.tsx`, `ListadoPage.tsx`, `FichaPlanPensiones.tsx`, `PanelPage.tsx`. | — |

---

## DUPLICADOS / SOLAPES

1. **Creación de tesorería · TRES generaciones conviviendo**
   - `src/services/treasuryCreationService.ts` — legacy: crea `Ingresos`/`Gastos` desde contratos/nóminas/OCR. Usado por `src/services/treasuryApiService.ts` (`performAutoReconciliation`) y `src/components/documents/DocumentClassificationPanel.tsx`.
   - `src/services/enhancedTreasuryCreationService.ts` — crea movimientos desde documentos de Inbox (`ocr_document`/`bank_extract`). Usado por `AccountSelectionModal.tsx`, `DocumentCorrectionWorkflow.tsx`, `enhancedAutoSaveService.ts`.
   - `src/modules/horizon/tesoreria/services/treasurySyncService.ts` + `src/services/treasuryBootstrapService.ts` — modelo moderno de `treasuryEvents` forward-only.
   - → Solapan en "crear registros de tesorería desde fuentes"; conviven con consumidores distintos.

2. **Cierre de ejercicio / snapshot · DOS servicios**
   - `src/services/fiscalLifecycleService.ts` y `src/services/fiscalYearLifecycleService.ts` — ambos llaman a `crearSnapshotDeclaracion`/`crearSnapshotDeclaracionManual` y ambos son importados por `src/services/ejercicioFiscalService.ts`.

3. **Proyección a 12 meses · DOS implementaciones**
   - `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` vs `src/modules/mi-plan/services/budgetProjection.ts`.

4. **Stores duplicados en `createObjectStore`** (a verificar que no sea colisión real)
   - `escenarios`, `planesPensiones`, `aportacionesPlan`, `traspasosPlanPensiones` aparecen ≥2 veces en `src/services/db.ts` — presumiblemente en bloques de upgrade *fresh DB* vs *migración*; se reporta tal cual.

5. **NO es duplicado (aclaración):** `src/modules/horizon/conciliacion/ConciliacionPage.tsx` es un wrapper de una línea que renderiza `ConciliacionPageV2` (`<ConciliacionPageV2 />`). La ruta en `App.tsx` monta el wrapper. No hay dos páginas de conciliación vivas en paralelo.

---

## HUECOS · piezas del modelo sin (o casi sin) código

- **Onboarding / alta guiada "Día 0" unificada** — NO EXISTE. Solo altas sueltas por módulo. Sin pantalla de "foto actual" / primer uso.
- **Corte automático 1 enero / rollover** ("ejercicio pasa a pendiente + nace año nuevo previsto" automático) — NO EXISTE. El cierre es manual (`fiscalYearLifecycleService.puedeCerrar`).
- **Proyección patrimonial completa a 20 años (capa patrimonial multi-activo)** — NO EXISTE. Solo `libertadService` proyecta renta pasiva por alquiler-neto, y limitado a un único modo (lanza error en el resto).
- **Enchufe del pasado real a `arrastresIn`** — NO EXISTE (definido vacío, `fuente: 'ninguno'`, "Fase 2"). Coincide con el modelo cerrado: arrastresIn vacío en presente-futuro.
- **Generación de previsiones desde Autónomos / Inversiones en el bootstrap** — declarado fuera de scope T31 en `treasuryBootstrapService.ts:16-19` (aunque autónomos sí aparece en `treasurySyncService`).

---

## Ramas / trabajo no mergeado relacionado

`git log --all --oneline | grep -iE "presente|futuro|tesoreria|forecast"` → **0 resultados**. No hay ramas ni commits no mergeados con esos términos en su mensaje.

---

> **STOP.** Auditoría completa. A la espera de Jose para decidir el documento canónico / spec.
