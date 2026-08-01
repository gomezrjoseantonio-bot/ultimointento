// ============================================================================
// Descartar un previsto (Tesorería V6 · adenda 02 · D1)
// ============================================================================
//
// Descartar NO es borrar, y por eso no usa `deleteTreasuryEventCompletely()`,
// que queda reservado al borrado real:
//
//   · el motor de previsiones tiene que SABER que esto no va a ocurrir, para
//     no volver a proponerlo;
//   · el usuario tiene que poder deshacerlo.
//
// Un evento descartado no se muestra en Pendientes, no entra en los KPIs de
// pendiente entrar/salir, no afecta al Cierre y no se regenera. **No toca
// ningún saldo**: nunca ocurrió.
// ============================================================================

import { initDB, type TreasuryEvent } from './db';

/** Marca un previsto como descartado. Idempotente. */
export async function descartarPrevisto(
  eventId: number,
  motivo?: string,
  now: string = new Date().toISOString()
): Promise<void> {
  const db = await initDB();
  const evento = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
  if (!evento) throw new Error('Previsión no encontrada');

  // Un evento ya materializado no se descarta: su realidad la afirmó el usuario
  // o el banco, y esconderla falsearía el saldo. Para eso está desconfirmar.
  if (evento.status === 'executed') {
    throw new Error('No se puede descartar algo que ya ocurrió · deshaz la confirmación primero');
  }
  if (evento.descartado) return;

  await db.put('treasuryEvents', {
    ...evento,
    descartado: true,
    descartadoAt: now,
    ...(motivo ? { motivoDescarte: motivo } : {}),
    updatedAt: now,
  });
}

/** Deshace el descarte · el previsto vuelve a Pendientes (Deshacer del toast). */
export async function recuperarPrevisto(
  eventId: number,
  now: string = new Date().toISOString()
): Promise<void> {
  const db = await initDB();
  const evento = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
  if (!evento) throw new Error('Previsión no encontrada');
  if (!evento.descartado) return;

  const { descartado, descartadoAt, motivoDescarte, ...resto } = evento;
  // Se eliminan las propiedades en vez de ponerlas a false: un registro sin
  // marca es más limpio de leer que uno con `descartado: false` colgando.
  void descartado;
  void descartadoAt;
  void motivoDescarte;
  await db.put('treasuryEvents', { ...resto, updatedAt: now } as TreasuryEvent);
}
