import type {
  CompromisoRecurrente,
  ImporteEvento,
  PatronRecurrente,
} from '../../../types/compromisosRecurrentes';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import {
  clasificarCompromisoRecurrenteInmueble,
  clasificarGastoVisualInmueble,
  esCompromisoRecurrenteDeInmueble,
} from './clasificacionGastoVisual';
import {
  construirListaVisualGastosInmueble,
  filtrarCompromisosRecurrentesDeInmueble,
} from '../adapters/gastosInmuebleAdapter';

const patronMensual: PatronRecurrente = { tipo: 'mensualDiaFijo', dia: 5 };
const importeFijo = (importe: number): ImporteEvento => ({ modo: 'fijo', importe });

function crearCompromisoBase(
  parcial: Partial<CompromisoRecurrente> = {},
): CompromisoRecurrente {
  return {
    id: 1,
    ambito: 'inmueble',
    inmuebleId: 10,
    alias: 'Compromiso test',
    subtipo: 'otros',
    proveedor: { nombre: 'Proveedor' },
    patron: patronMensual,
    importe: importeFijo(100),
    familia: 'otros',
    responsable: 'titular',
    cuentaCargo: 1,
    conceptoBancario: 'TEST',
    metodoPago: 'domiciliacion',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearGastoRealBase(parcial: Partial<GastoInmueble> = {}): GastoInmueble {
  return {
    id: 201,
    inmuebleId: 10,
    ejercicio: 2026,
    fecha: '2026-01-10',
    concepto: 'Gasto real',
    familia: 'gestion',
    casillaAEAT: '0112',
    importe: 80,
    origen: 'manual',
    estado: 'confirmado',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...parcial,
  };
}

function crearMejoraBase(parcial: Partial<MejoraInmueble> = {}): MejoraInmueble {
  return {
    id: 301,
    inmuebleId: 10,
    ejercicio: 2026,
    descripcion: 'Mejora',
    tipo: 'mejora',
    importe: 1500,
    fecha: '2026-02-01',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...parcial,
  };
}

function crearMuebleBase(parcial: Partial<MuebleInmueble> = {}): MuebleInmueble {
  return {
    id: 401,
    inmuebleId: 10,
    ejercicio: 2026,
    descripcion: 'Mueble',
    fechaAlta: '2026-03-01',
    importe: 500,
    vidaUtil: 10,
    activo: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...parcial,
  };
}

describe('clasificacionGastoVisual (inmueble)', () => {
  it('no clasifica luz personal como explotación patrimonial', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'personal', familia: 'suministro', subtipo: 'luz' })).toBe('sin_clasificar');
  });

  it('clasifica luz de inmueble como explotar', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'suministro', subtipo: 'luz' })).toBe('explotar');
  });

  it('clasifica IBI de inmueble como mantener', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'impuestos_tasas', subtipo: 'ibi' })).toBe('mantener');
  });

  it('clasifica limpieza por estancia como explotar', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'limpieza', subtipo: 'por_estancia' })).toBe('explotar');
  });

  it('clasifica gestión del alquiler como explotar', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'gestion' })).toBe('explotar');
  });

  it('clasifica mantenimiento de caldera como mantener', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'reparacion_mantenimiento', subtipo: 'caldera' })).toBe('mantener');
  });

  it('clasifica mobiliario como mobiliario', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'mobiliario_enseres', subtipo: 'muebles' })).toBe('mobiliario');
  });

  it('clasifica la reforma como mejorar', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'reforma_mejora' })).toBe('mejorar');
  });

  it('clasifica derrama como mantener sin forzar mejora', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'comunidad', subtipo: 'derrama' })).toBe('mantener');
  });

  it('la alarma es explotación aunque viva con los seguros', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'seguros_alarmas', subtipo: 'alarma' })).toBe('explotar');
  });

  it('deja desconocidos y sin familia como sin_clasificar', () => {
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble' })).toBe('sin_clasificar');
    expect(clasificarGastoVisualInmueble({ ambito: 'inmueble', familia: 'familia_no_existente' })).toBe('sin_clasificar');
  });
});

describe('compromisos y adaptador de gastos inmueble', () => {
  it('no acepta compromiso personal como compromiso de inmueble', () => {
    const personal = crearCompromisoBase({
      ambito: 'personal',
      inmuebleId: undefined,
      personalDataId: 1,
    });

    expect(esCompromisoRecurrenteDeInmueble(personal)).toBe(false);
    expect(clasificarCompromisoRecurrenteInmueble(personal)).toBe('sin_clasificar');
  });

  it('filtra compromisos por inmueble correctamente', () => {
    const c1 = crearCompromisoBase({ id: 1, inmuebleId: 10 });
    const c2 = crearCompromisoBase({ id: 2, inmuebleId: 99 });
    const filtrados = filtrarCompromisosRecurrentesDeInmueble([c1, c2], 10);

    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].inmuebleId).toBe(10);
  });

  it('no mezcla importes previstos y reales al unificar orígenes', () => {
    const compromiso = crearCompromisoBase({ id: 11, inmuebleId: 10, importe: importeFijo(120) });
    const gastoReal = crearGastoRealBase({ id: 21, inmuebleId: 10, familia: 'suministro', importe: 95 });
    const mejora = crearMejoraBase({ id: 31, inmuebleId: 10, familia: 'reforma_mejora', importe: 2200 });
    const mueble = crearMuebleBase({ id: 41, inmuebleId: 10, familia: 'mobiliario_enseres', importe: 400 });

    const lista = construirListaVisualGastosInmueble({
      inmuebleId: 10,
      compromisosRecurrentes: [compromiso],
      gastosReales: [gastoReal],
      mejoras: [mejora],
      mobiliario: [mueble],
    });

    const recurrente = lista.find((i) => i.origen === 'recurrente');
    const real = lista.find((i) => i.origen === 'real');
    const mejoraVisual = lista.find((i) => i.origen === 'mejora');
    const muebleVisual = lista.find((i) => i.origen === 'mobiliario');

    expect(recurrente?.importePrevisto).toBe(120);
    expect(recurrente?.importeReal).toBeUndefined();

    expect(real?.importeReal).toBe(95);
    expect(real?.importePrevisto).toBeUndefined();

    expect(mejoraVisual?.grupoVisual).toBe('mejorar');
    expect(muebleVisual?.grupoVisual).toBe('mobiliario');
  });
});
