// E2.4.2 · las diez reglas duras · cada una fija un bug real de 4.000 líneas.

import { clasificarLinea, type ContextoClasificacion } from '../clasificarLinea';
import { metodoDelConcepto } from '../metodoDelConcepto';
import { tienePalabra } from '../palabras';
import type { Movement } from '../../db';

const ctx = (over: Partial<ContextoClasificacion> = {}): ContextoClasificacion => ({
  cuentas: [
    { id: 1, iban: 'ES6100490052632210412715', status: 'ACTIVE' },
    { id: 2, iban: 'ES6021037003520030084437', status: 'ACTIVE' },
  ],
  tarjetas: [],
  nombresTitular: ['Nombre Apellido Apellido'],
  ...over,
});

const mov = (description: string, amount: number, over: Partial<Movement> = {}): Movement =>
  ({ id: 1, accountId: 1, date: '2026-09-01', amount, description, naturaleza: amount >= 0 ? 'ingreso' : 'gasto', ambito: 'personal', ...over }) as Movement;

describe('regla 1 · palabra ENTERA, nunca substring', () => {
  it('«once» no está en «concepto» · «gas» no está en «gasto»', () => {
    expect(tienePalabra('PAGO CONCEPTO ALGO', 'ONCE')).toBe(false);
    expect(tienePalabra('CUPON ONCE SEMANAL', 'ONCE')).toBe(true);
    expect(tienePalabra('GASTO VARIOS', 'GAS')).toBe(false);
    expect(tienePalabra('GAS VISALIA', 'GAS')).toBe(true);
    expect(tienePalabra('PILOTO AUTOMATICO', 'LOTO')).toBe(false);
  });
  it('tolera el recorte del banco a partir de cinco letras', () => {
    expect(tienePalabra('ELECTRICIDAD IBERDROLA COMERCIALIZA', 'IBERDROLA COMERCIALIZACION')).toBe(true);
  });
  it('un concepto con «once» no se clasifica como la ONCE', () => {
    const c = clasificarLinea(mov('PAGO CONCEPTO 123456 MATERIAL', -20), ctx());
    expect(c.familia).toBeUndefined();
  });
});

describe('regla 2 · el signo manda sobre la palabra', () => {
  it('una renta que SALE no es una renta · el ingreso en negativo se descarta', () => {
    const c = clasificarLinea(
      mov('BIZUM A FAVOR DE AROA GOMEZ', -80),
      ctx({ sugerencias: [{ via: 'learning_rule', confidence: 90, description: '', action: { kind: 'assign_to_contract', contractId: 3 } }] }),
    );
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).not.toBe('alquiler');
  });
});

// E2.4.2-fix · Curenergía cobra una cuota fija y regulariza cada seis meses.
// Lo que devuelve es del suministro de ese piso, no un ingreso caído del cielo:
// se queda en la familia del gasto, con signo +, y así RESTA de la luz en vez
// de inflar los ingresos (Opción A · §7 del DEFINITIVO).
describe('la devolución de un gasto es de la familia de ese gasto', () => {
  it('«TRANSFERENCIA CURENERGÍA» en positivo es luz, no «otros ingresos»', () => {
    const c = clasificarLinea(mov('TRANSFERENCIA CURENERGIA SAU', 31.2), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBe('suministro');
    expect(c.subtipo).toBe('luz');
    expect(c.motivos.join(' ')).toMatch(/devolución de ese gasto/);
  });

  it('la devolución de la gestoría es de gestión · gestoría, no un ingreso (Abanca · sep 2026)', () => {
    // Cuota mensual con devolución puntual · mismo patrón §7 que Curenergía:
    // misma familia, signo positivo, resta. Por concepto entra cuando el
    // banco escribe «gestoría»; por su NIF, con un compromiso (ver
    // `clasificarLinea.test`).
    const c = clasificarLinea(mov('ABONO GESTORIA LOPEZ ASESORES SL', 45), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBe('gestion');
    expect(c.subtipo).toBe('gestoria');
    expect(c.motivos.join(' ')).toMatch(/devolución de ese gasto/);
  });

  it('la regularización de la TGSS es la cuota RETA que vuelve · no una pensión (Abanca · sep 2026)', () => {
    // Los dos importes reales de Jose. Antes «SEGURIDAD SOCIAL» estaba en la
    // lista de PENSIÓN y esto salía como ingreso · pensión.
    const a = clasificarLinea(mov('TESORERIA GENERAL DE LA SEGURIDAD SOCIAL', 283.03), ctx());
    expect(a.naturaleza).toBe('gasto');
    expect(a.familia).toBe('cuota_reta');
    expect(a.motivos.join(' ')).toMatch(/devolución de ese gasto/);
    const b = clasificarLinea(mov('DDPP DE LA TGSS', 1488.72), ctx());
    expect(b.naturaleza).toBe('gasto');
    expect(b.familia).toBe('cuota_reta');
    // Y la cuota de todos los meses es la cuota.
    const cuota = clasificarLinea(mov('ADEUDO TGSS CUOTA AUTONOMOS 09/2026', -300), ctx());
    expect(cuota.naturaleza).toBe('gasto');
    expect(cuota.familia).toBe('cuota_reta');
    expect(cuota.motivos.join(' ')).not.toMatch(/devolución/);
  });

  it('las siglas partidas y las palabras sueltas de Abanca también son la cuota (fix2)', () => {
    // «T.G.S.S.» se normaliza a «T G S S» y ya no es la palabra TGSS; lo que
    // queda entero es «AUTONOMOS». Y «COTIZACION» sola también es la cuota.
    expect(clasificarLinea(mov('052107081079 T.G.S.S.-R.E. AUTONOMOS', -314), ctx())).toMatchObject({ naturaleza: 'gasto', familia: 'cuota_reta' });
    expect(clasificarLinea(mov('052107081079 TGSS. COTIZACION 005 R.E.AUTONOMOS', -314), ctx())).toMatchObject({ naturaleza: 'gasto', familia: 'cuota_reta' });
  });

  it('la pensión sigue siendo pensión · con «pensión» o con INSS', () => {
    expect(clasificarLinea(mov('PENSION INSS SEPTIEMBRE', 900), ctx())).toMatchObject({ naturaleza: 'ingreso', familia: 'pension' });
    expect(clasificarLinea(mov('ABONO PENSION SEGURIDAD SOCIAL', 900), ctx())).toMatchObject({ naturaleza: 'ingreso', familia: 'pension' });
  });

  it('el recibo de siempre no cambia · en negativo sigue siendo la cuota', () => {
    const c = clasificarLinea(mov('ELECTRICIDAD IBERDROLA COMERCIALIZA', -48), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBe('suministro');
    expect(c.subtipo).toBe('luz');
    expect(c.motivos.join(' ')).not.toMatch(/devolución/);
  });

  it('el seguro que reintegra vuelve a seguros, no a ingresos', () => {
    const c = clasificarLinea(mov('ABONO MAPFRE REGULARIZACION POLIZA', 62.4), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBe('seguros_alarmas');
  });

  it('un recibo devuelto es una devolución SIN familia · falta decir de cuál', () => {
    // El concepto dice que vuelve dinero de un recibo, pero no de qué recibo.
    // Inventarle familia sería peor que dejar que lo diga quien lo sabe.
    const c = clasificarLinea(mov('ABONO POR DOMICILIACIÓN DE RECIBOS', 19.46), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBeUndefined();
  });

  it('si el recibo devuelto trae el proveedor, la familia sale sola', () => {
    const c = clasificarLinea(mov('ABONO POR DOMICILIACION IBERDROLA', 19.46), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBe('suministro');
    expect(c.subtipo).toBe('luz');
  });

  it('una bonificación del banco SÍ es un ingreso · es dinero nuevo', () => {
    const c = clasificarLinea(mov('BONIFICACION PLAN CUENTA NOMINA', 12), ctx());
    expect(c.naturaleza).toBe('ingreso');
    expect(c.familia).toBe('otros_ingresos');
  });
});

// La otra mitad de la regla: lo que entra y es un ingreso DE VERDAD no se
// convierte en la devolución de nada. Si esto se rompe, la renta de un piso
// dejaría de contar como ingreso y restaría del alquiler pagado.
describe('un ingreso de verdad no se lee como devolución', () => {
  it('la renta que entra sigue siendo alquiler · ingreso', () => {
    const c = clasificarLinea(mov('TRANSFERENCIA ALQUILER SEPTIEMBRE PISO 3', 650), ctx());
    expect(c.naturaleza).toBe('ingreso');
    expect(c.familia).toBe('alquiler');
  });

  it('la nómina que entra sigue siendo nómina', () => {
    const c = clasificarLinea(mov('NOMINA EMPRESA SL', 1850), ctx());
    expect(c.naturaleza).toBe('ingreso');
    expect(c.familia).toBe('nomina');
  });

  it('la devolución de Hacienda es un ingreso, no un gasto en positivo', () => {
    // No es de ninguna familia de gasto: no hay «gasto de Hacienda» del que
    // restarla, aunque la palabra sea la misma.
    const c = clasificarLinea(mov('ABONO AEAT DEVOLUCION RENTA 2025', 420), ctx());
    expect(c.naturaleza).toBe('ingreso');
    expect(c.familia).toBe('otros_ingresos');
  });

  it('el premio de lotería o apuestas es un ingreso, no la vuelta de una apuesta', () => {
    // Jose (11 sep 2026): «poner como otros ingresos». La lista OCIO_APUESTAS
    // dispara en los dos signos desde E2.4.2-fix, y sin la regla de ingreso
    // delante el premio restaba de lo gastado en apuestas.
    const premio = clasificarLinea(mov('PREMIO LOTERIAS Y APUESTAS DEL ESTADO', 50), ctx());
    expect(premio.naturaleza).toBe('ingreso');
    expect(premio.familia).toBe('otros_ingresos');
    const botemania = clasificarLinea(mov('ABONO BOTEMANIA', 120), ctx());
    expect(botemania.naturaleza).toBe('ingreso');
    expect(botemania.familia).toBe('otros_ingresos');
    // Y lo que sale sigue siendo el gasto de siempre.
    const decimo = clasificarLinea(mov('LOTERIAS Y APUESTAS', -6), ctx());
    expect(decimo.naturaleza).toBe('gasto');
    expect(decimo.familia).toBe('ocio');
    expect(decimo.subtipo).toBe('otros');
  });

  it('una transferencia de una persona sigue sin familia · el defecto es ingreso', () => {
    const c = clasificarLinea(mov('ABONO TRANSFERENCIA DE NOMBRE APELLIDO', 400), ctx());
    expect(c.naturaleza).toBe('ingreso');
    expect(c.familia).toBeUndefined();
  });
});

describe('regla 3 · concepto explícito gana sobre nombre propio · nómina yo→yo', () => {
  it('«Transferencia a favor de [yo] concepto nómina» es un traspaso, no un ingreso', () => {
    const c = clasificarLinea(mov('Transferencia A Favor De Nombre Apellido Apellido Concepto Nomina', -800), ctx());
    expect(c.naturaleza).toBe('movimiento_interno');
    expect(c.familia).toBe('traspaso');
    expect(c.sentido).toBe('sale');
  });
  it('la nómina de la empresa sigue siendo nómina', () => {
    const c = clasificarLinea(mov('Transferencia De Empresa Ejemplo Sa, Concepto Nomina', 3928), ctx());
    expect(c).toMatchObject({ naturaleza: 'ingreso', familia: 'nomina', metodo: 'transferencia' });
    expect(c.origen.familia).toBe('concepto');
  });
});

describe('regla 4 · el método nunca es «otro» si el banco da señal', () => {
  it.each([
    ['Liquidacion Periodica Prestamo 0049 0052 143 0005465', 'domiciliacion'],
    ['PRESTAMOS ADEUDO CUOTA N.8078716546', 'domiciliacion'],
    ['LIQUIDACION DE LAS TARJETAS DE CREDITO', 'domiciliacion'],
    ['PRESTAMOS ABONO DISPOSICIÓN N.8078782349', 'transferencia'],
    ['Recibo Segurcaixa Adeslas Nº Recibo 07085234611', 'domiciliacion'],
    ['Bizum A Favor De Persona Ejemplo Uno', 'bizum'],
    ['Pago Movil En Mercadona, Oviedo, Tarj. :*9623', 'tarjeta'],
    ['Emision De Cheque Bancario N.  A0176477', 'cheque'],
    ['RETIRADA EFECTIVO CAJERO 1234', 'efectivo'],
    ['REMUN. MES CTA ONLINE', 'cargo_abono_banco'],
    ['Transferencia recibida de Feebbo Solutions', 'transferencia'],
  ])('%s → %s', (texto, metodo) => {
    expect(metodoDelConcepto(texto)).toBe(metodo);
  });
  it('Revolut lo dice en la columna Type · llega como referencia', () => {
    expect(metodoDelConcepto('Botemania', 'CARD_PAYMENT')).toBe('tarjeta');
    expect(metodoDelConcepto('Recarga de *4437', 'TOPUP')).toBe('transferencia');
    expect(metodoDelConcepto('To Binance', 'TRANSFER')).toBe('transferencia');
  });
  it('sin señal no se inventa', () => {
    expect(metodoDelConcepto('Botemania')).toBeUndefined();
  });
});

describe('regla 5 · «préstamo» son tres cosas', () => {
  it('la cuota · gasto · prestamo_hipoteca · cargo entero', () => {
    const c = clasificarLinea(mov('PRESTAMOS ADEUDO CUOTA N.8078716546', -241.6), ctx());
    expect(c).toMatchObject({ naturaleza: 'gasto', familia: 'prestamo_hipoteca', metodo: 'domiciliacion' });
  });
  it('la liquidación de la tarjeta NO es préstamo', () => {
    const c = clasificarLinea(mov('LIQUIDACION DE LAS TARJETAS DE CREDITO', -320), ctx());
    expect(c.familia).toBeUndefined();
    expect(c.metodo).toBe('domiciliacion');
  });
  it('la disposición · capital que entra · movimiento interno', () => {
    const c = clasificarLinea(mov('PRESTAMOS ABONO DISPOSICIÓN N.8078782349', 16500), ctx());
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'disposicion_prestamo', sentido: 'entra' });
  });
  it('la hipoteca de ING', () => {
    const c = clasificarLinea(mov('Cargo cuota de Hipoteca ING Direct', -540), ctx());
    expect(c.familia).toBe('prestamo_hipoteca');
  });
});

describe('regla 6 · el agregador es opaco', () => {
  it('«Compra Revolut**0940*» con la tarjeta 0940 registrada es una recarga propia · traspaso', () => {
    const c = clasificarLinea(
      mov('Compra Revolut**0940*, Dublin, Tarjeta 5489010341469623, Comision 0,00', -30),
      ctx({ tarjetas: [{ id: 5, ultimosCuatro: '0940', activa: true }] }),
    );
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_tarjeta', sentido: 'sale' });
    expect(c.origen.familia).toBe('identificador');
  });
  it('sin la tarjeta registrada no se inventa · gasto por tarjeta sin familia', () => {
    const c = clasificarLinea(mov('Pago en Revolut**0940*', -30), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBeUndefined();
    expect(c.metodo).toBe('tarjeta');
  });
  it('desde Revolut · «Recarga de *4437» · los cuatro últimos de un IBAN propio · traspaso que entra', () => {
    const c = clasificarLinea(mov('Recarga de *4437', 30, { accountId: 9, reference: 'TOPUP' }), ctx());
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', sentido: 'entra' });
  });
  it('el bazar es «compra online» sin saber qué se compró', () => {
    const c = clasificarLinea(mov('COMPRA AMAZON EU SARL', -42), ctx());
    expect(c.familia).toBe('compra_online');
    expect(c.subtipo).toBeUndefined();
  });
});

describe('regla 7 · «Compra Bizum [comercio]» ≠ «Bizum a favor de [persona]»', () => {
  it('el comercio manda · Renfe es transporte', () => {
    const c = clasificarLinea(mov('Compra Bizum Renfe Viajeros', -45.6), ctx());
    expect(c).toMatchObject({ familia: 'transporte', subtipo: 'transporte_publico', metodo: 'bizum' });
  });
  it('a una persona sin concepto · personal por defecto, sin familia', () => {
    const c = clasificarLinea(mov('Bizum A Favor De Persona Ejemplo Uno Concepto Sin Concepto', -15), ctx());
    expect(c.familia).toBeUndefined();
    expect(c.metodo).toBe('bizum');
    expect(c.ambito).toBe('personal');
    expect(c.origen.ambito).toBe('defecto');
  });
});

describe('regla 8 · ATLAS no inventa', () => {
  it('«Apple» a secas es un gasto por tarjeta sin familia', () => {
    const c = clasificarLinea(mov('Apple', -9.99, { reference: 'CARD_PAYMENT' }), ctx());
    expect(c.familia).toBeUndefined();
    expect(c.metodo).toBe('tarjeta');
  });
  it('«Ahorros Septiembre» es un traspaso a ahorro · lo que no se inventa es A DÓNDE', () => {
    // Criterio revisado por Jose (11 sep 2026 · E2.4.2-fix2): la palabra SÍ
    // dice qué es —dinero que cambia de sitio, no un gasto— aunque no diga a
    // qué cuenta. Antes se dejaba sin familia y caía como gasto, que era peor:
    // inventaba un gasto de 500 € que nunca existió.
    const c = clasificarLinea(mov('Ahorros Septiembre', -500), ctx());
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', sentido: 'sale' });
    expect(c.inmuebleId).toBeUndefined();
  });
});

describe('regla 10 · lo interno y lo del piso', () => {
  it('la devolución de la fianza es movimiento interno', () => {
    const c = clasificarLinea(mov('Devolución fianza HAB2 ACV32', -380), ctx());
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'fianza', subtipo: 'devuelve', sentido: 'sale' });
  });
  it('honorarios de la venta · gestión', () => {
    const c = clasificarLinea(mov('HONORARIOS INTERMEDIACION VTA', -2117.5), ctx());
    expect(c).toMatchObject({ familia: 'gestion', subtipo: 'otros' });
  });
  it('la remuneración de la cuenta es rendimiento · interés', () => {
    const c = clasificarLinea(mov('REMUN. MES CTA ONLINE', 10.21), ctx());
    expect(c).toMatchObject({ naturaleza: 'ingreso', familia: 'rendimiento', subtipo: 'interes' });
  });
  it('una transferencia a un exchange es aportación a inversión', () => {
    const c = clasificarLinea(mov('To Binance', -200, { reference: 'TRANSFER' }), ctx());
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'aportacion', subtipo: 'inversion' });
  });
});

// ── E2.4.2-fix2 · lo que Abanca destapó · el concepto lo resuelve ─────────────
//
// Jose (11 sep 2026): «AHORRO» y «AHORROS» son LA MISMA cosa (un traspaso a la
// cuenta de ahorro, no un gasto); FINUTIVE es su gestoría; el IVA del 303 NO se
// clasifica —es dinero de Hacienda de paso— pero tiene que decir por qué está
// sin resolver.

describe('E2.4.2-fix2 · Abanca · el concepto resuelve', () => {
  it('«AHORRO» y «AHORROS» son un traspaso a ahorro · una sola categoría, en los dos signos', () => {
    for (const texto of ['AHORROS', 'AHORRO', 'AHORROS JUNIO', 'AHORRO AGOSTO']) {
      const c = clasificarLinea(mov(texto, -800), ctx());
      expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', sentido: 'sale', metodo: 'transferencia' });
      expect(c.origen.familia).toBe('concepto');
    }
    // Lo que vuelve del ahorro entra, y sigue sin ser un ingreso.
    expect(clasificarLinea(mov('AHORROS', 500), ctx())).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', sentido: 'entra' });
  });

  it('FINUTIVE es la gestoría · y su devolución también (D3)', () => {
    expect(clasificarLinea(mov('Y8CSFFT GC re FINUTIVE', -29.04), ctx())).toMatchObject({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria' });
    expect(clasificarLinea(mov('Y8CSFFT GC RE FINUTIVE', 29.04), ctx())).toMatchObject({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria' });
  });

  it('el IVA del 303 se reconoce y NO se clasifica · sin familia, con su motivo (D4)', () => {
    const c = clasificarLinea(mov('000000000001 IMP:303560385004,NIF:00000000X', -2257.82), ctx());
    expect(c.naturaleza).toBe('gasto');
    expect(c.familia).toBeUndefined();
    expect(c.origen.familia).toBeUndefined();
    expect(c.motivos.join(' ')).toMatch(/Hacienda.*IVA/);
    // Y con la palabra entera, igual.
    const d = clasificarLinea(mov('IMPTO SOBRE EL VALOR AÑADIDO 2T', -536.27), ctx());
    expect(d.familia).toBeUndefined();
    expect(d.motivos.join(' ')).toMatch(/IVA/);
  });
});
