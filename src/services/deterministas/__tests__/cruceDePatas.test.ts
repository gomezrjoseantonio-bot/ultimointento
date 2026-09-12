// E3.1 · §7.1 · el cruce entre cuentas propias · las DOS patas.
import { cruzarPatas, traspasosPropios, esNominaDelPropioTitular, cuentasQueFaltan, pareceTraspasoPropio } from '../traspasosPropios';
import type { Movement } from '../../db';
import type { Account } from '../../db/types-contratos';

const NOMBRES = ['Jose Antonio Gomez Ramirez'];

const cuenta = (id: number, alias: string): Account =>
  ({ id, alias, iban: `ES6021037003520030084${430 + id}`, tipo: 'CORRIENTE' }) as unknown as Account;

const mov = (id: number, accountId: number, amount: number, description: string, date = '2026-03-10'): Movement =>
  ({ id, accountId, amount, description, date }) as Movement;

describe('E3.1 · §7.1 · el cruce de patas', () => {
  const cuentas = [cuenta(1, 'Santander'), cuenta(2, 'Unicaja')];
  const propias = new Set([1, 2]);

  it('salida en A + entrada en B a ±3 días · las DOS se marcan y cada una nombra a la otra', () => {
    const salida = mov(10, 1, -500, 'Ahorros mensuales', '2026-03-10');
    const entrada = mov(11, 2, 500, 'Abono', '2026-03-12');

    const cruces = cruzarPatas([salida, entrada], propias, NOMBRES);
    expect(cruces).toHaveLength(1);
    expect(cruces[0].salida.id).toBe(10);
    expect(cruces[0].entrada.id).toBe(11);

    const origenes = traspasosPropios([salida, entrada], cuentas, NOMBRES);
    expect(origenes.map((o) => o.movementId).sort()).toEqual([10, 11]);
    // Cada pata nombra la cuenta pareja.
    expect(origenes.find((o) => o.movementId === 10)?.titulo).toContain('Unicaja');
    expect(origenes.find((o) => o.movementId === 11)?.titulo).toContain('Santander');
    expect(origenes.every((o) => o.fuente === 'traspaso')).toBe(true);
  });

  it('si NINGUNA de las dos huele a traspaso, la coincidencia de importe NO basta', () => {
    // Dos alquileres de 400 € el mismo día en dos cuentas no son un traspaso.
    const a = mov(20, 1, -400, 'Pago a proveedor');
    const b = mov(21, 2, 400, 'Ingreso');
    expect(cruzarPatas([a, b], propias, NOMBRES)).toHaveLength(0);
  });

  it('NUNCA sobre un recibo, un cajero ni un alquiler · ahí la coincidencia es casualidad', () => {
    for (const texto of ['Recibo Iberdrola', 'Retirada de efectivo en cajero', 'Transferencia de alquiler', 'Adeudo mensual de tarjeta']) {
      const a = mov(30, 1, -400, texto);
      const b = mov(31, 2, 400, 'Ahorro');
      expect([texto, cruzarPatas([a, b], propias, NOMBRES)]).toEqual([texto, []]);
    }
  });

  it('dos candidatas para una salida es una DUDA · y una duda no se resuelve inventando', () => {
    const salida = mov(40, 1, -300, 'Ahorro');
    const e1 = mov(41, 2, 300, 'Abono');
    const e2 = mov(42, 2, 300, 'Abono');
    expect(cruzarPatas([salida, e1, e2], propias, NOMBRES)).toHaveLength(0);
  });

  it('la duda se mira por LOS DOS LADOS · dos salidas para una entrada tampoco cruzan', () => {
    // Con la unicidad mirada solo desde la salida, la PRIMERA del array se
    // llevaba la entrada y la segunda se quedaba fuera: eso es resolver una
    // ambigüedad por el orden del array, que es no resolverla.
    const s1 = mov(43, 1, -300, 'Ahorro');
    const s2 = mov(44, 1, -300, 'Ahorro');
    const entrada = mov(45, 2, 300, 'Abono');
    expect(cruzarPatas([s1, s2, entrada], propias, NOMBRES)).toHaveLength(0);
  });

  it('los ids de las líneas y los de los movimientos NO se confunden', () => {
    // `lineasExtracto` y `movements` son dos contadores autoincrementales
    // independientes, así que el mismo número puede ser dos movimientos
    // distintos. Aquí el id 1 es a la vez una línea del lote y un movimiento ya
    // guardado en otra cuenta: si el cruce fuera por `id`, uno descartaría al
    // otro o se pisarían la pareja.
    const delLote = mov(1, 1, -500, 'Ahorros mensuales', '2026-03-10');
    const yaGuardado = mov(1, 2, 500, 'Abono', '2026-03-11');
    const cruces = cruzarPatas([delLote, yaGuardado], propias, NOMBRES);
    expect(cruces).toHaveLength(1);
    expect(cruces[0].salida).toBe(delLote);
    expect(cruces[0].entrada).toBe(yaGuardado);
  });

  it('una cuenta DE BAJA no cruza · su pata no se podría resolver', () => {
    const deBaja = { ...cuenta(2, 'Vieja'), activa: false, deletedAt: '2026-01-01' } as unknown as Account;
    const salida = mov(46, 1, -500, 'Ahorro');
    const entrada = mov(47, 2, 500, 'Abono');
    const origenes = traspasosPropios([salida, entrada], [cuenta(1, 'Santander'), deBaja], NOMBRES);
    // La salida no tiene con quién cruzarse: la de enfrente está de baja.
    expect(origenes.map((o) => o.movementId)).not.toContain(46);
  });

  it('el prefetch VE lo que huele a traspaso · si no, el cruce no tiene contra qué mirar', () => {
    // `pareceTraspasoPropio` decide si se leen los movimientos de las otras
    // cuentas. Un lote que solo trae «Ahorros mensuales» no cargaba nada.
    expect(pareceTraspasoPropio(mov(48, 1, -500, 'Ahorros mensuales'), cuentas, NOMBRES)).toBe(true);
    // Y un recibo sigue sin disparar la lectura: nunca es un traspaso propio.
    expect(pareceTraspasoPropio(mov(49, 1, -500, 'Recibo Iberdrola'), cuentas, NOMBRES)).toBe(false);
  });

  it('fuera de la ventana de ±3 días no hay cruce', () => {
    const salida = mov(50, 1, -500, 'Ahorro', '2026-03-01');
    const entrada = mov(51, 2, 500, 'Abono', '2026-03-09');
    expect(cruzarPatas([salida, entrada], propias, NOMBRES)).toHaveLength(0);
  });

  it('§7.1 · una pata cuya cuenta NO está dada de alta se propone, no se inventa', () => {
    const salida = mov(60, 1, -500, 'Ahorro');
    const entrada = mov(61, 9, 500, 'Abono');
    const cruces = cruzarPatas([salida, entrada], new Set([1, 9]), NOMBRES);
    expect(cruces).toHaveLength(1);
    expect(cuentasQueFaltan(cruces, cuentas)).toEqual([9]);
  });
});

describe('E3.1 · §7.1 · la etiqueta «nómina» del banco no decide sola', () => {
  it('si el ordenante es el titular, es un traspaso · no un ingreso', () => {
    expect(esNominaDelPropioTitular('NOMINA GOMEZ RAMIREZ JOSE ANTONIO', NOMBRES)).toBe(true);
    expect(esNominaDelPropioTitular('Nomina recibida GOMEZ RAMIREZ JOSE ANTONIO', NOMBRES)).toBe(true);
    expect(esNominaDelPropioTitular('Abono de nómina Gomez ramirez jose antonio', NOMBRES)).toBe(true);
  });

  it('una nómina de VERDAD trae el nombre de la empresa · y sigue siendo un ingreso', () => {
    expect(esNominaDelPropioTitular('NOMINA FEEBBO SOLUTIONS SL', NOMBRES)).toBe(false);
    expect(esNominaDelPropioTitular('Abono de nómina ACME INGENIERIA SA', NOMBRES)).toBe(false);
    // Sin nombres del titular no se decide nada.
    expect(esNominaDelPropioTitular('NOMINA GOMEZ RAMIREZ JOSE ANTONIO', [])).toBe(false);
  });

  it('el reconocimiento lo hace el DETERMINISTA, no una regla de texto', () => {
    // El nombre entero detrás de la etiqueta ya lo cogía `laParteEsElTitular`
    // por el texto completo; lo que importa es que ahora lo resuelve el paso 2
    // (determinista) y no el 3 (reglas duras).
    const m = mov(70, 1, 1500, 'NOMINA GOMEZ RAMIREZ JOSE ANTONIO');
    const origenes = traspasosPropios([m], [cuenta(1, 'Santander')], NOMBRES);
    expect(origenes).toHaveLength(1);
    expect(origenes[0].fuente).toBe('traspaso');
    expect(origenes[0].traspaso?.sentido).toBe('entrada');
  });

  it('con solo DOS palabras del nombre detrás de la etiqueta · lo salva la vía de la nómina', () => {
    // «GOMEZ RAMIREZ» son dos palabras: el texto entero exige tres y no llega,
    // así que hasta E3.1 esto era un INGRESO inventado de 1.500 €.
    const texto = 'Abono de nómina Gomez Ramirez';
    expect(esNominaDelPropioTitular(texto, NOMBRES)).toBe(true);
    const origenes = traspasosPropios([mov(71, 1, 1500, texto)], [cuenta(1, 'Santander')], NOMBRES);
    expect(origenes).toHaveLength(1);
    expect(origenes[0].titulo).toContain('el banco lo llama nómina, pero el ordenante eres tú');
  });
});
