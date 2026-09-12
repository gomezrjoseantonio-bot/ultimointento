// E3.1 · §7.3 · el catálogo nacional · lo que la tarea pide verificar.
import { clasificarLinea, type ContextoClasificacion } from '../../clasificacion/clasificarLinea';
import { catalogoDeFabrica, construirCatalogo, desdeProveedoresIrpf, porNif, porNombre } from '../catalogoNacional';
import { CATALOGO_NACIONAL_SEMILLA } from '../entidadesNacionales';
import type { Movement } from '../../db';

const catalogo = catalogoDeFabrica();

const ctx = (extra: Partial<ContextoClasificacion> = {}): ContextoClasificacion => ({
  cuentas: [],
  tarjetas: [],
  nombresTitular: [],
  catalogo,
  ...extra,
});

const mov = (description: string, amount = -100, extra: Partial<Movement> = {}): Movement =>
  ({ id: 1, accountId: 1, date: '2026-03-01', amount, description, ...extra }) as Movement;

describe('E3.1 · §7.3 · el catálogo nacional', () => {
  it('el NIF de Iberdrola está CORREGIDO y casa con el fixture real de Sabadell', () => {
    // `providerDirectoryService` decía A95075578; el que Sabadell escribe en
    // «Referencia 1» de los recibos reales es A95554630 (+ el sufijo SEPA 001).
    const e = porNif(catalogo, 'A95554630');
    expect(e?.nombre).toBe('Iberdrola Clientes');
    expect(porNif(catalogo, 'A95075578')).toBeUndefined();

    // Y el motor lo cruza leyendo la referencia tal cual la trae el fichero.
    const c = clasificarLinea(
      mov('ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105', -13.53, {
        reference: 'A95554630001 236136614000',
      } as Partial<Movement>),
      ctx(),
    );
    expect(c.familia).toBe('suministro');
    expect(c.subtipo).toBe('luz');
    expect(c.origen.familia).toBe('identificador');
  });

  it('una financiera NUNCA va a Supermercado · el catálogo gana a las reglas duras', () => {
    const casos: Array<[string, string]> = [
      ['Adeudo bankinter consumer finance', 'N 2025218000512711 BANKINTER CONSUMER FINANCE'],
      ['Recibo Servicios Financieros Carrefour', ''],
      ['Recibo WiZink Bank Nº Recibo 0049 0052 755 Aabbcc', ''],
      ['Recibo Cetelem Nº Recibo 0049 0052 755 Aabbcc', ''],
    ];
    for (const [descripcion, referencia] of casos) {
      const c = clasificarLinea(mov(descripcion, -351.43, { reference: referencia } as Partial<Movement>), ctx());
      expect([descripcion, c.familia]).toEqual([descripcion, 'prestamo_hipoteca']);
      expect([descripcion, c.subtipo]).toEqual([descripcion, 'credito_consumo']);
      expect([descripcion, c.origen.familia]).toEqual([descripcion, 'identificador']);
    }
  });

  it('el alias más largo gana · «Bankinter Consumer Finance» no es «Bankinter»', () => {
    const cat = construirCatalogo([
      { nombre: 'Bankinter', alias: ['BANKINTER'], familia: 'comisiones_bancarias' },
      ...CATALOGO_NACIONAL_SEMILLA,
    ]);
    expect(porNombre(cat, 'BANKINTER CONSUMER FINANCE')?.nombre).toBe('Bankinter Consumer Finance');
    expect(porNombre(cat, 'BANKINTER, S.A.')?.nombre).toBe('Bankinter');
  });

  it('un alias corto no se cuela · por debajo de cuatro caracteres no entra', () => {
    const cat = construirCatalogo([{ nombre: 'Equis', alias: ['EQ'], familia: 'otros' }]);
    expect(cat.porAlias).toHaveLength(0);
  });

  it('los proveedores del IRPF entran por NIF · y sin nombre NO aportan alias', () => {
    // Los 13 proveedores del snapshot real llegan todos con `sinNombre`.
    const desde = desdeProveedoresIrpf([
      { nif: 'B33558172', tipos: ['reparacion'], sinNombre: true },
      { nif: 'A82505660', nombre: 'Gestoría Ejemplo', tipos: ['gestion'] },
      { nif: 'X00000000', tipos: [] },
    ]);
    expect(desde).toHaveLength(2);
    const cat = construirCatalogo(desde);
    expect(porNif(cat, 'B33558172')?.familia).toBe('reparacion_mantenimiento');
    expect(porNif(cat, 'A82505660')?.familia).toBe('gestion');
    expect(cat.porAlias.map(([a]) => a)).toEqual(['GESTORIAEJEMPLO']);
  });

  it('sin catálogo el motor funciona igual · este paso solo suma', () => {
    const c = clasificarLinea(mov('Recibo WiZink Bank'), { cuentas: [], tarjetas: [], nombresTitular: [] });
    expect(c.origen.familia).not.toBe('identificador');
  });
});
