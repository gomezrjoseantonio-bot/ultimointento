// De dónde sale cada índice.
//
// Un adaptador por fuente, con la misma forma: devuelve `{ 'YYYY-MM': valor }`.
// Aislarlos así es lo que permite cambiar de origen sin tocar el resto: si
// mañana el Banco de España publica un CSV mejor que el del BCE, se reescribe
// `descargar` y nada más se entera.
//
// ⚠️ IDENTIFICADORES SIN VERIFICAR CONTRA LA FUENTE REAL
// Los códigos de serie de aquí abajo se escribieron sin poder llamar a las APIs
// (el entorno donde se programó esto no tenía salida a internet). La primera
// ejecución hay que lanzarla A MANO desde la pestaña Actions y mirar lo que
// imprime: cada adaptador enseña el NOMBRE de la serie tal como lo devuelve el
// organismo, que es como se confirma que se está bajando lo que se cree.
// Mientras no se haga esa comprobación, el dato no debe darse por bueno.

/** Series del INE · API pública Tempus3, sin clave. */
const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE';

/**
 * IPC · variación anual del índice general nacional.
 *
 * Viene ya en TASA, no como número índice sobre una base: es justo lo que se
 * aplica a una renta, así que se guarda tal cual y `porcentajeDeActualizacion`
 * la usa sin recalcular nada.
 *
 * El código anterior (`IPC251856`) murió en 2025-12 cuando el INE pasó al
 * «sistema IPC base 2025»: al cambiar de base no continúan la serie, abren otra
 * y abandonan la vieja, que sigue respondiendo con normalidad y por eso el fallo
 * no daba la cara. Lo cazó la guarda por antigüedad.
 *
 * El sustituto salió de la TABLA 76134 («Tasa de variación del índice general
 * nacional. Series desde enero de 1961»), que tiene tres series. Buscarlo
 * rastreando la operación era imposible: el IPC tiene cientos de miles de series
 * y la API sirve 10 000 por página.
 */
const INE_SERIE_IPC = 'IPC290750';

/**
 * IRAV · Índice de Referencia para la Actualización anual de los contratos de
 * arrendamiento de Vivienda, que el INE publica mensualmente y que desde 2025
 * sustituye al IPC para actualizar rentas de vivienda habitual.
 *
 * Verificado en la primera ejecución (22 ago 2026): «Total Nacional. Índice
 * general. Variación anual», con datos desde 2024-11 — el arranque tardío es la
 * huella del índice nuevo, y confirma que no es el IPC de toda la vida.
 */
const INE_SERIE_IRAV = 'IRAV001';

/**
 * IPV · índice de precios de vivienda de segunda mano, nacional y TRIMESTRAL.
 *
 * Se elige el índice y no la tasa de variación porque sirve para comparar dos
 * trimestres cualesquiera: revalorizar lo que se pagó en 2015 exige el cociente
 * entre el índice de hoy y el de entonces, y una tasa anual no permite eso.
 *
 * Y se elige segunda mano y no vivienda nueva porque un piso comprado hace
 * años, aunque se comprara a estrenar, hoy se vende en el mercado de segunda
 * mano: es esa curva la que describe lo que le ha pasado a su precio.
 *
 * De la tabla 80270, «Índices por CCAA: general, vivienda nueva y de segunda
 * mano. Trimestrales».
 */
const INE_SERIE_IPV = 'IPV1618';

/** Euríbor 12m · portal de datos del BCE, sin clave. */
const BCE_EURIBOR_12M =
  'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA';

const dosDigitos = (n) => String(n).padStart(2, '0');

async function pedirJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
}

/**
 * Lee una serie mensual del INE.
 *
 * El periodo se arma con `Anyo` + `FK_Periodo` (el número de mes) y no con
 * `Fecha`, que viene en milisegundos y en zona horaria: convertirla cerca de
 * fin de mes movía el dato de enero a diciembre del año anterior.
 *
 * `nult` pide los N últimos. Se piden 240 (veinte años) y no más porque con 600
 * la serie del IPC devolvió 1976-01 → 2025-12 —exactamente 600— y quedó la duda
 * de si la serie termina ahí o si el organismo estaba recortando por arriba. Lo
 * viejo no se pierde: la fusión conserva todo lo ya descargado.
 */
async function serieINE(codigo, { nult = 240, periodicidad = 'mensual' } = {}) {
  const datos = await pedirJSON(`${INE_BASE}/${codigo}?nult=${nult}`);
  const nombre = datos?.Nombre ?? '(sin nombre)';
  const filas = Array.isArray(datos?.Data) ? datos.Data : [];
  const valores = {};
  for (const fila of filas) {
    const ano = Number(fila?.Anyo);
    const periodo = Number(fila?.FK_Periodo);
    const valor = Number(fila?.Valor);
    if (!Number.isInteger(ano) || !Number.isFinite(valor)) continue;

    let mes;
    if (periodicidad === 'trimestral') {
      // En una serie trimestral, `FK_Periodo` va de 1 a 4 y significa TRIMESTRE,
      // no mes. Tomarlo como mes metería el cuarto trimestre en abril y toda la
      // serie quedaría desplazada nueve meses sin que fallara nada. Se ancla en
      // el mes de CIERRE de cada trimestre, que es a lo que se refiere el dato.
      if (!(periodo >= 1 && periodo <= 4)) continue;
      mes = periodo * 3;
    } else {
      if (!(periodo >= 1 && periodo <= 12)) continue;
      mes = periodo;
    }
    valores[`${ano}-${dosDigitos(mes)}`] = valor;
  }
  return { nombre, valores };
}

/**
 * Parte una línea de CSV respetando las comillas.
 *
 * `split(',')` no vale: las descripciones largas del BCE llevan comas dentro
 * («…Historical close, average of observations…»), y partir a lo bruto corre
 * todas las columnas siguientes una posición. El periodo y el valor acabarían
 * leyéndose de la celda equivocada, y como los dos son texto plausible, el
 * fallo no daría la cara.
 */
function partirCSV(linea) {
  const celdas = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      // Dos comillas seguidas dentro de un campo entrecomillado son una comilla.
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === ',' && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

/**
 * Lee la serie del BCE en CSV.
 *
 * Se localizan las columnas por su cabecera y no por posición: el portal ha
 * añadido columnas antes, y leer la cuarta a ciegas devolvía cualquier cosa
 * sin fallar.
 */
async function serieBCE(url) {
  const r = await fetch(`${url}?format=csvdata`, { headers: { accept: 'text/csv' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  const texto = await r.text();
  const lineas = texto.trim().split(/\r?\n/);
  if (lineas.length < 2) throw new Error('CSV del BCE sin filas');
  const cabecera = partirCSV(lineas[0]);
  const iPeriodo = cabecera.indexOf('TIME_PERIOD');
  const iValor = cabecera.indexOf('OBS_VALUE');
  const iTitulo = cabecera.indexOf('TITLE');
  // `TITLE` viene recortado («Euribor 1-year - Historical close») y no dice si
  // el valor mensual es la MEDIA de las observaciones o el cierre del último
  // día. Para una hipoteca española eso no da igual, así que se enseña también
  // la descripción larga, que sí lo aclara.
  const iTituloLargo = cabecera.indexOf('TITLE_COMPL');
  if (iPeriodo === -1 || iValor === -1) {
    throw new Error(`CSV del BCE sin TIME_PERIOD/OBS_VALUE · cabeceras: ${cabecera.join('|')}`);
  }
  const valores = {};
  let nombre = '(sin nombre)';
  for (const linea of lineas.slice(1)) {
    const celdas = partirCSV(linea);
    const periodo = celdas[iPeriodo];
    const valor = Number(celdas[iValor]);
    if (!/^\d{4}-\d{2}$/.test(periodo) || !Number.isFinite(valor)) continue;
    valores[periodo] = valor;
    if (iTituloLargo !== -1 && celdas[iTituloLargo]) nombre = celdas[iTituloLargo];
    else if (iTitulo !== -1 && celdas[iTitulo]) nombre = celdas[iTitulo];
  }
  return { nombre, valores };
}

export const FUENTES = [
  {
    id: 'euribor-12m',
    nombre: 'Euríbor a 12 meses · media mensual',
    unidad: 'porcentaje',
    cadenciaMeses: 1,
    // Rango de cordura, no de negocio · solo descarta una descarga corrupta.
    rango: [-2, 25],
    fuente: {
      nombre: 'Banco Central Europeo · Data Portal',
      url: BCE_EURIBOR_12M,
      serieOrigen: 'FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA',
    },
    descargar: () => serieBCE(BCE_EURIBOR_12M),
  },
  {
    id: 'ipc',
    nombre: 'IPC · variación anual del índice general nacional',
    unidad: 'porcentaje',
    cadenciaMeses: 1,
    // La serie arranca en 1976 y cubre la inflación de los ochenta · un rango
    // estrecho la habría rechazado entera por un dato viejo perfectamente real.
    rango: [-10, 30],
    fuente: {
      nombre: 'INE · API Tempus3',
      url: `${INE_BASE}/${INE_SERIE_IPC}`,
      serieOrigen: INE_SERIE_IPC,
    },
    descargar: () => serieINE(INE_SERIE_IPC),
  },
  {
    id: 'ipv-segunda-mano',
    nombre: 'IPV · índice de vivienda de segunda mano (nacional)',
    unidad: 'indice',
    // Trimestral · el dato de un trimestre tarda en publicarse más que un mes.
    cadenciaMeses: 3,
    // Un número índice con base 100 en algún año · el rango solo descarta una
    // respuesta corrupta, no juzga si el mercado subió o bajó.
    rango: [10, 500],
    fuente: {
      nombre: 'INE · API Tempus3',
      url: `${INE_BASE}/${INE_SERIE_IPV}`,
      serieOrigen: INE_SERIE_IPV,
    },
    descargar: () => serieINE(INE_SERIE_IPV, { periodicidad: 'trimestral' }),
  },
  {
    id: 'irav',
    nombre: 'IRAV · actualización anual de contratos de arrendamiento de vivienda',
    unidad: 'porcentaje',
    cadenciaMeses: 1,
    rango: [-10, 25],
    fuente: {
      nombre: 'INE · API Tempus3',
      url: `${INE_BASE}/${INE_SERIE_IRAV}`,
      serieOrigen: INE_SERIE_IRAV,
    },
    descargar: () => serieINE(INE_SERIE_IRAV),
  },
];

/**
 * Busca series de una operación del INE por texto de su nombre.
 *
 * Es la herramienta de mantenimiento que hace falta cuando la guarda por
 * antigüedad avisa de que una serie dejó de publicarse: el INE la renumera al
 * cambiar de base, y el código nuevo hay que encontrarlo. Sin esto había que ir
 * a picar a mano por el catálogo web.
 *
 * `operacion` es el código de la operación (p. ej. `IPC`), y `filtro` un texto
 * que debe aparecer en el nombre de la serie, sin distinguir mayúsculas ni
 * acentos.
 */
export async function buscarSeriesINE(operacion, filtro, { paginas = 3 } = {}) {
  const normal = (t) =>
    String(t ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const trozos = normal(filtro).split(/\s+/).filter(Boolean);
  const encaja = (nombre) => trozos.every((t) => normal(nombre).includes(t));

  // La API devuelve como mucho 10 000 series por página, y la operación IPC
  // tiene muchas más: la primera búsqueda daba 13 resultados, todos variantes
  // «General sin tabaco», «General sin alimentos»… La serie general limpia
  // estaba fuera de la primera página, y sin paginar era invisible.
  //
  // Pero recorrerlas todas tampoco vale: con 12 páginas el trabajo pasó de
  // cuatro minutos sin terminar y hubo que cancelarlo. El tope se queda bajo a
  // propósito y, cuando se alcanza, SE DICE — un límite silencioso es
  // indistinguible de «no existe», que es justo el error que trajo hasta aquí.
  // Para una operación tan grande como el IPC, el catálogo web del INE
  // encuentra el código antes que esta fuerza bruta.
  const hallados = [];
  const muestra = [];
  let total = 0;
  let paginasLeidas = 0;
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    const url = `https://servicios.ine.es/wstempus/js/ES/SERIES_OPERACION/${operacion}?page=${pagina}`;
    const datos = await pedirJSON(url);
    const lista = Array.isArray(datos) ? datos : [];
    if (lista.length === 0) break;
    paginasLeidas += 1;
    total += lista.length;
    for (const s of lista) {
      if (encaja(s?.Nombre)) hallados.push({ cod: s?.COD, nombre: s?.Nombre });
    }
    if (muestra.length < 8) {
      for (const s of lista.slice(0, 8 - muestra.length)) muestra.push(`${s?.COD} · ${s?.Nombre}`);
    }
  }
  return { total, hallados, muestra, topeAlcanzado: paginasLeidas >= paginas };
}

/** Compara sin distinguir mayúsculas ni acentos · el INE mezcla ambas. */
const normalizar = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const encajaCon = (filtro) => {
  const trozos = normalizar(filtro).split(/\s+/).filter(Boolean);
  return (texto) => trozos.every((t) => normalizar(texto).includes(t));
};

/**
 * Las TABLAS de una operación.
 *
 * Es el camino corto que faltaba. Enumerar las series de una operación no vale
 * —el IPC tiene cientos de miles y la API sirve 10 000 por página—, pero sus
 * tablas son unas decenas. Se busca la tabla, y de la tabla salen sus series
 * con nombre y código.
 */
export async function buscarTablasINE(operacion, filtro) {
  const datos = await pedirJSON(
    `https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/${operacion}`,
  );
  const lista = Array.isArray(datos) ? datos : [];
  const encaja = encajaCon(filtro);
  return {
    total: lista.length,
    hallados: lista
      .filter((t) => !filtro || encaja(t?.Nombre))
      .map((t) => ({ id: t?.Id, nombre: t?.Nombre })),
  };
}

/** Las series de UNA tabla · con su código, que es lo que hace falta. */
export async function seriesDeTablaINE(tablaId, filtro) {
  const datos = await pedirJSON(
    `https://servicios.ine.es/wstempus/js/ES/SERIES_TABLA/${tablaId}`,
  );
  const lista = Array.isArray(datos) ? datos : [];
  const encaja = encajaCon(filtro);
  return {
    total: lista.length,
    hallados: lista
      .filter((s) => !filtro || encaja(s?.Nombre))
      .map((s) => ({ cod: s?.COD, nombre: s?.Nombre })),
  };
}
