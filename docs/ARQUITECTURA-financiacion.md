# ARQUITECTURA · Módulo Financiación

> Versión 1.0 · 2026-05-02
> Aplica a: post-T28.1 (bugfix cache `autoMarcarCuotasPagadas`)

---

## 1 · Modelo de datos

### Entidad central: `Prestamo`

**Path**: `src/types/prestamos.ts`

Un préstamo es el documento raíz. Contiene campos de configuración (TIN, plazo, esquema), campos calculados/cacheados, y el plan de pagos embebido.

```
Prestamo
├── id, nombre, ambito, tipo, sistema
├── principalInicial               ← inmutable tras firma
├── principalVivo                  ← CACHEADO · deriva de PlanPagos
├── cuotasPagadas                  ← CACHEADO · deriva de PlanPagos
├── fechaUltimaCuotaPagada         ← CACHEADO · deriva de PlanPagos
├── destinos[]   (DestinoCapital)  ← modelo v2 · determina fiscalidad
├── garantias[]  (Garantia)
├── bonificaciones[]
└── planPagos    (PlanPagos)       ← embebido en el mismo documento
      └── periodos[]  (PeriodoPago)
            ├── periodo, fechaCargo, cuota, interes, principal, principalFinal
            └── pagado, fechaPagoReal, movimientoTesoreriaId
```

### Almacenamiento: IndexedDB store `prestamos`

Definido en `src/services/db.ts:2693`. Un documento por préstamo; `planPagos.periodos[]` está embebido (no hay store `cuotas` separado). El store `keyval` tenía entradas `planpagos_${id}` que se migraron a `prestamos.planPagos` en T15.3.

### Campos cacheados vs. campos fuente

| Campo cacheado | Fuente real | Calcula |
|---|---|---|
| `principalVivo` | `periodos[last_pagado].principalFinal` | `derivarCachePrestamo()` |
| `cuotasPagadas` | `periodos.filter(p.pagado).length` | `derivarCachePrestamo()` |
| `fechaUltimaCuotaPagada` | `periodos[last_pagado].fechaCargo` | `derivarCachePrestamo()` |

**Regla invariante**: los tres campos cacheados deben ser siempre consistentes con `planPagos.periodos[]`. La función `derivarCachePrestamo(plan, principalInicial)` en `prestamosService.ts` es la única fuente de verdad para este cálculo.

---

## 2 · Flujo de creación de un préstamo

```
PrestamosWizard
  → prestamosService.createPrestamo(data)
       1. Genera PlanPagos via prestamosCalculationService.generatePaymentSchedule()
       2. Marca periodos pasados pagado=true (fechaCargo <= hoy)
       3. Llama autoMarcarCuotasPagadas() → recalcula caché
       4. Persiste en IndexedDB
```

`createPrestamo` inicializa `cuotasPagadas=0` y `principalVivo=principalInicial`, luego `autoMarcarCuotasPagadas` los corrige. El bug pre-T28.1 era que esta corrección nunca ocurría porque la función salía antes del bloque de recálculo cuando no había flags por cambiar.

---

## 3 · Recálculo de caché: `derivarCachePrestamo`

**Path**: `src/services/prestamosService.ts` (función exportada, nivel módulo)

```typescript
export function derivarCachePrestamo(
  plan: PlanPagos,
  principalInicial: number,
): Pick<Prestamo, 'cuotasPagadas' | 'principalVivo' | 'fechaUltimaCuotaPagada'>
```

Función pura. Lee `plan.periodos`, filtra los pagados, toma el último. Si no hay ninguno pagado, `principalVivo = principalInicial`.

**Consumidores internos**:
- `autoMarcarCuotasPagadas()` — llamada en `load()` de `FinanciacionPage` y en `createPrestamo`
- `marcarCuotaManual()` — llamada desde la UI de detalle para marcar/desmarcar cuotas

---

## 4 · Función `autoMarcarCuotasPagadas`

**Path**: `src/services/prestamosService.ts:649`

```
autoMarcarCuotasPagadas(prestamoId)
  1. Carga prestamo + plan de IndexedDB
  2. Para cada periodo con fechaCargo <= hoy y !pagado → marca pagado=true
  3. Si hubo cambios → savePaymentPlan (persiste flags)
  4. SIEMPRE → updatePrestamo con derivarCachePrestamo(plan, principalInicial)
```

El paso 4 es incondicional: recalcula y persiste los campos cacheados aunque no haya habido ningún cambio en flags. Esto repara datos creados con la versión buggy donde los flags eran correctos pero la caché no se había actualizado.

---

## 5 · Dos rutas de lectura (assimetría listado/detalle)

El módulo tiene dos rutas independientes para mostrar el estado de pagos:

| Componente | Lee de | Descripción |
|---|---|---|
| `ListadoPage`, `PanelPage`, `loanRowFromPrestamo` | `prestamo.cuotasPagadas`, `prestamo.principalVivo` | Campos cacheados |
| `DetallePage` (tab Cuadro de amortización) | `plan.periodos[].pagado` | Array fuente embebido |

Esta asimetría es la causa del bug visible: detalle mostraba badges correctos (`Pagada`/`En curso`/`Pendiente`) mientras el listado mostraba `0/300 cuotas`. Con la caché siempre sincronizada ambas rutas convergen.

---

## 6 · Generación del cuadro de amortización

**`PrestamosCalculationService.generatePaymentSchedule(prestamo)`**

Path: `src/services/prestamosCalculationService.ts`

Función pura (no accede a DB). Implementa francés con soporte de prorrata, solo-intereses, día-clamped y carencia. Instancia global: `prestamosCalculationService`.

**Nota**: existe una segunda implementación simplificada en `CuadroAmortizacion.tsx` que se activa en el wizard cuando no recibe periodos precalculados. Puede divergir del cuadro guardado en casos edge (prorrata, carencia).

---

## 7 · Relación con TreasuryEvents

`TreasuryEvent` tiene campos dedicados `prestamoId?: string` y `numeroCuota?: number` (definidos en `db.ts:1188-1189`). No usa `sourceId` para enlazar cuotas (incompatibilidad UUID/numérico, comentado en `treasurySyncService.ts:574`).

`generateMonthlyForecasts` crea eventos treasury para los periodos con `!pagado` del mes solicitado. No hace backfill de periodos ya pagados. No hay auto-imputación a `gastosInmueble`.

---

## 8 · Tareas pendientes conocidas

| Tarea | Estado | Descripción |
|---|---|---|
| T8 | Desbloqueado post-T9, no iniciado | Cache balance · liquidación préstamo UI |
| Amortizaciones anticipadas | Parcial | `simulateAmortization()` existe; no hay aplicación que regenere el cuadro |
| TIN variable prospectivo | Incompleto | Cuadro usa índice actual congelado; sin revisiones futuras |
