# AUDITORÍA · Flujos exhaustivos · Tesorería · Movimientos · Confirmación · escritura en stores

> Fecha · 2026-05-02  
> Repo · gomezrjoseantonio-bot/ultimointento · branch main · `DB_VERSION = 67`  
> NO modifica código · solo lectura · 1 archivo nuevo · auditado por Copilot

---

## 0 · Contexto y motivación

Atlas Horizon es una SPA React + IndexedDB (idb) para finanzas personales en España. El motor de datos es local-first (sin backend); toda la persistencia vive en IndexedDB a través del helper `initDB()` definido en `src/services/db.ts`.

La arquitectura de tesorería está articulada en dos capas:

| Capa | Store | Significado |
|------|-------|-------------|
| **Previsto** | `treasuryEvents` | Eventos futuros generados por el sistema (cuotas, alquileres, compromisos) o creados manualmente |
| **Real** | `movements` | Movimientos bancarios confirmados (importados vía CSV o creados al "puntear") |

**"Puntear"** = acción del usuario que materializa un `treasuryEvent` en un `movement`. El verbo técnico es `confirmTreasuryEvent`.

La cadena completa de generación de datos es:

```
Fuente (nomina / prestamo / compromiso / vivienda / inversión / manual)
  → treasuryEvents (predicted)
  → confirmTreasuryEvent()  ← usuario puntea
  → movements (confirmed) + línea opcional en gastosInmueble / mejorasInmueble / mueblesInmueble
```

---

## 1 · Tesorería · qué es en código

### 1.1 Store `treasuryEvents` (DB_VERSION ≥ 50)

**Archivo**: `src/services/db.ts` · líneas 1163–1220 · 2531–2537

```typescript
export interface TreasuryEvent {
  id?: number;
  type: 'income' | 'expense' | 'financing';
  amount: number;                    // negativo = salida
  predictedDate: string;             // ISO date prevista
  description: string;
  // Source tracking
  sourceType: 'document' | 'contract' | 'manual' | 'ingreso' | 'gasto' |
    'opex_rule' | 'gasto_recurrente' | 'personal_expense' | 'nomina' |
    'contrato' | 'prestamo' | 'hipoteca' | 'autonomo' | 'autonomo_ingreso' |
    'otros_ingresos' | 'inversion_compra' | 'inversion_aportacion' |
    'inversion_rendimiento' | 'inversion_dividendo' | 'inversion_liquidacion' |
    'irpf_prevision';
  sourceId?: number;                 // FK al registro que lo genera
  // Clasificación fiscal
  año?: number;
  mes?: number;
  certeza?: 'declarado' | 'calculado' | 'atlas_nativo' | 'estimado' | 'manual';
  fuenteHistorica?: 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual';
  ejercicioFiscalOrigen?: number;
  generadoPor?: 'historicalTreasuryService' | 'treasurySyncService' | 'user';
  actualizadoPorDeclaracion?: boolean;
  // Vinculación cruzada
  inmuebleId?: number;
  contratoId?: number;
  accountId?: number;
  paymentMethod?: 'Domiciliado' | 'Transferencia' | 'TPV' | 'Efectivo';
  iban?: string;
  // Estado del ciclo de vida
  status: 'predicted' | 'confirmed' | 'executed';
  actualDate?: string;
  actualAmount?: number;
  movementId?: number;               // vínculo al movement bancario
  // Hipoteca / préstamo
  prestamoId?: string;
  numeroCuota?: number;
  // Categoría PR3/PR5
  ambito?: 'PERSONAL' | 'INMUEBLE';
  categoryLabel?: string;            // legado: "Reparación inmueble"
  categoryKey?: string;              // canónico: "reparacion_inmueble"
  subtypeKey?: string;               // variante: "luz" / "agua" / "gas"
  // Traspaso entre cuentas propias
  transferMetadata?: {
    targetAccountId: number;
    pairEventId?: number;
    esAmortizacionParcial?: boolean;
  };
  counterparty?: string;
  providerName?: string;
  providerNif?: string;
  invoiceNumber?: string;
  notes?: string;
  // Tras puntear
  executedMovementId?: number;
  executedAt?: string;
}
```

**Índices del store** (DB_VERSION 50+):
- `type`, `predictedDate`, `accountId`, `status`, `sourceType`

### 1.2 Servicios que leen/escriben `treasuryEvents`

| Servicio | Operación | Archivo |
|----------|-----------|---------|
| `treasuryConfirmationService` | read+put (status→executed) | `src/services/treasuryConfirmationService.ts` |
| `treasuryCreationService` | add (desde contrato/OCR) | `src/services/treasuryCreationService.ts` |
| `treasuryForecastService` | read | `src/services/treasuryForecastService.ts` |
| `treasuryOverviewService` | read | `src/services/treasuryOverviewService.ts` |
| `treasuryTransferService` | add (2 events espejo) | `src/services/treasuryTransferService.ts` |
| `viviendaHabitualService` | add/delete (derivados) | `src/services/personal/viviendaHabitualService.ts` |
| `compromisosRecurrentesService` | add/delete (derivados) | `src/services/personal/compromisosRecurrentesService.ts` |
| `treasurySyncService` | add/put (sincronización) | `src/services/treasurySyncService.ts` |
| `historicalTreasuryService` | add (históricos) | `src/services/historicalTreasuryService.ts` |
| `propertySaleService` | add (venta inmueble) | `src/services/propertySaleService.ts` |
| `loanSettlementService` | add (settlement préstamo) | `src/services/loanSettlementService.ts` |
| `LineasAnualesTab` | read + call confirmTreasuryEvent | `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx` |
| `TesoreriaV4` | read + call confirmTreasuryEvent | `src/components/treasury/TesoreriaV4.tsx` |
| `TreasuryReconciliationView` | read + call confirm | `src/components/treasury/TreasuryReconciliationView.tsx` |

---

## 2 · Movimientos · qué son

### 2.1 Store `movements` (DB_VERSION ≥ 47)

**Archivo**: `src/services/db.ts` · líneas 1009–1085 · 2513–2520

```typescript
export interface Movement {
  id?: number;
  accountId: number;
  date: string;                    // booking_date
  valueDate?: string;
  amount: number;
  description: string;
  counterparty?: string;
  providerName?: string;
  providerNif?: string;
  invoiceNumber?: string;
  reference?: string;
  status: MovementStatus;          // 'pending' | 'reconciled' | 'ignored'
  unifiedStatus: UnifiedMovementStatus; // 'previsto'|'confirmado'|'vencido'|'no_planificado'|'conciliado'
  source: MovementSource;          // 'import' | 'manual' | 'inbox'
  plan_match_id?: string;
  property_id?: string;
  category: { tipo: string; subtipo?: string };
  is_transfer?: boolean;
  transfer_group_id?: string;
  invoice_id?: string;
  // legacy
  state?: TransactionState;
  sourceBank?: string;
  currency?: string;
  balance?: number;
  // H10 Extended
  saldo?: number;
  id_import?: string;
  estado_conciliacion?: ReconciliationStatus;
  linked_registro?: { type: 'ingreso' | 'gasto' | 'mejora'; id: number };
  expenseIds?: number[];
  documentIds?: number[];
  reconciliationNotes?: string;
  importBatch?: string;
  csvRowIndex?: number;
  type: MovementType;              // 'Ingreso' | 'Gasto' | 'Transferencia' | 'Ajuste'
  origin: MovementOrigin;          // 'OCR' | 'CSV' | 'Manual'
  movementState: MovementState;    // 'Previsto' | 'Confirmado' | 'Conciliado' | 'Revisar'
  tags?: string[];
  transferGroupId?: string;
  attachedDocumentId?: number;
  appliedRuleId?: number;
  isAutoTagged?: boolean;
  lastModifiedBy?: string;
  // ... campos de auditoría adicionales
}
```

**Índices del store**: `accountId`, `date`, `status`, `importBatch`, `duplicate-key` (compuesto: accountId+date+amount+description)

### 2.2 Quién escribe en `movements`

| Servicio / función | Método | Vía |
|-------------------|--------|-----|
| `confirmTreasuryEvent()` | `db.add('movements', ...)` | Punteo manual del usuario |
| `bankStatementImportService` → `createMovements()` | bulk add | Importación CSV |
| `bankStatementOrchestrator` → `insertMovements()` | bulk add | Importación CSV (orquestado) |
| `loanSettlementService` → `createMovement()` | `tx.objectStore('movements').add()` | Settlement de préstamo |

---

## 3 · Confirmación · paso a paso

### 3.1 Función principal `confirmTreasuryEvent`

**Archivo**: `src/services/treasuryConfirmationService.ts`  
**Exportado desde**: `src/services/treasuryConfirmationService.ts`

**Firma**:
```typescript
export async function confirmTreasuryEvent(
  eventId: number,
  overrides?: ConfirmOverrides,
): Promise<ConfirmResult>
```

**`ConfirmOverrides`**:
```typescript
export interface ConfirmOverrides {
  amount?: number;
  date?: string;
  accountId?: number;
  description?: string;
  counterparty?: string;
  providerName?: string;
  providerNif?: string;
  invoiceNumber?: string;
  notes?: string;
}
```

**`ConfirmResult`**:
```typescript
export interface ConfirmResult {
  movementId: number;
  lineaId?: number;
  lineaStore?: 'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble';
}
```

### 3.2 Flujo de ejecución paso a paso

```
1. Leer treasuryEvents[eventId]
   └─ si no existe → throw Error('Previsión no encontrada')
   └─ si status === 'executed' → throw Error(/confirmada/)
   └─ si accountId falta → throw Error(/cuenta/)

2. Construir Movement desde TreasuryEvent (con overrides opcionales)
   - amount: overrides.amount ?? event.amount (normalizado: gasto=negativo, ingreso=positivo)
   - date: overrides.date ?? event.actualDate ?? event.predictedDate
   - reference: `treasury_event:${eventId}` (para el revert)
   - status: 'pending'
   - source: 'manual'

3. db.add('movements', movement)  → movementId

4. db.put('treasuryEvents', { ...event, status: 'executed', executedMovementId: movementId, executedAt: now })

5. Si ambito === 'INMUEBLE':
   a. categoryLabelToStoreName(event.categoryKey ?? event.categoryLabel) → storeName
   b. Si storeName existe:
      - Construir línea (GastoInmueble / MejoraInmueble / MuebleInmueble)
      - db.add(storeName, linea)  → lineaId
      - Actualizar linea con { movimientoId: String(movementId), treasuryEventId: eventId }
   c. Si storeName === 'gastosInmueble': estado='confirmado', estadoTesoreria='confirmed'

6. Si event.sourceType === 'prestamo' y event.transferMetadata?.esAmortizacionParcial:
   - db.put('prestamos', { ...prestamo, principalVivo: max(0, vivo - |amount|) })

7. (async, swallows errors) finalizePropertySaleLoanCancellationFromTreasuryEvent(eventId)
   → propertySaleService.ts línea 1363

8. (async, swallows errors) Si sourceType === 'nomina':
   → procesarConfirmacionEvento(updatedEvent)  ← nominaAportacionHook.ts
   → onNominaConfirmada(evento, nomina)
   → aportacionesPlan.add(...)  si nomina tiene planPensiones configurado

9. Retornar { movementId, lineaId?, lineaStore? }
```

### 3.3 Triggers de UI que llaman a `confirmTreasuryEvent`

| Componente | Ruta | Trigger |
|------------|------|---------|
| `TesoreriaV4` | `src/components/treasury/TesoreriaV4.tsx:497,677,709` | Botón "Puntear" en agenda + "Confirmar traspaso" |
| `TreasuryReconciliationView` | `src/components/treasury/TreasuryReconciliationView.tsx:337,396` | Botón en vista conciliación |
| `LineasAnualesTab` | `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:412` | Puntear evento desde inmueble |
| `treasuryTransferService` | `src/services/treasuryTransferService.ts:109,110` | Al crear traspaso (llama 2 veces) |

### 3.4 Revertir: `revertTreasuryConfirmation(movementId)`

Hace el inverso:
1. Lee `movements[movementId]`; extrae `eventId` desde `reference = "treasury_event:{id}"`
2. Borra el movement
3. Si existe línea de inmueble: la **conserva** pero pone `estadoTesoreria='predicted'` y `movimientoId=undefined`
4. Revierte `treasuryEvents[eventId].status = 'predicted'`; limpia `executedMovementId`, `executedAt`

---

## 4 · Catálogo INGRESOS (16 sub-flujos)

### I-01 · Nómina (trabajo por cuenta ajena) ✅ funcional

**Store origen**: `ingresos` (tipo='nomina') · migrado desde store eliminado `nominas` en V63  
**Tipo TS**: `Nomina` (`src/types/personal.ts`)  
**Servicio CRUD**: `nominaService` (`src/services/nominaService.ts`)  
**Wizard alta**: `src/pages/GestionPersonal/wizards/NominaWizard.tsx`  
**Titular**: `'yo' | 'pareja'` (campo `titular`)

**Cálculo neto mensual**: `nominaService.calculateSalary(nomina)` → retenciones IRPF + SS (contingencias comunes 4.7%, desempleo 1.55%, FP 0.1%, MEI variable)

**Generación eventos tesorería**: `treasurySyncService` lee `ingresos` por `tipo='nomina'` y genera eventos `sourceType='nomina'` en `treasuryEvents`

**Hook de confirmación** (G-07): al puntear un evento de nómina, `procesarConfirmacionEvento` → `onNominaConfirmada` escribe en `aportacionesPlan` si `nomina.planPensiones` está configurado

**Conciliación fiscal**: `fiscalConciliationService` categoría `'nomina'` → alimenta `irpfCalculationService.collectTrabajoData()` para `salarioBrutoAnual`

---

### I-02 · Autónomo (rendimiento actividad económica) ✅ funcional

**Store**: `ingresos` (tipo='autonomo') · migrado desde store eliminado `autonomos` en V63  
**Servicio**: `autonomoService` (`src/services/autonomoService.ts`) — adaptador sobre `ingresos`  
**Wizard**: `src/pages/GestionPersonal/wizards/AutonomoWizard.tsx`  
**Titular**: `'yo' | 'pareja'`

**Campos clave**: `fuentesIngreso[]`, `gastosRecurrentesActividad[]`, `epigrafeIAE`, `tipoActividad`, `modalidad`, `cuotaAutonomos`

**Cálculo**: `irpfCalculationService.collectAutonomoData()` → `rendimientoNeto = ingresos - gastos - cuotaSS`

**Generación eventos**: `sourceType='autonomo_ingreso'` en `treasuryEvents`

---

### I-03 · Otros ingresos (pensión alimenticia, herencias, becas, etc.) ✅ funcional

**Store**: `ingresos` (tipo='otro') · migrado desde store eliminado `otrosIngresos` en V63  
**Tipo**: `OtrosIngresos` (`src/types/personal.ts`)  
**Servicio**: `otrosIngresosService` (`src/services/otrosIngresosService.ts`) — adaptador  
**Wizard**: `src/pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx`  
**Subtipos**: `'pension-alimenticia'` entre otros  
**Titular**: `'yo' | 'pareja'` (campo `titularidad`)

**Cálculo mensual**: `otrosIngresosService.calcularTotalesPorTipo()` → `{ pensionAlimenticia: { mensual, anual, count } }`

---

### I-04 · Alquiler de inmueble (renta mensual inquilino) ✅ funcional

**Origen**: `contracts` → `treasuryCreationService.generateIncomeFromContract(contract)`  
**Store escritura**: `ingresos` (H10 legacy) + `treasuryEvents` (sourceType='contrato')  
**Tipo**: `Contract` → campo `rentaMensual | monthlyRent`  
**Día cobro**: `contract.diaPago | contract.paymentDay`

**Conciliación fiscal**: `fiscalConciliationService` categoría `'ingresos_alquiler'` → `irpfCalculationService.calcInmueblesData()` para rendimiento neto por días alquilados

**Catálogo categoría**: `categoryKey = 'alquiler'` · `ambito = 'inmueble'`

---

### I-05 · Dividendos de inversión ✅ funcional (cálculo fiscal) · 🟡 parcial (tesorería)

**Origen**: `inversiones` (tipo='accion'|'etf'|'reit') · campo `dividendo_anual_estimado` + `aportaciones[].tipo='dividendo'`

**Cálculo fiscal**: `irpfCalculationService` → `dividendosAhorro` · casilla IRPF de cada plan (`div.casilla_irpf`)

**Tesorería**: `sourceType='inversion_dividendo'` existe en `TreasuryEvent.sourceType` pero no hay servicio que genere automáticamente estos eventos desde las posiciones · se registran vía `RegistrarCobroDialog` (`src/modules/inversiones/components/RegistrarCobroDialog.tsx`)

**Store escritura al cobrar**: `inversiones[id].aportaciones.push({ tipo: 'dividendo', ... })`

---

### I-06 · Rendimiento periódico inversión (cuenta remunerada, P2P, depósito) ✅ funcional

**Tipos aplicables**: `'cuenta_remunerada' | 'prestamo_p2p' | 'deposito_plazo'`  
**Campo**: `rendimiento.tasa_interes_anual`  
**Cobro**: frecuencia `'mensual' | 'trimestral' | 'semestral' | 'anual' | 'al_vencimiento'`  
**sourceType tesorería**: `'inversion_rendimiento'`

**Registro**: `FichaRendimientoPeriodico` (`src/modules/inversiones/components/FichaRendimientoPeriodico.tsx`) → `inversiones[id].aportaciones.push(...)` tipo='dividendo' (reutiliza el mismo tipo)

---

### I-07 · Liquidación inversión (rescate, reembolso, venta) ✅ funcional

**sourceType**: `'inversion_liquidacion'`  
**Tipos**: `PlanLiquidacion.tipo_liquidacion: 'vencimiento' | 'venta' | 'rescate'`  
**Cálculo plusvalía**: `inversionesFiscalService.calcularGananciaPerdidaFIFO()`  
**Fiscal**: `gananciaPatrimonialService` → bases IRPF ahorro

---

### I-08 · Pensión (pública o privada) ✅ funcional (fiscal) · 🟡 parcial (tesorería)

**Store**: `ingresos` (tipo='pension') · migrado desde store eliminado `pensiones` en V63  
**Fiscal**: `irpfCalculationService` categoría pensión → base imponible general  
**Proyección**: `informesDataService` → `month.ingresos.pensiones`

---

### I-09 · Plan de pensiones (cobro a vencimiento/rescate) 🟡 parcial

**Store**: `planesPensiones` (V65) · `aportacionesPlan`  
**Reintegro**: no hay flujo automatizado de generación de evento tesorería al rescatar. La UI de `MisPlanesPensiones` tiene botones con `TODO: abrir wizard` (líneas 110, 191 de `src/pages/GestionPersonal/MisPlanesPensiones.tsx`)

---

### I-10 · Aportaciones plan de pensiones del empleador (G-07) ✅ funcional

**Hook**: `nominaAportacionHook.ts` → `onNominaConfirmada()` → escribe en `aportacionesPlan`  
**Disparo**: tras `confirmTreasuryEvent` cuando `sourceType='nomina'`  
**Campos nomina requeridos**: `nomina.planPensiones.productoDestinoId` + `nomina.planPensiones.aportacionEmpleado`  
**Idempotente**: sí (comprueba si ya existe aportación para el mismo mes+evento)

---

### I-11 · Ingreso por venta de inmueble (ganancia patrimonial) ✅ funcional

**Servicio**: `propertySaleService` (`src/services/propertySaleService.ts`)  
**Flujo**: crea eventos en `treasuryEvents` (sourceType='document'|manual) → al confirmar llama a `finalizePropertySaleLoanCancellationFromTreasuryEvent`  
**Fiscal**: `propertyDisposalTaxService` → amortización mínima/deducida/aplicada → `property_sales`

---

### I-12 · Devolución IRPF ✅ funcional

**sourceType**: `'irpf_prevision'`  
**Servicio**: `fiscalPaymentsService.generarEventosFiscales(año, declaracionIRPF)` → crea evento en `treasuryEvents` si `resultado < 0`  
**Consumo**: `informesDataService` · `treasuryOverviewService`

---

### I-13 · Traspaso entre cuentas propias (ingreso espejo) ✅ funcional

**Servicio**: `treasuryTransferService.ts` · crea DOS eventos espejo ligados por `transferMetadata.pairEventId`  
**sourceType**: `'manual'` con `transferMetadata.targetAccountId`  
**UI**: `TesoreriaV4` botón traspaso → llama `confirmTreasuryEvent` dos veces (líneas 677-678)

---

### I-14 · Ingresos importados desde extracto bancario ✅ funcional

**Servicio**: `bankStatementImportService` → `createMovements()` → bulk `db.add('movements', ...)`  
**Orquestador**: `bankStatementOrchestrator` → `insertMovements()`  
**Deduplicación**: índice compuesto `duplicate-key` en `movements`  
**Clasificación**: `movementLearningRules` → auto-tag

---

### I-15 · Ingresos históricos (desde XML/PDF AEAT) ✅ funcional

**Servicio**: `historicalTreasuryService` → crea eventos en `treasuryEvents` con `fuenteHistorica='xml_aeat'|'pdf_aeat'`  
**Certeza**: `'declarado'` o `'calculado'`  
**Parser**: `irpfXmlParserService` / `aeatPdfParserService`

---

### I-16 · Capital mobiliario (intereses cuenta, depósitos) ✅ funcional

**Cálculo fiscal**: `irpfCalculationService` → `interesesAhorro + dividendosAhorro` → retención 19%/21%/23%/27%  
**Fuente datos**: `inversiones` → posiciones tipo `cuenta_remunerada` / `deposito_plazo`  
**Proyección**: `informesDataService` → `month.ingresos.dividendosInversiones`

---

## 5 · Catálogo GASTOS (18 sub-flujos)

### G-01 · Gasto personal recurrente (suministros, suscripciones, seguros) ✅ funcional

**Store**: `compromisosRecurrentes` (ambito='personal')  
**Tipo**: `CompromisoRecurrente` (`src/types/compromisosRecurrentes.ts`)  
**Servicio CRUD**: `compromisosRecurrentesService` (`src/services/personal/compromisosRecurrentesService.ts`)

**Patrones soportados**:
- `mensualDiaFijo` · `mensualDiaRelativo` · `cadaNMeses` · `trimestralFiscal`
- `anualMesesConcretos` · `pagasExtra` · `variablePorMes` · `puntual`

**Generación eventos**: `crearCompromiso()` → `regenerarEventosCompromiso()` → `generarEventosDesdeCompromiso()` → `db.add('treasuryEvents', ...)` (sourceType='gasto_recurrente')  
**Horizonte**: 24 meses por defecto

**categoryKey**: `'gasto_personal'` · ambito='ambos'

---

### G-02 · Vivienda habitual · Alquiler mensual (inquilino) ✅ funcional

**Store origen**: `viviendaHabitual` (tipo='inquilino')  
**Servicio**: `viviendaHabitualService.generarEventosInquilino()`  
**Generación**: sourceType='contrato', categoryKey='vivienda.alquiler', amount=-rentaMensual, cada mes en diaCobro  
**Regla de oro #2**: NO se duplica como compromiso recurrente independiente  
**Horizonte**: 24 meses

---

### G-03 · Vivienda habitual · Comunidad de propietarios ✅ funcional

**Servicio**: `viviendaHabitualService.generarEventosPropietario()` → comunidad mensual  
**categoryKey**: `'vivienda.comunidad'`  
**Condición**: `data.comunidad !== undefined` (campo opcional)

---

### G-04 · Vivienda habitual · IBI ✅ funcional

**Servicio**: `viviendaHabitualService.generarEventosPropietario()` → IBI anual en meses concretos  
**categoryKey**: `'vivienda.ibi'`  
**Soporte pagos fraccionados**: `importesPorPago?: Record<number, number>` (mes → importe)

---

### G-05 · Vivienda habitual · Seguros (hogar + vida) ✅ funcional

**Servicio**: `viviendaHabitualService.generarEventosPropietario()` → anual por mes+día fijo  
**categoryKey**: `'vivienda.seguros'`; subtypeKey: `'hogar'` | `'vida'`

---

### G-06 · Vivienda habitual · Cuota hipoteca ✅ funcional

**Servicio**: `viviendaHabitualService.generarEventosHipoteca()` → lee `prestamos[prestamoId].cuotaMensual`  
**categoryKey**: `'vivienda.hipoteca'`; sourceType='hipoteca'  
**Condición**: si `cuotaMensual <= 0` → NO genera eventos (no emite ruido)  
**Vinculación**: `data.hipoteca.prestamoId` → FK a `prestamos`

---

### G-07 · Gastos inmueble inversión · Reparación (casilla 0106) ✅ funcional

**Catálogo**: `categoryKey='reparacion_inmueble'` · storeName=`'gastosInmueble'` · casillaAEAT='0106'  
**Store escritura**: `gastosInmueble` (vía `confirmTreasuryEvent`)  
**Interface** `GastoInmueble`:
```typescript
export interface GastoInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  categoria: GastoCategoria;    // 'reparacion' | 'ibi' | ...
  casillaAEAT: AEATBox;         // '0106' | '0109' | ...
  importe: number;
  origen: GastoOrigen;          // 'xml_aeat' | 'prestamo' | 'recurrente' | 'tesoreria' | 'manual'
  estado: GastoEstadoNuevo;     // 'previsto' | 'confirmado' | 'declarado'
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  movimientoId?: string;
  // ...documentación: facturaId, justificanteId, providerNif...
}
```

---

### G-08 · Gastos inmueble · Mejora (CAPEX) ✅ funcional

**Catálogo**: `categoryKey='mejora_inmueble'` · storeName=`'mejorasInmueble'`  
**Interface**: `MejoraInmueble` · tipo: `'mejora' | 'ampliacion' | 'reparacion'`  
**Amortización fiscal**: las mejoras incrementan `baseAmortizacion` del inmueble → `aeatAmortizationService`

---

### G-09 · Gastos inmueble · Mobiliario (casilla 0117) ✅ funcional

**Catálogo**: `categoryKey='mobiliario_inmueble'` · storeName=`'mueblesInmueble'` · casillaAEAT='0117'  
**Amortización**: `mueblesInmuebleService` → `amortizacionAnual = importe / vidaUtil`; prorrateada por días de alquiler

---

### G-10 · Gastos inmueble · IBI (casilla 0115) ✅ funcional

**Catálogo**: `categoryKey='ibi_inmueble'` · casillaAEAT='0115' · storeName=`'gastosInmueble'`  
**Origen**: reglas OPEX (`compromisosRecurrentes` ambito='inmueble') o manual en `LineasAnualesTab`

---

### G-11 · Gastos inmueble · Comunidad (casilla 0109) ✅ funcional

**Catálogo**: `categoryKey='comunidad_inmueble'` · casillaAEAT='0109' · storeName=`'gastosInmueble'`

---

### G-12 · Gastos inmueble · Seguro (casilla 0114) ✅ funcional

**Catálogo**: `categoryKey='seguro_inmueble'` · casillaAEAT='0114' · storeName=`'gastosInmueble'`

---

### G-13 · Gastos inmueble · Suministros (casilla 0113) ✅ funcional

**Catálogo**: `categoryKey='suministro_inmueble'` · casillaAEAT='0113' · storeName=`'gastosInmueble'`  
**Subtipos**: `subtypeKey`: `'luz' | 'agua' | 'gas' | 'internet'`

---

### G-14 · Gastos inmueble · Basuras (casilla 0115) ✅ funcional

**Catálogo**: `categoryKey='basuras_inmueble'` · casillaAEAT='0115' · storeName=`'gastosInmueble'`

---

### G-15 · Gastos inmueble · Servicios gestión (casilla 0108) ✅ funcional

**Catálogo**: `categoryKey='servicio_inmueble'` · casillaAEAT='0108' · storeName=`'gastosInmueble'`  
**Incluye**: honorarios administrador, agencia inmobiliaria, gestoría

---

### G-16 · Gastos inmueble · Otros (casilla variable) ✅ funcional

**Catálogo**: `categoryKey='otros_inmueble'` · storeName=`'gastosInmueble'`

---

### G-17 · Pagos IRPF (fraccionados M-130, pago único, cuota solidaridad) ✅ funcional

**Servicio**: `fiscalPaymentsService.generarEventosFiscales(año, declaracionIRPF)`  
**sourceType**: `'irpf_prevision'`  
**Genera eventos** para: pago D-100 a pagar, pagos fraccionados M-130 autónomo  
**Consumo**: `informesDataService` → `month.ingresos.devolucionIrpf` (si devolución) o como gasto si a pagar

---

### G-18 · Gastos inmueble · Intereses hipoteca (casilla 0105) ✅ funcional

**Servicio**: `prestamosService.interesesDeduciblesInmueble()` → prorratea por destinos[] vinculados al inmueble  
**Cálculo**: `irpfCalculationService` → `gastos intereses 0105`  
**Casilla AEAT**: '0105'; `TODO` en `ejercicioResolverService.ts:589` para distinguir 0105 vs 0106

---

## 6 · Catálogo FINANCIACIÓN (9 sub-flujos)

### F-01 · Alta préstamo (hipoteca, personal, inversión) ✅ funcional

**Store**: `prestamos` · tipo `Prestamo` (`src/types/prestamos.ts`)  
**Servicio CRUD**: `prestamosService` (`src/services/prestamosService.ts`)

**Interface `Prestamo`** (resumen campos críticos):
```typescript
export interface Prestamo {
  id: string;                       // UUID
  ambito: 'PERSONAL' | 'INMUEBLE';
  destinos?: DestinoCapital[];      // para qué: ADQUISICION | REFORMA | INVERSION | PERSONAL | OTRA
  garantias?: Garantia[];           // informativo: HIPOTECARIA | PERSONAL | PIGNORATICIA
  nombre: string;
  principalInicial: number;
  principalVivo: number;
  fechaFirma: string;
  fechaPrimerCargo: string;
  plazoMesesTotal: number;
  diaCargoMes: number;              // 1-28
  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
  sistema: 'FRANCES';
  tipoNominalAnualFijo?: number;
  indice?: 'EURIBOR' | 'OTRO';
  diferencial?: number;
  carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
  cuentaCargoId: string;
  // ...bonificaciones, FEIN, plan_pagos...
}
```

**Deprecated**: campos `inmuebleId`, `afectacionesInmueble[]`, `finalidad` → migrar a `destinos[]`

---

### F-02 · Generación de cuotas mensuales en tesorería ✅ funcional

**Servicio**: `prestamosCalculationService` → cuadro de amortización francés  
**Genera eventos**: `sourceType='prestamo'` en `treasuryEvents`  
**Hooks**: al actualizar préstamo → `regenerarEventosVivienda()` si es hipoteca de vivienda habitual

---

### F-03 · Amortización parcial anticipada ✅ funcional

**Campo**: `TreasuryEvent.transferMetadata.esAmortizacionParcial = true`  
**Efecto al confirmar** (paso 6 del flujo de `confirmTreasuryEvent`): actualiza `prestamos[id].principalVivo`

---

### F-04 · Cancelación total (liquidación préstamo) ✅ funcional

**Servicio**: `loanSettlementService` (`src/services/loanSettlementService.ts`)  
**Escribe en**: `movements` (función interna `createMovement()` línea 181 + `tx.objectStore('movements').add(...)` línea 547)  
**Campo prestamo**: `prestamos[id].liquidacion` (absorbe el store eliminado `loan_settlements` en V63)

---

### F-05 · Cancelación por venta inmueble ✅ funcional

**Servicio**: `propertySaleService.finalizePropertySaleLoanCancellationFromTreasuryEvent(treasuryEventId)` (línea 1363)  
**Trigger**: `confirmTreasuryEvent` paso 7 (async, swallows errors)  
**También**: `movementLearningService.finalizePropertySaleLoanCancellation(movementId)` (línea 472)  
**UI**: `TesoreriaV4:580`, `TreasuryReconciliationView:337,396`

---

### F-06 · FEIN (Ficha Europea de Información Normalizada) ✅ funcional

**Parsers**: `feinOcrService`, `parseFeinText`, `feinToPrestamoMapper`  
**Directorio**: `src/services/fein/`  
**Flujo**: OCR → extrae datos FEIN → crea borrador `Prestamo` → usuario confirma  
**Bonificaciones parseadas**: `nomina` (domiciliación nómina), `recibos`, `tarjeta`

---

### F-07 · Intereses deducibles por inmueble ✅ funcional

**Función**: `prestamosService.interesesDeduciblesInmueble(prestamo, inmuebleId, interesesTotalAño)`  
**Lógica**: si `destinos[]` → usa factor por suma de destinos ADQUISICION+REFORMA vinculados al inmueble; si legacy → usa `afectacionesInmueble` o `inmuebleId` directo

---

### F-08 · Plan de pagos y cuadro de amortización ✅ funcional

**Tipo**: `PlanPagos` (en `src/types/prestamos.ts`)  
**Migración**: `migrationService` → `migration_keyval_planpagos_to_prestamos_v1` copia cuadros de amortización al campo `prestamos[id].planPagos`

---

### F-09 · Traspasos entre planes de pensiones 🟡 parcial (legacy)

**Store**: `traspasosPlanes` (legacy, V65) · `traspasosPlanPensiones` (nuevo, V65)  
**Servicio**: `traspasosPlanesService` (4 componentes UI consumen el store legacy)  
**Pendiente**: migración T27-pre documentada en comentarios de db.ts · no bloqueante

---

## 7 · Servicios duplicados · zombies · stores fantasma

### 7.1 Servicios con solapamiento funcional

| Función | Servicio A | Servicio B | Observación |
|---------|-----------|-----------|-------------|
| Importar movimientos bancarios | `bankStatementImportService` | `bankStatementOrchestrator` | El orquestador usa el parser service; no duplicados sino capas |
| Clasificar documento | `documentClassificationService` | `newDocumentTypeDetectionService` | Ambos existen; `newDocumentTypeDetectionService` no siempre sustituye al antiguo |
| Crear tesorería desde fuentes | `treasuryCreationService` | `enhancedTreasuryCreationService` | El `enhanced` existe como variante; ambos en producción |
| Conciliación fiscal | `fiscalConciliationService` | `conciliacionService` | Distintos ámbitos: fiscal vs. bancaria |

### 7.2 Hooks implementados pero con invocación parcial / condicional

| Hook | Archivo | Estado | Observación |
|------|---------|--------|-------------|
| `procesarConfirmacionEvento` | `src/services/personal/nominaAportacionHook.ts` | ✅ invocado condicionalmente | Solo si `sourceType === 'nomina'`; exportado en `personal/index.ts` con comentario desactivado |
| `finalizePropertySaleLoanCancellationFromTreasuryEvent` | `src/services/propertySaleService.ts` | ✅ invocado (async swallow) | Llamado desde `confirmTreasuryEvent`; errores silenciados |
| `finalizePropertySaleLoanCancellation` (por movementId) | `src/services/propertySaleService.ts` | ✅ invocado | Desde `movementLearningService` |
| Botones wizard MisPlanesPensiones | `src/pages/GestionPersonal/MisPlanesPensiones.tsx:110,191` | ❌ no implementado (TODO) | `onClick={() => { /* TODO: abrir wizard */ }}` |

### 7.3 Stores eliminados pero referenciados en código legacy (stores fantasma)

| Store eliminado | En versión | Destino actual | Riesgo |
|----------------|-----------|---------------|--------|
| `nominas` | V63 sub-tarea 4 | `ingresos` tipo='nomina' | `navigationPerformanceService` aún lista 'nominas' en prefetch |
| `autonomos` | V63 sub-tarea 4 | `ingresos` tipo='autonomo' | Ídem |
| `otrosIngresos` | V63 sub-tarea 4-bis | `ingresos` tipo='otro' | Ídem |
| `pensiones` | V63 sub-tarea 4 | `ingresos` tipo='pension' | Ídem |
| `loan_settlements` | V63 sub-tarea 4 | `prestamos[id].liquidacion` | - |
| `gastosPersonalesReal` | V62 sub-tarea 3 | movements + treasuryEvents | 0 registros |
| `patronGastosPersonales` | V62 sub-tarea 3 | `compromisosRecurrentes` | 7 registros migrados |
| `operacionesProveedor` | V62 sub-tarea 3 | cache eliminada | 15 registros |
| `objetivos_financieros` | V5.4 → V59 | `escenarios` | Migrado y tests pasados |
| `traspasosPlanes` | V65 | `traspasosPlanPensiones` | 4 componentes aún lo usan — migración pendiente T27-pre |
| `planesPensionInversion` | V65 | `planesPensiones` | - |
| `rentaMensual` | V62 sub-tarea 3 | deprecated V5.6 | 0 registros |

### 7.4 TODOs relevantes en flujos de ingresos/gastos/financiación

| Archivo | Línea | Descripción |
|---------|-------|-------------|
| `GestionPersonal/MisPlanesPensiones.tsx` | 110, 191 | Wizard nuevo plan / wizard aportar (stubs vacíos) |
| `ejercicioResolverService.ts` | 589 | `TODO: distinguir 0105 vs 0106` |
| `realPropertyService.ts` | 17, 25, 31 | `TODO: Replace with actual database query` (mock actual) |
| `documentRoutingService.ts` | 322, 331 | `TODO: Integrate with actual gasto / movimiento creation service` |
| `inboxProcessingService.ts` | 491 | `TODO: Auto-create loan draft here` |
| `taxSlice.ts` | 350 | `TODO: añadir campo deduccionesCuota al estado` |
| `TopbarV5.tsx` | 20, 22, 24 | Búsqueda, notificaciones y ayuda como stubs |

---

## 8 · Inversiones · auditoría dedicada

### 8.1 Stores involucrados

| Store | Tipo TS | Descripción |
|-------|---------|-------------|
| `inversiones` | `PosicionInversion` | Posiciones de inversión activas/cerradas |
| `planesPensiones` | `PlanPensiones` | Planes de pensiones (V65, UUID como clave) |
| `aportacionesPlan` | `AportacionPlan` | Aportaciones/traspasos a planes (V65) |
| `traspasosPlanPensiones` | `TraspasoPlanPensiones` | Traspasos fiscalmente neutros (V65) |
| `traspasosPlanes` | `TraspasoPlan` | Legacy (V5.2) — 4 componentes lo usan |

### 8.2 Tipos de posición (`TipoPosicion`)

```typescript
'cuenta_remunerada' | 'prestamo_p2p' | 'deposito_plazo'  // rendimiento periódico
| 'accion' | 'etf' | 'reit'                                // dividendos
| 'fondo_inversion' | 'plan_pensiones' | 'plan_empleo' | 'crypto' | 'otro'  // valoración simple
| 'deposito'  // legacy
```

**Nota**: `plan_pensiones` y `plan_empleo` migrados a `planesPensiones` en V65 → `inversionesService.getPosiciones()` los filtra

### 8.3 Servicio principal `inversionesService`

**Archivo**: `src/services/inversionesService.ts`  
**Operaciones**: `getPosiciones()`, `getAllPosiciones()`, `getPosicion(id)`, `addPosicion()`, `updatePosicion()`, `deletePosicion()`  
**Normalización**: recalcula `total_aportado`, `rentabilidad_euros`, `rentabilidad_porcentaje` en cada lectura

### 8.4 Flujo de aportación

```
UI WizardNuevaPosicion / PosicionFormDialog / DialogAportar
  → inversionesService.addPosicion() / updatePosicion()
  → db.add/put('inversiones', posicion)
```

### 8.5 Cálculo fiscal FIFO

**Servicio**: `inversionesFiscalService.calcularGananciaPerdidaFIFO(aportaciones)`  
**Campos escritos**: `coste_adquisicion_fifo`, `ganancia_perdida` en cada `Aportacion`

### 8.6 Importación masiva

**Archivo**: `src/modules/inversiones/import/ImportarAportacionesPage.tsx`  
**Servicio**: `inversionesAportacionesImportService`  
**Indexa Capital**: `indexaCapitalImportService` → parser específico

### 8.7 Planes de pensiones (V65)

**Alta**: `planesPensiones.add(...)` con id UUID  
**Aportaciones**: `aportacionesPlan.add(...)` con 3 roles: empleado / empresa / voluntaria  
**Límites fiscales**: `limitesFiscalesPlanesService`  
**Traspasos**: `traspasosPlanesService` (legacy) + `traspasosPlanPensionesService` (nuevo)

---

## 9 · Vivienda habitual personal

### 9.1 Tipo discriminado

**Archivo**: `src/types/viviendaHabitual.ts`

```typescript
export type ViviendaHabitualData =
  | ViviendaHabitualInquilino         // tipo='inquilino' → genera evento alquiler mensual
  | ViviendaHabitualPropietario       // tipo='propietarioSinHipoteca' → comunidad+IBI+seguros
  | ViviendaHabitualHipoteca;         // tipo='propietarioConHipoteca' → anterior + cuota hipoteca
```

### 9.2 Servicio `viviendaHabitualService`

**Archivo**: `src/services/personal/viviendaHabitualService.ts`

| Función | Efecto |
|---------|--------|
| `guardarVivienda(vivienda)` | CRUD en `viviendaHabitual` + `regenerarEventosVivienda()` |
| `eliminarVivienda(id)` | Borra eventos futuros + registro |
| `generarEventosVivienda(vivienda)` | Función pura → array de TreasuryEvent sin escribir |
| `regenerarEventosVivienda(vivienda)` | Borra eventos previstos existentes + escribe nuevos |
| `borrarEventosFuturosVivienda(viviendaId)` | Solo borra events con status='predicted' de `viviendaHabitual` |
| `obtenerViviendaActiva(personalDataId)` | Busca vivienda activa del titular |

### 9.3 Eventos generados por tipo

**Inquilino**:
- 1 evento mensual `type='expense'` · sourceType='contrato' · categoryKey='vivienda.alquiler' · amount=-rentaMensual

**Propietario sin hipoteca**:
- Comunidad: mensual si `data.comunidad` presente
- IBI: anual en `data.ibi.mesesPago[]` con soporte de importes fraccionados
- Seguro hogar: anual (opcional)
- Seguro vida: anual (opcional)

**Propietario con hipoteca**: todo lo anterior +
- Cuota hipoteca: mensual · categoryKey='vivienda.hipoteca' · sourceType='hipoteca' · lee `prestamos[prestamoId].cuotaMensual` (si = 0 → no genera eventos)

### 9.4 Regla de validación al crear compromisos

`compromisosRecurrentesService.puedeCrearCompromiso()` bloquea la creación de compromisos cuyo tipo colisione con los derivados de `viviendaHabitual` activa. Si colisiona, devuelve `{ ok: false, redirigirA: 'viviendaHabitual' }`.

---

## 10 · Inmuebles · operativa

### 10.1 Stores del módulo Inmuebles

| Store | Tipo | Descripción |
|-------|------|-------------|
| `properties` | `Property` | Ficha del inmueble |
| `property_sales` | `PropertySale` | Venta y plusvalía |
| `gastosInmueble` | `GastoInmueble` | Gastos deducibles (reparación, IBI, comunidad, seguro, suministro, etc.) |
| `mejorasInmueble` | `MejoraInmueble` | CAPEX (mejora, ampliación) |
| `mueblesInmueble` | `MuebleInmueble` | Mobiliario amortizable |
| `contracts` | `Contract` | Contratos de arrendamiento |
| `propertyDays` | `PropertyDays` | Días alquiler/disponibles por ejercicio |
| `fiscalSummaries` | `FiscalSummary` | Resumen fiscal por inmueble+ejercicio |
| `compromisosRecurrentes` (ambito='inmueble') | `CompromisoRecurrente` | Reglas OPEX del inmueble |
| `operacionesFiscales` | `OperacionFiscal` | Flujo unificado deducibles por casilla |
| `valoraciones_historicas` | - | Valoraciones mensuales del activo |

### 10.2 Flujo de gasto inmueble por ruta UI

**Ruta**: `GestionInmuebles/tabs/LineasAnualesTab.tsx`

```
Usuario abre tab → carga treasuryEvents[inmuebleId] + gastosInmueble[inmuebleId]
→ usuario pulsa "Puntear" sobre evento previsto
→ LineasAnualesTab:412 → confirmTreasuryEvent(eventId)
→ treasuryConfirmationService → movements.add + gastosInmueble.add
```

**Ruta alternativa**: `InmueblePresupuestoTab.tsx` → carga `gastosInmuebleService.getByInmueble()` para vista de presupuesto

### 10.3 Servicio `gastosInmuebleService`

**Archivo**: `src/services/gastosInmuebleService.ts`  
**Operaciones**: `getByInmueble(propertyId)`, `update(id, updates)`, `delete(id)`  
**Casillas AEAT mapeadas**: `{ reparacion: '0106', comunidad: '0109', suministro: '0113', seguro: '0114', ibi: '0115' }`

### 10.4 Servicio de rentabilidad

**Archivo**: `src/services/rentabilidadInmuebleService.ts`  
**Consolida**: ingresos alquiler (contracts) + gastos (gastosInmueble + mejorasInmueble + mueblesInmueble) + amortización

### 10.5 Venta de inmueble

**Servicio**: `propertySaleService` + `propertyDisposalTaxService`  
**Campos fiscales**: `amortizacionMinima`, `amortizacionDeducida`, `amortizacionAplicada`  
**Ganancia patrimonial**: `gananciaPatrimonialService` → base ahorro IRPF

---

## 11 · Pareja co-titular

### 11.1 Modelo de datos

El perfil personal (`personalData`) tiene campo `spouseName` (nombre de la pareja). El sistema distingue `titular: 'yo' | 'pareja'` en:

| Entidad | Campo | Cobertura |
|---------|-------|-----------|
| `Nomina` | `titular: 'yo' | 'pareja'` | ✅ Wizard soporte completo |
| `Autonomo` (en `ingresos`) | `titular?: string` | ✅ Wizard soporte completo |
| `OtrosIngresos` | `titularidad: 'yo' | 'pareja' | 'ambos'` | ✅ |
| `PlanPensiones` | `titular: 'yo' | 'pareja'` | ✅ |
| `Prestamo` | no hay titular explícito | — |

### 11.2 UI de gestión

**Componente**: `TabIngresos` (`src/pages/GestionPersonal/components/TabIngresos.tsx`)

```
situacionPersonal === 'casado' || 'pareja-hecho'
  → muestra sección "Nómina pareja" (línea 286)
  → muestra sección "Actividad autónoma pareja" (línea 369)
```

### 11.3 Cálculo IRPF pareja

**Modalidades**: individual / conjunto — gestionado en `irpfCalculationService`  
**Entidades atribuidas**: `entidadesAtribucion` store → `entidadAtribucionService` para atribuir rendimientos a cada cónyuge en entidades en régimen de atribución de rentas

### 11.4 Planes pensiones pareja

**Filtro UI**: `MisPlanesPensiones` → `filtroTitular: 'todos' | 'yo' | 'pareja'`  
**Límites**: `limitesFiscalesPlanesService` calcula límites por titular

---

## 12 · Hallazgos generales

### H-01 · `realPropertyService.ts` solo tiene stubs (🟠 roto)

```typescript
// src/services/realPropertyService.ts:17,25,31
// TODO: Replace with actual database query
```
Tres funciones devuelven datos mock. Si algún flujo depende de este servicio, devuelve siempre `[]` o `undefined`.

### H-02 · `gastos` store en schema vs uso real

El schema `AtlasHorizonDB` (db.ts:2070) declara `gastos: Gasto` con `interface Gasto` (línea 1546). Sin embargo el flujo de gastos de inmueble usa `gastosInmueble` (no `gastos`). El store `gastos` existe en el schema pero las referencias activas en servicios de tesorería van a `gastosInmueble`. Posible **store huérfano** o solapamiento con `gastosRecurrentes`/`gastosPuntuales` (que existían antes, ver líneas 2490-2491 db.ts como eliminados).

### H-03 · `nominaAportacionHook.ts` comentado en index

```typescript
// src/services/personal/index.ts:10:
//     onNominaConfirmada, procesarConfirmacionEvento,
```
La exportación en el index está comentada pero `treasuryConfirmationService.ts` importa directamente vía `import()` dinámico. El hook **sí funciona**; el comentario en el index es informativo.

### H-04 · `budgetProjection.ts` cierra TODO-T20-01 (✅)

`src/modules/mi-plan/services/budgetProjection.ts` implementa la proyección de presupuesto 12 meses combinando `ingresos` (nóminas + autónomos), `compromisosRecurrentes` (personal) y `contracts` (rentas). Cierra el deuda técnica `TODO-T20-01`.

### H-05 · `navigationPerformanceService` prefetch con stores eliminados

`src/services/navigationPerformanceService.ts:184` lista `'nominas', 'autonomos'` en el prefetch de la ruta `/personal`. Estos stores fueron eliminados en V63. El prefetch falla silenciosamente o devuelve vacío.

### H-06 · Conciliación fiscal vs. conciliación bancaria: dos sistemas distintos

| Sistema | Archivo | Propósito |
|---------|---------|-----------|
| `fiscalConciliationService` | `src/services/fiscalConciliationService.ts` | Concilia los datos del cálculo IRPF con datos reales (nóminas, alquileres, autónomos, OPEx, intereses hipoteca) |
| `conciliacionService` | `src/services/conciliacionService.ts` | Concilia movimientos bancarios con previsiones (`movements` vs `treasuryEvents`) |
| `ReconciliationModal` | `src/components/treasury/ReconciliationModal.tsx` | UI de conciliación bancaria |
| `TreasuryReconciliationView` | `src/components/treasury/TreasuryReconciliationView.tsx` | Vista completa conciliación |

Ambos sistemas coexisten sin conflicto.

### H-07 · Escenario libertad financiera (`escenarios` store)

El store `escenarios` (V5.4, renombrado de `objetivos_financieros`) es singleton (id=1). Lo gestiona `escenariosService`. `budgetProjection.ts` lo consume para proyecciones de Mi Plan. El store `objetivos` (V3.2) coexiste con datos de objetivos específicos (fondos_ahorro, retos).

### H-08 · `documentRoutingService.ts` · stubs de integración

```typescript
// src/services/documentRoutingService.ts:322
// TODO: Integrate with actual gasto creation service
// src/services/documentRoutingService.ts:331
// TODO: Integrate with actual movimiento creation service
```
El enrutamiento de documentos OCR a gastos/movimientos no está completamente integrado. El OCR puede clasificar pero la escritura en `gastosInmueble` vía documento es parcial.

### H-09 · `traspasosPlanes` legacy pendiente de migración completa

4 componentes (`PlanesManager`, `TraspasoForm`, `TraspasosHistorial`, `GestionInversionesPage`) aún consumen `traspasosPlanes` (store legacy V5.2). La migración a `traspasosPlanPensiones` está documentada como pendiente T27-pre en `db.ts`.

### H-10 · Amortización préstamo parcial: actualiza `principalVivo` pero no el cuadro

Al confirmar una amortización parcial anticipada, `confirmTreasuryEvent` actualiza `prestamos[id].principalVivo`. Sin embargo, no recalcula `planPagos` (cuadro de amortización). El usuario debe regenerar el cuadro manualmente o esperar la siguiente revisión.

---

## Resumen ejecutivo (≤ 30 líneas)

El sistema Atlas Horizon (DB_VERSION 67) implementa un motor de tesorería local-first articulado en dos stores: `treasuryEvents` (previsiones) y `movements` (confirmados). La acción central es **"puntear"** (`confirmTreasuryEvent`), que materializa un evento previsto en un movimiento bancario real y, si el evento es de tipo INMUEBLE, crea automáticamente la línea correspondiente en `gastosInmueble`, `mejorasInmueble` o `mueblesInmueble`.

**Ingresos (16 sub-flujos)**: nómina, autónomo y otros ingresos se unifican en el store `ingresos` (V63). Los alquileres vienen de `contracts`. Dividendos y rendimientos requieren acción manual en `inversiones`. Los planes de pensiones tienen cobertura V65 aunque el wizard de rescate es stub (TODO).

**Gastos (18 sub-flujos)**: vivienda habitual genera automáticamente hasta 5 tipos de evento (alquiler/comunidad/IBI/seguros/hipoteca) sin duplicación en `compromisosRecurrentes`. Los gastos de inmueble de inversión van a 3 stores físicos según categoría, con casillas AEAT mapeadas desde el catálogo canónico (`categoryCatalog.ts`).

**Financiación (9 sub-flujos)**: préstamos en store `prestamos` (sistema francés); generan cuotas en `treasuryEvents`. La amortización parcial actualiza `principalVivo` pero no regenera el cuadro. La liquidación por venta de inmueble es funcional vía `propertySaleService`.

**Hallazgos críticos**: (1) `realPropertyService.ts` devuelve stubs — ningún flujo de producción debe depender de él. (2) `navigationPerformanceService` prefetch con stores eliminados (`nominas`, `autonomos`) → falla silencioso. (3) El store `gastos` declarado en el schema aparentemente no es el que usan los flujos activos de gastos (usan `gastosInmueble`). (4) `documentRoutingService` tiene TODOs de integración con creación de gastos/movimientos. (5) 4 componentes aún usan el store legacy `traspasosPlanes` pendiente de migración.

**Estado global de funcionalidad**: ✅ funcional la mayoría de flujos principales · 🟡 parcial inversiones (dividendos manuales, rescate plan pensiones) · 🟠 roto `realPropertyService` (stubs) · ❌ no implementado wizard rescate plan pensiones y algunos stubs de UI.
