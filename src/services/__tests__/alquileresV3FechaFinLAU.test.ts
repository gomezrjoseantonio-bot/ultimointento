// V78.1 (Extra 1 · LAU 5 años) · tests de la regla de fechaFin para contratos AEAT.
//
// Cubre:
//   · calcularFechaFinLAUImport: +5y si futuro, sentinel si el resultado cae en el pasado
//   · recalcularFechaFinContratosAEAT: solo habitual + fuente xml_aeat + indefinido; respeta
//     contratos manuales, temporada, y fechas ya concretas; idempotente.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  calcularFechaFinLAUImport,
  FECHA_FIN_INDEFINIDO,
} from '../contractService';

const DB_NAME = 'AtlasHorizonDB';
const HOY = new Date('2026-05-30T00:00:00Z');

async function seedContracts(contracts: any[]) {
  const db = await openDB(DB_NAME, 78, {
    upgrade(db) {
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const c of contracts) await db.put('contracts', c);
  return db;
}

const aeat = (año: number) => ({ [año]: { estado: 'declarado', fuente: 'xml_aeat', dias: 365, importeDeclarado: 12000 } });

describe('calcularFechaFinLAUImport · regla +5y solo si futuro', () => {
  it('inicio reciente → inicio+5y (cae en el futuro)', () => {
    expect(calcularFechaFinLAUImport('2024-03-15', HOY)).toBe('2029-03-15');
  });
  it('inicio antiguo → +5y caería en el pasado → sentinel indefinido', () => {
    expect(calcularFechaFinLAUImport('2019-01-01', HOY)).toBe(FECHA_FIN_INDEFINIDO);
  });
  it('borde: +5y == hoy NO es futuro → indefinido', () => {
    expect(calcularFechaFinLAUImport('2021-05-30', HOY)).toBe(FECHA_FIN_INDEFINIDO);
  });
});

describe('recalcularFechaFinContratosAEAT · alcance y idempotencia', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('recalcula solo habitual+AEAT+indefinido con inicio futuro; respeta el resto', async () => {
    await seedContracts([
      // 1) habitual AEAT, inicio 2024 → debe pasar a 2029-06-01
      { id: 1, modalidad: 'habitual', fechaInicio: '2024-06-01', fechaFin: FECHA_FIN_INDEFINIDO, ejerciciosFiscales: aeat(2024) },
      // 2) habitual AEAT pero inicio antiguo → sigue indefinido (no-op)
      { id: 2, modalidad: 'habitual', fechaInicio: '2018-01-01', fechaFin: FECHA_FIN_INDEFINIDO, ejerciciosFiscales: aeat(2018) },
      // 3) habitual MANUAL indefinido → NO se toca (sin fuente xml_aeat)
      { id: 3, modalidad: 'habitual', fechaInicio: '2024-06-01', fechaFin: FECHA_FIN_INDEFINIDO, ejerciciosFiscales: {} },
      // 4) temporada AEAT → NO se toca
      { id: 4, modalidad: 'temporada', fechaInicio: '2024-06-01', fechaFin: FECHA_FIN_INDEFINIDO, ejerciciosFiscales: aeat(2024) },
      // 5) habitual AEAT con fecha ya concreta → NO se pisa
      { id: 5, modalidad: 'habitual', fechaInicio: '2024-06-01', fechaFin: '2027-12-31', ejerciciosFiscales: aeat(2024) },
    ]);

    const { recalcularFechaFinContratosAEAT } = require('../alquileresV3FixService');
    const db = await openDB(DB_NAME, 78);

    const n = await recalcularFechaFinContratosAEAT(db, HOY);
    expect(n).toBe(1);

    expect((await db.get('contracts', 1)).fechaFin).toBe('2029-06-01');
    expect((await db.get('contracts', 1)).endDate).toBe('2029-06-01');
    expect((await db.get('contracts', 2)).fechaFin).toBe(FECHA_FIN_INDEFINIDO);
    expect((await db.get('contracts', 3)).fechaFin).toBe(FECHA_FIN_INDEFINIDO);
    expect((await db.get('contracts', 4)).fechaFin).toBe(FECHA_FIN_INDEFINIDO);
    expect((await db.get('contracts', 5)).fechaFin).toBe('2027-12-31');

    // Idempotente
    expect(await recalcularFechaFinContratosAEAT(db, HOY)).toBe(0);
  });
});
