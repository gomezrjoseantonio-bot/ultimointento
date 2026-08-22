// Precio por metro cuadrado de una zona · Portal Estadístico del Notariado.
//
// El portal se apoya en un servicio ArcGIS público con cinco capas —Nacional,
// CCAA, Provincia, Municipio y Código Postal— y las mismas métricas en todas.
// Aquí se usan dos: el código postal, que es el detalle que interesa, y la
// provincia como respaldo.
//
// Cuatro reglas, las mismas que gobiernan los índices oficiales:
//
//   1. Un dato flojo se señala, no se disfraza. Con cuatro escrituras detrás, la
//      media de una zona es una anécdota; quien la lea tiene que saberlo.
//   2. No se inventa nada. Sin dato para ese código postal se sube a provincia,
//      y si tampoco hay, se devuelve `null`.
//   3. Esto no pisa lo que valga el inmueble para su dueño. Propone; decide él.
//   4. Se consulta poco. Cada petición gasta cuota de la organización del
//      Notariado —su respuesta lo dice en una cabecera—, así que solo se
//      preguntan los códigos postales de los inmuebles del usuario y se guarda
//      la respuesta un mes.

import { initDB } from '../db';
import type {
  EstimacionZona,
  NivelZona,
  PrecioZona,
  RegimenInmueble,
} from '../../types/valoracionZona';

const BASE =
  'https://services-eu1.arcgis.com/UpPGybwp9RK4YtZj/arcgis/rest/services/PRO_Inmuebles_Datos/FeatureServer';

const CAPA_CODIGO_POSTAL = 4;
const CAPA_PROVINCIA = 2;

/**
 * Códigos del servicio · no vienen con diccionario y se dedujeron de las
 * peticiones del propio portal, confirmando después que existen exactamente
 * nueve combinaciones (3 × 3), que es el 468 = 52 provincias × 9 de la capa.
 */
const TIPO_OBRA_NUEVA = 7;
const TIPO_SEGUNDA_MANO = 9;
const CLASE_PISOS = 14;
/** «Todas las clases de finca» · pisos y unifamiliares juntos. */
const CLASE_TODAS = 99;

/**
 * Qué clase de finca corresponde a un activo de ATLAS.
 *
 * El Notariado solo publica precios de VIVIENDA. Un parking, un trastero o un
 * local no aparecen en esa estadística, y aplicarles el precio por m² de los
 * pisos daría un número absurdo con apariencia de cálculo — un trastero de 20 m²
 * «valdría» 37.000 € en un barrio donde el piso va a 1.874 €/m².
 *
 * Cuando no se sabe qué es —inmuebles anteriores a que existiera el campo— se
 * pregunta por todas las viviendas, que es lo más prudente que se puede decir
 * sin inventar.
 */
export function claseDeFinca(tipoActivo: string | undefined): number | null {
  if (tipoActivo === 'piso') return CLASE_PISOS;
  if (tipoActivo === undefined) return CLASE_TODAS;
  return null;
}

/**
 * Por debajo de esto la media no sostiene una valoración.
 *
 * No es un número mágico: es la frontera a partir de la cual se prefiere la
 * provincia —muchas operaciones, poca precisión geográfica— a un código postal
 * con cuatro ventas sueltas que cualquier chalet desvía por completo.
 */
const MINIMO_OPERACIONES = 10;

/** Un mes · el servicio publica una foto que cambia muy de tanto en tanto. */
const CADUCIDAD_MS = 30 * 24 * 60 * 60 * 1000;

const claveCache = (cp: string, tipo: number) => `precioZona:${cp}:${tipo}`;

const ES_CP = /^\d{5}$/;

interface FilaArcGIS {
  precio_m2?: number;
  precio_medio?: number;
  superficie_media?: number;
  total?: number;
  total_informados?: number;
  es_estimado?: number;
}

/**
 * Una consulta al servicio.
 *
 * Se pide `f=json` aunque el portal use `f=pbf`: el mismo servicio sirve JSON
 * plano y así no hay que arrastrar un decodificador de protobuf al navegador.
 */
async function consultar(capa: number, where: string): Promise<FilaArcGIS | null> {
  const url =
    `${BASE}/${capa}/query?f=json&returnGeometry=false&outFields=*&where=${encodeURIComponent(where)}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  const datos = await respuesta.json();
  if (datos?.error) throw new Error(`ArcGIS ${datos.error?.code ?? ''}`);
  const fila = datos?.features?.[0]?.attributes;
  return fila && typeof fila.precio_m2 === 'number' ? (fila as FilaArcGIS) : null;
}

const aPrecioZona = (
  fila: FilaArcGIS,
  nivel: NivelZona,
  zona: string,
  ahoraISO: string,
): PrecioZona => ({
  precioM2: Number(fila.precio_m2),
  precioMedio: Number(fila.precio_medio ?? 0),
  superficieMedia: Number(fila.superficie_media ?? 0),
  operaciones: Number(fila.total ?? 0),
  operacionesInformadas: Number(fila.total_informados ?? 0),
  estimado: fila.es_estimado === 1,
  nivel,
  zona,
  consultadoEn: ahoraISO,
});

async function leerCache(clave: string): Promise<PrecioZona | null> {
  try {
    const db = await initDB();
    const dato = (await db.get('keyval', clave)) as PrecioZona | undefined;
    if (!dato?.consultadoEn) return null;
    const edad = Date.now() - new Date(dato.consultadoEn).getTime();
    return edad < CADUCIDAD_MS ? dato : null;
  } catch {
    return null;
  }
}

async function escribirCache(clave: string, dato: PrecioZona): Promise<void> {
  try {
    const db = await initDB();
    await db.put('keyval', dato as never, clave);
  } catch {
    // Sin caché se vuelve a preguntar · solo se gasta algo más de cuota ajena.
  }
}

/**
 * El precio por m² que corresponde a un inmueble, con su procedencia.
 *
 * Primero su código postal. Se sube a provincia cuando ahí no hay dato, cuando
 * hay menos escrituras de las que sostienen una media, o cuando el propio
 * Notariado marca la cifra como estimada — y en ese caso el resultado lo dice,
 * porque «tu calle» y «tu provincia» no son la misma afirmación.
 */
export async function precioDeZona(
  codigoPostal: string,
  regimen: RegimenInmueble,
  tipoActivo?: string,
): Promise<PrecioZona | null> {
  if (!ES_CP.test(codigoPostal)) return null;
  const clase = claseDeFinca(tipoActivo);
  // Un parking o un trastero no están en la estadística de vivienda · no hay
  // pregunta que hacer, y menos aún respuesta que enseñar.
  if (clase === null) return null;
  const tipo = regimen === 'obra-nueva' ? TIPO_OBRA_NUEVA : TIPO_SEGUNDA_MANO;

  const cacheado = await leerCache(claveCache(codigoPostal, tipo * 100 + clase));
  if (cacheado) return cacheado;

  const ahora = new Date().toISOString();
  const filtroTipo = `(tipo_construccion_id = ${tipo}) AND (clase_finca_urbana_id = ${clase})`;

  let resultado: PrecioZona | null = null;
  try {
    const fila = await consultar(CAPA_CODIGO_POSTAL, `cp='${codigoPostal}' and ${filtroTipo}`);
    if (fila) resultado = aPrecioZona(fila, 'codigo-postal', codigoPostal, ahora);
  } catch {
    // Se intenta la provincia igualmente · media zona es mejor que nada.
  }

  const flojo =
    !resultado || resultado.estimado || resultado.operaciones < MINIMO_OPERACIONES;
  if (flojo) {
    // Los dos primeros dígitos del código postal SON el código de provincia,
    // así que el salto no necesita ninguna tabla de conversión.
    const codProv = codigoPostal.slice(0, 2);
    try {
      const fila = await consultar(CAPA_PROVINCIA, `cod_prov='${codProv}' and ${filtroTipo}`);
      if (fila) {
        const provincia = aPrecioZona(fila, 'provincia', codProv, ahora);
        // La provincia solo gana si de verdad aporta · si también viene floja,
        // se conserva el dato local, que al menos es de su calle.
        if (!resultado || provincia.operaciones > resultado.operaciones) {
          resultado = provincia;
        }
      }
    } catch {
      // Nos quedamos con lo que hubiera.
    }
  }

  if (resultado) await escribirCache(claveCache(codigoPostal, tipo * 100 + clase), resultado);
  return resultado;
}

/**
 * Qué crédito darle a la cifra.
 *
 * Un dato de provincia nunca es «alta»: describe bien un territorio y mal una
 * vivienda. Y una muestra pequeña baja la nota aunque sea del código postal.
 */
export function fiabilidadDe(precio: PrecioZona): EstimacionZona['fiabilidad'] {
  if (precio.estimado) return 'baja';
  if (precio.nivel === 'provincia') return 'media';
  if (precio.operaciones < MINIMO_OPERACIONES) return 'baja';
  return precio.operaciones >= 50 ? 'alta' : 'media';
}

/**
 * La estimación para un inmueble concreto.
 *
 * Sin metros no hay estimación posible y se devuelve `null`: multiplicar por una
 * superficie inventada daría un número con la misma pinta que uno bueno.
 */
export async function estimarPorZona(
  metrosCuadrados: number,
  codigoPostal: string,
  regimen: RegimenInmueble,
  tipoActivo?: string,
): Promise<EstimacionZona | null> {
  if (!Number.isFinite(metrosCuadrados) || metrosCuadrados <= 0) return null;
  const precioZona = await precioDeZona(codigoPostal, regimen, tipoActivo);
  if (!precioZona) return null;
  return {
    valor: Math.round(metrosCuadrados * precioZona.precioM2),
    precioZona,
    fiabilidad: fiabilidadDe(precioZona),
  };
}
