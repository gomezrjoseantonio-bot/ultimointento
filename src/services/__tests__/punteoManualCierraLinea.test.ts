// El OTRO camino · puntear a mano una previsión de gasto recurrente
//
// `importacionCierraLinea.test.ts` fija que SUBIR EL EXTRACTO cierra la línea
// fiscal en vez de duplicarla. Esto comprueba lo mismo por el camino que no se
// migró al módulo de cierre: `confirmTreasuryEvent`.
//
// Por qué importa · una línea nacida de un compromiso recurrente se escribe con
// `origen:'recurrente'` + `origenId` y SIN `treasuryEventId`
// (`operacionFiscalService:344` · lo recuerda `altaMovimientoService:425`). Los
// tres caminos que cierran un gasto la buscan de forma distinta:
//
//   · subir extracto  → `cerrarLineaDeGastoDelEvento` · por `treasuryEventId` Y
//                       por `origen`+`origenId`
//   · anotar a mano   → `gastoDesdeMovimiento` · por el índice `origen-origenId`
//   · puntear         → `findLineByTreasuryEventId` · SOLO por `treasuryEventId`
//
// El tercero no puede encontrar una línea que aún no tiene `treasuryEventId`, y
// al no encontrarla cae a la rama `add` (`treasuryConfirmationService:445`). El
// daño es el que describe `altaMovimientoService:423-428`: «su gasto ya tiene
// fila del mes … Crear otra lo contaría dos veces en la declaración».
//
// Contra una base real (fake-indexeddb), no contra un doble: lo que se está
// comprobando es justamente la búsqueda, y un doble la daría por buena.

import { initDB, TreasuryEvent } from '../db';
import { confirmTreasuryEvent } from '../treasuryConfirmationService';

const ACCOUNT_ID = 77;
const INMUEBLE_ID = 42;
const COMPROMISO_ID = 900;
const EJERCICIO = 2026;
const MES = 4;

/** La misma clave que arma `origenIdRecurrenteDeEvento` (cierreLineaInmueble:70). */
const ORIGEN_ID = `recurrente-${COMPROMISO_ID}-${EJERCICIO}-${MES}`;

/** La fila del mes que el generador de recurrentes ya dejó escrita. */
const lineaDelRecurrente = () => ({
  inmuebleId: INMUEBLE_ID,
  ejercicio: EJERCICIO,
  fecha: '2026-04-01',
  concepto: 'Comunidad',
  categoria: 'comunidad',
  casillaAEAT: '0109',
  importe: 60,
  origen: 'recurrente' as const,
  origenId: ORIGEN_ID,
  estado: 'previsto' as const,
  // Clave del caso · todavía NO ha pasado por ningún punteo.
  // treasuryEventId: undefined
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** La previsión de tesorería de ESE mismo recibo. */
const previsionDelRecurrente = (): Omit<TreasuryEvent, 'id'> =>
  ({
    type: 'expense',
    amount: 60,
    predictedDate: '2026-04-01',
    description: 'Comunidad',
    sourceType: 'gasto_recurrente',
    sourceId: COMPROMISO_ID,
    año: EJERCICIO,
    mes: MES,
    ambito: 'INMUEBLE',
    inmuebleId: INMUEBLE_ID,
    categoryLabel: 'Comunidad',
    accountId: ACCOUNT_ID,
    status: 'predicted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<TreasuryEvent, 'id'>;

describe('puntear a mano un recurrente · no debe duplicar la línea fiscal', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('treasuryEvents'),
      db.clear('movements'),
      db.clear('gastosInmueble'),
    ]);
  });

  it('la línea del recurrente se CIERRA · no nace una segunda', async () => {
    const db = await initDB();

    const lineaId = Number(await db.add('gastosInmueble', lineaDelRecurrente() as never));
    const eventId = Number(await db.add('treasuryEvents', previsionDelRecurrente() as never));

    await confirmTreasuryEvent(eventId);

    const todas = (await db.getAll('gastosInmueble')) as any[];

    // Un recibo, una línea. Dos filas serían el mismo gasto deducido dos veces.
    expect(todas).toHaveLength(1);

    // Y la que queda es la que ya existía, cerrada — no una nueva que la sustituya
    // dejando la vieja en `previsto` fuera de las casillas.
    const [linea] = todas;
    expect(linea.id).toBe(lineaId);
    expect(linea.estado).toBe('confirmado');
    expect(linea.treasuryEventId).toBe(eventId);
    // La clasificación del recurrente no se pierde al cerrar.
    expect(linea.casillaAEAT).toBe('0109');
  });
});
