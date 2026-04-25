// ATLAS Personal v1.1 · tests del motor de calendario (sección 2)

import {
  expandirPatron,
  calcularImporte,
  aplicarVariacion,
} from '../services/personal/patronCalendario';

const iso = (d: Date) => d.toISOString().slice(0, 10);

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
