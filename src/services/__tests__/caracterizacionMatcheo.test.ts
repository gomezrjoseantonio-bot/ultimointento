// ============================================================================
// E1.4a · Tests de CARACTERIZACIÓN del matcheo actual
// ============================================================================
//
// Esto no dice lo que el matcheo DEBERÍA hacer: dice lo que hace HOY, con
// entradas conocidas y la salida EXACTA. Es la red de seguridad de E1.4b, que
// va a dar a estas rutas una entrada por LÍNEA (`lineasExtracto`) en vez de
// por `Movement` insertado, y tendrá que demostrar que con el mismo lote sale
// el mismo resultado.
//
// Rutas que quedan fijadas aquí (el contrato de E1.4b):
//
//   · `matchBatch`             · qué casa, qué es multiMatch, qué queda sin
//                                match, con `score` y `reasons` exactos.
//   · `suggestForUnmatched`    · qué propone para lo no casado, con `via`,
//                                `confidence`, `action` y `metadata` exactos.
//   · `reconocerDeterministas` · cuota de préstamo, nómina, rendimiento, venta
//                                y atribución por inmueble; el orden entre
//                                fuentes y que un origen tapa la atribución.
//   · conciliación con confirmados · `confirmadosPorLinea` (qué línea casa con
//                                qué confirmado, 1:1) y `confirmDecisions` con
//                                `reconciliacionesConfirmado` (qué se conserva
//                                y qué queda enlazado · D1).
//
// Cuando algo de lo que sale parece un fallo, el test lo fija IGUAL y lo deja
// anotado con «HOY:» en el nombre o en un comentario. Arreglarlo no es de esta
// tarea: primero se congela lo que hay, después se decide.
//
// E1.5 · D1 · los seis tests de «confirmDecisions con reconciliacionesConfirmado»
// CAMBIARON con el corte y capturan el comportamiento NUEVO: antes el import
// creaba un movimiento duplicado y al guardar se BORRABA el confirmado
// (sobrevivía la línea del import heredando su clasificación); ahora no nace
// ningún duplicado, el Confirmado se CONSERVA con el aval del banco (importe y
// fechas reales, conciliado) y la línea queda enlazada a él. Los tests del
// matcheo en sí (`confirmadosPorLinea`, `emparejarConfirmados`) no cambian.
//
// Los 13 de `conciliacionCaminosCompletos.test.ts` cubren el GUARDAR (B1
// confirmDecisions con un match aprobado a mano · B2 el colapso contra un
// confirmado). Aquí se cubre lo que pasa ANTES de guardar —el análisis— y la
// conciliación con confirmados de punta a punta con más de una línea.
// ============================================================================

import { matchBatch } from '../movementMatchingService';
import { suggestForUnmatched } from '../movementSuggestionService';
import { reconocerDeterministas, nadaReconocido } from '../deterministas/matcheoDeterminista';
import { confirmadosPorLinea, emparejarConfirmados } from '../conciliacionConfirmados';
import { confirmDecisions } from '../bankStatementOrchestrator';
import { buildLearnKey } from '../movementLearningService';
import { initDB, type Movement, type TreasuryEvent } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));
// Solo se finge lo que ESCRIBE (`createOrUpdateRule`, al guardar). El resto del
// módulo va de verdad: `buildLearnKey`, `nombreDeContraparte` y
// `cargarAliasContraparte` son parte de lo que se caracteriza.
jest.mock('../movementLearningService', () => ({
  ...jest.requireActual('../movementLearningService'),
  createOrUpdateRule: jest.fn(async () => ({})),
}));

// ─── La base fingida · un handle, todos los stores que tocan las rutas ──────

type Fila = Record<string, unknown> & { id?: number | string };
type Stores = Record<string, Fila[]>;

let stores: Stores;

function db() {
  const lista = (s: string): Fila[] => (stores[s] ??= []);
  return {
    get: async (s: string, key: number | string) => lista(s).find((r) => r.id === key),
    getAll: async (s: string) => lista(s),
    getAllFromIndex: async (s: string, index: string, clave: unknown) => {
      if (index === 'origen-origenId') {
        const [origen, origenId] = clave as [string, string];
        return lista(s).filter((r) => r.origen === origen && r.origenId === origenId);
      }
      return lista(s).filter((r) => r[index] === clave);
    },
    add: async (s: string, row: Fila) => {
      const id = (lista(s).length + 1) * 100;
      lista(s).push({ ...row, id });
      return id;
    },
    put: async (s: string, row: Fila) => {
      const l = lista(s);
      const i = l.findIndex((r) => r.id === row.id);
      if (i >= 0) l[i] = row;
      else l.push(row);
      return row.id;
    },
    delete: async (s: string, key: number | string) => {
      const l = lista(s);
      const i = l.findIndex((r) => r.id === key);
      if (i >= 0) l.splice(i, 1);
    },
  };
}

const CUENTA = 9;

/** Una línea del banco tal como la inserta `insertMovements` (E1.1). */
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

// ─── EL LOTE DE AGOSTO · 19 líneas conocidas ────────────────────────────────
//
// Cada línea está para ejercitar una ruta concreta. Se enumeran con lo que se
// espera de cada una, y el test del lote entero comprueba la salida completa.

const NETFLIX = mov({ id: 16, date: '2026-08-28', amount: -12.99, description: 'NETFLIX.COM' });
const DEVOLUCION = mov({ id: 18, date: '2026-08-29', amount: 50, description: 'DEVOLUCION AMAZON EU' });

const LOTE: Movement[] = [
  // 1 · cuota de préstamo · previsto 101 (prestamo) y cuadro del préstamo p1.
  mov({ id: 1, date: '2026-08-01', amount: -454.66, description: 'RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026' }),
  // 2 · renta por transferencia · previsto 102 (Adnan) · un día tarde, con «ALQUILER».
  mov({ id: 2, date: '2026-08-06', amount: 380, description: 'TRANSFERENCIA ALQUILER AGOSTO HAB 2' }),
  // 3 · renta por Bizum · previsto 103 (Laura) · el nombre del banco no es el del contrato.
  mov({ id: 3, date: '2026-08-05', amount: 380, description: 'BIZUM DE LAURA SANCHEZ', counterparty: 'LAURA SANCHEZ', paymentMethod: 'Bizum' }),
  // 4 · luz VARIABLE · previsto 104 de 45 € · llega por 108,44.
  mov({ id: 4, date: '2026-08-12', amount: -108.44, description: 'RECIBO IBERDROLA CLIENTES SAU' }),
  // 5 · agua · previsto 105 de 82 € el 27-8 · llega 87,40 el 3-9 (7 días).
  mov({ id: 5, date: '2026-09-03', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
  // 6 · PAGO MÚLTIPLE · una línea de 150 contra dos previstos de 100 y 50 (106, 107).
  mov({ id: 6, date: '2026-08-20', amount: -150, description: 'ADEUDO COMUNIDAD PROPIETARIOS TENDERINA 12' }),
  // 7 y 8 · DUPLICADO INTRA-LOTE · dos cargos idénticos, un solo previsto (108).
  mov({ id: 7, date: '2026-08-10', amount: -72.5, description: 'RECIBO CDAD PROP CALLE URIA 5' }),
  mov({ id: 8, date: '2026-08-10', amount: -72.5, description: 'RECIBO CDAD PROP CALLE URIA 5' }),
  // 9 · nómina · sin previsto · la reconoce el determinista por concepto.
  mov({ id: 9, date: '2026-08-25', amount: 3940.12, description: 'NOMINA ORANGE ESPANA SAU 08/2026' }),
  // 10 · rendimiento P2P · sin previsto · la reconoce el determinista por fecha+neto.
  mov({ id: 10, date: '2026-08-12', amount: 607.5, description: 'ABONO INTERESES SMARTFLIP' }),
  // 11 · compra online · heurística Amazon.
  mov({ id: 11, date: '2026-08-18', amount: -23.9, description: 'AMAZON EU SARL COMPRA' }),
  // 12 · SIN MATCH de ningún tipo · y su previsto (109) está DESCARTADO.
  mov({ id: 12, date: '2026-08-14', amount: -30, description: 'PAGO EN REVOLUT' }),
  // 13 · IBI · heurística IBI · y el determinista lo ATRIBUYE al piso que lo declaró.
  mov({ id: 13, date: '2026-08-03', amount: -321.5, description: 'RECIBO IBI AYTO OVIEDO' }),
  // 14 · Bizum que SALE.
  mov({ id: 14, date: '2026-08-09', amount: -70.48, description: 'COMPRA BIZUM IRYO', paymentMethod: 'Bizum' }),
  // 15 · transferencia recibida sin dueño.
  mov({ id: 15, date: '2026-08-22', amount: 200, description: 'TRANSFERENCIA RECIBIDA' }),
  // 16 · con REGLA APRENDIDA (5 aplicaciones) · vía B cortocircuita.
  NETFLIX,
  // 17 · con COMPROMISO recurrente activo (Naturgy, 56 € fijo) · vía A cortocircuita.
  mov({ id: 17, date: '2026-08-15', amount: -56, description: 'RECIBO NATURGY IBERIA SA' }),
  // 18 · abono con una regla PERSONAL aprendida · el signo la tira.
  DEVOLUCION,
  // 19 · cobro de una venta confirmada · determinista por fecha+importe.
  mov({ id: 19, date: '2026-08-20', amount: 150000, description: 'TRANSFERENCIA VENTA NOTARIA' }),
];

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

function sembrarLoteDeAgosto(): void {
  stores = {
    movements: [...LOTE],
    treasuryEvents: [...PREVISTOS],
    movementLearningRules: [
      { id: 1, learnKey: buildLearnKey(NETFLIX), categoria: 'ocio', ambito: 'PERSONAL', appliedCount: 5, updatedAt: '2026-07-01T00:00:00.000Z' },
      { id: 2, learnKey: buildLearnKey(DEVOLUCION), categoria: 'tecnologia', ambito: 'PERSONAL', appliedCount: 3, updatedAt: '2026-07-01T00:00:00.000Z' },
    ],
    compromisosRecurrentes: [
      { id: 3, alias: 'Gas Tenderina', ambito: 'inmueble', inmuebleId: 4, cuentaCargo: CUENTA, estado: 'activo', importe: { modo: 'fijo', importe: 56 }, proveedor: { nombre: 'Naturgy' }, categoria: 'suministros' },
    ],
    contracts: [
      { id: 21, inmuebleId: 4, estadoContrato: 'activo', inquilino: { nombre: 'Laura', apellidos: 'Sánchez Ruiz' } },
      { id: 22, inmuebleId: 4, estadoContrato: 'activo', inquilino: { nombre: 'Adnan', apellidos: 'Parwez Khan' } },
      { id: 23, inmuebleId: 4, estadoContrato: 'finalizado', inquilino: { nombre: 'Pedro', apellidos: 'Gómez' } },
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
    gastosInmueble: [],
    importBatches: [],
  };
}

beforeEach(() => {
  (initDB as jest.Mock).mockResolvedValue(db());
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 · matchBatch · qué casa, qué es multiMatch, qué queda sin match
// ═══════════════════════════════════════════════════════════════════════════

describe('matchBatch · el lote de agosto', () => {
  beforeEach(sembrarLoteDeAgosto);

  it('la salida COMPLETA · cinco cuadres, ningún multiMatch, catorce sin match', async () => {
    const r = await matchBatch(LOTE.map((m) => m.id as number));

    expect(r).toEqual({
      matches: [
        // 1 · cuota de préstamo · fecha, importe y proveedor en el texto.
        { movementId: 1, treasuryEventId: 101, score: 125, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'importe_exacto_misma_cuenta', 'descripcion_proveedor'] },
        // 2 · renta por transferencia · un día tarde · el empujón del ALQUILER (+25).
        { movementId: 2, treasuryEventId: 102, score: 90, reasons: ['fecha_dia_adyacente', 'importe_exacto', 'cuenta_match', 'importe_exacto_alquiler_misma_cuenta'] },
        // 3 · renta por Bizum · «LAURA SANCHEZ» vs «Laura Sánchez Ruiz» · coincidencia fuerte (+25).
        { movementId: 3, treasuryEventId: 103, score: 100, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'bizum_contraparte'] },
        // 4 · HOY: la luz por 108,44 CUADRA con un previsto de 45 · sin punto por
        //     importe, pero fecha + cuenta + recibo recurrente + proveedor llegan a 80.
        { movementId: 4, treasuryEventId: 104, score: 80, reasons: ['fecha_exacta', 'cuenta_match', 'recibo_recurrente_misma_cuenta', 'descripcion_proveedor'] },
        // 7 · de los dos cargos idénticos, el previsto se lo lleva el de id MENOR.
        { movementId: 7, treasuryEventId: 108, score: 135, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'importe_exacto_misma_cuenta', 'recibo_recurrente_misma_cuenta', 'descripcion_proveedor'] },
      ],
      multiMatches: [],
      // En el orden en que se pidieron los ids.
      sinMatch: [5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    });
  });

  it('las dos rentas de 380 el mismo día se reparten · cada previsto a UNA línea, la que más puntúa', async () => {
    // Sin la transferencia con «ALQUILER» (2), el previsto de Adnan (102) queda
    // libre · el Bizum de Laura (3) también lo alcanza (75 ≥ 70) pero el suyo
    // (103) puntúa más (100) y el ganador claro se lo queda SOLO, sin multiMatch.
    const r = await matchBatch([3]);
    expect(r.matches).toEqual([
      { movementId: 3, treasuryEventId: 103, score: 100, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'bizum_contraparte'] },
    ]);
    expect(r.multiMatches).toEqual([]);
  });

  it('una renta SIN nombre ni «alquiler» contra dos previstos iguales · multiMatch con los dos candidatos', async () => {
    stores.movements.push(mov({ id: 30, date: '2026-08-05', amount: 380, description: 'TRANSFERENCIA RECIBIDA' }));
    const r = await matchBatch([30]);
    expect(r.matches).toEqual([]);
    expect(r.multiMatches).toEqual([
      {
        movementId: 30,
        candidates: [
          { movementId: 30, treasuryEventId: 102, score: 75, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match'] },
          { movementId: 30, treasuryEventId: 103, score: 75, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match'] },
        ],
      },
    ]);
  });

  it('el agua a 7 días (87,40 vs 82 previsto) queda SIN match · fuera de la ventana de ±5', async () => {
    const r = await matchBatch([5]);
    expect(r).toEqual({ matches: [], multiMatches: [], sinMatch: [5] });
  });

  it('el agua el MISMO día que lo previsto tampoco casa · 6,6 % de diferencia sin proveedor se queda en 55', async () => {
    stores.treasuryEvents.find((e) => e.id === 105)!.predictedDate = '2026-09-03';
    const r = await matchBatch([5]);
    expect(r).toEqual({ matches: [], multiMatches: [], sinMatch: [5] });
  });

  it('PAGO MÚLTIPLE · HOY una línea de 150 no casa con dos previstos de 100 y 50 · no hay suma ni reparto', async () => {
    const r = await matchBatch([6]);
    expect(r).toEqual({ matches: [], multiMatches: [], sinMatch: [6] });
  });

  it('DUPLICADO INTRA-LOTE · dos cargos idénticos y un previsto · gana el id menor, el otro queda sin match', async () => {
    const r = await matchBatch([8, 7]); // el orden de entrada no cambia quién gana
    expect(r.matches.map((m) => m.movementId)).toEqual([7]);
    expect(r.sinMatch).toEqual([8]);
  });

  it('un previsto DESCARTADO no es candidato · aunque puntuara 125', async () => {
    const r = await matchBatch([12]);
    expect(r).toEqual({ matches: [], multiMatches: [], sinMatch: [12] });
    stores.treasuryEvents.find((e) => e.id === 109)!.descartado = undefined;
    const sinDescarte = await matchBatch([12]);
    expect(sinDescarte.matches).toEqual([
      { movementId: 12, treasuryEventId: 109, score: 125, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'importe_exacto_misma_cuenta', 'descripcion_proveedor'] },
    ]);
  });

  it('HOY: un id que no existe en `movements` desaparece · ni casa ni sale en sinMatch', async () => {
    // E1.4b · una línea sin movimiento no puede entrar por aquí tal cual.
    expect(await matchBatch([999])).toEqual({ matches: [], multiMatches: [], sinMatch: [] });
    expect(await matchBatch([5, 999])).toEqual({ matches: [], multiMatches: [], sinMatch: [5] });
    expect(await matchBatch([])).toEqual({ matches: [], multiMatches: [], sinMatch: [] });
  });

  it('un alias APRENDIDO casa lo que el nombre no deja adivinar', async () => {
    stores.movements.push(mov({ id: 31, date: '2026-08-05', amount: 380, description: 'BIZUM DE MPARWEZ', counterparty: 'MPARWEZ', paymentMethod: 'Bizum' }));
    const sinAlias = await matchBatch([31]);
    // Sin alias: 75 contra los dos previstos de 380 · multiMatch.
    expect(sinAlias.multiMatches.map((m) => m.candidates.map((c) => c.score))).toEqual([[75, 75]]);

    stores.movementLearningRules.push({ id: 9, learnKey: 'x', categoria: 'alquiler', ambito: 'INMUEBLE', aliasContraparte: 'MPARWEZ', contraparteCanonica: 'Adnan Parwez Khan' });
    const conAlias = await matchBatch([31]);
    expect(conAlias.matches).toEqual([
      { movementId: 31, treasuryEventId: 102, score: 100, reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match', 'alias_aprendido'] },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · suggestForUnmatched · qué propone para lo no casado
// ═══════════════════════════════════════════════════════════════════════════

describe('suggestForUnmatched · lo que quedó sin match en el lote de agosto', () => {
  beforeEach(sembrarLoteDeAgosto);

  const noSeQueEs = (movementId: number) => ({
    movementId,
    via: 'heuristica',
    confidence: 30,
    description: 'Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente',
    action: { kind: 'ignore' },
  });

  it('la salida COMPLETA · una sugerencia por línea, en el orden pedido', async () => {
    const r = await suggestForUnmatched([5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

    expect(Array.from(r.entries())).toEqual([
      // 5 · HOY: el agua no está en la heurística de suministros (AQUALIA no es luz ni telco).
      [5, [noSeQueEs(5)]],
      // 6 · comunidad.
      [6, [{ movementId: 6, via: 'heuristica', confidence: 60, description: 'Posible cuota de comunidad de propietarios', action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', categoryKey: 'inmueble.comunidad', sourceType: 'gasto' } }]],
      // 8 · HOY: «CDAD PROP» no lo lee la heurística de comunidad (pide COMUNIDAD o FINCAS).
      [8, [noSeQueEs(8)]],
      // 9 · HOY: la nómina no tiene heurística · la reconoce el determinista, no esto.
      [9, [noSeQueEs(9)]],
      [10, [noSeQueEs(10)]],
      // 11 · Amazon.
      [11, [{ movementId: 11, via: 'heuristica', confidence: 50, description: 'Compra online (Amazon / AliExpress) · proponer marcar como gasto personal', action: { kind: 'mark_personal_expense', categoryKey: 'tecnologia' } }]],
      [12, [noSeQueEs(12)]],
      // 13 · IBI.
      [13, [{ movementId: 13, via: 'heuristica', confidence: 60, description: 'Posible impuesto del inmueble (IBI, tasa de basura, etc.)', action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', categoryKey: 'inmueble.ibi', sourceType: 'gasto' } }]],
      // 14 · Bizum que sale.
      [14, [{ movementId: 14, via: 'heuristica', confidence: 30, description: 'Bizum que sale de tu cuenta · lo pagas tú, así que no es el cobro de ninguna renta', action: { kind: 'ignore' } }]],
      // 15 · transferencia recibida sin dueño · pregunta abierta, no una renta inventada.
      [15, [{ movementId: 15, via: 'heuristica', confidence: 30, description: 'Un ingreso que no reconozco · si me dices de quién es una vez, el resto de sus cobros los coloco solos', action: { kind: 'ignore' } }]],
      // 16 · regla aprendida con 5 aplicaciones · 70 + round(log10(6)·5) = 74 · cortocircuita.
      [16, [{ movementId: 16, via: 'learning_rule', confidence: 74, description: 'Regla aprendida (5 aplicaciones previas) → ocio', action: { kind: 'mark_personal_expense', categoryKey: 'ocio' }, metadata: { learnKey: buildLearnKey(NETFLIX), ruleId: 1, appliedCount: 5, resuelveSola: true } }]],
      // 17 · compromiso activo · 70 + 10 (céntimo exacto) + 10 (proveedor en el texto) · cortocircuita.
      [17, [{ movementId: 17, via: 'compromiso_recurrente', confidence: 90, description: 'Coincide con compromiso "Gas Tenderina" (Naturgy)', action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', inmuebleId: 4, categoryKey: 'suministros', sourceType: 'gasto_recurrente', sourceId: 3 }, metadata: { compromisoId: 3, razones: ['texto', 'importe_exacto'] } }]],
      // 18 · la regla PERSONAL (gasto) sobre un ABONO la tira el signo · y Amazon en positivo tampoco es compra.
      [18, [noSeQueEs(18)]],
      // 19 · HOY: «TRANSFERENCIA VENTA» no es «TRANSFERENCIA RECIBIDA» · sin heurística.
      [19, [noSeQueEs(19)]],
    ]);
  });

  it('un Bizum recibido con contrato vivo a su nombre · propone asignarlo a ESE contrato', async () => {
    stores.movements.push(mov({ id: 32, date: '2026-08-05', amount: 380, description: 'BIZUM DE LAURA SANCHEZ', counterparty: 'LAURA SANCHEZ', paymentMethod: 'Bizum' }));
    const r = await suggestForUnmatched([32]);
    expect(r.get(32)).toEqual([
      { movementId: 32, via: 'heuristica', confidence: 60, description: 'Bizum o transferencia recibida · proponer asignarlo a la renta de Laura Sánchez Ruiz', action: { kind: 'assign_to_contract', contractId: 21 } },
    ]);
  });

  it('un Bizum recibido que solo trae el nombre de pila · no se elige contrato · pregunta abierta', async () => {
    stores.contracts.push({ id: 24, inmuebleId: 5, estadoContrato: 'activo', inquilino: { nombre: 'Laura', apellidos: 'Pérez Vega' } });
    stores.movements.push(mov({ id: 33, date: '2026-08-05', amount: 380, description: 'BIZUM DE LAURA', counterparty: 'LAURA', paymentMethod: 'Bizum' }));
    const r = await suggestForUnmatched([33]);
    expect(r.get(33)![0].action).toEqual({ kind: 'ignore' });
    expect(r.get(33)![0].confidence).toBe(30);
  });

  it('regla aprendida SIN aplicaciones · vía B a 50 no cortocircuita y la heurística va detrás', async () => {
    stores.movementLearningRules[0].appliedCount = 0;
    const r = await suggestForUnmatched([16]);
    expect(r.get(16)!.map((s) => [s.via, s.confidence])).toEqual([
      ['learning_rule', 50],
      ['heuristica', 30],
    ]);
    expect(r.get(16)![0].description).toBe('Regla aprendida sin aplicaciones previas → ocio');
  });

  it('cuota de préstamo por heurística · «CUOTA PRESTAMO» → hipoteca 65', async () => {
    stores.movements.push(mov({ id: 34, date: '2026-08-01', amount: -454.66, description: 'CUOTA PRESTAMO 0123 UNICAJA' }));
    const r = await suggestForUnmatched([34]);
    expect(r.get(34)).toEqual([
      { movementId: 34, via: 'heuristica', confidence: 65, description: 'Posible cuota de préstamo / hipoteca · proponer asignar a préstamo activo de la cuenta', action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', categoryKey: 'vivienda.hipoteca', sourceType: 'prestamo' } },
    ]);
    // HOY: «RECIBO PRESTAMO» (como lo escribe Unicaja en la línea 1) NO lo lee esta heurística.
    const r1 = await suggestForUnmatched([1]);
    expect(r1.get(1)).toEqual([noSeQueEs(1)]);
  });

  it('HOY: un id que no existe no aparece en el mapa · y la lista vacía devuelve un mapa vacío', async () => {
    const r = await suggestForUnmatched([999, 12]);
    expect(Array.from(r.keys())).toEqual([12]);
    expect((await suggestForUnmatched([])).size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · reconocerDeterministas · lo que el usuario ya le dijo a ATLAS
// ═══════════════════════════════════════════════════════════════════════════

describe('reconocerDeterministas · el lote de agosto contra los libros del usuario', () => {
  beforeEach(sembrarLoteDeAgosto);

  it('la salida COMPLETA · cuatro orígenes y una atribución', async () => {
    const r = await reconocerDeterministas(LOTE);

    expect(Array.from(r.origenes.entries())).toEqual([
      [1, { movementId: 1, fuente: 'prestamo', origenId: 'p1', piezaId: '7', titulo: 'Cuota 7/2 · Unicaja Tenderina', como: 'fecha_importe', desglose: { tipo: 'prestamo', periodo: 7, interes: 120.4, amortizacion: 334.26 }, inmuebleId: 4 }],
      [19, { movementId: 19, fuente: 'venta', origenId: '7', piezaId: 'cobro', titulo: 'Cobro de la venta', como: 'fecha_importe', inmuebleId: 5 }],
      [10, { movementId: 10, fuente: 'inversion', origenId: 'i1', piezaId: '5', titulo: 'Rendimiento · SmartFlip', como: 'fecha_importe', desglose: { tipo: 'rendimiento', bruto: 750, retencion: 142.5, neto: 607.5 } }],
      [9, { movementId: 9, fuente: 'nomina', origenId: '1', titulo: 'Nómina · Orange', como: 'concepto_cuenta_dia' }],
    ]);
    // El orden del mapa es el de las fuentes: préstamo → venta → inversión → nómina.

    expect(Array.from(r.atribuciones.entries())).toEqual([
      // 13 · IBI · solo Tenderina lo declaró.
      [13, { movementId: 13, inmuebleId: 4, concepto: 'IBI', ejercicio: 2025 }],
      // 6 · comunidad · la declararon DOS pisos → no se atribuye.
      // 1 · «PRESTAMO» → cubo intereses, pero ya tiene origen → no se atribuye.
      // 4 y 5 · suministros · nadie los declaró.
    ]);
  });

  it('si una fuente no se puede leer, las demás siguen', async () => {
    const handle = db();
    const getAll = handle.getAll;
    handle.getAll = async (s: string) => {
      if (s === 'prestamos') throw new Error('store roto');
      return getAll(s);
    };
    (initDB as jest.Mock).mockResolvedValue(handle);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const r = await reconocerDeterministas(LOTE);
      expect(Array.from(r.origenes.keys())).toEqual([19, 10, 9]);
      // Sin el origen de préstamo, la línea 1 SÍ recibe atribución por «PRESTAMO»
      // · y las atribuciones salen en el orden de las líneas, no de las fuentes.
      expect(Array.from(r.atribuciones.entries())).toEqual([
        [1, { movementId: 1, inmuebleId: 4, concepto: 'Intereses', ejercicio: 2025 }],
        [13, { movementId: 13, inmuebleId: 4, concepto: 'IBI', ejercicio: 2025 }],
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("'prestamos'"), expect.any(Error));
    } finally {
      // Se restaura aunque falle una aserción · el espía no puede contaminar el resto.
      warn.mockRestore();
    }
  });

  it('dos préstamos con la misma cuota el mismo día · no se elige · la línea queda sin origen', async () => {
    stores.prestamos.push({ ...stores.prestamos[0], id: 'p2', nombre: 'Otro banco' });
    const r = await reconocerDeterministas([LOTE[0]]);
    expect(r.origenes.size).toBe(0);
    // …y entonces sí la atribuye la declaración.
    expect(r.atribuciones.get(1)).toEqual({ movementId: 1, inmuebleId: 4, concepto: 'Intereses', ejercicio: 2025 });
  });

  it('sin movimientos no se lee nada', async () => {
    (initDB as jest.Mock).mockClear();
    expect(await reconocerDeterministas([])).toEqual(nadaReconocido());
    expect(initDB).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Conciliación con confirmados · «las dos cosas» (§23 · la pieza X)
// ═══════════════════════════════════════════════════════════════════════════
//
// El usuario anotó a mano ANTES de subir el extracto. La línea del banco no
// casa con ningún previsto (ya no lo hay: está punteado) y sin esto se
// duplicaría. Se fija qué línea casa con qué confirmado y, al guardar, qué
// hereda la línea del import y qué se borra.

describe('conciliación con confirmados · el lote de septiembre', () => {
  const LOTE_SEPT: Movement[] = [
    mov({ id: 31, importBatch: 'lote-sept', date: '2026-09-03', valueDate: '2026-09-04', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
    // Duplicado intra-lote del anterior · solo UNO puede fundirse con el confirmado.
    mov({ id: 32, importBatch: 'lote-sept', date: '2026-09-03', valueDate: '2026-09-04', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
    mov({ id: 33, importBatch: 'lote-sept', date: '2026-09-05', amount: 380, description: 'BIZUM DE LAURA SANCHEZ', counterparty: 'LAURA SANCHEZ', paymentMethod: 'Bizum' }),
    mov({ id: 34, importBatch: 'lote-sept', date: '2026-09-06', amount: -12.99, description: 'NETFLIX.COM' }),
  ];

  /** E1.5 · las FILAS del lote de septiembre · lo que hay en la base tras importar. */
  const LINEAS_SEPT = LOTE_SEPT.map((m) => ({
    id: 500 + (m.id as number),
    accountId: m.accountId,
    importe: m.amount,
    fechaOperacion: m.date,
    fechaValor: m.valueDate ?? m.date,
    conceptoLiteral: m.description,
    importBatchId: 'lote-sept',
    hashLinea: `v1:${m.id}`,
    hashMovement: `h${m.id}`,
    estado: 'pendiente',
    movementIds: [],
    createdAt: '',
    updatedAt: '',
  }));

  function sembrarSeptiembre(): void {
    stores = {
      lineasExtracto: [...LINEAS_SEPT],
      movements: [
        // 20 · el agua punteada a mano el 1-9 (previsto 7 ejecutado sobre él).
        mov({ id: 20, source: 'manual', importBatch: undefined, date: '2026-09-01', amount: -87.4, description: 'Agua Tenderina', reference: 'treasury_event:7', categoryKey: 'suministro_inmueble', ambito: 'INMUEBLE', inmuebleId: '1', unifiedStatus: 'conciliado' }),
        // 21 · la renta de Laura anotada a mano el mismo día.
        mov({ id: 21, source: 'manual', importBatch: undefined, date: '2026-09-05', amount: 380, description: 'Renta Laura', categoryKey: 'alquiler', ambito: 'INMUEBLE', inmuebleId: '4', unifiedStatus: 'confirmado' as never }),
        // 22 · ya del banco (import de otro lote) · NO es candidato.
        mov({ id: 22, importBatch: 'lote-viejo', date: '2026-09-02', amount: -87.4, description: 'ADEUDO RECIBO AQUALIA SA 0034ES' }),
        // 23 · compra a crédito · NO es candidata.
        mov({ id: 23, source: 'manual', importBatch: undefined, date: '2026-09-03', amount: -87.4, description: 'Agua con tarjeta', gastoTarjetaCredito: true } as never),
        // 24 · mismo importe pero OTRA cuenta · NO es candidato.
        mov({ id: 24, source: 'manual', importBatch: undefined, accountId: 3, date: '2026-09-06', amount: -12.99, description: 'Netflix' }),
      ],
      treasuryEvents: [
        previsto({ id: 7, status: 'executed', amount: 82, predictedDate: '2026-08-27', description: 'Agua Tenderina', sourceType: 'gasto_recurrente', sourceId: 42, categoryKey: 'suministro_inmueble', ambito: 'INMUEBLE', inmuebleId: 1, movementId: 20, executedMovementId: 20, actualAmount: 82, actualDate: '2026-09-01' }),
      ],
      gastosInmueble: [
        { id: 5, inmuebleId: 1, ejercicio: 2026, fecha: '2026-09-01', concepto: 'Agua Tenderina', categoria: 'suministro', casillaAEAT: '0113', importe: 82, origen: 'recurrente', origenId: 'recurrente-42-2026-8', estado: 'confirmado', estadoTesoreria: 'confirmed', movimientoId: '20', treasuryEventId: 7, createdAt: '', updatedAt: '' },
      ],
      importBatches: [],
      movementLearningRules: [],
    };
  }

  beforeEach(sembrarSeptiembre);

  it('confirmadosPorLinea · qué línea casa con qué confirmado · 1:1, el más cercano primero', () => {
    const refs = confirmadosPorLinea(LOTE_SEPT, [...LOTE_SEPT, ...(stores.movements as Movement[])], CUENTA);
    expect(Array.from(refs.entries())).toEqual([
      // A 0 días va primero · la renta.
      [33, { id: 21, descripcion: 'Renta Laura', importe: 380, fecha: '2026-09-05' }],
      // A 2 días · de las dos líneas idénticas, la de id MENOR se lleva el confirmado.
      [31, { id: 20, descripcion: 'Agua Tenderina', importe: -87.4, fecha: '2026-09-01' }],
      // 32 · sin confirmado (el 20 ya está usado; 22, 23 y 24 no son candidatos).
      // 34 · Netflix · el 24 es de otra cuenta.
    ]);
  });

  it('emparejarConfirmados · la ventana es de 5 días · a 6 ya no casa', () => {
    const linea = mov({ id: 40, date: '2026-09-07', amount: -87.4 });
    const confirmado = stores.movements.find((m) => m.id === 20) as Movement;
    expect(emparejarConfirmados([linea], [confirmado])).toEqual(new Map());
    expect(emparejarConfirmados([{ ...linea, date: '2026-09-06' }], [confirmado])).toEqual(new Map([[40, 20]]));
  });

  // E1.5 · D1 · estos seis tests cambiaron con el corte (ver cabecera): capturan
  // el comportamiento NUEVO · el Confirmado se conserva con el aval del banco.
  describe('confirmDecisions con reconciliacionesConfirmado · D1 · qué se conserva, qué queda enlazado', () => {
    const guardar = () =>
      confirmDecisions('lote-sept', {
        approvedMatches: [],
        ignoredLineaIds: [532],
        reconciliacionesConfirmado: [
          { lineaId: 531, confirmadoMovementId: 20 },
          { lineaId: 533, confirmadoMovementId: 21 },
        ],
      });
    const m = (id: number) => stores.movements.find((r) => r.id === id) as Movement | undefined;
    const fila = (id: number) => stores.lineasExtracto.find((r) => r.id === id) as Record<string, unknown>;

    it('los confirmados se CONSERVAN · no nace ningún movimiento y no se borra ninguno', async () => {
      await guardar();
      expect(m(20)).toBeDefined();
      expect(m(21)).toBeDefined();
      expect(stores.movements.map((r) => r.id).sort()).toEqual([20, 21, 22, 23, 24]);
    });

    it('el confirmado recibe el aval del banco · importe y fechas reales, conciliado · conserva su clasificación y su texto', async () => {
      await guardar();
      expect(m(20)).toMatchObject({
        description: 'Agua Tenderina',
        categoryKey: 'suministro_inmueble',
        ambito: 'INMUEBLE',
        inmuebleId: '1',
        amount: -87.4,
        date: '2026-09-03',
        valueDate: '2026-09-04',
        unifiedStatus: 'conciliado',
        movementState: 'Conciliado',
        statusConciliacion: 'match_automatico',
        source: 'manual',
      });
      expect(m(21)).toMatchObject({
        description: 'Renta Laura',
        categoryKey: 'alquiler',
        inmuebleId: '4',
        date: '2026-09-05',
        unifiedStatus: 'conciliado',
        statusConciliacion: 'match_automatico',
      });
      // La línea queda ENLAZADA al confirmado · deja de sumar por sí misma.
      expect(fila(531)).toMatchObject({ movementIds: [20], estado: 'resuelta', comoSeResolvio: 'confirmada' });
      expect(fila(533)).toMatchObject({ movementIds: [21], estado: 'resuelta', comoSeResolvio: 'confirmada' });
    });

    it('el previsto punteado sigue en el confirmado · con el dato del banco en magnitud', async () => {
      await guardar();
      expect(stores.treasuryEvents[0]).toMatchObject({
        id: 7,
        status: 'executed',
        movementId: 20,
        executedMovementId: 20,
        actualDate: '2026-09-03',
        actualAmount: 87.4,
      });
    });

    it('la línea de gasto que declaraba el agua le sigue apuntando y se queda con el dato del banco', async () => {
      await guardar();
      expect(stores.gastosInmueble[0]).toMatchObject({
        movimientoId: '20',
        importe: 87.4,
        fecha: '2026-09-03',
        fechaValor: '2026-09-04',
        estado: 'confirmado',
        treasuryEventId: 7,
      });
    });

    it('el duplicado intra-lote (532) se queda como línea · ignorada (§29), sin movimiento y sumando en el saldo', async () => {
      await guardar();
      expect(fila(532)).toMatchObject({ atencion: 'silenciada', estado: 'pendiente', movementIds: [] });
      expect(fila(534)).toMatchObject({ estado: 'pendiente', movementIds: [] });
      expect(fila(534).atencion).toBeUndefined();
    });

    it('un confirmado que ya no existe · la línea se queda a resolver, sin enlazar y sin movimiento', async () => {
      stores.movements.splice(stores.movements.findIndex((r) => r.id === 21), 1);
      await guardar();
      expect(fila(533)).toMatchObject({ estado: 'pendiente', movementIds: [] });
      // No ha nacido ningún movimiento para la línea · el 22 es el import de un lote viejo, sembrado.
      expect(stores.movements.map((r) => r.id).sort()).toEqual([20, 22, 23, 24]);
    });
  });
});
