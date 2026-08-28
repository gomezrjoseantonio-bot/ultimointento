// T3 · el enlace a la ficha del gasto solo existe donde hay gasto detrás.
//
// Punteando aparece un cargo que ya no toca. La salida fácil —borrar la
// previsión— no arregla nada: el gasto la reemite el mes siguiente. Lo que hay
// que abrir es su ficha, y para eso el enlace tiene que llevar A la fila, no a
// una lista donde volver a buscarla.
import { rutaDelGastoRecurrente } from '../enlaceGastoRecurrente';
import type { TreasuryEvent } from '../../db';

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    type: 'expense', amount: -60, predictedDate: '2026-09-10', description: 'Comunidad',
    status: 'predicted', sourceType: 'gasto_recurrente', sourceId: 42,
    createdAt: '', updatedAt: '', ...over,
  }) as TreasuryEvent;

describe('rutaDelGastoRecurrente', () => {
  it('un gasto personal abre su fila en el listado de gastos', () => {
    expect(rutaDelGastoRecurrente(ev({ ambito: 'PERSONAL' }))).toBe('/personal/gastos?gasto=42');
  });

  it('el de un inmueble abre la ficha del inmueble, que es donde vive', () => {
    expect(rutaDelGastoRecurrente(ev({ ambito: 'INMUEBLE', inmuebleId: 3 })))
      .toBe('/inmuebles/3?tab=gastos&gasto=42');
  });

  it('un `opex_rule` es el mismo origen · también lleva a su gasto', () => {
    expect(rutaDelGastoRecurrente(ev({ sourceType: 'opex_rule' as never })))
      .toBe('/personal/gastos?gasto=42');
  });

  // Lo que NO tiene enlace · ofrecer uno que no lleva a ninguna parte es peor
  // que no ofrecer ninguno.
  it('una renta de contrato no tiene gasto recurrente detrás', () => {
    expect(rutaDelGastoRecurrente(ev({ sourceType: 'contrato' as never }))).toBeNull();
  });

  it('ni un préstamo', () => {
    expect(rutaDelGastoRecurrente(ev({ sourceType: 'prestamo' as never }))).toBeNull();
  });

  it('ni una previsión de compromiso que perdió su origen', () => {
    expect(rutaDelGastoRecurrente(ev({ sourceId: undefined }))).toBeNull();
  });

  it('un evento antiguo sin `ambito` pero con inmueble va a su inmueble', () => {
    expect(rutaDelGastoRecurrente(ev({ inmuebleId: 8 })))
      .toBe('/inmuebles/8?tab=gastos&gasto=42');
  });
});
