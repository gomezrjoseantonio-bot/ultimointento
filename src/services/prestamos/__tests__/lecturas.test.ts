// Las lecturas por fecha · lo que la UI de Financiación pregunta al cuadro.
//
// Lo que vigilan estos casos es que la pantalla lea del motor y no rehaga
// cuentas: la cuota de una fecha es la que dice el cuadro, el capital vivo sale
// del propio periodo y el mixto de Unicaja tiene que ENSEÑAR su salto a
// Euríbor en agosto de 2026 en vez de quedarse congelado en el 2,600 %.

import { generarCuadro } from '../cuadro';
import {
  escaleraDeLiberacion,
  getCapitalVivo,
  getCuota,
  getDesgloseCuota,
  getFechaVencimiento,
  getPctAmortizado,
  getProximaRevision,
  getTinVigente,
  periodoEn,
} from '../lecturas';
import type { Prestamo } from '../../../types/prestamos';

/** La mixta de Unicaja · 36 meses al 2,600 % y después Euríbor + 1,750. */
const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    nombre: 'Hipoteca Unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

/** Un personal a tipo fijo · cuota constante y sin revisiones. */
const personal = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'personal',
    nombre: 'Santander 17.675',
    principalInicial: 17675,
    plazoMesesTotal: 60,
    fechaFirma: '2025-01-15',
    fechaPrimerCargo: '2025-02-15',
    diaCargoMes: 15,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4,
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

describe('lecturas · la cuota sale del cuadro, no de una fórmula rehecha', () => {
  it('devuelve la cuota del periodo que contiene la fecha', () => {
    const cuadro = generarCuadro(personal());
    const periodo = periodoEn(cuadro, '2026-03-01');

    expect(periodo).not.toBeNull();
    expect(getCuota(cuadro, '2026-03-01')).toBe(periodo!.cuota);
  });

  it('la cuota NO cambia porque se marquen recibos como pagados', () => {
    // Este era el bug de `helpers.ts`: rehacía la francesa sobre `principalVivo`
    // y las cuotas bailaban en cada recarga.
    const p = personal();
    const antes = getCuota(generarCuadro(p), '2026-03-01');
    const conRecibosPagados = generarCuadro({
      ...p,
      cuotasPagadas: 14,
      principalVivo: 13500,
    } as Prestamo);

    expect(getCuota(conRecibosPagados, '2026-03-01')).toBe(antes);
  });

  it('el capital vivo es el saldo al INICIO del periodo', () => {
    const cuadro = generarCuadro(personal());
    const periodo = periodoEn(cuadro, '2026-03-01')!;

    expect(getCapitalVivo(cuadro, '2026-03-01')).toBeCloseTo(
      periodo.principalFinal + periodo.amortizacion,
      2,
    );
  });

  it('el desglose interés + capital suma la cuota', () => {
    const cuadro = generarCuadro(personal());
    const { interes, capital } = getDesgloseCuota(cuadro, '2026-03-01');

    expect(interes + capital).toBeCloseTo(getCuota(cuadro, '2026-03-01'), 2);
  });

  it('un préstamo ya vencido no suma ni cuota ni capital', () => {
    const cuadro = generarCuadro(personal());

    expect(getCuota(cuadro, '2099-01-01')).toBe(0);
    expect(getCapitalVivo(cuadro, '2099-01-01')).toBe(0);
  });

  it('el vencimiento es la fecha de la última cuota del cuadro', () => {
    const cuadro = generarCuadro(personal());
    const periodos = cuadro.plan.periodos;

    expect(getFechaVencimiento(cuadro)).toBe(periodos[periodos.length - 1].fechaCargo);
    expect(getFechaVencimiento(cuadro)!.slice(0, 4)).toBe('2030');
  });

  it('el amortizado va de 0 a 100 y crece con el tiempo', () => {
    const cuadro = generarCuadro(personal());

    expect(getPctAmortizado(cuadro, '2025-02-20')).toBeLessThan(5);
    expect(getPctAmortizado(cuadro, '2029-12-01')).toBeGreaterThan(90);
    expect(getPctAmortizado(cuadro, '2099-01-01')).toBe(100);
  });
});

describe('lecturas · el mixto no se queda congelado en su tramo fijo', () => {
  it('el TIN vigente pasa del fijo al índice + diferencial al acabar el tramo', () => {
    const p = unicaja();

    expect(getTinVigente(p, '2026-01-01')).toBeCloseTo(2.6, 3);
    // 36 meses desde 2023-08-25 · desde 2026-08-25 manda Euríbor + diferencial.
    expect(getTinVigente(p, '2026-09-01')).toBeCloseTo(2.1 + 1.75, 3);
  });

  it('avisa de la revisión que mueve la cuota dentro de la ventana', () => {
    const p = unicaja();
    const cuadro = generarCuadro(p);
    const revision = getProximaRevision(p, cuadro, '2026-07-01', 90);

    expect(revision).not.toBeNull();
    expect(revision!.fecha.slice(0, 7)).toBe('2026-09');
    expect(revision!.cuotaDespues).toBeGreaterThan(revision!.cuotaAntes);
    expect(revision!.tinDespues).toBeGreaterThan(revision!.tinAntes);
  });

  it('no avisa cuando la revisión queda fuera de la ventana', () => {
    const p = unicaja();

    expect(getProximaRevision(p, generarCuadro(p), '2025-01-01', 90)).toBeNull();
  });

  it('un fijo simple no tiene ninguna revisión que anunciar', () => {
    const p = personal();

    expect(getProximaRevision(p, generarCuadro(p), '2026-03-01', 90)).toBeNull();
  });

  it('la última cuota no se anuncia como revisión aunque sea distinta', () => {
    // La última se lleva el resto del capital, así que casi nunca coincide con
    // el resto. Anunciarla sería un aviso falso en todos los préstamos.
    const p = personal();

    expect(getProximaRevision(p, generarCuadro(p), '2029-12-01', 120)).toBeNull();
  });
});

describe('escaleraDeLiberacion · la cuota del hogar bajando hacia cero', () => {
  const cuadros = [{ cuadro: generarCuadro(unicaja()) }, { cuadro: generarCuadro(personal()) }];

  it('arranca en la suma de las cuotas vivas de este mes', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');
    const esperado =
      getCuota(cuadros[0].cuadro, '2026-03-10') + getCuota(cuadros[1].cuadro, '2026-03-10');

    expect(escalera.totalHoy).toBeCloseTo(esperado, 2);
  });

  it('pone un peldaño por cada vencimiento y acaba en el último', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');

    expect(escalera.peldanos.map((p) => p.anio)).toEqual([2030, 2043]);
    expect(escalera.mesLibre).toBe('2043-08');
  });

  it('cuando vence el personal, la cuota total baja lo que él pagaba', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');
    const peldano = escalera.peldanos.find((p) => p.anio === 2030)!;
    const soloHipoteca = getCuota(cuadros[0].cuadro, '2030-03-15');

    expect(peldano.nuevoTotal).toBeCloseTo(soloHipoteca, 2);
  });

  it('el último peldaño deja la cuota en cero · quedas libre', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');

    expect(escalera.peldanos[escalera.peldanos.length - 1].nuevoTotal).toBe(0);
  });

  it('sin préstamos vivos no hay escalera que dibujar', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2099-01-01');

    expect(escalera.puntos).toHaveLength(0);
    expect(escalera.mesLibre).toBeNull();
  });
});
