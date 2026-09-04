// Candado de `batchHashUtils` (V6 · D1 bis).
//
// Este módulo decide si un extracto ya se importó, así que un hash malo bloquea
// una importación legítima y un hash ausente duplica movimientos y falsea los
// saldos. La cobertura que pretendía darle `src/tests/fixExtractosIntegration.test.ts`
// NO se ejecuta (esa suite no arranca: `Cannot redefine property: crypto`, ya
// roja en main), así que estas pruebas cubren el hueco.
//
// jsdom no trae `crypto.subtle` ni `File.text()`, de modo que aquí se ejercita
// justo la rama de respaldo — la que de verdad corre en entornos sin crypto.

import { generateBatchHash } from '../batchHashUtils';

/** jsdom no implementa `File.text()`; se lee por FileReader, que sí está. */
beforeAll(() => {
  if (typeof File.prototype.text !== 'function') {
    // eslint-disable-next-line no-extend-native
    (File.prototype as unknown as { text: () => Promise<string> }).text = function (this: File) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
});

describe('generateBatchHash', () => {
  it('es determinista: el mismo fichero da el mismo hash', async () => {
    const a = new File(['fecha;concepto;importe\n01/01/2026;LUZ;-42,10'], 'extracto.csv');
    const b = new File(['fecha;concepto;importe\n01/01/2026;LUZ;-42,10'], 'extracto.csv');

    const ha = await generateBatchHash(a);
    expect(ha).not.toBe('');
    expect(await generateBatchHash(b)).toBe(ha);
  });

  it('distingue ficheros con el mismo nombre y contenido distinto', async () => {
    // El caso que importa: dos extractos del mismo banco y mes, guardados con
    // el mismo nombre. Si colisionaran, el segundo se rechazaría por "ya
    // importado" y el usuario perdería movimientos reales.
    const enero = new File(['01/01/2026;LUZ;-42,10'], 'movimientos.csv');
    const febrero = new File(['01/02/2026;LUZ;-51,80'], 'movimientos.csv');

    expect(await generateBatchHash(enero)).not.toBe(await generateBatchHash(febrero));
  });

  it('distingue ficheros con el mismo contenido y nombre distinto', async () => {
    const uno = new File(['mismo contenido'], 'santander.csv');
    const dos = new File(['mismo contenido'], 'sabadell.csv');

    expect(await generateBatchHash(uno)).not.toBe(await generateBatchHash(dos));
  });

  it('no revienta con un extracto grande leído por arrayBuffer · conversión por bloques', async () => {
    // Este es el caso que rompía: `String.fromCharCode(...bytes)` de golpe lanza
    // RangeError por encima de ~100k argumentos, y el catch del llamante lo
    // convertiría en '' (sin idempotencia) sin que nadie se entere.
    //
    // Hay que forzar la rama de `arrayBuffer()`: si el objeto expone `text()`,
    // se lee por ahí y la conversión por bloques ni se toca — el test pasaría
    // sin probar nada. Por eso este doble SOLO tiene `arrayBuffer`.
    const bytes = new Uint8Array(400_000).fill(120); // 400 KB de 'x'
    const soloArrayBuffer = {
      name: 'extracto-anual.csv',
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
    } as unknown as File;

    const hash = await generateBatchHash(soloArrayBuffer);
    expect(hash).not.toBe('');
    expect(typeof hash).toBe('string');
  });

  it('lee por arrayBuffer cuando no hay text(), y distingue contenidos', async () => {
    const mk = (fill: number) => {
      const bytes = new Uint8Array(64).fill(fill);
      return {
        name: 'extracto.csv',
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer,
      } as unknown as File;
    };

    expect(await generateBatchHash(mk(65))).not.toBe(await generateBatchHash(mk(66)));
  });

  it('cae al respaldo si crypto.subtle.digest resuelve a algo inservible', async () => {
    // El caso peligroso no es que `digest` lance —eso ya lo cubría el catch—
    // sino que resuelva a `undefined` sin lanzar, como hace el stub de jsdom (y
    // algún entorno embebido). Sin guarda, `new Uint8Array(undefined)` da un
    // array vacío y la función devolvía '' saltándose el catch: idempotencia
    // perdida en silencio. Aquí se comprueba que el respaldo sí entra.
    const bytes = new Uint8Array(32).fill(7);
    const f = {
      name: 'extracto.csv',
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
    } as unknown as File;

    const subtle = (globalThis as unknown as { crypto: { subtle: { digest: unknown } } }).crypto
      ?.subtle;
    const original = subtle?.digest;
    if (subtle) subtle.digest = async () => undefined;
    try {
      expect(await generateBatchHash(f)).not.toBe('');
    } finally {
      if (subtle && original) subtle.digest = original;
    }
  });

  it('devuelve "" —y no un hash inventado— si no puede leer el contenido', async () => {
    // Sin `text()` ni `arrayBuffer()` no hay bytes que hashear. Inventar uno con
    // nombre+tamaño colisionaría entre ficheros distintos del mismo banco y mes;
    // preferimos degradar a "sin idempotencia" antes que rechazar un extracto bueno.
    const ilegible = {
      name: 'extracto.csv',
      size: 1234,
    } as unknown as File;

    expect(await generateBatchHash(ilegible)).toBe('');
  });
});
