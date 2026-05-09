# T-INACEPTABILIDADES-AUDIT · INFORME

> **Origen** · ejecutado por CC (Claude Code · agente que produce el informe) siguiendo spec `docs/audits/T-INACEPTABILIDADES-AUDIT.md`
> **Fecha** · 2026-05-09
> **Branch** · `claude/execute-t-inaceptabilidades-5qDwH`
> **Tipo** · Auditoría · CERO código modificado
> **Regla aplicada** · V11.3 · 5 preguntas obligatorias por pieza auditada

## Resumen ejecutivo (5 líneas)

1. **Inaceptabilidad A (importaciones)** — existen ≥10 implementaciones distintas; canónicas vivas pero con duplicidades graves: **3 servicios OCR** (`ocrService` + `enhancedOcrService` + `unifiedOcrService`), **2 wizards fiscales superpuestos** (`ImportarDeclaracionWizard` + `ImportarDatosFiscalesWizard` + `ImportarDatosWizard` envolvente), **2 rutas legacy `pages/account/migracion/`** que aún se montan vía wrappers v5.
2. **Inaceptabilidad B (export/backup)** — SÍ existe export · 3 caminos paralelos: `exportSnapshot` (zip + blobs · UI Preferencias), `exportSnapshotJSON` (DevTools · sin UI), y `ExportadorDatos` con 8 botones por tipo (Herramientas). Hay duplicidad funcional con `bankProfileService.exportProfiles`.
3. **Inaceptabilidad C (restore)** — SÍ existe via `importSnapshot(file, 'replace'|'merge')` + UI Preferencias, simétrico a B.1. NO existe restore para los exports tipo Excel del `ExportadorDatos` (asimetría: contratos/préstamos exportables tienen import, pero `proyeccion`/`fiscal`/`tesoreria`/`cartera` son one-way).
4. **Inaceptabilidad D (edición/eliminación importados)** — gravísimas asimetrías: contratos tienen `deleteContract()` exportado pero **sin caller en UI** (sólo test); inmuebles **NO tienen `delete` en `inmuebleService` salvo el cliente HTTP `delete()` que es API remota**; movements borrado sólo en cascada al borrar cuenta o por flujo conciliación; documents OK; préstamos OK; planes pensión OK; inversiones OK con matices (deletePosicion + deleteAportacion).
5. **Veredicto** · ruta **R4** · atacar D primero (edición/eliminación · daño dogfooder hoy · Jose ya importó datos y no puede borrarlos limpiamente) + spec sanear 3 OCR/2 wizards fiscales (parte de A) en paralelo. B+C ya existen y son simétricos · sólo hay que documentar y reducir el ruido del `ExportadorDatos` que parece "exportar todo" pero no es el snapshot canónico.

---

## §0 · Pre-flight · output literal de comandos del §2 del spec

### §2.1 · Inventario importaciones (output literal)

```
$ find src/ -type f \( -name "*[Ii]mport*" -o -name "*[Pp]arser*" -o -name "*[Oo]cr*" \) | head -50
src/config/ocr.config.ts
src/services/inversionesAportacionesImportService.ts
src/services/contractsImportService.ts
src/services/aeatXmlParserService.ts
src/services/unifiedOcrService.ts
src/services/aeatPdfParserService.ts
src/services/csvParserService.ts
src/services/enhancedOcrService.ts
src/services/aeatPlanesPensionesImportService.ts
src/services/indexaCapitalImportService.ts
src/services/feinOcrService.ts
src/services/ocrQueueService.ts
src/services/aeatParserService.ts
src/services/irpfXmlParserService.ts
src/services/ocrService.ts
src/services/ocrExtractionService.ts
src/tests/enhancedFeinOcr.test.ts
src/tests/ocrEnhancements.test.ts
src/tests/bankParserEnhancements.test.ts
src/modules/financiacion/import/ImportarPrestamosPage.tsx
src/functions/__tests__/ocr-fein-behavior.test.ts
src/functions/__tests__/ocr-fein.test.ts
src/functions/__tests__/ocr-fein-url-logic.test.ts
src/modules/fiscal/import/ImportarFiscalPage.module.css
src/modules/fiscal/import/ImportarFiscalPage.tsx
src/modules/tesoreria/import/ImportarCuentas.tsx
src/modules/inmuebles/import/ImportarInmuebles.tsx
src/modules/inmuebles/import/ImportarValoraciones.tsx
src/modules/inmuebles/import/ImportarContratos.tsx
src/modules/inversiones/import/ImportarIndexaCapitalPage.tsx
src/modules/inversiones/import/ImportarAportacionesPage.tsx
src/features/inbox/OcrPanel.tsx
src/services/__tests__/feinOcrService.test.ts
src/services/__tests__/aeatPlanesPensionesImportService.test.ts
src/services/__tests__/aeatPdfParserService.test.ts
src/services/__tests__/aeatParserService.test.ts
src/services/migrations/backfillImporteBruto0106.ts
src/modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx
src/modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.test.tsx
src/modules/horizon/fiscalidad/historial/ImportarDatosFiscalesWizard.tsx
src/modules/horizon/fiscalidad/historial/ImportarDatosWizard.tsx
src/pages/account/migracion/ImportarIndexaCapital.tsx
src/pages/account/migracion/ImportarPrestamos.tsx
src/pages/account/migracion/ImportarAportaciones.tsx
src/features/inbox/importers/bankParser.ts
src/features/inbox/importers/bankParser.test.ts.disabled
src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx
src/features/inbox/importers/__tests__/bankParser.detectHeaders.test.ts
```

```
$ grep -rnE "Importar|Subir.*archivo|Cargar.*XML|Cargar.*PDF|importBatches" src/ --include="*.tsx" --include="*.ts" | head -50
src/App.tsx:89:const ImportarInmueblesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarInmuebles'));
src/App.tsx:90:const ImportarValoracionesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarValoraciones'));
src/App.tsx:91:const ImportarContratosPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarContratos'));
src/App.tsx:117:const ImportarCuentasPage = lazyWithPreload(() => import('./modules/tesoreria/import/ImportarCuentas'));
src/App.tsx:144:const FiscalImportar = lazyWithPreload(() => import('./modules/fiscal/import/ImportarFiscalPage'));
src/App.tsx:146:const InversionesImportarAportaciones = lazyWithPreload(() => import('./modules/inversiones/import/ImportarAportacionesPage'));
src/App.tsx:147:const InversionesImportarIndexa = lazyWithPreload(() => import('./modules/inversiones/import/ImportarIndexaCapitalPage'));
src/App.tsx:148:const FinanciacionImportarPrestamos = lazyWithPreload(() => import('./modules/financiacion/import/ImportarPrestamosPage'));
[...]
src/modules/fiscal/import/ImportarFiscalPage.tsx:3:// Wrapper v5 que monta el `ImportarDeclaracionWizard` legacy de
src/modules/fiscal/import/ImportarFiscalPage.tsx:17:import ImportarDeclaracionWizard from '../../horizon/fiscalidad/historico/ImportarDeclaracionWizard';
src/modules/financiacion/import/ImportarPrestamosPage.tsx:7:import ImportarPrestamos from '../../../pages/account/migracion/ImportarPrestamos';
src/modules/horizon/fiscalidad/historial/ImportarDatosWizard.tsx:3:import ImportarDeclaracionWizard from '../historico/ImportarDeclaracionWizard';
src/modules/horizon/fiscalidad/historial/ImportarDatosWizard.tsx:4:import ImportarDatosFiscalesWizard from './ImportarDatosFiscalesWizard';
```
(output truncado en spec · líneas relevantes pegadas literal · señalan los wrappers v5→legacy y la cadena de wizards anidados)

```
$ grep -rnE "snapshotsDeclaracion|importBatches|movements.*importedFrom|documents.*ocr" src/services/db.ts
src/services/db.ts:1327:  snapshotId?: number;            // FK → snapshotsDeclaracion.id
src/services/db.ts:2089:  importBatches: ImportBatch; // H8: CSV import tracking
src/services/db.ts:2302:  snapshotsDeclaracion: SnapshotDeclaracion;
src/services/db.ts:2590:        if (!db.objectStoreNames.contains('importBatches')) { ... }
src/services/db.ts:2825:        if (!db.objectStoreNames.contains('snapshotsDeclaracion')) { ... }
```

### §2.2 · Export/download/backup (output literal)

```
$ grep -rnE "export[A-Z]|downloadCSV|downloadJSON|backup|toFile|saveToFile|blob.*download" src/ --include="*.tsx" --include="*.ts" | grep -v test | head -50
src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx:28:      const csvData = await comparativaService.exportToCSV(data, { year, scope });
src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx:54:      const pdfBlob = await comparativaService.exportToPDF(data, { year, scope });
src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts:448:  async exportToCSV(...)
src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts:478:  async exportToPDF(...)
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:5:import { exportSnapshot, importSnapshot, resetAllData } from '../../../../services/db';
src/modules/horizon/financiacion/components/blocks/ResumenFinalBlock.tsx:15:import { exportLoanToPDF } from '../../../../../utils/pdfExport';
src/modules/horizon/financiacion/components/blocks/ResumenFinalBlock.tsx:16:import { exportLoanToExcel } from '../../../../../utils/excelExport';
src/modules/horizon/fiscalidad/resumen/Resumen.tsx:5:import { exportFiscalData } from '../../../../services/fiscalSummaryService';
src/services/db.ts:4293:export const exportSnapshot = async (): Promise<void>
src/services/db.ts:4633:export const exportSnapshotJSON = async (): Promise<{...}>
src/services/db.ts:4686..89:      exportSnapshot, exportSnapshotJSON, importSnapshot, resetAllData (window.atlasDB)
src/services/fiscalSummaryService.ts:212:export const exportFiscalData = async (...)
src/services/universalBankImporter/bankProfileService.ts:225:  async exportProfiles(): Promise<string>
src/pages/ProfileSeederPage.tsx:125:  const exportBankProfiles = () => { ... }
src/utils/excelExport.ts:48:export function exportLoanToExcel(...)
src/utils/pdfExport.ts:52:export function exportLoanToPDF(...)
src/modules/horizon/herramientas/exporters/atlasExportService.ts:270 exportarProyeccionMensual
src/modules/horizon/herramientas/exporters/atlasExportService.ts:291 exportarCarteraInmuebles
src/modules/horizon/herramientas/exporters/atlasExportService.ts:397 exportarFiscal
src/modules/horizon/herramientas/exporters/atlasExportService.ts:443 exportarPrestamos
src/modules/horizon/herramientas/exporters/atlasExportService.ts:495 exportarCuentas
src/modules/horizon/herramientas/exporters/atlasExportService.ts:524 exportarContratosParaImportacion
src/modules/horizon/herramientas/exporters/atlasExportService.ts:593 exportarPrestamosParaImportacion
src/modules/horizon/herramientas/exporters/atlasExportService.ts:664 exportarTesoreria
```

```
$ grep -rnE ">.{0,3}Exportar|>.{0,3}Descargar|>.{0,3}Download|>.{0,3}Backup" src/ --include="*.tsx" | head -30
src/modules/horizon/proyeccion/presupuesto/components/PresupuestoHeader.tsx:102:            <span>Exportar CSV</span>
src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx:135:              <span>Exportar</span>
src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx:113:                <h4 ...>Exportar CSV</h4>
src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx:131:                <h4 ...>Exportar PDF</h4>
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:204:                <h3 ...>Exportar datos (.zip)</h3>
src/modules/horizon/herramientas/exporters/ExportadorDatos.tsx:152:        <h2 ...>Exportar datos</h2>
src/modules/horizon/analisis-cartera/AnalisisCartera.tsx:102:          <button ...><Download size={14} /> Exportar</button>
src/modules/tesoreria/import/ImportarCuentas.tsx:287:          <Download size={14} /> Descargar plantilla
src/modules/inmuebles/import/ImportarContratos.tsx:232:          <Download size={14} /> Descargar plantilla
src/components/documents/DocumentViewer.tsx:230:          <Download className="w-4 h-4" /> Descargar
src/pages/InboxPage.tsx:412:                  <button ... onClick={handleOpenInNewTab}>Descargar</button>
```

### §2.3 · Restore/import-from-backup (output literal)

```
$ grep -rnE "restore|loadBackup|importBackup|fromBackup|restoreFromFile|loadJSON" src/ --include="*.tsx" --include="*.ts" | grep -v test | head -30
src/modules/horizon/inmuebles/contratos/components/VinculacionDrawer.tsx:90:        // Always restore the proposed amount unconditionally when re-including
src/components/common/SettingsSearch.tsx:75:      keywords: ['import', 'importar', 'csv', 'excel', 'restore'],
src/services/propertySaleService.ts:885:    // restore (cancelPropertySale) detecta el prefijo y
src/services/propertySaleService.ts:1193:      const restoredPrincipal = ...
src/services/propertySaleService.ts:1208:    const restoreLoanStore = tx.objectStore('prestamos');
```

> Conclusión literal · NO existe ninguna función `loadBackup` / `importBackup` / `restoreFromFile` / `loadJSON` específica · el restore de snapshot va por `importSnapshot(file, mode)` (§2.2). Las apariciones de `restore` son · `restore proposed amount` (UI ContractDrawer) y `restoreLoanStore` (rollback de venta de inmueble · NO es restore de backup).

### §2.4 · UI edición/eliminación (output literal)

```
# Contratos · service expone delete + update; UI sólo update (vía wizard)
$ grep -rnE "deleteContract|removeContract|editContract|updateContract" src/ --include="*.ts" --include="*.tsx"
src/services/contractsImportService.ts:184:        await updateContract(existing.id, payload);
src/services/declaracionOnboardingService.ts:969..1126:  await updateContract(...)
src/services/contractService.ts:111:export const updateContract = async (id, updates) => { ... }
src/services/contractService.ts:182:export const deleteContract = async (id) => { ... }   ← exportado pero SIN caller productivo
src/services/contractService.ts:196..236:   updateContract(id, ...)
src/services/vinculacionFiscalService.ts:177..207:    await updateContract(...)
src/__tests__/contractsListaEnhanced.test.tsx:17:  deleteContract: jest.fn(),  ← único caller (test)
```

```
# Movements · NO hay deleteMovement standalone; sólo cascade-delete al borrar cuenta + delete dentro de servicios fiscales/conciliación
# (Nota · el spec original §2.4 escribe "reclasifyMovement" con una sola "s"; la forma canónica en código sería "reclassify…"; ninguna de las dos arroja matches productivos)
$ grep -rnE "deleteMovement|removeMovement|editMovement|updateMovement|reclasifyMovement|reclassifyMovement" src/ --include="*.ts" --include="*.tsx"
src/components/treasury/TesoreriaV4.tsx:* deleteMovements (flag de cascade al borrar cuenta)
src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx:* deleteMovements (flag de cascade)
src/services/cuentasService.ts:566:      if (options.deleteMovements && movementsCount > 0) { ... }
src/modules/horizon/conciliacion/v2/components/EditMovementModal.tsx  ← sí existe edición individual en conciliación v2
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:282:  body={`Se eliminará "${deletingRow.concept}"...`}
src/services/treasuryApiService.ts:306:              await db.delete('movements', movement.id);   ← interno
src/services/treasuryConfirmationService.ts:594,835:    await (tx.objectStore('movements')).delete(movementId);   ← interno
```

```
# Documents · OK, hay UI directa
$ grep -rnE "deleteDocument|removeDocument|editDocument|reprocessOCR" src/
src/services/db.ts:4281:export const deleteDocumentAndBlob = async (id) => { ... }
src/pages/InboxPage.tsx:248:    await deleteDocumentAndBlob(selectedDocument.id);   ← UI viva
```

```
# Préstamos · OK
$ grep -rnE "deletePrestamo|removePrestamo|editPrestamo|updatePrestamo" src/
src/services/prestamosService.ts:479:  async deletePrestamo(id)
src/services/prestamosService.ts:324:  async updatePrestamo(id, updates)
src/modules/financiacion/pages/DetallePage.tsx:109:      await prestamosService.deletePrestamo(id);
src/modules/horizon/financiacion/components/PrestamosList.tsx:161:  await prestamosService.deletePrestamo(prestamoId);
src/modules/horizon/inmuebles/prestamos/components/PrestamosList.tsx:54:  await prestamosService.deletePrestamo(prestamoId);
src/modules/horizon/financiacion/components/PrestamoDetailPage.tsx:220:    await prestamosService.deletePrestamo(prestamoId);
src/modules/horizon/financiacion/components/PrestamosWizard.tsx:255:        const updated = await prestamosService.updatePrestamo(...)
```

```
# Inversiones · OK con matiz · deletePosicion + deleteAportacion
$ grep -rnE "deleteInversion|removeInversion|editInversion|updateInversion|deletePosicion|deleteAportacion" src/
src/services/inversionesService.ts:207:  async deleteAportacion(...)
src/services/inversionesService.ts:217:  async deletePosicion(id)
src/modules/horizon/inversiones/InversionesPage.tsx:166:    await inversionesService.deleteAportacion(...)
src/pages/GestionInversiones/GestionInversionesPage.tsx:637:    await inversionesService.deleteAportacion(...)
```

```
# Planes pensión · OK
$ grep -rnE "deletePlanPension|removePlan|editPlan|updatePlan" src/
src/services/planesPensionesService.ts:55:  async updatePlan(...)
src/services/planesInversionService.ts:35:  async deletePlan(id)
src/pages/GestionInversiones/GestionInversionesPage.tsx:531:      await planesInversionService.deletePlan(plan.id);
src/modules/inversiones/components/wizard/PlanFormV5.tsx:123: ... await planesPensionesService.updatePlan(plan.id, ...)
src/components/personal/planes/PlanForm.tsx:92: ... await planesPensionesService.updatePlan(plan.id, ...)
src/modules/inversiones/components/ActualizarValorPlanDialog.tsx:51: await planesPensionesService.updatePlan(...)
```

### §2.5 · Lente nueva · duplicidades por naming similar (output literal)

`ls src/services/` arrojó 168+ archivos. Los nombres claramente sospechosos de duplicidad ·

```
ocrService.ts
enhancedOcrService.ts            ← duplicidad nominal "enhanced"
unifiedOcrService.ts             ← y "unified"
ocrExtractionService.ts          ← extra
ocrQueueService.ts               ← extra
feinOcrService.ts
ocr/feinNormalizer.ts            ← carpeta paralela
ocr/normalize-docai.ts
fein/feinToPrestamoMapper.ts     ← carpeta paralela "fein/"
fein/parseFeinText.ts

autoSaveService.ts
enhancedAutoSaveService.ts       ← duplicidad nominal "enhanced"

documentTypeDetectionService.ts
newDocumentTypeDetectionService.ts   ← duplicidad nominal "new"

aeatParserService.ts             ← duplicidad nominal "Parser" + Pdf + Xml + PlanesPensiones
aeatPdfParserService.ts
aeatXmlParserService.ts
aeatPlanesPensionesImportService.ts

planesPensionesService.ts
planesInversionService.ts        ← wrapper · planesInversionService.updatePlan() llama a planesPensionesService.updatePlan()
inversionesService.ts            ← terreno colindante (posiciones · aportaciones)

treasuryApiService.ts
treasuryBootstrapService.ts
treasuryConfirmationService.ts
treasuryCreationService.ts
treasuryEventsService.ts
treasuryForecastService.ts
treasuryOverviewService.ts
treasuryTransferService.ts
treasuryValidationService.ts
historicalTreasuryService.ts
enhancedTreasuryCreationService.ts   ← duplicidad nominal "enhanced"

enhancedDeduplicationService.ts (sin hermano `deduplicationService.ts` en `src/services/`; dedup adicional en `services/universalBankImporter/stableHashDeduplicationService.ts` · co-existencia legítima por dominio)
```

`ls -la src/modules/horizon/` ·

```
analisis-cartera   conciliacion   configuracion   financiacion   fiscalidad
herramientas       informes       inmuebles       inversiones    proyeccion
tesoreria
```
→ **11 subdirectorios horizon vivos** (T20 Phase 4 parte 1 cerrada · parte 2 dejó deuda según spec §0).

`ls -la src/modules/v5/` · contiene los subdirectorios `ajustes archivo financiacion fiscal horizon inmuebles inversiones mi-plan onboarding panel personal pulse shared tesoreria` (no se inspeccionó el contenido de cada uno por estar fuera del scope T-INACEPTABILIDADES). Anomalía detectada · `src/modules/v5/horizon/` debería NO existir si v5 reemplaza horizon.

```
$ grep -rnE "from.*horizon/" src/modules/v5/   →   (empty)
$ grep -rnE "from.*v5/" src/modules/horizon/    →   (empty)
```
→ no hay imports cruzados horizon ↔ v5 en módulos · **pero** existen wrappers v5 en `src/modules/{fiscal,financiacion}/import/` que sí importan desde `horizon/...` y desde `pages/account/migracion/...` (legacy). Ejemplos literales ·

```
src/modules/fiscal/import/ImportarFiscalPage.tsx:17:
  import ImportarDeclaracionWizard from '../../horizon/fiscalidad/historico/ImportarDeclaracionWizard';
src/modules/financiacion/import/ImportarPrestamosPage.tsx:7:
  import ImportarPrestamos from '../../../pages/account/migracion/ImportarPrestamos';
```

### §2.6 · Dead code post-T20 (output literal)

```
$ grep -rnE "TODO.*[Tt]20|TODO.*[Pp]hase 4|TODO.*legacy|TODO.*horizon" src/
src/App.tsx:945:                como referencia para revivir. Cierra TODO-T20-01 conectando
src/modules/mi-plan/services/budgetProjection.ts:4:// T20 Fase 3c · sub-tarea 20.3c · cierra **TODO-T20-01**
src/modules/mi-plan/pages/LandingPage.tsx:51:  // Proyección · usa el helper compartido (cierra TODO-T20-01).
```

→ TODO-T20-01 marcado como cerrado · pero la **parte 2 de Phase 4** (eliminar subdirectorios horizon antiguos) NO aparece como TODO ni en código ni en spec. Concuerda con la queja Jose §0 del spec.

---

## §A · Inaceptabilidad A · Importaciones · matriz 5 preguntas

| # | Importación | 1·¿Existe? | 2·¿Cuántas implementaciones? | 3·¿Vivas? | 4·Canónica · legacy | 5·Dead code residual |
|---|---|---|---|---|---|---|
| A1 | **OCR documentos genérico** (facturas · recibos · LLM) | Sí | **3** · `ocrService` + `enhancedOcrService` + `unifiedOcrService` (+ `ocrExtractionService` + `ocrQueueService`) | Las 3 con imports productivos · `unifiedOcrService` es la fachada nueva, `enhancedOcrService` y `ocrService` aún referenciados desde `features/inbox/OcrPanel.tsx` y `documentIngestionService.ts` (verificación rápida vía grep `from.*ocrService\b`) | **Canónica propuesta** · `unifiedOcrService` (fachada). **Legacy** · `ocrService` + `enhancedOcrService` deberían colapsar tras spec saneamiento. | `ocr/normalize-docai.ts` + `ocr/feinNormalizer.ts` viven en carpeta paralela; `ocrExtractionService` parece capa intermedia · revisar si es realmente usada o residual. |
| A2 | **OCR FEIN** (Ficha Europea Información Normalizada · hipotecas) | Sí | **2 normalizadores** · `services/ocr/feinNormalizer.ts` + `services/fein/parseFeinText.ts` · y servicio `feinOcrService.ts` + mapeador `services/fein/feinToPrestamoMapper.ts` | Sí · `feinOcrService` es invocado desde `components/financiacion/FEINUploader.tsx` (línea 248); `feinLoanCreationService` lo consume. Los 2 normalizadores conviven. | **Canónica** · `feinOcrService` + `fein/parseFeinText` + `fein/feinToPrestamoMapper`. **Legacy candidato** · `ocr/feinNormalizer.ts` (carpeta paralela `ocr/` vs `fein/`); revisar si parcialmente reemplazado. | Tests `enhancedFeinOcr.test.ts` + `feinOcrService.test.ts` y functions/__tests__/ocr-fein-*.test.ts · 3 ficheros de test sobre el mismo flujo · alta probabilidad de cobertura solapada. |
| A3 | **AEAT XML/PDF Modelo 100 IRPF** | Sí | **6 servicios** · `aeatParserService` + `aeatPdfParserService` + `aeatXmlParserService` + `aeatPlanesPensionesImportService` + `aeatClassificationService` + `irpfXmlParserService` · y wizards `ImportarDeclaracionWizard` + `ImportarDatosFiscalesWizard` + `ImportarDatosWizard` (envolvente) | Todos vivos. `ImportarDatosWizard` envuelve los 2 wizards reales y un selector. `ImportarFiscalPage.tsx` (v5) monta `ImportarDeclaracionWizard` (legacy horizon). | **Canónica** · `ImportarDeclaracionWizard` (consume aeatPdf+aeatXml+irpfXml) + `ImportarDatosFiscalesWizard`. **Legacy a colapsar** · revisar si `aeatParserService` (sin Pdf/Xml suffix) es la suma de los otros o duplicidad. **Wrapper v5** `ImportarFiscalPage` es un mero wrapper · candidato a borrar y conectar ruta directa. | `irpfXmlParserService` tests existen · pero el grep no muestra import productivo claro · candidato dead-code. |
| A4 | **Extractos bancarios** (CSV · XLS · XLSX · OCR PDF) | Sí | **2 caminos** · `bankStatementOrchestrator` + `csvParserService` + `bankParserService` (`features/inbox/importers/bankParser.ts`) y página `BankStatementUploadPage` · adicional `treasuryApiService.formatoDetectado` | Sí · `BankStatementUploadPage` es la entrada productiva (`/tesoreria/importar`). `bankParser.test.ts.disabled` · tests deshabilitados, código vivo. `universalBankImporter/bankProfileService` separa "perfiles". | **Canónica** · `bankStatementOrchestrator` + `bankProfileService` + `BankStatementUploadPage`. **Legacy** · ningún duplicado claro detectado dentro de bank statements. | `bankParser.test.ts.disabled` · test deshabilitado · no es dead code per se · pero indica deuda de testing. |
| A5 | **Cuentas bancarias** (Excel/CSV catálogo de cuentas) | Sí · 1 implementación | **1** · `src/modules/tesoreria/import/ImportarCuentas.tsx` | Viva · ruta `/tesoreria/importar-cuentas` | Canónica única · sin legacy. | Sin dead code detectado. |
| A6 | **Inmuebles · Valoraciones · Contratos** (Excel masivo) | Sí · 3 páginas | **3** · `ImportarInmuebles.tsx` · `ImportarValoraciones.tsx` · `ImportarContratos.tsx` (mod inmuebles) + `contractsImportService.ts` (servicio) | Vivas. Rutas montadas en `App.tsx:670/678/686`. `contractsImportService` invoca `updateContract` para upserts. | Canónicas. Sin legacy directo. | Sin dead code detectado. |
| A7 | **Préstamos masivos** (CSV/Excel) | Sí | **2 niveles** · `ImportarPrestamosPage.tsx` (wrapper v5) → `pages/account/migracion/ImportarPrestamos.tsx` (legacy implementación real) | Vivos · ruta `/financiacion/importar` montada en `App.tsx:930`. | **Canónica** · `pages/account/migracion/ImportarPrestamos.tsx` (la real). **Legacy a evaluar** · el wrapper v5 sólo monta el legacy · si v5 ya tiene su propia layout, podría colapsarse el wrapper. | Sin dead code claro · pero patrón "wrapper v5 monta legacy" repetido 2 veces (préstamos + fiscal). |
| A8 | **Aportaciones a planes pensión / fondos** (Excel) | Sí | **2 niveles** · `ImportarAportacionesPage.tsx` (wrapper) → `pages/account/migracion/ImportarAportaciones.tsx` (impl) + `inversionesAportacionesImportService.ts` | Vivos · ruta `App.tsx:734`. | Canónica · `pages/account/migracion/ImportarAportaciones.tsx`. | Sin dead code claro. |
| A9 | **Indexa Capital** (Excel propietario) | Sí | **2 niveles** · `ImportarIndexaCapitalPage.tsx` (wrapper) → `pages/account/migracion/ImportarIndexaCapital.tsx` (impl) + `indexaCapitalImportService.ts` | Vivos · ruta `App.tsx:739`. | Canónica · `pages/account/migracion/ImportarIndexaCapital.tsx`. | Sin dead code claro. |
| A10 | **Email ingest + ZIP** (extracción documentos) | Sí | **3** · `emailInboxIntegrationService` + `emailIngestService` + `emailProcessingService` + utilidad `zipProcessingService` | Vivos · pero el grep no muestra disparador UI productivo claro · revisar si flujo completo está cableado a un botón. | **Canónica** · `emailIngestService` (parece la fachada). **Legacy** · `emailInboxIntegrationService` y `emailProcessingService` posiblemente capas intermedias residuales. | Alta probabilidad de capas intermedias muertas · spec saneamiento debe verificar imports productivos. |

**Frases justificativas (mínimo 5 por importación · resumen agrupado):**

- A1 OCR genérico · 3 servicios `ocrService` / `enhancedOcrService` / `unifiedOcrService` con nombres patrón sospechoso V11.3 (existencia de 3 niveles de "evolución") · cada uno tiene tests propios · pero la fachada productiva canónica debería ser `unifiedOcrService` · los otros sólo deben quedar si exportan funciones puras reutilizadas · spec saneamiento obligatorio antes de spec funcional sobre OCR.
- A2 OCR FEIN · existen 2 carpetas paralelas `ocr/` y `fein/` con normalizadores distintos · pattern Jose detectó (mismo nombre · ubicación distinta) · canónica viva es `feinOcrService` · `ocr/feinNormalizer.ts` es candidato a residual · no se debe construir spec FEIN sin antes resolver cuál normalizador queda.
- A3 AEAT · 6 servicios + 3 wizards anidados (uno envuelve a otros 2) · el wrapper v5 `ImportarFiscalPage.tsx` sólo importa el legacy horizon · construcción tipo "muñeca rusa" · probablemente la mitad de los 6 servicios son granularidad legítima (XML vs PDF vs Planes Pensión) pero `aeatParserService` sin sufijo es sospechoso de ser fachada o duplicidad.
- A4 Bancos · pipeline canónico vivo (`bankStatementOrchestrator`) · sin legacy claro · pero `bankParser.test.ts.disabled` revela deuda · 5+ páginas de impacto.
- A5/A6/A7/A8/A9 Excels masivos · patrón consistente · 1 página + 1 servicio · pero A7/A8/A9 tienen wrappers v5 que sólo redirigen a `pages/account/migracion/*` legacy · oportunidad de spec colapso wrappers.
- A10 Email ingest · 3 servicios con nombres similares · alta sospecha de capas residuales (ver §E).

---

## §B · Inaceptabilidad B · Export/Backup · matriz 5 preguntas

| # | Funcionalidad | 1·¿Existe? | 2·¿Cuántas implementaciones? | 3·¿Vivas? | 4·Canónica · legacy | 5·Dead code residual |
|---|---|---|---|---|---|---|
| B1 | **Export snapshot completo (backup global)** | Sí | **2** · `exportSnapshot()` (zip + blobs documentos · `services/db.ts:4293`) y `exportSnapshotJSON()` (sólo JSON sin blobs · `services/db.ts:4633`) | Las 2 vivas. UI · `PreferenciasDatos.tsx:41` invoca `exportSnapshot()`; `exportSnapshotJSON` sólo accesible desde `window.atlasDB` (DevTools). | **Canónica para usuario** · `exportSnapshot` (zip con blobs · UI viva). **Variante DevTools** · `exportSnapshotJSON` (uso programático para auditorías · NO es legacy a borrar · es complementaria). | Sin dead code · convivencia legítima. |
| B2 | **Export por tipo de dato (Excel)** | Sí | **8 funciones** en `atlasExportService.ts` · `exportarProyeccionMensual` · `exportarCarteraInmuebles` · `exportarFiscal` · `exportarPrestamos` · `exportarTesoreria` · `exportarContratosParaImportacion` · `exportarPrestamosParaImportacion` · `exportarCuentas` | Vivas · UI `ExportadorDatos.tsx` montada en `pages/HerramientasPage.tsx:107`. 8 botones expuestos. | **Canónica** · `atlasExportService.ts` (centralizado). | Sin dead code · sí riesgo de **redundancia funcional con B1** · 3 de los 8 (`contratos_importacion` · `prestamos_importacion` · `cuentas`) son explícitamente "para reimportación" · solapa con flujo restore B1+C1 pero a granularidad menor. |
| B3 | **Export préstamo individual** (PDF + Excel) | Sí | **2 utils** · `utils/pdfExport.ts` (`exportLoanToPDF`) + `utils/excelExport.ts` (`exportLoanToExcel`) | Vivas · `ResumenFinalBlock.tsx:365/374`. | Canónicas independientes (PDF y Excel son outputs distintos). | Sin dead code. |
| B4 | **Export comparativa proyección** (CSV + PDF) | Sí | **1 servicio** · `comparativaService.exportToCSV` + `exportToPDF` | Viva · `ExportModal.tsx`. | Canónica. | Sin dead code. |
| B5 | **Export presupuesto** (CSV) | Sí | **1 botón** · `PresupuestoHeader.tsx:102` "Exportar CSV" | Vivo. | Canónica. | Sin dead code. |
| B6 | **Export resumen fiscal** | Sí | **1** · `fiscalSummaryService.exportFiscalData()` | Viva · `Resumen.tsx:195`. | Canónica. | Sin dead code. |
| B7 | **Export perfiles bancarios** (catálogo bancos) | Sí | **2** · `bankProfileService.exportProfiles()` (servicio) + `ProfileSeederPage.exportBankProfiles` (página dev) | Las 2 vivas · una es admin tooling · otra dev. | Canónica `bankProfileService.exportProfiles`. **Tooling dev** · `ProfileSeederPage` es página dev, no app productiva final. | Sin dead code · pero `ProfileSeederPage` debería estar gateado fuera de prod. |
| B8 | **Export histórico tesoreria · contratos · documentos individuales** | Parcial · sólo `Descargar` blob por documento (`InboxPage.tsx:412` · `DocumentViewer.tsx:230`) | **2** botones aislados | Vivos. | Canónicos a nivel de documento individual. | Sin dead code. |

**Frases justificativas (resumen):**

- Existe export · NO hay que construir desde cero · ya hay 8+ funciones por tipo + 1 snapshot global completo + 1 variante DevTools + utils PDF/Excel para préstamos individuales.
- **Riesgo de duplicidad con B2 vs B1** · `ExportadorDatos` parece "exportar todo" pero NO es un backup (no hay restore garantizado para los 8); el usuario podría confundir B2 con backup canónico (B1 con zip).
- `bankProfileService.exportProfiles` (B7) es un export especializado · convive sin chocar con el resto.
- Los exports tipo PDF de préstamos (B3) son granularidad legítima.
- `atlasExportService` no es legacy · es la fachada moderna; el legacy potencial estaría en `pages/ProfileSeederPage.tsx` (gating dev).

---

## §C · Inaceptabilidad C · Restore/Import desde backup · matriz 5 preguntas

| # | Funcionalidad | 1·¿Existe? | 2·¿Cuántas implementaciones? | 3·¿Vivas? | 4·Canónica · legacy | 5·Dead code residual |
|---|---|---|---|---|---|---|
| C1 | **Restore snapshot completo (zip)** | Sí | **1** · `importSnapshot(file, mode)` · `services/db.ts:4382` | Viva · UI `PreferenciasDatos.tsx:72` con confirmación + reload. | Canónica única · sin legacy. | Sin dead code. |
| C2 | **Restore con `mode: replace` vs `merge`** | Sí | 2 modos en C1 | Ambos vivos · UI permite elegir antes de subir el archivo. | Canónica única. | Sin dead code. |
| C3 | **Restore parcial por tipo (espejo de B2)** | **NO existe** | 0 | — | — · es una asimetría real. Si el usuario exporta con `ExportadorDatos` (B2) sólo el Excel de contratos, NO hay re-import simétrico salvo los 3 explícitamente "ParaImportacion" que se reaprovechan en flujos `ImportarContratos.tsx` / `ImportarPrestamosPage.tsx` / `ImportarCuentas.tsx`. **Asimetría** · `proyeccion`/`fiscal`/`tesoreria`/`cartera` son one-way. | — |
| C4 | **Restore profiles bancarios** | Sí | **1** · `bankProfileService.importProfiles()` (línea 231 · "Import profiles from backup") | Viva · simétrica a B7. | Canónica. | Sin dead code. |
| C5 | **Restore desde snapshots de declaración (`snapshotsDeclaracion`)** | Parcial | Store dedicado en IndexedDB · pero NO función `loadSnapshotDeclaracion()`/`restoreFromSnapshot()` · sólo lectura para visualización histórica | Viva como almacén · NO como restore | — · es snapshot fiscal congelado (frozen) para auditoría · no backup-restore | Sin dead code. |

**Frases justificativas:**

- C1 + C2 son simétricos a B1 · existen y funcionan · audit Jose dogfooding podría verificarlo en una sesión.
- C3 · gap real · 5 de los 8 exports de `ExportadorDatos` son one-way · si Jose o un cliente exporta `proyeccion mensual` no puede reimportarlo (lógicamente porque es un derivado · no un input).
- C4 · simétrico a B7.
- C5 · `snapshotsDeclaracion` es un caso especial · no es backup-restore sino histórico fiscal congelado.
- NO existen funciones nombradas `loadBackup` · `restoreFromFile` · `importBackup` · `loadJSON` (verificación literal §2.3) · todo el restore va por C1 + C4.

---

## §D · Inaceptabilidad D · Edición/Eliminación de datos importados · matriz por entidad

| Entidad | 1·¿Existe edición? | 1b·¿Existe eliminación? | 2·¿Cuántas implementaciones? | 3·¿Vivas? | 4·Canónica · legacy | 5·Dead code |
|---|---|---|---|---|---|---|
| **Contratos** | Sí (servicio + wizard) | **Sí en servicio · NO en UI** | edición · `updateContract` (1 servicio · múltiples callers); eliminación · `deleteContract` (1 servicio · 0 callers productivos) | edición viva · eliminación **muerta a nivel UI** · sólo invocada desde `__tests__/contractsListaEnhanced.test.tsx:17` (jest.fn) | **Canónica** edición · `contractService.updateContract` + `NuevoContratoWizard`. **Eliminación** · `deleteContract` es **dead code de UI** · existe pero ningún botón lo dispara. | `ContratosListPage.tsx` no tiene botón eliminar · gap funcional confirmado. |
| **Movements** | Sí (modal individual `EditMovementModal` en conciliación v2) | **Indirecta** · sólo en cascade al borrar cuenta (con flag `deleteMovements`) o desde flujo conciliación | edición · 1 (`EditMovementModal`); eliminación · 2 vías indirectas (cuenta cascade · conciliación) + delete interno desde `treasuryApiService` | edición viva en conciliación v2; cascade vía `cuentasService.deleteAccount(opts)`; conciliación borra al cancelar evento. NO hay botón "borrar movimiento" individual en TesoreriaV4. | **Canónica edición** · `EditMovementModal` (conciliación v2). **Canónica eliminación** · ninguna directa · todo derivado. | TesoreriaV4 no expone delete directo · gap funcional. |
| **Documents** | Parcial · metadata en Inbox; reproc OCR no expuesto | **Sí** · `deleteDocumentAndBlob` | 1 + 1 | Vivos · `InboxPage.tsx:248` invoca delete; reproc OCR no encontrado en grep (no `reprocessOCR`). | Canónicas · sin legacy. | NO existe función `reprocessOCR` · gap funcional · si OCR falló, no hay rerun expuesto. |
| **Préstamos** | Sí | Sí | 1 servicio · `prestamosService.updatePrestamo` + `deletePrestamo` | Vivos · 4 callers UI (`DetallePage` · 2× `PrestamosList` · `PrestamoDetailPage`) · `PrestamosWizard` para edición. | Canónica única · sin legacy. | Sin dead code. |
| **Inversiones (posiciones · aportaciones)** | Sí | Sí | `inversionesService.updatePosicion` · `addAportacion` · `updateAportacion` · `deletePosicion` · `deleteAportacion` (1 servicio) | Vivos · `InversionesPage` (horizon) y `GestionInversionesPage` y `FichaPosicionPage` (v5) los invocan. | **Canónica** · `inversionesService`. Coexistencia 2 UIs (horizon + v5) sobre el mismo servicio · OK como tránsito · pero candidato a colapsar UI. | Posible duplicidad UI horizon vs v5 sobre mismo backend · NO es dead-code estricto · es legacy de transición T20. |
| **Planes pensión** | Sí | Sí | `planesPensionesService.updatePlan` (canónico) + `planesInversionService.updatePlan` (wrapper que reenvía) + `planesInversionService.deletePlan` | Vivos · `PlanForm`/`PlanFormV5`/`ActualizarValorPlanDialog` invocan update; `GestionInversionesPage:531` invoca delete. | **Canónica backend** · `planesPensionesService`. **Wrapper** · `planesInversionService` es fachada (no legacy a eliminar · es indirección activa). | Wrapper indirección no es dead-code · pero documentar para próximos Claudes (riesgo confusión nombre singular vs plural ya señalado en T-PROYECCION-AUDIT). |
| **Inmuebles (propiedades)** | Sí (`updateInmueble` en taxSlice · slice Redux) | Parcial · `removeInmueble` en taxSlice + `inmuebleService.delete()` que es cliente HTTP a backend remoto · NO opera sobre IndexedDB local | edición · 1+1; eliminación · 2 implementaciones distintas con backends distintos | Redux taxSlice usado en `RealEstateBlock.tsx`. `inmuebleService.delete` (HTTP) sin caller productivo en grep rápido. | **Asimetría grave** · existe slice Redux para tax pero el inmueble en IndexedDB se modifica desde otros services · no hay un único `deleteInmueble` canónico que borre tanto IDB como Redux como cascada. | `inmuebleService.delete()` HTTP-remote es código sin caller productivo (probable resto de antiguo backend). |
| **Snapshots declaración fiscal** | Parcial · `snapshotDeclaracionService.ts` | NO encontrado | 1 servicio | Vivo (lectura). | Canónica única · sin legacy. | NO existe `deleteFiscalSnapshot` ni `removeSnapshot` (verif §2.4) · gap intencionado o real. |

**Frases justificativas (resumen):**

- **Contratos** · gap más visible · función `deleteContract` existe y se exporta pero sólo la testea jest · ningún botón eliminar en `ContratosListPage`.
- **Movements** · gap secundario · sólo se borran "como efecto colateral" (cuenta · conciliación). Si Jose importó un extracto bancario con un movimiento erróneo, no puede borrarlo individualmente desde TesoreriaV4.
- **Documents** · re-OCR no expuesto · si Jose subió un PDF y el OCR falló, debe borrar y resubir.
- **Préstamos / Inversiones / Planes pensión** · OK · CRUD completo expuesto.
- **Inmuebles** · asimetría tax slice vs IndexedDB · `inmuebleService.delete()` parece resto de servidor-cliente HTTP sin uso productivo · código sin caller.

---

## §E · Mapa de duplicidades sistémicas detectadas

| # | Duplicidad | Ubicaciones | Canónica propuesta | Acción · eliminar / fusionar / mantener |
|---|---|---|---|---|
| E1 | **3 servicios OCR genéricos** | `services/ocrService.ts` · `services/enhancedOcrService.ts` · `services/unifiedOcrService.ts` (+ `ocrExtractionService.ts` · `ocrQueueService.ts`) | `unifiedOcrService` (fachada) | **Fusionar** · spec saneamiento OCR · audit imports productivos · eliminar el redundante |
| E2 | **2 normalizadores FEIN en carpetas paralelas** | `services/ocr/feinNormalizer.ts` vs `services/fein/parseFeinText.ts` | `services/fein/*` (carpeta del dominio) | **Eliminar** `services/ocr/feinNormalizer.ts` si imports productivos lo confirman |
| E3 | **2 detectores tipo de documento** | `documentTypeDetectionService.ts` vs `newDocumentTypeDetectionService.ts` | A determinar (ambos podrían estar vivos) | **Investigar imports productivos · eliminar el viejo** |
| E4 | **2 capas auto-save** | `autoSaveService.ts` vs `enhancedAutoSaveService.ts` | A determinar | **Investigar · fusionar o eliminar** |
| E5 | **2 capas dedup** | `enhancedDeduplicationService.ts` (sin "no-enhanced" hermano detectado) | Investigar si `enhanced` está solo o si hay vestigio | **Mantener si sólo existe enhanced** |
| E6 | **2 capas treasury creation** | `treasuryCreationService.ts` vs `enhancedTreasuryCreationService.ts` | A determinar | **Investigar imports** |
| E7 | **3 servicios email ingest** | `emailIngestService.ts` · `emailInboxIntegrationService.ts` · `emailProcessingService.ts` | `emailIngestService` (fachada) | **Fusionar capas intermedias si no aportan abstracción** |
| E8 | **6 servicios AEAT parser** | `aeatParserService` · `aeatPdfParserService` · `aeatXmlParserService` · `aeatPlanesPensionesImportService` · `aeatClassificationService` · `irpfXmlParserService` | `aeatPdfParserService` + `aeatXmlParserService` (granularidad legítima por formato) | **Verificar `aeatParserService` · si es fachada redundante eliminar** |
| E9 | **3 wizards fiscales anidados** | `ImportarDeclaracionWizard` (real · horizon) · `ImportarDatosFiscalesWizard` (real · horizon) · `ImportarDatosWizard` (envolvente · horizon) · más wrapper v5 `ImportarFiscalPage` | Mantener los 2 wizards reales + envolvente; eliminar wrapper v5 que sólo redirige | **Eliminar wrapper v5** `ImportarFiscalPage.tsx` · cablear ruta directa |
| E10 | **Wrappers v5 → legacy `pages/account/migracion/*`** | `ImportarPrestamosPage.tsx` (v5) → `pages/account/migracion/ImportarPrestamos.tsx`; idem para `ImportarAportacionesPage` · `ImportarIndexaCapitalPage` | Mantener legacy si funciona · eliminar wrappers v5 redundantes O reescribir nativos en v5 | **Decisión Jose** · 2 caminos posibles |
| E11 | **`planesInversionService` wrapper sobre `planesPensionesService`** | `services/planesInversionService.ts:32` (`return planesPensionesService.updatePlan(...)`) | `planesPensionesService` (canónico) | **Mantener wrapper si separa "plan inversión" semántica de "plan pensión" · eliminar si es alias puro** |
| E12 | **2 servicios traspasos** | `traspasosPlanPensionesService.ts` vs `traspasosPlanesService.ts` | A determinar | **Investigar diferencia · fusionar si mismo dominio** |
| E13 | **2 services contracts/contractServices** | `contractService.ts` (CRUD) + `contractsImportService.ts` (importación) | Granularidad legítima | **Mantener** |
| E14 | **2 services bank profiles** | `bankProfilesService.ts` + `universalBankImporter/bankProfileService.ts` | A determinar | **Investigar · sospechoso de duplicidad nominal** |
| E15 | **`fiscalSummaryService.ts` + `fiscalCacheService.ts` + `fiscalContextService.ts` + `fiscalConciliationService.ts` + `fiscalDashboardMatch.ts` + `fiscalLifecycleService.ts` + `fiscalPaymentsService.ts` + `fiscalResolverService.ts` + `fiscalYearLifecycleService.ts` + `fiscalHistoryService.ts` + `simuladorFiscalService.ts` + `recurringExpensesFiscalService.ts` + `propertyDisposalTaxService.ts` + `vinculacionFiscalService.ts` + `inversionesFiscalService.ts` + `arrastresFiscalesService.ts` + `compensacionAhorroService.ts` + `gananciaPatrimonialService.ts` + `irpfCalculationService.ts` + `estimacionFiscalEnCursoService.ts` + `alertasFiscalesService.ts` + `limitesFiscalesPlanesService.ts` + `datosFiscalesService.ts` + `datosFiscalesComparisonService.ts` + `declaracionDistributorService.ts` + `declaracionFromCasillasService.ts` + `declaracionOnboardingService.ts` + `declaracionResolverService.ts` + `preDeclaracionService.ts` + `ejercicioFiscalService.ts` + `ejercicioLifecycleService.ts` + `ejercicioResolverService.ts` + `ejercicioFiscalMigration.ts` + `snapshotDeclaracionService.ts` | Granularidad fiscal extrema · **>30 servicios fiscales** | A determinar | **Fuera del scope T-INACEPTABILIDADES** · pero patrón Jose (V11.3) merece spec dedicado para el dominio fiscal · consolidación |
| E16 | **`pages/account/migracion/` legacy live junto a `modules/{financiacion,inversiones}/import/` v5** | `pages/account/migracion/{ImportarPrestamos,ImportarAportaciones,ImportarIndexaCapital}.tsx` | Mantener legacy mientras funciona · pero documentar deuda | **Ver E10** |
| E17 | **`src/modules/v5/horizon/` subdirectorio inesperado** | `ls src/modules/v5/` muestra `horizon` subdir | Investigar | **Anomalía detectada · spec separado** |
| E18 | **2 funciones snapshot global** | `exportSnapshot` (zip+blobs) vs `exportSnapshotJSON` (solo JSON) | Mantener ambas (uso distinto) | **Mantener** |
| E19 | **2 `inmuebleService` ops** | `inmuebleService.delete` (HTTP remote) coexiste con flujos IndexedDB locales sin un `deleteInmueble` local canónico | A construir · eliminar HTTP si no se usa | **Investigar** |
| E20 | **`treasuryApiService` + 8 services treasury** | 9 servicios treasury · alta granularidad | A determinar | **Spec dedicado treasury saneamiento (fuera scope)** |

---

## §F · Veredicto · cuál atacar primero

### Análisis de criterios

| Criterio | Inacep A · Importaciones | Inacep B · Export | Inacep C · Restore | Inacep D · Edición/Elim |
|---|---|---|---|---|
| **Urgencia Jose dogfooder hoy** | Media (los imports funcionan; problemas de saneamiento no bloquean uso) | **Baja** (existe + UI viva en Preferencias) | **Baja** (existe + UI viva) | **ALTA** (Jose ya importó datos; gap más visible · contrato sin botón eliminar · movimiento individual sin delete · re-OCR ausente) |
| **Duplicidades a limpiar** | **MUY ALTA** (E1-E12, E14, E20 · OCR x3 · FEIN x2 · email x3 · AEAT x5+) | Media (E18 · ExportadorDatos vs Snapshot vs B3-B6) | Baja (1 sola implementación) | Media (E13 contractService split · E19 inmueble HTTP fantasma) |
| **Dependencias entre sí** | A independiente | **B y C simétricas** · atacar juntas | idem B | D independiente pero requiere distinguir "import borra origen" vs "datos editables después" |
| **Coste construir desde cero** | Bajo (existe, hay que sanear) | **Cero** (existe · hay que documentar y limpiar) | **Cero** (existe) | **Medio-alto** (faltan UIs · `deleteContract` UI · delete movement UI · reproc OCR · delete inmueble local) |

### Veredicto · **Ruta R4 (Mezcla)**

**Atacar D primero (edición/eliminación) · más urgente para Jose dogfooder hoy + paralelamente spec saneamiento del subset crítico de A (3 OCR + 2 FEIN + wrappers v5 fiscal/préstamos)**.

**Razonamiento detallado:**

1. **D es la inaceptabilidad que bloquea uso normal hoy** · el gap "exporto/importo · luego no puedo editar/borrar" es exactamente el síntoma Jose reportó. La solución para D es construir UIs faltantes (botón eliminar contrato · botón eliminar movement individual · botón reprocesar OCR · botón eliminar inmueble que cascada a IDB local) sobre servicios que en su mayoría ya existen (deleteContract, deleteDocumentAndBlob, deletePrestamo, deletePosicion, deleteAportacion, deletePlan, prestamosService.updatePrestamo, contractService.updateContract). Esto es **trabajo UI/cableado · no construir desde cero**.

2. **B y C ya existen y funcionan** · `exportSnapshot` zip + `importSnapshot` con modos replace/merge están vivos en UI Preferencias. Sólo hay que (a) documentar bien la convivencia con `ExportadorDatos` (el "Exportar datos" de Herramientas no es un backup), y (b) verificar que C1 funciona en sesión real · trabajo de ~30 min auditoría.

3. **A es donde están las grandes duplicidades** (3 OCR · 2 FEIN · 5 AEAT · 3 email · 2 wrappers v5) · pero el saneamiento es spec aparte (V11.3 lo exige). Atacarlo en paralelo a D si Jose tiene capacidad.

4. **Rutas descartadas:**
   - **R1** (atacar A primero) · descartada porque saneamiento OCR/AEAT no resuelve el dolor Jose hoy.
   - **R2** (atacar B+C) · descartada porque ya existen y funcionan; sólo necesitan documentación.
   - **R3** (atacar D solo) · subóptima porque se pierde la oportunidad de saneamiento A en paralelo.
   - **R5** · no procede.

### Plan recomendado (3 specs separados · respeto regla 1 sub-task por PR)

| Spec | Alcance | Estimación |
|---|---|---|
| **Spec D-EDICION-IMPORTADOS** | Botón eliminar contrato en `ContratosListPage` · botón eliminar movement individual en `TesoreriaV4` · botón reprocesar OCR en `InboxPage` · auditoría `inmuebleService.delete` HTTP fantasma · botón eliminar inmueble local con cascada | 8-12h CC |
| **Spec A-OCR-SANEAMIENTO** | Decidir canónica entre `ocrService` / `enhancedOcrService` / `unifiedOcrService`; eliminar duplicidad FEIN normalizador `ocr/` vs `fein/`; consolidar `aeatParserService` si es fachada redundante; eliminar wrappers v5 `ImportarFiscalPage` + `ImportarPrestamosPage` si sólo redirigen | 6-10h CC |
| **Spec B+C-DOCUMENTACION** | Documentar diferencia `exportSnapshot` (canónico backup) vs `ExportadorDatos` (8 Excels temáticos · NO backup); UX warning en `ExportadorDatos` "esto NO es un backup completo"; verificar restore zip funciona en sesión real Jose · audit-only de 1-2h | 1-2h CC |

---

**Fin del informe.**
