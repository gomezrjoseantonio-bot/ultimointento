// V81 · TAREA CC · Bloque C — prueba de aceptación:
// los DOS motores de proyección calculan la MISMA cifra de gasto personal para el
// mismo mes, porque ambos derivan de la MISMA fuente (compromisosRecurrentes) con la
// MISMA función canónica `importeCompromisoEnMes` (compromisosRecurrentesService).
//
// - Mi Plan (budgetProjection) y Horizon (proyeccionMensualService) consumen la
//   MISMA fuente única. Antes había un segundo motor sin variación (Fase 4a lo
//   borró): esta prueba fija que ambos siguen coincidiendo.
import { importeCompromisoEnMes } from '../../services/personal/compromisosRecurrentesService';
import { computeBudgetProjectionFromData } from '../mi-plan/services/budgetProjection';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const YEAR = 2026;

const compromisos = (): CompromisoRecurrente[] =>
  [
    {
      id: 'c-gym',
      ambito: 'personal',
      alias: 'Gimnasio',
      tipo: 'suscripcion',
      proveedor: { nombre: 'GymCo' },
      patron: { tipo: 'mensualDiaFijo', dia: 1 },
      importe: { modo: 'fijo', importe: 40 },
      cuentaCargo: 0,
      conceptoBancario: 'GYMCO',
      metodoPago: 'domiciliacion',
      categoria: 'personal.suscripciones',
      bolsaPresupuesto: 'deseos',
      responsable: 'titular',
      fechaInicio: '2020-01-01',
      estado: 'activo',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'c-seguro',
      ambito: 'personal',
      alias: 'Seguro anual',
      tipo: 'seguro',
      proveedor: { nombre: 'AseguraCo' },
      patron: { tipo: 'anualMesesConcretos', mesesPago: [3], diaPago: 1 },
      importe: { modo: 'fijo', importe: 600 },
      cuentaCargo: 0,
      conceptoBancario: 'SEGURO',
      metodoPago: 'domiciliacion',
      categoria: 'personal.seguros',
      bolsaPresupuesto: 'necesidades',
      responsable: 'titular',
      fechaInicio: '2020-01-01',
      estado: 'activo',
      createdAt: '',
      updatedAt: '',
    },
  ] as unknown as CompromisoRecurrente[];

// Réplica del cálculo que hace Horizon (proyeccionMensualService.buildMonthRow) para el
// gasto personal en el año base (factorInflacionGastos = 1): suma de la fuente única.
const horizonGastoPersonal = (month0: number): number =>
  compromisos().reduce((sum, c) => sum + (importeCompromisoEnMes(c, YEAR, month0) ?? 0), 0);

describe('Bloque C · una sola fuente de gasto personal · ambos motores coinciden', () => {
  it('Mi Plan y Horizon dan la MISMA cifra de gasto personal para cada mes del año base', () => {
    const miPlan = computeBudgetProjectionFromData(YEAR, {
      nominas: [],
      autonomos: [],
      contracts: [],
      compromisos: compromisos(),
    });

    for (let m = 0; m < 12; m++) {
      // Mi Plan: salidas del mes (negativas) → valor absoluto = gasto del mes.
      const miPlanGasto = Math.abs(miPlan.months[m].salidas);
      const horizonGasto = horizonGastoPersonal(m);
      expect(horizonGasto).toBeCloseTo(miPlanGasto, 6);
    }
  });

  it('las cifras son coherentes y NO cero (gimnasio 40€/mes; seguro 600€ en marzo)', () => {
    // enero: solo gimnasio = 40. marzo: gimnasio 40 + seguro 600 = 640.
    expect(horizonGastoPersonal(0)).toBeCloseTo(40, 6);
    expect(horizonGastoPersonal(2)).toBeCloseTo(640, 6);
  });
});
