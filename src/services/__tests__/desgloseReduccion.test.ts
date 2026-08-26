// La forma del dato de reducción · un solo sitio, un solo lenguaje.
//
// Hasta aquí la reducción viajaba por la app como `porcentajeReduccion: number`
// (60 fijo) o `porcentajeReduccionHabitual` (el «26 %» efectivo: reducción ÷
// rendimiento). Ninguno de los dos dice nada: el 60 era un invento y el 26 es
// una media entre tramos que no aparece en ninguna ley.
//
// Lo que se prueba aquí es el CONTRATO del dato nuevo: importe como dato
// principal, y un tramo por cada régimen con su % NOMINAL. Y sobre todo lo que
// NO hace: no inventa un porcentaje cuando no se puede derivar con exactitud, y
// no rellena con ceros lo que simplemente no se sabe.

import {
  desgloseDeclarado,
  desgloseEnCurso,
  desgloseAusente,
  etiquetaTramo,
  tipoDeModalidad,
  hayDato,
  escalarDesglose,
  tramosDeContratos,
  ingresosDelContratoEnEjercicio,
  type DesgloseReduccion,
} from '../desgloseReduccion';

const pcts = (d: DesgloseReduccion): Array<number | null> => d.tramos.map((t) => t.pct);
const tipos = (d: DesgloseReduccion): string[] => d.tramos.map((t) => t.tipo);

// ───────────────────────────────────────────────────────────────────────────
describe('año declarado · el importe manda y el % solo si es exacto', () => {
  it('un único arrendamiento de vivienda con reducción · el % nominal se deriva', () => {
    // 3.200,81 sobre 5.334,69 es el 60,0 % clavado: hay un solo tramo, así que
    // la división da el nominal sin mezclar nada.
    const d = desgloseDeclarado({
      arrendamientos: [{ conReduccion: true }],
      reduccion: 3200.81,
      rendimientoAntes: 5334.69,
    });

    expect(d.origen).toBe('declarado');
    expect(d.importe).toBe(3200.81);
    expect(d.tramos).toEqual([{ tipo: 'larga_estancia', pct: 60, base: 5334.69 }]);
  });

  it('dos tramos · el reducible va SIN cifra, porque 0150÷0149 los mezcla', () => {
    // El caso del mockup: 1.390,94 sobre 5.334,69 sale 26,07 %. Ese número no
    // es de nadie —el 60 % se aplicó solo sobre la vivienda habitual— y
    // es justo el que hay que dejar de enseñar.
    const d = desgloseDeclarado({
      arrendamientos: [
        { conReduccion: true },
        { conReduccion: false },
      ],
      reduccion: 1390.94,
      rendimientoAntes: 5334.69,
    });

    expect(d.importe).toBe(1390.94);
    expect(pcts(d)).toEqual([null, 0]);
    expect(tipos(d)).toEqual(['larga_estancia', 'temporada_o_turistico']);
    // Y el 26 no aparece por ninguna parte de la estructura.
    expect(JSON.stringify(d)).not.toContain('26');
  });

  it('un solo tramo pero la división no cae en ningún nominal · sin cifra', () => {
    // Prorrateo por días, un ajuste, lo que sea: si no es 50/60/70/90 no se
    // redondea al más cercano, se calla.
    const d = desgloseDeclarado({
      arrendamientos: [{ conReduccion: true }],
      reduccion: 2000,
      rendimientoAntes: 5334.69,
    });
    expect(pcts(d)).toEqual([null]);
    expect(d.importe).toBe(2000);
  });

  it('los cuatro nominales del art. 23.2 se reconocen', () => {
    const derivado = (pct: number): number | null =>
      desgloseDeclarado({
        arrendamientos: [{ conReduccion: true }],
        reduccion: Math.round(1000 * pct) / 100,
        rendimientoAntes: 1000,
      }).tramos[0].pct;

    expect([50, 60, 70, 90].map(derivado)).toEqual([50, 60, 70, 90]);
  });

  it('declarado sin reducción · 0 % explícito, no ausencia de dato', () => {
    const d = desgloseDeclarado({
      arrendamientos: [{ conReduccion: false }],
      reduccion: 0,
      rendimientoAntes: 4000,
    });
    expect(d.importe).toBe(0);
    expect(pcts(d)).toEqual([0]);
    expect(hayDato(d)).toBe(true);
  });

  it('sin rendimiento base no se divide · el importe sigue siendo verdad', () => {
    const d = desgloseDeclarado({
      arrendamientos: [{ conReduccion: true }],
      reduccion: 3200.81,
      rendimientoAntes: 0,
    });
    expect(d.importe).toBe(3200.81);
    expect(pcts(d)).toEqual([null]);
  });

  it('sin arrendamientos en el XML · importe sí, tramos no inventados', () => {
    const d = desgloseDeclarado({ arrendamientos: [], reduccion: 900, rendimientoAntes: 1500 });
    expect(d.importe).toBe(900);
    expect(d.tramos).toEqual([]);
  });

  it('arrendamientos iguales se agrupan en un solo chip', () => {
    const d = desgloseDeclarado({
      arrendamientos: [
        { conReduccion: true },
        { conReduccion: true },
      ],
      reduccion: 600,
      rendimientoAntes: 1000,
    });
    // Un chip, pero dos arrendamientos: sigue sin poder derivarse el nominal,
    // porque 0149 no viene partido por arrendamiento.
    expect(d.tramos).toHaveLength(1);
    expect(pcts(d)).toEqual([null]);
  });

  it('el tramo sale de si reduce, no del TAR del XML', () => {
    // Solo la vivienda habitual reduce, así que un tramo con reducción es
    // habitual y punto: no hace falta —ni se puede— leerlo del TAR, que mete
    // local, temporada y turístico en el mismo saco.
    const conReduccion = desgloseDeclarado({
      arrendamientos: [{ conReduccion: true }],
      reduccion: 600,
      rendimientoAntes: 1000,
    });
    const sinReduccion = desgloseDeclarado({
      arrendamientos: [{ conReduccion: false }],
      reduccion: 0,
      rendimientoAntes: 1000,
    });

    expect(conReduccion.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual']);
    // Temporada y turístico se comportan igual en importado y el XML no los
    // separa: el chip los nombra a los dos.
    expect(sinReduccion.tramos.map(etiquetaTramo)).toEqual(['0% temporada/turístico']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('año en curso · el nominal lo da el motor, no una división', () => {
  it('un habitual al 60 % · importe y tramo', () => {
    const d = desgloseEnCurso(
      [{ tipo: 'larga_estancia', pct: 60, ingresos: 6000 }],
      5000,
    );
    expect(d.origen).toBe('atlas');
    expect(d.importe).toBe(3000);
    expect(d.tramos).toEqual([{ tipo: 'larga_estancia', pct: 60, base: 5000 }]);
  });

  it('habitual + temporada · el 0 % de temporada es explícito y no diluye el 60', () => {
    // Mismo perfil que el mockup: el rendimiento se reparte por ingresos, y el
    // 60 % se aplica SOLO sobre la parte de vivienda habitual.
    const d = desgloseEnCurso(
      [
        { tipo: 'larga_estancia', pct: 60, ingresos: 6000 },
        { tipo: 'media_estancia', pct: 0, ingresos: 4000 },
      ],
      5000,
    );

    expect(tipos(d)).toEqual(['larga_estancia', 'media_estancia']);
    expect(pcts(d)).toEqual([60, 0]);
    expect(d.tramos[0].base).toBe(3000);
    expect(d.tramos[1].base).toBe(2000);
    expect(d.importe).toBe(1800);
  });

  it('dos habituales con nominal distinto · dos chips, no una media', () => {
    // Uno firmado antes de la Ley (60 %) y otro después (50 %). El «55 %» que
    // saldría de promediarlos no existe en el art. 23.2.
    const d = desgloseEnCurso(
      [
        { tipo: 'larga_estancia', pct: 60, ingresos: 5000 },
        { tipo: 'larga_estancia', pct: 50, ingresos: 5000 },
      ],
      4000,
    );
    expect(pcts(d)).toEqual([60, 50]);
    expect(d.importe).toBe(1200 + 1000);
  });

  it('rendimiento negativo · no se reduce una pérdida', () => {
    const d = desgloseEnCurso([{ tipo: 'larga_estancia', pct: 60, ingresos: 6000 }], -800);
    expect(d.importe).toBe(0);
    expect(d.tramos[0].pct).toBe(60);
  });

  it('sin ingresos no hay reparto posible · importe 0, no un número inventado', () => {
    const d = desgloseEnCurso([{ tipo: 'larga_estancia', pct: 60, ingresos: 0 }], 5000);
    expect(d.importe).toBe(0);
  });

  it('el tipo sale de la modalidad del contrato', () => {
    expect(tipoDeModalidad('habitual')).toBe('larga_estancia');
    expect(tipoDeModalidad('media_estancia')).toBe('media_estancia');
    // El nombre viejo se sigue leyendo: un contrato guardado antes del
    // renombrado no puede cambiar de fiscalidad al abrirlo.
    expect(tipoDeModalidad('vacacional')).toBe('corta_estancia');
    expect(tipoDeModalidad('corta_estancia')).toBe('corta_estancia');
    // Una modalidad que no reconocemos no reduce, y no sabemos cuál de las dos
    // es: el mismo chip que en importado.
    expect(tipoDeModalidad(undefined)).toBe('temporada_o_turistico');
  });

  it('los tramos se ordenan de mayor a menor reducción', () => {
    const d = desgloseEnCurso(
      [
        { tipo: 'media_estancia', pct: 0, ingresos: 1000 },
        { tipo: 'larga_estancia', pct: 90, ingresos: 1000 },
        { tipo: 'larga_estancia', pct: 50, ingresos: 1000 },
      ],
      3000,
    );
    expect(pcts(d)).toEqual([90, 50, 0]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('dato ausente · se dice, no se rellena', () => {
  it('sin base ni arrendamientos el importe es null, no 0', () => {
    // Es la diferencia entre «no hubo reducción» y «no lo sabemos». Poner 0 en
    // el segundo caso es exactamente lo que hacía el recálculo silencioso.
    const d = desgloseAusente();
    expect(d.importe).toBeNull();
    expect(d.tramos).toEqual([]);
    expect(hayDato(d)).toBe(false);
  });

  it('en curso sin rendimiento conocido · ausente, no cero', () => {
    const d = desgloseEnCurso([{ tipo: 'larga_estancia', pct: 60, ingresos: 6000 }], null);
    expect(hayDato(d)).toBe(false);
    expect(d.importe).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('el rótulo · un solo lenguaje para importado y en curso', () => {
  it('con cifra cuando el nominal se conoce', () => {
    expect(etiquetaTramo({ tipo: 'larga_estancia', pct: 60 })).toBe('60% vivienda habitual');
    expect(etiquetaTramo({ tipo: 'media_estancia', pct: 0 })).toBe('0% temporada');
    expect(etiquetaTramo({ tipo: 'corta_estancia', pct: 0 })).toBe('0% turístico');
  });

  it('sin cifra cuando no se conoce · el nombre del tramo, y ya', () => {
    expect(etiquetaTramo({ tipo: 'larga_estancia', pct: null })).toBe('vivienda habitual');
    expect(etiquetaTramo({ tipo: 'temporada_o_turistico', pct: 0 })).toBe('0% temporada/turístico');
  });

  it('el mismo perfil declarado y en curso dice lo mismo', () => {
    // Un único habitual al 60 %: lo que ATLAS calcula y lo que se declaró tienen
    // que rotularse igual, o el usuario ve dos verdades del mismo contrato.
    const enCurso = desgloseEnCurso([{ tipo: 'larga_estancia', pct: 60, ingresos: 6000 }], 5000);
    const declarado = desgloseDeclarado({
      arrendamientos: [{ conReduccion: true }],
      reduccion: 3000,
      rendimientoAntes: 5000,
    });

    expect(declarado.importe).toBe(enCurso.importe);
    expect(declarado.tramos.map(etiquetaTramo)).toEqual(enCurso.tramos.map(etiquetaTramo));
    expect(enCurso.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('de contratos a tramos · el puente que usan las pantallas', () => {
  const habitual = (extra: Record<string, unknown> = {}) => ({
    modalidad: 'larga_estancia',
    fechaInicio: '2025-01-01',
    fechaFin: '2030-12-31',
    rentaMensual: 500,
    ...extra,
  });

  it('los ingresos del ejercicio son la renta por los meses de solape', () => {
    expect(ingresosDelContratoEnEjercicio(habitual(), 2025)).toBe(6000);
    // Entra en julio: solo medio año cuenta en ese ejercicio.
    expect(ingresosDelContratoEnEjercicio(habitual({ fechaInicio: '2025-07-01' }), 2025)).toBe(3000);
    // Empieza después del ejercicio: no aporta nada.
    expect(ingresosDelContratoEnEjercicio(habitual({ fechaInicio: '2026-01-01' }), 2025)).toBe(0);
  });

  it('cada contrato aporta su tipo y su nominal del motor', () => {
    const tramos = tramosDeContratos(
      [
        habitual({ fechaFirmaContrato: '2022-01-01' }),
        { modalidad: 'media_estancia', fechaInicio: '2025-01-01', fechaFin: '2025-12-31', rentaMensual: 800 },
      ],
      2025,
    );

    expect(tramos).toEqual([
      { tipo: 'larga_estancia', pct: 60, ingresos: 6000 },
      { tipo: 'media_estancia', pct: 0, ingresos: 9600 },
    ]);
  });

  it('el desglose completo sale de los contratos y el rendimiento', () => {
    // El camino entero, que es el que consumen las pantallas del año en curso.
    const d = desgloseEnCurso(
      tramosDeContratos([habitual({ fechaFirmaContrato: '2022-01-01' })], 2025),
      5000,
    );
    expect(d.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual']);
    expect(d.importe).toBe(3000);
  });

  it('sin contratos del ejercicio no hay nada que decir · ausente, no 0 %', () => {
    // Este es el agujero que cerraba el motor B inventándose un 60 %: sin
    // contratos no se sabe nada del régimen, y el rótulo tiene que decirlo.
    const d = desgloseEnCurso(tramosDeContratos([], 2025), 5000);
    expect(hayDato(d)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('escalar · el simulador cambia la base, no las condiciones', () => {
  const base = desgloseEnCurso(
    [
      { tipo: 'larga_estancia', pct: 60, ingresos: 6000 },
      { tipo: 'media_estancia', pct: 0, ingresos: 4000 },
    ],
    5000,
  );

  it('subir la renta sube el importe y deja los nominales quietos', () => {
    // Simular «¿y si cobro más?» no cambia lo que dice el art. 23.2 sobre este
    // contrato: cambia sobre cuánto se aplica.
    const d = escalarDesglose(base, 10000);
    expect(d.tramos.map(etiquetaTramo)).toEqual(['60% vivienda habitual', '0% temporada']);
    expect(d.importe).toBe(3600);
    expect(d.rendimientoAntes).toBe(10000);
  });

  it('un rendimiento que se vuelve negativo no reduce nada', () => {
    expect(escalarDesglose(base, -1000).importe).toBe(0);
  });

  it('sin base previa no se puede escalar · ausente, no un cero falso', () => {
    const sinBase = desgloseDeclarado({
      arrendamientos: [
        { conReduccion: true },
        { conReduccion: false },
      ],
      reduccion: 1390.94,
      rendimientoAntes: 5334.69,
    });
    // Los tramos de un año declarado mixto no traen base repartida: el XML no
    // la parte. Escalarlos sería inventarse el reparto.
    expect(hayDato(escalarDesglose(sinBase, 8000))).toBe(false);
  });
});
