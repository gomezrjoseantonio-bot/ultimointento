// ============================================================================
// E2.4.2-fix2 · Guardar materializa lo que el motor clasificó · con sus ejes
// ============================================================================
//
// La clasificación viajaba en la fila (`lineasExtracto.clasificacion`) y al
// Guardar nadie la usaba: la línea seguía «a resolver» aunque el motor supiera
// que «AHORROS» es un traspaso y «FINUTIVE» la gestoría. Ahora viaja como
// `resueltasPorConcepto` y la línea nace movimiento con los 4 ejes, por el
// mismo camino que una regla aprendida (`resolverPorRegla`).
// ============================================================================

import 'fake-indexeddb/auto';
import { initDB, type Movement } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import type { ClasificacionLinea } from '../clasificacion/tipos';
import { confirmDecisions } from '../confirmarDecisiones';

const CUENTA = 9;
const LOTE = 'lote-fix2';
const STORES = ['movements', 'movementLearningRules', 'lineasExtracto', 'gastosInmueble', 'compromisosRecurrentes'];

const GESTORIA: ClasificacionLinea = {
  naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria', ambito: 'personal',
  origen: { naturaleza: 'defecto', ambito: 'defecto', familia: 'concepto', subtipo: 'concepto' },
  motivos: ['«finutive» en el concepto'],
};
const AHORRO: ClasificacionLinea = {
  naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', sentido: 'sale', ambito: 'personal', metodo: 'transferencia',
  origen: { naturaleza: 'concepto', ambito: 'defecto', familia: 'concepto', subtipo: 'concepto', metodo: 'concepto' },
  motivos: ['«ahorro» en el concepto'],
};
const SOLO_SIGNO: ClasificacionLinea = {
  naturaleza: 'ingreso', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto' }, motivos: [],
};

function lineaBase(over: Partial<LineaExtractoPersistida> = {}): Omit<LineaExtractoPersistida, 'id'> {
  const ahora = '2025-08-25T00:00:00.000Z';
  return {
    fechaOperacion: '2025-08-12', fechaValor: '2025-08-12', importe: -29.04,
    conceptoLiteral: 'Y8CSFFT GC RE FINUTIVE', importBatchId: LOTE, accountId: CUENTA,
    hashLinea: `h-${Math.random()}`, hashMovement: `m-${Math.random()}`,
    estado: 'pendiente', movementIds: [], createdAt: ahora, updatedAt: ahora, ...over,
  };
}
async function nuevaLinea(over: Partial<LineaExtractoPersistida> = {}): Promise<number> {
  const d = await initDB();
  return Number(await d.add('lineasExtracto', lineaBase(over) as never));
}
async function linea(id: number): Promise<LineaExtractoPersistida> {
  return (await (await initDB()).get('lineasExtracto', id)) as LineaExtractoPersistida;
}
async function movimientoDe(id: number): Promise<Movement | undefined> {
  const l = await linea(id);
  const mid = l.movementIds?.[0];
  return mid == null ? undefined : ((await (await initDB()).get('movements', mid)) as Movement | undefined);
}

beforeEach(async () => {
  const d = await initDB();
  for (const s of STORES) {
    try { await d.clear(s as never); } catch { /* un store que no exista no bloquea el test */ }
  }
});

describe('E2.4.2-fix2 · resueltasPorConcepto', () => {
  it('un gasto clasificado por concepto nace movimiento con familia y subtipo · y con la huella del motor', async () => {
    const id = await nuevaLinea({ clasificacion: GESTORIA });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    const l = await linea(id);
    expect(l.movementIds).toHaveLength(1);
    expect(l.comoSeResolvio).toBe('motor');
    const m = await movimientoDe(id);
    expect(m).toMatchObject({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria', amount: -29.04, statusConciliacion: 'match_automatico' });
  });

  it('un traspaso por concepto nace movimiento interno · sabe qué es, no a dónde', async () => {
    const id = await nuevaLinea({ conceptoLiteral: 'AHORROS', importe: -800, clasificacion: AHORRO });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    const m = await movimientoDe(id);
    expect(m).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', amount: -800 });
    expect((await linea(id)).comoSeResolvio).toBe('motor');
  });

  it('una devolución (gasto en positivo) también nace con su familia · resta, no ingresa', async () => {
    const id = await nuevaLinea({ conceptoLiteral: '00000000X DDPP de la TGSS de ALICANTE', importe: 283.03, clasificacion: { ...GESTORIA, familia: 'cuota_reta', subtipo: undefined } });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    expect(await movimientoDe(id)).toMatchObject({ naturaleza: 'gasto', familia: 'cuota_reta', amount: 283.03 });
  });

  it('lo que solo tiene el signo NO se materializa aunque venga en el payload · red de seguridad', async () => {
    const id = await nuevaLinea({ conceptoLiteral: 'UNIHOUSER S.L.', importe: 1168.65, clasificacion: SOLO_SIGNO });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    expect((await linea(id)).movementIds).toHaveLength(0);
  });

  it('un gesto del usuario manda · la ignorada no se materializa', async () => {
    const id = await nuevaLinea({ clasificacion: GESTORIA });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [id], resueltasPorConcepto: [id] });
    const l = await linea(id);
    expect(l.movementIds).toHaveLength(0);
    expect(l.atencion).toBe('silenciada');
  });

  it('repetir el Guardar no duplica el movimiento', async () => {
    const id = await nuevaLinea({ clasificacion: GESTORIA });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], resueltasPorConcepto: [id] });
    expect((await linea(id)).movementIds).toHaveLength(1);
    expect(((await (await initDB()).getAll('movements')) as Movement[]).length).toBe(1);
  });
});
