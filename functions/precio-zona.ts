// Precio por m² de una zona · respaldo servidor para el Portal del Notariado.
//
// El navegador llama al servicio ArcGIS del Notariado directamente y casi
// siempre funciona. Casi. Un bloqueador de anuncios, una red corporativa o un
// DNS filtrado tumban esa llamada sin decir nada, y desde el navegador no hay
// forma de distinguir «esa zona no tiene escrituras» de «tu red no me deja
// preguntar». Esta función hace la misma pregunta desde el servidor, donde no
// hay bloqueadores, y el cliente la usa solo cuando la directa falla.
//
// NO es un proxy abierto: no acepta una URL, acepta un código postal o una
// provincia y arma la consulta aquí. Lo contrario sería regalar a cualquiera un
// emisor de peticiones con la cara de nuestro dominio.

const BASE =
  'https://services-eu1.arcgis.com/UpPGybwp9RK4YtZj/arcgis/rest/services/PRO_Inmuebles_Datos/FeatureServer';

const CAPA_CODIGO_POSTAL = 4;
const CAPA_PROVINCIA = 2;

/** Los únicos códigos que el portal usa · cualquier otro es basura o sondeo. */
const TIPOS = new Set([7, 9]);
const CLASES = new Set([14, 15, 99]);

const TIEMPO_MAXIMO_MS = 9000;

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    // Un mes de caché en el CDN · el Notariado publica una foto, no un tick.
    'cache-control': 'public, max-age=86400, s-maxage=2592000',
  },
  body: JSON.stringify(body),
});

export async function handler(event: { queryStringParameters?: Record<string, string | undefined> }) {
  const q = event.queryStringParameters ?? {};
  const cp = (q.cp ?? '').trim();
  const prov = (q.prov ?? '').trim();
  const tipo = Number(q.tipo);
  const clase = Number(q.clase);

  if (!TIPOS.has(tipo) || !CLASES.has(clase)) {
    return json(400, { error: 'tipo o clase de finca no reconocidos' });
  }

  let capa: number;
  let where: string;
  if (/^\d{5}$/.test(cp)) {
    capa = CAPA_CODIGO_POSTAL;
    where = `cp='${cp}'`;
  } else if (/^\d{2}$/.test(prov)) {
    capa = CAPA_PROVINCIA;
    where = `cod_prov='${prov}'`;
  } else {
    return json(400, { error: 'hace falta un código postal de 5 dígitos o una provincia de 2' });
  }
  where += ` and (tipo_construccion_id = ${tipo}) AND (clase_finca_urbana_id = ${clase})`;

  const url =
    `${BASE}/${capa}/query?f=json&returnGeometry=false&outFields=*&where=${encodeURIComponent(where)}`;

  const corte = new AbortController();
  const alarma = setTimeout(() => corte.abort(), TIEMPO_MAXIMO_MS);
  try {
    const respuesta = await fetch(url, { signal: corte.signal });
    if (!respuesta.ok) return json(502, { error: `el Notariado respondió HTTP ${respuesta.status}` });
    const datos = (await respuesta.json()) as {
      error?: { code?: number; message?: string };
      features?: Array<{ attributes?: Record<string, unknown> }>;
    };
    if (datos?.error) {
      return json(502, { error: `ArcGIS ${datos.error.code ?? ''} ${datos.error.message ?? ''}`.trim() });
    }
    const fila = datos?.features?.[0]?.attributes ?? null;
    // `null` aquí significa «esa zona no tiene escrituras publicadas», que es
    // una respuesta legítima y distinta de un fallo · por eso va con 200.
    return json(200, { fila });
  } catch (e) {
    return json(504, {
      error: corte.signal.aborted
        ? `el Notariado no contestó en ${TIEMPO_MAXIMO_MS / 1000} s`
        : `no se pudo llamar al Notariado · ${e instanceof Error ? e.message : 'error'}`,
    });
  } finally {
    clearTimeout(alarma);
  }
}
