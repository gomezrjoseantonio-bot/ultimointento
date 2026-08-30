// FASE 2.0.1 · que el identificador que escribe el banco llegue al movimiento.
//
// Las filas de aquí son LITERALES del extracto real de BBVA de Jose (informe de
// «Últimos movimientos», 30/08/2026). No son un ejemplo inventado: son las dos
// líneas que él pidió poder ver, y el motivo de que la cascada de préstamos no
// se pudiera construir — el número de contrato se tiraba al importar.
//
// La garantía que va con esto: `description` NO cambia. `hashMovement` dedupica
// por él, así que tocarlo haría que reimportar un extracto solapado duplicara
// cargos. Todo lo nuevo entra por `reference`, que hoy nadie rellena.

import { bankProfilesService } from '../bankProfilesService';
import { hashMovement } from '../bankStatementOrchestrator';
import { referenciaDeLaFila } from '../importador/celdaDeReferencia';
import type { BankProfile } from '../../types/bankProfiles';
import type { Movement } from '../db';

/** Las cabeceras EXACTAS del informe de BBVA · dos columnas se llaman igual. */
const CABECERAS = [
  'F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe',
  'Divisa', 'Disponible', 'Divisa', 'Observaciones',
];

/** Fila literal · la cuota del préstamo personal de BBVA. */
const CUOTA_BBVA = [
  '31/07/2026', '31/07/2026', 'Cargo por amortizacion de prestamo/credito',
  '0182-5322-27-0830842450', -285.4, 'EUR', 212.17, 'EUR', '0182-5322-27-0830842450',
];

/** Fila literal · el recibo de Bankinter Consumer Finance. */
const CUOTA_BANKINTER = [
  '06/05/2026', '06/05/2026', 'Adeudo bankinter consumer finance',
  'Adeudo nº 2026126000711287', -351.43, 'EUR', 1000, 'EUR',
  'N 2026126000711287 BANKINTER CONSUMER FINANCE',
];

async function perfilBBVA(): Promise<BankProfile> {
  await bankProfilesService.loadProfiles();
  const p = bankProfilesService.getProfiles().find((x) => /bbva/i.test(x.bankKey));
  // En jest no hay `fetch` del asset · se cae al genérico, que también tiene que
  // servir: un fichero de un banco sin perfil no puede perder el identificador.
  return p ?? (await bankProfilesService.getGenericProfile());
}

describe('el identificador del banco llega a `reference`', () => {
  it('la cuota de BBVA trae su número de contrato', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(m.reference).toBeDefined();
    expect(CUOTA_BBVA[m.reference]).toBe('0182-5322-27-0830842450');
  });

  it('el recibo de Bankinter trae el nombre del prestamista', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(String(CUOTA_BANKINTER[m.reference])).toContain('BANKINTER CONSUMER FINANCE');
  });

  it('gana `Observaciones` sobre `Movimiento` · es la que sirve para las dos', async () => {
    // `Movimiento` solo llevaría el nº de contrato en la primera; en la segunda
    // trae el nº de recibo, que cambia cada mes y no identifica al prestamista.
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(m.reference).toBe(CABECERAS.lastIndexOf('Observaciones'));
  });
});

describe('y NO se toca nada de lo que ya funcionaba', () => {
  it('`description` sigue siendo la columna Concepto', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(m.description).toBe(CABECERAS.indexOf('Concepto'));
    expect(CUOTA_BBVA[m.description]).toBe('Cargo por amortizacion de prestamo/credito');
  });

  it('fecha e importe siguen donde estaban', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(m.date).toBe(CABECERAS.indexOf('Fecha'));
    expect(m.amount).toBe(CABECERAS.indexOf('Importe'));
  });

  it('`reference` no roba una columna que ya tenga otro papel', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    const otros = Object.entries(m).filter(([k]) => k !== 'reference').map(([, v]) => v);
    expect(otros).not.toContain(m.reference);
  });

  it('un fichero sin columna de observaciones no gana un `reference` inventado', async () => {
    const simples = ['Fecha', 'Concepto', 'Importe'];
    const m = bankProfilesService.mapHeaders(simples, await perfilBBVA());
    expect(m.reference).toBeUndefined();
    expect(m.description).toBe(1);
  });
});

describe('la guarda · reimportar el mismo extracto no duplica', () => {
  const movimiento = (reference?: string): Movement =>
    ({
      accountId: 7,
      date: '2026-07-31',
      amount: -285.4,
      description: 'Cargo por amortizacion de prestamo/credito',
      reference,
    }) as Movement;

  it('la huella de deduplicación NO mira `reference`', () => {
    // Es LO que no podía pasar: si el identificador entrara en la huella, el
    // mismo cargo importado antes y después del cambio serían dos cargos.
    expect(hashMovement(movimiento('0182-5322-27-0830842450'))).toBe(hashMovement(movimiento(undefined)));
  });

  it('dos cuotas iguales con distinto nº de recibo siguen siendo duplicados entre sí', () => {
    // El caso de Bankinter: el nº de recibo cambia cada mes, pero eso lo
    // distingue la FECHA, no la referencia. Mismo día e importe = la misma.
    expect(hashMovement(movimiento('N 2026126000711287 BANKINTER CONSUMER FINANCE'))).toBe(
      hashMovement(movimiento('N 2026099000268072 BANKINTER CONSUMER FINANCE')),
    );
  });

  it('y sigue distinguiendo lo que de verdad es distinto', () => {
    const otro = { ...movimiento('x'), amount: -351.43 } as Movement;
    expect(hashMovement(otro)).not.toBe(hashMovement(movimiento('x')));
  });
});

describe('el recorrido completo · de la fila real a la referencia', () => {
  // Esto es lo que antes solo se podía comprobar a mano, en el navegador y con
  // los datos reales delante. Ahora lo prueba el código: `mapHeaders` elige la
  // columna y `referenciaDeLaFila` lee la celda; lo único que queda después es
  // la asignación al `ParsedMovement`, que es la misma variable.

  it('la cuota del préstamo de BBVA sale con su número de contrato', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(referenciaDeLaFila(CUOTA_BBVA, m)).toBe('0182-5322-27-0830842450');
  });

  it('el recibo de Bankinter sale con el nombre del prestamista', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(referenciaDeLaFila(CUOTA_BANKINTER, m)).toContain('BANKINTER CONSUMER FINANCE');
  });

  it('un fichero sin columna de referencia no inventa una', async () => {
    const simples = ['Fecha', 'Concepto', 'Importe'];
    const m = bankProfilesService.mapHeaders(simples, await perfilBBVA());
    expect(referenciaDeLaFila(['31/07/2026', 'Cuota', -285.4], m)).toBeUndefined();
  });

  it('una celda vacía es «no hay», no una referencia en blanco', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    const sinObservaciones = [...CUOTA_BBVA];
    sinObservaciones[m.reference] = '   ';
    expect(referenciaDeLaFila(sinObservaciones, m)).toBeUndefined();
  });

  it('una fila más corta de lo esperado no revienta', async () => {
    const m = bankProfilesService.mapHeaders(CABECERAS, await perfilBBVA());
    expect(referenciaDeLaFila(['31/07/2026', '31/07/2026', 'Cuota'], m)).toBeUndefined();
  });
});
