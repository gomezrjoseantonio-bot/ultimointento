// ============================================================================
// Lo que de verdad deduce un inmueble en un ejercicio · DEDUC Parte B
// ============================================================================
//
// `getSumaPorCasilla` sumaba el importe ENTERO de cada gasto, sin mirar si el
// inmueble estuvo arrendado. La AEAT dice lo contrario, y lo enumera:
//
//   «en el supuesto de que el inmueble no hubiera estado arrendado durante todo
//   el año, la amortización deducible, los intereses y demás gastos de
//   financiación, los gastos en primas de seguros, comunidad, IBI, suministros
//   etc., serán los que correspondan al número de días del año en que el
//   inmueble ha estado arrendado.»
//
// Y sumaba también lo que aún no había pasado: los intereses nacen `previsto`
// para los doce meses, así que en marzo ya deducía el año entero.
// ============================================================================

import { sumaDeducidaPorCasilla, yaOcurrio, CASILLAS_DE_GASTO } from '../gastoDeducible';
import type { GastoInmueble } from '../db';

const g = (over: Partial<GastoInmueble>): GastoInmueble =>
  ({
    inmuebleId: 1,
    ejercicio: 2025,
    fecha: '2025-03-15',
    concepto: 'x',
    categoria: 'ibi',
    casillaAEAT: '0115',
    importe: 400,
    origen: 'manual',
    estado: 'confirmado',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as GastoInmueble;

// ─── qué cuenta como «ya ocurrió» ───────────────────────────────────────────

describe('yaOcurrio · lo que pasó de verdad', () => {
  it('lo confirmado y lo declarado ocurrió', () => {
    expect(yaOcurrio(g({ estado: 'confirmado' }))).toBe(true);
    expect(yaOcurrio(g({ estado: 'declarado' }))).toBe(true);
  });

  it('un previsto a secas, no', () => {
    expect(yaOcurrio(g({ estado: 'previsto' }))).toBe(false);
  });

  // Lo que la tarea temía: «conciliado» NO es un valor de `estado`. Una línea
  // casada con un apunte del banco ya ocurrió aunque su `estado` no se haya
  // movido, así que filtrar solo por `estado === 'confirmado'` se comería
  // gastos reales.
  it('CONCILIADO · casada con un movimiento del banco, ocurrió', () => {
    expect(yaOcurrio(g({ estado: 'previsto', movimientoId: 'mov-7' }))).toBe(true);
  });

  it('CONCILIADO · marcada como confirmada en tesorería, ocurrió', () => {
    expect(yaOcurrio(g({ estado: 'previsto', estadoTesoreria: 'confirmed' }))).toBe(true);
  });

  it('desconciliada vuelve a ser previsión · no cuenta', () => {
    expect(yaOcurrio(g({ estado: 'previsto', movimientoId: undefined, estadoTesoreria: 'predicted' }))).toBe(false);
  });
});

// ─── el prorrateo ───────────────────────────────────────────────────────────

describe('sumaDeducidaPorCasilla · por los días que estuvo arrendado', () => {
  it('TENDERINA · IBI de 400 € con 272 de 365 días → 298,08 €', () => {
    const suma = sumaDeducidaPorCasilla([g({ importe: 400 })], 272, 365);
    expect(suma['0115']).toBeCloseTo(298.08, 2);
  });

  it('arrendado todo el año · el gasto entero', () => {
    expect(sumaDeducidaPorCasilla([g({ importe: 400 })], 365, 365)['0115']).toBe(400);
    expect(sumaDeducidaPorCasilla([g({ importe: 400 })], 366, 366)['0115']).toBe(400);
  });

  it('sin un solo día arrendado · no deduce nada', () => {
    expect(sumaDeducidaPorCasilla([g({ importe: 400 })], 0, 365)['0115']).toBeUndefined();
  });

  it('ni siquiera con cero días se pierde lo declarado', () => {
    const base = g({ casillaAEAT: '0130', importe: 90_000, estado: 'declarado', origen: 'xml_aeat' });
    expect(sumaDeducidaPorCasilla([base, g({ importe: 400 })], 0, 365)).toEqual({ '0130': 90_000 });
  });

  it('los INTERESES (0105) van al mismo prorrateo · no al 100 %', () => {
    const interes = g({ categoria: 'intereses', casillaAEAT: '0105', importe: 1200, origen: 'prestamo' });
    expect(sumaDeducidaPorCasilla([interes], 272, 365)['0105']).toBeCloseTo(894.25, 2);
  });

  it('las siete casillas de gasto se prorratean, cada una por su lado', () => {
    const gastos = CASILLAS_DE_GASTO.map((casilla) => g({ casillaAEAT: casilla, importe: 365 }));
    const suma = sumaDeducidaPorCasilla(gastos, 100, 365);
    for (const casilla of CASILLAS_DE_GASTO) expect(suma[casilla]).toBeCloseTo(100, 2);
  });

  it('varios gastos de la misma casilla se suman antes de repartir', () => {
    const suma = sumaDeducidaPorCasilla([g({ importe: 300 }), g({ importe: 100 })], 272, 365);
    expect(suma['0115']).toBeCloseTo(298.08, 2);
  });

  it('redondea a dos decimales · es dinero', () => {
    const suma = sumaDeducidaPorCasilla([g({ importe: 100 })], 272, 365);
    expect(suma['0115']).toBe(74.52);
  });
});

// ─── los dos filtros ────────────────────────────────────────────────────────

describe('sumaDeducidaPorCasilla · qué entra y qué no', () => {
  it('un gasto PREVISTO no entra · en marzo no se deducen los intereses de diciembre', () => {
    const interesDeDiciembre = g({
      categoria: 'intereses', casillaAEAT: '0105', importe: 100,
      fecha: '2025-12-01', origen: 'prestamo', estado: 'previsto',
    });
    expect(sumaDeducidaPorCasilla([interesDeDiciembre], 365, 365)['0105']).toBeUndefined();
  });

  it('pero el interés ya cargado sí entra', () => {
    const cargado = g({ categoria: 'intereses', casillaAEAT: '0105', importe: 100, origen: 'prestamo', movimientoId: 'mov-3' });
    expect(sumaDeducidaPorCasilla([cargado], 365, 365)['0105']).toBe(100);
  });

  // El filtro es por CASILLA y no por concepto porque la fila no guarda de qué
  // concepto viene. En la práctica da igual: lo amortizable vive en otros
  // stores y nunca pasa por aquí.
  // Lo que el import del XML guarda como filas —mejoras (0129), base de
  // amortización (0130) y amortización declarada (0131)— NO es gasto: es lo que
  // se declaró. Pasa entero, sin prorratear, o el resumen fiscal se quedaría sin
  // base amortizable.
  it('las casillas que NO son de gasto pasan tal cual, sin prorratear', () => {
    const mejoras = g({ casillaAEAT: '0129', importe: 5_000, estado: 'declarado', origen: 'xml_aeat' });
    const base = g({ casillaAEAT: '0130', importe: 90_000, estado: 'declarado', origen: 'xml_aeat' });
    const amortDecl = g({ casillaAEAT: '0131', importe: 2_700, estado: 'declarado', origen: 'xml_aeat' });
    const suma = sumaDeducidaPorCasilla([mejoras, base, amortDecl, g({ importe: 400 })], 272, 365);
    expect(suma['0129']).toBe(5_000);
    expect(suma['0130']).toBe(90_000);
    expect(suma['0131']).toBe(2_700);
    expect(suma['0115']).toBeCloseTo(298.08, 2); // el IBI sí se prorratea
  });

  it('las siete de gasto son las que dice el catálogo', () => {
    expect([...CASILLAS_DE_GASTO].sort()).toEqual(['0105', '0106', '0109', '0112', '0113', '0114', '0115']);
  });

  it('un importe que no es número no rompe la suma', () => {
    const suma = sumaDeducidaPorCasilla(
      [g({ importe: NaN }), g({ importe: undefined as unknown as number }), g({ importe: 400 })],
      365, 365,
    );
    expect(suma['0115']).toBe(400);
  });

  it('sin gastos, ninguna casilla', () => {
    expect(sumaDeducidaPorCasilla([], 272, 365)).toEqual({});
  });
});
