# T20 · Pendientes y TODOs derivados de cada sub-tarea

> Tracking de TODOs formales que surgen al cerrar sub-tareas de T20 y se
> resuelven en sub-tareas posteriores. Cada entrada nace de una decisión
> validada por Jose en review · y debe cerrarse en la sub-tarea indicada.

---

## TODOs activos

### TODO-T20-01 · Cashflow chart · conectar Mi Plan v2 budget API

**Origen** · T20 Fase 2 · sub-tarea 20.2 · PR #1170

**Decisión Jose** ·
> Aceptar con TODO formal · cuando llegue 20.3c (Mi Plan v2) · CC debe
> conectar la API de presupuesto al cashflow chart. Documentar en spec.

**Estado actual** · `src/modules/tesoreria/components/CashflowChart.tsx`
calcula `saldoPrevisto` como proyección lineal simple
(`saldo_actual + acumulado_movs_mes`) en `VistaGeneralTab.tsx`. El
componente ya soporta ambas series · sólo falta cablear datos reales.

**Acción requerida en 20.3c (Mi Plan v2)** ·
1. Identificar la API de presupuesto que Mi Plan v2 expone (probablemente
   `proyeccionMensualService` o sucesor).
2. En `VistaGeneralTab.tsx` · rellenar `MonthFlow.saldoPrevisto` con la
   proyección oficial del presupuesto. Mantener `MonthFlow.saldoReal` para
   meses cerrados/en curso.
3. Validar que el cruce entre la línea sólida (real) y la dashed (previsto)
   ocurre en el mes "hoy".
4. Documentar en el PR de 20.3c que cierra este TODO.

**Archivos afectados** ·
- `src/modules/tesoreria/components/CashflowChart.tsx` · sin cambios (ya soporta
  ambas series)
- `src/modules/tesoreria/tabs/VistaGeneralTab.tsx` · cambiar el cálculo de
  `months`/`monthCards` para leer del nuevo servicio
- Posiblemente nuevo servicio en `src/services/` que combine `accounts` +
  `movements` + presupuesto Mi Plan

**Cierre** · ✓ CERRADO en T20 Fase 3c · sub-tarea 20.3c · ver TODOs cerrados.

---

## TODOs cerrados

### TODO-T20-01 · Cashflow chart · conectar Mi Plan v2 budget API ✓

**Cerrado en** · T20 Fase 3c · sub-tarea 20.3c · PR siguiente

**Solución entregada** ·
- Nuevo helper `src/modules/mi-plan/services/budgetProjection.ts` que combina
  `nominas` + `autonomos` + `compromisosRecurrentes` + `contracts` para
  producir una proyección estructural mes a mes (12 meses · `BudgetProjection`).
- Cubre los 8 patrones de `compromisosRecurrentes` definidos en el modelo
  de datos §2.1 · `mensualDiaFijo` · `mensualDiaRelativo` · `cadaNMeses` ·
  `trimestralFiscal` · `anualMesesConcretos` · `pagasExtra` · `variablePorMes`
  · `puntual`.
- API · `computeBudgetProjection12mAsync(year)` carga DB y devuelve serie.
- `VistaGeneralTab` de Tesorería ahora consume esta API · meses pasados/
  actuales usan saldo real (movimientos), meses futuros usan proyección
  estructural Mi Plan. La línea sólida (real) y la dashed (previsto) del
  CashflowChart están correctamente alimentadas.
- `MiPlanPage/Landing` y `MiPlanPage/ProyeccionPage` consumen la misma API
  · single source of truth.

**Archivos modificados** ·
- `src/modules/mi-plan/services/budgetProjection.ts` (nuevo · ~200 líneas)
- `src/modules/tesoreria/tabs/VistaGeneralTab.tsx` (proyección sustituida)
- `src/modules/mi-plan/pages/{LandingPage,ProyeccionPage}.tsx` (consumen API)

---

## Convenciones

- Cada TODO lleva ID único `TODO-T20-NN` correlativo.
- Cada TODO debe documentar · origen (sub-tarea + PR) · decisión Jose textual ·
  estado actual · acción requerida · archivos afectados · sub-tarea de cierre.
- Cuando se cierra · se mueve a "TODOs cerrados" con fecha + PR de cierre.
