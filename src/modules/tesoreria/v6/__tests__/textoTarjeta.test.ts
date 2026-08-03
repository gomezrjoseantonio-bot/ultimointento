// Cómo se lee una tarjeta sin abrirla · VOCABULARIO §3.3 y §3.4.
//
// Lo que vigila: que la línea diga lo que decide el dinero —cuándo sale y de
// dónde— y que no invente un periodo donde no lo hay.

import { describirTarjeta } from '../textoTarjeta';
import type { Account } from '../../../../services/db';
import type { Tarjeta } from '../../../../types/tarjetas';

const CUENTAS = [
  { id: 3, alias: 'Bankinter' },
  { id: 9, alias: 'Santander' },
] as Account[];

const tarjeta = (over: Partial<Tarjeta> = {}): Tarjeta => ({
  id: 1,
  alias: 'Carrefour',
  origen: 'externa',
  modalidad: 'credito',
  cuentaLiquidacionId: 3,
  ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
  activa: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('la línea de una tarjeta', () => {
  it('dice corte, cargo y cuenta', () => {
    expect(describirTarjeta(tarjeta(), CUENTAS)).toBe(
      'Crédito · corta el 24 y cobra el 5 en Bankinter'
    );
  });

  // "el 31" no es el 31 · es el último del mes, y febrero no se salta (§3.4).
  it('el 31 se lee como el último día', () => {
    const t = tarjeta({
      ciclo: { periodicidad: 'mensual', corte: 31, diaCargo: 5, periodosHastaElCargo: 1 },
    });

    expect(describirTarjeta(t, CUENTAS)).toContain('corta el último día');
  });

  it('con corte semanal habla de días de la semana', () => {
    const t = tarjeta({
      ciclo: { periodicidad: 'semanal', corte: 7, diaCargo: 1, periodosHastaElCargo: 0 },
    });

    expect(describirTarjeta(t, CUENTAS)).toBe(
      'Crédito · corta el domingo y cobra el lunes en Bankinter'
    );
  });

  // El débito no acumula nada · decirle "corta el N" sería inventarse un
  // periodo que no existe.
  it('el débito no tiene ciclo que contar', () => {
    expect(describirTarjeta(tarjeta({ modalidad: 'debito', ciclo: undefined }), CUENTAS)).toBe(
      'Débito · sale en Bankinter al momento'
    );
  });

  // Sin esto, una tarjeta cuya cuenta se dio de baja aparecería como
  // "en undefined" — que no dice nada y parece un fallo.
  it('una cuenta que ya no está se nombra por su número', () => {
    expect(describirTarjeta(tarjeta({ cuentaLiquidacionId: 77 }), CUENTAS)).toContain(
      'en cuenta #77'
    );
  });
});
