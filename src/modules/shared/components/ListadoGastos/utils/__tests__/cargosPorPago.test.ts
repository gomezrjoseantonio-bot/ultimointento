// ============================================================================
// Un gasto con varios cargos al año · el IBI de dos pagos
// ============================================================================
//
// «IBI 1 · IBI 2 · IBI 3» era el apaño de tener un solo importe por gasto. El
// modelo admite `porPago` (mes → importe) desde siempre y el cálculo lo
// resuelve; lo que faltaba era capturarlo, y un sitio donde poner el DÍA de
// cada cargo: el 15 de junio y el 11 de noviembre no son el mismo día del mes.
//
// El día no vive en el importe —el importe nunca decide cuándo— sino en el
// patrón, que es de donde salen las fechas de las previsiones. De ahí
// `diaPagoPorMes`.
//
// Lo que vigila este fichero es la regla que hace que nada de esto pueda
// romperse: **el importe y el patrón salen de la MISMA lista de cargos**. Un
// mes en el patrón sin importe en el mapa hace que `calcularImporte` lance
// (`patronCalendario.ts:320-325`), y seis pantallas lo llaman sin try/catch.
// ============================================================================

import {
  porPagoDesdeCargos,
  cargosDeCompromiso,
  parseCargos,
  problemaDeCargos,
  resumenDeCargos,
  MESES_CORTOS,
} from '../cargosPorPago';
import type { ImporteEvento, PatronRecurrente } from '../../../../../../types/compromisosRecurrentes';

// El IBI de Asturias: 200 € el 15 de junio, 120 € el 11 de noviembre.
const IBI = [
  { mes: 6, importe: 200, dia: 15 },
  { mes: 11, importe: 120, dia: 11 },
];

// ─── de los cargos al dato guardado ─────────────────────────────────────────

describe('porPagoDesdeCargos · el importe y el patrón salen juntos', () => {
  it('el importe es el mapa mes → cargo', () => {
    expect(porPagoDesdeCargos(IBI).importe).toEqual({
      modo: 'porPago',
      importesPorPago: { 6: 200, 11: 120 },
    });
  });

  it('el patrón lleva los meses de los cargos y el día de cada uno', () => {
    expect(porPagoDesdeCargos(IBI).patron).toEqual({
      tipo: 'anualMesesConcretos',
      mesesPago: [6, 11],
      diaPago: 15,
      diaPagoPorMes: { 6: 15, 11: 11 },
    });
  });

  // La razón de que sea UNA función y no dos: llamar a una sin la otra es
  // exactamente cómo se construye un `porPago` que lanza.
  it('COHERENCIA · todo mes del patrón tiene importe · siempre', () => {
    const casos = [
      IBI,
      [{ mes: 1, importe: 50, dia: 1 }],
      [{ mes: 3, importe: 10, dia: 5 }, { mes: 9, importe: 20, dia: 28 }],
      Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, importe: i + 1, dia: i + 1 })),
    ];
    for (const cargos of casos) {
      const { importe, patron } = porPagoDesdeCargos(cargos);
      const meses = (patron as Extract<PatronRecurrente, { tipo: 'anualMesesConcretos' }>).mesesPago;
      const mapa = (importe as Extract<ImporteEvento, { modo: 'porPago' }>).importesPorPago;
      for (const m of meses) expect(mapa[m]).toBeDefined();
      expect(Object.keys(mapa).length).toBe(meses.length);
    }
  });

  // `mesesToPatron` colapsa los doce meses a `mensualDiaFijo`, que solo lleva
  // UN día. Aquí no: doce cargos con doce días siguen siendo doce días.
  it('doce cargos NO colapsan a un patrón de un solo día', () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, importe: 100, dia: i + 1 }));
    const { patron } = porPagoDesdeCargos(doce);
    expect(patron.tipo).toBe('anualMesesConcretos');
    expect((patron as Extract<PatronRecurrente, { tipo: 'anualMesesConcretos' }>).diaPagoPorMes?.[12]).toBe(12);
  });

  it('los meses salen ordenados aunque se añadan al revés', () => {
    const { patron } = porPagoDesdeCargos([{ mes: 11, importe: 120, dia: 11 }, { mes: 6, importe: 200, dia: 15 }]);
    expect((patron as Extract<PatronRecurrente, { tipo: 'anualMesesConcretos' }>).mesesPago).toEqual([6, 11]);
  });

  it('el día de respaldo es el del primer cargo · nunca queda sin poner', () => {
    const { patron } = porPagoDesdeCargos([{ mes: 11, importe: 120, dia: 11 }]);
    expect((patron as Extract<PatronRecurrente, { tipo: 'anualMesesConcretos' }>).diaPago).toBe(11);
  });
});

// ─── del dato guardado a los cargos de la ficha ─────────────────────────────

describe('cargosDeCompromiso · reabrir el gasto', () => {
  const importe: ImporteEvento = { modo: 'porPago', importesPorPago: { 6: 200, 11: 120 } };

  it('devuelve cada cargo con su mes, su importe y SU día', () => {
    const patron: PatronRecurrente = {
      tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15, diaPagoPorMes: { 6: 15, 11: 11 },
    };
    expect(cargosDeCompromiso(importe, patron)).toEqual(IBI);
  });

  // Un `porPago` guardado antes de que existiera `diaPagoPorMes` no tiene día
  // propio: cae al del patrón, que es lo que ya usaba.
  it('sin día propio cae al día del patrón', () => {
    const patron: PatronRecurrente = { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 5 };
    expect(cargosDeCompromiso(importe, patron)).toEqual([
      { mes: 6, importe: 200, dia: 5 },
      { mes: 11, importe: 120, dia: 5 },
    ]);
  });

  it('y sin patrón de meses concretos, al día 1', () => {
    const patron: PatronRecurrente = { tipo: 'mensualDiaRelativo', referencia: 'ultimoHabil' };
    expect(cargosDeCompromiso(importe, patron).every((c) => c.dia === 1)).toBe(true);
  });

  it('un ida y vuelta no cambia nada', () => {
    const { importe: i2, patron: p2 } = porPagoDesdeCargos(IBI);
    expect(cargosDeCompromiso(i2, p2)).toEqual(IBI);
  });

  it('de un importe que no es `porPago` no salen cargos', () => {
    const patron: PatronRecurrente = { tipo: 'mensualDiaFijo', dia: 1 };
    expect(cargosDeCompromiso({ modo: 'fijo', importe: 60 }, patron)).toEqual([]);
  });

  // La detección automática propone `diferenciadoPorMes` (doce huecos, la
  // mayoría a cero). Sus meses con cifra son cargos como cualquier otro: así
  // se puede pasar uno a `porPago` sin teclear nada.
  it('un `diferenciadoPorMes` se lee como los cargos de sus meses con cifra', () => {
    const dpm: ImporteEvento = {
      modo: 'diferenciadoPorMes',
      importesPorMes: [0, 0, 0, 0, 0, 200, 0, 0, 0, 0, 120, 0],
    };
    const patron: PatronRecurrente = { tipo: 'mensualDiaFijo', dia: 3 };
    expect(cargosDeCompromiso(dpm, patron)).toEqual([
      { mes: 6, importe: 200, dia: 3 },
      { mes: 11, importe: 120, dia: 3 },
    ]);
  });
});

// ─── lo que la ficha teclea ─────────────────────────────────────────────────

describe('parseCargos · lo que se escribe en la ficha', () => {
  it('el día en blanco es el 1 · es el que casi siempre vale', () => {
    expect(parseCargos([{ mes: 6, importe: '200', dia: '' }])).toEqual([{ mes: 6, importe: 200, dia: 1 }]);
  });

  it('el día se respeta cuando se pone', () => {
    expect(parseCargos([{ mes: 6, importe: '200', dia: '15' }])[0].dia).toBe(15);
  });

  it('el día se acota al 1-31 · no hay un 45 de junio', () => {
    expect(parseCargos([{ mes: 6, importe: '200', dia: '45' }])[0].dia).toBe(31);
    expect(parseCargos([{ mes: 6, importe: '200', dia: '0' }])[0].dia).toBe(1);
  });

  it('acepta la coma decimal', () => {
    expect(parseCargos([{ mes: 6, importe: '200,50', dia: '1' }])[0].importe).toBe(200.5);
  });

  // Un cargo a medio escribir NO llega al dato: si llegara, su mes entraría en
  // el patrón sin importe en el mapa y la proyección lanzaría.
  it('un cargo sin importe no entra', () => {
    expect(parseCargos([{ mes: 6, importe: '200', dia: '15' }, { mes: 11, importe: '', dia: '11' }]))
      .toEqual([{ mes: 6, importe: 200, dia: 15 }]);
  });

  it('ni uno con importe cero o negativo', () => {
    expect(parseCargos([{ mes: 6, importe: '0', dia: '1' }, { mes: 7, importe: '-5', dia: '1' }])).toEqual([]);
  });
});

describe('problemaDeCargos · por qué no se puede guardar todavía', () => {
  it('sin ningún cargo no hay nada que guardar', () => {
    expect(problemaDeCargos([])).toBeTruthy();
  });

  it('con un cargo a medio escribir, tampoco', () => {
    expect(problemaDeCargos([{ mes: 6, importe: '200', dia: '15' }, { mes: 11, importe: '', dia: '' }]))
      .toMatch(/importe/i);
  });

  it('dos cargos en el mismo mes se pisarían · no se guarda', () => {
    expect(problemaDeCargos([{ mes: 6, importe: '200', dia: '15' }, { mes: 6, importe: '120', dia: '20' }]))
      .toMatch(/mes/i);
  });

  it('y con los cargos completos, ninguno', () => {
    expect(problemaDeCargos([{ mes: 6, importe: '200', dia: '15' }, { mes: 11, importe: '120', dia: '11' }]))
      .toBeNull();
  });
});

// ─── cómo se resume en la fila ──────────────────────────────────────────────

describe('resumenDeCargos · lo que cabe en la columna de importe', () => {
  it('dice cuántos cargos hay · no un guion', () => {
    const { importe, patron } = porPagoDesdeCargos(IBI);
    expect(resumenDeCargos(importe, patron)).toBe('2 cargos');
  });

  it('en singular cuando es uno', () => {
    const { importe, patron } = porPagoDesdeCargos([{ mes: 6, importe: 200, dia: 15 }]);
    expect(resumenDeCargos(importe, patron)).toBe('1 cargo');
  });

  it('y el detalle va en el título, con mes, importe y día', () => {
    const { importe, patron } = porPagoDesdeCargos(IBI);
    expect(resumenDeCargos(importe, patron, true)).toBe('15 jun · 200 € — 11 nov · 120 €');
  });

  it('los meses se nombran igual en toda la app', () => {
    expect(MESES_CORTOS[5]).toBe('jun');
    expect(MESES_CORTOS).toHaveLength(12);
  });
});
