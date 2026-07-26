// TAREA CC · GASTOS-RECURRENTES · Fase 4a — coherencia de la FUENTE ÚNICA.
//
// El bug de las dos fuentes: Tesorería materializaba con `calcularImporte +
// aplicarVariacion`, y Presupuesto/Panel/proyección recomputaban con otro motor
// SIN variación y con otra fuente de importe para `variablePorMes`. Resultado:
// cifras distintas del mismo mes (43.920 vs 46.478).
//
// Ahora hay UNA sola puerta: `importeCompromisoEnMes` / `importeCompromisoEnFecha`,
// que el materializador también usa. Estas pruebas fijan que la cifra que da el
// cálculo canónico (la que consume Presupuesto) es IDÉNTICA a la que materializa
// Tesorería — precisamente en las dos divergencias encontradas: IPC y
// variablePorMes.

import {
  importeCompromisoEnMes,
  generarEventosHistoricos,
} from './compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente>): CompromisoRecurrente =>
  ({
    id: 'c1',
    ambito: 'personal',
    alias: 'Gasto',
    tipo: 'suscripcion',
    proveedor: { nombre: 'ProvCo' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 100 },
    cuentaCargo: 0,
    conceptoBancario: 'PROVCO',
    metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones',
    bolsaPresupuesto: 'deseos',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as unknown as CompromisoRecurrente;

// Cifra que MATERIALIZA Tesorería para el mes (suma de los eventos del mes).
const materializadorMes = (c: CompromisoRecurrente, year: number, month0: number): number =>
  generarEventosHistoricos(c, new Date(year, month0, 1), new Date(year, month0 + 1, 0)).reduce(
    (s, e) => s + Math.abs(e.amount),
    0,
  );

describe('coherencia · IPC (divergencia nº1)', () => {
  const c = base({
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 100 },
    variacion: { tipo: 'ipcAnual', mesRevision: 1, ultimoIpcAplicado: 3 },
    fechaInicio: '2020-01-01',
  } as Partial<CompromisoRecurrente>);

  it('el cálculo canónico coincide con el materializador (Tesorería ≡ Presupuesto)', () => {
    const canonico = importeCompromisoEnMes(c, 2026, 5);
    expect(canonico).not.toBeNull();
    expect(canonico as number).toBeCloseTo(materializadorMes(c, 2026, 5), 6);
  });

  it('la variación SÍ se aplica (el motor viejo daría el base 100 · aquí es mayor)', () => {
    // 6 años de IPC 3% desde 2020 → claramente > 100. El punto es que NO es 100.
    expect(importeCompromisoEnMes(c, 2026, 5) as number).toBeGreaterThan(100);
  });
});

describe('coherencia · variablePorMes (divergencia nº2)', () => {
  const c = base({
    patron: { tipo: 'variablePorMes', mesesPago: [6], importeObjetivoAnual: 1200 },
    importe: { modo: 'fijo', importe: 100 },
    fechaInicio: '2020-01-01',
  } as Partial<CompromisoRecurrente>);

  it('junio: canónico ≡ materializador y usa el ImporteEvento (100), no importeObjetivoAnual (1200)', () => {
    const canonico = importeCompromisoEnMes(c, 2026, 5); // month0=5 → junio
    expect(canonico).not.toBeNull();
    expect(canonico as number).toBeCloseTo(materializadorMes(c, 2026, 5), 6);
    expect(canonico as number).toBeCloseTo(100, 6); // NO 1200 (lo que daba el motor viejo)
  });

  it('enero: no cae ese mes → 0 (calculable), no null', () => {
    expect(importeCompromisoEnMes(c, 2026, 0)).toBe(0);
  });
});

describe('el cálculo NO inventa · null si no se puede calcular', () => {
  it('sin importe → null (no 0 ni NaN)', () => {
    const c = base({ importe: undefined } as unknown as Partial<CompromisoRecurrente>);
    expect(importeCompromisoEnMes(c, 2026, 0)).toBeNull();
  });
  it('sin patrón → null', () => {
    const c = base({ patron: undefined } as unknown as Partial<CompromisoRecurrente>);
    expect(importeCompromisoEnMes(c, 2026, 0)).toBeNull();
  });
});
