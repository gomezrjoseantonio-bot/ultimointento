// ATLAS Personal v1.1 · tests del motor de calendario (sección 2)

import {
  expandirPatron,
  calcularImporte,
  aplicarVariacion,
} from '../services/personal/patronCalendario';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('expandirPatron · blindaje anti-cuelgue (datos corruptos)', () => {
  // REGRESIÓN · un patrón con un campo numérico NaN generaba un Invalid Date
  // cuya comparación con dHasta era siempre `NaN > 0 === false` → el `while(true)`
  // giraba PARA SIEMPRE y congelaba la pestaña (Presupuesto/Fiscal «in eternum»).
  // Debe LANZAR de inmediato (lo captura el llamante y se salta el compromiso),
  // nunca colgarse. El `timeout` bajo de Jest falla si volviera a girar sin fin.
  it('mensualDiaFijo con dia NaN → lanza, no cuelga', () => {
    expect(() =>
      expandirPatron({ tipo: 'mensualDiaFijo', dia: NaN } as never, '2026-01-01', '2046-12-31'),
    ).toThrow(/dia inválido/);
  }, 2000);

  it('cadaNMeses con campos NaN → lanza, no cuelga', () => {
    expect(() =>
      expandirPatron(
        { tipo: 'cadaNMeses', cadaNMeses: NaN, mesAncla: NaN, dia: NaN } as never,
        '2026-01-01',
        '2046-12-31',
      ),
    ).toThrow(/campos inválidos/);
  }, 2000);

  it('mensualDiaFijo válido a 20 años termina y no explota en número de fechas', () => {
    const fechas = expandirPatron({ tipo: 'mensualDiaFijo', dia: 15 }, '2026-01-01', '2046-12-31');
    // 21 años · 12 meses ≈ 252, con backstop de +2 años nunca es ilimitado.
    expect(fechas.length).toBeGreaterThan(200);
    expect(fechas.length).toBeLessThan(300);
  }, 2000);
});

describe('expandirPatron', () => {
  describe('mensualDiaFijo', () => {
    it('proyecta una fecha por mes en el día indicado', () => {
      const fechas = expandirPatron(
        { tipo: 'mensualDiaFijo', dia: 28 },
        '2026-01-01',
        '2026-04-30',
      );
      expect(fechas.map(iso)).toEqual([
        '2026-01-28',
        '2026-02-28',
        '2026-03-28',
        '2026-04-28',
      ]);
    });

    it('respeta el último día del mes cuando dia=31', () => {
      const fechas = expandirPatron(
        { tipo: 'mensualDiaFijo', dia: 31 },
        '2026-01-01',
        '2026-03-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    });
  });

  describe('mensualDiaRelativo', () => {
    it('genera el último día hábil de cada mes', () => {
      const fechas = expandirPatron(
        { tipo: 'mensualDiaRelativo', referencia: 'ultimoHabil' },
        '2026-01-01',
        '2026-03-31',
      );
      // Enero 2026: 30 ene = vie · feb 27 vie · mar 31 mar
      expect(fechas.map(iso)).toEqual(['2026-01-30', '2026-02-27', '2026-03-31']);
    });
  });

  describe('cadaNMeses', () => {
    it('bimestral con anclaje en febrero', () => {
      // Gas natural · feb · abr · jun · ago · oct · dic
      const fechas = expandirPatron(
        { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 2, dia: 5 },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual([
        '2026-02-05',
        '2026-04-05',
        '2026-06-05',
        '2026-08-05',
        '2026-10-05',
        '2026-12-05',
      ]);
    });
  });

  describe('anualMesesConcretos', () => {
    it('IBI · dos pagos en junio y noviembre', () => {
      const fechas = expandirPatron(
        { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 5 },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-05', '2026-11-05']);
    });

    // El IBI de Asturias no llega el mismo día las dos veces: el 15 de junio y
    // el 11 de noviembre. `diaPagoPorMes` es el sitio donde eso se dice, y el
    // único: el importe nunca decide cuándo.
    it('cada mes puede cargar SU día', () => {
      const fechas = expandirPatron(
        {
          tipo: 'anualMesesConcretos',
          mesesPago: [6, 11],
          diaPago: 15,
          diaPagoPorMes: { 6: 15, 11: 11 },
        },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-15', '2026-11-11']);
    });

    it('el mes sin día propio cae al de respaldo', () => {
      const fechas = expandirPatron(
        { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 5, diaPagoPorMes: { 11: 11 } },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-05', '2026-11-11']);
    });

    // Un patrón guardado antes de que `diaPagoPorMes` existiera no cambia.
    it('sin el mapa de días se comporta igual que siempre', () => {
      const fechas = expandirPatron(
        { tipo: 'anualMesesConcretos', mesesPago: [2, 6], diaPago: 5 },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-02-05', '2026-06-05']);
    });

    it('un día que ese mes no tiene cae al último · el 31 de febrero es el 28', () => {
      const fechas = expandirPatron(
        { tipo: 'anualMesesConcretos', mesesPago: [2], diaPago: 1, diaPagoPorMes: { 2: 31 } },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-02-28']);
    });

    it('y se repite igual cada año · no es un tramo', () => {
      const fechas = expandirPatron(
        { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 15, diaPagoPorMes: { 6: 15, 11: 11 } },
        '2026-01-01',
        '2027-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-15', '2026-11-11', '2027-06-15', '2027-11-11']);
    });
  });

  describe('pagasExtra', () => {
    it('genera dos eventos al año en junio y diciembre', () => {
      const fechas = expandirPatron(
        { tipo: 'pagasExtra', mesesExtra: [6, 12], referencia: 'ultimoHabil' },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-30', '2026-12-31']);
    });
  });

  describe('puntual', () => {
    it('genera un único evento si está dentro del horizonte', () => {
      const fechas = expandirPatron(
        { tipo: 'puntual', fecha: '2026-06-30', importe: -250 },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas.map(iso)).toEqual(['2026-06-30']);
    });

    it('no genera nada si está fuera del horizonte', () => {
      const fechas = expandirPatron(
        { tipo: 'puntual', fecha: '2025-06-30', importe: -250 },
        '2026-01-01',
        '2026-12-31',
      );
      expect(fechas).toEqual([]);
    });
  });
});

describe('calcularImporte', () => {
  it('modo fijo devuelve siempre el mismo importe', () => {
    expect(calcularImporte({ modo: 'fijo', importe: 100 }, new Date('2026-06-15'))).toBe(100);
  });

  it('modo diferenciadoPorMes lee el importe correcto del mes', () => {
    const importes = [138, 122, 92, 87, 74, 71, 78, 80, 88, 95, 110, 124];
    expect(calcularImporte(
      { modo: 'diferenciadoPorMes', importesPorMes: importes },
      new Date('2026-01-15'),
    )).toBe(138);
    expect(calcularImporte(
      { modo: 'diferenciadoPorMes', importesPorMes: importes },
      new Date('2026-06-15'),
    )).toBe(71);
  });

  it('modo porPago lee el importe del mes específico', () => {
    expect(calcularImporte(
      { modo: 'porPago', importesPorPago: { 6: 250, 11: 350 } },
      new Date('2026-06-05'),
    )).toBe(250);
    expect(calcularImporte(
      { modo: 'porPago', importesPorPago: { 6: 250, 11: 350 } },
      new Date('2026-11-05'),
    )).toBe(350);
  });

  it('modo porPago lanza si el mes no está definido', () => {
    expect(() =>
      calcularImporte(
        { modo: 'porPago', importesPorPago: { 6: 250 } },
        new Date('2026-11-05'),
      ),
    ).toThrow();
  });
});

describe('aplicarVariacion', () => {
  it('sin variación devuelve el importe base', () => {
    expect(aplicarVariacion(
      1000,
      { tipo: 'sinVariacion' },
      new Date('2025-01-01'),
      new Date('2026-06-01'),
    )).toBe(1000);
  });

  it('IPC anual aplica una vez tras cruzar el mes de revisión', () => {
    const out = aplicarVariacion(
      1000,
      { tipo: 'ipcAnual', mesRevision: 6, ultimoIpcAplicado: 0.034 },
      new Date('2025-01-01'),
      new Date('2026-07-01'),
    );
    // Una revisión cruzada (jun 2026) · 1000 * 1.034
    expect(out).toBeCloseTo(1034, 2);
  });

  it('IPC anual no aplica si la fecha del evento no cruza la revisión', () => {
    const out = aplicarVariacion(
      1000,
      { tipo: 'ipcAnual', mesRevision: 6, ultimoIpcAplicado: 0.034 },
      new Date('2025-01-01'),
      new Date('2026-03-01'),
    );
    // Año-1 sin cruzar revisión → revisiones=0
    expect(out).toBe(1000);
  });
});
