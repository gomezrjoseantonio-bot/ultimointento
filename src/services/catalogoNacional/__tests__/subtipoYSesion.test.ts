// E3.1 · dos promesas que la revisión pilló sin cumplir · ahora con su test.
import { clasificarLinea, type ContextoClasificacion } from '../../clasificacion/clasificarLinea';
import { catalogoDeFabrica } from '../catalogoNacional';
import { construirLineas } from '../../../modules/tesoreria/v6/extractoSesion';
import type { LineaExtractoPersistida } from '../../db/types-lineasExtracto';
import type { Movement } from '../../db';

describe('E3.1 · el catálogo completa el SUBTIPO cuando la familia ya está puesta', () => {
  it('un recibo de financiera cuyo mandato casa un préstamo NO pierde «credito_consumo»', () => {
    // El nº de contrato dice «esto es un préstamo» y se queda sin subtipo. Si
    // el catálogo dice además que quien cobra es una financiera, ese
    // `credito_consumo` se perdía solo porque la familia ya estaba ocupada.
    const ctx: ContextoClasificacion = {
      cuentas: [],
      tarjetas: [],
      nombresTitular: [],
      catalogo: catalogoDeFabrica(),
      contratosDePrestamo: [{ numeroContrato: '07085234611' }],
    };
    const m = {
      id: 1,
      accountId: 1,
      date: '2026-03-01',
      amount: -351.43,
      description: 'Recibo WiZink Bank Ref. Mandato 07085234611, De',
    } as Movement;

    const c = clasificarLinea(m, ctx);
    expect(c.familia).toBe('prestamo_hipoteca');
    expect(c.subtipo).toBe('credito_consumo');
    expect(c.origen.familia).toBe('identificador');
    expect(c.origen.subtipo).toBe('identificador');
  });
});

describe('E3.1 · §9.5 · los identificadores persistidos LLEGAN a la sesión', () => {
  const vacio = { matches: [], multiMatches: [], sinMatch: [] } as never;

  const fila = (extra: Partial<LineaExtractoPersistida> = {}): LineaExtractoPersistida =>
    ({
      id: 7,
      fechaOperacion: '2026-03-01',
      fechaValor: '2026-03-01',
      importe: -34.47,
      conceptoLiteral: 'ELECTRICIDAD WEKIWI SL',
      importBatchId: 'lote-1',
      accountId: 1,
      hashLinea: 'h7',
      hashMovement: 'm7',
      estado: 'pendiente',
      movementIds: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      ...extra,
    }) as LineaExtractoPersistida;

  it('lo que se extrajo al importar viaja a la línea de sesión · no se vuelve a parsear', () => {
    const identificadores = [{ tipo: 'nif' as const, valor: 'B67686782' }];
    const [linea] = construirLineas([fila({ identificadores })], vacio, [], new Set());
    expect(linea.identificadores).toEqual(identificadores);
  });

  it('una línea anterior a E3.1 no los trae · y eso NO es un fallo, se recalculan', () => {
    const [linea] = construirLineas([fila()], vacio, [], new Set());
    expect(linea.identificadores).toBeUndefined();
  });
});
