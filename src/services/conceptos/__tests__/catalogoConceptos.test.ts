// Candado de equivalencia del catálogo unificado.
//
// El riesgo que cubre: unificar dos catálogos es reescribir la clasificación de
// TODOS los gastos a la vez. Si al hacerlo se mueve una proyección —aunque sea
// una— cambia la casilla AEAT de ese gasto y la declaración sale distinta sin
// que nadie haya decidido nada.
//
// Por eso estos tests no comparan el catálogo contra una copia congelada: lo
// comparan, par a par, contra las FUENTES VIVAS que la app usa hoy. Para cada
// par (tipoFamilia, subtipo) que existe hoy, la proyección del concepto nuevo
// tiene que ser idéntica a la que ese par produce actualmente. Mientras estos
// tests pasen, el paso 2 no toca la declaración de nadie.

import {
  CONCEPTOS,
  FAMILIAS,
  ambitosDe,
  conceptoPorId,
  conceptosDe,
  conceptosDeAmbito,
  familiasDeAmbito,
  proyectar,
  requierenPregunta,
} from '../catalogoConceptos';
import type { Concepto, ProyeccionInmueble, ProyeccionPersonal } from '../catalogoConceptos';
import { MAPA_LEGACY, resolverConcepto } from '../mapaLegacy';
import { TIPOS_GASTO_INMUEBLE_V2 } from './fixtures/baselineInmuebleLegacy';
import { TIPOS_GASTO_PERSONAL } from '../../../modules/personal/wizards/utils/tiposDeGastoPersonal';
import { TRADUCCION_INMUEBLE } from '../../catalogoPresentacionPersistencia';
import { getCategoryByKey } from '../../categoryCatalog';

/** Aplana un catálogo de presentación a `familia:subtipo` → subtipo. */
const aplanar = <T extends { id: string }>(
  catalogo: ReadonlyArray<{ id: string; subtipos: readonly T[] }>,
): Record<string, T> =>
  Object.fromEntries(catalogo.flatMap((f) => f.subtipos.map((s) => [`${f.id}:${s.id}`, s])));

const PERSONAL = aplanar(TIPOS_GASTO_PERSONAL);
const INMUEBLE = aplanar(TIPOS_GASTO_INMUEBLE_V2);

describe('la proyección personal es la que ya había', () => {
  it.each(Object.keys(PERSONAL))('%s · misma categoría y misma bolsa', (par) => {
    const viejo = PERSONAL[par];
    const nuevo = proyectar(MAPA_LEGACY[par], 'personal') as ProyeccionPersonal | undefined;
    expect({ par, categoria: nuevo?.categoria, bolsa: nuevo?.bolsa }).toEqual({
      par,
      categoria: viejo.categoria,
      bolsa: viejo.bolsa,
    });
  });
});

describe('la proyección de inmueble es la que ya había', () => {
  it.each(Object.keys(INMUEBLE))('%s · misma categoría, misma key y mismo estado', (par) => {
    const viejo = INMUEBLE[par];
    const traduccion = TRADUCCION_INMUEBLE[par];
    const nuevo = proyectar(MAPA_LEGACY[par], 'inmueble') as ProyeccionInmueble | undefined;
    expect({
      par,
      categoria: nuevo?.categoria,
      categoryKey: nuevo?.categoryKey,
      subtypeKey: nuevo?.subtypeKey,
      estado: nuevo?.estado,
    }).toEqual({
      par,
      categoria: viejo.categoria,
      categoryKey: traduccion.categoryKey,
      subtypeKey: traduccion.subtypeKey,
      estado: traduccion.estado,
    });
  });
});

describe('el tipo de compromiso tampoco se mueve', () => {
  it.each([...Object.entries(PERSONAL), ...Object.entries(INMUEBLE)])(
    '%s',
    (par, subtipo: { tipoCompromiso: string }) => {
      expect({ par, tc: conceptoPorId(MAPA_LEGACY[par])?.tipoCompromiso }).toEqual({
        par,
        tc: subtipo.tipoCompromiso,
      });
    },
  );
});

describe('los ámbitos nuevos sin fuente viva', () => {
  // Unificar (paso 2) abrió 5 combinaciones que antes no se podían elegir; P8a
  // (reconciliación al §9 quater) añadió conceptos nuevos y dio ámbito personal a
  // mobiliario y reparaciones. Ninguno hereda de una fuente viva, así que van
  // enumerados: si mañana aparece uno sin que nadie lo haya decidido, este test
  // lo caza. El catálogo es para tesorería (salidas de dinero); la fiscalidad de
  // estos nuevos es capa de encima diferida.
  const NUEVOS = [
    // paso 2 · unificación
    ['tasa_basuras', 'personal'],
    ['derrama', 'personal'],
    ['otros_comunidad', 'personal'],
    ['alarma', 'personal'],
    ['seguro_vida', 'inmueble'],
    // P8a · conceptos nuevos (§9 quater)
    ['circulacion', 'personal'],
    ['seguro_decesos', 'personal'],
    ['reparacion_vehiculo', 'personal'],
    ['reparacion_caldera', 'personal'],
    ['reparacion_caldera', 'inmueble'],
    ['reparacion_electrodomesticos', 'personal'],
    ['reparacion_electrodomesticos', 'inmueble'],
    ['mantenimiento_itv', 'personal'],
    ['alquiler_vehiculo', 'personal'],
    ['viaje', 'personal'],
    // P8a · ámbito personal añadido a conceptos que ya existían
    ['mantenimiento_caldera', 'personal'],
    ['otros_reparacion', 'personal'],
    ['ropa_enseres', 'personal'],
    ['muebles', 'personal'],
    ['otros_mobiliario', 'personal'],
  ] as const;

  const conFuente = new Set<string>();
  for (const par of Object.keys(PERSONAL)) conFuente.add(`${MAPA_LEGACY[par]}|personal`);
  for (const par of Object.keys(INMUEBLE)) conFuente.add(`${MAPA_LEGACY[par]}|inmueble`);

  it('son exactamente éstos y ningún otro', () => {
    const sinFuente = CONCEPTOS.flatMap((c) =>
      ambitosDe(c)
        .filter((a) => !conFuente.has(`${c.id}|${a}`))
        .map((a) => `${c.id}|${a}`),
    ).sort();
    expect(sinFuente).toEqual(NUEVOS.map(([id, a]) => `${id}|${a}`).sort());
  });

  it('cada uno proyecta igual que su hermano de familia', () => {
    // `tasa_basuras` como el IBI, la derrama como la cuota de comunidad, la
    // alarma como la luz, el seguro de vida como el de hogar.
    expect(proyectar('tasa_basuras', 'personal')).toEqual(proyectar('ibi', 'personal'));
    expect(proyectar('derrama', 'personal')).toEqual(proyectar('comunidad_ordinaria', 'personal'));
    expect(proyectar('otros_comunidad', 'personal')).toEqual(
      proyectar('comunidad_ordinaria', 'personal'),
    );
    expect(proyectar('alarma', 'personal')).toEqual(proyectar('luz', 'personal'));
    expect(proyectar('seguro_vida', 'inmueble')).toEqual(proyectar('seguro_hogar', 'inmueble'));
  });
});

describe('los Tipos son los del §9 quater (P8a)', () => {
  it('la lista de Tipos es exactamente la acordada, en orden', () => {
    expect(FAMILIAS.map((f) => f.id)).toEqual([
      'comunidad', 'tributos', 'seguros', 'reparacion', 'mantenimiento',
      'suministros', 'alarma', 'gestion', 'limpieza', 'supermercado',
      'transporte', 'farmacia', 'suscripciones', 'ocio', 'viaje',
      'restaurante', 'ropa', 'cuidado_personal', 'alquiler', 'mobiliario',
      'otros',
    ]);
  });

  it('Hipoteca/préstamo NO está en el catálogo · nace en Financiación', () => {
    expect(FAMILIAS.some((f) => f.id === ('hipoteca' as never))).toBe(false);
    expect(CONCEPTOS.some((c) => c.id === 'hipoteca_cuota')).toBe(false);
  });

  it('los subtipos que pidió Jose existen', () => {
    for (const id of [
      'circulacion', 'seguro_decesos', 'reparacion_vehiculo',
      'reparacion_electrodomesticos', 'reparacion_caldera', 'mantenimiento_caldera',
      'mantenimiento_coche', 'mantenimiento_itv', 'alquiler_vehiculo', 'viaje',
    ]) {
      expect(conceptoPorId(id)?.id).toBe(id);
    }
  });

  it('mobiliario se puede elegir también en personal (comprar un mueble de tu casa)', () => {
    for (const id of ['muebles', 'ropa_enseres']) {
      expect(ambitosDe(conceptoPorId(id) as Concepto).sort()).toEqual(['inmueble', 'personal']);
    }
  });
});

describe('el árbol es coherente consigo mismo', () => {
  it('todo concepto tiene al menos un ámbito · si no, no se puede ni elegir', () => {
    expect(CONCEPTOS.filter((c) => ambitosDe(c).length === 0).map((c) => c.id)).toEqual([]);
  });

  it('los ids no se repiten', () => {
    const ids = CONCEPTOS.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('toda familia declarada tiene conceptos, y todo concepto una familia declarada', () => {
    const declaradas = new Set(FAMILIAS.map((f) => f.id));
    const usadas = new Set(CONCEPTOS.map((c) => c.familia));
    expect([...usadas].filter((f) => !declaradas.has(f))).toEqual([]);
    expect([...declaradas].filter((f) => !usadas.has(f as never))).toEqual([]);
  });

  it('cada familia agrupa conceptos seguidos · el orden del array es el del selector', () => {
    const vistas = new Set<string>();
    let anterior = '';
    const rotas: string[] = [];
    for (const c of CONCEPTOS) {
      if (c.familia !== anterior) {
        if (vistas.has(c.familia)) rotas.push(c.id);
        vistas.add(c.familia);
        anterior = c.familia;
      }
    }
    expect(rotas).toEqual([]);
  });
});

describe('la casilla AEAT sale del catálogo de persistencia, no de aquí', () => {
  it('toda categoryKey de inmueble existe en categoryCatalog', () => {
    const rotas = CONCEPTOS.filter((c) => c.inmueble?.categoryKey)
      .filter((c) => getCategoryByKey(c.inmueble!.categoryKey!) === undefined)
      .map((c) => `${c.id} → ${c.inmueble!.categoryKey}`);
    expect(rotas).toEqual([]);
  });

  it('toda categoryKey de gasto lleva casilla · salvo la excepción conocida', () => {
    // `otros_inmueble` no tiene casilla en `categoryCatalog`: es el gasto que
    // escribe el usuario a mano, y su tratamiento no se puede deducir del
    // concepto —igual que la derrama—. Hoy la casilla se la acaba poniendo
    // `CATEGORIA_A_CASILLA` a partir de la categoría, no la key. Queda anotado
    // aquí, y no arreglado, porque arreglarlo es preguntárselo al usuario en la
    // ficha (paso 4) y eso cambiaría lo que la app hace hoy.
    const mudos = CONCEPTOS.filter((c) => c.inmueble?.categoryKey)
      .filter((c) => !getCategoryByKey(c.inmueble!.categoryKey!)?.casillaAEAT)
      .map((c) => `${c.id} → ${c.inmueble!.categoryKey}`);
    expect(mudos).toEqual(['personalizado → otros_inmueble']);
  });

  it('sin key ⇔ hay que preguntar · no hay terceros estados', () => {
    for (const c of CONCEPTOS) {
      if (!c.inmueble) continue;
      expect({ id: c.id, sinKey: c.inmueble.categoryKey === null }).toEqual({
        id: c.id,
        sinKey: c.inmueble.estado === 'pregunta',
      });
    }
  });

  it('la única pregunta sigue siendo la derrama', () => {
    expect(requierenPregunta().map((c) => c.id)).toEqual(['derrama']);
  });

  it('los servicios de explotación van a la 0112, no a la 0108', () => {
    // La 0108 del Modelo 100 es «exceso a deducir en los 4 años siguientes»:
    // un arrastre, no una categoría de gasto. Estaba puesta como casilla de
    // `servicio_inmueble`, así que limpieza, lavandería, gestoría y alarma
    // salían de `mapBoxToFiscalType` sin tipo fiscal.
    expect(getCategoryByKey('servicio_inmueble')?.casillaAEAT).toBe('0112');
    for (const id of ['limpieza', 'lavanderia', 'gestoria', 'alarma', 'honorarios_agencia']) {
      const key = conceptoPorId(id)?.inmueble?.categoryKey;
      expect({ id, casilla: getCategoryByKey(key!)?.casillaAEAT }).toEqual({ id, casilla: '0112' });
    }
  });
});

describe('las vistas por ámbito', () => {
  it('sólo devuelven lo que sabe clasificarse en ese ámbito', () => {
    for (const c of conceptosDeAmbito('personal')) expect(c.personal).toBeDefined();
    for (const c of conceptosDeAmbito('inmueble')) expect(c.inmueble).toBeDefined();
  });

  it('las familias de cada ámbito salen de sus conceptos, no de una lista aparte', () => {
    for (const ambito of ['personal', 'inmueble'] as const) {
      for (const f of familiasDeAmbito(ambito)) {
        expect({ ambito, familia: f.id, n: conceptosDe(f.id, ambito).length > 0 }).toEqual({
          ambito,
          familia: f.id,
          n: true,
        });
      }
    }
  });

  it('personal pierde el cajón «vivienda» y gana familias propias', () => {
    // Era el paquete que mezclaba alquiler, IBI, comunidad y seguro. Ahora cada
    // uno vive en su familia real y por eso se puede ver en su pantalla.
    const familias = familiasDeAmbito('personal').map((f) => f.id);
    expect(familias).toContain('alquiler');
    expect(familias).toContain('tributos');
    expect(familias).toContain('comunidad');
    expect(familias).toContain('seguros');
    expect(familias).not.toContain('vivienda' as never);
  });

  it('el seguro de vida ya se puede ver en los dos ámbitos', () => {
    // El gasto que abrió esta tarea: guardado con familia `seguros`, que no
    // existía en el catálogo personal, se volvía invisible en su pantalla.
    expect(conceptoPorId(resolverConcepto('seguros', 'vida')!)?.id).toBe('seguro_vida');
    expect(ambitosDe(conceptoPorId('seguro_vida') as Concepto).sort()).toEqual([
      'inmueble',
      'personal',
    ]);
  });
});

describe('proyectar no improvisa', () => {
  it('un concepto que no existe en ese ámbito devuelve undefined', () => {
    // `gimnasio` es sólo personal · pedirlo como gasto de inmueble no debe
    // devolver «lo más parecido», debe impedir guardar.
    expect(proyectar('gimnasio', 'inmueble')).toBeUndefined();
    expect(proyectar('limpieza', 'personal')).toBeUndefined();
  });

  it('un id inventado devuelve undefined', () => {
    expect(proyectar('no_existe', 'personal')).toBeUndefined();
    expect(proyectar(undefined, 'personal')).toBeUndefined();
    expect(proyectar(null, 'inmueble')).toBeUndefined();
  });
});
