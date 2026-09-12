// E3.1c · el catálogo vive en el store · un catálogo nacional + lo que creas tú.
import { sembrarCatalogoNacional } from '../sembrarCatalogo';
import type { Proveedor } from '../../db/types-proveedores';

function baseCon(filas: Proveedor[]) {
  const store = new Map(filas.map((f) => [f.nif, f]));
  return {
    store,
    db: {
      getAll: async () => Array.from(store.values()),
      put: async (_s: string, v: unknown) => {
        const f = v as Proveedor;
        store.set(f.nif, f);
        return 1;
      },
    },
  };
}

const proveedor = (p: Partial<Proveedor> & { nif: string }): Proveedor =>
  ({ tipos: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...p }) as Proveedor;

describe('E3.1c · el catálogo nacional se siembra en `proveedores`', () => {
  it('una base vacía se llena · y ahí es donde puedes añadir y corregir', async () => {
    const { store, db } = baseCon([]);
    const r = await sembrarCatalogoNacional(db);
    expect(r.creados).toBeGreaterThan(25);
    expect(store.size).toBe(r.creados);
    // Las que tienen CIF entran con su familia puesta.
    const wizink = store.get('A81831067');
    expect(wizink).toMatchObject({ familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', origen: 'nacional' });
    const iberdrola = store.get('A95554630');
    expect(iberdrola).toMatchObject({ familia: 'suministro', subtipo: 'luz', origen: 'nacional' });
  });

  it('sembrar DOS veces no duplica · la segunda solo refresca', async () => {
    const { store, db } = baseCon([]);
    const primera = await sembrarCatalogoNacional(db);
    const cuantos = store.size;
    const segunda = await sembrarCatalogoNacional(db);
    expect(store.size).toBe(cuantos);
    expect(segunda.creados).toBe(0);
    expect(segunda.refrescados).toBe(primera.creados);
  });

  it('LO QUE TÚ TOCAS NO SE PISA · ni ahora ni en la próxima versión', async () => {
    // Corriges Iberdrola a mano; la semilla no puede volver a cambiarla nunca.
    const mio = proveedor({
      nif: 'A95554630',
      nombre: 'Iberdrola, la mía',
      familia: 'reparacion_mantenimiento',
      tipos: ['reparacion'],
      origen: 'cliente',
    });
    const { store, db } = baseCon([mio]);
    const r = await sembrarCatalogoNacional(db);
    expect(r.respetados).toBeGreaterThan(0);
    expect(store.get('A95554630')).toEqual(mio);
  });

  it('un proveedor TUYO que la semilla no conoce se queda como está', async () => {
    const fontanero = proveedor({ nif: 'B33558172', tipos: ['reparacion'], familia: 'reparacion_mantenimiento', origen: 'cliente' });
    const { store, db } = baseCon([fontanero]);
    await sembrarCatalogoNacional(db);
    expect(store.get('B33558172')).toEqual(fontanero);
  });

  it('nunca pisa los `tipos` AEAT ni la fecha de alta de una fila nacional', async () => {
    const conAeat = proveedor({
      nif: 'A81831067',
      tipos: ['gestion'],
      origen: 'nacional',
      createdAt: '2020-05-05T00:00:00.000Z',
    });
    const { store, db } = baseCon([conAeat]);
    await sembrarCatalogoNacional(db);
    const tras = store.get('A81831067');
    expect(tras?.tipos).toEqual(['gestion']);
    expect(tras?.createdAt).toBe('2020-05-05T00:00:00.000Z');
    // …pero sí actualiza lo que es del catálogo.
    expect(tras?.familia).toBe('prestamo_hipoteca');
  });

  it('si la base falla, avisa y no rompe la apertura', async () => {
    const avisos: string[] = [];
    const r = await sembrarCatalogoNacional(
      { getAll: async () => { throw new Error('boom'); }, put: async () => 1 },
      (m) => avisos.push(m),
    );
    expect(r).toEqual({ creados: 0, refrescados: 0, respetados: 0 });
    expect(avisos.join()).toContain('no se pudo leer');
  });
});
