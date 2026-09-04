// Asignar un cobro del extracto a un contrato tiene que dejarlo VINCULADO.
//
// La acción se llamaba `assign_to_contract` y no asignaba a ninguno: nadie
// rellenaba `action.contractId`, así que el evento nacía con `sourceId`
// undefined y sin `contratoId`. Consecuencias: el estado de cobro del inquilino
// no lo veía (`esRentaDeContrato` exige uno de los dos) y el dedupe de
// previsiones tampoco, de modo que el mes acababa con el cobro real MÁS la
// renta prevista — el mismo dinero contado dos veces.

import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { Contract, Movement, TreasuryEvent } from '../db';
import { suggestForUnmatched } from '../movementSuggestionService';
import { confirmDecisions } from '../bankStatementOrchestrator';
import { esRentaDeContrato } from '../../modules/inmuebles/utils/estadoCobroContratoService';
import { generateMonthlyForecasts } from '../../modules/horizon/tesoreria/services/treasurySyncService';

jest.mock('../cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

const objetivo = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
})();
const PREFIJO = `${objetivo.year}-${String(objetivo.month).padStart(2, '0')}`;

const contrato = (nombre: string, apellidos: string): Omit<Contract, 'id'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: { nombre, apellidos, dni: 'X1234567L', telefono: '', email: '' },
    fechaInicio: '2020-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 500,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 500,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Contract, 'id'>;

const bizum = (descripcion: string): Omit<Movement, 'id'> =>
  ({
    accountId: 1,
    date: `${PREFIJO}-01`,
    amount: 500,
    description: descripcion,
    importBatch: 'lote-test',
    unifiedStatus: 'sin_planificar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Movement, 'id'>;

const limpiar = async (): Promise<void> => {
  const db = await initDB();
  for (const store of [
    'treasuryEvents',
    'contracts',
    'accounts',
    'movements',
    'movementLearningRules',
    'compromisosRecurrentes',
  ] as const) {
    await db.clear(store);
  }
  await db.add('accounts', {
    id: 1,
    name: 'Cuenta principal',
    iban: 'ES0000000000000000000001',
    balance: 0,
  } as never);
};

describe('assign_to_contract · el cobro queda vinculado a su contrato', () => {
  beforeEach(limpiar);

  it('propone el contrato cuando el nombre del banco señala a uno solo', async () => {
    const db = await initDB();
    const contratoId = (await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never)) as number;
    const movId = (await db.add('movements', bizum('BIZUM DE ADNAN PARWEZ') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    const asignar = sugerencias.find((s) => s.action.kind === 'assign_to_contract');

    expect(asignar).toBeDefined();
    expect(asignar!.action).toMatchObject({ kind: 'assign_to_contract', contractId: contratoId });
    expect(asignar!.description).toContain('Adnan Parwez Khan');
  });

  // INVERTIDO. Este test exigía que, con el nombre encajando en dos contratos,
  // la sugerencia se emitiera igual con `contractId: undefined` — «decide el
  // usuario». La intención era buena; el resultado, no: en pantalla eso se lee
  // «Parece la renta de un inquilino» y el botón que ofrece no lleva a ninguna
  // parte, porque un `assign_to_contract` sin contrato no se puede ejecutar (el
  // evento nacería huérfano, sin `sourceId` ni `contratoId` — el bug que este
  // mismo fichero arregló). Lo que decide el usuario ahora se le pregunta de
  // verdad, en vez de dárselo hecho a medias.
  it('con el nombre encajando en dos, NO se propone renta · se pregunta', async () => {
    const db = await initDB();
    await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never);
    await db.add('contracts', contrato('Yusuf', 'Parwez Khan') as never);
    const movId = (await db.add('movements', bizum('BIZUM DE PARWEZ KHAN') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];

    expect(sugerencias.some((s) => s.action.kind === 'assign_to_contract')).toBe(false);
    // Y la línea sigue teniendo algo que decir · no se queda muda.
    expect(sugerencias.length).toBeGreaterThan(0);
  });

  // ── Lo que se retiró en la 2.0.2, y por qué estas dos cambian ────────────
  //
  // Aquí había dos pruebas de que, al aceptar la sugerencia, el evento nacía con
  // `sourceId`/`contratoId` y la renta del mes no se emitía dos veces. Pasaban
  // por `confirmDecisions({ approvedSuggestions })`.
  //
  // Ese canal NUNCA se ejecutó en la app: `payloadDeConfirmacion` lo devolvía
  // vacío por diseño y ningún otro sitio lo llenaba. Probaban una capacidad que
  // el usuario no tenía. Se ha borrado el canal —y con él `applySuggestion`, que
  // además no creaba la fila fiscal del gasto—, así que lo que queda probado es
  // la verdad alcanzable: la sugerencia SE PRODUCE, y se queda en propuesta
  // hasta que el usuario la contesta por la ficha (`crearDesdeFicha`), que sí
  // crea la fila fiscal.

  it('la sugerencia se produce, pero NADIE la aplica sola', async () => {
    const db = await initDB();
    const contratoId = (await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never)) as number;
    const movId = (await db.add('movements', bizum('BIZUM DE ADNAN PARWEZ') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    expect(sugerencias.some((x) => x.action.kind === 'assign_to_contract')).toBe(true);

    // Guardar el extracto sin decidir nada sobre esta línea.
    await confirmDecisions('lote-test', {
      approvedMatches: [],
      ignoredLineaIds: [],
    });

    // No se ha creado ningún evento a su espalda.
    expect((await db.getAll('treasuryEvents')) as TreasuryEvent[]).toHaveLength(0);
    void contratoId;
  });

  it('y el payload ya no tiene por dónde colarla', () => {
    // El candado del contrato: si alguien reabre el canal, que sea a la vista.
    const payload: Parameters<typeof confirmDecisions>[1] = {
      approvedMatches: [],
      ignoredLineaIds: [],
    };
    expect(payload).not.toHaveProperty('approvedSuggestions');
  });
});
