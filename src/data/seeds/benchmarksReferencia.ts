// Seed inicial · store `benchmarksReferencia` (V72 · PR 2).
// T-INVERSIONES-DETALLE-PP-v1 · §8 · decisión Q-PRE-H opción B (precarga
// vacía + banner UI). CC NO asume responsabilidad sobre valores financieros
// oficiales · Jose introduce los valores anuales manualmente desde la UI
// Ajustes → Datos de mercado.
//
// 6 benchmarks con metadata completa (código · nombre · tipo · divisa ·
// descripción · fuenteUrl sugerida) + `valoresAnuales: {}` vacío.
//
// El banner "Datos pendientes · introduce manualmente" se dispara en la UI
// cuando `vaciosEnLista(items)` es true (todos con `valoresAnuales == {}`),
// no por `ultimaActualizacion`. Aquí dejamos `ultimaActualizacion: null`
// como dato de presentación (la columna "Actualizado" muestra "—"). En
// cuanto el usuario añada un valor anual desde la UI, el service pone
// `ultimaActualizacion` a la fecha ISO de hoy.

import type { BenchmarkReferencia } from '../../types/benchmarksReferencia';

const FECHA_SEED_ISO = '2026-05-17T00:00:00.000Z';

export const SEED_BENCHMARKS_V72: ReadonlyArray<BenchmarkReferencia> = [
  {
    id: 'seed-msci-world-eur',
    codigo: 'MSCI_WORLD_EUR',
    nombre: 'MSCI World EUR',
    tipo: 'indice_equity',
    divisa: 'EUR',
    descripcion:
      'Renta variable global · ~1.500 valores grandes y medianos de mercados desarrollados · denominado en EUR.',
    valoresAnuales: {},
    fuenteUrl: 'https://www.msci.com/end-of-day-data-search',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
  {
    id: 'seed-sp500-eur',
    codigo: 'SP500_EUR',
    nombre: 'S&P 500 EUR',
    tipo: 'indice_equity',
    divisa: 'EUR',
    descripcion:
      'Renta variable EEUU · 500 mayores empresas cotizadas en bolsas estadounidenses · convertido a EUR.',
    valoresAnuales: {},
    fuenteUrl: 'https://www.spglobal.com/spdji/en/indices/equity/sp-500/',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
  {
    id: 'seed-eurostoxx-50',
    codigo: 'EUROSTOXX_50',
    nombre: 'EURO STOXX 50',
    tipo: 'indice_equity',
    divisa: 'EUR',
    descripcion:
      'Renta variable europa · 50 mayores empresas de la zona euro · referencia bluechip europea.',
    valoresAnuales: {},
    fuenteUrl: 'https://www.stoxx.com/index-details?symbol=SX5E',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
  {
    id: 'seed-bonds-agg-eur',
    codigo: 'BONDS_AGG_EUR',
    nombre: 'Bloomberg Global Aggregate Bond EUR',
    tipo: 'indice_renta_fija',
    divisa: 'EUR',
    descripcion:
      'Renta fija global · bonos gubernamentales y corporativos investment grade · denominado en EUR.',
    valoresAnuales: {},
    fuenteUrl: 'https://www.bloomberg.com/quote/LEGATREU:IND',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
  {
    id: 'seed-cpi-es',
    codigo: 'CPI_ES',
    nombre: 'IPC España',
    tipo: 'inflacion',
    divisa: 'EUR',
    descripcion:
      'Inflación · Índice de Precios al Consumo de España · publicado por el INE.',
    valoresAnuales: {},
    fuenteUrl: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176802',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
  {
    id: 'seed-cpi-eur',
    codigo: 'CPI_EUR',
    nombre: 'HICP Zona Euro',
    tipo: 'inflacion',
    divisa: 'EUR',
    descripcion:
      'Inflación referencia · Harmonised Index of Consumer Prices de la zona euro · publicado por Eurostat.',
    valoresAnuales: {},
    fuenteUrl: 'https://ec.europa.eu/eurostat/web/hicp',
    ultimaActualizacion: null,
    fechaCreacion: FECHA_SEED_ISO,
    fechaModificacion: FECHA_SEED_ISO,
  },
];
