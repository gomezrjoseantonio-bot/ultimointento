import type { DeclaracionInmueble } from '../../types/fiscal';
import { __private__, calcularEstadisticasReconciliacion } from '../reconciliacionService';

function crearInmueble(overrides: Partial<DeclaracionInmueble> = {}): DeclaracionInmueble {
  return {
    orden: 1,
    referenciaCatastral: 'REF-001',
    direccion: 'Calle Mayor 001 Madrid',
    porcentajePropiedad: 100,
    uso: 'arrendamiento',
    esAccesorio: false,
    derechoReduccion: true,
    diasArrendado: 365,
    diasDisposicion: 0,
    rentaImputada: 0,
    ingresosIntegros: 12000,
    arrastresRecibidos: 0,
    arrastresAplicados: 0,
    interesesFinanciacion: 0,
    gastosReparacion: 0,
    gastos0105_0106Aplicados: 0,
    arrastresGenerados: 0,
    gastosComunidad: 0,
    gastosServicios: 0,
    gastosSuministros: 0,
    gastosSeguros: 0,
    gastosTributos: 0,
    amortizacionMuebles: 0,
    fechaAdquisicion: '2020-01-15',
    valorCatastral: 100000,
    valorCatastralConstruccion: 70000,
    porcentajeConstruccion: 70,
    importeAdquisicion: 150000,
    gastosAdquisicion: 12000,
    amortizacionInmueble: 0,
    rendimientoNeto: 0,
    reduccion: 0,
    rendimientoNetoReducido: 0,
    ...overrides,
  };
}

describe('reconciliacionService', () => {
  it('normaliza direcciones y encuentra matches parciales por palabras significativas', () => {
    const aeat = crearInmueble({ referenciaCatastral: 'AEAT-001', direccion: 'CL Mayor 001 Madrid Centro' });
    const atlas = __private__.buscarMatchParcial(aeat, [
      {
        id: '11',
        referenciaCatastral: '',
        direccion: 'Avenida Mayor 1 Madrid Centro',
        estado: 'activo',
      },
    ], new Set());

    expect(__private__.normalizarDireccion('CL Mayor 001 Madrid')).toBe('MAYOR 1 MADRID');
    expect(atlas?.id).toBe('11');
  });

  it('marca diferencias y coincidencias campo a campo', () => {
    const campos = __private__.compararCamposInmueble(
      crearInmueble(),
      {
        id: '10',
        referenciaCatastral: 'REF-001',
        direccion: 'Calle Mayor 1 Madrid',
        estado: 'activo',
        valorCatastral: 100000,
        valorCatastralConstruccion: 65000,
        porcentajeConstruccion: 65,
        precioAdquisicion: 150000,
        gastosAdquisicion: 12000,
        fechaAdquisicion: '2020-01-15',
        porcentajePropiedad: 100,
      },
    );

    expect(campos.find((campo) => campo.campo === 'valorCatastral')?.tipo).toBe('coincide');
    expect(campos.find((campo) => campo.campo === 'valorCatastralConstruccion')?.tipo).toBe('difiere');
    expect(campos.find((campo) => campo.campo === 'valorCatastralConstruccion')?.decision).toBe('pendiente');
  });

  it('calcula estadísticas globales de la reconciliación', () => {
    const stats = calcularEstadisticasReconciliacion({
      inmuebles: [
        {
          tipo: 'match_parcial',
          referenciaCatastral: 'REF-001',
          direccion: 'Calle Mayor 1',
          estado: 'pendiente',
          campos: [
            {
              campo: 'valorCatastral',
              label: 'Valor catastral',
              seccion: 'catastral',
              valorAtlas: 1,
              valorAeat: 1,
              tipo: 'coincide',
              decision: 'mantener_atlas',
              impacto: 'alto',
              formato: 'moneda',
            },
            {
              campo: 'precio',
              label: 'Precio',
              seccion: 'adquisicion',
              valorAtlas: 1,
              valorAeat: 2,
              tipo: 'difiere',
              decision: 'pendiente',
              impacto: 'alto',
              formato: 'moneda',
            },
          ],
        },
      ],
      trabajo: { campos: [], tieneAeat: false, tieneAtlas: false },
      actividad: { campos: [], tieneAeat: false, tieneAtlas: false },
    });

    expect(stats).toEqual({
      totalCamposComparados: 2,
      coincidencias: 1,
      diferencias: 1,
      sinDatosAtlas: 0,
      pendientesDeDecision: 1,
    });
  });
});
