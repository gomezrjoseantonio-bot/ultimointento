// La cola de lo que venció y sigue sin confirmar.
//
// Desde #1813 un previsto que no llegó a tiempo sobrevive al cambio de mes: es
// trabajo, no basura. Pero el calendario enseña UN mes, así que en septiembre
// ese pendiente de agosto no lo veía nadie. Aquí se agrupa por el mes del que
// viene —una casilla por mes, no un cajón de sastre— para que se sepa de cuándo
// es cada cosa.

import { vencidosPorMes } from '../vencidosPorMes';
import type { TreasuryEvent } from '../../../../services/db';

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    id: 1, type: 'expense', amount: 50, predictedDate: '2026-08-01',
    description: 'Aqualia', accountId: 1, status: 'predicted',
    sourceType: 'gasto_recurrente', createdAt: '', updatedAt: '', ...over,
  }) as TreasuryEvent;

// Estamos en septiembre de 2026.
const EN_SEPTIEMBRE = { year: 2026, month0: 8, hoy: '2026-09-11' };

describe('vencidosPorMes', () => {
  it('agrupa lo de agosto en su propia casilla', () => {
    const r = vencidosPorMes({
      eventos: [ev({ id: 1, predictedDate: '2026-08-01' }), ev({ id: 2, predictedDate: '2026-08-08' })],
      ...EN_SEPTIEMBRE,
    });
    expect(r).toHaveLength(1);
    expect(r[0].clave).toBe('2026-08');
    expect(r[0].etiqueta).toBe('Agosto');
    expect(r[0].pendientes).toHaveLength(2);
  });

  // Una casilla POR MES · saber de cuándo viene cada cosa es media respuesta.
  it('julio y agosto son dos casillas, no una', () => {
    const r = vencidosPorMes({
      eventos: [ev({ id: 1, predictedDate: '2026-07-10' }), ev({ id: 2, predictedDate: '2026-08-10' })],
      ...EN_SEPTIEMBRE,
    });
    expect(r.map((m) => m.clave)).toEqual(['2026-08', '2026-07']);
  });

  it('el total lleva signo · un gasto resta', () => {
    const r = vencidosPorMes({
      eventos: [
        ev({ id: 1, amount: 50.73, predictedDate: '2026-08-01' }),
        ev({ id: 2, amount: 50.73, predictedDate: '2026-08-01' }),
        ev({ id: 3, amount: 50.73, predictedDate: '2026-08-08' }),
      ],
      ...EN_SEPTIEMBRE,
    });
    expect(r[0].total).toBeCloseTo(-152.19, 2);
    expect(r[0].pendientes).toHaveLength(3);
  });

  it('un ingreso vencido suma', () => {
    const r = vencidosPorMes({
      eventos: [ev({ type: 'income' as never, amount: 607, predictedDate: '2026-08-05' })],
      ...EN_SEPTIEMBRE,
    });
    expect(r[0].total).toBe(607);
  });

  // ─── qué NO entra ─────────────────────────────────────────────────────────

  it('lo del mes que se mira no es cola · ya se ve en la rejilla', () => {
    expect(vencidosPorMes({ eventos: [ev({ predictedDate: '2026-09-01' })], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  it('ni lo de meses futuros', () => {
    expect(vencidosPorMes({ eventos: [ev({ predictedDate: '2026-10-01' })], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  it('un DESCARTADO no es cola · dijiste que no iba a ocurrir', () => {
    expect(vencidosPorMes({ eventos: [ev({ descartado: true })], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  it('ni lo ya ejecutado', () => {
    expect(vencidosPorMes({ eventos: [ev({ status: 'executed' as never })], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  // La pieza de un recibo de tarjeta se puntea en el cajón de la tarjeta, no
  // en las cuentas · mismo criterio que `esPendiente`.
  it('ni una pieza de recibo de tarjeta', () => {
    expect(vencidosPorMes({ eventos: [ev({ sourceType: 'gasto_tarjeta' as never })], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  // Mirando OCTUBRE desde septiembre, lo de septiembre aún no ha vencido: no es
  // una cola atrasada, es el mes de al lado que todavía puede ocurrir.
  it('navegar a un mes futuro no inventa colas', () => {
    const r = vencidosPorMes({
      eventos: [ev({ predictedDate: '2026-09-20' }), ev({ id: 2, predictedDate: '2026-08-01' })],
      year: 2026, month0: 9, hoy: '2026-09-11',
    });
    expect(r.map((m) => m.clave)).toEqual(['2026-08']);
  });

  it('sin nada vencido, ninguna casilla', () => {
    expect(vencidosPorMes({ eventos: [], ...EN_SEPTIEMBRE })).toEqual([]);
  });

  it('un evento sin fecha no rompe nada', () => {
    expect(vencidosPorMes({ eventos: [ev({ predictedDate: '' })], ...EN_SEPTIEMBRE })).toEqual([]);
  });
});
