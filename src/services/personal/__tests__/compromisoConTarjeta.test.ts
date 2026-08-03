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

// §3.4 · lo que se paga con crédito aplazado no sale el día de la compra: sale
// en el RECIBO de la tarjeta, que cruza varios gastos y se emite aparte.
// Emitirlo también aquí sería cobrar dos veces lo mismo.
describe('el crédito aplazado no emite cargo propio', () => {
  const CREDITO = {
    id: 11,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: BANKINTER,
    ciclo: { periodicidad: 'mensual', corte: 24, diaCargo: 5, periodosHastaElCargo: 1 },
    activa: true,
    createdAt: '',
    updatedAt: '',
  } as never;

  it('con tarjeta de crédito no genera nada · lo hace el recibo', () => {
    expect(generarEventosDesdeCompromiso(compromiso(), undefined, undefined, CREDITO)).toEqual([]);
  });

  // El fallo que esto evita: si la supresión mirase solo la tarjeta y el recibo
  // mirase además el medio, un gasto con `tarjetaId` pero medio distinto no lo
  // emitiría NADIE — ni cargo propio ni parte del recibo. Desaparecido.
  it('un tarjetaId huérfano no borra el gasto · manda el medio', () => {
    const huerfano = compromiso({ metodoPago: 'domiciliacion', tarjetaId: 11 });

    const eventos = generarEventosDesdeCompromiso(huerfano, undefined, undefined, CREDITO);

    expect(eventos.length).toBeGreaterThan(0);
  });

  // El débito cobra al momento · su gasto sigue siendo un cargo en su fecha.
  it('con tarjeta de débito sí genera su cargo', () => {
    const debito = { ...(CREDITO as object), modalidad: 'debito', ciclo: undefined } as never;

    const eventos = generarEventosDesdeCompromiso(compromiso(), undefined, undefined, debito);

    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.accountId === BANKINTER)).toBe(true);
  });
});

describe('de qué cuenta se prevé el cargo', () => {
  it('manda la tarjeta · no la copia guardada en el gasto', () => {
    // Débito · el crédito no emite cargo propio, eso se comprueba arriba.
    const eventos = generarEventosDesdeCompromiso(compromiso(), undefined, undefined, {
      modalidad: 'debito',
      cuentaLiquidacionId: BANKINTER,
    } as never);

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
