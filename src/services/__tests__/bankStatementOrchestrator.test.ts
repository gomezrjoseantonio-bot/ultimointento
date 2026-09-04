// Tests del orquestador de extractos · E1.5 · EL CORTE.
//
// Importar guarda las LÍNEAS del extracto y NO crea ningún movimiento. El
// `Movement` nace SOLO al resolver (Guardar, ficha, traspaso → `materializarLinea`)
// y queda enlazado a su línea (`movementIds`). Mientras tanto la línea cuenta
// en el saldo por sí misma. Lo que se protege aquí:
//
//   1–2   processFile: parsea, deduplica (también contra líneas · M4), propone
//         por lineaId · 0 movimientos en la base.
//   3     confirmDecisions: el movimiento NACE al guardar, se enlaza a la línea,
//         el saldo no se mueve; ignorar no crea nada.
//   3bis  D1: el Confirmado se CONSERVA con el aval del banco (antes se borraba).
//   4–6   detección de banco (sin cambios).
//   7     E1.1: la línea persistida, ahora PENDIENTE y sin movimiento.
//   8     E1.3: retomar un lote a medias, por línea.
//   9     el saldo antes/después de cada camino de resolución y las minas
//         M1 (id de línea ≠ id de movimiento), M4 (dedupe contra líneas),
//         M6 (ficha desde línea), M10 (traspaso hereda `importBatch`).
//
// El parser, el detector de banco, el motor de sugerencias y el emparejador
// se mockean en la frontera del módulo; la base es un fake en memoria.
import {
  processFile,
  confirmDecisions,
  BankProfileNotDetectedError,
  StatementAlreadyImportedError,
  hashMovement,
  cancelImportBatch,
} from '../bankStatementOrchestrator';
import { reabrirLote } from '../reabrirLote';
import {
  decisionDeLinea,
  decisionesDesdeFilas,
  guardarDecisionDeLinea,
  lotesAMedias,
} from '../../modules/tesoreria/v6/decisionesPersistidas';
import {
  construirLineas,
  decisionesVacias,
  payloadDeConfirmacion,
  seOfrecePara,
} from '../../modules/tesoreria/v6/extractoSesion';
import { initDB, Movement, TreasuryEvent } from '../db';
import { bankProfileMatcher } from '../../features/inbox/importers/bankProfileMatcher';
import { BankParserService } from '../../features/inbox/importers/bankParser';
import { matchLineas } from '../movementMatchingService';
import { suggestForLineas } from '../movementSuggestionService';
import { createOrUpdateRule } from '../movementLearningService';
import { gastoDesdeMovimiento, mejoraDesdeMovimiento } from '../altaMovimientoService';
import { convertirLineaEnTraspaso } from '../traspasoDesdeMovimiento';
import { materializarLinea } from '../materializarLinea';
import { calculateAccountBalanceAtDate, esLineaHuerfana } from '../accountBalanceService';
import { aplicarReconocimiento } from '../deterministas/cierreDeterminista';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import type { SugerenciaPorLinea } from '../lineaComoMovimiento';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../../features/inbox/importers/bankProfileMatcher', () => ({
  bankProfileMatcher: { match: jest.fn() },
}));
jest.mock('../../features/inbox/importers/bankParser', () => ({
  BankParserService: jest.fn(),
}));
jest.mock('../movementMatchingService', () => ({ matchLineas: jest.fn() }));
jest.mock('../movementSuggestionService', () => ({ suggestForLineas: jest.fn() }));
jest.mock('../movementLearningService', () => ({
  buildLearnKey: jest.fn(() => 'hash:any'),
  createOrUpdateRule: jest.fn(async () => ({})),
}));
// El cierre determinista de verdad necesita el cuadro del préstamo, la venta…
// Aquí se prueba el CABLEADO: que se le pasa el movimiento que acaba de nacer.
jest.mock('../deterministas/cierreDeterminista', () => ({
  aplicarReconocimiento: jest.fn(async () => true),
  baseDe: (db: unknown) => db,
}));

jest.mock('../bankProfilesService', () => ({
  // Plain functions (not jest.fn) — these are pure helpers; we don't need to
  // assert on call history in any test, and keeping them as plain functions
  // sidesteps any chance of an aggressive Jest reset API (resetAllMocks /
  // restoreAllMocks) interacting with the factory implementation. Note that
  // `jest.clearAllMocks()` (used in beforeEach below) only clears call state
  // on jest.fn — it does NOT reset implementations.
  bankProfilesService: {
    loadProfiles: async () => undefined,
    getProfiles: () => [],
    getBankInfoFromIBAN: (iban: string) => {
      if (!iban) return null;
      const upper = iban.toUpperCase();
      if (!upper.startsWith('ES')) return { bankCode: upper.slice(0, 2) };
      const code = upper.substring(4, 8);
      const map: Record<string, string> = {
        '0081': 'Sabadell',
        '2103': 'Unicaja',
        '2080': 'ABANCA',
      };
      return { bankCode: code, bankKey: map[code] };
    },
  },
}));

interface FakeStores {
  movements: Movement[];
  treasuryEvents: TreasuryEvent[];
  importBatches: any[];
  accounts: any[];
  lineasExtracto: any[];
  gastosInmueble: any[];
  mejorasInmueble: any[];
}

function buildStores(initial: Partial<FakeStores> = {}): FakeStores {
  return {
    movements: initial.movements ?? [],
    treasuryEvents: initial.treasuryEvents ?? [],
    importBatches: initial.importBatches ?? [],
    accounts: initial.accounts ?? [],
    lineasExtracto: initial.lineasExtracto ?? [],
    gastosInmueble: initial.gastosInmueble ?? [],
    mejorasInmueble: initial.mejorasInmueble ?? [],
  };
}

// Los dos stores son `autoIncrement` desde 1 en la base real (mina M1). El
// fake hace lo mismo a propósito: si alguien escribiera un movimiento con el
// id de su línea, pisaría a otro y se vería aquí.
let nextMovementId = 1;
let nextLineaId = 1;
let stores: FakeStores;

function buildDb(s: FakeStores) {
  return {
    add: jest.fn(async (storeName: keyof FakeStores, row: any) => {
      if (storeName === 'movements') {
        if (row.id != null) throw new Error(`M1 · un movimiento nuevo no lleva id (llegó ${row.id})`);
        const id = nextMovementId++;
        s.movements.push({ ...row, id });
        return id;
      }
      if (storeName === 'treasuryEvents') {
        const id = (s.treasuryEvents.length + 1) * 1000;
        s.treasuryEvents.push({ ...row, id });
        return id;
      }
      if (storeName === 'lineasExtracto') {
        const id = nextLineaId++;
        s.lineasExtracto.push({ ...row, id });
        return id;
      }
      if (storeName === 'gastosInmueble' || storeName === 'mejorasInmueble') {
        const list = s[storeName];
        const id = (list.length + 1) * 10;
        list.push({ ...row, id });
        return id;
      }
      throw new Error(`unsupported store add: ${String(storeName)}`);
    }),
    put: jest.fn(async (storeName: keyof FakeStores, row: any) => {
      const list = s[storeName] as any[];
      const idx = list.findIndex(r => r.id === row.id);
      if (idx >= 0) list[idx] = row;
      else list.push(row);
      return row.id;
    }),
    get: jest.fn(async (storeName: keyof FakeStores, key: number | string) => {
      const list = (s[storeName] as any[]) ?? [];
      return list.find(r => r.id === key);
    }),
    getAll: jest.fn(async (storeName: keyof FakeStores) => s[storeName] ?? []),
    delete: jest.fn(async (storeName: keyof FakeStores, key: number | string) => {
      const list = s[storeName] as any[];
      const idx = list.findIndex(r => r.id === key);
      if (idx >= 0) list.splice(idx, 1);
    }),
  };
}

function makeParsed(count: number) {
  // 14 dated movements: rentas alternating two inquilinos plus a couple of expenses.
  const parsed: any[] = [];
  for (let i = 0; i < count; i++) {
    parsed.push({
      date: new Date(`2026-04-${String(15 + (i % 8)).padStart(2, '0')}T00:00:00Z`),
      amount: i % 2 === 0 ? 380 : -45.23,
      description: i % 2 === 0 ? `RENTA INQUILINO ${i}` : `RECIBO IBERDROLA ${i}`,
    });
  }
  return parsed;
}

const NOW = '2026-09-04T10:00:00.000Z';

/** Una línea pendiente sembrada a mano · lo que deja `processFile` tras el corte. */
function lineaPendiente(l: {
  id: number; fecha: string; importe: number; texto: string; lote?: string; cuenta?: number;
}): LineaExtractoPersistida {
  const accountId = l.cuenta ?? 42;
  return {
    id: l.id,
    accountId,
    importBatchId: l.lote ?? 'batch-A',
    fechaOperacion: l.fecha,
    fechaValor: l.fecha,
    importe: l.importe,
    conceptoLiteral: l.texto,
    hashLinea: `v1:${l.id}`,
    hashMovement: hashMovement({ accountId, date: l.fecha, amount: l.importe, description: l.texto } as Movement),
    estado: 'pendiente',
    movementIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Las líneas que ENTRAN a la sesión (con fecha e importe, no duplicadas). */
const lineasQueEntran = () => stores.lineasExtracto.filter((l) => l.id != null && !l.descarte);

/** El saldo VIVO de la cuenta 42 · el hub único, con líneas. */
const saldo42 = (cuenta = 42) =>
  calculateAccountBalanceAtDate({
    account: { id: cuenta, openingBalance: 0 } as any,
    cutoffDate: '2027-01-01',
    treasuryEvents: stores.treasuryEvents,
    movements: stores.movements,
    lineas: stores.lineasExtracto,
  });

const redondea = (n: number) => Math.round(n * 100) / 100;

// jsdom no implementa `File.text()` ni `crypto.subtle`, así que sin esto
// `generateBatchHash` degrada a "sin hash" (''), que es el comportamiento
// seguro en producción pero deja sin cubrir la idempotencia por fichero de
// V6 · D1 bis.
//
// El polyfill lee los BYTES REALES vía FileReader (que jsdom sí implementa),
// no el nombre: así el hash que se ejercita es el de verdad y dos ficheros
// distintos con el mismo nombre siguen dando hashes distintos, como en
// producción.
beforeAll(() => {
  if (typeof File.prototype.text !== 'function') {
    // eslint-disable-next-line no-extend-native
    (File.prototype as unknown as { text: () => Promise<string> }).text = function (this: File) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
});

beforeEach(() => {
  nextMovementId = 1;
  nextLineaId = 1;
  stores = buildStores();
  (initDB as jest.Mock).mockResolvedValue(buildDb(stores));
  (bankProfileMatcher.match as jest.Mock).mockResolvedValue({
    profile: 'Sabadell',
    confidence: 88,
    signals: { headerScore: 50, filenameScore: 25, contentScore: 13 },
  });
  (BankParserService as unknown as jest.Mock).mockImplementation(() => ({
    parseFile: jest.fn(async () => ({
      success: true,
      movements: makeParsed(14),
      metadata: {},
    })),
  }));
  // E1.5 · el emparejador recibe LÍNEAS y responde por lineaId: las 11
  // primeras casan, las 3 últimas no.
  (matchLineas as jest.Mock).mockImplementation(async (lineas: LineaExtractoPersistida[]) => {
    const ids = lineas.map((l) => l.id as number);
    return {
      matches: ids.slice(0, 11).map((lineaId, idx) => ({
        lineaId,
        treasuryEventId: 1000 + idx,
        score: 95,
        reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match'],
      })),
      multiMatches: [],
      sinMatch: ids.slice(11),
    };
  });
  (suggestForLineas as jest.Mock).mockImplementation(async (lineas: LineaExtractoPersistida[]) => {
    const map = new Map<number, SugerenciaPorLinea[]>();
    for (const l of lineas) {
      map.set(l.id as number, [
        {
          lineaId: l.id as number,
          via: 'heuristica',
          confidence: 60,
          description: 'Posible suministro · proponer crear evento de tesorería',
          action: {
            kind: 'create_treasury_event',
            type: 'expense',
            ambito: 'INMUEBLE',
            categoryKey: 'inmueble.suministros',
            sourceType: 'gasto',
          },
        },
      ]);
    }
    return map;
  });
  jest.clearAllMocks();
});

describe('bankStatementOrchestrator', () => {
  it('1. processFile · 14 parsed · 11 matched · 3 sin-match · NINGÚN movimiento en la base', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = await processFile(file, { accountId: 42 });

    expect(result.movementsParsed).toBe(14);
    expect(result.lineasImportadas).toBe(14);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.matchResult.matches).toHaveLength(11);
    expect(result.matchResult.sinMatch).toHaveLength(3);
    expect(result.suggestions.size).toBe(3);
    expect(result.bankProfileUsed).toBe('Sabadell');
    expect(result.warnings).toEqual([]); // confidence 88 ≥ 80 → no low-confidence warning
    expect(stores.importBatches).toHaveLength(1);

    // EL CORTE · importar no crea movimientos; guarda líneas.
    expect(stores.movements).toHaveLength(0);
    expect(stores.lineasExtracto).toHaveLength(14);
    // Y lo que propone habla en lineaId, el de las líneas que entraron.
    const ids = lineasQueEntran().map((l) => l.id);
    expect(result.matchResult.matches.map((m) => m.lineaId)).toEqual(ids.slice(0, 11));
    expect(result.matchResult.sinMatch).toEqual(ids.slice(11));
    expect([...result.suggestions.keys()]).toEqual(ids.slice(11));
    // Al emparejador le llegaron las líneas persistidas, con su id.
    expect((matchLineas as jest.Mock).mock.calls[0][0].map((l: any) => l.id)).toEqual(ids);
  });

  it('1b. Dos cargos IDÉNTICOS en el mismo extracto entran los DOS (comunidad de dos pisos)', async () => {
    // Caso real de Jose: el banco lista dos "CDAD PROP … -38,00" del mismo día
    // (Nº mov 839 y 840). Son dos operaciones reales; la dedup por línea NO debe
    // colapsarlos. Solo se deduplica contra lo que YA existía de otros lotes.
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({
        success: true,
        movements: [
          { date: new Date('2026-08-05T00:00:00Z'), amount: -38, description: 'CDAD PROP 01B046 000278300002' },
          { date: new Date('2026-08-05T00:00:00Z'), amount: -38, description: 'CDAD PROP 01B046 000278300002' },
        ],
        metadata: {},
      })),
    }));

    const file = new File(['mock'], 'unicaja.xls');
    const result = await processFile(file, { accountId: 42 });

    expect(result.lineasImportadas).toBe(2);
    expect(result.duplicatesSkipped).toBe(0);
    expect(lineasQueEntran().filter((l) => l.importe === -38)).toHaveLength(2);
    // Y las dos cuentan en el saldo.
    expect(saldo42()).toBe(-76);
  });

  // V6 · D1 bis · el mismo fichero ya no se reprocesa en silencio: `hashLote`
  // lo corta ANTES de parsear. La dedup por línea (contra otros lotes) sigue
  // siendo la segunda red, para cuando el usuario fuerza la reimportación.
  it('2. processFile con el mismo fichero · se planta antes de insertar nada', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');

    const first = await processFile(file, { accountId: 42 });
    expect(first.lineasImportadas).toBe(14);
    expect(first.duplicatesSkipped).toBe(0);
    expect(stores.importBatches).toHaveLength(1);
    expect(stores.importBatches[0].hashLote).not.toBe('');

    await expect(processFile(file, { accountId: 42 })).rejects.toBeInstanceOf(
      StatementAlreadyImportedError
    );

    // No ha tocado nada: ni líneas nuevas ni una fila de batch huérfana.
    expect(stores.lineasExtracto).toHaveLength(14);
    expect(stores.importBatches).toHaveLength(1);
  });

  it('2 bis. processFile con allowReimport · 0 importadas · 14 duplicadas por hash · contra las LÍNEAS (M4)', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');

    await processFile(file, { accountId: 42 });
    // Tras el corte no hay movimientos contra los que deduplicar: la segunda
    // red tiene que mirar las líneas ya guardadas, o el mismo dinero entraría
    // dos veces al saldo.
    expect(stores.movements).toHaveLength(0);
    const saldoTrasElPrimero = saldo42();

    const second = await processFile(file, { accountId: 42, allowReimport: true });
    expect(second.lineasImportadas).toBe(0);
    expect(second.duplicatesSkipped).toBe(14);
    expect(stores.movements).toHaveLength(0);
    expect(second.warnings.join(' ')).toMatch(/reimportado/i);
    expect(saldo42()).toBe(saldoTrasElPrimero);
  });

  // La sugerencia YA NO se aplica sola: ese canal se retiró en la 2.0.2 porque
  // nunca se ejecutaba (`payloadDeConfirmacion` lo devolvía vacío) y lo que
  // había al otro lado no creaba la fila fiscal del gasto. Lo que este test
  // protege sigue siendo lo de siempre —matches e ignorados—, más el candado de
  // que una sugerencia NO se materializa a espaldas del usuario.
  it('3. confirmDecisions · el movimiento NACE al guardar, enlazado a su línea · ignorar no crea nada · el saldo no se mueve', async () => {
    // Cuatro líneas pendientes (lo que deja el import) y dos previstos.
    stores.lineasExtracto.push(
      lineaPendiente({ id: 1, fecha: '2026-04-22', importe: 380, texto: 'RENTA 1' }),
      lineaPendiente({ id: 2, fecha: '2026-04-22', importe: 380, texto: 'RENTA 2' }),
      lineaPendiente({ id: 3, fecha: '2026-04-15', importe: -45.23, texto: 'IBERDROLA' }),
      lineaPendiente({ id: 4, fecha: '2026-04-18', importe: -32.99, texto: 'AMAZON' }),
    );
    nextLineaId = 5;
    stores.treasuryEvents.push(
      { id: 1000, type: 'income', amount: 380, predictedDate: '2026-04-22', description: 'Renta 1', sourceType: 'contract', status: 'predicted', accountId: 42, ambito: 'INMUEBLE', categoryKey: 'inmueble.alquiler', createdAt: '', updatedAt: '' },
      { id: 1001, type: 'income', amount: 380, predictedDate: '2026-04-22', description: 'Renta 2', sourceType: 'contract', status: 'predicted', accountId: 42, ambito: 'INMUEBLE', categoryKey: 'inmueble.alquiler', createdAt: '', updatedAt: '' },
    );
    const saldoAntes = saldo42();
    expect(redondea(saldoAntes)).toBe(redondea(380 + 380 - 45.23 - 32.99));

    await confirmDecisions('batch-A', {
      approvedMatches: [
        { lineaId: 1, treasuryEventId: 1000 },
        { lineaId: 2, treasuryEventId: 1001 },
      ],
      ignoredLineaIds: [4],
    });

    // Han nacido DOS movimientos, uno por cuadre · ni uno para la ignorada ni
    // para la que sigue esperando.
    expect(stores.movements).toHaveLength(2);
    const [m1, m2] = stores.movements;
    expect(m1.description).toBe('RENTA 1');
    expect(m2.description).toBe('RENTA 2');
    expect(m1.importBatch).toBe('batch-A');

    // Cada línea enlaza a SU movimiento y deja de sumar por sí misma.
    const l = (id: number) => stores.lineasExtracto.find((x) => x.id === id);
    expect(l(1)).toMatchObject({ movementIds: [m1.id], estado: 'resuelta', comoSeResolvio: 'confirmada' });
    expect(l(2)).toMatchObject({ movementIds: [m2.id], estado: 'resuelta', comoSeResolvio: 'confirmada' });
    expect(esLineaHuerfana(l(1))).toBe(false);
    // La 3 sigue pendiente y huérfana · la 4 solo silenciada (§29): sigue en el saldo.
    expect(l(3)).toMatchObject({ estado: 'pendiente', movementIds: [] });
    expect(l(4)).toMatchObject({ estado: 'pendiente', movementIds: [], atencion: 'silenciada' });
    expect(esLineaHuerfana(l(4))).toBe(true);

    // 2 events flipped to executed apuntando al movimiento que acaba de nacer.
    const event1000 = stores.treasuryEvents.find(e => e.id === 1000)!;
    const event1001 = stores.treasuryEvents.find(e => e.id === 1001)!;
    expect(event1000.status).toBe('executed');
    expect(event1000.executedMovementId).toBe(m1.id);
    expect(event1001.status).toBe('executed');
    expect(event1001.executedMovementId).toBe(m2.id);

    // NINGÚN evento nuevo: la sugerencia existe, pero nadie la aplica.
    expect(stores.treasuryEvents.filter(e => e.id! >= 3000)).toHaveLength(0);

    // Los nacidos → conciliado, heredando la clasificación de la previsión
    // (categoría + ámbito). El texto del banco se conserva.
    expect(m1.unifiedStatus).toBe('conciliado');
    expect(m2.unifiedStatus).toBe('conciliado');
    expect(m1.categoryKey).toBe('inmueble.alquiler');
    expect(m1.ambito).toBe('INMUEBLE');

    // El saldo no se mueve al resolver: el dinero ya estaba en el banco.
    expect(redondea(saldo42())).toBe(redondea(saldoAntes));

    // Se aprende de lo que SÍ se concilió · los dos matches.
    expect((createOrUpdateRule as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('3 bis. D1 · reconciliar contra un Confirmado que ya tenías · el Confirmado se CONSERVA con el aval del banco', async () => {
    // "Las dos cosas": el usuario anotó a mano una disposición de cajero
    // (Confirmado, con su clasificación) y AHORA sube el extracto, que trae la
    // misma operación como línea 50. Antes de E1.5 el import creaba un segundo
    // movimiento y se borraba el confirmado; ahora no nace nada: el confirmado
    // sigue siendo el movimiento, sube a Conciliado con el dato del banco y la
    // línea queda enlazada a él.
    stores.movements.push({
      id: 9,
      accountId: 42,
      date: '2026-04-14',
      amount: -20,
      description: 'Sacar del cajero',
      source: 'manual',
      unifiedStatus: 'no_planificado',
      movementState: 'Confirmado',
      statusConciliacion: 'sin_match',
      ambito: 'PERSONAL',
      categoryKey: 'personal.efectivo',
      updatedAt: '',
      createdAt: '',
    } as any);
    nextMovementId = 10;
    stores.lineasExtracto.push(
      lineaPendiente({ id: 50, fecha: '2026-04-15', importe: -20, texto: 'DISPOSICION CAJERO 4521' })
    );
    // Hasta que se reconcilia, la línea y el confirmado suman los dos (es lo
    // que la reconciliación viene a arreglar).
    expect(saldo42()).toBe(-40);

    await confirmDecisions('batch-A', {
      approvedMatches: [],
      ignoredLineaIds: [],
      reconciliacionesConfirmado: [{ lineaId: 50, confirmadoMovementId: 9 }],
    });

    // No ha nacido ningún movimiento · el confirmado sigue ahí.
    expect(stores.movements.map((m) => m.id)).toEqual([9]);
    const conciliado = stores.movements.find(m => m.id === 9)!;
    expect(conciliado).toMatchObject({
      unifiedStatus: 'conciliado',
      movementState: 'Conciliado',
      statusConciliacion: 'match_automatico',
      categoryKey: 'personal.efectivo',
      ambito: 'PERSONAL',
      // Lo suyo se queda · lo del banco lo aporta el banco.
      description: 'Sacar del cajero',
      source: 'manual',
      date: '2026-04-15',
      amount: -20,
    });
    // La línea apunta al confirmado y deja de sumar: un solo -20.
    expect(stores.lineasExtracto.find((l) => l.id === 50)).toMatchObject({
      movementIds: [9], estado: 'resuelta', comoSeResolvio: 'confirmada',
    });
    expect(saldo42()).toBe(-20);
  });

  it('3 ter. D1 · reconciliar un previsto PUNTEADO · su evento sigue apuntándole y toma el dato real', async () => {
    // Un previsto punteado deja un evento `executed` apuntando al confirmado
    // (id 9) que `confirmTreasuryEvent` creó con `reference: treasury_event:<id>`.
    // Con D1 el confirmado se queda, así que el evento NO se re-apunta: solo
    // toma del banco la fecha y el importe reales.
    stores.treasuryEvents.push({
      id: 700,
      accountId: 42,
      type: 'expense',
      amount: -20,
      predictedDate: '2026-04-14',
      status: 'executed',
      movementId: 9,
      executedMovementId: 9,
      actualDate: '2026-04-14',
      actualAmount: 20,
    } as any);
    stores.movements.push({
      id: 9,
      accountId: 42,
      date: '2026-04-14',
      amount: -20,
      description: 'Comunidad',
      source: 'manual',
      unifiedStatus: 'conciliado',
      movementState: 'Conciliado',
      reference: 'treasury_event:700',
      categoryKey: 'inmueble.comunidad',
      updatedAt: '',
      createdAt: '',
    } as any);
    nextMovementId = 10;
    stores.lineasExtracto.push(
      lineaPendiente({ id: 50, fecha: '2026-04-15', importe: -20, texto: 'RECIBO FUERTES ACEVEDO 32' })
    );

    await confirmDecisions('batch-A', {
      approvedMatches: [],
      ignoredLineaIds: [],
      reconciliacionesConfirmado: [{ lineaId: 50, confirmadoMovementId: 9 }],
    });

    expect(stores.movements.map((m) => m.id)).toEqual([9]);
    const ev = stores.treasuryEvents.find(e => e.id === 700)!;
    expect(ev.movementId).toBe(9);
    expect(ev.executedMovementId).toBe(9);
    expect(ev.actualDate).toBe('2026-04-15');
    expect(ev.actualAmount).toBe(20);
    expect(stores.lineasExtracto.find((l) => l.id === 50)?.movementIds).toEqual([9]);
    // El evento (executed, -20) y el confirmado son la misma cosa para el saldo.
    expect(saldo42()).toBe(-20);
  });

  it('4. processFile · bankProfileMatcher devuelve confidence baja sin hint ⇒ BankProfileNotDetectedError', async () => {
    (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
      profile: 'Generic',
      confidence: 35,
      signals: { headerScore: 20, filenameScore: 0, contentScore: 15 },
    });
    const file = new File(['mock'], 'banco-desconocido.csv');
    await expect(processFile(file, { accountId: 42 })).rejects.toBeInstanceOf(BankProfileNotDetectedError);
  });

  it('5. processFile · bypasses BankProfileNotDetectedError when destination account has a known IBAN', async () => {
    // User reported real bug 2026-04-27: Sabadell/Unicaja/ABANCA exports failed
    // file detection. Fix: when the user has chosen an account whose IBAN
    // resolves to a known bank profile, that signal trumps file detection.
    stores.accounts.push({
      id: 42,
      iban: 'ES47 0081 2706 1500 0323 9635', // 0081 → Sabadell
      banco: { name: 'Banco de Sabadell', code: '0081' },
    });
    (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
      profile: null,
      confidence: 0,
      signals: { headerScore: 0, filenameScore: 0, contentScore: 0, ibanScore: 0 },
    });

    const file = new File(['mock'], '27042026_2706_0003239635.xls');
    const result = await processFile(file, { accountId: 42 });

    expect(result.bankProfileUsed).toBe('Sabadell');
    expect(result.lineasImportadas).toBeGreaterThan(0);
  });

  it('6. processFile · falls back to banco.name when IBAN is foreign / unknown (Revolut path)', async () => {
    // Revolut accounts use foreign IBANs (LT/IE), which getBankInfoFromIBAN
    // cannot map to a Spanish profile. The deriveBankHintFromAccount second
    // fallback (banco.name → profile key by case-insensitive substring)
    // should catch this. Temporarily override the mocked getProfiles to
    // include a Revolut entry so the matching can succeed.
    const mockService = jest.requireMock('../bankProfilesService').bankProfilesService;
    const originalGetProfiles = mockService.getProfiles;
    mockService.getProfiles = () => [{ bankKey: 'Revolut' }, { bankKey: 'Sabadell' }];

    try {
      stores.accounts.push({
        id: 99,
        iban: 'LT12 3456 7890 1234 5678', // Lithuania — getBankInfoFromIBAN returns soft hint, no bankKey
        banco: { name: 'Revolut', code: undefined },
      });
      (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
        profile: null,
        confidence: 0,
        signals: { headerScore: 0, filenameScore: 0, contentScore: 0, ibanScore: 0 },
      });

      const file = new File(['mock'], 'revolut-export.csv');
      const result = await processFile(file, { accountId: 99 });

      expect(result.bankProfileUsed).toBe('Revolut');
      expect(result.lineasImportadas).toBeGreaterThan(0);
    } finally {
      mockService.getProfiles = originalGetProfiles;
    }
  });
});

// ─── E1.1 → E1.5 · `lineasExtracto` · la línea del banco es lo ÚNICO que se persiste ───
//
// Lo que se protege: (a) por cada fila del parser hay UNA línea, (b) su
// `conceptoLiteral` es el texto del parser CARÁCTER A CARÁCTER, (c) nace
// PENDIENTE y sin movimiento, (d) su `hashMovement` es la huella con la que se
// deduplica, y (e) lo que NO entra deja rastro con `descarte` en vez de perderse.
describe('E1.1 · lineasExtracto', () => {
  it('7. una línea por fila · conceptoLiteral EXACTO · pendiente y sin movimiento', async () => {
    const parsed = makeParsed(14);
    // Espacios dobles, espacios en los extremos, acentos y ñ: todo lo que un
    // `trim` o un normalizador se comería. Tiene que llegar tal cual.
    parsed[3].description = '  RECIBO  IBERDROLA   ÁÉ ñ · ¿? ';
    parsed[5].valueDate = new Date('2026-04-22T00:00:00Z');
    parsed[5].counterparty = 'IBERDROLA CLIENTES';
    parsed[5].reference = 'REF-000123';
    parsed[5].balance = 1234.56;
    parsed[5].currency = 'EUR';
    parsed[5].originalRow = 9;
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({ success: true, movements: parsed, metadata: {} })),
    }));

    const result = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });

    expect(result.lineasImportadas).toBe(14);
    expect(result.duplicatesSkipped).toBe(0);
    expect(stores.movements).toHaveLength(0);

    expect(stores.lineasExtracto).toHaveLength(14);
    for (let i = 0; i < parsed.length; i++) {
      const linea = stores.lineasExtracto[i];
      expect(linea.conceptoLiteral).toBe(parsed[i].description);
      expect(linea.conceptoLiteral.length).toBe(parsed[i].description.length);
      expect(linea.movementIds).toEqual([]);
      expect(linea.importe).toBe(parsed[i].amount);
      expect(linea.fechaOperacion).toBe(`2026-04-${String(15 + (i % 8)).padStart(2, '0')}`);
      expect(linea.accountId).toBe(42);
      expect(linea.importBatchId).toBe(result.importBatchId);
      expect(linea.estado).toBe('pendiente');
      expect(linea.descarte).toBeUndefined();
      // La huella es LA MISMA con la que el orquestador deduplica.
      expect(linea.hashMovement).toBe(
        hashMovement({ accountId: 42, date: linea.fechaOperacion, amount: linea.importe, description: linea.conceptoLiteral } as Movement)
      );
      expect(linea.hashLinea).toMatch(/^v1:/);
      expect(esLineaHuerfana(linea)).toBe(true);
    }
    // Lo demás que trajo el banco viaja entero.
    const l5 = stores.lineasExtracto[5];
    expect(l5.fechaValor).toBe('2026-04-22');
    expect(l5.contraparte).toBe('IBERDROLA CLIENTES');
    expect(l5.referencia).toBe('REF-000123');
    expect(l5.saldo).toBe(1234.56);
    expect(l5.divisa).toBe('EUR');
    expect(l5.filaOriginal).toBe(9);
    // Sin fecha valor propia, cae a la de operación.
    expect(stores.lineasExtracto[0].fechaValor).toBe(stores.lineasExtracto[0].fechaOperacion);
  });

  it('7b. reimportar con allowReimport · las duplicadas dejan rastro con descarte y NO suman', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');
    const primero = await processFile(file, { accountId: 42 });
    const segundo = await processFile(file, { accountId: 42, allowReimport: true });

    expect(segundo.lineasImportadas).toBe(0);
    expect(segundo.duplicatesSkipped).toBe(14);
    expect(stores.movements).toHaveLength(0);

    expect(stores.lineasExtracto).toHaveLength(28);
    const delSegundo = stores.lineasExtracto.filter((l) => l.importBatchId === segundo.importBatchId);
    expect(delSegundo).toHaveLength(14);
    for (const l of delSegundo) {
      expect(l.descarte).toBe('duplicada');
      expect(l.estado).toBe('sin_procesar');
      expect(l.movementIds).toEqual([]);
      // Candado del saldo: una duplicada NO es huérfana aunque no tenga movimiento.
      expect(esLineaHuerfana(l)).toBe(false);
    }
    // La misma línea, en los dos lotes, tiene la MISMA identidad.
    const delPrimero = stores.lineasExtracto.filter((l) => l.importBatchId === primero.importBatchId);
    expect(delSegundo.map((l) => l.hashLinea)).toEqual(delPrimero.map((l) => l.hashLinea));
    expect(delSegundo.map((l) => l.hashMovement)).toEqual(delPrimero.map((l) => l.hashMovement));
    // Las duplicadas no entran a la sesión ni al emparejador.
    expect(segundo.matchResult.matches).toHaveLength(0);
    expect((matchLineas as jest.Mock).mock.calls[1][0]).toEqual([]);
  });

  it('7c. sin fecha y sin importe · dejan rastro en vez de perderse en silencio', async () => {
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({
        success: true,
        movements: [
          { date: new Date('2026-05-03T00:00:00Z'), amount: -12.5, description: 'CARGO NORMAL' },
          { date: new Date('no es una fecha'), amount: -99, description: 'SIN FECHA' },
          { date: new Date('2026-05-04T00:00:00Z'), amount: 'abc', description: 'SIN IMPORTE' },
        ],
        metadata: {},
      })),
    }));

    const result = await processFile(new File(['mock'], 'raro.xlsx'), { accountId: 42 });

    // Lo de siempre: solo entra la buena.
    expect(result.movementsParsed).toBe(3);
    expect(result.lineasImportadas).toBe(1);
    expect(stores.movements).toHaveLength(0);

    expect(stores.lineasExtracto).toHaveLength(3);
    const [ok, sinFecha, sinImporte] = stores.lineasExtracto;
    expect(ok.estado).toBe('pendiente');
    expect(ok.movementIds).toEqual([]);

    expect(sinFecha.descarte).toBe('sin_fecha');
    expect(sinFecha.fechaOperacion).toBe('');
    expect(sinFecha.importe).toBe(-99);
    expect(sinFecha.conceptoLiteral).toBe('SIN FECHA');
    expect(sinFecha.movementIds).toEqual([]);

    expect(sinImporte.descarte).toBe('sin_importe');
    expect(sinImporte.fechaOperacion).toBe('2026-05-04');
    expect(sinImporte.conceptoLiteral).toBe('SIN IMPORTE');
    expect(sinImporte.movementIds).toEqual([]);

    // Solo la buena suma · las descartadas no.
    expect(saldo42()).toBe(-12.5);
  });
});

// ─── E1.3 · retomar un lote a medias ───────────────────────────────────────
//
// Lo que se prueba, de punta a punta con el mismo fake de base:
//   procesar → decidir (persistiendo) → «cerrar» (tirar la memoria) → reabrir
//   → la sesión se reconstruye idéntica y el payload a `confirmDecisions` es
//   el mismo que habría salido sin cerrar. Y descartar el lote borra también
//   sus líneas, para que no vuelva a salir como «a medias».
describe('E1.3 · retomar un lote a medias', () => {
  const sesionDe = async (importBatchId: string) => {
    const filas = stores.lineasExtracto.filter((l) => l.importBatchId === importBatchId);
    const abiertos = stores.treasuryEvents.filter((e) => seOfrecePara(e, 42));
    return { filas, abiertos };
  };

  it('8. reabrirLote devuelve lo mismo que processFile, sin leer fichero ni insertar', async () => {
    const primero = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const lineasAntes = stores.lineasExtracto.length;

    const reabierto = await reabrirLote(primero.importBatchId);

    expect(reabierto.importBatchId).toBe(primero.importBatchId);
    expect(reabierto.matchResult.matches.map((m) => m.lineaId)).toEqual(
      primero.matchResult.matches.map((m) => m.lineaId)
    );
    expect(reabierto.matchResult.sinMatch).toEqual(primero.matchResult.sinMatch);
    expect(reabierto.suggestions.size).toBe(primero.suggestions.size);
    expect(reabierto.lineasImportadas).toBe(14);
    expect(reabierto.warnings.join(' ')).toMatch(/retomada/i);
    // Nada nuevo en la base.
    expect(stores.movements).toHaveLength(0);
    expect(stores.lineasExtracto).toHaveLength(lineasAntes);
    expect(stores.importBatches).toHaveLength(1);
  });

  it('8b. un lote guardado no se reabre · y uno inexistente tampoco', async () => {
    const r = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    stores.importBatches[0].consolidadoAt = '2026-09-04T10:00:00.000Z';
    await expect(reabrirLote(r.importBatchId)).rejects.toThrow(/ya se guardó/);
    await expect(reabrirLote('import_no_existe')).rejects.toThrow(/ya no existe/);
  });

  it('8c. procesar → decidir → cerrar → reabrir · la sesión vuelve idéntica y el payload es el mismo', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const { filas, abiertos } = await sesionDe(res.importBatchId);
    const lineas = construirLineas(filas, res.matchResult, abiertos, new Set(), new Map());
    expect(lineas).toHaveLength(14);

    // El usuario decide: asigna una a mano, ignora dos, marca un traspaso y
    // una retirada de efectivo, y desempareja una que ATLAS había casado.
    const d = decisionesVacias();
    d.asignados.set(lineas[11].lineaId, 1000); // una sin match, asignada a mano
    d.ignorados.add(lineas[12].lineaId);
    d.ignorados.add(lineas[13].lineaId);
    d.aTraspaso.set(lineas[1].lineaId, 7);
    d.aEfectivo.add(lineas[3].lineaId);
    d.desemparejados.add(lineas[0].lineaId);
    // Persistir como lo hace el drawer tras cada gesto.
    for (const l of lineas) {
      await guardarDecisionDeLinea(l.lineaId, decisionDeLinea(d, l.lineaId, '2026-09-04T10:00:00.000Z'));
    }
    const payloadAntesDeCerrar = payloadDeConfirmacion(lineas, d);
    const saldoAntes = saldo42();

    // «Cerrar»: la memoria de React se tira. Solo queda la base.
    // Sale como a medias, con sus decisiones contadas.
    const lotes = await lotesAMedias();
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({ importBatchId: res.importBatchId, lineas: 14, decididas: 6 });

    // Reabrir.
    const reabierto = await reabrirLote(res.importBatchId);
    const otraVez = await sesionDe(res.importBatchId);
    const lineas2 = construirLineas(otraVez.filas, reabierto.matchResult, otraVez.abiertos, new Set(), new Map());
    const d2 = decisionesDesdeFilas(otraVez.filas);

    expect(d2).toEqual(d);
    expect(lineas2.map((l) => [l.lineaId, l.veredicto])).toEqual(
      lineas.map((l) => [l.lineaId, l.veredicto])
    );
    expect(payloadDeConfirmacion(lineas2, d2)).toEqual(payloadAntesDeCerrar);

    // Decidir (incluido ignorar) no crea movimientos ni mueve el saldo.
    expect(stores.movements).toHaveLength(0);
    expect(saldo42()).toBe(saldoAntes);
    // Y las filas ignoradas dicen «silenciada» · siguen pendientes (§29).
    const ignoradas = stores.lineasExtracto.filter((l) => d.ignorados.has(l.id));
    expect(ignoradas.map((l) => l.atencion)).toEqual(['silenciada', 'silenciada']);
    expect(ignoradas.map((l) => l.estado)).toEqual(['pendiente', 'pendiente']);
  });

  it('8d. descartar el lote borra sus líneas · deja de estar a medias · el saldo vuelve a cero', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    expect(stores.lineasExtracto).toHaveLength(14);
    expect(saldo42()).not.toBe(0);
    expect(await lotesAMedias()).toHaveLength(1);

    const { removed } = await cancelImportBatch(res.importBatchId);

    // Nada que borrar en `movements`: no había nacido ninguno.
    expect(removed).toBe(0);
    expect(stores.movements).toHaveLength(0);
    expect(stores.lineasExtracto).toHaveLength(0);
    expect(stores.importBatches).toHaveLength(0);
    expect(await lotesAMedias()).toHaveLength(0);
    expect(saldo42()).toBe(0);
  });

  it('8e. E1.5-previo · descartar el lote borra los movimientos nacidos en la sesión y limpia sus fichas', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const [gastoL, mejoraL, recurrenteL] = stores.lineasExtracto.filter((l) => l.importe < 0);

    // Lo que hace la ficha a mitad de sesión · con los servicios REALES · desde la LÍNEA.
    const gasto = await gastoDesdeMovimiento({
      lineaId: gastoL.id,
      inmuebleId: 4,
      concepto: 'Luz Tenderina',
      importe: gastoL.importe,
      fecha: gastoL.fechaOperacion,
      categoryKey: 'inmueble.suministros',
      hoy: '2026-09-04',
    });
    expect(gasto.resultado).toBe('creada');
    await mejoraDesdeMovimiento({
      lineaId: mejoraL.id,
      inmuebleId: 4,
      concepto: 'Derrama fachada',
      importe: mejoraL.importe,
      fecha: mejoraL.fechaOperacion,
    });
    // Una fila de gasto que YA existía (la del recurrente) y la sesión solo cerró.
    const db = await initDB();
    const { movement: recurrenteMov } = await materializarLinea(db as never, recurrenteL.id, NOW, 'a_mano');
    stores.gastosInmueble.push({
      id: 900, inmuebleId: 4, ejercicio: 2026, fecha: recurrenteMov.date, concepto: 'Comunidad', categoria: 'comunidad',
      casillaAEAT: '0109', importe: 45.23, origen: 'recurrente', origenId: 'recurrente-7-2026-4',
      estado: 'confirmado', estadoTesoreria: 'confirmed', movimientoId: String(recurrenteMov.id), fechaValor: recurrenteMov.date,
      cuentaBancaria: '42', createdAt: '', updatedAt: '',
    });
    // Tres movimientos han nacido en la sesión, todos del lote.
    expect(stores.movements).toHaveLength(3);
    expect(stores.movements.every((m) => m.importBatch === res.importBatchId)).toBe(true);
    // Y una ficha de OTRO movimiento, ajena al lote · no se toca.
    stores.movements.push({ id: 5000, accountId: 42, date: '2026-03-01', amount: -80, description: 'otro', source: 'manual' } as any);
    stores.gastosInmueble.push({ id: 901, inmuebleId: 4, ejercicio: 2026, fecha: '2026-03-01', concepto: 'Ajeno', categoria: 'suministro', casillaAEAT: '0113', importe: 80, origen: 'tesoreria', estado: 'confirmado', movimientoId: '5000', createdAt: '', updatedAt: '' });
    stores.mejorasInmueble.push({ id: 902, inmuebleId: 4, ejercicio: 2026, descripcion: 'Ajena', tipo: 'mejora', importe: 80, fecha: '2026-03-01', movimientoId: 5000, createdAt: '', updatedAt: '' });
    expect(stores.gastosInmueble).toHaveLength(3);
    expect(stores.mejorasInmueble).toHaveLength(2);

    const { removed, fichas } = await cancelImportBatch(res.importBatchId);

    expect(removed).toBe(3);
    expect(fichas).toEqual({ gastosBorrados: 1, gastosDesenlazados: 1, mejorasBorradas: 1 });
    // Nada apunta a un movimiento que ya no existe.
    const vivos = new Set(stores.movements.map((m) => m.id));
    const huerfanas = (filas: any[]) =>
      filas.filter((f) => f.movimientoId != null && !vivos.has(Number(f.movimientoId))).map((f) => f.id);
    expect(huerfanas(stores.gastosInmueble)).toEqual([]);
    expect(huerfanas(stores.mejorasInmueble)).toEqual([]);
    // La del recurrente sobrevive, desenlazada y otra vez prevista.
    const recurrente = stores.gastosInmueble.find((g) => g.id === 900);
    expect(recurrente).toMatchObject({ origen: 'recurrente', estado: 'previsto', estadoTesoreria: 'predicted', importe: 45.23 });
    expect(recurrente.movimientoId).toBeUndefined();
    expect(recurrente.cuentaBancaria).toBeUndefined();
    // Las ajenas al lote, intactas.
    expect(stores.gastosInmueble.map((g) => g.id).sort()).toEqual([900, 901]);
    expect(stores.mejorasInmueble.map((m) => m.id)).toEqual([902]);
    expect(stores.movements.map((m) => m.id)).toEqual([5000]);
    expect(stores.lineasExtracto).toHaveLength(0);
  });
});

// ─── E1.5 · el saldo por cada camino de resolución · y las minas ───────────
//
// Antes del corte el saldo sumaba los movimientos que el import creaba. Ahora
// suma la línea mientras no tiene movimiento y el movimiento en cuanto nace:
// resolver NUNCA mueve el saldo, sea por el camino que sea.
describe('E1.5 · el corte · saldo y minas', () => {
  const SALDO_LOTE = redondea(7 * 380 - 7 * 45.23);

  it('9a. tras importar, el saldo es la suma de las líneas · sin ningún movimiento', async () => {
    await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    expect(stores.movements).toHaveLength(0);
    expect(redondea(saldo42())).toBe(SALDO_LOTE);
  });

  it('9b. gasto desde la LÍNEA (ficha) · nace el movimiento con id propio (M1) · la ficha le apunta (M6) · saldo quieto · idempotente', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const linea = stores.lineasExtracto.find((l) => l.importe < 0)!;

    const gasto = await gastoDesdeMovimiento({
      lineaId: linea.id,
      inmuebleId: 4,
      concepto: 'Luz',
      importe: linea.importe,
      fecha: linea.fechaOperacion,
      categoryKey: 'inmueble.suministros',
      hoy: '2026-09-04',
    });

    expect(gasto.resultado).toBe('creada');
    expect(stores.movements).toHaveLength(1);
    const mov = stores.movements[0];
    // M1 · el movimiento NO se escribe con el id de la línea: lo asigna el store
    // (aquí el 1, que en `lineasExtracto` es OTRA línea del lote).
    expect(mov.id).toBe(1);
    expect(linea.id).not.toBe(1);
    // La ficha le pone su concepto; el importe, la fecha y el lote son los de la línea.
    expect(mov).toMatchObject({ amount: linea.importe, date: linea.fechaOperacion, importBatch: res.importBatchId });
    // La línea enlaza a su movimiento · a mano.
    expect(stores.lineasExtracto.find((l) => l.id === linea.id)).toMatchObject({
      movementIds: [1], estado: 'resuelta', comoSeResolvio: 'a_mano',
    });
    // M6 · la ficha apunta al movimiento nacido, no a la línea.
    expect(stores.gastosInmueble[0].movimientoId).toBe(String(mov.id));
    // El saldo no se ha movido.
    expect(redondea(saldo42())).toBe(SALDO_LOTE);

    // Repetir sobre la misma línea no hace nacer otro movimiento.
    await gastoDesdeMovimiento({
      lineaId: linea.id, inmuebleId: 4, concepto: 'Luz', importe: linea.importe,
      fecha: linea.fechaOperacion, categoryKey: 'inmueble.suministros', hoy: '2026-09-04',
    });
    expect(stores.movements).toHaveLength(1);
    expect(redondea(saldo42())).toBe(SALDO_LOTE);
  });

  it('9c. traspaso desde la LÍNEA · nacen las dos patas con el lote (M10) · la línea enlaza SOLO la suya (D2) · idempotente · se van con el lote', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const linea = stores.lineasExtracto.find((l) => l.importe < 0)!;
    const saldo7Antes = saldo42(7);

    const { movementId, movementIdDestino } = await convertirLineaEnTraspaso(linea.id, 7);

    expect(stores.movements).toHaveLength(2);
    const salida = stores.movements.find((m) => m.id === movementId)!;
    const entrada = stores.movements.find((m) => m.id === movementIdDestino)!;
    expect(salida).toMatchObject({ accountId: 42, amount: linea.importe, categoryKey: 'traspaso_salida', importBatch: res.importBatchId });
    expect(entrada).toMatchObject({ accountId: 7, amount: -linea.importe, categoryKey: 'traspaso_entrada', importBatch: res.importBatchId, source: 'manual' });
    expect(salida.transferMetadata?.pairMovementId).toBe(movementIdDestino);
    // D2 · solo la pata de ESTA cuenta.
    expect(stores.lineasExtracto.find((l) => l.id === linea.id)?.movementIds).toEqual([movementId]);
    // El saldo de la cuenta del extracto no se mueve · el de destino sube.
    expect(redondea(saldo42())).toBe(SALDO_LOTE);
    expect(saldo42(7)).toBe(saldo7Antes - linea.importe);

    // Reintentar (Guardar que falló a medias) no duplica nada.
    const otraVez = await convertirLineaEnTraspaso(linea.id, 7);
    expect(otraVez).toEqual({ movementId, movementIdDestino });
    expect(stores.movements).toHaveLength(2);

    // M10 · «salir sin guardar» se lleva las dos patas.
    const { removed } = await cancelImportBatch(res.importBatchId);
    expect(removed).toBe(2);
    expect(stores.movements).toHaveLength(0);
    expect(saldo42(7)).toBe(saldo7Antes);
  });

  it('9d. M4 · un extracto SOLAPADO se deduplica contra las líneas pendientes · solo entra lo nuevo', async () => {
    await processFile(new File(['mock'], 'abril.xlsx'), { accountId: 42 });
    const saldoAbril = saldo42();

    // El siguiente fichero repite las tres primeras líneas y trae una nueva.
    const solapado = [...makeParsed(3), { date: new Date('2026-04-30T00:00:00Z'), amount: -9.99, description: 'NUEVO CARGO' }];
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({ success: true, movements: solapado, metadata: {} })),
    }));

    const segundo = await processFile(new File(['mock-2'], 'mayo.xlsx'), { accountId: 42 });

    expect(segundo.lineasImportadas).toBe(1);
    expect(segundo.duplicatesSkipped).toBe(3);
    expect(stores.movements).toHaveLength(0);
    const delSegundo = stores.lineasExtracto.filter((l) => l.importBatchId === segundo.importBatchId);
    expect(delSegundo.map((l) => l.descarte)).toEqual(['duplicada', 'duplicada', 'duplicada', undefined]);
    // Solo el cargo nuevo ha entrado al saldo.
    expect(redondea(saldo42())).toBe(redondea(saldoAbril - 9.99));
  });

  it('9e. ignorar no crea movimiento y es reversible · la línea sigue sumando hasta que se resuelve', async () => {
    await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const linea = stores.lineasExtracto[13];

    await confirmDecisions('x', { approvedMatches: [], ignoredLineaIds: [linea.id] });

    expect(stores.movements).toHaveLength(0);
    const tras = stores.lineasExtracto.find((l) => l.id === linea.id)!;
    expect(tras).toMatchObject({ atencion: 'silenciada', estado: 'pendiente', movementIds: [] });
    expect(esLineaHuerfana(tras)).toBe(true);
    expect(redondea(saldo42())).toBe(SALDO_LOTE);

    // Reversible: más tarde se resuelve y nace su movimiento · el saldo sigue igual.
    const db = await initDB();
    const { movement, nuevo } = await materializarLinea(db as never, linea.id, NOW, 'a_mano');
    expect(nuevo).toBe(true);
    expect(stores.movements).toHaveLength(1);
    expect(stores.lineasExtracto.find((l) => l.id === linea.id)?.movementIds).toEqual([movement.id]);
    expect(redondea(saldo42())).toBe(SALDO_LOTE);
  });

  it('9f. reconocido contra los libros (determinista) · nace por el motor · un cuadre no se pisa', async () => {
    stores.lineasExtracto.push(
      lineaPendiente({ id: 1, fecha: '2026-04-05', importe: -612.4, texto: 'RECIBO PRESTAMO 1234' }),
      lineaPendiente({ id: 2, fecha: '2026-04-22', importe: 380, texto: 'RENTA' }),
    );
    nextLineaId = 3;
    stores.treasuryEvents.push(
      { id: 1000, type: 'income', amount: 380, predictedDate: '2026-04-22', description: 'Renta', sourceType: 'contract', status: 'predicted', accountId: 42, categoryKey: 'inmueble.alquiler', createdAt: '', updatedAt: '' },
    );
    const saldoAntes = saldo42();
    const origen = { fuente: 'prestamo' as any, origenId: 'p-1', piezaId: '7', titulo: 'Cuota 7/240', como: 'importe_y_dia' as any };

    await confirmDecisions('batch-A', {
      approvedMatches: [{ lineaId: 2, treasuryEventId: 1000 }],
      approvedDeterministic: [{ lineaId: 1, ...origen }, { lineaId: 2, ...origen }],
      ignoredLineaIds: [],
    });

    expect(stores.movements).toHaveLength(2);
    const delPrestamo = stores.movements.find((m) => m.description === 'RECIBO PRESTAMO 1234')!;
    // El cierre determinista recibió el movimiento RECIÉN NACIDO de la línea 1,
    // y solo ese: la línea 2 ya cuadró con su previsto y no se pisa.
    expect((aplicarReconocimiento as jest.Mock).mock.calls.map((c) => c[1].movementId)).toEqual([delPrestamo.id]);
    expect(stores.lineasExtracto.find((l) => l.id === 1)).toMatchObject({
      movementIds: [delPrestamo.id], estado: 'resuelta', comoSeResolvio: 'motor',
    });
    expect(stores.lineasExtracto.find((l) => l.id === 2)?.comoSeResolvio).toBe('confirmada');
    expect(redondea(saldo42())).toBe(redondea(saldoAntes));
  });
});
