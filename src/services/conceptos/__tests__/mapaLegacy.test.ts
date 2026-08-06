// Candado del mapa (tipoFamilia, subtipo) → concepto.
//
// El riesgo que cubre: este mapa decide qué concepto se le pone a cada gasto al
// migrar, y el concepto decide su casilla AEAT. Un par sin traducir deja gastos
// sin clasificar; una traducción a un concepto que no existe, o al de otro
// ámbito, los clasifica mal en silencio.
//
// Los tests leen los CATÁLOGOS REALES, no una copia. Así, añadir un concepto a
// cualquiera de los dos sin traducirlo rompe la construcción en vez de aparecer
// meses después como un gasto raro.

import {
  CONCEPTOS_DESTINO,
  MAPA_LEGACY,
  PARES_HISTORICOS,
  conceptoPorId,
  resolverConcepto,
} from '../mapaLegacy';
import { TIPOS_GASTO_INMUEBLE_V2 } from '../../../modules/inmuebles/wizards/utils/tiposDeGastoInmueble';
import { TIPOS_GASTO_PERSONAL } from '../../../modules/personal/wizards/utils/tiposDeGastoPersonal';

const paresDe = (catalogo: ReadonlyArray<{ id: string; subtipos: ReadonlyArray<{ id: string }> }>) =>
  catalogo.flatMap((fam) => fam.subtipos.map((sub) => `${fam.id}:${sub.id}`));

const PARES_INMUEBLE = paresDe(TIPOS_GASTO_INMUEBLE_V2);
const PARES_PERSONAL = paresDe(TIPOS_GASTO_PERSONAL);

describe('el mapa cubre todo lo que existe', () => {
  it('traduce los 35 pares del catálogo de inmueble', () => {
    const sinTraducir = PARES_INMUEBLE.filter((p) => !(p in MAPA_LEGACY));
    expect(sinTraducir).toEqual([]);
    expect(PARES_INMUEBLE.length).toBe(35);
  });

  it('traduce los 37 pares del catálogo personal', () => {
    const sinTraducir = PARES_PERSONAL.filter((p) => !(p in MAPA_LEGACY));
    expect(sinTraducir).toEqual([]);
    expect(PARES_PERSONAL.length).toBe(37);
  });

  it('no sobra ninguna entrada · toda clave viene de un catálogo o es histórica', () => {
    // Una entrada de más es tan mala como una de menos: significa que el mapa
    // habla de algo que ya no existe y nadie se ha enterado.
    const legitimas = new Set([...PARES_INMUEBLE, ...PARES_PERSONAL, ...PARES_HISTORICOS]);
    const huerfanas = Object.keys(MAPA_LEGACY).filter((k) => !legitimas.has(k));
    expect(huerfanas).toEqual([]);
  });

  it('cubre los pares históricos que ya no están en el catálogo', () => {
    // `seguros:vida` se retiró del catálogo de inmuebles, pero hay gastos
    // guardados con él · es el que destapó todo esto.
    for (const p of PARES_HISTORICOS) {
      expect({ par: p, tiene: p in MAPA_LEGACY }).toEqual({ par: p, tiene: true });
    }
    expect(resolverConcepto('seguros', 'vida')).toBe('seguro_vida');
  });
});

describe('el mapa no inventa destinos', () => {
  it('todo destino existe en el vocabulario de llegada', () => {
    const inventados = Object.entries(MAPA_LEGACY)
      .filter(([, destino]) => conceptoPorId(destino) === undefined)
      .map(([par, destino]) => `${par} → ${destino}`);
    expect(inventados).toEqual([]);
  });

  it('los ids de concepto no se repiten', () => {
    const ids = CONCEPTOS_DESTINO.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('todo concepto se puede elegir en algún ámbito', () => {
    const huerfanos = CONCEPTOS_DESTINO.filter((c) => c.ambitos.length === 0).map((c) => c.id);
    expect(huerfanos).toEqual([]);
  });
});

describe('los ámbitos cuadran con el catálogo de origen', () => {
  // Éste es el que de verdad protege: si un par del catálogo de inmueble
  // tradujera a un concepto que sólo existe en personal, el gasto migrado
  // acabaría en un ámbito donde no se puede ni ver — que es exactamente el
  // fallo del que salió toda esta tarea.
  it('un par de inmueble traduce a un concepto disponible en inmueble', () => {
    const malos = PARES_INMUEBLE.map((p) => ({ p, c: conceptoPorId(MAPA_LEGACY[p]) }))
      .filter(({ c }) => c && !c.ambitos.includes('inmueble'))
      .map(({ p, c }) => `${p} → ${c!.id} (${c!.ambitos.join(',')})`);
    expect(malos).toEqual([]);
  });

  it('un par de personal traduce a un concepto disponible en personal', () => {
    const malos = PARES_PERSONAL.map((p) => ({ p, c: conceptoPorId(MAPA_LEGACY[p]) }))
      .filter(({ c }) => c && !c.ambitos.includes('personal'))
      .map(({ p, c }) => `${p} → ${c!.id} (${c!.ambitos.join(',')})`);
    expect(malos).toEqual([]);
  });

  it('las claves que están en los dos catálogos traducen al mismo concepto', () => {
    // Son el mismo gasto · lo que cambiaba entre catálogos era la categoría,
    // y esa pasa a proyectarse desde el ámbito.
    const enAmbos = PARES_INMUEBLE.filter((p) => PARES_PERSONAL.includes(p));
    expect(enAmbos.length).toBe(6);
    for (const p of enAmbos) {
      const c = conceptoPorId(MAPA_LEGACY[p]);
      expect({ par: p, ambitos: c?.ambitos.slice().sort() }).toEqual({
        par: p,
        ambitos: ['inmueble', 'personal'],
      });
    }
  });
});

describe('el reparto de los paquetes personales', () => {
  // `vivienda` y `seguros_cuotas` eran cajones que mezclaban familias reales.
  it('«vivienda» se reparte en alquiler, tributos, comunidad y seguros', () => {
    expect(conceptoPorId(resolverConcepto('vivienda', 'alquiler')!)?.familia).toBe('alquiler');
    expect(conceptoPorId(resolverConcepto('vivienda', 'ibi')!)?.familia).toBe('tributos');
    expect(conceptoPorId(resolverConcepto('vivienda', 'comunidad')!)?.familia).toBe('comunidad');
    expect(conceptoPorId(resolverConcepto('vivienda', 'seguro_hogar')!)?.familia).toBe('seguros');
  });

  it('«seguros_cuotas» se reparte en seguros y cuotas', () => {
    expect(conceptoPorId(resolverConcepto('seguros_cuotas', 'seguro_vida')!)?.familia).toBe('seguros');
    expect(conceptoPorId(resolverConcepto('seguros_cuotas', 'gimnasio')!)?.familia).toBe('cuotas');
  });

  it('«movil» y «telefonia» acaban en el mismo concepto', () => {
    expect(resolverConcepto('suministros', 'movil')).toBe('telefonia');
    expect(resolverConcepto('suministros', 'telefonia')).toBe('telefonia');
  });

  it('cada «otros» va al de SU familia, no a un cajón común', () => {
    expect(resolverConcepto('suministros', 'otros')).toBe('otros_suministros');
    expect(resolverConcepto('seguros', 'otros')).toBe('otros_seguros');
    expect(resolverConcepto('gestion', 'otros')).toBe('otros_gestion');
    expect(resolverConcepto('dia_a_dia', 'otros')).toBe('otros_dia_a_dia');
    // El de `seguros_cuotas` es de tipo cuota · va a cuotas, no a seguros.
    expect(resolverConcepto('seguros_cuotas', 'otros')).toBe('otros_cuotas');
  });
});

describe('ante lo desconocido, no adivina', () => {
  it('un par que no existe devuelve null', () => {
    expect(resolverConcepto('inventada', 'loquesea')).toBeNull();
    // Familia real, subtipo que nunca existió ahí.
    expect(resolverConcepto('suministros', 'petroleo')).toBeNull();
  });

  it('sin familia o sin subtipo devuelve null · no cae al subtipo suelto', () => {
    expect(resolverConcepto(undefined, 'luz')).toBeNull();
    expect(resolverConcepto('suministros', undefined)).toBeNull();
    expect(resolverConcepto('', '')).toBeNull();
  });

  it('no resuelve por subtipo suelto · `otros` no significa nada por sí solo', () => {
    expect(resolverConcepto(undefined, 'otros')).toBeNull();
  });
});
