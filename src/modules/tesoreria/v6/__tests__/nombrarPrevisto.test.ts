// Un previsto se nombra en el drawer de import con el modelo del apunte:
// título (quién) · qué es · inmueble — igual que en Tesorería y el Panel.

import { nombrarPrevisto } from '../nombrarPrevisto';
import type { TreasuryEvent } from '../../../services/db';

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    id: 1,
    type: 'income',
    amount: 1350,
    predictedDate: '2026-08-01',
    status: 'predicted',
    accountId: 1,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('nombrarPrevisto · modelo del apunte', () => {
  it('una renta se lee «quién · qué es · inmueble», no su descripción cruda', () => {
    const label = nombrarPrevisto(
      ev({
        sourceType: 'contrato',
        description: 'Renta – ALISSER REAL ESTATE',
        proveedor: 'ALISSER REAL ESTATE',
        inmuebleId: 7,
      }),
      (id) => (String(id) === '7' ? 'Fuertes Acevedo 32' : undefined),
    );
    // El título deja de ser el texto de un tirón.
    expect(label).not.toBe('Renta – ALISSER REAL ESTATE');
    expect(label).toContain('Fuertes Acevedo 32');
  });

  it('sin id no se adapta · queda su texto', () => {
    expect(nombrarPrevisto(ev({ id: undefined, description: 'Algo' }))).toBe('Algo');
  });

  it('nunca nombra el inmueble dos veces', () => {
    const label = nombrarPrevisto(
      ev({ sourceType: 'contrato', description: 'Renta – Inquilino', inmuebleId: 7 }),
      () => 'Fuertes Acevedo 32',
    );
    expect(label.match(/Fuertes Acevedo 32/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
