/**
 * Tests SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · huecos 2 y 3.
 *
 * Cubre:
 *   · getTimelineMultiAño(2020, 2026) → 7 entradas
 *   · getResumenGlobal() · counts y KPIs derivados
 */

import 'fake-indexeddb/auto';

import { initDB } from '../db';
import { calcularEstimacionEnCurso } from '../estimacionFiscalEnCursoService';
import { obtenerDeclaracionParaEjercicio } from '../declaracionResolverService';
import {
  getDeclaracion,
  getEjercicio,
  getTodosLosEjercicios,
} from '../ejercicioResolverService';

jest.mock('../estimacionFiscalEnCursoService', () => ({
  calcularEstimacionEnCurso: jest.fn(),
}));

jest.mock('../declaracionResolverService', () => ({
  obtenerDeclaracionParaEjercicio: jest.fn(),
}));

jest.mock('../ejercicioResolverService', () => ({
  getDeclaracion: jest.fn(),
  getEjercicio: jest.fn(),
  getTodosLosEjercicios: jest.fn(),
}));

import { getTimelineMultiAño, getResumenGlobal } from '../fiscalResolverService';

const mockedCalcularEstimacionEnCurso = calcularEstimacionEnCurso as jest.MockedFunction<typeof calcularEstimacionEnCurso>;
const mockedObtenerDeclaracionParaEjercicio = obtenerDeclaracionParaEjercicio as jest.MockedFunction<typeof obtenerDeclaracionParaEjercicio>;
const mockedGetDeclaracion = getDeclaracion as jest.MockedFunction<typeof getDeclaracion>;
const mockedGetEjercicio = getEjercicio as jest.MockedFunction<typeof getEjercicio>;
const mockedGetTodosLosEjercicios = getTodosLosEjercicios as jest.MockedFunction<typeof getTodosLosEjercicios>;

const TOLERANCIA = 0.01;

describe('fiscalResolverService · sub-tarea 1', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockedCalcularEstimacionEnCurso.mockResolvedValue({
      ejercicio: new Date().getFullYear(),
      fechaCalculo: new Date().toISOString(),
      ingresosAcumulados: { trabajo: 0, inmuebles: 0, actividades: 0, capitalMobiliario: 0 },
      ingresosProyectados: { trabajo: 0, inmuebles: 0, actividades: 0, capitalMobiliario: 0 },
      resultadoEstimado: {
        baseImponibleGeneral: 0,
        cuotaLiquida: 0,
        retencionesEstimadas: 0,
        resultadoEstimado: 1234.56,
        tipoMedioEstimado: 0,
      },
      cobertura: { mesesConDatos: 5, inmueblesConGastos: 1, retencionesConfirmadas: false },
      declaracionCompleta: {} as any,
    });

    mockedObtenerDeclaracionParaEjercicio.mockRejectedValue(new Error('no-op'));
    mockedGetDeclaracion.mockResolvedValue({ resumen: null, snapshot: null } as any);
    mockedGetEjercicio.mockResolvedValue(null);
    mockedGetTodosLosEjercicios.mockResolvedValue([]);

    const db = await initDB();
    try { await db.clear('deudasFiscales'); } catch { /* */ }
    try { await db.clear('aeatCarryForwards'); } catch { /* */ }
    try { await db.clear('perdidasPatrimonialesAhorro'); } catch { /* */ }
  });

  describe('getTimelineMultiAño', () => {
    it('devuelve 7 entradas para el rango 2020-2026', async () => {
      const timeline = await getTimelineMultiAño(2020, 2026);
      expect(timeline.length).toBe(7);
    });

    it('cada entrada incluye año · estado · obligaciones · prescribe', async () => {
      const timeline = await getTimelineMultiAño(2020, 2026);
      for (const t of timeline) {
        expect(typeof t.año).toBe('number');
        expect(['en_curso', 'pendiente', 'declarado']).toContain(t.estado);
        expect(Array.isArray(t.obligaciones)).toBe(true);
        // prescribe puede ser null para años > 4 atrás
        expect(t.prescribe === null || typeof t.prescribe === 'string').toBe(true);
      }
    });

    it('cada entrada incluye al menos la obligación Modelo 100 anual', async () => {
      const timeline = await getTimelineMultiAño(2024, 2024);
      const t = timeline[0];
      const m100 = t.obligaciones.find((o) => o.modelo === '100' && o.periodo === 'anual');
      expect(m100).toBeDefined();
      expect(m100!.fechaLimite).toBe('2025-06-30');
    });

    it('rango invertido (min > max) devuelve []', async () => {
      const timeline = await getTimelineMultiAño(2026, 2020);
      expect(timeline).toEqual([]);
    });

    it('ordena por año descendente', async () => {
      const timeline = await getTimelineMultiAño(2020, 2026);
      for (let i = 0; i < timeline.length - 1; i++) {
        expect(timeline[i].año).toBeGreaterThan(timeline[i + 1].año);
      }
    });
  });

  describe('getResumenGlobal', () => {
    it('totalEjercicios = 7 (añoActual − 6 .. añoActual)', async () => {
      const r = await getResumenGlobal();
      expect(r.totalEjercicios).toBe(7);
    });

    it('counts por estado suman = totalEjercicios', async () => {
      const r = await getResumenGlobal();
      expect(r.enCurso + r.pendientes + r.declarados + r.prescritos).toBe(r.totalEjercicios);
    });

    it('distribución coherente con la ventana de 7 años (enCurso=1 · pendientes ≤ 1 · declarados+prescritos = 5 o 6)', async () => {
      const r = await getResumenGlobal();
      const hoy = new Date();
      const finCampaña = new Date(Date.UTC(hoy.getUTCFullYear(), 5, 30));
      const esperaPendiente = hoy <= finCampaña;
      // Año actual siempre en_curso
      expect(r.enCurso).toBe(1);
      // Año anterior · pendiente solo durante la campaña (hasta 30/06)
      expect(r.pendientes).toBe(esperaPendiente ? 1 : 0);
      // Resto · 5 o 6 ejercicios reparten entre declarados / prescritos según
      // si la fecha de prescripción real (30/06 año + 5) ha pasado o no.
      const restoEsperado = 7 - r.enCurso - r.pendientes;
      expect(r.declarados + r.prescritos).toBe(restoEsperado);
      // Garantías de tipo · ningún count negativo
      expect(r.declarados).toBeGreaterThanOrEqual(0);
      expect(r.prescritos).toBeGreaterThanOrEqual(0);
    });

    it('proyeccionAñoActual viene de estimacionFiscalEnCursoService', async () => {
      const r = await getResumenGlobal();
      expect(r.proyeccionAñoActual).not.toBeNull();
      expect(Math.abs((r.proyeccionAñoActual ?? 0) - 1234.56)).toBeLessThanOrEqual(TOLERANCIA);
    });

    it('deudaAbierta = 0 sin seed (deudasFiscales vacío)', async () => {
      const r = await getResumenGlobal();
      expect(Math.abs(r.deudaAbierta - 0)).toBeLessThanOrEqual(TOLERANCIA);
    });

    it('arrastresVivos = 0 con stores vacíos', async () => {
      const r = await getResumenGlobal();
      expect(Math.abs(r.arrastresVivos - 0)).toBeLessThanOrEqual(TOLERANCIA);
    });

    it('arrastresVivos suma carryforwards vivos + perdidas pendientes', async () => {
      const db = await initDB();
      const añoActual = new Date().getFullYear();
      // Carryforward vivo
      await db.add('aeatCarryForwards', {
        propertyId: 1,
        taxYear: añoActual - 2,
        totalIncome: 0,
        financingAndRepair: 0,
        limitApplied: 0,
        excessAmount: 1344.99,
        expirationYear: añoActual + 2,
        remainingAmount: 1344.99,
        carryForwardType: 'excess_mixed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      // Pérdida pendiente
      await db.add('perdidasPatrimonialesAhorro', {
        ejercicioOrigen: añoActual - 1,
        importeOriginal: 27764.23,
        importePendiente: 27764.23,
        importeAplicado: 0,
        ejercicioCaducidad: añoActual + 3,
        estado: 'activa',
        origen: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const r = await getResumenGlobal();
      const esperado = 1344.99 + 27764.23;
      expect(Math.abs(r.arrastresVivos - esperado)).toBeLessThanOrEqual(TOLERANCIA);
    });
  });
});
