// TAREA CC · GASTOS-RECURRENTES · Fase 4c — estados: preparado, baja, reactivación.
//
// Fija el comportamiento de §2.3 (los tres estados) y §2.4 (baja y
// reactivación) a nivel de servicio:
//   · apagar sin cargos cuadrados → preparado (sin fecha, sin previsiones)
//   · apagar con cargos → baja con fecha del último cobro (previsiones futuras
//     retiradas, ejecutados conservados)
//   · activar un preparado exige las cuatro cosas · nunca queda a medias
//   · reactivar solo si el motivo NO fue cambio de proveedor
import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import {
  crearCompromiso,
  darDeBajaCompromiso,
  pasarAPreparado,
  activarCompromiso,
  reactivarCompromiso,
  puedeReactivar,
  faltantesParaActivar,
  tieneCargosCuadrados,
  obtenerCompromiso,
} from './compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente> = {}): Omit<
  CompromisoRecurrente,
  'id' | 'createdAt' | 'updatedAt'
> =>
  ({
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Gimnasio',
    tipo: 'suscripcion',
    proveedor: { nombre: 'GymCo' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 40 },
    cuentaCargo: 0,
    conceptoBancario: 'GYMCO',
    metodoPago: 'domiciliacion',
    categoria: 'personal.suscripciones',
    bolsaPresupuesto: 'deseos',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    ...over,
  }) as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;

async function eventosDe(sourceId: number): Promise<TreasuryEvent[]> {
  const db = await initDB();
  const idx = db.transaction('treasuryEvents', 'readonly').objectStore('treasuryEvents').index('sourceId');
  return (await idx.getAll(sourceId)) as TreasuryEvent[];
}

/** Marca un evento del compromiso como ejecutado (cuadrado con un movimiento). */
async function marcarUnEventoEjecutado(sourceId: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  const store = tx.objectStore('treasuryEvents');
  const idx = store.index('sourceId');
  const evs = (await idx.getAll(sourceId)) as TreasuryEvent[];
  const uno = evs[0];
  if (uno) {
    uno.status = 'executed';
    uno.executedMovementId = 999;
    await store.put(uno);
  }
  await tx.done;
}

describe('estados · apagar sin cargos → preparado (§2.3)', () => {
  it('pasa a preparado, sin fecha de fin, y retira las previsiones', async () => {
    const c = await crearCompromiso(base());
    expect((await eventosDe(c.id)).length).toBeGreaterThan(0);

    const prep = await pasarAPreparado(c.id);
    expect(prep.estado).toBe('preparado');
    expect(prep.fechaFin).toBeUndefined();
    expect(prep.motivoBaja).toBeUndefined();
    // Preparado no se proyecta
    const pred = (await eventosDe(c.id)).filter((e) => e.status === 'predicted');
    expect(pred.length).toBe(0);
  });
});

describe('estados · apagar con cargos → baja con fecha (§2.4)', () => {
  it('detecta que tuvo cargos cuadrados', async () => {
    const c = await crearCompromiso(base());
    expect(await tieneCargosCuadrados(c.id)).toBe(false);
    await marcarUnEventoEjecutado(c.id);
    expect(await tieneCargosCuadrados(c.id)).toBe(true);
  });

  it('da de baja con fecha del último cobro · conserva ejecutados, retira previsiones', async () => {
    const c = await crearCompromiso(base());
    await marcarUnEventoEjecutado(c.id);

    const baja = await darDeBajaCompromiso(c.id, '2026-03-15', 'finContrato');
    expect(baja.estado).toBe('baja');
    expect(baja.fechaFin).toBe('2026-03-15');
    expect(baja.motivoBaja).toBe('finContrato');

    const evs = await eventosDe(c.id);
    // El ejecutado se conserva
    expect(evs.some((e) => e.status === 'executed')).toBe(true);
    // Las previsiones futuras se retiran
    expect(evs.some((e) => e.status === 'predicted')).toBe(false);
  });
});

describe('estados · activar un preparado exige las cuatro cosas (§2.3)', () => {
  it('faltantesParaActivar detecta el importe ausente', async () => {
    const c = await crearCompromiso(
      base({ estado: 'preparado', importe: { modo: 'fijo', importe: 0 } } as Partial<CompromisoRecurrente>),
    );
    const faltan = faltantesParaActivar((await obtenerCompromiso(c.id))!);
    expect(faltan.importe).toBe(true);
    expect(faltan.primerCobro).toBe(false);
  });

  it('no activa a medias: sin importe válido lanza y el estado NO cambia', async () => {
    const c = await crearCompromiso(
      base({ estado: 'preparado', importe: { modo: 'fijo', importe: 0 } } as Partial<CompromisoRecurrente>),
    );
    await expect(activarCompromiso(c.id)).rejects.toThrow(/activar/i);
    expect((await obtenerCompromiso(c.id))!.estado).toBe('preparado');
  });

  it('con las cuatro cosas activa y regenera previsiones', async () => {
    const c = await crearCompromiso(
      base({ estado: 'preparado', importe: { modo: 'fijo', importe: 0 } } as Partial<CompromisoRecurrente>),
    );
    const act = await activarCompromiso(c.id, {
      importe: { modo: 'fijo', importe: 55 },
    } as Partial<CompromisoRecurrente>);
    expect(act.estado).toBe('activo');
    const pred = (await eventosDe(c.id)).filter((e) => e.status === 'predicted');
    expect(pred.length).toBeGreaterThan(0);
  });
});

describe('estados · reactivación (§2.4)', () => {
  it('el mismo servicio vuelve (finContrato) → se puede reactivar', async () => {
    const c = await crearCompromiso(base());
    await marcarUnEventoEjecutado(c.id);
    const baja = await darDeBajaCompromiso(c.id, '2026-03-15', 'finContrato');
    expect(puedeReactivar(baja)).toBe(true);

    const re = await reactivarCompromiso(c.id, '2026-07-01');
    expect(re.estado).toBe('activo');
    expect(re.fechaFin).toBeUndefined();
    expect(re.motivoBaja).toBeUndefined();
  });

  it('cambio de proveedor bloquea la reactivación', async () => {
    const c = await crearCompromiso(base());
    await marcarUnEventoEjecutado(c.id);
    const baja = await darDeBajaCompromiso(c.id, '2026-03-15', 'cambioProveedor');
    expect(puedeReactivar(baja)).toBe(false);
    await expect(reactivarCompromiso(c.id, '2026-07-01')).rejects.toThrow(/cambio de proveedor/i);
  });
});
