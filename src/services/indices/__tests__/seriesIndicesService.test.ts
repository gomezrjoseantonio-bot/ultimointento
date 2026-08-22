import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { SerieIndice } from '../../../types/seriesIndices';

const serieEuribor = (valores: Record<string, number>): SerieIndice => ({
  esquema: 1,
  id: 'euribor-12m',
  nombre: 'Euríbor a 12 meses · media mensual',
  unidad: 'porcentaje',
  cadenciaMeses: 1,
  fuente: { nombre: 'BCE', url: 'https://example.test', serieOrigen: 'FM...' },
  actualizadoEn: '2026-08-03T05:00:00.000Z',
  valores,
});

const serieIPC = (valores: Record<string, number>): SerieIndice => ({
  ...serieEuribor(valores),
  id: 'ipc',
  nombre: 'IPC · índice general nacional',
  unidad: 'indice',
});

describe('seriesIndicesService · lectura por mes', () => {
  const {
    valorEnMes,
    variacionInteranual,
    porcentajeDeActualizacion,
    ultimoPeriodo,
    variacionEntre,
    mesesDeRetraso,
    esSerieValida,
    periodoDe,
  } = require('../seriesIndicesService');

  it('devuelve el valor del mes pedido con su procedencia', () => {
    const serie = serieEuribor({ '2026-06': 2.101, '2026-07': 2.234 });
    expect(valorEnMes(serie, '2026-07')).toEqual({
      valor: 2.234,
      periodo: '2026-07',
      unidad: 'porcentaje',
      fuente: serie.fuente,
      metodo: 'auto',
    });
  });

  // La regla que justifica todo el módulo: una revisión de marzo necesita el
  // índice de marzo. Servir el de febrero «porque se parece» es inventar el
  // número del que cuelga la cuota.
  it('NO rellena el hueco de un mes sin dato con el mes anterior', () => {
    const serie = serieEuribor({ '2026-06': 2.101 });
    expect(valorEnMes(serie, '2026-07')).toBeNull();
  });

  it('calcula la variación interanual de una serie de índice', () => {
    const serie = serieIPC({ '2025-07': 100, '2026-07': 103.5 });
    expect(variacionInteranual(serie, '2026-07')).toBeCloseTo(3.5, 10);
  });

  it('sin el dato de hace doce meses no hay variación que calcular', () => {
    const serie = serieIPC({ '2026-07': 103.5 });
    expect(variacionInteranual(serie, '2026-07')).toBeNull();
  });

  it('una serie ya publicada en porcentaje no se recalcula', () => {
    const irav = { ...serieEuribor({ '2026-07': 2.2 }), id: 'irav' as const };
    expect(variacionInteranual(irav, '2026-07')).toBeNull();
    expect(porcentajeDeActualizacion(irav, '2026-07')).toBe(2.2);
  });

  it('unifica las dos formas de publicar en un solo porcentaje', () => {
    const ipc = serieIPC({ '2025-07': 100, '2026-07': 102 });
    expect(porcentajeDeActualizacion(ipc, '2026-07')).toBeCloseTo(2, 10);
  });

  it('ordena los periodos como texto para hallar el último', () => {
    const serie = serieEuribor({ '2026-01': 1, '2025-12': 2, '2026-10': 3 });
    expect(ultimoPeriodo(serie)).toBe('2026-10');
    expect(ultimoPeriodo(serieEuribor({}))).toBeNull();
  });

  it('mide el retraso descontando la cadencia normal de publicación', () => {
    const serie = serieEuribor({ '2026-07': 2.2 });
    // En agosto, tener el dato de julio es ir al día: la fuente publica el mes
    // cerrado, nunca el corriente.
    expect(mesesDeRetraso(serie, '2026-08-22')).toBe(0);
    expect(mesesDeRetraso(serie, '2026-11-02')).toBe(3);
    expect(mesesDeRetraso(serieEuribor({}), '2026-08-22')).toBeNull();
  });

  // Lo que revaloriza una compra · IPV trimestral, con la compra en un mes que
  // no tiene dato propio.
  it('compara dos momentos aunque el mes exacto no esté publicado', () => {
    const ipv = serieIPC({ '2015-03': 100, '2015-06': 102, '2026-06': 153 });
    // Compra en mayo de 2015 · manda el trimestre cerrado en marzo.
    expect(variacionEntre(ipv, '2015-05', '2026-08')).toBeCloseTo(1.53, 10);
    // Compra en junio · ya cuenta el trimestre de junio.
    expect(variacionEntre(ipv, '2015-06', '2026-08')).toBeCloseTo(1.5, 10);
  });

  it('no ancla una fecha en un dato de hace más de un año', () => {
    const ipv = serieIPC({ '2015-03': 100, '2026-06': 153 });
    // Entre 2015-03 y 2020-01 hay casi cinco años de silencio: eso ya no
    // describe el mismo mercado y es mejor no responder.
    expect(variacionEntre(ipv, '2020-01', '2026-08')).toBeNull();
  });

  it('una serie en porcentaje no se puede comparar así', () => {
    const euribor = serieEuribor({ '2015-03': 0.2, '2026-06': 2.8 });
    expect(variacionEntre(euribor, '2015-03', '2026-06')).toBeNull();
  });

  it('rechaza un fichero que no tenga la forma esperada', () => {
    expect(esSerieValida(serieEuribor({ '2026-07': 2.2 }))).toBe(true);
    expect(esSerieValida(null)).toBe(false);
    expect(esSerieValida({ ...serieEuribor({}), esquema: 2 })).toBe(false);
    expect(esSerieValida({ ...serieEuribor({}), unidad: 'euros' })).toBe(false);
    expect(esSerieValida(serieEuribor({ '2026-13': 2.2 }))).toBe(false);
    expect(esSerieValida(serieEuribor({ julio: 2.2 }))).toBe(false);
    expect(esSerieValida({ ...serieEuribor({}), valores: { '2026-07': 'x' } })).toBe(false);
  });

  it('recorta una fecha ISO al periodo mensual', () => {
    expect(periodoDe('2026-07-14')).toBe('2026-07');
    expect(periodoDe('2026-07-14T10:00:00.000Z')).toBe('2026-07');
  });
});

describe('seriesIndicesService · descarga y caché', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  const conRespuesta = (dato: unknown, ok = true) => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 404,
      json: async () => dato,
    });
  };

  it('descarga la serie y la deja cacheada para la próxima vez', async () => {
    const servicio = require('../seriesIndicesService');
    const serie = serieEuribor({ '2026-07': 2.234 });
    conRespuesta(serie);

    expect(await servicio.cargarSerie('euribor-12m')).toEqual(serie);

    // Segunda vuelta con la red caída: tiene que salir de la caché.
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));
    expect(await servicio.cargarSerie('euribor-12m')).toEqual(serie);
  });

  it('si el fichero descargado viene corrupto se queda con la copia buena', async () => {
    const servicio = require('../seriesIndicesService');
    const buena = serieEuribor({ '2026-07': 2.234 });
    conRespuesta(buena);
    await servicio.cargarSerie('euribor-12m');

    conRespuesta({ esquema: 1, valores: 'esto no es un mapa' });
    expect(await servicio.cargarSerie('euribor-12m')).toEqual(buena);
  });

  it('sin red y sin caché devuelve null en vez de inventar una serie', async () => {
    const servicio = require('../seriesIndicesService');
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));
    expect(await servicio.cargarSerie('ipc')).toBeNull();
  });
});
