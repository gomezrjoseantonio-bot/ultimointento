/**
 * Test setup for IndexedDB mocking
 */

import 'fake-indexeddb/auto';

// Mock structuredClone for fake-indexeddb
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
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