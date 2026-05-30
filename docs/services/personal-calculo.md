# Cálculo de nómina y autónomo · ÚNICA FUENTE DE VERDAD

> FIX consolidar módulo Personal · decisiones F6 (nómina) y F7 (autónomo).
> Toda cifra de nómina/autónomo que pinte la app DEBE salir de estos services.
> Caso real de referencia · Jose · ORANGE ESPAGNE 2026.

---

## 1 · Las dos services únicas

### `src/services/nominaCalculoService.ts`

```ts
calcularNetoMesNomina(nomina, mes /*1-12*/, año): {
  netoMes,
  desglose: { pagaNormal, variablesAplicables, pagaExtra, bonusAplicable,
              aportacionPPEmpleado, aportacionPPEmpresa, irpfRetenido,
              ssEmpleado, cuotaSolidaridad },
  tipoMes: 'normal' | 'variable' | 'extra' | 'extra+variable' | 'bonus'
}

calcularNetoAnualNomina(nomina, año): {
  netoAnual, brutoAnual, totalRetenciones, totalSS, totalPP,
  porMes: [{ mes, neto }]   // 12 entradas · netoAnual = suma de porMes
}

calcularBrutoAnualNomina(nomina, año): number   // bruto fijo + variables
```

Internamente envuelve el motor del wizard `calcularNomina` (nominaCalculatorService)
y mapea `Nomina → CalcularNominaInput` **igual que el wizard al editar**:

- `ssBaseCotizacionMensual` = tope legal del año (`getBaseMaxima(año)`), NO el
  `baseCotizacionMensual` persistido.
- Variables y bonus se unifican (cada uno en su mes).
- Plan de pensiones · sólo aportaciones de tipo `importe` afectan al neto.

### `src/services/autonomoCalculoService.ts`

```ts
calcularNetoMesAutonomo(autonomo, mes /*1-12*/, año): {
  netoMes,
  desglose: { ingresoMes, cuotaRETA, gastosDeducibles, retencionIRPF }
}

calcularNetoAnualAutonomo(autonomo, año): {
  netoAnual, ingresosAnuales, totalRETA, totalGastos, totalRetencion,
  porMes: [{ mes, neto }]
}
```

Definición canónica del neto líquido:

```
neto = ingresos − cuotaRETA − gastosDeducibles − retenciónIRPF
```

La cuota RETA se imputa los 12 meses. La retención IRPF se aplica a las
`fuentesIngreso` con `aplIrpf`, usando `irpfRetencionPorcentaje`.

---

## 2 · Reglas (NO negociables)

1. **Cero cálculo en componentes.** Ningún componente ni service puede calcular
   importes de nómina/autónomo por su cuenta. Todos llaman a las funciones de arriba.
2. Los helpers de `src/modules/personal/helpers.ts` (`computeNominaNetoEnMes`,
   `computeNominaNetoPorMes`, `computeAutonomoNetoEnMes`, `computeAutonomoNetoPorMes`)
   son **adaptadores de vista**: sólo añaden el guard `activa`/`activo` y el año
   en curso, y delegan en los services. No calculan nada.
3. Las funciones de los services son **puras** · sin acceso a stores/IndexedDB · sin side effects.
4. Si aparece otra función calculando lo mismo → eliminarla y redirigir las llamadas.

### Consumidores ya migrados

| Vista / service | Usa |
|---|---|
| Card `/personal/ingresos` (Neto anual / Neto mes) | helpers → services |
| Panel `/personal` (Ingresos del mes + gráfico 12m) | helpers → services |
| Presupuesto Personal | helpers → services |
| Tesorería · cobro nómina (`treasurySyncService`) | `calcularNetoMesNomina` |
| Mi Plan · proyección (`budgetProjection`) | nómina + autónomo services |
| Proyección Mensual (`proyeccionMensualService`) | `calcularNetoMesNomina` |
| Dashboard Horizon · autónomo del mes | `calcularNetoMesAutonomo` |

### Apuntes (fuera del alcance de esta tarea)

- `nominaService.calculateSalary` y `autonomoService.getMonthlyDistribution` /
  `calculateEstimatedAnnual` SIGUEN existiendo porque los usan servicios
  **fiscales/AEAT** (`irpfCalculationService`, `fiscalConciliationService`) y
  `personalResumenService` (actualmente sin consumidores). Los datos fiscales
  AEAT están explícitamente fuera de alcance (spec §6) y se migrarán aparte.

---

## 3 · Caso real Jose · test de aceptación

`Nómina ORANGE 2026` · bruto fijo 95.178,16 € · 14 pagas (extras jun+dic) ·
IRPF 34,25 % · SS 6,50 % · cuota solidaridad 91,80 €/año · PP empleado 122,76 €/mes ·
PP empresa 163,68 €/mes · variable marzo 13.600,96 € · variable junio 9.060,96 € ·
bonus abril 4.530,48 €.

| Mes | Neto | Tipo |
|---|---|---|
| ENE / FEB / MAY / JUL–NOV | 4.007,99 € | normal |
| MAR | 12.950,62 € | variable |
| ABR | 6.986,78 € | bonus |
| JUN | 14.435,54 € | extra+variable |
| DIC | 8.477,96 € | extra |

`Neto anual 74.914,79 €` · `Bruto fijo + variables 122.370,56 €`.

Autónomo · sin ingreso en mayo → neto mayo = −cuota RETA (−315 €), que el panel
resta a la nómina (Ingresos del mes mayo ≈ 4.007,99 − 315 = 3.693 €).

Tests:
- `src/services/__tests__/nominaCalculoService.test.ts`
- `src/services/__tests__/autonomoCalculoService.test.ts`
- `src/modules/personal/__tests__/personalCrossView.test.ts` (misma nómina/mes → mismo importe en todas las vistas)

---

## 4 · Rutas del módulo

| Ruta | Qué es |
|---|---|
| `/personal/ingresos` | Listado de nóminas/autónomos · destino post-save |
| `/personal/nomina/nueva` · `/personal/nomina/:id/editar` | Wizard nómina |
| `/personal/autonomo/nuevo` · `/personal/autonomo/:id/editar` | Wizard autónomo |
| `/personal/otros-ingresos/nuevo` | Wizard otros ingresos |
| `/gestion/personal*` | **DEPRECADA** · redirect a `/personal/*` |

Redirect post-save/cancelar de cualquier wizard → `/personal/ingresos`. El refresco
de datos ocurre porque los wizards son rutas separadas: al volver, `PersonalPage`
se remonta y recarga.
