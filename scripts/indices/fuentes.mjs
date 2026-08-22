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
 * Verificado en la primera ejecución (22 ago 2026): el INE devuelve esta serie
 * como «Nacional. Índice general. Variación anual», o sea ya en TASA, no como
 * número índice sobre una base. Es justo lo que se aplica a una renta, así que
 * se guarda tal cual y `porcentajeDeActualizacion` la usa sin recalcular nada.
 */
const INE_SERIE_IPC = 'IPC251856';

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
async function serieINE(codigo, { nult = 240 } = {}) {
  const datos = await pedirJSON(`${INE_BASE}/${codigo}?nult=${nult}`);
  const nombre = datos?.Nombre ?? '(sin nombre)';
  const filas = Array.isArray(datos?.Data) ? datos.Data : [];
  const valores = {};
  for (const fila of filas) {
    const ano = Number(fila?.Anyo);
    const mes = Number(fila?.FK_Periodo);
    const valor = Number(fila?.Valor);
    if (!Number.isInteger(ano) || !(mes >= 1 && mes <= 12)) continue;
    if (!Number.isFinite(valor)) continue;
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
