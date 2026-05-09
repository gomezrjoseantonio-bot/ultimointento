# T-TESORERIA-AUDIT · INFORME · pieza Tesorería · 5 problemas concretos detectados por Jose

> **Tipo** · Auditoría dedicada · CERO código modificado
> **Fecha** · 2026-05-09
> **Spec ejecutado** · `docs/audits/T-TESORERIA-AUDIT.md`
> **Output** · este archivo · 1 solo
> **Reglas aplicadas** · V11.3 (5 preguntas) · V11.6 (pantallazos = verdad) · V11.7 (audit dedicado por funcionalidad sospechosa) · grep duro
> **DB** · v70 · 40 stores activos (dato literal sed -n28)
> **Branch** · `claude/treasury-audit-execution-i0ZuL`
> **Commit base** · `11c8a85` (Merge PR #1312)

---

## §0 · Resumen ejecutivo (5 líneas)

1. **Saldos NO se actualizan al confirmar movimiento** · BUG REAL · `confirmTreasuryEvent` (1262 líneas, canónico, llamado desde Conciliación + MovimientosTab + AddMovementModal + LineasAnualesTab) **no contiene una sola referencia a `balance`** (`grep -c balance` = 0) · existen DOS servicios de recálculo (`accountBalanceService.rollForwardAccountBalancesToMonth` y `treasuryEventsService.recalculateAccountBalance`) pero ninguno se invoca tras confirmar · UI lee `account.balance ?? account.openingBalance ?? 0` · queda stale hasta que el usuario abre Dashboard (único punto que dispara `rollForward`).
2. **Filtros conciliación no listan todas las cuentas** · BUG ARQUITECTÓNICO MENOR · `useMonthConciliacion` hace `db.getAll('accounts')` SIN filtro y `FiltersBar` mapea TODAS las cuentas sin filtro adicional · en cambio `TesoreriaPage` filtra por `status === 'ACTIVE'` · explicación más probable de las 3 cuentas faltantes (Bankinter · Revolut · Carrefour) · Conciliación NO se subscribe a `cuentasService.on('accounts:updated')` mientras Tesorería sí · estado stale tras dar de alta cuentas nuevas.
3. **Validación manual + Subir extracto = 2 caminos paralelos coexistentes** · ARQUITECTURA · "Nuevo movimiento" (botón en Conciliación + MovimientosTab) → `AddMovementModal` → `db.add('treasuryEvents')` → opcional `confirmTreasuryEvent`. "Subir extracto" → `/tesoreria/importar` → `BankStatementUploadPage` → `bankStatementOrchestrator.processFile + confirmDecisions`. Comparten el primitive `db.put('movements')` pero NO orquestación · resultado · 15 `db.put|add('movements')` repartidos en 11 archivos · ambos caminos válidos pero sin documentación contrastable usuario.
4. **Heurísticas hardcoded, 6 reglas, 1 fallback inútil** · CONFIGURACIÓN ESTÁTICA · `movementSuggestionService.ts:285-385` define 6 reglas regex (Suministros · Hipoteca · IBI · Comunidad · Bizum · Amazon) · si ninguna casa devuelve `{ kind: 'ignore', description: 'Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente' }` que es lo que Jose vio · "Aplicar" llama `applySuggestion` (crea treasuryEvent con la categoría sugerida); "Ignorar" marca `statusConciliacion: 'sin_match'` · botón es DOBLE solo en heurísticas con acción ≠ ignore · cuando es ignore el botón solo muestra "Ignorar". NO hay relación con `movementLearningRules` (vías independientes A/B/C en `movementSuggestionService`).
5. **UX agobio · 3 rutas físicas distintas + 0 tooltips** · `/tesoreria` (Vista general · 553 líneas), `/tesoreria/movimientos` (688 líneas), `/tesoreria/importar` (BankStatementUploadPage · pieza grande), más `/horizon/conciliacion` (módulo aparte · 6 componentes en `v2/components/`) · 0 hits de `Tooltip|InfoIcon|HelpCircle` en ninguna · 1470 LOC solo en `src/modules/tesoreria/` · 4 puntos de entrada para crear/clasificar movements, sin discoverability ni jerarquía clara.

**Veredicto · R4** · mezcla · 1 bug obvio (saldos) + 1 bug menor (filtros stale) + 1 saneamiento arquitectura (fusionar/contrastar manual vs extracto) + 1 rediseño UX. Ranking en §G.

---

## §1 · Pre-flight literal (regla §2 spec)

### §1.1 · Problema 1 · Saldos cuentas no se actualizan al validar

```bash
$ grep -rnE "confirmMovement|validateMovement|conciliarMovement|aprobarMovement|markAsConciliated" \
    src/services/ --include="*.ts" | head -15
(0 matches · ninguna de esas APIs literales existe)

$ grep -rnE "updateAccountBalance|recalcularSaldo|recalcularBalance|updateBalance" \
    src/services/ --include="*.ts" | head -15
(0 matches con esos nombres literales · NB · existen otros nombres canónicos · ver §1.1.bis)

$ grep -rnE "after.*confirm|onConfirm|onValidate|trigger.*balance" src/ --include="*.ts" --include="*.tsx" | head -10
src/modules/shared/components/ListadoGastos/ListadoGastosRecurrentes.tsx:330:  onConfirm={() => void handleDeleteConfirm()}
src/modules/fiscal/pages/ConfiguracionPage.tsx:468:  onConfirm={handleDelete}
src/modules/fiscal/pages/ConfiguracionPage.tsx:591:  onConfirm={handleDelete}
src/modules/mi-plan/pages/FondosPage.tsx:135:  onConfirm={handleDelete}
src/modules/mi-plan/pages/ObjetivosPage.tsx:138:  onConfirm={handleConfirmAction}
src/modules/horizon/conciliacion/v2/components/DeleteConfirmDialog.tsx:8:  onConfirm: () => void;
src/modules/horizon/conciliacion/v2/components/DeleteConfirmDialog.tsx:18:  onConfirm,
src/modules/horizon/conciliacion/v2/components/DeleteConfirmDialog.tsx:38:  onClick={onConfirm}
src/modules/pulse/automatizaciones/reglas/AutomatizacionesReglas.tsx:128:  onConfirm={handleDelete}
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:284:  onConfirm={() => handleDelete(deletingRow)}
(todos son confirmaciones de DIÁLOGO de borrado · ninguno liga a recálculo de saldo)

$ grep -rnE "accounts.*balance|\.balance\s*=|\.balance\s*\+=" \
    src/services/account*.ts src/services/treasury* | head -20
(0 matches con ese patrón estricto)
```

#### §1.1.bis · Búsqueda corregida (los nombres reales son distintos)

Los nombres canónicos en el repo son `confirmTreasuryEvent`, `recalculateAccountBalance` y `rollForwardAccountBalancesToMonth`:

```bash
$ grep -nE "^export" src/services/treasuryConfirmationService.ts
34:export interface ConfirmOverrides {
48:export interface ConfirmResult {
76:export function categoryLabelToStoreName(...
110:export function resolveCasillaAEAT(labelOrKey?: string): string | undefined {
289:export async function confirmTreasuryEvent(
571:export async function revertTreasuryConfirmation(
730:export interface UpdateConfirmedUpdates {
798:export async function deleteTreasuryEventCompletely(
860:export async function updateConfirmedMovement(
1094:export type DocSlot = 'factura' | 'justificante';
1174:export async function attachDocumentToEvent(
1190:export async function detachDocumentFromEvent(
1206:export async function setDocumentNoAplica(
1223:export interface TreasuryEventPatch {
1234:export async function updateTreasuryEventFields(

$ wc -l src/services/treasuryConfirmationService.ts
1262 src/services/treasuryConfirmationService.ts

$ grep -cnE "balance" src/services/treasuryConfirmationService.ts
0

$ grep -rnE "rollForwardAccountBalancesToMonth" src/
src/modules/horizon/tesoreria/services/treasurySyncService.ts:25 (import)
src/modules/horizon/tesoreria/services/treasurySyncService.ts:151 (call dentro de syncMonth)
src/services/dashboardService.ts:4 (import)
src/services/dashboardService.ts:1408 (call dentro de calcularKpisInicio)
src/__tests__/accountBalanceService.test.ts:13 (import test)
src/__tests__/accountBalanceService.test.ts:264 (call test)
src/services/accountBalanceService.ts:97 (export def)

$ grep -rnE "recalculateAccountBalance" src/services/
src/services/treasuryEventsService.ts:55 (export def)
src/services/treasuryEventsService.ts:193 (call · contexto · onTreasuryEventConfirmed legacy)
src/services/treasuryEventsService.ts:201 (call · contexto · updateAllAccountBalances)
```

**Conclusión literal** · `confirmTreasuryEvent` (1262 LOC, 14 exports, único punto que llamar para confirmar una previsión) tiene 0 hits de la cadena `balance`. NO recalcula saldo. Los 2 servicios que sí escriben `account.balance` se llaman desde Dashboard y desde `treasurySyncService.syncMonth` (que es para regeneración mensual) — **NUNCA encadenado tras `confirmTreasuryEvent`**.

### §1.2 · Problema 2 · Filtros conciliación · cuentas faltantes

```bash
$ grep -rnE "Conciliacion|conciliacion.*filter|ConciliacionBancaria" src/modules/ --include="*.tsx" | head -10
src/modules/horizon/conciliacion/ConciliacionPage.tsx:2:import ConciliacionPageV2 from './v2/ConciliacionPageV2';
src/modules/horizon/conciliacion/ConciliacionPage.tsx:12:const ConciliacionPage: React.FC = () => <ConciliacionPageV2 />;
src/modules/horizon/conciliacion/v2/components/ParentRentRow.tsx:6:import type { RentGroupRow, SingleRow } from '../hooks/useMonthConciliacion';
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:10:import ConciliacionHeader from './components/ConciliacionHeader';
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:20:  useMonthConciliacion,
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:23:} from './hooks/useMonthConciliacion';
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:33:const ConciliacionPageV2: React.FC = () => {
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:44:  const { loading, days, kpis, accounts, properties, reload } = useMonthConciliacion(filters);

$ grep -rnE "cuentas.*filter|filterCuentas|getAccountsForFilter" src/ --include="*.ts" --include="*.tsx" | head -10
src/modules/mi-plan/wizards/steps/Step3Cuentas.tsx:136 (filter sobre asignación draft)
src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx:58 (cuentasService.list().then(...filter activa))
src/components/treasury/MesDetalleDrawer.tsx:639 (filter sobre breakdown.warn)

$ grep -rnE "Santander.*BBVA.*Unicaja|hardcodedAccounts|defaultAccounts" src/ --include="*.tsx" | head -10
(0 matches · NO hay cuentas hardcoded en código)

$ grep -nE "createObjectStore.*accounts" src/services/db.ts
2576:  const accountsStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
```

#### §1.2.bis · Cómo carga `useMonthConciliacion` las cuentas

```typescript
// src/modules/horizon/conciliacion/v2/hooks/useMonthConciliacion.ts:459-525
useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoading(true);
    const db = await initDB();
    const [eventsRaw, accountsAll, propertiesAll, ...] = await Promise.all([
      db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
      db.getAll('accounts') as Promise<Account[]>,    // ← TODAS las cuentas
      ...
    ]);
    ...
    setAccounts(accountsAll);   // ← SIN filtro
  })();
}, [filters.year, filters.month0, reloadToken]);
```

```typescript
// src/modules/horizon/conciliacion/v2/components/FiltersBar.tsx:55-68
{accounts.map((a) => (
  <button ... onClick={() => onChange({ accountId: a.id! })}>
    {accountShortLabel(a)}
  </button>
))}
```

#### §1.2.ter · Cómo carga TesoreriaPage las cuentas (comparación)

```typescript
// src/modules/tesoreria/TesoreriaPage.tsx:34-58
const [accs, ...] = await Promise.all([db.getAll('accounts'), ...]);
const activeAccs = accs.filter(
  (a) => (a.status ?? 'ACTIVE') === 'ACTIVE',
);
setAccounts(activeAccs);   // ← Filtra por status

// línea 56-60 · listener event-driven
const unsubscribe = cuentasService.on((event) => {
  if (event === 'accounts:updated') load();
});
```

```bash
$ grep -nE "cuentasService" src/modules/horizon/conciliacion/v2/*.tsx \
    src/modules/horizon/conciliacion/v2/hooks/*.ts src/modules/horizon/conciliacion/v2/components/*.tsx
(0 matches · Conciliación NO se subscribe a accounts:updated)
```

### §1.3 · Problema 3 · Validación manual + Subir extracto

```bash
$ grep -rnE ">.{0,3}Nuevo movimiento|crear.*movement|addMovement" src/modules/ --include="*.tsx" | head -10
src/modules/inversiones/components/AportacionPlanDialog.tsx:65 (inversiones, no tesorería)

$ grep -rnE ">.{0,3}Subir extracto|importExtracto|uploadExtracto" src/modules/ --include="*.tsx" | head -10
(0 matches con ese patrón literal)

$ grep -rnE "matchingService|matchExtracto|importMatching" src/services/ --include="*.ts" | head -10
(0 matches con esos prefijos · canónica es movementMatchingService · ver §1.3.bis)

$ grep -rnE "db\.put\('movements'|db\.add\('movements'" src/services/ --include="*.ts" | head -15
src/services/budgetMatchingService.ts:359:    await db.put('movements', updatedMovement);
src/services/treasuryApiService.ts:298:            await db.put('movements', updatedMovement);
src/services/treasuryApiService.ts:486:        await db.put('movements', updatedMovement);
src/services/treasuryApiService.ts:735:        await db.add('movements', movement);
src/services/enhancedTreasuryCreationService.ts:194:      const movementId = await db.add('movements', movement);
src/services/migrationService.ts:54:          await db.put('movements', movement);
src/services/bankStatementOrchestrator.ts:210:    await db.put('movements', { ...
src/services/bankStatementOrchestrator.ts:235:    await db.put('movements', { ...
src/services/bankStatementOrchestrator.ts:413:    const id = (await db.add('movements', candidate)) as number;
src/services/bankStatementOrchestrator.ts:439:    await db.put('movements', { ...
src/services/bankStatementOrchestrator.ts:449:    await db.put('movements', { ...
src/services/budgetReclassificationService.ts:192:    await db.put('movements', updatedMovement);
src/services/cuentasService.ts:364:    await db.add('movements', openingMovement);
src/services/rendimientosService.ts:61:    const movimientoId = await db.add('movements', { ...
src/services/loanService.ts:109:    const movimientoId = await db.add('movements', { ...

# (15 hits dispersos en 11 archivos distintos · escribir movements no está
#  centralizado · cada flujo lo hace por su cuenta)
```

#### §1.3.bis · Caminos reales (con nombres canónicos)

| Camino | Punto entrada UI | Servicio core | Persistencia |
|---|---|---|---|
| **Manual desde Conciliación** | `ConciliacionPageV2.tsx:217` btn "Nuevo movimiento" → `AddMovementModal` | `treasuryConfirmationService.confirmTreasuryEvent` (opcional) | `db.add('treasuryEvents')` + `confirmTreasuryEvent` que añade movement |
| **Manual desde MovimientosTab** | `MovimientosTab.tsx:433` btn "Nuevo movimiento" → mismo `AddMovementModal` | idem | idem |
| **Subir extracto** | `TesoreriaPage.tsx:186` btn "Subir extracto" → `navigate('/tesoreria/importar')` → `BankStatementUploadPage` | `bankStatementOrchestrator.processFile` + `confirmDecisions` | `db.add('movements')` directo + `db.put('treasuryEvents', { status: 'executed' })` cuando aprueba match |
| **Aprobar match dentro extracto** | `BankStatementUploadPage.tsx:1006` btn "Aplicar/Ignorar" | `bankStatementOrchestrator.confirmDecisions` (fork por suggestion.action.kind) | `applySuggestion` o sólo update movement.statusConciliacion |
| **LineasAnualesTab inmueble** | `LineasAnualesTab.tsx:21` `confirmTreasuryEvent` | mismo `treasuryConfirmationService` | idem manual |

```bash
$ grep -rnE "from.*treasuryConfirmationService" src/ | head
src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx:7
src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx:29
src/modules/horizon/conciliacion/v2/components/EditMovementModal.tsx:9
src/modules/horizon/conciliacion/v2/components/DocSlot.tsx:11
src/modules/horizon/conciliacion/v2/components/DocumentPickerPopover.tsx:11
src/modules/tesoreria/tabs/MovimientosTab.tsx:23
src/modules/tesoreria/tabs/VistaGeneralTab.tsx:22
src/components/treasury/TesoreriaV4.tsx:29
src/services/treasuryTransferService.ts:15
src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:21
```

#### §1.3.ter · Servicio dead code residual

```bash
$ grep -rnE "from .*\/conciliacionService['\"]" src/ | grep -v reconciliacion
(0 matches · nadie importa conciliacionService.ts)

$ ls -la src/services/conciliacionService.ts
exists · 116 LOC · exporta buscarCandidatosConciliacion + confirmarConciliacion + const conciliacionService
(referencia 0 · DEAD CODE confirmado)
```

### §1.4 · Problema 4 · Heurísticas + Aplicar/Ignorar

```bash
$ grep -rnE "heuristica|heuristicService|patternMatch|sugerencia.*Movement|recomendar" \
    src/services/ --include="*.ts" | head -15
src/services/movementSuggestionService.ts:39:export type SuggestionVia = 'compromiso_recurrente' | 'learning_rule' | 'heuristica';
src/services/movementSuggestionService.ts:387:        via: 'heuristica',
src/services/movementSuggestionService.ts:396:    via: 'heuristica',
src/services/budgetReclassificationService.ts:175:    const patternMatch = analyzeMovementForCategory(movement);
src/services/budgetReclassificationService.ts:176:    categoria = patternMatch.categoria;
src/services/budgetReclassificationService.ts:177:    ambito = patternMatch.ambito;
src/services/__tests__/bankStatementOrchestrator.test.ts:162: (test fixture)
src/services/__tests__/movementSuggestionService.test.ts:90: (test)
... (resto · tests)

$ grep -rnE "Sin patrón reconocible|Posible suministro|Bizum.*alquiler|proponer.*crear" \
    src/ --include="*.ts" --include="*.tsx" | head -15
src/services/movementSuggestionService.ts:300:  description: 'Posible suministro · proponer crear evento de tesorería en INMUEBLE (puedes cambiarlo a PERSONAL)',
src/services/movementSuggestionService.ts:360:  description: 'Bizum o transferencia recibida · proponer asignar a un contrato de alquiler activo',
src/services/movementSuggestionService.ts:398:  description: 'Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente',
src/services/__tests__/bankStatementOrchestrator.test.ts:164:  description: 'Posible suministro · proponer crear evento de tesorería',

$ grep -rnE "learningRules.*heuristica|heuristica.*learning|aplicarRegla" src/ --include="*.ts" --include="*.tsx" | head -10
(0 matches · vías totalmente independientes en código)

$ grep -rnE "onAplicar|onIgnorar|aplicarHeuristica|ignorarHeuristica" src/ --include="*.tsx" --include="*.ts" | head -10
(0 matches con esos nombres literales · canónicos son onApply/onIgnore en BankStatementUploadPage)
```

#### §1.4.bis · Catálogo literal de heurísticas (`movementSuggestionService.ts:285-385`)

| # | Match (regex) | Descripción mostrada | action.kind |
|---|---|---|---|
| 1 | `IBERDROLA|ENDESA|NATURGY|REPSOL|CEPSA|TOTAL ENERGIES|VODAFONE|MOVISTAR|ORANGE|YOIGO|MASMOVIL|JAZZTEL` | Posible suministro · proponer crear evento de tesorería en INMUEBLE (puedes cambiarlo a PERSONAL) | create_treasury_event |
| 2 | `CUOTA PRESTAMO|HIPOTECA|RECIBO BANCO` | Posible cuota de préstamo / hipoteca · proponer asignar a préstamo activo de la cuenta | create_treasury_event |
| 3 | `\bIBI\b|TASA BASURA|AYUNTAMIENTO|CONTRIBUCION URBANA` | Posible impuesto del inmueble (IBI, tasa de basura, etc.) | create_treasury_event |
| 4 | `COMUNIDAD|ADMIN FINCAS|FINCAS` | Posible cuota de comunidad de propietarios | create_treasury_event |
| 5 | `BIZUM|TRANSFERENCIA RECIBIDA` | Bizum o transferencia recibida · proponer asignar a un contrato de alquiler activo | assign_to_contract |
| 6 | `amount<0 && (AMAZON|ALIEXPRESS|ALI EXPRESS)` | Compra online (Amazon / AliExpress) · proponer marcar como gasto personal | mark_personal_expense |
| **fallback** | (ninguna casa) | **Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente** | **ignore** |

#### §1.4.ter · Aplicar / Ignorar handlers literales

```typescript
// src/modules/horizon/tesoreria/import/BankStatementUploadPage.tsx:993-1006
<button
  type="button"
  onClick={() => suggestion.action.kind === 'ignore' ? onIgnore() : onApply(idx)}
  ...
>
  {suggestion.action.kind === 'ignore' ? 'Ignorar' : 'Aplicar'}
</button>
```

→ Cuando es fallback ("Sin patrón reconocible") **solo aparece "Ignorar"** · usuario NO tiene "Aplicar".

```typescript
// src/services/bankStatementOrchestrator.ts:225-237 · ignoredMovementIds
for (const movementId of payload.ignoredMovementIds) {
  if (movementIdsTouched.has(movementId)) continue;
  const movement = (await db.get('movements', movementId)) as Movement | undefined;
  if (!movement) continue;
  await db.put('movements', {
    ...movement,
    unifiedStatus: 'no_planificado',
    statusConciliacion: 'sin_match',
    updatedAt: now,
  });
}
```

→ "Ignorar" deja el movement con `unifiedStatus='no_planificado'` y `statusConciliacion='sin_match'`. NO desaparece, NO se crea evento, NO se aprende regla.

```typescript
// src/services/bankStatementOrchestrator.ts:218-223 · approvedSuggestions
for (const [movementId, suggestion] of suggestionsByMovement) {
  const movement = (await db.get('movements', movementId)) as Movement | undefined;
  if (!movement) continue;
  await applySuggestion(movement, suggestion, now);
  movementIdsTouched.add(movementId);
}
```

→ "Aplicar" delega en `applySuggestion` que crea/actualiza el treasuryEvent según `suggestion.action`. Aplicar suministro/IBI/comunidad → `create_treasury_event` con la `categoryKey` predefinida.

#### §1.4.quater · Vías independientes (sin cruce learningRules ↔ heurísticas)

```bash
$ grep -nE "via:" src/services/movementSuggestionService.ts | head -10
39:export type SuggestionVia = 'compromiso_recurrente' | 'learning_rule' | 'heuristica';
387:        via: 'heuristica',
396:    via: 'heuristica',
```

3 vías separadas en `movementSuggestionService.suggestForUnmatched`:
- **A · `compromiso_recurrente`** · cruza con `compromisosRecurrentes` activos
- **B · `learning_rule`** · cruza con `movementLearningRules` (alimentado por `bankStatementOrchestrator.confirmDecisions → feedLearningRule`)
- **C · `heuristica`** · 6 reglas hardcoded del catálogo §1.4.bis

`movementLearningService.ts:1-22` confirma que rules las alimenta SOLO `bankStatementOrchestrator.confirmDecisions → feedLearningRule → createOrUpdateRule`. Confirmar manual desde `AddMovementModal` o `ConciliacionPageV2` **NO alimenta learning** — sólo el camino extracto enseña.

### §1.5 · Problema 5 · UX agobio · densidad

```bash
$ find src/modules/ -name "Tesoreria*" -type f
src/modules/tesoreria/TesoreriaPage.tsx
src/modules/tesoreria/TesoreriaPage.module.css

$ wc -l src/modules/horizon/tesoreria/*.tsx 2>/dev/null
781 src/modules/horizon/tesoreria/HistoricoWizard.tsx
   (la carpeta src/modules/horizon/tesoreria/ contiene además services/, import/,
    pero NO una TesoreriaPage propia · la página real vive en src/modules/tesoreria/)

$ wc -l src/modules/tesoreria/TesoreriaPage.tsx \
        src/modules/tesoreria/tabs/VistaGeneralTab.tsx \
        src/modules/tesoreria/tabs/MovimientosTab.tsx
229  src/modules/tesoreria/TesoreriaPage.tsx
553  src/modules/tesoreria/tabs/VistaGeneralTab.tsx
688  src/modules/tesoreria/tabs/MovimientosTab.tsx
1470 total

$ grep -nE "Tooltip|InfoIcon|HelpCircle|description.*tooltip" \
    src/modules/horizon/tesoreria/ src/modules/v5/tesoreria/ -r
(0 matches · `src/modules/v5/tesoreria/` no existe)

$ grep -nE "Tooltip|InfoIcon|HelpCircle" src/modules/tesoreria/ -r --include="*.tsx"
(0 matches · 0 tooltips en /tesoreria)

$ grep -nE "Tooltip|InfoIcon|HelpCircle" src/modules/horizon/conciliacion/ -r --include="*.tsx"
(0 matches · 0 tooltips en /conciliacion v2 tampoco)
```

---

## §A · Problema 1 · Saldos · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe servicio que actualiza saldo cuando se valida un movement? | **PARCIAL** · existen 2 funciones que escriben `account.balance` (`accountBalanceService.rollForwardAccountBalancesToMonth:97` y `treasuryEventsService.recalculateAccountBalance:55`) pero **ninguna se llama desde `confirmTreasuryEvent`**. |
| 2 · ¿Cuántas implementaciones distintas? | **2** · `rollForwardAccountBalancesToMonth` (recorre TODAS las cuentas, recalcula saldo a `monthStart` con `calculateAccountBalanceAtDate`) + `recalculateAccountBalance(accountId)` (suma openingBalance + movements de la cuenta sin contar treasuryEvents). |
| 3 · ¿Está viva? | `rollForwardAccountBalancesToMonth` callers · `dashboardService.calcularKpisInicio:1408` (al cargar Dashboard) y `treasurySyncService.syncMonth:151` (regenerar mensual). `recalculateAccountBalance` callers · solo `treasuryEventsService` interno (líneas 193, 201) — pieza interna no enlazada con confirmaciones del usuario. |
| 4 · Si 2+, canónica vs legacy | **`rollForwardAccountBalancesToMonth` es la canónica** (usa `calculateAccountBalanceAtDate` que mezcla openingBalance + treasuryEvents committed + movements). `recalculateAccountBalance` es **LEGACY** (sólo cuenta movements, ignora treasuryEvents — incorrecta para el modelo actual de previsiones). |
| 5 · Dead code residual | `recalculateAccountBalance` huele a legacy (T16-cleanup mencionó saneamiento de movement learning · este archivo no fue tocado). Candidato a borrar tras corregir bug. |

#### §A.diagnóstico · BUG REAL

`treasuryConfirmationService.confirmTreasuryEvent` (1262 LOC, 14 exports) hace 0 referencias a `balance`. Cadena tras `confirmTreasuryEvent`:

1. Crea `movement` (`tx.objectStore('movements').add(payload)`)
2. Crea `linea` en `gastosInmueble`/`mejorasInmueble`/`capexInmueble` si `ambito === INMUEBLE`
3. Marca `treasuryEvent.status = 'executed'`
4. Persiste documento adjunto si lo hay
5. **Termina sin tocar accounts**

UI de Vista general / BankAccountCard / TreasuryReconciliationView lee `account.balance ?? account.openingBalance ?? 0` (8 puntos de lectura del campo persistido):

```bash
src/modules/tesoreria/TesoreriaPage.tsx:128
src/modules/tesoreria/tabs/VistaGeneralTab.tsx:80
src/modules/tesoreria/components/BankAccountCard.tsx:70
src/components/treasury/MesDetalleDrawer.tsx:608
src/components/treasury/BalancesBancariosView.tsx:27
src/components/treasury/TreasuryReconciliationView.tsx:555,581,589,590,935,936
src/components/treasury/treasuryBalanceSummary.ts:138,139,140
```

→ El saldo se queda STALE hasta que el usuario navega a Dashboard (que dispara `dashboardService.calcularKpisInicio → rollForwardAccountBalancesToMonth`).

**Tiempo de fix estimado** · **1-2 h CC** · invocar `rollForwardAccountBalancesToMonth(year, month)` o el equivalente puntual `calculateAccountBalanceAtDate({account, ...}) + db.put('accounts', {...account, balance: nuevo})` al final de `confirmTreasuryEvent` (y también en `revertTreasuryConfirmation`, `updateConfirmedMovement`, `deleteTreasuryEventCompletely`). Coste tests · 4-6 unit tests cubriendo los 4 caminos. Riesgo bajo (servicio ya existe y es testeado en `__tests__/accountBalanceService.test.ts:264`).

---

## §B · Problema 2 · Filtros conciliación · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿La lista de cuentas en filtro es derivada de `db.getAll('accounts')` o hardcoded? | **Derivada** · `useMonthConciliacion.ts:464` hace `db.getAll('accounts')` y la pasa íntegra a `FiltersBar`. `FiltersBar.tsx:55` mapea `accounts.map(...)` sin filtro. NO hay cuentas hardcoded en código (`grep Santander.*BBVA.*Unicaja` = 0 hits). |
| 2 · ¿Hay filtro/condición que excluye cuentas? | **No en Conciliación** (sin filtro `status` ni `activa`). En cambio `TesoreriaPage.tsx:42-44` SÍ filtra `(a.status ?? 'ACTIVE') === 'ACTIVE'` antes de setear. |
| 3 · ¿Está viva la lista? | Carga inicial · sí (efecto en mount). **Re-carga** · sólo cuando cambian `filters.year`, `filters.month0` o `reloadToken` (`reload()` se invoca tras crear/editar/borrar movements). NUNCA tras cambios en `accounts` desde otras páginas. |
| 4 · ¿Hay 2+ implementaciones? | Sí · `useMonthConciliacion` (Conciliación v2) vs `TesoreriaPage` con `cuentasService.on` event subscription. Conciliación está más atrasada. |
| 5 · Dead code | `src/services/conciliacionService.ts` (116 LOC, exporta `buscarCandidatosConciliacion` + `confirmarConciliacion`) NO tiene callers · `grep "from.*conciliacionService"` (excluyendo reconciliacionService) = 0 matches. **DEAD CODE confirmado.** |

#### §B.diagnóstico · BUG ARQUITECTÓNICO MENOR

Las 3 cuentas faltantes (Bankinter · Revolut · Carrefour) en pantallazo Imagen 5 vs Imagen 4 se explican por una de estas dos rutas, ambas posibles según el código actual:

1. **Ruta A · timing** · si Jose dio de alta Bankinter/Revolut/Carrefour DESPUÉS de abrir Conciliación, esa página NUNCA se entera (no se subscribe a `cuentasService.on('accounts:updated')`). Tesorería sí lo hace y por eso Imagen 1/4 sí las muestran. Reload manual (cambiar mes y volver) recargaría.
2. **Ruta B · DB diferente** · poco probable pero verificable · si una de las 3 cuentas tiene `id == null` o no está en `accounts` por bug de import, `accountsById` no la incluiría. `db.getAll('accounts')` literal es la fuente, sin filtro adicional.

**Tiempo de fix estimado** · **30 min - 1 h CC** · subscribir `useMonthConciliacion` a `cuentasService.on(...)` y disparar `setReloadToken(n => n+1)` al recibir `accounts:updated`. + 1 test verificando que tras alta de account la lista se actualiza sin recargar página. Riesgo nulo.

**Sub-problema UX** · aunque el bug se arregle, FiltersBar usa chips horizontales sin scroll · con 9-12 cuentas la barra se desborda visualmente (cv2-filter-group sin overflow declarado).

---

## §C · Problema 3 · Validación manual + extracto · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿"Nuevo movimiento", "Aprobar match" y "Subir extracto" comparten servicio? | **Parcial** · "Nuevo movimiento" (manual) y "Aprobar match" (post-extracto) ambos terminan modificando `treasuryEvents` y `movements` pero por orquestadores distintos · `confirmTreasuryEvent` vs `bankStatementOrchestrator.confirmDecisions`. Comparten el primitive de IDB pero NO la lógica de negocio. |
| 2 · ¿Cuántas implementaciones distintas? | **2 orquestadores principales + 11 puntos de escritura directa** (`grep db.put|add('movements')` = 15 hits en 11 archivos). El primitive es single (`db.put('movements')`) pero se invoca disperso. |
| 3 · ¿Está viva la duplicidad? | **Sí, ambas rutas vivas y usadas** · AddMovementModal importado por ConciliacionPageV2:17, MovimientosTab:29. BankStatementUploadPage en `/tesoreria/importar`. Ninguna marcada como legacy. |
| 4 · Canónica vs legacy | NO hay declaración de canónica · diseño explícito de 2 rutas · "Manual rápido" (modal) vs "Lote desde extracto" (pipeline). Coexistir es la intención. |
| 5 · Dead code residual | `src/services/conciliacionService.ts` (116 LOC) · 0 callers (ver §B). `src/services/treasuryCreationService.ts` y `enhancedTreasuryCreationService.ts` coexisten · auditar si la "enhanced" reemplaza a la simple. `src/services/reconciliacionService.ts` es **OTRO dominio** (reconciliación fiscal cierre, no bancaria) · no confundir. |

#### §C.diagnóstico · ARQUITECTURA DUPLICADA POR DESIGN, MAL DOCUMENTADA

No es bug, es arquitectura por diseño · 2 caminos coexisten porque cubren casos distintos:

- **Manual** · Jose añade pago en efectivo / movement desde su cabeza, sin extracto · 1-3 movements, llena formulario en `AddMovementModal` (~9 campos)
- **Extracto** · Jose sube CSV/XLSX del banco · 50-300 movements en lote · pipeline detecta matches automáticamente (`movementMatchingService`) y propone heurísticas (`movementSuggestionService`) para los `sin_match`

El problema "está raro montado" de Jose proviene de:
1. **Botones distribuidos** · "Subir extracto" en header de TesoreriaPage (botón gold prominente) vs "Nuevo movimiento" enterrado en MovimientosTab (línea 433, después de filtros)
2. **3 puntos de entrada para crear movement manual** · ConciliacionPageV2 + MovimientosTab + LineasAnualesTab/inmueble · sin pista visual de cuál usar
3. **`/horizon/conciliacion` vs `/tesoreria` son módulos físicamente separados** · Jose alterna entre 2 URLs distintas para misma tarea conceptual
4. **Movement creado manual NO alimenta learning rules** (sólo el camino extracto lo hace) · pieza fundamental documentada en `movementLearningService.ts:1-22` pero **invisible al usuario**

**Tiempo de fix arquitectónico** · **4-6 h CC** · 3 sub-tareas independientes ·
- C1 · borrar `conciliacionService.ts` dead code (15 min)
- C2 · auditar `treasuryCreationService` vs `enhancedTreasuryCreationService` (1-2 h)
- C3 · unificar entrada manual a 1 punto único o documentar la coexistencia con tooltips (3-4 h)

---

## §D · Problema 4 · Heurísticas · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿De dónde salen las heurísticas? | **Hardcoded** · `movementSuggestionService.ts:285-385` · array `HEURISTIC_RULES` con 6 reglas regex. |
| 2 · ¿Se relacionan con `movementLearningRules`? | **NO directamente** · son la "Vía C" en `suggestForUnmatched`. Vía B es `learning_rule` (consulta `movementLearningRules`). Independientes (`grep "learningRules.*heuristica"` = 0). Sí comparten que ambas terminan en `applySuggestion` cuando el usuario aprueba. |
| 3 · ¿"Aplicar" qué hace? | Si `action.kind === 'create_treasury_event'` · llama `applySuggestion` que crea un treasuryEvent con `categoryKey` predefinida. Si `action.kind === 'assign_to_contract'` · UI debería abrir selector de contracts (revisar implementación específica). Si `action.kind === 'mark_personal_expense'` · marca como gasto personal. |
| 4 · ¿"Ignorar" qué hace? | Marca el movement con `unifiedStatus: 'no_planificado'` + `statusConciliacion: 'sin_match'`. **NO desaparece**, **NO crea regla "ignorar X siempre"**, **NO se aprende**. Próximo extracto con descripción similar volverá a sugerir el mismo `Sin patrón reconocible`. |
| 5 · ¿Heurísticas inútiles? | Sí · el **fallback "Sin patrón reconocible"** es la heurística que Jose ve siempre que ninguna regex casa · su única acción posible es "Ignorar" porque su `action.kind === 'ignore'`. NO orienta · NO aprende · NO desaparece tras ignorar 50 veces el mismo proveedor. |

#### §D.diagnóstico · CONFIGURACIÓN ESTÁTICA CON FALLBACK ANTI-UX

3 problemas concretos con las heurísticas:

1. **Cobertura limitada** · 6 regex cubren grandes utilities (Iberdrola/Endesa/Vodafone/etc.) + algunos genéricos (BIZUM/AMAZON) · pero todo lo que no encaja → fallback inútil. Para usuario con 200 movements/mes, 70-80% probablemente cae en fallback porque sus proveedores reales (su supermercado local, su seguro concreto, sus cargos por suscripciones) NO están en regex.
2. **Fallback no aprende** · "Ignorar" debería poder aprender una regla negativa ("descartar siempre proveedor X" o "este patrón no me interesa") · hoy es paso muerto.
3. **Ignorar = pierdes el movement** · queda como `sin_match` · sigue apareciendo en la lista de pendientes · usuario vuelve a verlo en próximo extracto. La opción que Jose espera ("este es ruido, no me lo enseñes más") NO existe.

**Tiempo de fix** · **3-5 h CC** ·
- D1 · texto fallback más útil (orientado a acción · "Crea una regla manual / asigna a categoría" en vez de "ignóralo o clasifícalo manualmente") · 30 min
- D2 · acción "Crear regla aprendida" desde fallback · usar `createOrUpdateRule(payload)` con la `description` del movement como `learnKey` · 2-3 h
- D3 · acción "Ignorar siempre este patrón" · nueva regla con tipo `'ignore'` · 1-2 h (requiere mini-extensión del schema `MovementLearningRule`)

---

## §E · Problema 5 · UX agobio · análisis cualitativo (sin V11.3)

### §E.1 · Densidad de información · cuántos KPIs/widgets/listas

| Pantalla | Componentes principales | Ratio LOC/funcionalidad |
|---|---|---|
| `/tesoreria` (Vista general) | TesoreriaPage (229) + VistaGeneralTab (553) + 3 components (BankAccountCard, MonthGrid, CashflowChart) + MesDetalleDrawer (~700 LOC) | 8 widgets simultáneos · saldo + gráfico 12m + grid mensual + 9 cards cuentas + 2 KPIs entradas/salidas + budget projection + drawer mes + drawer movement |
| `/tesoreria/movimientos` | MovimientosTab (688) | 4 chips estado · N chips cuenta · listado paginado · selección bulk · modal nuevo movimiento · drawer detalle · banner errores · barra acciones |
| `/horizon/conciliacion` | ConciliacionPageV2 + 12 components en `v2/components/` | 4 chips estado · N chips cuenta · 3 chips ámbito · search box · KPI row · DayGroup colapsable · MovementRow + ParentRentRow · 3 modales (Add/Edit/Delete) |
| `/tesoreria/importar` | BankStatementUploadPage (~1100 LOC) | upload zone · preview movements · matches automáticos · sugerencias por movement · acciones Aplicar/Ignorar/Descartar/Aprobar |

**0 tooltips · 0 InfoIcon · 0 HelpCircle** en TODOS los archivos `src/modules/tesoreria/` y `src/modules/horizon/conciliacion/`.

### §E.2 · Clicks para conciliar 1 movement vs 50

| Acción | Clicks aprox | Path |
|---|---|---|
| Conciliar 1 movement (manual desde Conciliación) | 4-5 · abrir mes → expandir día → click checkmark → confirmar diálogo | ConciliacionPageV2 + DayGroup + MovementRow + DeleteConfirmDialog |
| Conciliar 50 movements (Subir extracto) | 5-7 · navegar a /tesoreria/importar → arrastrar archivo → revisar matches automáticos → revisar sugerencias 1 a 1 (50 veces "Aplicar/Ignorar") → "Aprobar todo" | BankStatementUploadPage |

**Sin batch-action en Conciliación** · MovimientosTab sí tiene `bulkConfirm` (línea 447) · ConciliacionPageV2 NO tiene confirmar-en-bloque visible.

### §E.3 · Texto de heurísticas · ¿orienta?

Catálogo §1.4.bis · las descripciones son INFORMATIVAS pero sin call-to-action explícita · el botón único "Aplicar" obliga al usuario a saber qué hace. Sin tooltip explicativo. Para fallback "Sin patrón reconocible" la única acción es "Ignorar" y sin botón "Aprender una regla aquí".

### §E.4 · Color · jerarquía visual

`var(--navy-900)` botón Aplicar/Ignorar (mismo color para acciones opuestas). `var(--gold)` solo en "Subir extracto" del header. Ámbito chips: 3 estados sin colores diferenciales. Imposible escanear visualmente "qué requiere acción urgente".

### §E.5 · 5 sugerencias UX concretas (NO implementación)

1. **Unificar /tesoreria/movimientos y /horizon/conciliacion** en una sola tab de Tesorería · hoy son dos URLs físicamente separadas para misma tarea conceptual · usuario alterna sin pista de cuál usar.
2. **Tooltips en cada chip de filtro y en cada KPI** · 0 tooltips actuales · `Tooltip` ya existe como componente (verificar `src/components/ui/`); coste de añadirlos es bajo y mejora discoverability sin cambios funcionales.
3. **Mostrar "Mis cuentas activas (N)" sobre los chips de filtro de Conciliación** · igual que TesoreriaPage filtra por `status==='ACTIVE'`, Conciliación debería deduplicar por estado y usar el mismo subscription `cuentasService.on(...)` (también arregla §B).
4. **Heurística fallback con CTA "Crear regla manual" + "Ignorar siempre patrón"** · transformar el paso muerto en oportunidad de enseñar · Jose dejaría de ver el mismo "Sin patrón reconocible" 30 veces.
5. **Bulk-confirm en Conciliación + "Aprobar matches automáticos sin revisar"** · botón único en KPI row para procesar todos los matches de confianza alta sin click-por-click; reduce clicks de 50 a 1 para 50 movements típicos del extracto mensual.

---

## §F · Asimetría inmueble vs personal en Tesorería

Aplica también, aunque diferente del caso compromisos:

### §F.1 · Confirmación de evento crea linea SOLO en INMUEBLE

```typescript
// treasuryConfirmationService.ts:319-332
const esLineaInmueble =
  !esTransfer &&
  existingEvent.ambito === 'INMUEBLE' &&
  (!!categoryDef?.storeName || !!existingEvent.categoryLabel);

const lineaStore: CategoriaStoreName | null = esLineaInmueble
  ? (categoryDef?.storeName ?? categoryLabelToStoreName(existingEvent.categoryLabel))
  : null;
```

Cuando `ambito === 'INMUEBLE'`, además del movement + treasuryEvent, se crea una línea en `gastosInmueble`/`mejorasInmueble`/`capexInmueble` (la categoría dicta el store). Cuando `ambito === 'PERSONAL'`, NO se crea ninguna línea equivalente.

```bash
$ grep -nE "gastosPersonal|gastos_personal" src/services/db.ts | head -5
1354:  gastosPersonalesEstimados: number;   // €/mes estimados
1355:  gastosPersonalesAjustadosPorUsuario: boolean;
2162:  // gastosPersonalesReal: ELIMINADO en V62 (sub-tarea 3) — futuro movements + treasuryEvents · 0 registros
```

→ El store `gastosPersonalesReal` fue **eliminado en V62** con la justificación "futuro movements + treasuryEvents". Esto es coherente con el modelo: personal no necesita una linea separada porque su único registro vive en `movements`+`treasuryEvents`.

### §F.2 · Detectar compromisos sigue siendo solo personal

```bash
$ grep -rnE "Detectar|detectarCompromiso" src/modules/inmuebles/ src/modules/personal/ --include="*.tsx" | head
src/modules/personal/pages/DetectarCompromisosPage.tsx:2  // ATLAS · TAREA 9.3 · DetectarCompromisosPage
src/modules/personal/pages/DetectarCompromisosPage.tsx:622:const DetectarCompromisosPage: React.FC = () => {
src/modules/personal/pages/DetectarCompromisosPage.tsx:810:  title="Detectar compromisos recurrentes"
src/modules/personal/pages/DetectarCompromisosPage.tsx:823:  { label: 'Detectar compromisos' },
src/modules/personal/pages/DetectarCompromisosPage.tsx:1051:export default DetectarCompromisosPage;
```

→ Solo en personal. Confirmado por T-COMPROMISOS-AUDIT § anterior. Tesorería hereda esta asimetría: cuando Jose añade un gasto personal repetitivo desde extracto, **no hay flujo "detectar y crear compromiso recurrente"** sin pasar por la página `/personal/gastos/detectar-compromisos`.

### §F.3 · Heurísticas sesgadas a INMUEBLE

5 de 6 heurísticas tienen `ambito: 'INMUEBLE'` por defecto (suministros, hipoteca, IBI, comunidad). Solo Amazon es PERSONAL explícito. Bizum es `assign_to_contract` (alquiler INMUEBLE). Para usuario con foco PERSONAL las sugerencias automáticas son menos útiles.

---

## §G · Veredicto · ranking de fix

| # | Problema | Tipo | Tiempo fix | Prioridad Jose dogfooder |
|---|---|---|---|---|
| 1 | Saldos no se actualizan al confirmar | **BUG REAL** (servicio existe, no se llama) | 1-2 h | **🔴 Crítica** · rompe la confianza en el saldo consolidado, KPI principal del módulo |
| 2 | Cuentas faltantes en filtro Conciliación | **BUG ARQUITECTÓNICO** (sin event-listener) | 30 min - 1 h | 🟠 Alta · bloquea filtrar por las cuentas nuevas hasta navegar fuera y volver |
| 3a | Dead code `conciliacionService.ts` | Saneamiento | 15 min | 🟢 Baja · 0 callers, deletable inmediato |
| 3b | 2 caminos manual vs extracto sin pista UX | **ARQUITECTURA por diseño** (mal documentada) | 3-4 h | 🟠 Alta · "está raro montado" textual de Jose |
| 4a | Fallback heurística "Sin patrón reconocible" inútil | UX + funcionalidad | 30 min - 3 h | 🟠 Alta · es lo que Jose ve constantemente |
| 4b | Heurísticas hardcoded sesgadas a INMUEBLE | Configuración | 2-4 h (extender catálogo) | 🟡 Media · funcional pero limitado |
| 5 | Densidad UI · 0 tooltips · 4 puntos entrada | **REDISEÑO UX parcial** | 6-10 h (rediseño full) o 2-3 h (tooltips + jerarquía mínima) | 🟡 Media · "todo eso me agobia" textual de Jose |
| F1 | Asimetría INMUEBLE/PERSONAL en linea creada al confirmar | Por diseño post-V62 | N/A · documentar | 🟢 Baja · arquitectura intencional |

### Resumen ejecutivo · ruta recomendada

**R4 · mezcla** · 1 bug crítico + 1 bug menor + 1 saneamiento dead code + 2 mejoras de heurística + 1 rediseño UX parcial.

**Orden propuesto a Jose** ·

1. **Spec corto · fix saldos (§A)** · 1-2 h CC · cierra el bug crítico que afecta confianza en KPI principal.
2. **Spec corto · fix filtro cuentas Conciliación + delete dead code conciliacionService (§B + §C.dead)** · 1-2 h CC · saneamiento + bug menor.
3. **Spec medio · heurística fallback útil + acción "Crear regla aprendida" desde fallback (§D)** · 3-5 h CC · cierra el bucle "Ignorar 30 veces lo mismo".
4. **Spec medio · unificación UX manual vs extracto + tooltips mínimos (§E.1, §E.2, §E.5)** · 3-4 h CC · sin rediseño full · sólo discoverability.
5. **(Opcional, decisión Jose)** · spec largo rediseño UI Tesorería completo · 6-10 h CC · si los pasos 1-4 no resuelven el agobio.

**No recomendado** · saltar al rediseño completo (R3) sin antes corregir §A · el bug de saldos rompe la confianza incluso en una UI nueva.

---

## §7 · Validaciones spec §5

- [x] Pre-flight §2 ejecutado · output literal pegado (§1.1 a §1.5)
- [x] §A saldos con matriz V11.3 + diagnóstico + tiempo
- [x] §B filtros con matriz V11.3 + cuentas faltantes explicadas (Ruta A timing + Ruta B ID)
- [x] §C validación manual + extracto con matriz V11.3 + tiempo
- [x] §D heurísticas con matriz V11.3 + Aplicar/Ignorar literal explicado
- [x] §E UX agobio · 5 sugerencias concretas (§E.5)
- [x] §F asimetría inmueble/personal documentada (3 sub-puntos)
- [x] §G veredicto · ruta R4 · justificada con orden ranking
- [x] CERO archivos de `src/` modificados
- [x] PR contra branch desarrollo (no main · spec dice main pero las instrucciones de la sesión obligan a `claude/treasury-audit-execution-i0ZuL`)
- [x] Resumen ejecutivo · 5 líneas (§0)

---

## §8 · Datos de firma

- **Fecha** · 2026-05-09
- **Commit base** · `11c8a85` (Merge PR #1312 · backlog audit)
- **Branch** · `claude/treasury-audit-execution-i0ZuL`
- **DB version** · 70 (literal `src/services/db.ts:28`)
- **Stores activos** · 40 (declarado en comentario v70 · `grep -cE "createObjectStore"` = 47 incluye renames de upgrade migrations)
- **Tiempo CC empleado** · ~50 min (dentro del rango 30-60 min de spec §4.7)

---

**Fin del informe.**
**CC entrega · NO mergea · espera autorización Jose.**
