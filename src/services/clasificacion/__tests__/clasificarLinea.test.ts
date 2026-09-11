// E2.4.2 · el ORDEN del motor y el origen por eje · aprendida → identificador →
// concepto → recurrencia → defecto. Lo que fija una fuente fuerte no lo pisa
// una débil; lo que ninguna sabe se queda en blanco (clasificación parcial).

import { clasificarLinea, ejesDe, type ContextoClasificacion } from '../clasificarLinea';
import type { Movement } from '../../db';

const ctx = (over: Partial<ContextoClasificacion> = {}): ContextoClasificacion => ({
  cuentas: [{ id: 1, iban: 'ES6100490052632210412715', status: 'ACTIVE' }],
  tarjetas: [],
  nombresTitular: ['Nombre Apellido Apellido'],
  ...over,
});

const mov = (description: string, amount: number, over: Partial<Movement> = {}): Movement =>
  ({ id: 7, accountId: 1, date: '2026-09-01', amount, description, naturaleza: amount >= 0 ? 'ingreso' : 'gasto', ambito: 'personal', ...over }) as Movement;

describe('1 · una regla aprendida manda y para', () => {
  it('pone familia, ámbito y piso con origen «aprendida» aunque el concepto diga otra cosa', () => {
    const c = clasificarLinea(
      mov('RECIBO IBERDROLA CLIENTES', -48),
      ctx({
        sugerencias: [
          { via: 'learning_rule', confidence: 95, description: '', action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', inmuebleId: 7, familia: 'suministro', subtipo: 'gas', sourceType: 'gasto' } },
        ],
      }),
    );
    expect(c).toMatchObject({ familia: 'suministro', subtipo: 'gas', ambito: 'inmueble', inmuebleId: 7 });
    expect(c.origen).toMatchObject({ familia: 'aprendida', subtipo: 'aprendida', ambito: 'aprendida', inmuebleId: 'aprendida' });
    // El método no es de la regla: lo dice el texto del banco.
    expect(c.metodo).toBe('domiciliacion');
    expect(c.origen.metodo).toBe('concepto');
  });
});

describe('2 · el identificador gana al concepto', () => {
  it('la cuota reconocida contra el cuadro trae su piso · origen «identificador»', () => {
    const c = clasificarLinea(
      mov('PRESTAMO 2103-4257-0500106068', -454.66),
      ctx({ origen: { fuente: 'prestamo', origenId: 'p1', titulo: 'Cuota 7/240 · Unicaja', como: 'exacto', inmuebleId: 3 } as never }),
    );
    expect(c).toMatchObject({ naturaleza: 'gasto', familia: 'prestamo_hipoteca', ambito: 'inmueble', inmuebleId: 3 });
    expect(c.origen.familia).toBe('identificador');
    expect(c.origen.inmuebleId).toBe('identificador');
  });

  it('un recurrente por CUPS pone familia y piso · el texto no lo pisa', () => {
    const c = clasificarLinea(
      mov('ELECTRICIDAD IBERDROLA COMERCIALIZA', -48, { reference: 'A95554630001 · ES0031406137800001JX0F' }),
      ctx({
        sugerencias: [
          { via: 'compromiso_recurrente', confidence: 90, description: '', metadata: { porIdentidad: 'cups' }, action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', inmuebleId: 2, familia: 'suministro', subtipo: 'luz', sourceType: 'gasto_recurrente' } },
        ],
      }),
    );
    expect(c).toMatchObject({ familia: 'suministro', subtipo: 'luz', inmuebleId: 2, ambito: 'inmueble' });
    expect(c.origen.familia).toBe('identificador');
  });

  it('la devolución de un compromiso reconocido por su NIF es de la familia del gasto (Abanca · sep 2026)', () => {
    // Finutive cobra la gestoría todos los meses y un mes devuelve. El texto
    // del banco no dice «gestoría», pero el compromiso lo reconoce por su NIF
    // (`porIdentidad`) y un abono contra un GASTO conocido es su devolución:
    // misma familia, signo positivo, resta (§7). Nunca un «otro ingreso».
    const c = clasificarLinea(
      mov('FINUTIVE SL', 45),
      ctx({
        sugerencias: [
          { via: 'compromiso_recurrente', confidence: 75, description: '', metadata: { porIdentidad: 'nif' }, action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'personal', familia: 'gestion', subtipo: 'gestoria', sourceType: 'gasto_recurrente' } },
        ],
      }),
    );
    expect(c).toMatchObject({ naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria' });
    expect(c.origen.familia).toBe('identificador');
  });

  it('el traspaso reconocido por el titular es interno con su sentido', () => {
    const c = clasificarLinea(
      mov('Transferencia De Gomez Ramirez Jose Antonio', 500),
      ctx({ origen: { fuente: 'traspaso', origenId: '2', titulo: 'Traspaso desde Sabadell', como: 'exacto', traspaso: { sentido: 'entrada', cuentaContrariaId: 2 } } as never }),
    );
    expect(c).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', sentido: 'entra' });
  });
});

describe('3 · el concepto rellena lo que queda', () => {
  it('sin regla ni identificador · la familia sale de la palabra', () => {
    const c = clasificarLinea(mov('Recibo Comunidad Propietarios Direccion Ejemplo 32', -102), ctx());
    expect(c).toMatchObject({ familia: 'comunidad', metodo: 'domiciliacion', ambito: 'personal' });
    expect(c.origen).toMatchObject({ familia: 'concepto', metodo: 'concepto', ambito: 'defecto', naturaleza: 'concepto' });
  });
});

describe('4 · la recurrencia solo rellena huecos', () => {
  it('el piso que declaraste el año pasado pone el ámbito · origen «recurrencia»', () => {
    const c = clasificarLinea(
      mov('CCPP CL TE0146B7-006300000900', -148.18),
      ctx({ atribucion: { inmuebleId: 4, concepto: 'Comunidad', ejercicio: 2025 } }),
    );
    expect(c).toMatchObject({ familia: 'comunidad', ambito: 'inmueble', inmuebleId: 4 });
    expect(c.origen.familia).toBe('concepto');
    expect(c.origen.inmuebleId).toBe('recurrencia');
  });

  it('un recurrente que casa solo por texto no pisa lo que ya dijo el concepto', () => {
    const c = clasificarLinea(
      mov('GAS VISALIA', -37),
      ctx({
        sugerencias: [
          { via: 'compromiso_recurrente', confidence: 70, description: '', action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', inmuebleId: 5, familia: 'suministro', subtipo: 'otros', sourceType: 'gasto_recurrente' } },
        ],
      }),
    );
    expect(c.subtipo).toBe('gas');
    expect(c.origen.familia).toBe('concepto');
    expect(c.inmuebleId).toBe(5);
    expect(c.origen.inmuebleId).toBe('recurrencia');
  });
});

describe('5 · el defecto · clasificación PARCIAL válida', () => {
  it('una transferencia recibida sin más · ingreso, transferencia, personal, sin familia', () => {
    const c = clasificarLinea(mov('Transferencia recibida de Feebbo Solutions Pago Medux', 48, { reference: 'panelista' }), ctx());
    expect(ejesDe(c)).toEqual({ naturaleza: 'ingreso', metodo: 'transferencia', ambito: 'personal' });
    expect(c.origen).toEqual({ naturaleza: 'defecto', ambito: 'defecto', metodo: 'concepto' });
  });

  it('un cargo sin señal ninguna · gasto personal por defecto, y lo dice', () => {
    const c = clasificarLinea(mov('XKQ 3391', -12), ctx());
    expect(ejesDe(c)).toEqual({ naturaleza: 'gasto', ambito: 'personal' });
    expect(c.motivos[0]).toMatch(/sin señal/);
  });

  it('nunca ámbito inmueble sin piso', () => {
    const c = clasificarLinea(
      mov('RECIBO AGUA', -20),
      ctx({ sugerencias: [{ via: 'heuristica', confidence: 60, description: '', action: { kind: 'create_treasury_event', naturaleza: 'gasto', ambito: 'inmueble', familia: 'suministro', sourceType: 'gasto' } }] }),
    );
    expect(c.ambito).toBe('personal');
    expect(c.inmuebleId).toBeUndefined();
  });
});
