// E3.1 · §7.3 · el catálogo nacional · lo que la tarea pide verificar.
import { clasificarLinea, type ContextoClasificacion } from '../../clasificacion/clasificarLinea';
import { catalogoDeFabrica, construirCatalogo, desdeProveedoresIrpf, porNif, porNombre } from '../catalogoNacional';
import { entidadesDelFicheroNacional } from '../desdeCatalogoNacional';
import { semillaDelCatalogo } from '../entidadesNacionales';
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
  it('el NIF de Iberdrola está CORREGIDO · y son DOS sociedades, no una', () => {
    // `providerDirectoryService` decía A95075578, que no es ninguna de las dos.
    // El fichero nacional trae A95758389 (Iberdrola Clientes) y los recibos
    // reales de Sabadell traen A95554630 en «Referencia 1» (+ sufijo SEPA 001),
    // cuyo concepto dice «IBERDROLA COMERCIALIZACION DE U»: el CUR. Sin el
    // segundo, el catálogo no casaría ni uno de los recibos de Jose.
    expect(porNif(catalogo, 'A95554630')?.nombre).toContain('Último Recurso');
    expect(porNif(catalogo, 'A95758389')?.nombre).toBe('Iberdrola Clientes');
    expect(porNif(catalogo, 'A95075578')).toBeUndefined();
    // Las dos son suministro · la de los recibos, además, luz.
    expect(porNif(catalogo, 'A95554630')?.familia).toBe('suministro');
    expect(porNif(catalogo, 'A95758389')?.familia).toBe('suministro');

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
      ...semillaDelCatalogo(),
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

  it('CARGA las 308 · y las que no se pueden clasificar sin inventar NO entran', () => {
    const delFichero = entidadesDelFicheroNacional();
    // 211 de 308: el resto son bancos, entidades de pago y gestoras.
    expect(delFichero.length).toBeGreaterThan(180);
    expect(delFichero.length).toBeLessThan(308);
    // Decisión 1 · un BANCO no propone familia: en esa lista están Santander,
    // Sabadell, Unicaja, BBVA e ING, los bancos del propio usuario, y un cargo
    // suyo puede ser una comisión, no la cuota de un crédito.
    for (const banco of ['BANCO SANTANDER', 'BANCO SABADELL', 'UNICAJA BANCO', 'CAIXABANK']) {
      expect([banco, porNombre(catalogo, banco)]).toEqual([banco, undefined]);
    }
    // …salvo las monoline de consumo, que se llaman banco pero solo dan crédito.
    expect(porNombre(catalogo, 'WIZINK BANK')?.subtipo).toBe('credito_consumo');
    // Decisión 2 · una entidad de pago es el tubo, no el destino.
    expect(porNombre(catalogo, 'PAYPAL')).toBeUndefined();
  });

  it('un CIF en DOS categorías pierde el subtipo · el recibo no dice cuál', () => {
    // Endesa Energía es el mismo CIF en LUZ y en GAS; Mapfre, en coche, hogar
    // y decesos. Se conserva la familia y NO se inventa el segundo nivel.
    expect(porNif(catalogo, 'A81948077')).toMatchObject({ familia: 'suministro' });
    expect(porNif(catalogo, 'A81948077')?.subtipo).toBeUndefined();
    expect(porNif(catalogo, 'A28141935')).toMatchObject({ familia: 'seguros_alarmas' });
    expect(porNif(catalogo, 'A28141935')?.subtipo).toBeUndefined();
    // Una que solo está en una categoría SÍ conserva el subtipo.
    expect(porNombre(catalogo, 'OCTOPUS ENERGY ESPANA')?.subtipo).toBe('luz');
  });

  it('un CIF que NO pasa el dígito de control entra solo por nombre', () => {
    // 6 filas del fichero traen un CIF que no valida. Cruzarlo por NIF cruzaría
    // un recibo con quien no es; por nombre sigue sirviendo.
    const octopus = entidadesDelFicheroNacional().find((e) => e.nombre.startsWith('Octopus'));
    expect(octopus?.nif).toBeUndefined();
    expect(octopus?.familia).toBe('suministro');
  });

  it('sin catálogo el motor funciona igual · este paso solo suma', () => {
    const c = clasificarLinea(mov('Recibo WiZink Bank'), { cuentas: [], tarjetas: [], nombresTitular: [] });
    expect(c.origen.familia).not.toBe('identificador');
  });
});
