// ============================================================================
// Los seis cuadros de amortización que hay sobre la mesa · VOCABULARIO §6 bis·bis
// ============================================================================
//
// Cuatro bancos, seis préstamos, todos con su papel delante. Es la única forma
// de que «el cuadro cuadra con el banco» signifique algo: ocho intentos
// anteriores fallaron porque el arranque se probaba con un ejemplo inventado.
//
// Lo que estos seis fijan es el ARRANQUE, que es donde estaba el problema:
//
//   · La liquidación de los días sueltos es la primera fecha de cobro POSTERIOR
//     a la disposición, sea del mes que sea.
//   · La primera cuota entera es la primera fecha de cobro que está al menos un
//     mes después.
//   · Los días se cuentan como los cuenta el banco: reales sobre 365 en
//     Santander e ING, 30/360 en Sabadell —donde el 31 vale 30—.
//   · Y hay dos formas de cobrarlos: recibo aparte (cinco) o dentro de la
//     primera cuota (ING).
// ============================================================================

import { generarCuadro } from '../cuadro';
import { baseDiasSueltosDe } from '../baseDeCalculo';
import { diasSueltosDelArranqueDe } from '../fechasDelArranque';
import type { Prestamo } from '../../../types/prestamos';

interface Caso {
  banco: string;
  capital: number;
  meses: number;
  tin: number;
  /** Lo que el usuario responde: cuándo dispone y qué día le cobran. */
  disposicion: string;
  diaCargo: number;
  /** Y qué hace su banco con los días sueltos, y cómo los cuenta. */
  arranque?: Prestamo['diasSueltosDelArranque'];
  baseSueltos?: Prestamo['baseDiasSueltos'];
  mixto?: { tramoFijoMeses: number; diferencial: number };
  /** Lo que dice el papel. */
  lineas: number;
  sueltos?: { fecha: string; dias: number; importe: number };
  primera: { fecha: string; cuota: number; interes: number; amortizacion: number; vivo: number };
  /** Céntimos de tolerancia en la cuota · 0 salvo que el banco redondee distinto. */
  holgura?: number;
}

const CASOS: Caso[] = [
  {
    banco: 'Santander ...5465',
    capital: 78500, meses: 96, tin: 4.99,
    disposicion: '2026-05-12', diaCargo: 1,
    lineas: 97,
    sueltos: { fecha: '2026-06-01', dias: 20, importe: 214.64 },
    primera: { fecha: '2026-07-01', cuota: 993.43, interes: 326.43, amortizacion: 667, vivo: 77833 },
  },
  {
    banco: 'Santander ...4926',
    capital: 50000, meses: 84, tin: 4.04,
    disposicion: '2025-07-03', diaCargo: 31,
    lineas: 85,
    // El cobro es fin de mes y se dispone el día 3 · los días sueltos se
    // liquidan en JULIO, no en agosto. Aquí es donde ATLAS se saltaba un recibo.
    sueltos: { fecha: '2025-07-31', dias: 28, importe: 154.96 },
    primera: { fecha: '2025-08-31', cuota: 684.36, interes: 168.33, amortizacion: 516.03, vivo: 49483.97 },
  },
  {
    banco: 'Santander ...3776',
    capital: 17675, meses: 84, tin: 4.0,
    disposicion: '2023-10-16', diaCargo: 31,
    lineas: 85,
    // El que salía a «45 días» · son 15.
    sueltos: { fecha: '2023-10-31', dias: 15, importe: 29.05 },
    primera: { fecha: '2023-11-30', cuota: 241.6, interes: 58.92, amortizacion: 182.68, vivo: 17492.32 },
  },
  {
    banco: 'Sabadell ...4699',
    capital: 24500, meses: 96, tin: 4.49,
    disposicion: '2025-07-04', diaCargo: 31, baseSueltos: '30/360',
    lineas: 97,
    // 30 − 4 = 26 días, no los 27 del calendario.
    sueltos: { fecha: '2025-07-31', dias: 26, importe: 79.45 },
    primera: { fecha: '2025-08-31', cuota: 304.26, interes: 91.67, amortizacion: 212.59, vivo: 24287.41 },
    // El Sabadell redondea la cuota AL ALZA: la francesa exacta son 304,2539 y
    // él cobra 304,26. ATLAS redondea al más cercano, que es lo que hacen los
    // otros cinco —el Santander cobra 993,43 donde el alza daría 993,44—. Un
    // céntimo, y no se inventa una regla de redondeo por banco con un solo dato
    // que la distinga: queda anotado en §8.
    holgura: 1,
  },
  {
    banco: 'Sabadell ...4961',
    capital: 16500, meses: 96, tin: 4.49,
    disposicion: '2025-09-13', diaCargo: 31, baseSueltos: '30/360',
    lineas: 97,
    sueltos: { fecha: '2025-09-30', dias: 17, importe: 34.98 },
    primera: { fecha: '2025-10-31', cuota: 204.91, interes: 61.74, amortizacion: 143.17, vivo: 16356.83 },
  },
  {
    banco: 'ING',
    capital: 97500, meses: 360, tin: 2.15,
    disposicion: '2022-02-22', diaCargo: 1,
    arranque: 'EN_LA_PRIMERA_CUOTA',
    mixto: { tramoFijoMeses: 120, diferencial: 1.09 },
    // Sin recibo de días sueltos · ING se salta el 01-03 y los mete dentro.
    lineas: 360,
    primera: {
      fecha: '2022-04-01',
      // 193,05 de capital —la amortización de un mes normal— + 218,37 de los 38
      // días desde la disposición.
      cuota: 411.42, interes: 218.37, amortizacion: 193.05, vivo: 97306.95,
    },
    // ING cobra 218,37 donde 97.500 al 2,15 % por 38 días sobre 365 dan 218,24.
    // El tipo que explicaría su cifra es el 2,15128 %, y su propio cuadro liquida
    // los meses al 2,1500 %. Trece céntimos sin explicación en el papel: no se
    // fuerza el número, se deja dicho. La amortización y el capital vivo sí
    // salen exactos, que es lo que arrastra el resto del cuadro.
    holgura: 13,
  },
];

/** El préstamo tal como quedaría guardado con lo que el usuario responde. */
const prestamoDe = (c: Caso): Prestamo => {
  const borrador = {
    id: c.banco,
    principalInicial: c.capital,
    plazoMesesTotal: c.meses,
    fechaFirma: c.disposicion,
    diaCargoMes: c.diaCargo,
    baseCalculoIntereses: '30/360',
    baseDiasSueltos: c.baseSueltos,
    diasSueltosDelArranque: c.arranque,
    esquemaPrimerRecibo: 'NORMAL',
    ...(c.mixto
      ? {
          tipo: 'MIXTO',
          tipoNominalAnualMixtoFijo: c.tin,
          tramoFijoMeses: c.mixto.tramoFijoMeses,
          valorIndiceActual: 2.1,
          diferencial: c.mixto.diferencial,
        }
      : { tipo: 'FIJO', tipoNominalAnualFijo: c.tin }),
  } as unknown as Prestamo;

  // Los días sueltos, con la MISMA función que usa el asistente.
  const sueltos =
    c.arranque === 'EN_LA_PRIMERA_CUOTA'
      ? null
      : diasSueltosDelArranqueDe({
          fechaFirma: c.disposicion,
          diaCargo: c.diaCargo,
          capital: c.capital,
          tinAnual: c.tin,
          base: baseDiasSueltosDe(borrador),
        });

  return { ...borrador, carenciaTecnica: sueltos ?? undefined } as Prestamo;
};

const cent = (n: number) => Math.round(n * 100);

describe.each(CASOS)('$banco', (c) => {
  const plan = () => generarCuadro(prestamoDe(c)).plan.periodos;
  const holgura = c.holgura ?? 0;

  it('tiene las líneas que tiene el papel', () => {
    expect(plan()).toHaveLength(c.lineas);
  });

  it('liquida los días sueltos donde y como los liquida el banco', () => {
    const linea0 = plan().find((p) => p.periodo === 0);

    if (!c.sueltos) {
      expect(linea0).toBeUndefined();
      return;
    }
    expect(linea0!.fechaCargo).toBe(c.sueltos.fecha);
    expect(linea0!.diasDevengo).toBe(c.sueltos.dias);
    expect(linea0!.amortizacion).toBe(0);
    expect(cent(linea0!.interes)).toBe(cent(c.sueltos.importe));
  });

  // La fecha NO se pregunta · sale de la disposición y del día de cobro.
  it('pone la primera cuota entera el día que la pone el banco', () => {
    expect(plan().find((p) => p.periodo === 1)!.fechaCargo).toBe(c.primera.fecha);
  });

  it('la desglosa como la desglosa el banco', () => {
    const p1 = plan().find((p) => p.periodo === 1)!;

    expect(Math.abs(cent(p1.cuota) - cent(c.primera.cuota))).toBeLessThanOrEqual(holgura);
    expect(Math.abs(cent(p1.interes) - cent(c.primera.interes))).toBeLessThanOrEqual(holgura);
    expect(Math.abs(cent(p1.amortizacion) - cent(c.primera.amortizacion))).toBeLessThanOrEqual(holgura);
    expect(Math.abs(cent(p1.principalFinal) - cent(c.primera.vivo))).toBeLessThanOrEqual(holgura);
  });

  it('y termina en cero', () => {
    const periodos = plan();

    expect(periodos[periodos.length - 1].principalFinal).toBe(0);
  });
});

// ING no cobra nada el 01-03-2022 · si se le colara un recibo de días sueltos,
// esos días se cobrarían dos veces.
describe('cuando los días sueltos van dentro de la cuota', () => {
  it('no se cuela un recibo aparte aunque venga guardado', () => {
    const ing = {
      ...prestamoDe(CASOS[5]),
      carenciaTecnica: { dias: 7, fechaLiquidacion: '2022-03-01', intereses: 40.2 },
    } as Prestamo;

    expect(generarCuadro(ing).plan.periodos.some((p) => p.periodo === 0)).toBe(false);
  });
});
