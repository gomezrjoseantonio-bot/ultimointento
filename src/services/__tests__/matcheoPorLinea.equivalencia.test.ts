// ============================================================================
// E1.4b · EQUIVALENCIA · matchear por MOVIMIENTO y por LÍNEA da lo mismo
// ============================================================================
//
// El juez de E1.4b son los tests de E1.4a (`caracterizacionMatcheo.test.ts`),
// que no se tocan. Esto es el certificado del adaptador: con las MISMAS
// entradas, la ruta de hoy (movimientos insertados, releídos por id) y la ruta
// nueva (líneas de `lineasExtracto`, convertidas en memoria) devuelven el mismo
// resultado en las cuatro rutas —matches, multiMatches, sinMatch, sugerencias,
// deterministas, confirmados—.
//
// Y algo más, que es la nota para E1.5: en la ruta por línea NO hay ningún
// movimiento en la base. `movements` está vacío y nadie lo lee. El matcheo ya
// no necesita que el movimiento esté insertado.
//
// El lote es el mismo «lote de agosto» de E1.4a. Los `lineaId` (500+) están
// lejos de los `movementId` (1..19) a propósito: si algún sitio confundiera
// una numeración con la otra, la equivalencia se rompería.
// ============================================================================

import { matchBatch, matchLineas } from '../movementMatchingService';
import { suggestForLineas, suggestForUnmatched } from '../movementSuggestionService';
import {
  reconocerDeterministas,
  reconocerDeterministasDeLineas,
} from '../deterministas/matcheoDeterminista';
import { confirmadosPorLinea, confirmadosPorLineaExtracto } from '../conciliacionConfirmados';
import {
  entraAlMatcheo,
  movementDesdeLinea,
  movementIdsPorLinea,
  origenParaMovimiento,
} from '../lineaComoMovimiento';
import { buildLearnKey } from '../movementLearningService';
import { initDB, type Movement, type TreasuryEvent } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';

jest.mock('../db', () => ({ initDB: jest.fn() }));

// ─── La base fingida · igual que en E1.4a, con un espía sobre `movements` ───

type Fila = Record<string, unknown> & { id?: number | string };
type Stores = Record<string, Fila[]>;

let stores: Stores;
/** Cuántas veces se ha leído el store `movements` · en la ruta por línea debe ser 0. */
let lecturasDeMovements = 0;

function db() {
  const lista = (s: string): Fila[] => {
    if (s === 'movements') lecturasDeMovements += 1;
    return (stores[s] ??= []);
  };
  return {
    get: async (s: string, key: number | string) => lista(s).find((r) => r.id === key),
    getAll: async (s: string) => lista(s),
    getAllFromIndex: async (s: string, index: string, clave: unknown) =>
      lista(s).filter((r) => r[index] === clave),
  };
}

const CUENTA = 9;

function mov(over: Partial<Movement> & { id: number }): Movement {
  return {
    accountId: CUENTA,
    date: '2026-08-01',
    amount: 0,
    description: '',
    status: 'pendiente' as never,
    unifiedStatus: 'no_planificado',
    source: 'import',
    category: { tipo: 'Gastos' } as never,
    importBatch: 'lote-agosto',
    statusConciliacion: 'sin_match',
    ...over,
  } as Movement;
}

function previsto(over: Partial<TreasuryEvent> & { id: number }): TreasuryEvent {
  return {
    type: 'expense',
    amount: 0,
    predictedDate: '2026-08-01',
    description: '',
    sourceType: 'gasto',
    status: 'predicted',
    accountId: CUENTA,
    ...over,
  } as TreasuryEvent;
}

/**
 * La fila de `lineasExtracto` de la que HOY nació ese movimiento (E1.1).
 * `contraparte` NO se rellena: el fichero no traía columna, así que el
 * movimiento la sacó del texto · el adaptador tiene que hacer lo mismo.
 */
function lineaDe(m: Movement, extra: Partial<LineaExtractoPersistida> = {}): LineaExtractoPersistida {
  return {
    id: 500 + (m.id as number),
    fechaOperacion: m.date,
    fechaValor: m.valueDate ?? m.date,
    importe: m.amount,
    conceptoLiteral: m.description,
    importBatchId: m.importBatch as string,
    accountId: m.accountId,
    hashLinea: `v1:${m.id}`,
    hashMovement: `h${m.id}`,
    estado: 'resuelta',
    movementIds: [m.id as number],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extra,
  };
}

const NETFLIX = mov({ id: 16, date: '2026-08-28', amount: -12.99, description: 'NETFLIX.COM' });
const DEVOLUCION = mov({ id: 18, date: '2026-08-29', amount: 50, description: 'DEVOLUCION AMAZON EU' });

const LOTE: Movement[] = [
  mov({ id: 1, date: '2026-08-01', amount: -454.66, description: 'RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026' }),
  mov({ id: 2, date: '2026-08-06', amount: 380, description: 'TRANSFERENCIA ALQUILER AGOSTO HAB 2' }),
  mov({ id: 3, date: '2026-08-05', amount: 380, description: 'BIZUM DE LAURA SANCHEZ', counterparty: 'LAURA SANCHEZ', paymentMethod: 'Bizum' }),
  mov({ id: 4, date: '2026-08-12', amount: -108.44, description: 'RECIBO IBERDROLA CLIENTES SAU' }),
  mov({ id: 5, date: '2026-09-03', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
  mov({ id: 6, date: '2026-08-20', amount: -150, description: 'ADEUDO COMUNIDAD PROPIETARIOS TENDERINA 12' }),
  mov({ id: 7, date: '2026-08-10', amount: -72.5, description: 'RECIBO CDAD PROP CALLE URIA 5' }),
  mov({ id: 8, date: '2026-08-10', amount: -72.5, description: 'RECIBO CDAD PROP CALLE URIA 5' }),
  mov({ id: 9, date: '2026-08-25', amount: 3940.12, description: 'NOMINA ORANGE ESPANA SAU 08/2026' }),
  mov({ id: 10, date: '2026-08-12', amount: 607.5, description: 'ABONO INTERESES SMARTFLIP' }),
  mov({ id: 11, date: '2026-08-18', amount: -23.9, description: 'AMAZON EU SARL COMPRA' }),
  mov({ id: 12, date: '2026-08-14', amount: -30, description: 'PAGO EN REVOLUT' }),
  mov({ id: 13, date: '2026-08-03', amount: -321.5, description: 'RECIBO IBI AYTO OVIEDO' }),
  mov({ id: 14, date: '2026-08-09', amount: -70.48, description: 'COMPRA BIZUM IRYO', paymentMethod: 'Bizum' }),
  mov({ id: 15, date: '2026-08-22', amount: 200, description: 'TRANSFERENCIA RECIBIDA' }),
  NETFLIX,
  mov({ id: 17, date: '2026-08-15', amount: -56, description: 'RECIBO NATURGY IBERIA SA' }),
  DEVOLUCION,
  mov({ id: 19, date: '2026-08-20', amount: 150000, description: 'TRANSFERENCIA VENTA NOTARIA' }),
];
const LINEAS: LineaExtractoPersistida[] = LOTE.map((m) => lineaDe(m));

const PREVISTOS: TreasuryEvent[] = [
  previsto({ id: 101, type: 'expense', amount: 454.66, predictedDate: '2026-08-01', sourceType: 'prestamo', providerName: 'Unicaja', description: 'Cuota Unicaja', categoryKey: 'vivienda.hipoteca', ambito: 'INMUEBLE', inmuebleId: 4 }),
  previsto({ id: 102, type: 'income', amount: 380, predictedDate: '2026-08-05', sourceType: 'contract', counterparty: 'Adnan Parwez Khan', description: 'Renta hab 2' }),
  previsto({ id: 103, type: 'income', amount: 380, predictedDate: '2026-08-05', sourceType: 'contract', counterparty: 'Laura Sánchez Ruiz', description: 'Renta hab 3' }),
  previsto({ id: 104, type: 'expense', amount: 45, predictedDate: '2026-08-12', sourceType: 'gasto_recurrente', providerName: 'Iberdrola', description: 'Luz Tenderina' }),
  previsto({ id: 105, type: 'expense', amount: 82, predictedDate: '2026-08-27', sourceType: 'gasto_recurrente', description: 'Agua Tenderina' }),
  previsto({ id: 106, type: 'expense', amount: 100, predictedDate: '2026-08-20', sourceType: 'gasto_recurrente', description: 'Comunidad Tenderina' }),
  previsto({ id: 107, type: 'expense', amount: 50, predictedDate: '2026-08-20', sourceType: 'gasto_recurrente', description: 'Comunidad garaje' }),
  previsto({ id: 108, type: 'expense', amount: 72.5, predictedDate: '2026-08-10', sourceType: 'gasto_recurrente', providerName: 'CALLE URIA', description: 'Comunidad Uría' }),
  previsto({ id: 109, type: 'expense', amount: 30, predictedDate: '2026-08-14', sourceType: 'gasto', providerName: 'Revolut', description: 'Revolut', descartado: true }),
];

function libros(): Stores {
  return {
    treasuryEvents: [...PREVISTOS],
    movementLearningRules: [
      { id: 1, learnKey: buildLearnKey(NETFLIX), categoria: 'ocio', ambito: 'PERSONAL', appliedCount: 5, updatedAt: '2026-07-01T00:00:00.000Z' },
      { id: 2, learnKey: buildLearnKey(DEVOLUCION), categoria: 'tecnologia', ambito: 'PERSONAL', appliedCount: 3, updatedAt: '2026-07-01T00:00:00.000Z' },
      { id: 9, learnKey: 'x', categoria: 'alquiler', ambito: 'INMUEBLE', aliasContraparte: 'MPARWEZ', contraparteCanonica: 'Adnan Parwez Khan' },
    ],
    compromisosRecurrentes: [
      { id: 3, alias: 'Gas Tenderina', ambito: 'inmueble', inmuebleId: 4, cuentaCargo: CUENTA, estado: 'activo', importe: { modo: 'fijo', importe: 56 }, proveedor: { nombre: 'Naturgy' }, categoria: 'suministros' },
    ],
    contracts: [
      { id: 21, inmuebleId: 4, estadoContrato: 'activo', inquilino: { nombre: 'Laura', apellidos: 'Sánchez Ruiz' } },
      { id: 22, inmuebleId: 4, estadoContrato: 'activo', inquilino: { nombre: 'Adnan', apellidos: 'Parwez Khan' } },
    ],
    prestamos: [
      {
        id: 'p1', nombre: 'Unicaja Tenderina', inmuebleId: '4',
        planPagos: { prestamoId: 'p1', fechaGeneracion: '', resumen: {}, periodos: [
          { periodo: 7, fechaCargo: '2026-08-01', cuota: 454.66, interes: 120.4, amortizacion: 334.26, pagado: false },
          { periodo: 8, fechaCargo: '2026-09-01', cuota: 454.66, interes: 119.5, amortizacion: 335.16, pagado: false },
        ] },
      },
    ],
    property_sales: [
      { id: 7, propertyId: 5, status: 'confirmed', saleDate: '2026-08-20', netProceeds: 150000, loanSettlement: { total: 0 } },
    ],
    inversiones: [
      { id: 'i1', nombre: 'SmartFlip', tipo: 'prestamo_p2p', rendimiento: { pagos_generados: [
        { id: 5, fecha_pago: '2026-08-12', importe_bruto: 750, retencion_fiscal: 142.5, importe_neto: 607.5, estado: 'pendiente' },
      ] } },
    ],
    ingresos: [
      { id: 1, tipo: 'nomina', nombre: 'Orange', cuentaCobro: { iban: 'ES61', diaAbono: 25, conceptoBancario: 'NOMINA ORANGE ESPAÑA SAU' } },
    ],
    ejerciciosFiscalesCoord: [
      { año: 2025, aeat: { declaracionCompleta: { inmuebles: [
        { refCatastral: 'REF-TENDERINA', gastos: { ibiTasas: 300, comunidad: 600, interesesFinanciacion: 1200 } },
        { refCatastral: 'REF-URIA', gastos: { comunidad: 400 } },
      ] } } },
    ],
    properties: [
      { id: 4, alias: 'Tenderina', cadastralReference: 'REF-TENDERINA' },
      { id: 5, alias: 'Uría', cadastralReference: 'REF-URIA' },
    ],
  };
}

/** La ruta de HOY · los movimientos están insertados. */
function conMovimientos(): void {
  stores = { ...libros(), movements: [...LOTE] };
  lecturasDeMovements = 0;
  (initDB as jest.Mock).mockResolvedValue(db());
}

/** La ruta NUEVA · no hay NINGÚN movimiento en la base. Solo las líneas, en memoria. */
function sinMovimientos(): void {
  stores = { ...libros(), movements: [] };
  lecturasDeMovements = 0;
  (initDB as jest.Mock).mockResolvedValue(db());
}

/** `lineaId → movementId` · la traducción de vuelta, para comparar. */
const porLinea = movementIdsPorLinea(LINEAS);
const movimientoDe = (lineaId: number): number => {
  const ids = porLinea.get(lineaId);
  if (!ids || ids.length !== 1) throw new Error(`línea ${lineaId} sin traducción única`);
  return ids[0];
};

// ═══════════════════════════════════════════════════════════════════════════

describe('movementDesdeLinea · el mismo movimiento que insertMovements, en memoria', () => {
  it('campo a campo · con el Bizum leído del texto y sin tocar la base', () => {
    const linea = lineaDe(LOTE[2], { fechaValor: '2026-08-06', referencia: 'REF-3', saldo: 1200.5, divisa: 'EUR' });
    expect(movementDesdeLinea(linea)).toEqual({
      id: 503,
      accountId: CUENTA,
      date: '2026-08-05',
      valueDate: '2026-08-06',
      amount: 380,
      description: 'BIZUM DE LAURA SANCHEZ',
      counterparty: 'LAURA SANCHEZ',
      paymentMethod: 'Bizum',
      reference: 'REF-3',
      balance: 1200.5,
      currency: 'EUR',
      unifiedStatus: 'no_planificado',
      source: 'import',
      type: 'Ingreso',
      origin: 'CSV',
      movementState: 'Confirmado',
      state: 'pending',
      status: 'pendiente',
      category: { tipo: 'Ingresos' },
      tags: [],
      isAutoTagged: false,
      ambito: 'PERSONAL',
      statusConciliacion: 'sin_match',
      importBatch: 'lote-agosto',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('la contraparte de la columna del fichero manda sobre la del texto', () => {
    const linea = lineaDe(LOTE[2], { contraparte: 'L. SANCHEZ RUIZ' });
    expect(movementDesdeLinea(linea).counterparty).toBe('L. SANCHEZ RUIZ');
  });

  it('un gasto sale como Gasto · sin Bizum no hay método ni contraparte inventada', () => {
    const m = movementDesdeLinea(lineaDe(LOTE[3]));
    expect(m).toMatchObject({ type: 'Gasto', category: { tipo: 'Gastos' }, amount: -108.44 });
    expect(m.counterparty).toBeUndefined();
    expect(m).not.toHaveProperty('paymentMethod');
  });

  it('entra al matcheo lo mismo que hoy tiene movimiento · ni descartadas ni sin id', () => {
    expect(entraAlMatcheo(lineaDe(LOTE[0]))).toBe(true);
    expect(entraAlMatcheo(lineaDe(LOTE[0], { descarte: 'duplicada', movementIds: [], estado: 'sin_procesar' }))).toBe(false);
    expect(entraAlMatcheo(lineaDe(LOTE[0], { descarte: 'sin_fecha', fechaOperacion: '', movementIds: [] }))).toBe(false);
    expect(entraAlMatcheo(lineaDe(LOTE[0], { id: undefined }))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('EQUIVALENCIA · el lote de agosto por movimiento y por línea', () => {
  it('matchBatch ≡ matchLineas · y por línea no se lee `movements`', async () => {
    conMovimientos();
    const porMovimiento = await matchBatch(LOTE.map((m) => m.id as number));
    expect(porMovimiento.matches).toHaveLength(5); // el lote de E1.4a: 5 cuadres, 14 sin match

    sinMovimientos();
    const r = await matchLineas(LINEAS);
    expect(lecturasDeMovements).toBe(0);

    expect({
      matches: r.matches.map(({ lineaId, ...c }) => ({ movementId: movimientoDe(lineaId), ...c })),
      multiMatches: r.multiMatches.map((mm) => ({
        movementId: movimientoDe(mm.lineaId),
        candidates: mm.candidates.map(({ lineaId, ...c }) => ({ movementId: movimientoDe(lineaId), ...c })),
      })),
      sinMatch: r.sinMatch.map(movimientoDe),
    }).toEqual(porMovimiento);
  });

  it('el multiMatch y el alias aprendido también salen iguales · cada caso por separado, como en E1.4a', async () => {
    const sinNombre = mov({ id: 30, date: '2026-08-05', amount: 380, description: 'TRANSFERENCIA RECIBIDA' });
    const conAlias = mov({ id: 31, date: '2026-08-05', amount: 380, description: 'BIZUM DE MPARWEZ', counterparty: 'MPARWEZ', paymentMethod: 'Bizum' });

    for (const extra of [sinNombre, conAlias]) {
      conMovimientos();
      stores.movements.push(extra);
      const porMovimiento = await matchBatch([extra.id as number]);

      sinMovimientos();
      const r = await matchLineas([lineaDe(extra)]);
      expect(lecturasDeMovements).toBe(0);
      expect({
        matches: r.matches.map(({ lineaId, ...c }) => ({ movementId: lineaId - 500, ...c })),
        multiMatches: r.multiMatches.map((mm) => ({
          movementId: mm.lineaId - 500,
          candidates: mm.candidates.map(({ lineaId, ...c }) => ({ movementId: lineaId - 500, ...c })),
        })),
        sinMatch: r.sinMatch.map((id) => id - 500),
      }).toEqual(porMovimiento);
    }

    // Y son los casos que se querían: un multiMatch 75/75 y un cuadre por alias.
    sinMovimientos();
    const multi = await matchLineas([lineaDe(sinNombre)]);
    expect(multi.multiMatches.map((mm) => [mm.lineaId, mm.candidates.map((c) => c.score)])).toEqual([[530, [75, 75]]]);
    const alias = await matchLineas([lineaDe(conAlias)]);
    expect(alias.matches.map((m) => [m.lineaId, m.treasuryEventId, m.score, m.reasons])).toEqual([
      [531, 102, 100, ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'alias_aprendido']],
    ]);
  });

  it('suggestForUnmatched ≡ suggestForLineas · las tres vías, el signo y el orden', async () => {
    const sinMatch = [5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    conMovimientos();
    const porMovimiento = await suggestForUnmatched(sinMatch);

    sinMovimientos();
    const r = await suggestForLineas(LINEAS.filter((l) => sinMatch.includes((l.id as number) - 500)));
    expect(lecturasDeMovements).toBe(0);

    const traducido = Array.from(r.entries()).map(([lineaId, sugerencias]) => [
      movimientoDe(lineaId),
      sugerencias.map(({ lineaId: l, ...s }) => ({ movementId: movimientoDe(l), ...s })),
    ]);
    expect(traducido).toEqual(Array.from(porMovimiento.entries()));
    // Y las vías que dependen de la base (regla aprendida, compromiso) están.
    expect(r.get(516)![0]).toMatchObject({ via: 'learning_rule', confidence: 74 });
    expect(r.get(517)![0]).toMatchObject({ via: 'compromiso_recurrente', confidence: 90 });
  });

  it('reconocerDeterministas ≡ reconocerDeterministasDeLineas · orígenes y atribuciones', async () => {
    conMovimientos();
    const porMovimiento = await reconocerDeterministas(LOTE);
    // E2.4 · cuatro cuadros + el recurrente de Naturgy contra su definición.
    expect(porMovimiento.origenes.size).toBe(5);

    sinMovimientos();
    const r = await reconocerDeterministasDeLineas(LINEAS);
    expect(lecturasDeMovements).toBe(0);

    expect(
      Array.from(r.origenes.entries()).map(([lineaId, o]) => [movimientoDe(lineaId), origenParaMovimiento(o, movimientoDe(lineaId))])
    ).toEqual(Array.from(porMovimiento.origenes.entries()));
    expect(
      Array.from(r.atribuciones.entries()).map(([lineaId, { lineaId: l, ...a }]) => [movimientoDe(lineaId), { movementId: movimientoDe(l), ...a }])
    ).toEqual(Array.from(porMovimiento.atribuciones.entries()));
  });

  it('las líneas descartadas no entran · igual que hoy no tienen movimiento', async () => {
    sinMovimientos();
    const conDescartes = [
      ...LINEAS,
      lineaDe(mov({ id: 40, date: '2026-08-01', amount: -454.66, description: 'RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026' }), { descarte: 'duplicada', movementIds: [], estado: 'sin_procesar' }),
      lineaDe(mov({ id: 41, date: '', amount: -10, description: 'SIN FECHA' }), { descarte: 'sin_fecha', movementIds: [], estado: 'sin_procesar' }),
    ];
    const r = await matchLineas(conDescartes);
    expect([...r.matches.map((m) => m.lineaId), ...r.sinMatch]).not.toContain(540);
    expect([...r.matches.map((m) => m.lineaId), ...r.sinMatch]).not.toContain(541);
    expect(r.matches.length + r.sinMatch.length).toBe(19);
    expect((await suggestForLineas(conDescartes)).has(540)).toBe(false);
    expect((await reconocerDeterministasDeLineas(conDescartes)).origenes.has(540)).toBe(false);
    // Sin líneas que entren, no se lee la base.
    (initDB as jest.Mock).mockClear();
    expect(await matchLineas([conDescartes[19]])).toEqual({ matches: [], multiMatches: [], sinMatch: [] });
    expect((await suggestForLineas([conDescartes[19]])).size).toBe(0);
    expect(initDB).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('EQUIVALENCIA · conciliación con confirmados · el lote de septiembre', () => {
  const LOTE_SEPT: Movement[] = [
    mov({ id: 31, importBatch: 'lote-sept', date: '2026-09-03', valueDate: '2026-09-04', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
    mov({ id: 32, importBatch: 'lote-sept', date: '2026-09-03', valueDate: '2026-09-04', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
    mov({ id: 33, importBatch: 'lote-sept', date: '2026-09-05', amount: 380, description: 'BIZUM DE LAURA SANCHEZ', counterparty: 'LAURA SANCHEZ', paymentMethod: 'Bizum' }),
    mov({ id: 34, importBatch: 'lote-sept', date: '2026-09-06', amount: -12.99, description: 'NETFLIX.COM' }),
  ];
  const CONFIRMADOS: Movement[] = [
    mov({ id: 20, source: 'manual', importBatch: undefined, date: '2026-09-01', amount: -87.4, description: 'Agua Tenderina', reference: 'treasury_event:7', categoryKey: 'suministro_inmueble' }),
    mov({ id: 21, source: 'manual', importBatch: undefined, date: '2026-09-05', amount: 380, description: 'Renta Laura', categoryKey: 'alquiler' }),
    mov({ id: 22, importBatch: 'lote-viejo', date: '2026-09-02', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
    mov({ id: 23, source: 'manual', importBatch: undefined, date: '2026-09-03', amount: -87.4, description: 'Agua con tarjeta', gastoTarjetaCredito: true } as never),
    mov({ id: 24, source: 'manual', importBatch: undefined, accountId: 3, date: '2026-09-06', amount: -12.99, description: 'Netflix' }),
  ];
  const LINEAS_SEPT = LOTE_SEPT.map((m) => lineaDe(m));
  const traducir = (r: Map<number, unknown>) =>
    Array.from(r.entries()).map(([lineaId, ref]) => [lineaId - 500, ref]);

  it('confirmadosPorLinea ≡ confirmadosPorLineaExtracto · sin los movimientos del lote en la base', () => {
    const porMovimiento = confirmadosPorLinea(LOTE_SEPT, [...LOTE_SEPT, ...CONFIRMADOS], CUENTA);
    expect(porMovimiento.size).toBe(2);
    // La ruta por línea solo necesita los confirmados · el lote no existe como movimientos.
    const r = confirmadosPorLineaExtracto(LINEAS_SEPT, CONFIRMADOS, CUENTA);
    expect(traducir(r)).toEqual(Array.from(porMovimiento.entries()));
  });

  it('y si los movimientos del lote SÍ están (E1.1, hoy), se excluyen por `movementIds`, no por el id de línea', () => {
    // Un confirmado cuyo id COINCIDE con un lineaId (531) · no puede excluirse por error.
    const confirmadoConIdDeLinea = mov({ id: 531, source: 'manual', importBatch: undefined, date: '2026-09-06', amount: -12.99, description: 'Netflix a mano' });
    const todos = [...LOTE_SEPT, ...CONFIRMADOS, confirmadoConIdDeLinea];
    const porMovimiento = confirmadosPorLinea(LOTE_SEPT, todos, CUENTA);
    expect(porMovimiento.get(34)).toMatchObject({ id: 531 });

    const r = confirmadosPorLineaExtracto(LINEAS_SEPT, todos, CUENTA);
    expect(traducir(r)).toEqual(Array.from(porMovimiento.entries()));
    // Y ninguna línea casa consigo misma (31..34 excluidos por `movementIds`).
    for (const ref of r.values()) expect([31, 32, 33, 34]).not.toContain((ref as { id: number }).id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('pago múltiple (§16.4) · una línea, varios movimientos · la traducción es plural', () => {
  it('movementIdsPorLinea devuelve todos los movimientos de la línea · y el origen se dice por cada uno', async () => {
    const fianzaYDosMeses = lineaDe(mov({ id: 50, date: '2026-08-01', amount: 1140, description: 'TRANSFERENCIA ALQUILER FIANZA Y DOS MESES' }), {
      movementIds: [51, 52, 53],
    });
    expect(movementIdsPorLinea([fianzaYDosMeses, LINEAS[0]])).toEqual(new Map([[550, [51, 52, 53]], [501, [1]]]));

    // La línea se empareja UNA vez (por línea) · quien traduzca reparte entre sus movimientos.
    sinMovimientos();
    const r = await matchLineas([fianzaYDosMeses]);
    expect(r.sinMatch).toEqual([550]);

    const origen = { lineaId: 550, fuente: 'prestamo' as const, origenId: 'p1', titulo: 'x', como: 'fecha_importe' as const };
    expect([51, 52, 53].map((id) => origenParaMovimiento(origen, id))).toEqual([
      { movementId: 51, fuente: 'prestamo', origenId: 'p1', titulo: 'x', como: 'fecha_importe' },
      { movementId: 52, fuente: 'prestamo', origenId: 'p1', titulo: 'x', como: 'fecha_importe' },
      { movementId: 53, fuente: 'prestamo', origenId: 'p1', titulo: 'x', como: 'fecha_importe' },
    ]);
  });
});
