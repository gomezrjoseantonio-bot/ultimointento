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

/** IPC · índice general nacional. Verificar el código en la primera ejecución. */
const INE_SERIE_IPC = 'IPC251856';

/**
 * IRAV · Índice de Referencia para la Actualización anual de los contratos de
 * arrendamiento de Vivienda, que el INE publica mensualmente y que desde 2025
 * sustituye al IPC para actualizar rentas de vivienda habitual.
 * Código pendiente de confirmar en la primera ejecución.
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
 */
async function serieINE(codigo, { nult = 600 } = {}) {
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
  const cabecera = lineas[0].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const iPeriodo = cabecera.indexOf('TIME_PERIOD');
  const iValor = cabecera.indexOf('OBS_VALUE');
  const iTitulo = cabecera.indexOf('TITLE');
  if (iPeriodo === -1 || iValor === -1) {
    throw new Error(`CSV del BCE sin TIME_PERIOD/OBS_VALUE · cabeceras: ${cabecera.join('|')}`);
  }
  const valores = {};
  let nombre = '(sin nombre)';
  for (const linea of lineas.slice(1)) {
    const celdas = linea.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const periodo = celdas[iPeriodo];
    const valor = Number(celdas[iValor]);
    if (!/^\d{4}-\d{2}$/.test(periodo) || !Number.isFinite(valor)) continue;
    valores[periodo] = valor;
    if (iTitulo !== -1 && celdas[iTitulo]) nombre = celdas[iTitulo];
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
    nombre: 'IPC · índice general nacional',
    unidad: 'indice',
    cadenciaMeses: 1,
    rango: [50, 250],
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
