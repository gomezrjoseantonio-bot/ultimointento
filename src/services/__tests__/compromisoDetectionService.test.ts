// TAREA 9.1 · Tests for compromisoDetectionService
//
// Cubre los 10 tests obligatorios del §2.4 de la spec.
//
// Estrategia:
//   - jest.mock('../db') · stub `initDB` con stores en memoria
//   - generación de movements con fechas relativas a `new Date()` para
//     que entren en la ventana temporal por defecto (18 meses)
//   - cada test construye su propio universo y aserta la salida del
//     `DetectionReport`

import { detectCompromisos } from '../compromisoDetectionService';
import { initDB } from '../db';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

interface FakeStores {
  movements?: any[];
  viviendaHabitual?: any[];
  properties?: any[];
  compromisosRecurrentes?: any[];
  personalData?: any[];
}

function buildDb(stores: FakeStores) {
  return {
    getAll: jest.fn(async (storeName: keyof FakeStores) => stores[storeName] ?? []),
    get: jest.fn(async (storeName: keyof FakeStores, key: number) =>
      (stores[storeName] as any[] | undefined)?.find((row) => row.id === key),
    ),
  };
}

// Genera fechas mensuales hacia atrás desde una fecha de referencia.
// `monthsAgoStart=0` significa "este mes". Día fijo del mes.
function monthlyDates(
  count: number,
  dia: number,
  monthsAgoStart: number = 0,
): string[] {
  const out: string[] = [];
  const ref = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - (monthsAgoStart + i), dia);
    out.push(d.toISOString().slice(0, 10));
  }
  return out.reverse(); // ordenadas ascendente
}

let movementIdSeq = 1;

function mkMovement(
  fields: Partial<{
    id: number;
    accountId: number;
    date: string;
    amount: number;
    description: string;
    unifiedStatus: string;
  }>,
): any {
  return {
    id: fields.id ?? movementIdSeq++,
    accountId: fields.accountId ?? 1,
    date: fields.date ?? '2026-01-15',
    amount: fields.amount ?? -50,
    description: fields.description ?? 'GENERIC PAYMENT',
    unifiedStatus: fields.unifiedStatus ?? 'no_planificado',
    source: 'import',
    status: 'pending',
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Confirmado',
    category: { tipo: 'otros' },
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  movementIdSeq = 1;
});

describe('compromisoDetectionService.detectCompromisos', () => {
  // ── Test 1 ────────────────────────────────────────────────────────────
  it('1. 12 movements de IBERDROLA mensuales · 1 candidato mensualDiaFijo importe fijo confidence ≥80', async () => {
    const dates = monthlyDates(12, 5, 0);
    const stores: FakeStores = {
      movements: dates.map((date) =>
        mkMovement({
          accountId: 10,
          date,
          amount: -65.5,
          description: 'IBERDROLA CLIENTES SAU',
        }),
      ),
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(1);
    const c = report.candidatos[0];
    expect(c.patronInferido.tipo).toBe('mensualDiaFijo');
    expect(c.importeInferido.modo).toBe('fijo');
    expect(c.confidence).toBeGreaterThanOrEqual(80);
    expect(c.propuesta.tipo).toBe('suministro');
    expect(c.propuesta.subtipo).toBe('luz');
    expect(c.propuesta.ambito).toBe('personal');
    expect(c.propuesta.personalDataId).toBe(1);
    expect(report.estadisticas.candidatosPropuestos).toBe(1);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────
  it('2. 4 movements NETFLIX con subida 12.99 → 14.99 · variacion=manual · warning subida', async () => {
    const dates = monthlyDates(4, 10, 0);
    const importes = [12.99, 12.99, 14.99, 14.99]; // ordenado por fecha ascendente
    const movements = dates.map((date, idx) =>
      mkMovement({
        accountId: 10,
        date,
        amount: -importes[idx],
        description: 'NETFLIX INTERNATIONAL',
      }),
    );

    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(1);
    const c = report.candidatos[0];
    expect(c.variacionInferida.tipo).toBe('manual');
    expect(c.importeInferido.modo).toBe('variable');
    expect(c.propuesta.tipo).toBe('suscripcion');
    expect(c.avisos.some((a) => /sube/.test(a))).toBe(true);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────
  it('3. 12 movements pero solo 2 en ventana de 6 meses · descarta por minOcurrencias', async () => {
    // 2 movements en últimos 6 meses · 10 fuera de ventana
    const recientes = monthlyDates(2, 5, 0);
    const antiguos = monthlyDates(10, 5, 12); // hace 12-21 meses
    const movements = [
      ...recientes.map((date) =>
        mkMovement({
          accountId: 10,
          date,
          amount: -30,
          description: 'GIMNASIO BASIC FIT',
        }),
      ),
      ...antiguos.map((date) =>
        mkMovement({
          accountId: 10,
          date,
          amount: -30,
          description: 'GIMNASIO BASIC FIT',
        }),
      ),
    ];
    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos({ maxAntiguedadMeses: 6 });

    expect(report.candidatos).toHaveLength(0);
    expect(report.estadisticas.clustersTotales).toBe(0);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────
  it('4. 6 movements MERCADONA con día e importe muy variables · descarta por importe sin patrón', async () => {
    // Generamos fechas con día variable (no patrón mensual)
    const ref = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1 + ((i * 7) % 25));
      dates.push(d.toISOString().slice(0, 10));
    }
    const importes = [45, 120, 32, 220, 80, 15]; // CV alto, sin patrón mensual
    const movements = dates.map((date, idx) =>
      mkMovement({
        accountId: 10,
        date,
        amount: -importes[idx],
        description: 'MERCADONA SA SUPERMERCADO',
      }),
    );
    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(0);
    // No suma a candidatosFiltrados · se descartó en fase 3 o 4 (warning)
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────
  it('5. 4 movements COMUNIDAD VECINOS con vivienda habitual activa · descartado · porViviendaHabitual=1', async () => {
    const dates = monthlyDates(4, 5, 0);
    const movements = dates.map((date) =>
      mkMovement({
        accountId: 99, // misma cuenta que la vivienda habitual
        date,
        amount: -85,
        description: 'COMUNIDAD VECINOS C MAYOR',
      }),
    );
    const stores: FakeStores = {
      movements,
      viviendaHabitual: [
        {
          id: 1,
          personalDataId: 1,
          activa: true,
          data: {
            tipo: 'propietarioSinHipoteca',
            cuentaCargo: 99,
            direccion: { calle: 'Mayor', municipio: 'Madrid', cp: '28001' },
            catastro: { referenciaCatastral: 'REF1', valorCatastral: 100000, superficie: 80, porcentajeTitularidad: 100 },
            adquisicion: { fecha: '2010-01-01', precio: 200000, gastosAdquisicion: 10000, mejorasAcumuladas: [] },
            comunidad: { importe: 85, diaCargo: 5 },
            ibi: { importeAnual: 300, mesesPago: [6], diaPago: 5 },
            seguros: {},
          },
          vigenciaDesde: '2010-01-01',
          createdAt: '2010-01-01T00:00:00.000Z',
          updatedAt: '2010-01-01T00:00:00.000Z',
        },
      ],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(0);
    expect(report.estadisticas.candidatosFiltrados.porViviendaHabitual).toBe(1);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────
  it('6. 4 movements IBI con alias inmueble inversión · descartado · porInmuebleInversion=1', async () => {
    // Patrón anual · 4 ocurrencias en años distintos para que matchee anualMesesConcretos
    // Pero dentro del rango de 18 meses solo nos vale cluster de 3+
    // Mejor · 4 movements bimestrales con descripcion que matcheee inmueble por alias
    const dates = monthlyDates(4, 10, 0); // mensuales
    const movements = dates.map((date) =>
      mkMovement({
        accountId: 10,
        date,
        amount: -120,
        description: 'GASTO PISOLEGANES NORTE',
      }),
    );
    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [
        {
          id: 1,
          alias: 'PisoLeganes Norte',
          address: 'Calle Real',
          postalCode: '28910',
          province: 'Madrid',
          municipality: 'Leganés',
          ccaa: 'Madrid',
          purchaseDate: '2018-01-01',
          squareMeters: 70,
          bedrooms: 2,
          transmissionRegime: 'usada',
          state: 'activo',
          acquisitionCosts: { price: 150000 },
          documents: [],
        },
      ],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(0);
    expect(report.estadisticas.candidatosFiltrados.porInmuebleInversion).toBe(1);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────
  it('7. 6 movements GIMNASIO con compromiso existente activo · descartado · porCompromisoExistente=1', async () => {
    const dates = monthlyDates(6, 5, 0);
    const movements = dates.map((date) =>
      mkMovement({
        accountId: 10,
        date,
        amount: -39.95,
        description: 'GIMNASIO BASIC FIT',
      }),
    );
    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [
        {
          id: 1,
          ambito: 'personal',
          personalDataId: 1,
          alias: 'Gimnasio',
          tipo: 'cuota',
          proveedor: { nombre: 'BASIC' },
          patron: { tipo: 'mensualDiaFijo', dia: 5 },
          importe: { modo: 'fijo', importe: 39.95 },
          cuentaCargo: 10,
          conceptoBancario: 'GIMNASIO BASIC FIT MES',
          metodoPago: 'domiciliacion',
          categoria: 'personal',
          bolsaPresupuesto: 'deseos',
          responsable: 'titular',
          fechaInicio: '2024-01-05',
          estado: 'activo',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(0);
    expect(report.estadisticas.candidatosFiltrados.porCompromisoExistente).toBe(1);
  });

  // ── Test 8 ────────────────────────────────────────────────────────────
  it('8. 3 movements sin proveedor reconocido + variación moderada · score < 60 · porScoreInsuficiente=1', async () => {
    // 3 ocurrencias (mínimo) · sin extra · variación moderada (variable, no fijo) ·
    // sin proveedor reconocido · si la temporal pasa fase 3 con desviación
    // entre 2 y 3 días, no suma el +15 de patrón estable. Score = 50 < 60.
    // Intervalos esperados: 27 y 33 días · mediana 30 · desviación 3.
    const ref = new Date();
    const d3 = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const d2 = new Date(d3);
    d2.setDate(d3.getDate() - 33);
    const d1 = new Date(d2);
    d1.setDate(d2.getDate() - 27);
    const dates = [d1, d2, d3].map((d) => d.toISOString().slice(0, 10));
    const importes = [80, 84, 82]; // cv ~2% · variable (no fijo)
    const movements = dates.map((date, idx) =>
      mkMovement({
        accountId: 10,
        date,
        amount: -importes[idx],
        description: 'PROVEEDOR DESCONOCIDO ABC',
      }),
    );

    const stores: FakeStores = {
      movements,
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toHaveLength(0);
    expect(report.estadisticas.candidatosFiltrados.porScoreInsuficiente).toBe(1);
  });

  // ── Test 9 ────────────────────────────────────────────────────────────
  it('9. idempotente · 2 ejecuciones devuelven mismos candidatos (mismos ids estables)', async () => {
    const dates = monthlyDates(6, 12, 0);
    const stores: FakeStores = {
      movements: dates.map((date) =>
        mkMovement({
          accountId: 10,
          date,
          amount: -45,
          description: 'SPOTIFY ABO',
        }),
      ),
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [{ id: 1 }],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const r1 = await detectCompromisos();
    const r2 = await detectCompromisos();

    expect(r1.candidatos.map((c) => c.id)).toEqual(r2.candidatos.map((c) => c.id));
    expect(r1.candidatos.length).toBe(r2.candidatos.length);
    expect(r1.estadisticas.candidatosPropuestos).toBe(r2.estadisticas.candidatosPropuestos);
  });

  // ── Test 10 ───────────────────────────────────────────────────────────
  it('10. 0 movements · report vacío · sin error', async () => {
    const stores: FakeStores = {
      movements: [],
      viviendaHabitual: [],
      properties: [],
      compromisosRecurrentes: [],
      personalData: [],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const report = await detectCompromisos();

    expect(report.candidatos).toEqual([]);
    expect(report.estadisticas.movementsAnalizados).toBe(0);
    expect(report.estadisticas.movementsAgrupados).toBe(0);
    expect(report.estadisticas.clustersTotales).toBe(0);
    expect(report.warnings).toEqual([]);
  });
});
