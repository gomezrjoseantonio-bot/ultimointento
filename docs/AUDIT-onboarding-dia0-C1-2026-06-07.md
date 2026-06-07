# AUDIT · Onboarding día 0 · Commit 1 (verificación §0.3)

> **Tarea** · CC · Onboarding día 0 · alta guiada de la foto actual (hueco 5.1)
> **Fecha** · 2026-06-07 · **Rama** · `claude/relaxed-thompson-kZoko`
> **Alcance C1** · CERO código · solo grep §0.3 + reporte §0.4. Este doc es el contenido para la PR description.

## Tabla de las 10 verificaciones

| # | Verificación | Resultado | Path:líneas | Implicación C2-8 |
|---|---|---|---|---|
| 1 | `DB_VERSION` + schema Property (adquisición) | **DB_VERSION = 78**. `onerosoAcquisition` existe con solo `acquisitionAmount` + `acquisitionExpenses`. NO existen `aportacionPropia` / `importeFinanciado` / `prestamoVinculadoId`. | `db.ts:32` (versión) · `db.ts:181-184` (onerosoAcquisition) | **C2** · bump a **79**. Añadir los 3 campos opcionales dentro de `onerosoAcquisition`. Migración no destructiva (opcionales). Coherente con §3.1. |
| 2 | ¿Existe ruta/página onboarding o `/empezar`? | **NO existe `/empezar`.** Existe `/onboarding` (thin shell welcome+hub que solo redirige a importadores existentes, mockup viejo `atlas-onboarding.html`). Existen además `declaracionOnboardingService.ts` (1460 ln) + `personalOnboardingService.ts` = onboarding **del PASADO** (import AEAT XML/TXT, `declararEjercicio`, arrastres). | `App.tsx:89,701` · `modules/onboarding/OnboardingPage.tsx` · `services/declaracionOnboardingService.ts` · `services/personalOnboardingService.ts` | **C3** · `/empezar` es ruta nueva (no choca). `declaracionOnboardingService` es PASADO → **PROHIBIDO tocar/reutilizar** (§1). Ver ⚠️ D2 sobre coexistencia `/onboarding`. |
| 3 | Persistencia de progreso (keyval) | Store `keyval` existe y es el patrón vigente. API: `db.put('keyval', value, key)` / `db.get('keyval', key)`. Usado por matchingConfig, kpiConfig, migraciones. | `db.ts:2276,2386+` · `budgetMatchingService.ts:62,75` · `migrationService.ts:31,92` | **C2/C3** · usar `keyval['onboarding_v1']` y `keyval['onboarding_v1_descartes']`. **Sin store nuevo** ✓. |
| 4 | Naturaleza exacta del bug `openingBalance` | **Causa exacta** · `fondosService.getSaldoCuenta` devuelve `cuenta.openingBalance ?? 0` directo, **sin calcular el saldo real**. El patrón canónico correcto está en `getCurrentSaldoCuenta.ts` (usa `calculateAccountBalanceAtDate` + `cuentasService.list`). Documentado pero NO arreglado. | **Bug** · `fondosService.ts:24-36` · **Patrón correcto** · `getCurrentSaldoCuenta.ts:1-21` · `accountBalanceService.calculateAccountBalanceAtDate` | **C4** · FIX = `getSaldoCuenta` debe calcular saldo vía `accountBalanceService` (o reutilizar `loadSaldosActualesCuentas`), NO leer `openingBalance` crudo. Test de regresión sobre este caso. Fix dirigido, NO a ciegas. |
| 5 | Base de detección / patrones existente | `compromisosRecurrentesService` **NO genera sugerencias** (solo expande patrones: `expandirPatron`/`calcularImporte` de `patronCalendario`). **NO hay base de sugerencias preexistente → NO choca** (condición STOP §2.4 no se cumple). Learning rules: `movementLearningService` (`createOrUpdateRule`, `applyAllRulesOnImport`, `listRules`) + `movementSuggestionService` + store `movementLearningRules`. | `compromisosRecurrentesService.ts:27,286,408` · `movementLearningService.ts:103,149,240,324,335` · `movementSuggestionService.ts` | **C5** · `onboardingDetectionService` es **nuevo** (no duplica nada). Confirmar = crear entidad + `createOrUpdateRule`. Descartar = `keyval['onboarding_v1_descartes']` + regla negativa. **Procede sin STOP.** |
| 6 | Plantilla contratos · patrón completo | Patrón completo presente: `atlasTemplateParserService.ts` (`parseAtlasTemplateXlsx`, `validateAtlasTemplateHeader`, `AtlasTemplateRow`, `AtlasTemplateFormatError`) + `plantilla-contratos-atlas.xlsx` en `public/templates/` + `contractDraftService` + `contractImportCreationService` (revisión antes de crear). Lib `xlsx ^0.18.5` disponible. | `atlasTemplateParserService.ts:13,29,66,119` · `public/templates/plantilla-contratos-atlas.xlsx` · `package.json:47` | **C4/C6** · replicar EXACTO el patrón (parser + revisión + multi-fila) para `plantilla-inmuebles`, `plantilla-prestamos`, `plantilla-inversiones`. |
| 7 | Vínculo préstamo ↔ inmueble actual | Préstamo ya tiene `inmuebleId?: string` + `afectacionesInmueble[]` (% afectación) + `destinos[].inmuebleId`. **⚠️ `Prestamo.id` es `string` (uuid)**, no number. `Property.id` es `number`. | `types/prestamos.ts:8,17,42,62,220` · `db.ts` Property `id?: number` (l.65) · `datosFiscalesService.ts:21,35` | **C2/C6** · ver ⚠️ **D1**: §3.1 pide `prestamoVinculadoId?: number` pero los préstamos usan id `string`. **Requiere decisión de Jose.** |
| 8 | Panel · estructura de cards para el widget | Panel real en `modules/panel/PanelPage.tsx` + cards (`PulsoDelMes`, `AttentionList`, `MiPlanCompass`, `PulseAssetCard`, `YearTimeline`). | `modules/panel/PanelPage.tsx` + `modules/panel/components/*` | **C7** · insertar card "Tu foto actual" en `PanelPage.tsx` siguiendo el patrón de cards existente. |
| 9 | Wizard nómina · pre-relleno programático | **NO se encontró mecanismo de prefill** (`initialValues`/`defaultValues`/route-state) en `modules/horizon/personal`. Rutas: `/personal/nomina/nueva`, `/personal/nomina/:id/editar`, `/personal/autonomo/nuevo|:id/editar`. | `App.tsx:1244-1259` · (sin coincidencias prefill en `horizon/personal/*.tsx`) | **C5/C6 · RIESGO**: pre-rellenar nómina/préstamo exige inyectar datos iniciales. Si los wizards no aceptan estado inicial sin tocarlos de forma no trivial → **STOP §4** antes de codificar. Verificar al inicio de C5/C6. |
| 10 | Ramas no autorizadas | **Ninguna.** `git log --all` no muestra ramas con `onboarding`/`empezar`/`dia0`. | — | Sin conflicto de ramas. |

## Piezas §0.2 reutilizables · todas verificadas presentes

| Pieza | Path real | Estado |
|---|---|---|
| Alta inmueble | `src/pages/inmuebles/InmueblePage.tsx` | ✓ |
| Wizard contrato | `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx` | ✓ |
| Importador contratos | `src/modules/inmuebles/import/ImportarContratosWizard.tsx` + `rentilaParserService` + `atlasTemplateParserService` + `contractDraftService` + `contractImportCreationService` | ✓ |
| Plantilla Excel patrón | `public/templates/plantilla-contratos-atlas.xlsx` + parser | ✓ |
| Cuentas | `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | ✓ |
| Bug openingBalance | doc en `getCurrentSaldoCuenta.ts:2-6` → **causa real en `fondosService.ts:24-36`** | ✓ |
| Importador extractos | `src/services/universalBankImporter/` + `bankStatementOrchestrator.ts` + `BankStatementUploadPage.tsx` (en `modules/horizon/tesoreria/import/`) | ✓ |
| Recurrentes | `src/services/personal/compromisosRecurrentesService.ts` | ✓ |
| Learning rules | `movementLearningService.ts` + `movementSuggestionService.ts` + store `movementLearningRules` | ✓ |
| Wizard nómina/autónomo | `/personal/nomina|autonomo/...` (`App.tsx:1244-1259`) | ✓ (sin prefill · ver V9) |
| Posiciones inversión | `src/modules/horizon/inversiones/components/PosicionForm.tsx` + `AportacionForm.tsx` | ✓ |
| Valoraciones | `src/services/valoracionesService.ts` (`upsertByDate` l.328) | ✓ |
| Bootstrap previsiones | `src/services/treasuryBootstrapService.ts` | ✓ |
| Estimación IRPF | `src/services/estimacionFiscalEnCursoService.ts` | ✓ |
| Préstamos | `src/services/prestamosService.ts` (+ `prestamosCalculationService`) | ✓ |
| treasurySyncService | `src/modules/horizon/tesoreria/services/treasurySyncService.ts` | ✓ |

**Deprecados confirmados presentes (PROHIBIDO usar §0.1.7):** `src/services/treasuryCreationService.ts`, `src/services/enhancedTreasuryCreationService.ts`.

**Mockup:** 11 pantallas confirmadas en `docs/mockups/atlas-onboarding-dia0-v4.html` (selector líneas 184-195): 01 welcome · 02 hub · 03 contratos · 04 inmuebles · 05 financiero · 06 sugerencias · 07 préstamos · 08 nómina · 09 inversiones · 10 reveal · 11 widget panel.

## ⚠️ Discrepancias / sorpresas que requieren decisión de Jose (Regla §0)

- **D1 · STOP-worthy (C2/C6) · tipo de `prestamoVinculadoId`.** §3.1 lo define como `number` ("FK a prestamos"), pero **`Prestamo.id` es `string` (uuid corto)** (`types/prestamos.ts:8`). Si se declara `number` no podrá referenciar un préstamo real. **Propuesta:** declararlo `prestamoVinculadoId?: string`. → **Esperar confirmación de Jose antes de C2.**
- **D2 · Coexistencia `/onboarding` vs `/empezar`.** Ya existe una ruta `/onboarding` (thin shell, mockup viejo) que solo redirige a importadores. La tarea manda `/empezar` como ruta nueva. ¿Se deja `/onboarding` como está (legacy) y se añade `/empezar` aparte, o se reemplaza/redirige `/onboarding` → `/empezar`? El spec dice ruta nueva, así que por defecto **coexisten** salvo que Jose indique lo contrario.
- **D3 · Path del documento de diseño.** §Documentos cita `docs/GUIA-DISENO-V5-atlas.md`, pero el archivo real está en **`docs/audit-inputs/GUIA-DISENO-V5-atlas.md`**. Usaré ese para el checklist §17. (No bloqueante.)
- **D4 · Riesgo prefill nómina/préstamo (V9).** No hay mecanismo de pre-relleno en los wizards de nómina/autónomo. Si añadir pre-relleno (§2.4/§2.5) exige tocar los wizards de forma no trivial → **STOP §4** y reportar al iniciar C5/C6.

## Conclusión C1

Todas las piezas de §0.2 existen en los paths declarados (con matices de ubicación menores: `BankStatementUploadPage` y `treasurySyncService` bajo `modules/horizon/tesoreria/`). La condición de STOP de §2.4 **no se cumple** (no hay base de sugerencias preexistente). Quedan **4 discrepancias** (D1-D4); **D1 es bloqueante para C2**. Stop-and-wait: **espero decisión de Jose antes de iniciar C2.**
