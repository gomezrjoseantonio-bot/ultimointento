// E3.1 · §7.3 · el catálogo nacional · lo que la tarea pide verificar.
import { clasificarLinea, type ContextoClasificacion } from '../../clasificacion/clasificarLinea';
import { aprenderEnCatalogo, catalogoDeFabrica, construirCatalogo, desdeProveedoresIrpf, porNif, porNombre } from '../catalogoNacional';
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

  it('E3.1b · lo aprendido va a `proveedores`, que es el ÚNICO sitio · y suma confirmaciones', async () => {
    const filas = new Map<string, Record<string, unknown>>();
    const db = {
      get: async (_s: string, k: unknown) => filas.get(String(k)),
      put: async (store: string, v: unknown) => {
        // Afirmar el DESTINO es el punto de este test: si una regresión vuelve
        // a escribir en un store aparte, esto tiene que caerse.
        expect(store).toBe('proveedores');
        const fila = v as { nif: string };
        filas.set(fila.nif, fila as Record<string, unknown>);
        return 1;
      },
    };
    const entrada = { nombre: 'WiZink Bank', nif: 'A81831067', alias: ['WIZINK'], familia: 'prestamo_hipoteca' as const, origen: 'nacional' as const };
    const primera = await aprenderEnCatalogo(db, entrada);
    expect(primera?.confirmaciones).toBe(1);
    expect(primera?.nif).toBe('A81831067');
    expect(primera?.origen).toBe('nacional');
    // La misma entidad otra vez NO se duplica: suma una confirmación.
    const segunda = await aprenderEnCatalogo(db, { ...entrada, alias: ['WIZINK BANK SA'] });
    expect(segunda?.confirmaciones).toBe(2);
    expect(filas.size).toBe(1);
    expect(segunda?.alias).toEqual(['WIZINK', 'WIZINK BANK SA']);
  });

  it('aprender NO pisa lo que ya era del cliente · ni sus `tipos` AEAT ni su familia', async () => {
    // El fontanero ya está en `proveedores` con su casilla AEAT puesta por la
    // declaración. El motor no puede cambiarle eso por reconocer un recibo.
    const existente = {
      nif: 'B33558172',
      tipos: ['reparacion'],
      familia: 'reparacion_mantenimiento',
      origen: 'cliente',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const filas = new Map<string, Record<string, unknown>>([['B33558172', existente]]);
    const db = {
      get: async (_s: string, k: unknown) => filas.get(String(k)),
      put: async (store: string, v: unknown) => {
        expect(store).toBe('proveedores');
        filas.set((v as { nif: string }).nif, v as Record<string, unknown>);
        return 1;
      },
    };
    const tras = await aprenderEnCatalogo(db, { nif: 'B33558172', familia: 'suministro', origen: 'nacional' });
    expect(tras?.tipos).toEqual(['reparacion']);
    expect(tras?.familia).toBe('reparacion_mantenimiento');
    expect(tras?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(tras?.confirmaciones).toBe(1);
  });

  it('un DNI NO se puede marcar como compartible · lo comprueba quien ESCRIBE', () => {
    // La invariante no puede vivir solo en el llamador: el próximo llamador la
    // rompe sin enterarse, y lo que está en juego es el DNI de una persona.
    const filas = new Map<string, Record<string, unknown>>();
    const db = {
      get: async (_s: string, k: unknown) => filas.get(String(k)),
      put: async (_s: string, v: unknown) => {
        filas.set((v as { nif: string }).nif, v as Record<string, unknown>);
        return 1;
      },
    };
    const avisos: string[] = [];
    return (async () => {
      // Un DNI de persona, pedido como 'nacional' → se degrada y se avisa.
      const dni = await aprenderEnCatalogo(
        db,
        { nif: '04621623A', familia: 'reparacion_mantenimiento', origen: 'nacional' },
        (m) => avisos.push(m),
      );
      expect(dni?.origen).toBe('cliente');
      expect(avisos.join()).toContain('no es un CIF de empresa');
      // Un CIF de empresa sí.
      const cif = await aprenderEnCatalogo(db, { nif: 'A81831067', familia: 'prestamo_hipoteca', origen: 'nacional' });
      expect(cif?.origen).toBe('nacional');
    })();
  });

  it('la corrección del cliente gana TAMBIÉN buscando por nombre, no solo por NIF', () => {
    // Si el cliente corrige una entidad del fichero nacional y el banco escribe
    // el NOMBRE (no el CIF), el alias tiene que devolver SU versión. Antes
    // devolvía la del fichero: la misma empresa se clasificaba de dos maneras
    // según lo que el banco hubiera escrito.
    const delCliente = [
      { nombre: 'Iberdrola (lo mío)', nif: 'A95554630', alias: [], familia: 'reparacion_mantenimiento' as const },
    ];
    const cat = construirCatalogo(delCliente, semillaDelCatalogo());
    expect(porNif(cat, 'A95554630')?.familia).toBe('reparacion_mantenimiento');
    expect(porNombre(cat, 'ELECTRICIDAD IBERDROLA')?.familia).toBe('reparacion_mantenimiento');
  });

  it('el banco escribe la MARCA, no la sociedad · «RECIBO NATURGY» tiene que casar', () => {
    // El fichero trae «Naturgy Iberia», «Endesa Energía», «Orange España». Los
    // alias se comparan por contención, así que un alias largo NO casa con un
    // texto corto: «RECIBO NATURGY» no contiene «NATURGYIBERIA». Cuatro de las
    // marcas más comunes de España se quedaban fuera por esto.
    for (const texto of ['RECIBO NATURGY', 'RECIBO ORANGE', 'RECIBO ENDESA', 'RECIBO IBERDROLA']) {
      expect([texto, porNombre(catalogo, texto)?.familia]).toEqual([texto, 'suministro']);
    }
  });

  it('…pero NO se recorta cuando la marca significa otra cosa fuera de su sector', () => {
    // Éstas son las que NO pueden casar, y el motivo es distinto en cada una:
    //  · «Carrefour Telecom» recortado mandaría la compra del súper a telefonía;
    //  · una FINANCIERA nunca se recorta: su nombre largo ES la señal;
    //  · «Repsol» a secas es la gasolinera, no la comercializadora de luz.
    for (const texto of ['COMPRA CARREFOUR', 'RECIBO EL CORTE INGLES', 'COMPRA REPSOL']) {
      expect([texto, porNombre(catalogo, texto)]).toEqual([texto, undefined]);
    }
    // Y con el nombre largo, la financiera sí casa.
    expect(porNombre(catalogo, 'ADEUDO FINANCIERA CARREFOUR')?.subtipo).toBe('credito_consumo');
  });

  it('sin catálogo el motor funciona igual · este paso solo suma', () => {
    const c = clasificarLinea(mov('Recibo WiZink Bank'), { cuentas: [], tarjetas: [], nombresTitular: [] });
    expect(c.origen.familia).not.toBe('identificador');
  });
});
