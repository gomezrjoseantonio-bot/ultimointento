// Candado de la tabla de traducción presentación → persistencia (V6 · D3).
//
// El riesgo que cubre: `categoryKey` alimenta la casilla AEAT y el store de
// destino, así que una traducción rota o inventada contamina la declaración en
// silencio. Estos tests fallan si alguien añade un concepto al catálogo de
// presentación sin traducirlo, o si traduce a una key que no existe.

import {
  TRADUCCION_INMUEBLE,
  TRADUCCION_PERSONAL,
  traducirInmueble,
  traducirPersonal,
  pendientesDeDecision,
  requierenPregunta,
  presentacionDe,
} from '../catalogoPresentacionPersistencia';
import { TIPOS_GASTO_INMUEBLE_V2 } from '../conceptos/__fixtures__/baselineInmuebleLegacy';
import { TIPOS_GASTO_PERSONAL } from '../../modules/personal/wizards/utils/tiposDeGastoPersonal';
import { getAllCategories, SUMINISTRO_SUBTYPES } from '../categoryCatalog';

const clavesPresentacionInmueble = TIPOS_GASTO_INMUEBLE_V2.flatMap((tipo) =>
  tipo.subtipos.map((sub) => `${tipo.id}:${sub.id}`)
);

describe('catálogo · traducción presentación → persistencia', () => {
  it('traduce todos los conceptos de inmueble, sin sobrantes', () => {
    const mapeados = Object.keys(TRADUCCION_INMUEBLE).sort();
    expect(mapeados).toEqual([...clavesPresentacionInmueble].sort());
  });

  it('traduce todas las familias de gasto personal, sin sobrantes', () => {
    const familias = TIPOS_GASTO_PERSONAL.map((t) => t.id).sort();
    expect(Object.keys(TRADUCCION_PERSONAL).sort()).toEqual(familias);
  });

  it('no inventa ninguna categoryKey: todas existen en categoryCatalog', () => {
    const keysReales = new Set(getAllCategories().map((c) => c.key));
    const usadas = [...Object.values(TRADUCCION_INMUEBLE), ...Object.values(TRADUCCION_PERSONAL)]
      .map((t) => t.categoryKey)
      .filter((k): k is string => k !== null);

    expect(usadas.length).toBeGreaterThan(0);
    expect(usadas.filter((k) => !keysReales.has(k))).toEqual([]);
  });

  it('no inventa ningún subtypeKey: todos existen en SUMINISTRO_SUBTYPES', () => {
    const subsReales = new Set(SUMINISTRO_SUBTYPES.map((s) => s.key));
    const usados = Object.values(TRADUCCION_INMUEBLE)
      .map((t) => t.subtypeKey)
      .filter((k): k is string => Boolean(k));

    expect(usados.filter((k) => !subsReales.has(k))).toEqual([]);
  });

  it('sin categoryKey solo si está pendiente o es de pregunta, y siempre con motivo', () => {
    for (const [clave, t] of Object.entries({ ...TRADUCCION_INMUEBLE, ...TRADUCCION_PERSONAL })) {
      if (t.estado === 'ok') {
        expect({ clave, nulo: t.categoryKey === null }).toEqual({ clave, nulo: false });
      } else {
        // `pendiente` (falta decidir) y `pregunta` (depende del hecho) no
        // persisten key. Sin motivo escrito, nadie sabrá por qué.
        expect({ clave, key: t.categoryKey }).toEqual({ clave, key: null });
        expect(t.nota ?? '').not.toEqual('');
      }
    }
  });

  it('D3 · no queda ninguna traducción pendiente de decidir', () => {
    expect(pendientesDeDecision()).toEqual([]);
  });

  it('la derrama se pregunta, no se traduce: depende de la obra, no del concepto', () => {
    // Conservación → deducible en el ejercicio · Mejora → capitalizable, amortiza.
    // Ninguna key fija acierta siempre, así que la ficha tiene que preguntarlo.
    expect(requierenPregunta()).toEqual(['comunidad:derrama']);
    expect(traducirInmueble('comunidad', 'derrama')?.categoryKey).toBeNull();
  });

  it('telefonía tiene sub-tipo propio y no se colapsa en internet', () => {
    const tel = traducirInmueble('suministros', 'telefonia');
    expect(tel?.subtypeKey).toBe('telefonia');
    expect(tel?.subtypeKey).not.toBe('internet');
  });

  it('la alarma es servicio (0108), no suministro (0113)', () => {
    expect(traducirInmueble('suministros', 'alarma')?.categoryKey).toBe('servicio_inmueble');
  });

  it('el desdoble de ropa/lavandería manda cada mitad a su sitio', () => {
    // El servicio recurrente se deduce; el bien duradero se amortiza.
    expect(traducirInmueble('servicios', 'lavanderia')?.categoryKey).toBe('servicio_inmueble');
    expect(traducirInmueble('mobiliario', 'ropa_enseres')?.categoryKey).toBe('mobiliario_inmueble');
  });

  it('el seguro de vida ya no cuelga del inmueble', () => {
    // Va ligado a la hipoteca, no al arrendamiento: deducirlo como gasto del
    // alquiler es de los que levantan una paralela.
    expect(traducirInmueble('seguros', 'vida')).toBeUndefined();
  });

  it('solo el sub-tipo de suministro admite subtypeKey', () => {
    for (const [clave, t] of Object.entries(TRADUCCION_INMUEBLE)) {
      if (t.subtypeKey) {
        expect({ clave, key: t.categoryKey }).toEqual({ clave, key: 'suministro_inmueble' });
      }
    }
  });

  it('las funciones de consulta resuelven y devuelven undefined fuera del catálogo', () => {
    expect(traducirInmueble('tributos', 'ibi')?.categoryKey).toBe('ibi_inmueble');
    expect(traducirInmueble('suministros', 'luz')?.subtypeKey).toBe('luz');
    expect(traducirInmueble('no', 'existe')).toBeUndefined();
    expect(traducirPersonal('dia_a_dia')?.categoryKey).toBe('gasto_personal_dia_dia');
    expect(traducirPersonal('no_existe')).toBeUndefined();
  });

  // El camino de vuelta lo usa la ficha de §4.5 para abrir con la clasificación
  // que YA tiene el registro. Lo peligroso aquí no es fallar: es acertar a
  // medias y devolver una familia plausible que el usuario nunca eligió.
  describe('camino inverso · persistencia → presentación', () => {
    it('vuelve a familia y concepto cuando la key es unívoca', () => {
      expect(presentacionDe('ibi_inmueble')).toEqual({ tipoId: 'tributos', subtipoId: 'ibi' });
      expect(presentacionDe('suministro_inmueble', 'luz')).toEqual({
        tipoId: 'suministros',
        subtipoId: 'luz',
      });
    });

    it('ida y vuelta son consistentes en toda entrada que no comparta key', () => {
      const porKey = new Map<string, number>();
      for (const t of Object.values(TRADUCCION_INMUEBLE)) {
        if (!t.categoryKey) continue;
        const k = `${t.categoryKey}|${t.subtypeKey ?? ''}`;
        porKey.set(k, (porKey.get(k) ?? 0) + 1);
      }

      for (const [clave, t] of Object.entries(TRADUCCION_INMUEBLE)) {
        if (!t.categoryKey) continue;
        const unica = porKey.get(`${t.categoryKey}|${t.subtypeKey ?? ''}`) === 1;
        const vuelta = presentacionDe(t.categoryKey, t.subtypeKey);
        if (unica) {
          expect({ clave, vuelta: `${vuelta?.tipoId}:${vuelta?.subtipoId}` }).toEqual({
            clave,
            vuelta: clave,
          });
        } else {
          // Varias familias comparten key · no hay vuelta honesta posible.
          expect({ clave, vuelta }).toEqual({ clave, vuelta: undefined });
        }
      }
    });

    it('devuelve undefined antes que adivinar', () => {
      expect(presentacionDe(undefined)).toBeUndefined();
      expect(presentacionDe('key_que_no_existe')).toBeUndefined();
      // La key existe, pero el subtipo no casa: no es la misma clasificación.
      expect(presentacionDe('suministro_inmueble', 'subtipo_inventado')).toBeUndefined();
    });
  });

  it('expone la lista PENDIENTE-JOSE con su motivo', () => {
    const pendientes = pendientesDeDecision();
    const marcadas = [
      ...Object.values(TRADUCCION_INMUEBLE),
      ...Object.values(TRADUCCION_PERSONAL),
    ].filter((t) => t.estado === 'pendiente');

    expect(pendientes).toHaveLength(marcadas.length);
    expect(pendientes.every((p) => p.nota.length > 0)).toBe(true);
  });
});
