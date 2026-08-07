// Editar un préstamo tiene que rehacer sus previsiones de tesorería.
//
// Antes no pasaba: `treasurySyncService` calcula bien, pero nadie lo disparaba
// desde Inversiones, así que en Tesorería se quedaba la previsión anterior con
// el importe y la cuenta viejos. Estos tests recorren el ciclo real —generar,
// editar, regenerar— sobre IndexedDB.

import 'fake-indexeddb/auto';
import { initDB } from '../services/db';
import { generateMonthlyForecasts } from '../modules/horizon/tesoreria/services/treasurySyncService';
import type { TreasuryEvent } from '../services/db';

jest.mock('../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

/** Mes objetivo · dos meses por delante, para caer siempre en el futuro. */
const objetivo = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
})();
const PREFIJO = `${objetivo.year}-${String(objetivo.month).padStart(2, '0')}`;

/** Préstamo francés cuyo primer cobro cae el día 1 del mes objetivo. */
const prestamo = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Préstamo socio',
  tipo: 'prestamo_p2p',
  entidad: 'Unihouser',
  valor_actual: 30000,
  total_aportado: 30000,
  aportaciones: [],
  rentabilidad_euros: 0,
  rentabilidad_porcentaje: 0,
  fecha_valoracion: `${PREFIJO}-01T12:00:00.000Z`,
  fecha_compra: `${PREFIJO}-01T12:00:00.000Z`,
  duracion_meses: 60,
  modalidad_devolucion: 'capital_e_intereses',
  frecuencia_cobro: 'mensual',
  retencion_fiscal: 19,
  cuenta_cargo_id: 1,
  cuenta_cobro_id: 1,
  rendimiento: {
    tipo_rendimiento: 'interes_fijo',
    tasa_interes_anual: 3.25,
    frecuencia_pago: 'mensual',
    cuenta_destino_id: 1,
    meses_cobro: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    dia_cobro: 1,
    fecha_primer_cobro: `${PREFIJO}-01T12:00:00.000Z`,
    fecha_inicio_rendimiento: `${PREFIJO}-01T12:00:00.000Z`,
    retencion_porcentaje: 19,
    reinvertir: false,
    pagos_generados: [],
  },
  activo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...extra,
});

const eventosDelPrestamo = async (posId: number): Promise<TreasuryEvent[]> => {
  const db = await initDB();
  const todos = await db.getAll('treasuryEvents');
  return todos.filter(
    (e) => (e as { sourceType?: string }).sourceType === 'inversion_rendimiento'
      && (e as { sourceId?: number }).sourceId === posId,
  );
};

/** Emula el wipe forward de `regenerateForecastsForward` antes de regenerar. */
const regenerar = async () => {
  const db = await initDB();
  const hoy = new Date();
  const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  for (const ev of await db.getAll('treasuryEvents')) {
    const e = ev as TreasuryEvent & { id?: number; executedMovementId?: number | null };
    if (
      e.status === 'predicted' &&
      e.descartado !== true &&
      e.executedMovementId == null &&
      typeof e.predictedDate === 'string' &&
      e.predictedDate >= desde &&
      e.id != null
    ) {
      await db.delete('treasuryEvents', e.id);
    }
  }
  await generateMonthlyForecasts(objetivo.year, objetivo.month);
};

describe('editar un préstamo · previsiones de tesorería', () => {
  let posId: number;

  beforeEach(async () => {
    const db = await initDB();
    for (const store of ['treasuryEvents', 'inversiones', 'accounts'] as const) {
      await db.clear(store);
    }
    await db.add('accounts', {
      id: 1,
      name: 'Cuenta principal',
      iban: 'ES0000000000000000000001',
      balance: 0,
    } as never);
    await db.add('accounts', {
      id: 2,
      name: 'Cuenta ahorro',
      iban: 'ES0000000000000000000002',
      balance: 0,
    } as never);
    posId = (await db.add('inversiones', prestamo() as never)) as number;
    await regenerar();
  });

  it('prevé la cuota completa en la cuenta de cobro, no solo los intereses', async () => {
    const [evento] = await eventosDelPrestamo(posId);
    expect(evento).toBeDefined();
    // 30.000 € al 3,25% · cuota 542,40 − 15,44 de retención ≈ 526,96 €.
    expect(evento.amount).toBeCloseTo(526.96, 1);
    expect(evento.accountId).toBe(1);
    expect(evento.description).toContain('Cuota préstamo');
  });

  it('al cambiar capital y cuenta rehace el importe y la cuenta, sin duplicar', async () => {
    const db = await initDB();
    const pos = (await db.get('inversiones', posId)) as Record<string, unknown>;
    await db.put('inversiones', {
      ...pos,
      valor_actual: 60000,
      total_aportado: 60000,
      cuenta_cobro_id: 2,
      rendimiento: {
        ...(pos.rendimiento as Record<string, unknown>),
        cuenta_destino_id: 2,
      },
    } as never);
    await regenerar();

    const eventos = await eventosDelPrestamo(posId);
    expect(eventos).toHaveLength(1);
    // El doble de capital · el doble de cuota.
    expect(eventos[0].amount).toBeCloseTo(1053.93, 0);
    expect(eventos[0].accountId).toBe(2);
  });

  it('borra la previsión si el préstamo deja de tener cuota ese mes', async () => {
    expect(await eventosDelPrestamo(posId)).toHaveLength(1);

    const db = await initDB();
    const pos = (await db.get('inversiones', posId)) as Record<string, unknown>;
    // Se acorta a una única cuota · el mes objetivo se queda sin nada.
    await db.put('inversiones', {
      ...pos,
      duracion_meses: 1,
      frecuencia_cobro: 'anual',
      modalidad_devolucion: 'al_vencimiento',
      rendimiento: {
        ...(pos.rendimiento as Record<string, unknown>),
        fecha_primer_cobro: `${objetivo.year - 1}-01-01T12:00:00.000Z`,
      },
    } as never);
    await regenerar();

    expect(await eventosDelPrestamo(posId)).toHaveLength(0);
  });

  it('no vuelve a prever una cuota que el usuario ya dio por cobrada', async () => {
    const db = await initDB();
    const pos = (await db.get('inversiones', posId)) as Record<string, unknown>;
    const rend = pos.rendimiento as Record<string, unknown>;
    await db.put('inversiones', {
      ...pos,
      rendimiento: {
        ...rend,
        pagos_generados: [
          {
            id: 1,
            fecha_pago: `${PREFIJO}-01`,
            importe_bruto: 81.25,
            retencion_fiscal: 15.44,
            importe_neto: 526.96,
            cuenta_destino_id: 1,
            estado: 'pagado',
          },
        ],
      },
    } as never);
    await regenerar();

    // Ese dinero ya está en el saldo del banco · preverlo lo contaría dos veces.
    expect(await eventosDelPrestamo(posId)).toHaveLength(0);
  });

  it('respeta una previsión ya conciliada · no la pisa ni la borra', async () => {
    const db = await initDB();
    const [evento] = await eventosDelPrestamo(posId);
    await db.put('treasuryEvents', {
      ...evento,
      status: 'executed',
      executedMovementId: 99,
    } as never);

    const pos = (await db.get('inversiones', posId)) as Record<string, unknown>;
    await db.put('inversiones', { ...pos, valor_actual: 60000 } as never);
    await regenerar();

    const eventos = await eventosDelPrestamo(posId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].status).toBe('executed');
    // Sigue con el importe real conciliado, no con el recalculado.
    expect(eventos[0].amount).toBeCloseTo(526.96, 1);
  });
});
