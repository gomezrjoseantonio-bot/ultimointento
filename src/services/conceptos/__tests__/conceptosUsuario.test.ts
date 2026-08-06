// Conceptos propios del usuario · Ajustes → Conceptos.
//
// Lo que vigilan estos tests es dónde está el límite. Que se pueda añadir un
// concepto está bien; lo que no puede pasar es que añadirlo sirva para escribir
// una casilla AEAT a mano, ni que nazca sin saber clasificarse en el ámbito
// donde se va a usar — que es exactamente el fallo del que salió toda esta
// tarea, sólo que esta vez lo estaría creando la propia app.

import {
  FAMILIAS,
  ambitosDe,
  conceptoPorId,
  conceptosDe,
  conceptosDeAmbito,
  conceptosEfectivos,
  donanteDe,
  proyectar,
  registrarConceptosDeUsuario,
} from '../catalogoConceptos';
import { CONCEPTOS_BASE } from '../conceptosBase';
import {
  borrarConceptoPropio,
  crearConceptoPropio,
  contarUsos,
  idDeConceptoPropio,
  leerConceptosUsuario,
  ocultar,
  puedeCrear,
  renombrar,
} from '../conceptosUsuarioService';
import { initDB } from '../../db';

const limpiar = async () => {
  const db = await initDB();
  await db.delete('keyval' as never, 'conceptosUsuario' as never);
  await db.clear('compromisosRecurrentes' as never);
  registrarConceptosDeUsuario([], {});
};

beforeEach(limpiar);
afterAll(limpiar);

// ─── El id ──────────────────────────────────────────────────────────────────

describe('el id de un concepto propio', () => {
  it('lleva prefijo y no arrastra acentos ni espacios', () => {
    // Este id se PERSISTE en cada gasto y se compara en crudo.
    expect(idDeConceptoPropio('Comisión de gestión')).toBe('usr_comision_de_gestion');
    expect(idDeConceptoPropio('  Café  ')).toBe('usr_cafe');
  });

  it('nunca sale vacío', () => {
    expect(idDeConceptoPropio('···')).toBe('usr_concepto');
  });

  it('no puede chocar con uno de fábrica · todos llevan el prefijo', () => {
    const deFabrica = new Set(CONCEPTOS_BASE.map((c) => c.id));
    expect([...deFabrica].filter((id) => id.startsWith('usr_'))).toEqual([]);
  });
});

// ─── Qué se deja crear ──────────────────────────────────────────────────────

describe('qué se deja crear', () => {
  it('un concepto en una familia que existe en ese ámbito', () => {
    expect(puedeCrear('suministros', 'Butano', ['personal'])).toEqual({
      ok: true,
      id: 'usr_butano',
    });
  });

  it('NO en un ámbito donde su familia no existe', () => {
    // «Servicios y explotación» es sólo de inmueble · no habría de quién
    // heredar la clasificación y nacería sin saber dónde va.
    expect(puedeCrear('servicios', 'Jardinero', ['personal'])).toEqual({
      ok: false,
      motivo: 'familia_sin_ambito',
    });
    expect(puedeCrear('suscripciones', 'Lo que sea', ['inmueble'])).toEqual({
      ok: false,
      motivo: 'familia_sin_ambito',
    });
  });

  it('NO sin nombre, sin ámbito, ni en una familia inventada', () => {
    expect(puedeCrear('suministros', '   ', ['personal'])).toEqual({
      ok: false,
      motivo: 'sin_nombre',
    });
    expect(puedeCrear('suministros', 'Butano', [])).toEqual({ ok: false, motivo: 'sin_ambito' });
    expect(puedeCrear('inventada', 'Butano', ['personal'])).toEqual({
      ok: false,
      motivo: 'familia_desconocida',
    });
  });

  it('NO si el id ya está ocupado', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal']);
    const datos = await leerConceptosUsuario();
    expect(puedeCrear('suministros', 'butano', ['personal'], datos.propios)).toEqual({
      ok: false,
      motivo: 'id_ocupado',
    });
  });

  it('cada familia tiene de quién heredar en cada ámbito donde existe', () => {
    // Si esto falla, alguna familia se quedó sin «otros» y crear ahí no sabría
    // clasificar. Es la regla que hace segura la herencia.
    const rotas = FAMILIAS.flatMap((f) =>
      (['personal', 'inmueble'] as const)
        .filter((a) => conceptosDe(f.id, a).length > 0 && !donanteDe(f.id, a))
        .map((a) => `${f.id}|${a}`),
    );
    expect(rotas).toEqual([]);
  });
});

// ─── La herencia ────────────────────────────────────────────────────────────

describe('un concepto propio hereda, no inventa', () => {
  it('proyecta exactamente como el «otros» de su familia', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal', 'inmueble']);
    expect(proyectar('usr_butano', 'personal')).toEqual(proyectar('otros_suministros', 'personal'));
    expect(proyectar('usr_butano', 'inmueble')).toEqual(proyectar('otros_suministros', 'inmueble'));
  });

  it('sólo vive en los ámbitos que se le dijeron', async () => {
    await crearConceptoPropio('seguros', 'Seguro de impago ampliado', ['inmueble']);
    const c = conceptoPorId('usr_seguro_de_impago_ampliado');
    expect(ambitosDe(c!)).toEqual(['inmueble']);
    expect(proyectar(c!.id, 'personal')).toBeUndefined();
  });

  it('sale en el selector de su familia, no al final de la lista', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal']);
    const lista = conceptosDe('suministros', 'personal').map((c) => c.id);
    expect(lista).toContain('usr_butano');
    // Y no se ha colado en otra familia.
    expect(conceptosDe('seguros', 'personal').map((c) => c.id)).not.toContain('usr_butano');
  });

  it('un propio con el id de uno de fábrica se ignora', () => {
    // Pisarlo cambiaría en silencio la clasificación de los gastos que lo usan.
    registrarConceptosDeUsuario(
      [{ id: 'luz', familia: 'seguros', label: 'Impostor', ambitos: ['personal'] }],
      {},
    );
    expect(conceptoPorId('luz')?.label).toBe('Luz');
    expect(conceptoPorId('luz')?.familia).toBe('suministros');
  });
});

// ─── Retoques ───────────────────────────────────────────────────────────────

describe('renombrar', () => {
  it('cambia el nombre pero no el id · el id es lo que guardan los gastos', async () => {
    await renombrar('luz', 'Electricidad');
    expect(conceptoPorId('luz')?.label).toBe('Electricidad');
    expect(conceptoPorId('electricidad')).toBeUndefined();
  });

  it('no toca la clasificación', async () => {
    const antes = proyectar('luz', 'inmueble');
    await renombrar('luz', 'Electricidad');
    expect(proyectar('luz', 'inmueble')).toEqual(antes);
  });

  it('volver al nombre de fábrica no deja ajuste guardado', async () => {
    await renombrar('luz', 'Electricidad');
    await renombrar('luz', 'Luz');
    expect((await leerConceptosUsuario()).ajustes).toEqual({});
  });

  it('un id que no existe se rechaza', async () => {
    await expect(renombrar('no_existe', 'Lo que sea')).rejects.toThrow(/no existe/i);
  });
});

describe('esconder', () => {
  it('lo saca de los selectores', async () => {
    await ocultar('gimnasio', true);
    expect(conceptosDeAmbito('personal').map((c) => c.id)).not.toContain('gimnasio');
  });

  it('pero NO lo borra · un gasto que ya lo usaba se sigue clasificando', async () => {
    await ocultar('gimnasio', true);
    expect(conceptoPorId('gimnasio')).toBeDefined();
    expect(proyectar('gimnasio', 'personal')).toEqual({ categoria: 'ocio', bolsa: 'deseos' });
  });

  it('se puede deshacer', async () => {
    await ocultar('gimnasio', true);
    await ocultar('gimnasio', false);
    expect(conceptosDeAmbito('personal').map((c) => c.id)).toContain('gimnasio');
    expect((await leerConceptosUsuario()).ajustes).toEqual({});
  });
});

// ─── Borrar ─────────────────────────────────────────────────────────────────

describe('borrar un concepto propio', () => {
  const gasto = (concepto: string) => ({
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Un gasto',
    tipo: 'otros',
    concepto,
    proveedor: { nombre: '' },
    patron: { tipo: 'mensual', diaMes: 1 },
    importe: { modo: 'fijo', importe: 10 },
    cuentaCargo: 1,
    conceptoBancario: '',
    metodoPago: 'domiciliacion',
    categoria: 'vivienda.suministros',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
  });

  it('se va si no lo usa nadie', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal']);
    await borrarConceptoPropio('usr_butano');
    expect(conceptoPorId('usr_butano')).toBeUndefined();
  });

  it('NO se va si hay gastos usándolo · quedarían apuntando a nada', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal']);
    const db = await initDB();
    await db.add('compromisosRecurrentes' as never, gasto('usr_butano') as never);

    await expect(borrarConceptoPropio('usr_butano')).rejects.toThrow(/1 gasto/);
    expect(conceptoPorId('usr_butano')).toBeDefined();
  });

  it('los de fábrica no se pueden borrar por esta vía', async () => {
    await expect(borrarConceptoPropio('luz')).resolves.toBeDefined();
    // No estaba entre los propios, así que sigue en el catálogo.
    expect(conceptoPorId('luz')).toBeDefined();
  });
});

describe('el recuento de usos', () => {
  it('cuenta por concepto y no inventa ceros', async () => {
    const db = await initDB();
    for (const c of ['luz', 'luz', 'gas']) {
      await db.add('compromisosRecurrentes' as never, {
        ambito: 'personal',
        alias: 'x',
        tipo: 'suministro',
        concepto: c,
        proveedor: { nombre: '' },
        patron: { tipo: 'mensual', diaMes: 1 },
        importe: { modo: 'fijo', importe: 1 },
        cuentaCargo: 1,
        conceptoBancario: '',
        metodoPago: 'domiciliacion',
        categoria: 'vivienda.suministros',
        bolsaPresupuesto: 'necesidades',
        responsable: 'titular',
        fechaInicio: '2026-01-01',
        estado: 'activo',
        createdAt: '',
        updatedAt: '',
      } as never);
    }
    expect(await contarUsos()).toEqual({ luz: 2, gas: 1 });
  });
});

// ─── El catálogo de fábrica no se mueve ─────────────────────────────────────

describe('nada de esto toca el catálogo de fábrica', () => {
  it('sigue teniendo sus 60 conceptos después de añadir y esconder', async () => {
    await crearConceptoPropio('suministros', 'Butano', ['personal']);
    await ocultar('gimnasio', true);
    expect(CONCEPTOS_BASE).toHaveLength(60);
    expect(conceptosEfectivos()).toHaveLength(61);
  });

  it('ningún propio puede traer casilla AEAT propia', async () => {
    // La proyección de inmueble se copia entera del donante · no hay forma de
    // que un concepto de usuario apunte a una `categoryKey` que su familia no
    // usara ya.
    await crearConceptoPropio('servicios', 'Jardinero', ['inmueble']);
    const keysDeFabrica = new Set(
      CONCEPTOS_BASE.filter((c) => c.inmueble).map((c) => c.inmueble!.categoryKey),
    );
    for (const c of conceptosEfectivos()) {
      if (!c.inmueble) continue;
      expect({ id: c.id, conocida: keysDeFabrica.has(c.inmueble.categoryKey) }).toEqual({
        id: c.id,
        conocida: true,
      });
    }
  });
});
