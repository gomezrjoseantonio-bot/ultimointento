// Migración al catálogo unificado.
//
// Lo que vigilan estos tests no es sólo que se escriba `concepto`: es que la
// migración NO invente destinos, que realinee los derivados al ámbito del
// registro, y que la segunda pasada no cambie nada. Escribe sobre todos los
// gastos del usuario a la vez, así que un fallo aquí se lleva la clasificación
// entera y con ella las casillas de la declaración.

import {
  fixCasilla0108,
  migrarConceptoUnificado,
  realinearDerivados,
  resolverParaCompromiso,
} from '../migrarConceptoUnificado';
import { initDB } from '../../db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente> = {}): Record<string, unknown> => ({
  ambito: 'personal',
  personalDataId: 1,
  alias: 'Un gasto',
  tipo: 'otros',
  proveedor: { nombre: 'Alguien' },
  patron: { tipo: 'mensual', diaMes: 1 },
  importe: { tipo: 'fijo', valor: 10 },
  cuentaCargo: 1,
  conceptoBancario: 'ALGUIEN',
  metodoPago: 'domiciliacion',
  categoria: 'personal',
  bolsaPresupuesto: 'deseos',
  responsable: 'titular',
  fechaInicio: '2026-01-01',
  estado: 'activo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const guardar = async (valor: Record<string, unknown>): Promise<number> => {
  const db = await initDB();
  return (await db.add('compromisosRecurrentes' as never, valor as never)) as number;
};

const leer = async (id: number): Promise<Record<string, any>> => {
  const db = await initDB();
  return (await db.get('compromisosRecurrentes' as never, id as never)) as Record<string, any>;
};

const limpiar = async () => {
  const db = await initDB();
  await db.clear('compromisosRecurrentes' as never);
  await db.clear('gastosInmueble' as never);
};

// ─── Resolución ─────────────────────────────────────────────────────────────

describe('de dónde sale el concepto', () => {
  it('del par (tipoFamilia, subtipo) cuando lo hay', () => {
    const c = base({ tipoFamilia: 'suministros', subtipo: 'movil' }) as unknown as CompromisoRecurrente;
    expect(resolverParaCompromiso(c)).toEqual({ concepto: 'telefonia', via: 'par' });
  });

  it('del subtipo suelto SÓLO si en ese ámbito no hay elección', () => {
    // `tipoFamilia` se rellenó a posteriori (V68), así que hay registros que
    // sólo tienen subtipo. `luz` no puede ser otra cosa.
    const c = base({ subtipo: 'luz' }) as unknown as CompromisoRecurrente;
    expect(resolverParaCompromiso(c)).toEqual({ concepto: 'luz', via: 'subtipo_unico' });
  });

  it('un subtipo ambiguo NO se resuelve · `otros` existe en nueve familias', () => {
    const c = base({ subtipo: 'otros' }) as unknown as CompromisoRecurrente;
    expect(resolverParaCompromiso(c)).toEqual({ motivo: 'subtipo_ambiguo' });
  });

  it('sin nada de donde tirar, no se adivina', () => {
    expect(resolverParaCompromiso(base() as unknown as CompromisoRecurrente)).toEqual({
      motivo: 'par_desconocido',
    });
  });

  it('un concepto que no aplica al ámbito se rechaza en vez de escribirse', () => {
    // `gimnasio` sólo existe en personal · un registro de inmueble con esa
    // familia está roto, y ponerle el concepto lo dejaría igual de invisible.
    const c = base({
      ambito: 'inmueble',
      inmuebleId: 1,
      tipoFamilia: 'seguros_cuotas',
      subtipo: 'gimnasio',
    }) as unknown as CompromisoRecurrente;
    expect(resolverParaCompromiso(c)).toEqual({ motivo: 'concepto_no_aplica_al_ambito' });
  });

  it('un concepto ya escrito y válido se respeta', () => {
    const c = base({ concepto: 'streaming', tipoFamilia: 'suscripciones', subtipo: 'musica' }) as unknown as CompromisoRecurrente;
    expect(resolverParaCompromiso(c)).toEqual({ concepto: 'streaming', via: 'ya_tenia' });
  });
});

// ─── Realineado ─────────────────────────────────────────────────────────────

describe('los derivados se realinean al ámbito', () => {
  it('sólo devuelve lo que de verdad cambia', () => {
    const c = base({
      concepto: 'streaming',
      categoria: 'suscripciones',
      bolsaPresupuesto: 'deseos',
      tipo: 'suscripcion',
    }) as unknown as CompromisoRecurrente;
    const { parche, realineados } = realinearDerivados(c, 'streaming');
    expect(realineados).toEqual({});
    expect(parche).toEqual({});
  });

  it('un gasto de inmueble no lleva bolsa del 50/30/20', () => {
    const c = base({
      ambito: 'inmueble',
      inmuebleId: 1,
      bolsaPresupuesto: 'necesidades',
      tipoFamilia: 'tributos',
      subtipo: 'ibi',
    }) as unknown as CompromisoRecurrente;
    const { parche } = realinearDerivados(c, 'ibi');
    expect(parche.bolsaPresupuesto).toBe('inmueble');
    expect(parche.categoria).toBe('inmueble.ibi');
  });

  it('el mismo concepto proyecta distinto en cada ámbito', () => {
    const personal = base({ tipoFamilia: 'suministros', subtipo: 'luz' }) as unknown as CompromisoRecurrente;
    const inmueble = base({ ambito: 'inmueble', inmuebleId: 1, tipoFamilia: 'suministros', subtipo: 'luz' }) as unknown as CompromisoRecurrente;
    expect(realinearDerivados(personal, 'luz').parche.categoria).toBe('vivienda.suministros');
    expect(realinearDerivados(inmueble, 'luz').parche.categoria).toBe('inmueble.suministros');
  });
});

// ─── Sobre la base ──────────────────────────────────────────────────────────

describe('la pasada completa', () => {
  beforeEach(limpiar);

  it('el seguro de vida de ING deja de estar en tierra de nadie', async () => {
    // El gasto que abrió todo esto: ámbito PERSONAL, familia `seguros` (que no
    // existe en el catálogo personal) y categoría de INMUEBLE. Se cobraba cada
    // mes y no aparecía en ninguna pantalla donde poder tocarlo.
    const id = await guardar(
      base({
        alias: 'Vida',
        tipoFamilia: 'seguros',
        subtipo: 'vida',
        categoria: 'inmueble.seguros',
        bolsaPresupuesto: 'necesidades',
        tipo: 'otros',
      }),
    );

    const r = await migrarConceptoUnificado();

    expect(r.sinResolver).toEqual([]);
    const despues = await leer(id);
    expect(despues.concepto).toBe('seguro_vida');
    expect(despues.categoria).toBe('salud');
    expect(despues.bolsaPresupuesto).toBe('necesidades');
    expect(despues.tipo).toBe('seguro');
    expect(r.cambios[0].realineados.categoria).toEqual({
      antes: 'inmueble.seguros',
      despues: 'salud',
    });
  });

  it('lo que no se sabe traducir se queda INTACTO y sale en el informe', async () => {
    const id = await guardar(base({ alias: 'Vete a saber', subtipo: 'otros', categoria: 'personal' }));

    const r = await migrarConceptoUnificado();

    expect(r.cambios).toEqual([]);
    expect(r.sinResolver).toEqual([
      {
        id,
        alias: 'Vete a saber',
        ambito: 'personal',
        tipoFamilia: undefined,
        subtipo: 'otros',
        categoria: 'personal',
        motivo: 'subtipo_ambiguo',
      },
    ]);
    const despues = await leer(id);
    expect(despues.concepto).toBeUndefined();
    expect(despues.categoria).toBe('personal');
  });

  it('la segunda pasada no cambia nada', async () => {
    await guardar(base({ tipoFamilia: 'suministros', subtipo: 'luz' }));
    await guardar(base({ ambito: 'inmueble', inmuebleId: 1, tipoFamilia: 'tributos', subtipo: 'ibi' }));

    const primera = await migrarConceptoUnificado();
    expect(primera.cambios).toHaveLength(2);

    const segunda = await migrarConceptoUnificado();
    expect(segunda.cambios).toEqual([]);
    expect(segunda.revisados).toBe(2);
  });

  it('no toca `tipoFamilia` ni `subtipo` · queda código leyéndolos', async () => {
    const id = await guardar(base({ tipoFamilia: 'suministros', subtipo: 'movil' }));
    await migrarConceptoUnificado();
    const despues = await leer(id);
    expect({ f: despues.tipoFamilia, s: despues.subtipo }).toEqual({
      f: 'suministros',
      s: 'movil',
    });
  });

  it('un registro sin resolver no impide migrar a los demás', async () => {
    await guardar(base({ alias: 'Roto', subtipo: 'otros' }));
    const bueno = await guardar(base({ alias: 'Luz', tipoFamilia: 'suministros', subtipo: 'luz' }));

    const r = await migrarConceptoUnificado();

    expect(r.sinResolver).toHaveLength(1);
    expect((await leer(bueno)).concepto).toBe('luz');
  });
});

// ─── La 0108 ────────────────────────────────────────────────────────────────

describe('la casilla 0108 de las líneas ya escritas', () => {
  beforeEach(limpiar);

  const linea = (casillaAEAT: string) => ({
    inmuebleId: 1,
    ejercicio: 2026,
    fecha: '2026-03-15',
    concepto: 'Limpieza',
    categoria: 'servicio',
    importe: 80,
    casillaAEAT,
    estado: 'previsto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const guardarLinea = async (v: Record<string, unknown>) => {
    const db = await initDB();
    return db.add('gastosInmueble' as never, v as never);
  };

  it('pasa a la 0112 · la 0108 es el arrastre de la 0107, no un gasto', async () => {
    const id = (await guardarLinea(linea('0108'))) as number;
    const r = await fixCasilla0108();
    expect(r.corregidos).toBe(1);
    const db = await initDB();
    const despues = (await db.get('gastosInmueble' as never, id as never)) as Record<string, any>;
    expect(despues.casillaAEAT).toBe('0112');
  });

  it('las demás casillas se dejan en paz', async () => {
    for (const casilla of ['0106', '0109', '0112', '0113', '0114', '0115', '0117']) {
      await guardarLinea(linea(casilla));
    }
    const r = await fixCasilla0108();
    expect(r.corregidos).toBe(0);
  });

  it('la segunda pasada no encuentra nada', async () => {
    await guardarLinea(linea('0108'));
    await fixCasilla0108();
    expect((await fixCasilla0108()).corregidos).toBe(0);
  });
});
