// ¿Dónde vive este apunte y por qué está duplicado?
//
// Lo que estas pruebas fijan no es un cálculo, es un PUNTO CIEGO. Las dos
// auditorías de duplicados agrupan por clave de origen, así que sólo ven la
// misma previsión emitida dos veces. Un gasto dado de alta DOS VECES son dos
// orígenes, y cada uno emite una previsión impecable: los dos informes dicen
// «0 duplicados» mientras el dinero se cuenta dos veces. Aquí se comprueba
// justamente ese caso, porque es el que deja al usuario sin nada a lo que
// agarrarse.

import {
  buscarApunte,
  cargosCruzados,
  eventosHuerfanos,
  gastosRepetidos,
} from '../__buscarApunteAudit';
import { analizarDuplicados } from '../duplicadosPrevisionService';
import type { TreasuryEvent } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

// Doble en memoria de los cuatro stores que barre la utilidad.
const stores: Record<string, unknown[]> = {
  compromisosRecurrentes: [],
  treasuryEvents: [],
  movements: [],
  gastosInmueble: [],
};

jest.mock('../db', () => ({
  initDB: async () => ({
    getAll: async (store: string) => stores[store] ?? [],
  }),
}));

beforeEach(() => {
  stores.compromisosRecurrentes = [];
  stores.treasuryEvents = [];
  stores.movements = [];
  stores.gastosInmueble = [];
});

const gasto = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Seguro de vida',
    tipo: 'seguro',
    subtipo: 'vida',
    proveedor: { nombre: 'ING' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 32.5 },
    cuentaCargo: 7,
    conceptoBancario: '',
    metodoPago: 'domiciliacion',
    categoria: 'salud',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente;

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 7,
    type: 'expense',
    amount: -32.5,
    predictedDate: '2026-08-01',
    description: 'Seguro de vida',
    sourceType: 'gasto_recurrente',
    sourceId: 1,
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('el duplicado que las otras auditorías no pueden ver', () => {
  it('dos altas del mismo seguro · los informes de previsiones dicen que todo está bien', () => {
    // Cada gasto emite UNA previsión en agosto. Por separado son correctas: no
    // hay ninguna clave de origen repetida, porque el `sourceId` difiere.
    const eventos = [
      ev({ id: 10, sourceId: 1 }),
      ev({ id: 11, sourceId: 2 }),
    ];

    expect(analizarDuplicados(eventos).grupos).toHaveLength(0);
    expect(analizarDuplicados(eventos).copiasSobrantes).toBe(0);
  });

  it('…y sin embargo el seguro está dado de alta dos veces', async () => {
    stores.compromisosRecurrentes = [gasto({ id: 1 }), gasto({ id: 2 })];
    stores.treasuryEvents = [ev({ id: 10, sourceId: 1 }), ev({ id: 11, sourceId: 2 })];

    const repetidos = await gastosRepetidos();

    expect(repetidos).toHaveLength(1);
    expect(repetidos[0].ids).toEqual([1, 2]);
    // Y dice cuánto se está contando de más: una previsión viva por cada alta.
    expect(repetidos[0].previsionesPorId).toEqual({ 1: 1, 2: 1 });
  });

  it('el alias con otra grafía sigue siendo el mismo gasto', async () => {
    // El alta a mano y la que detecta el extracto no escriben igual. Agrupar
    // por el texto crudo dejaría fuera justo el caso que hay que encontrar.
    stores.compromisosRecurrentes = [
      gasto({ id: 1, alias: 'Seguro de vida' }),
      gasto({ id: 2, alias: 'SEGURO  DE VIDA' }),
    ];

    expect(await gastosRepetidos()).toHaveLength(1);
  });

  it('un importe distinto NO es el mismo gasto', async () => {
    stores.compromisosRecurrentes = [
      gasto({ id: 1 }),
      gasto({ id: 2, importe: { modo: 'fijo', importe: 41 } as CompromisoRecurrente['importe'] }),
    ];

    expect(await gastosRepetidos()).toHaveLength(0);
  });

  it('una baja seguida de un alta nueva es una sustitución, no un duplicado', async () => {
    // Cambiar de compañía se hace así · marcarlo como duplicado empujaría a
    // borrar el histórico que sostiene la deducción.
    stores.compromisosRecurrentes = [gasto({ id: 1, estado: 'baja' }), gasto({ id: 2 })];

    expect(await gastosRepetidos()).toHaveLength(0);
  });
});

describe('dónde se ve cada cosa', () => {
  it('un gasto personal NO se ve en la ficha del inmueble', async () => {
    // Es la trampa del seguro de vida: se da de alta desde la pestaña del
    // inmueble y se guarda en personal · sólo lo dijo un toast.
    stores.compromisosRecurrentes = [gasto({ id: 1, ambito: 'personal' })];

    const [hit] = await buscarApunte('seguro de vida');

    expect(hit.store).toBe('compromisosRecurrentes');
    expect(hit.pantalla).toBe('Personal › Gastos');
  });

  it('un gasto de inmueble se localiza en la ficha de ESE inmueble', async () => {
    stores.compromisosRecurrentes = [
      gasto({ id: 1, ambito: 'inmueble', inmuebleId: 4, personalDataId: undefined }),
    ];

    const [hit] = await buscarApunte('seguro');

    expect(hit.pantalla).toContain('inmueble 4');
  });

  it('un preparado se dice en qué grupo cae · si no, parece que no está', async () => {
    stores.compromisosRecurrentes = [gasto({ id: 1, estado: 'preparado' })];

    const [hit] = await buscarApunte('seguro');

    expect(hit.pantalla).toContain('Preparados');
  });

  it('un evento descartado no se pinta en ninguna pantalla', async () => {
    stores.treasuryEvents = [ev({ id: 10, descartado: true })];

    const [hit] = await buscarApunte('seguro');

    expect(hit.pantalla).toBeNull();
    expect(hit.porQue).toContain('DESCARTADO');
  });

  it('se busca sin acentos y sin mayúsculas · «ING» encuentra al proveedor', async () => {
    stores.compromisosRecurrentes = [gasto({ id: 1, proveedor: { nombre: 'ING' } })];

    expect(await buscarApunte('ing')).toHaveLength(1);
  });
});

describe('el mismo cargo emitido por dos motores distintos', () => {
  it('el recibo de la tarjeta y el cargo propio del gasto se señalan juntos', async () => {
    // Mover un gasto de tarjeta de crédito a domiciliación deja el recibo viejo
    // con ese importe dentro y además el gasto empieza a emitir lo suyo.
    stores.treasuryEvents = [
      ev({ id: 10, sourceType: 'gasto_recurrente', sourceId: 1 }),
      ev({ id: 11, sourceType: 'tarjeta_recibo', sourceId: 'visa-2026-08', description: 'Recibo tarjeta Visa' }),
    ];

    const cruzados = await cargosCruzados();

    expect(cruzados).toHaveLength(1);
    expect(cruzados[0].origenes.map((o) => o.sourceType).sort()).toEqual([
      'gasto_recurrente',
      'tarjeta_recibo',
    ]);
  });

  it('dos eventos del MISMO origen no se repiten aquí · ya los cuentan las otras', async () => {
    stores.treasuryEvents = [ev({ id: 10 }), ev({ id: 11 })];

    expect(await cargosCruzados()).toHaveLength(0);
  });

  it('mismo importe en cuentas distintas no es el mismo cargo', async () => {
    stores.treasuryEvents = [
      ev({ id: 10, accountId: 7, sourceType: 'gasto_recurrente', sourceId: 1 }),
      ev({ id: 11, accountId: 9, sourceType: 'tarjeta_recibo', sourceId: 'visa' }),
    ];

    expect(await cargosCruzados()).toHaveLength(0);
  });
});

describe('eventos que sobreviven a su gasto', () => {
  it('un conciliado sigue contando aunque el gasto ya no exista', async () => {
    stores.compromisosRecurrentes = [];
    stores.treasuryEvents = [
      ev({ id: 10, sourceId: 99, status: 'executed', executedMovementId: 500 }),
    ];

    const [h] = await eventosHuerfanos();

    expect(h.id).toBe(10);
    expect(h.motivo).toContain('Conciliado');
  });

  it('si el gasto existe no hay huérfano', async () => {
    stores.compromisosRecurrentes = [gasto({ id: 1 })];
    stores.treasuryEvents = [ev({ id: 10, sourceId: 1 })];

    expect(await eventosHuerfanos()).toHaveLength(0);
  });
});
