import { initDB, TreasuryEvent, Movement } from '../db';
import {
  confirmTreasuryEvent,
  revertTreasuryConfirmation,
  categoryLabelToStoreName,
  resolveCasillaAEAT,
} from '../treasuryConfirmationService';

const ACCOUNT_ID = 77;
const INMUEBLE_ID = 42;
const nowIso = () => new Date().toISOString();

const baseEvent = (overrides: Partial<TreasuryEvent> = {}): Omit<TreasuryEvent, 'id'> => ({
  type: 'expense',
  amount: 120,
  predictedDate: '2026-04-10',
  description: 'Reparación fontanero',
  sourceType: 'manual',
  accountId: ACCOUNT_ID,
  status: 'predicted',
  createdAt: nowIso(),
  updatedAt: nowIso(),
  ...overrides,
});

describe('treasuryConfirmationService · PR3', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('treasuryEvents'),
      db.clear('movements'),
      db.clear('gastosInmueble'),
      db.clear('mejorasInmueble'),
      db.clear('mueblesInmueble'),
    ]);
  });

  describe('categoryLabelToStoreName', () => {
    it('mapea categoryLabel a store correcto', () => {
      expect(categoryLabelToStoreName('Reparación inmueble')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Reparacion inmueble')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Mejora inmueble')).toBe('mejorasInmueble');
      expect(categoryLabelToStoreName('Mobiliario inmueble')).toBe('mueblesInmueble');
      expect(categoryLabelToStoreName('Muebles varios')).toBe('mueblesInmueble');
    });

    it('mapea gastos recurrentes deducibles a gastosInmueble', () => {
      expect(categoryLabelToStoreName('Comunidad')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Seguro inmueble')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('IBI')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Suministros')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Gasto recurrente')).toBe('gastosInmueble');
      expect(categoryLabelToStoreName('Tributos locales')).toBe('gastosInmueble');
    });

    it('devuelve null para labels sin mapeo o vacíos', () => {
      expect(categoryLabelToStoreName(undefined)).toBeNull();
      expect(categoryLabelToStoreName('')).toBeNull();
      expect(categoryLabelToStoreName('Ocio personal')).toBeNull();
    });
  });

  describe('resolveCasillaAEAT', () => {
    it('devuelve casillas AEAT alineadas con el resto del codebase', () => {
      // Consistente con aeatClassificationService y rendimientoActivoService
      expect(resolveCasillaAEAT('Reparación inmueble')).toBe('0106');
      expect(resolveCasillaAEAT('Comunidad')).toBe('0109');
      expect(resolveCasillaAEAT('Seguro')).toBe('0114');
      expect(resolveCasillaAEAT('IBI')).toBe('0115');
      expect(resolveCasillaAEAT('Suministros')).toBe('0113');
    });

    it('devuelve undefined si no hay mapeo', () => {
      expect(resolveCasillaAEAT(undefined)).toBeUndefined();
      expect(resolveCasillaAEAT('Otra cosa')).toBeUndefined();
    });
  });

  describe('confirmTreasuryEvent · signos e invariantes', () => {
    it('crea movement con importe negativo para type=expense', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({ amount: 150 }) as any),
      );

      const { movementId } = await confirmTreasuryEvent(eventId);

      const movement = (await db.get('movements', movementId)) as Movement;
      expect(movement.amount).toBe(-150);
      expect(movement.type).toBe('Gasto');
      expect(movement.reference).toBe(`treasury_event:${eventId}`);
      expect(movement.unifiedStatus).toBe('conciliado');
    });

    it('crea movement con importe positivo para type=income', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          type: 'income',
          amount: 550,
          description: 'Renta Tenderina 64',
        }) as any),
      );

      const { movementId } = await confirmTreasuryEvent(eventId);

      const movement = (await db.get('movements', movementId)) as Movement;
      expect(movement.amount).toBe(550);
      expect(movement.type).toBe('Ingreso');
    });

    it('materializa events type=financing como Movement.type=Gasto', async () => {
      // En el codebase, un financiar (pago/cancelación de préstamo) es salida
      // de caja, no transferencia interna.
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          type: 'financing',
          amount: 45000,
          description: 'Cancelación deuda Tenderina 64',
        }) as any),
      );

      const { movementId } = await confirmTreasuryEvent(eventId);

      const movement = (await db.get('movements', movementId)) as Movement;
      expect(movement.type).toBe('Gasto');
      expect(movement.amount).toBe(-45000);
    });

    it('marca el event como executed con executedMovementId + executedAt', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent() as any),
      );

      const { movementId } = await confirmTreasuryEvent(eventId);

      const updated = (await db.get('treasuryEvents', eventId)) as TreasuryEvent;
      expect(updated.status).toBe('executed');
      expect(updated.executedMovementId).toBe(movementId);
      expect(updated.executedAt).toBeDefined();
      expect(updated.movementId).toBe(movementId);
    });

    it('actualAmount siempre se persiste como magnitud positiva', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({ amount: 200 }) as any),
      );

      // Simulamos un override con valor negativo — no debe corromper.
      await confirmTreasuryEvent(eventId, { amount: -190 });

      const updated = (await db.get('treasuryEvents', eventId)) as TreasuryEvent;
      expect(updated.actualAmount).toBe(190);
      expect(updated.status).toBe('executed');
    });

    it('respeta los overrides amount/date/accountId/description/counterparty', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          amount: 550,
          predictedDate: '2026-05-01',
        }) as any),
      );

      const { movementId } = await confirmTreasuryEvent(eventId, {
        amount: 540,
        date: '2026-05-03',
        description: 'Renta Tenderina 64 · mayo (ajustada)',
        counterparty: 'B87654321',
      });

      const movement = (await db.get('movements', movementId)) as Movement;
      expect(movement.amount).toBe(-540);
      expect(movement.date).toBe('2026-05-03');
      expect(movement.description).toContain('ajustada');
      expect(movement.counterparty).toBe('B87654321');
    });

    it('lanza si el event no tiene cuenta ni override de cuenta', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({ accountId: undefined }) as any),
      );

      await expect(confirmTreasuryEvent(eventId)).rejects.toThrow(/cuenta/i);
    });

    it('lanza si el event ya está executed', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent() as any),
      );

      await confirmTreasuryEvent(eventId);
      await expect(confirmTreasuryEvent(eventId)).rejects.toThrow(/confirmada/i);
    });
  });

  describe('confirmTreasuryEvent · líneas de inmueble', () => {
    it('crea línea en gastosInmueble con casilla AEAT al confirmar una reparación', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Reparación inmueble',
          counterparty: 'A11111111',
          amount: 150,
          predictedDate: '2026-04-09',
        }) as any),
      );

      const { movementId, lineaId, lineaStore } = await confirmTreasuryEvent(eventId);

      expect(lineaStore).toBe('gastosInmueble');
      expect(lineaId).toBeDefined();

      const linea = (await db.get('gastosInmueble', lineaId as number)) as any;
      expect(linea.inmuebleId).toBe(INMUEBLE_ID);
      expect(linea.casillaAEAT).toBe('0106');
      expect(linea.categoria).toBe('reparacion');
      expect(linea.origen).toBe('tesoreria');
      expect(linea.estado).toBe('confirmado');
      expect(linea.importe).toBe(150);
      expect(linea.ejercicio).toBe(2026);
      expect(linea.movimientoId).toBe(String(movementId));
      expect(linea.treasuryEventId).toBe(eventId);
    });

    it('crea línea en mejorasInmueble al confirmar una mejora', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Mejora inmueble',
          description: 'Cambio ventanas',
          amount: 3500,
        }) as any),
      );

      const { lineaStore, lineaId } = await confirmTreasuryEvent(eventId);

      expect(lineaStore).toBe('mejorasInmueble');
      const linea = (await db.get('mejorasInmueble', lineaId as number)) as any;
      expect(linea.tipo).toBe('mejora');
      expect(linea.descripcion).toBe('Cambio ventanas');
      expect(linea.importe).toBe(3500);
    });

    it('crea línea en mueblesInmueble al confirmar mobiliario', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Mobiliario inmueble',
          description: 'Lavadora nueva',
          amount: 400,
        }) as any),
      );

      const { lineaStore, lineaId } = await confirmTreasuryEvent(eventId);

      expect(lineaStore).toBe('mueblesInmueble');
      const linea = (await db.get('mueblesInmueble', lineaId as number)) as any;
      expect(linea.activo).toBe(true);
      expect(linea.vidaUtil).toBe(10);
    });

    it('asigna la casilla AEAT correcta para gastos recurrentes (comunidad=0109, seguro=0114)', async () => {
      const db = await initDB();

      const comunidadId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Comunidad',
          amount: 90,
        }) as any),
      );
      const seguroId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Seguro inmueble',
          amount: 320,
        }) as any),
      );

      const { lineaId: comuLineaId } = await confirmTreasuryEvent(comunidadId);
      const { lineaId: segLineaId } = await confirmTreasuryEvent(seguroId);

      const comuLinea = (await db.get('gastosInmueble', comuLineaId as number)) as any;
      const segLinea = (await db.get('gastosInmueble', segLineaId as number)) as any;
      expect(comuLinea.casillaAEAT).toBe('0109');
      expect(comuLinea.categoria).toBe('comunidad');
      expect(segLinea.casillaAEAT).toBe('0114');
      expect(segLinea.categoria).toBe('seguro');
    });

    it('no crea línea de inmueble si el event es ambito=PERSONAL', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'PERSONAL',
          categoryLabel: 'Reparación inmueble',
        }) as any),
      );

      const { lineaId, lineaStore } = await confirmTreasuryEvent(eventId);

      expect(lineaId).toBeUndefined();
      expect(lineaStore).toBeUndefined();
    });
  });

  describe('revertTreasuryConfirmation', () => {
    it('borra el movement, borra la línea de inmueble y devuelve el event a predicted', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Reparación inmueble',
          amount: 150,
        }) as any),
      );

      const { movementId, lineaId } = await confirmTreasuryEvent(eventId);

      await revertTreasuryConfirmation(movementId);

      expect(await db.get('movements', movementId)).toBeUndefined();
      expect(await db.get('gastosInmueble', lineaId as number)).toBeUndefined();

      const event = (await db.get('treasuryEvents', eventId)) as TreasuryEvent;
      expect(event.status).toBe('predicted');
      expect(event.executedMovementId).toBeUndefined();
      expect(event.executedAt).toBeUndefined();
      expect(event.movementId).toBeUndefined();
    });

    it('es idempotente: confirmar → revertir → confirmar otra vez funciona', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent({
          ambito: 'INMUEBLE',
          inmuebleId: INMUEBLE_ID,
          categoryLabel: 'Reparación inmueble',
        }) as any),
      );

      const first = await confirmTreasuryEvent(eventId);
      await revertTreasuryConfirmation(first.movementId);
      const second = await confirmTreasuryEvent(eventId);

      // Nuevo movement con nuevo id
      expect(second.movementId).not.toBe(first.movementId);
      expect(await db.get('movements', second.movementId)).toBeDefined();
      const event = (await db.get('treasuryEvents', eventId)) as TreasuryEvent;
      expect(event.status).toBe('executed');
      expect(event.executedMovementId).toBe(second.movementId);
    });

    it('lanza si el movement no existe', async () => {
      await expect(revertTreasuryConfirmation(99999)).rejects.toThrow(/movimiento/i);
    });

    it('borra el movement aunque el event ya hubiese sido eliminado manualmente', async () => {
      const db = await initDB();
      const eventId = Number(
        await db.add('treasuryEvents', baseEvent() as any),
      );
      const { movementId } = await confirmTreasuryEvent(eventId);

      // Simula que alguien borró el event fuera del flujo
      await db.delete('treasuryEvents', eventId);

      await expect(revertTreasuryConfirmation(movementId)).resolves.toBeUndefined();
      expect(await db.get('movements', movementId)).toBeUndefined();
    });
  });
});
