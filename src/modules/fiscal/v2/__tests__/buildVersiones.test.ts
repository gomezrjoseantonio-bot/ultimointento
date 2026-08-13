import { buildVersiones } from '../FiscalEjercicioPage';

const version = (id: string, resultado: number, esRectificativa: boolean) => ({
  id,
  fechaImportacion: '2026-06-01T10:00:00.000Z',
  fuenteImportacion: 'xml' as const,
  snapshot: {},
  resumen: { resultado } as any,
  esRectificativa,
  resultado,
});

const datos = { estado: 'declarado', resultado: 2899.75, fuente: 'xml_aeat' } as any;

describe('buildVersiones · histórico real de versiones', () => {
  it('mapea original + rectificativas a v1/v2/v3 con la última activa', () => {
    const aeat = {
      versionActivaId: 'k3',
      versiones: [
        version('k1', 2077.61, false),
        version('k2', 1859.88, true),
        version('k3', 2899.75, true),
      ],
    };
    const rows = buildVersiones(datos, aeat as any, false);

    expect(rows.map((r) => r.version)).toEqual(['v1', 'v2', 'v3']);
    expect(rows.map((r) => r.resultado)).toEqual([2077.61, 1859.88, 2899.75]);
    expect(rows.map((r) => r.activa)).toEqual([false, false, true]);
    expect(rows[0].nota).toBe('original presentada');
    expect(rows[1].nota).toBe('rectificativa');
    expect(rows[2].nota).toBe('rectificativa');
  });

  it('sin histórico (coords antiguos) cae al comportamiento previo v1', () => {
    const rows = buildVersiones(datos, { fuenteImportacion: 'xml' } as any, false);
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('v1');
    expect(rows[0].activa).toBe(true);
  });
});
