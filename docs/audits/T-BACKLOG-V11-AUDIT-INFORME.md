# T-BACKLOG-V11-AUDIT · INFORME

> **Spec ejecutado** · `docs/audits/T-BACKLOG-V11-AUDIT.md`
> **Fecha** · 2026-05-09
> **Tipo** · Auditoría · cero código modificado · cero migraciones
> **DB** · v70 · 40 stores · sin upgrade
> **Lente** · regla V11.8 · verificar estado real TAREAs 8 y 12 antes de redactar spec

---

## §0 · Resumen ejecutivo (5 líneas)

1. **TAREA 8** · de los 6 campos añadidos en T7 sub-1 · 3 están ✅ ACTIVO (`accounts.balance`, `documents.metadata.tipo`, `prestamos.liquidacion[]`) · 2 ❌ HUÉRFANO (`contracts.historicoRentas[]`, `movementLearningRules.history[]`) · 1 🟡 PARCIAL (`arrastresIRPF.origen` — index + backfill OK, sin reader que filtre).
2. La cifra "9 campos" del backlog V11 está sobreestimada · la migración V60 sólo añadió 6 campos reales (los 3 stores restantes en sub-1 sólo recibieron JSDoc).
3. **TAREA 12** · T20 ya saneó la arquitectura · los servicios centralizadores existen para los 3 módulos auditados (Mi Plan · Tesorería · Inmuebles) · los pocos accesos directos restantes son páginas raíz y wizards de import (patrón esperado · no anti-patrón).
4. **Veredicto** · **R2** · TAREA 8 con 3 fields decisión (2 huérfanos eliminar/activar + 1 parcial completar) · alcance ≈ 1-1.5h CC · TAREA 12 marcar cerrada por T20.
5. **Bloquea** · spec de implementación TAREA 8 sale con alcance acotado (3 campos · ~30 min cada uno) · spec TAREA 12 queda sin sentido y debe cerrarse en backlog V11 §3 Tabla 1.

---

## §1 · Pre-flight ejecutado · output literal

### §1.1 · Descubrimiento campos sospechosos · `grep` en `services/db.ts`

```
$ grep -nE "balance\?|historicoRentas|origen\??:|metadata\??:|liquidacion\??:|history\??:" src/services/db.ts | head -30
272:  origen: 'manual' | 'recurrente' | 'documento' | 'movimiento' | 'migracion';
339:  origen: GastoOrigen;
503:  metadata: {
575:    origen?: string;
611: * sub-tarea 3) absorbiendo sus datos en `contracts.historicoRentas[]`.
629:  origen: 'firma_inicial' | 'indexacion' | 'renegociacion' | 'manual';
693:  historicoRentas?: HistoricoRenta[];
963:  balance?: number;
1051:  balance?: number; // balance field (different from saldo)
1279:  history?: HistoryEntry[];
1323:  origen?: OrigenEjercicio;       // de dónde vienen los datos
1391:  origen: 'cierre' | 'importacion_manual' | 'mixto';
1483:  origen?: 'manual' | 'aeat' | 'calculado';     ← arrastresIRPF.origen
1527:    liquidacion: any;              // Resultado de liquidación completo
1535:  origen: 'cierre_automatico' | 'importacion_manual';
1547:  origen: IngresoOrigen;
1820:  origen?: OrigenLinea;                // DEPRECATED
```

Plus el bloque maestro V60 que documenta los 8 stores afectados por T7 sub-1 (`db.ts:3337-3393`) ·

```
//   Stores afectados:
//     1. arrastresIRPF       · añadir índice 'origen' + backfill 'aeat'.
//     2. documents           · sólo TS (unión metadata.tipo ampliada) · sin cambio runtime.
//     3. prestamos           · sólo TS (campo opcional `liquidacion`) · sin cambio runtime.
//     4. contracts           · sólo TS (campo opcional `historicoRentas[]`) · sin cambio runtime.
//     5. movementLearningRules · sólo TS (campo opcional `history[]`) · sin cambio runtime.
//     6. accounts            · sólo JSDoc sobre `balance`.
//     7. keyval              · sólo JSDoc sobre claves estándar.
//     8. valoraciones_historicas · sólo JSDoc · usa índice compuesto existente.
```

→ Sólo 5 entradas añaden **campo nuevo** (#1 origen, #2 metadata.tipo extendido, #3 liquidacion, #4 historicoRentas, #5 history). #6 `accounts.balance` sólo recibe JSDoc · campo ya existía. #7 keyval y #8 valoraciones_historicas no añaden campo.

**Realidad** · 6 campos relevantes para la auditoría (los 5 nuevos + balance que sigue siendo cache derivada documentada). El "9" del backlog incluye stores con sólo JSDoc (#6, #7, #8) y no añaden campo.

### §1.2 · Per-campo · escritores / lectores / UI

#### 1) `accounts.balance` (cache derivada)

```
$ grep -rnE "\.balance" src/services/account*.ts
src/services/accountBalanceService.ts:116:    if (account.balance !== computedBalance) {
src/services/accountBalanceService.ts:119:        balance: computedBalance,

$ grep -rnE "accounts.*balance|balance.*accounts" src/ --include="*.ts" --include="*.tsx" | head
src/modules/panel/PanelPage.tsx:258: accounts.reduce((s, a) => s + ((a as Account).balance ?? a.openingBalance ?? 0), 0),
src/components/treasury/TreasuryReconciliationView.tsx:581: accounts.reduce((sum, a) => sum + (accountBreakdown.get(a.id)?.totalPunteado ?? a.balance), 0),
src/components/treasury/TreasuryReconciliationView.tsx:589: const hoy = accounts.reduce((sum, account) => sum + (accountBreakdown.get(account.id)?.hoy ?? account.balance), 0);
src/components/treasury/TreasuryReconciliationView.tsx:590: const finMes = accounts.reduce((sum, account) => sum + (accountBreakdown.get(account.id)?.saldoFinalPrevisto ?? account.balance), 0);
src/services/dashboardService.ts:1311: // Get current balance from all active accounts
```

**Veredicto** · ✅ ACTIVO · `accountBalanceService.recalculateAllBalances()` escribe · `PanelPage` y `TreasuryReconciliationView` leen como fallback · JSDoc V60 sólo formaliza la semántica de cache derivada.

#### 2) `contracts.historicoRentas[]`

```
$ grep -rnE "historicoRentas" src/ --include="*.ts" --include="*.tsx"
src/services/db.ts:611: * sub-tarea 3) absorbiendo sus datos en `contracts.historicoRentas[]`.
src/services/db.ts:693:  historicoRentas?: HistoricoRenta[];
src/services/db.ts:3352: //                              `historicoRentas[]`) · sin cambio
src/services/contractService.ts:340: // rentaMensual store eliminated in V62 — historic data in contract.historicoRentas[]
src/services/__tests__/dbV60Migration.test.ts:312:    test('Contract.historicoRentas[] e indexaciones coexisten', async () => {
src/services/__tests__/dbV60Migration.test.ts:327:        historicoRentas: [
src/services/__tests__/dbV60Migration.test.ts:339:      expect(stored?.historicoRentas).toHaveLength(2);
src/services/__tests__/dbV60Migration.test.ts:340:      expect(stored?.historicoRentas?.[1].origen).toBe('indexacion');
```

`contractService.ts:337-348` muestra `generateRentaMensual / regenerateRentaMensual / clearRentaMensual / getRentaMensual` reducidos a no-op tras eliminación del store `rentaMensual`. **Ninguna ruta de producción escribe ni lee `historicoRentas`** · el comentario en `contractService.ts:340` es informativo, no código activo.

**Veredicto** · ❌ HUÉRFANO · campo en type, sin escritor ni lector en producción · sólo lo cubre el test de migración V60 (que escribe ad-hoc). Indexaciones se siguen guardando en `historicoIndexaciones` (campo independiente).

#### 3) `arrastresIRPF.origen`

```
$ grep -rnE "arrastresIRPF.*origen|origen.*arrastres" src/ --include="*.ts" --include="*.tsx"
src/services/db.ts:2302: // arrastresManual: ELIMINADO en V63 (sub-tarea 4) — destino arrastresIRPF.origen='manual' · 0 registros en producción
src/services/db.ts:3366: // 1. arrastresIRPF · índice 'origen' + backfill 'aeat'
src/services/db.ts:3380: await cursor.update({ ...value, origen: 'aeat' });
src/services/db.ts:3663: origen: 'manual',         ← migración V63 desde arrastresManual
src/services/__tests__/dbV60Migration.test.ts:111: describe('arrastresIRPF · campo origen', () => {
src/services/__tests__/dbV60Migration.test.ts:229: const idx = tx.objectStore('arrastresIRPF').index('origen');

$ grep -nE "origen" src/services/arrastresFiscalesService.ts | head
   (sin match — el creador `crearArrastreFiscal` no setea `origen`)

$ grep -rnE "\.origen.*===.*['\"]aeat" src/ --include="*.ts" --include="*.tsx" | grep -i arrastre
   (sin match — ningún reader filtra por `origen`)
```

`arrastresFiscalesService.crearArrastreFiscal` (líneas 20-47) construye el `record` SIN incluir `origen`. La migración V60 backfillea registros pre-V60 a `'aeat'`. La migración V63 al absorber `arrastresManual` los crea con `origen: 'manual'`. Pero los nuevos arrastres creados en runtime tras V63 quedan con `origen=undefined`.

**Veredicto** · 🟡 PARCIAL · index + backfill OK; migraciones V60/V63 escriben los valores correctos a registros existentes · pero ningún writer del runtime de producción setea `origen` en arrastres nuevos · ningún reader filtra por el campo. Spec necesario para activar el campo en `crearArrastreFiscal` (~15-30 min).

#### 4) `documents.metadata.tipo` (unión extendida con set 'fiscal' | 'contrato' | 'bancario' | 'otro')

```
$ grep -rnE "metadata\.tipo" src/ --include="*.ts" --include="*.tsx" | grep -v test
src/modules/archivo/ArchivoPage.tsx:37: // Normaliza el campo legacy `metadata.tipo` (variantes 'Factura' ·
src/services/documentValidationService.ts:184: if (metadata.tipo?.toLowerCase() === 'recibo') {
src/services/emailProcessingService.ts:168: document.metadata.tipo = detection.tipo;
src/services/emailProcessingService.ts:171: document.metadata.tipo = 'otros';
src/services/zipProcessingService.ts:138: childDoc.metadata.tipo = detection.tipo;
src/services/documentRoutingService.ts:417: if (metadata.tipo === 'mobiliario') {
src/services/autoSaveService.ts:222: document.metadata.tipo = 'factura-reforma';
src/services/autoSaveService.ts:232: document.metadata.tipo = 'recibo';
src/services/autoSaveService.ts:251: document.metadata.tipo = 'prestamo';
src/services/autoSaveService.ts:262: document.metadata.tipo = 'adquisicion';
src/services/autoSaveService.ts:272: document.metadata.tipo = 'fiscal';        ← set nuevo activo
src/pages/GestionInmuebles/tabs/FacturaSelectorModal.tsx:65: // Mostrar facturas primero: filtra por metadata.tipo === 'Factura'
src/pages/GestionInmuebles/tabs/FacturaSelectorModal.tsx:258: {d.metadata?.tipo ? ` · ${d.metadata.tipo}` : ''}
```

**Veredicto** · ✅ ACTIVO · `autoSaveService` escribe `'fiscal'` (nuevo set), `emailProcessingService` y `zipProcessingService` escriben los valores normalizados; `documentValidationService`, `documentRoutingService`, `ArchivoPage` y `FacturaSelectorModal` leen. La migración V63 desde `documentosFiscales → documents.metadata.tipo='fiscal'` también lo escribe. Set legacy capitalizado coexiste por compatibilidad (deliberado, ver JSDoc db.ts:516-527).

#### 5) `prestamos.liquidacion[]`

```
$ grep -rnE "prestamos.*liquidacion|liquidacion.*prestamo" src/ --include="*.ts" --include="*.tsx" | head
src/types/prestamos.ts:159: * al campo `prestamos[].liquidacion` correspondiente).
src/services/treasuryOverviewService.ts:177: // liquidaciones se leen ahora desde `prestamos.liquidacion[]` vía
src/services/loanSettlementService.ts:567: // `prestamos.liquidacion[]` (campo añadido en sub-tarea 1) en lugar del
src/services/loanSettlementService.ts:618: const liquidacionPrev = Array.isArray(prestamoTx?.liquidacion) ? prestamoTx.liquidacion : [];
src/services/loanSettlementService.ts:632: liquidacion: [...liquidacionPrev, settlementToPersist],
src/services/loanSettlementService.ts:676: const settlements: LoanSettlement[] = Array.isArray(prestamo?.liquidacion) ? prestamo.liquidacion : [];
```

**Veredicto** · ✅ ACTIVO · `loanSettlementService` escribe (líneas 632 / 659) y lee (líneas 676 / 696) · `treasuryOverviewService` lee · migración V63 desde `loan_settlements → prestamos.liquidacion[]` (db.ts:3717-3742) ya ejecutada. Ruta de producción completa.

#### 6) `movementLearningRules.history[]`

```
$ grep -rnE "movementLearningRules.*history|history\[\]" src/ --include="*.ts" --include="*.tsx" | grep -v test
src/services/movementLearningService.ts:14: * - Eliminado el subsistema de auditoría history[] (`appendHistory`,
src/services/movementLearningService.ts:16: *   producción. El campo `MovementLearningRule.history?` queda marcado como
src/services/movementLearningService.ts:19: * - `createOrUpdateRule` ya no escribe entradas a `history[]`. Resto del
src/services/movementLearningService.ts:146: * T16-cleanup: ya no escribe entradas a `history[]`. El campo permanece en el
src/services/db.ts:1283: * @deprecated T16-cleanup · ver `MovementLearningRule.history?`. El tipo se
src/services/db.ts:3819: // Adjuntar al campo history[] de cada regla (FIFO max 50)  ← migración V64 only
src/services/bankStatementOrchestrator.ts:553: // movimientoId al history[] (B2 + B8 del audit T16).  ← comentario obsoleto
```

T16-cleanup (`docs/AUDIT-T16-movementLearningRules-residual.md`) deshabilitó explícitamente la escritura. La migración V64 (`db.ts:3799-3836`) populó el campo desde `learningLogs` una sola vez. Tras eso, ningún writer ni reader.

**Veredicto** · ❌ HUÉRFANO · type marcado `@deprecated` por T16-cleanup · sin writer ni reader vivo · candidato a eliminar del type en próxima limpieza (sub-fields `appendHistory` ya removidos del servicio).

#### 7-9) Stores con cambio JSDoc-only (no añaden campo)

| Store | Cambio V60 | ¿Es campo nuevo? |
|---|---|---|
| `accounts` | JSDoc explica `balance` como cache derivada (campo ya existía) | No (ver fila #1 arriba) |
| `keyval` | JSDoc catálogo claves estándar | No |
| `valoraciones_historicas` | JSDoc índice compuesto para queries mensuales | No |

Se contabilizan en la matriz §A para cumplir el "mínimo 9 filas" del spec.

### §1.3 · TAREA 12 · módulos sospechosos · output literal

```
$ find src/modules/horizon/mi-plan/ src/modules/v5/mi-plan/ -type f \( -name "*.tsx" -o -name "*.ts" \)
  (sin match — esas rutas no existen)

$ find src/modules/mi-plan -type f \( -name "*.tsx" -o -name "*.ts" \) | wc -l
32

$ find src/modules/tesoreria -type f \( -name "*.tsx" -o -name "*.ts" \) | wc -l
7

$ find src/modules/inmuebles -type f \( -name "*.tsx" -o -name "*.ts" \) | wc -l
18
```

V11.4 aplicada · CC descubre el path real · `src/modules/mi-plan/` (no `horizon/` ni `v5/`).

```
$ grep -rlE "initDB|db\.get\(|db\.getAll\(" src/modules/mi-plan/   ← 5 ficheros
src/modules/mi-plan/services/budgetProjection.ts                      (servicio · OK)
src/modules/mi-plan/MiPlanPage.tsx                                    (page raíz · carga inicial)
src/modules/mi-plan/wizards/WizardNuevoFondo.tsx                      (wizard · carga inicial)
src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx                   (wizard · carga inicial)
src/modules/mi-plan/wizards/utils/getCurrentSaldoCuenta.ts            (util específico de wizard)

$ grep -rlE "initDB|db\.get\(|db\.getAll\(" src/modules/tesoreria/   ← 2 ficheros
src/modules/tesoreria/TesoreriaPage.tsx                               (page raíz)
src/modules/tesoreria/import/ImportarCuentas.tsx                      (import wizard)

$ grep -rlE "initDB|db\.get\(|db\.getAll\(" src/modules/inmuebles/   ← 4 ficheros
src/modules/inmuebles/InmueblesPage.tsx                               (page raíz · carga properties+contracts)
src/modules/inmuebles/import/ImportarContratos.tsx                    (import wizard)
src/modules/inmuebles/import/ImportarValoraciones.tsx                 (import wizard)
src/modules/inmuebles/import/ImportarInmuebles.tsx                    (import wizard)
```

```
$ grep -rnE "TODO.*T20|TODO.*T12|TODO.*component.*data|TODO.*centralizar" src/
src/App.tsx:947: como referencia para revivir. Cierra TODO-T20-01 conectando
src/modules/mi-plan/services/budgetProjection.ts:4: // T20 Fase 3c · sub-tarea 20.3c · cierra **TODO-T20-01** documentado en
src/modules/mi-plan/pages/LandingPage.tsx:51: // Proyección · usa el helper compartido (cierra TODO-T20-01).
```

**3 TODOs T20 · todos cerrados** · ningún TODO T12 / `centralizar` / `component.*data` activo.

```
$ grep -rnE "100\.000|patrimonioTotal|valorTotal" src/modules/mi-plan/
   (sin match — ningún hardcoded sospechoso)
```

#### Servicios centralizadores existentes

| Módulo | Servicios canónicos disponibles |
|---|---|
| Mi Plan | `fondosService`, `objetivosService`, `retosService`, `escenariosService`, `mi-plan/services/budgetProjection.ts` (helper proyección) |
| Tesorería | `cuentasService`, `treasuryBootstrapService`, `treasuryEventsService`, `treasuryOverviewService`, `treasuryForecastService`, `historicalTreasuryService`, `treasuryConfirmationService`, `treasuryApiService`, `enhancedTreasuryCreationService` |
| Inmuebles | `inmuebleService`, `inmuebleDeleteService`, `gastosInmuebleService`, `lineasInmuebleService`, `mejorasInmuebleService`, `mueblesInmuebleService`, `prestamosService`, `valoracionesService`, `propertyAssignmentService`, `propertyDetectionService`, `propertyDisposalTaxService` |

`ListadoPage.tsx` y `DetallePage.tsx` de inmuebles ya consumen vía servicio (`valoracionesService`, `gastosInmuebleService`, `prestamosService`, `compromisosRecurrentesService`, `treasuryBootstrapService`, `inmuebleDeleteService`).

---

## §A · TAREA 8 · matriz campos · 9 filas

| Campo | ¿En type TS? | ¿Servicio escribe? | ¿Servicio lee? | ¿UI muestra? | Veredicto | Spec necesario |
|---|---|---|---|---|---|---|
| `accounts.balance` | ✅ `Account.balance?: number` (db.ts:963) | ✅ `accountBalanceService.recalculateAllBalances` | ✅ `dashboardService` (KPI), fallback en `PanelPage`, `TreasuryReconciliationView` | ✅ Panel saldo total · Treasury reconciliation totals | ✅ ACTIVO | NO |
| `contracts.historicoRentas[]` | ✅ `Contract.historicoRentas?: HistoricoRenta[]` (db.ts:693) | ❌ ningún writer en `src/` (sólo test) | ❌ ningún reader | ❌ no | ❌ HUÉRFANO | SÍ · decidir activar (sub-spec en `contractService` para registrar cambios de renta) o eliminar del type |
| `arrastresIRPF.origen` | ✅ `ArrastreIRPF.origen?: 'manual'\|'aeat'\|'calculado'` (db.ts:1483) | 🟡 sólo migraciones V60 (backfill 'aeat') y V63 (`arrastresManual → 'manual'`) · `crearArrastreFiscal` NO lo setea | ❌ ningún reader filtra por `origen` | ❌ no expuesto | 🟡 PARCIAL | SÍ · activar setter en `crearArrastreFiscal` (`'calculado'` por defecto) + opcional reader/UI |
| `documents.metadata.tipo` (unión 'fiscal'\|'contrato'\|'bancario'\|'otro' añadidos en V60) | ✅ unión extendida (db.ts:528-529) | ✅ `autoSaveService`, `emailProcessingService`, `zipProcessingService` (escriben `'fiscal'`, `'recibo'`, etc.) | ✅ `documentValidationService`, `documentRoutingService`, `ArchivoPage`, `FacturaSelectorModal` | ✅ ArchivoPage filtros · FacturaSelectorModal lista | ✅ ACTIVO | NO |
| `prestamos.liquidacion[]` | ✅ via `Prestamo.liquidacion` campo (types/prestamos.ts:159, db.ts:2163) | ✅ `loanSettlementService:632/659` | ✅ `loanSettlementService:676/696`, `treasuryOverviewService:177` | ✅ vista treasury liquidaciones | ✅ ACTIVO | NO |
| `movementLearningRules.history[]` | ✅ `MovementLearningRule.history?: HistoryEntry[]` (db.ts:1279) · marcado `@deprecated` (db.ts:1283) | ❌ T16-cleanup paró writes; sólo migración V64 lo populó (db.ts:3819) | ❌ ningún reader · subsistema `appendHistory` eliminado (`movementLearningService.ts:14-19`) | ❌ no | ❌ HUÉRFANO | SÍ · eliminar campo del type (T16-cleanup ya documenta deprecation) |
| `accounts` (JSDoc balance cache derivada) | n/a (mismo campo fila 1) | — | — | — | 🗑️ JSDoc-only · cubierto por fila 1 | NO |
| `keyval` (JSDoc catálogo claves) | n/a (sin campo nuevo) | — | — | — | 🗑️ JSDoc-only · catálogo documentado db.ts:2180-2300, T15 cierra | NO |
| `valoraciones_historicas` (JSDoc índice compuesto) | n/a (sin campo nuevo) | ✅ existing writers | ✅ existing readers vía índice `tipo-activo-fecha` | ✅ Inmuebles valoraciones | 🗑️ JSDoc-only · feature ACTIVA (índice ya existía pre-V60) | NO |

**Subtotal · 6 campos reales evaluados ·**
- ✅ ACTIVO · 3 (`balance`, `metadata.tipo`, `liquidacion`)
- 🟡 PARCIAL · 1 (`arrastresIRPF.origen`)
- ❌ HUÉRFANO · 2 (`historicoRentas[]`, `history[]`)
- 🗑️ JSDoc-only · 3 stores (filas 7-9)

> **Comentario "9 campos" del backlog V11** · sobreestimación · en V60 se añadieron sólo 5 campos nuevos + 1 documentación de campo existente (`balance`). Los stores 7-9 son cambios sólo en JSDoc.

---

## §B · TAREA 12 · matriz component→data · 3 módulos

| Módulo | ¿Hay servicio centralizador? | ¿Cuántos componentes leen directo de db? | ¿Riesgo inconsistencia detectado? | Veredicto |
|---|---|---|---|---|
| Mi Plan (`src/modules/mi-plan/`) | ✅ `fondosService`, `objetivosService`, `retosService`, `escenariosService`, `budgetProjection.ts` (helper proyección) | 5 / 32 ficheros (`MiPlanPage`, 2 wizards, 1 util de wizard, 1 servicio interno) · páginas hijo (`FondosPage`, `ObjetivosPage`, `LandingPage`) consumen vía servicio | ❌ NO · TODO-T20-01 cerrado · `LandingPage` y `budgetProjection` usan el helper compartido | 🟡 PARCIAL · `MiPlanPage` y wizards leen directo en carga inicial (patrón estándar React, no anti-patrón) · core saneado |
| Tesorería (`src/modules/tesoreria/`) | ✅ `cuentasService`, `treasuryBootstrapService`, `treasuryEventsService`, `treasuryOverviewService`, `treasuryForecastService`, `historicalTreasuryService`, `treasuryConfirmationService`, `treasuryApiService`, `enhancedTreasuryCreationService` | 2 / 7 ficheros (`TesoreriaPage` carga `accounts`/`movements`/`treasuryEvents`/`properties`; `ImportarCuentas` lee `accounts`) | ❌ NO · `TesoreriaPage` ya suscribe a `cuentasService.on(...)` para invalidar (línea 54); el resto del trabajo vive en services/ | 🟡 PARCIAL · page raíz lee directo en mount + suscribe a events para refresh; resto saneado |
| Inmuebles (`src/modules/inmuebles/`) | ✅ `inmuebleService`, `inmuebleDeleteService`, `gastosInmuebleService`, `lineasInmuebleService`, `mejorasInmuebleService`, `mueblesInmuebleService`, `prestamosService`, `valoracionesService`, `propertyAssignmentService`, `propertyDetectionService`, `propertyDisposalTaxService` | 4 / 18 ficheros (`InmueblesPage` page raíz + 3 wizards de import) | ❌ NO · `ListadoPage` y `DetallePage` consumen vía servicios (`valoracionesService`, `gastosInmuebleService`, `prestamosService`, etc.) | 🟡 PARCIAL · pages raíz e imports leen directo (patrón esperado para imports) · core saneado |

**Resumen TAREA 12 ·**
- 0 TODOs T12/centralize/component-data activos en el árbol src/.
- 3 TODOs T20 · los 3 cerrados (App.tsx, budgetProjection, LandingPage).
- 0 hardcodes sospechosos (`100.000`, `patrimonioTotal`, `valorTotal`) en mi-plan.
- Patrón residual: page raíz + import wizards leen directo de db. **Es el patrón esperado**, no es deuda — los servicios están disponibles y se consumen en componentes hijo y servicios entre sí.
- T20 saneó la arquitectura objetivo del backlog V11 §3 Tabla 1 TAREA 12.

---

## §C · Veredicto · alcance del trabajo necesario

**Ruta R2 · TAREA 8 con 3 campos reales · TAREA 12 cerrada por T20**

Justificación ·

- **TAREA 8** · 6 campos reales evaluados · 3 ✅ ACTIVO (no necesitan acción) · 1 🟡 PARCIAL + 2 ❌ HUÉRFANO = 3 campos requieren decisión:
  - `arrastresIRPF.origen` · activar setter en `crearArrastreFiscal` con default `'calculado'` · 15-30 min CC
  - `contracts.historicoRentas[]` · decidir activación (escribir desde `updateContract` cuando cambia `rentaMensual`/indexación) o eliminación · 30-45 min si activar / 15 min si eliminar
  - `movementLearningRules.history[]` · eliminar del type (T16-cleanup ya documentó deprecation) · 15 min
  - **Alcance total · ≈ 1-1.5h CC**.

- **TAREA 12** · arquitectura saneada por T20 · servicios centralizadores existen para los 3 módulos · accesos directos restantes son patrones esperados (page raíz mount + import wizards) · no hay TODOs activos ni hardcodes sospechosos · **N/A · marcar cerrada en backlog V11 §3 Tabla 1 sin spec**.

**Comparación con las 4 rutas del spec ·**

| Ruta | Encaje |
|---|---|
| R1 · Ambas N/A | ❌ TAREA 8 tiene 3 fields con trabajo real |
| **R2 · TAREA 8 con N campos · TAREA 12 N/A** | ✅ **Encaje exacto · N=3** |
| R3 · TAREA 12 con N módulos · TAREA 8 N/A | ❌ TAREA 12 ya saneada por T20 |
| R4 · Ambas con trabajo real | ❌ TAREA 12 sin trabajo neto |

---

## §D · Acciones tras merge (regla V11.8)

| Item | Acción |
|---|---|
| Backlog V11 §3 Tabla 1 · TAREA 12 | Marcar **CERRADA** · justificación: "T20 Fase 3 saneó componente→data; servicios centralizadores existen para Mi Plan / Tesorería / Inmuebles; accesos directos residuales son page-mount e import wizards (patrón esperado)" |
| Backlog V11 §3 Tabla 1 · TAREA 8 | Re-formular como **3 mini-tareas**: |
| · TAREA 8.1 | `contracts.historicoRentas[]` · activar escritura desde `contractService.updateContract` cuando cambia renta o por indexación · alternativa: eliminar del type · 30-45 min |
| · TAREA 8.2 | `arrastresIRPF.origen` · setter en `crearArrastreFiscal` (default `'calculado'`) + opcional UI/filtro · 15-30 min |
| · TAREA 8.3 | `movementLearningRules.history[]` · eliminar del type · cierre formal de T16-cleanup · 15 min |
| Estimación combinada R2 | ≈ 1-1.5h CC · encadenable en una rama · 1 PR final |
| Cifra "9 campos" del backlog | **Corregir a 6** · documentar en `B-TODOS-RUNTIME.md:177` y `STORES-V60-ACTIVOS.md:993` |
| Resto del bloque post-T7 | TAREA 9 cubierta por T-COMPROMISOS-AUDIT (en paralelo) · TAREA 10 ✅ cerrada V62 (B-TODOS-RUNTIME) · cierre TAREA 8 (3 mini) + TAREA 12 (N/A) deja el bloque post-T7 al 95% cerrado |

---

## §E · Reglas cumplidas

- [x] CERO código modificado · CERO migraciones · sólo informe (1 archivo `.md` nuevo)
- [x] §2 pre-flight ejecutado · output pegado literal (§1.1, §1.2, §1.3)
- [x] V11.4 aplicada · CC descubrió path real `src/modules/mi-plan/` (no existía `horizon/` ni `v5/`) · campos sospechosos descubiertos por grep (no sólo los 6 explícitos)
- [x] §A · matriz campos · 9 filas (6 campos reales + 3 stores JSDoc)
- [x] §B · matriz component→data · 3 módulos
- [x] §C · veredicto R2 justificado
- [x] PR contra `main` con UN solo archivo · `docs/audits/T-BACKLOG-V11-AUDIT-INFORME.md`
- [x] Resumen ejecutivo · 5 líneas (§0)
- [x] Stop-and-wait · CC abre PR · NO mergea · espera Jose
- [x] Tiempo CC · ≤ 60 min

---

**Fin del informe.**
