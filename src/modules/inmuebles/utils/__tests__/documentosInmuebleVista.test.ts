import type { Document } from '../../../../services/db';
import {
  agruparDocumentos,
  clasificarCarpetaDocumento,
  aDocumentoVista,
  type DocumentoVista,
} from '../documentosInmuebleVista';

const doc = (over: Partial<Document> & { metadata?: Partial<Document['metadata']> }): Document =>
  ({
    id: 1,
    filename: 'x.pdf',
    type: 'application/pdf',
    size: 100,
    lastModified: Date.parse('2026-04-10'),
    content: new Blob(),
    metadata: {},
    ...over,
    metadata: { ...(over.metadata ?? {}) },
  }) as Document;

describe('clasificarCarpetaDocumento', () => {
  it('detecta contractual por tipo/carpeta y por texto', () => {
    expect(clasificarCarpetaDocumento(doc({ metadata: { tipo: 'contrato' } }))).toBe('contractual');
    expect(clasificarCarpetaDocumento(doc({ filename: 'Escritura compraventa.pdf' }))).toBe('contractual');
  });

  it('detecta fiscal por aeatClassification, tipo o IBI', () => {
    expect(clasificarCarpetaDocumento(doc({ metadata: { tipo: 'fiscal' } }))).toBe('fiscal');
    expect(clasificarCarpetaDocumento(doc({ filename: 'Recibo IBI 2026.pdf' }))).toBe('fiscal');
  });

  it('detecta suministros, seguros y mejoras', () => {
    expect(clasificarCarpetaDocumento(doc({ filename: 'Factura Iberdrola.pdf' }))).toBe('suministros');
    expect(clasificarCarpetaDocumento(doc({ filename: 'Póliza seguro hogar Mapfre.pdf' }))).toBe('seguros');
    expect(clasificarCarpetaDocumento(doc({ metadata: { carpeta: 'mejoras' } }))).toBe('mejoras');
  });

  it('cae en otros cuando no hay señales', () => {
    expect(clasificarCarpetaDocumento(doc({ filename: 'nota.txt' }))).toBe('otros');
  });
});

describe('agruparDocumentos', () => {
  it('agrupa solo carpetas no vacías en orden canónico', () => {
    const vistas = [
      aDocumentoVista(doc({ id: 1, filename: 'Contrato.pdf', metadata: { tipo: 'contrato' } })),
      aDocumentoVista(doc({ id: 2, filename: 'Recibo IBI.pdf' })),
      aDocumentoVista(doc({ id: 3, filename: 'Factura luz.pdf' })),
    ].filter((d): d is DocumentoVista => d !== null);

    const carpetas = agruparDocumentos(vistas);
    const keys = carpetas.map((c) => c.key);
    expect(keys).toEqual(['contractual', 'suministros', 'fiscal']);
    expect(carpetas.every((c) => c.docs.length > 0)).toBe(true);
  });
});
