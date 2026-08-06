// El futuro se recalcula, el pasado confirmado se queda.
//
// Es el modelo que ya cumplía tesorería y que fiscalidad no: escribía la línea
// de cada mes UNA vez y no volvía a mirarla (`if (yaExiste) continue`), así que
// subir la cuota no se reflejaba en 2030 y el presupuesto a 20 años enseñaba la
// cifra del día en que se generó. Y el importe salía de `rule.importeEstimado`,
// plano — `OpexRule` ni tiene campo `variacion`, así que el IPC se perdía al
// traducir el compromiso a regla.

import { generarOperacionesDesdeRecurrentes } from '../operacionFiscalService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import type { GastoInmueble } from '../db';

// El prefijo `mock` no es estilo: jest sólo deja que el factory de
// `jest.mock()` toque variables que lo lleven.
let mockCompromisos: CompromisoRecurrente[] = [];
let mockGastos: GastoInmueble[] = [];

jest.mock('../db', () => ({
  initDB: async () => ({
    getAllFromIndex: async () => mockCompromisos,
  }),
}));

jest.mock('../gastosInmuebleService', () => ({
  gastosInmuebleService: {
    getByInmuebleYEjercicio: async () => mockGastos,
    // Mismo upsert por (origen, origenId) que el servicio real.
    add: async (g: GastoInmueble) => {
      const i = mockGastos.findIndex((x) => x.origen === g.origen && x.origenId === g.origenId);
      if (i >= 0) mockGastos[i] = { ...mockGastos[i], ...g };
      else mockGastos.push({ ...g, id: mockGastos.length + 1 } as GastoInmueble);
      return 1;
    },
  },
}));

const comunidad = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 27,
    ambito: 'inmueble',
    inmuebleId: 2,
    alias: 'Comunidad',
    tipo: 'comunidad',
    proveedor: { nombre: 'Finca' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 100 },
    variacion: { tipo: 'sinVariacion' },
    cuentaCargo: 3,
    categoria: 'inmueble.comunidad',
    fechaInicio: '2026-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente;

beforeEach(() => {
  mockCompromisos = [];
  mockGastos = [];
});

describe('el futuro se recalcula', () => {
  it('cambiar el importe del gasto actualiza las líneas previstas', async () => {
    mockCompromisos = [comunidad()];
    await generarOperacionesDesdeRecurrentes(2, 2026);
    expect(mockGastos).toHaveLength(12);
    expect(mockGastos[0].importe).toBe(100);

    // Sube la comunidad · antes esto NO se reflejaba nunca.
    mockCompromisos = [comunidad({ importe: { modo: 'fijo', importe: 120 } as CompromisoRecurrente['importe'] })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(mockGastos).toHaveLength(12);                    // no duplica
    expect(mockGastos.every((g) => g.importe === 120)).toBe(true);
  });

  it('es idempotente · repetir sin cambios no reescribe nada', async () => {
    mockCompromisos = [comunidad()];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    const segunda = await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(segunda).toBe(0);          // nada que escribir
    expect(mockGastos).toHaveLength(12);
  });
});

describe('el pasado confirmado se queda', () => {
  it('una línea confirmada NO se reescribe aunque cambie el gasto', async () => {
    mockCompromisos = [comunidad()];
    await generarOperacionesDesdeRecurrentes(2, 2026);
    mockGastos[0] = { ...mockGastos[0], estado: 'confirmado', importe: 97.5 };

    mockCompromisos = [comunidad({ importe: { modo: 'fijo', importe: 120 } as CompromisoRecurrente['importe'] })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(mockGastos[0].importe).toBe(97.5);              // lo pagado manda
    expect(mockGastos[0].estado).toBe('confirmado');
    expect(mockGastos[1].importe).toBe(120);               // el resto sí se actualiza
  });

  it('una línea casada con un movimiento del banco tampoco', async () => {
    mockCompromisos = [comunidad()];
    await generarOperacionesDesdeRecurrentes(2, 2026);
    mockGastos[0] = { ...mockGastos[0], movimientoId: 'mov-1', importe: 101.2 };

    mockCompromisos = [comunidad({ importe: { modo: 'fijo', importe: 120 } as CompromisoRecurrente['importe'] })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(mockGastos[0].importe).toBe(101.2);
  });
});

describe('el IPC llega a las líneas fiscales', () => {
  it('un año posterior sale con la subida aplicada', async () => {
    // `aplicarVariacion` sube en el mes de revisión de cada aniversario.
    mockCompromisos = [
      comunidad({
        variacion: { tipo: 'ipcAnual', mesRevision: 1, ultimoIpcAplicado: 10 } as CompromisoRecurrente['variacion'],
      }),
    ];

    await generarOperacionesDesdeRecurrentes(2, 2028);

    // Sea cual sea el número exacto, lo que NO puede pasar es que 2028 cueste
    // lo mismo que el importe base: eso significaría que el IPC se perdió por
    // el camino, que es justo lo que hacía la versión vieja.
    expect(mockGastos.length).toBeGreaterThan(0);
    expect(mockGastos.every((g) => g.importe > 100)).toBe(true);
  });

  it('sin variación el importe se queda como está', async () => {
    mockCompromisos = [comunidad()];
    await generarOperacionesDesdeRecurrentes(2, 2028);

    expect(mockGastos.every((g) => g.importe === 100)).toBe(true);
  });
});

describe('la ventana respeta el alta y la baja', () => {
  it('un gasto que empieza en junio no tiene líneas de enero', async () => {
    mockCompromisos = [comunidad({ fechaInicio: '2026-06-01' })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(mockGastos).toHaveLength(7);                     // junio → diciembre
    expect(mockGastos[0].fecha).toBe('2026-06-01');
  });

  it('un gasto dado de baja en marzo no tiene líneas de abril', async () => {
    mockCompromisos = [comunidad({ fechaFin: '2026-03-31' })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    expect(mockGastos).toHaveLength(3);
    expect(mockGastos[mockGastos.length - 1].fecha).toBe('2026-03-01');
  });

  it('un ejercicio anterior al alta no genera nada', async () => {
    mockCompromisos = [comunidad({ fechaInicio: '2026-01-01' })];
    await generarOperacionesDesdeRecurrentes(2, 2025);

    expect(mockGastos).toHaveLength(0);
  });
});

describe('las fechas que genera existen', () => {
  it('un cargo el día 31 cae en el último día de cada mes', async () => {
    mockCompromisos = [comunidad({ patron: { tipo: 'mensualDiaFijo', dia: 31 } as CompromisoRecurrente['patron'] })];
    await generarOperacionesDesdeRecurrentes(2, 2026);

    const febrero = mockGastos.find((g) => g.fecha.startsWith('2026-02'));
    expect(febrero?.fecha).toBe('2026-02-28');

    // Y ninguna rueda al mes siguiente al leerla con Date.
    for (const g of mockGastos) {
      const d = new Date(g.fecha);
      expect(d.getMonth() + 1).toBe(Number(g.fecha.slice(5, 7)));
    }
  });
});
