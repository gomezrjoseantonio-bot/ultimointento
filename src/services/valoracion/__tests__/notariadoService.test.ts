import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const fila = (extra: Record<string, unknown> = {}) => ({
  precio_m2: 2500,
  precio_medio: 220000,
  superficie_media: 88,
  total: 60,
  total_informados: 55,
  es_estimado: 0,
  ...extra,
});

/** Responde según la capa que se pida · 4 es código postal, 2 provincia. */
const responder = (porCapa: Record<number, unknown>) =>
  jest.fn().mockImplementation((url: string) => {
    const capa = Number(url.match(/FeatureServer\/(\d+)\/query/)?.[1]);
    const attributes = porCapa[capa];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () =>
        attributes === undefined ? { features: [] } : { features: [{ attributes }] },
    });
  });

describe('notariadoService', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('usa el código postal cuando tiene escrituras suficientes', async () => {
    (globalThis as any).fetch = responder({ 4: fila() });
    const { precioDeZona } = require('../notariadoService');

    const r = await precioDeZona('08272', 'usada');
    expect(r.nivel).toBe('codigo-postal');
    expect(r.zona).toBe('08272');
    expect(r.precioM2).toBe(2500);
    expect(r.operaciones).toBe(60);
  });

  // «Tu calle» y «tu provincia» no son la misma afirmación: si hay que subir,
  // el resultado tiene que decirlo.
  it('sube a provincia cuando el código postal tiene muy pocas operaciones', async () => {
    (globalThis as any).fetch = responder({
      4: fila({ total: 3, precio_m2: 9000 }),
      2: fila({ total: 400, precio_m2: 2100 }),
    });
    const { precioDeZona } = require('../notariadoService');

    const r = await precioDeZona('08272', 'usada');
    expect(r.nivel).toBe('provincia');
    expect(r.zona).toBe('08');
    expect(r.precioM2).toBe(2100);
  });

  it('sube a provincia si el Notariado marca el dato como estimado', async () => {
    (globalThis as any).fetch = responder({
      4: fila({ es_estimado: 1 }),
      2: fila({ total: 400 }),
    });
    const { precioDeZona } = require('../notariadoService');

    expect((await precioDeZona('08272', 'usada')).nivel).toBe('provincia');
  });

  // Si la provincia tampoco aporta, mejor el dato de su calle que uno peor.
  it('no sube si la provincia no mejora la muestra', async () => {
    (globalThis as any).fetch = responder({
      4: fila({ total: 4 }),
      2: fila({ total: 2 }),
    });
    const { precioDeZona } = require('../notariadoService');

    const r = await precioDeZona('08272', 'usada');
    expect(r.nivel).toBe('codigo-postal');
  });

  it('pregunta por obra nueva con otro código de tipo', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    await precioDeZona('08272', 'obra-nueva');
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain('tipo_construccion_id = 7');

    await precioDeZona('28001', 'usada');
    expect(decodeURIComponent(fetchMock.mock.calls[1][0])).toContain('tipo_construccion_id = 9');
  });

  // El Notariado publica precios de VIVIENDA · un trastero de 20 m² «valdría»
  // 37.000 € en un barrio donde el piso va a 1.874 €/m².
  it('no valora un parking ni un trastero con el precio de la vivienda', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    expect(await precioDeZona('33006', 'usada', 'parking')).toBeNull();
    expect(await precioDeZona('33006', 'usada', 'trastero')).toBeNull();
    expect(await precioDeZona('33006', 'usada', 'local')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a un piso le pregunta por pisos, no por todas las fincas', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    await precioDeZona('33006', 'usada', 'piso');
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain(
      'clase_finca_urbana_id = 14',
    );
  });

  it('sin saber qué es, pregunta por todas las viviendas', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    await precioDeZona('33006', 'usada', undefined);
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain(
      'clase_finca_urbana_id = 99',
    );
  });

  it('sin dato en ningún nivel devuelve null en vez de inventar', async () => {
    (globalThis as any).fetch = responder({});
    const { precioDeZona } = require('../notariadoService');

    expect(await precioDeZona('08272', 'usada')).toBeNull();
  });

  it('rechaza un código postal que no lo es, sin llamar al servicio', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    expect(await precioDeZona('8272', 'usada')).toBeNull();
    expect(await precioDeZona('', 'usada')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Cada consulta gasta cuota de la organización del Notariado.
  it('no vuelve a preguntar lo que ya preguntó', async () => {
    const fetchMock = responder({ 4: fila() });
    (globalThis as any).fetch = fetchMock;
    const { precioDeZona } = require('../notariadoService');

    await precioDeZona('08272', 'usada');
    await precioDeZona('08272', 'usada');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Devolver `null` cuando el servicio se cae era convertir «no he podido
  // preguntar» en «esta zona no tiene escrituras». La primera se arregla
  // esperando; la segunda no se arregla nunca. Hay que poder distinguirlas.
  it('si el servicio falla lo dice · no lo disfraza de zona sin datos', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));
    const { precioDeZona } = require('../notariadoService');

    await expect(precioDeZona('08272', 'usada')).rejects.toThrow(/sin red/);
  });

  // El navegador es el camino normal · si su red lo bloquea, la misma pregunta
  // se hace desde el servidor, donde no hay bloqueadores.
  it('cuando la llamada directa falla, pregunta por la función de Netlify', async () => {
    const llamadas: string[] = [];
    (globalThis as any).fetch = jest.fn().mockImplementation((url: string) => {
      llamadas.push(url);
      if (url.startsWith('http')) return Promise.reject(new Error('bloqueada'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ fila: fila() }),
      });
    });
    const { precioDeZona } = require('../notariadoService');

    const r = await precioDeZona('08272', 'usada');
    expect(r.precioM2).toBe(2500);
    expect(llamadas[1]).toContain('/.netlify/functions/precio-zona');
    expect(llamadas[1]).toContain('cp=08272');
  });

  // Los dos caminos rotos son dos averías distintas · se nombran las dos.
  it('si tampoco hay respaldo, el motivo nombra los dos caminos', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));
    const { precioDeZona } = require('../notariadoService');

    await expect(precioDeZona('08272', 'usada')).rejects.toThrow(/directo:.*servidor:/);
  });

  it('multiplica por los metros y puntúa la fiabilidad', async () => {
    (globalThis as any).fetch = responder({ 4: fila({ precio_m2: 2500, total: 60 }) });
    const { estimarPorZona } = require('../notariadoService');

    const e = await estimarPorZona(90, '08272', 'usada');
    expect(e.valor).toBe(225000);
    expect(e.fiabilidad).toBe('alta');
  });

  it('un dato de provincia nunca es de fiabilidad alta', async () => {
    (globalThis as any).fetch = responder({
      4: undefined,
      2: fila({ total: 5000 }),
    });
    const { estimarPorZona } = require('../notariadoService');

    expect((await estimarPorZona(90, '08272', 'usada')).fiabilidad).toBe('media');
  });

  it('sin metros no hay estimación · no se inventa una superficie', async () => {
    (globalThis as any).fetch = responder({ 4: fila() });
    const { estimarPorZona } = require('../notariadoService');

    expect(await estimarPorZona(0, '08272', 'usada')).toBeNull();
    expect(await estimarPorZona(NaN, '08272', 'usada')).toBeNull();
  });
});
