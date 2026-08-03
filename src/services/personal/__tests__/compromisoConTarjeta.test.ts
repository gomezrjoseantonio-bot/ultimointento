// Un recurrente pagado con tarjeta · docs/VOCABULARIO-dinero.md §3.2.
//
// Lo que vigila: que el cargo se prevea donde la tarjeta está domiciliada HOY,
// no donde lo estaba el día que se guardó el gasto.
//
// `compromiso.cuentaCargo` es una COPIA de la cuenta de liquidación, y una
// copia se queda vieja: re-domiciliar la Carrefour de Santander a Bankinter no
// tocaba los gastos ya guardados, así que el cargo se seguía previendo en una
// cuenta de la que ya no sale el dinero.

import { generarEventosDesdeCompromiso } from '../compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

const SANTANDER = 1;
const BANKINTER = 2;

const compromiso = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 7,
    ambito: 'personal',
    alias: 'Compra semanal',
    proveedor: { nombre: 'Carrefour' },
    patron: { tipo: 'mensualDiaFijo', dia: 10 },
    importe: { modo: 'fijo', importe: 120 },
    // La copia · apunta a donde estaba domiciliada al guardarlo.
    cuentaCargo: SANTANDER,
    conceptoBancario: 'CARREFOUR',
    metodoPago: 'tarjeta',
    tarjetaId: 11,
    categoria: 'personal.dia_a_dia' as never,
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2019-01-01',
    estado: 'activo',
    createdAt: '2019-01-01',
    updatedAt: '2019-01-01',
    ...over,
  }) as unknown as CompromisoRecurrente;

describe('de qué cuenta se prevé el cargo', () => {
  it('manda la tarjeta · no la copia guardada en el gasto', () => {
    const eventos = generarEventosDesdeCompromiso(compromiso(), undefined, undefined, {
      cuentaLiquidacionId: BANKINTER,
    });

    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.accountId === BANKINTER)).toBe(true);
  });

  // Sin tarjeta —domiciliación, transferencia, efectivo, Bizum— la cuenta del
  // gasto es la buena y no hay nada que derivar.
  it('sin tarjeta se respeta la cuenta del gasto', () => {
    const eventos = generarEventosDesdeCompromiso(
      compromiso({ metodoPago: 'domiciliacion', tarjetaId: undefined })
    );

    expect(eventos.every((e) => e.accountId === SANTANDER)).toBe(true);
  });

  // Una tarjeta borrada no puede llevarse por delante la previsión: mejor el
  // último sitio conocido que un cargo sin cuenta.
  it('si la tarjeta ya no existe queda la última cuenta conocida', () => {
    const eventos = generarEventosDesdeCompromiso(compromiso(), undefined, undefined, undefined);

    expect(eventos.every((e) => e.accountId === SANTANDER)).toBe(true);
  });
});
