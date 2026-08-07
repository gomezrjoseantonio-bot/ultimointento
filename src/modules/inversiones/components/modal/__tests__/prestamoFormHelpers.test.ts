// Lógica pura del formulario de préstamo · validación, reajuste de capital y
// resumen de cuotas vencidas.

import {
  ajustarCapitalEditado,
  validarCondiciones,
} from '../prestamoFormHelpers';
import {
  calcularCuotasVencidas,
  pagosDeCuotasVencidas,
} from '../CuotasVencidasField';
import type { PosicionInversion } from '../../../../../types/inversiones';

const condiciones = (extra: Record<string, unknown> = {}) => ({
  capital: 30000,
  tin: 3.25,
  duracionMeses: 60,
  cuentaCargo: '1',
  fechaFirma: '2025-03-01',
  fechaPrimerCobro: '2025-04-01',
  ...extra,
});

describe('validarCondiciones', () => {
  it('acepta unas condiciones completas', () => {
    expect(validarCondiciones(condiciones())).toBeNull();
  });

  it.each([
    [{ capital: 0 }, /capital/i],
    [{ tin: 0 }, /TIN/],
    [{ duracionMeses: 0 }, /duración/i],
    [{ cuentaCargo: '' }, /cuenta de cargo/i],
    [{ fechaPrimerCobro: '' }, /desde cuándo/i],
    [{ fechaPrimerCobro: '2025-02-01' }, /anterior a la firma/i],
  ])('rechaza %j', (extra, mensaje) => {
    expect(validarCondiciones(condiciones(extra))).toMatch(mensaje);
  });
});

describe('ajustarCapitalEditado', () => {
  const posicion = (aportaciones: unknown[]) =>
    ({
      id: 1,
      total_aportado: 30000,
      valor_actual: 25000,
      fecha_valoracion: '2026-01-01T12:00:00.000Z',
      aportaciones,
    }) as unknown as PosicionInversion;

  const inicial = {
    id: 10,
    tipo: 'aportacion',
    fecha: '2025-03-01T12:00:00.000Z',
    importe: 30000,
  };

  it('no toca nada si el capital no cambia', () => {
    expect(ajustarCapitalEditado(posicion([inicial]), 30000, '2025-03-01', 1)).toBeNull();
  });

  it('ajusta la aportación inicial por la diferencia y conserva lo amortizado', () => {
    const res = ajustarCapitalEditado(posicion([inicial]), 40000, '2025-03-01', 2)!;
    expect(res.total_aportado).toBe(40000);
    // El valor vivo sube por el delta · no se reinicia al capital nuevo.
    expect(res.valor_actual).toBe(35000);
    expect(res.aportaciones![0].importe).toBe(40000);
    expect(res.aportaciones![0].cuenta_cargo_id).toBe(2);
  });

  it('descuenta los reembolsos del total aportado', () => {
    const res = ajustarCapitalEditado(
      posicion([inicial, { id: 11, tipo: 'reembolso', fecha: '2025-09-01', importe: 5000 }]),
      40000,
      '2025-03-01',
      1,
    )!;
    expect(res.total_aportado).toBe(35000);
  });

  it('sin aportación inicial NO deja el capital a cero', () => {
    // Una posición importada o antigua puede no tener aportación inicial:
    // recomputar el total desde esa lista daría 0 y borraría el capital.
    const res = ajustarCapitalEditado(posicion([]), 40000, '2025-03-01', 1)!;
    expect(res.total_aportado).toBe(40000);
    expect(res.valor_actual).toBe(35000);

    const soloDividendos = ajustarCapitalEditado(
      posicion([{ id: 12, tipo: 'dividendo', fecha: '2025-06-01', importe: 80 }]),
      40000,
      '2025-03-01',
      1,
    )!;
    expect(soloDividendos.total_aportado).toBe(40000);
  });
});

describe('calcularCuotasVencidas', () => {
  // Firmado hace tres años · arrastra cuotas vencidas seguro.
  const hace3 = new Date();
  hace3.setFullYear(hace3.getFullYear() - 3);
  const params = {
    capital: 30000,
    tinAnual: 3.25,
    duracionMeses: 60,
    frecuencia: 'mensual' as const,
    modalidad: 'capital_e_intereses' as const,
    primerCobro: hace3.toISOString().slice(0, 10),
    retencionPorcentaje: 19,
  };

  it('cuenta las cuotas ya vencidas y ninguna futura', () => {
    const res = calcularCuotasVencidas(params)!;
    expect(res.cuotas.length).toBeGreaterThan(30);
    const hoy = new Date().toISOString().slice(0, 10);
    expect(res.cuotas.every((c) => c.periodo.fecha <= hoy)).toBe(true);
    expect(res.ultima).toBe(res.cuotas[res.cuotas.length - 1].periodo.fecha);
  });

  it('el neto anunciado es exactamente la suma de los pagos que se guardan', () => {
    const res = calcularCuotasVencidas(params)!;
    const pagos = pagosDeCuotasVencidas(res, 1);
    const suma = pagos.reduce((acc, p) => acc + p.importe_neto, 0);
    // Al céntimo: el resumen y los pagos salen del mismo redondeo, así que no
    // hay deriva de coma flotante entre lo que se enseña y lo que se guarda.
    expect(Math.abs(suma - res.neto)).toBeLessThan(0.005);
    expect(pagos).toHaveLength(res.cuotas.length);
    expect(pagos.every((p) => p.estado === 'pagado')).toBe(true);
  });

  it('cada pago lleva la retención del periodo, no una media', () => {
    const pagos = pagosDeCuotasVencidas(calcularCuotasVencidas(params)!, 7);
    // Con cuota francesa el interés baja, así que la retención también.
    expect(pagos[0].retencion_fiscal).toBeGreaterThan(
      pagos[pagos.length - 1].retencion_fiscal,
    );
    // Y el neto sube, porque se retiene menos sobre la misma cuota.
    expect(pagos[0].importe_neto).toBeLessThan(pagos[pagos.length - 1].importe_neto);
    expect(pagos.every((p) => p.cuenta_destino_id === 7)).toBe(true);
  });

  it('devuelve null si el préstamo aún no ha vencido ninguna cuota', () => {
    const manana = new Date();
    manana.setMonth(manana.getMonth() + 2);
    expect(
      calcularCuotasVencidas({ ...params, primerCobro: manana.toISOString().slice(0, 10) }),
    ).toBeNull();
  });
});
