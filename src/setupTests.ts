/**
 * Test setup for IndexedDB mocking
 */

import 'fake-indexeddb/auto';

// Mock structuredClone for fake-indexeddb
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// E3.3b · `TextDecoder`/`TextEncoder` existen en todo navegador desde hace una
// década, pero no en el jsdom que trae CRA. Se toman los de Node, que son los
// mismos de la Encoding Standard — no es un mock, es la implementación de
// verdad: el lector de CSV necesita decodificar windows-1252 cuando el fichero
// no es UTF-8 válido, y eso hay que poder probarlo con bytes reales.
if (!global.TextDecoder || !global.TextEncoder) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
}

// Mock crypto for hash generation
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockImplementation((algorithm: string, data: ArrayBuffer) => {
        // Simple mock implementation for testing
        const dataArray = new Uint8Array(data);
        const hash = Array.from(dataArray).reduce((acc, byte) => acc + byte, 0);
        const hashBuffer = new ArrayBuffer(32);
        const hashView = new Uint8Array(hashBuffer);
        hashView[0] = hash & 0xFF;
        return Promise.resolve(hashBuffer);
      })
    }
  }
});