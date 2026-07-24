// V82 · TAREA CC · Bloque C · los motores leen la base por ejercicio.
// Verifica que la vía canónica (calcularBaseAmortizacion → calculateAEATAmortization)
// sustituye la base calculada por la casilla 0130 del año, bloquea los años en
// conflicto y desbloquea tras aplicar la paralela. Datos reales de Carles Buigas.
import { initDB } from '../db';
import { baseAmortizableEjercicioService as svc } from '../baseAmortizableEjercicioService';
import { calcularBaseAmortizacion } from '../baseAmortizacionService';
import { calculateAEATAmortization } from '../aeatAmortizationService';

const CB = 2;
const now = '2026-07-24T00:00:00.000Z';

// Property con catastral que da baseCalculada = 10.000 (baseporVC), distinta de
// todas las 0130 → hace visible que la 0130 del año SUSTITUYE a la calculada.
const propCB = () =>
  ({
    id: CB,
    alias: 'Carles Buigas',
    purchaseDate: '2022-09-23',
    acquisitionCosts: { price: 0 },
    aeatAmortization: {
      acquisitionType: 'onerosa',
      onerosoAcquisition: { acquisitionAmount: 0, acquisitionExpenses: 0 },
      cadastralValue: 20000,
      constructionCadastralValue: 10000,
      constructionPercentage: 50,
      baseAmortizacion: 57989.36,
    },
  }) as any;

async function seed() {
  const db = await initDB();
  await db.clear('properties');
  await db.clear('gastosInmueble');
  await db.clear('baseAmortizableEjercicio');
  await db.clear('mejorasInmueble');
  await db.add('properties', propCB());
  // 2022 en conflicto (67.436), 2023/2024 xml (57.989).
  await db.add('baseAmortizableEjercicio', {
    inmuebleId: CB, ejercicio: 2022, base: 67436.79, origen: 'conflicto',
    baseDeclarada: 67436.79, baseCampoUnico: 57989.36, createdAt: now, updatedAt: now,
  } as any);
  await svc.upsertBaseEjercicio(CB, 2023, 57989.36, 'xml', { baseDeclarada: 57989.36 });
  await svc.upsertBaseEjercicio(CB, 2024, 57989.36, 'xml', { baseDeclarada: 57989.36 });
  return db;
}

describe('Bloque C · los motores leen la base por ejercicio', () => {
  beforeEach(seed);

  it('calcularBaseAmortizacion sustituye la calculada por la 0130 del año', async () => {
    const r2023 = await calcularBaseAmortizacion(CB, 2023);
    expect(r2023.base).toBe(57989.36);
    expect(r2023.origenEjercicio).toBe('xml');
    expect(r2023.bloqueado).toBeFalsy();
    expect(r2023.baseCalculada).toBe(10000); // la N2 calculada, distinta → hubo override

    const r2022 = await calcularBaseAmortizacion(CB, 2022);
    expect(r2022.base).toBe(67436.79);
    expect(r2022.origenEjercicio).toBe('conflicto');
    expect(r2022.bloqueado).toBe(true);
  });

  it('hereda del año anterior resuelto; sin filas NO sustituye por el campo único', async () => {
    const r2025 = await calcularBaseAmortizacion(CB, 2025); // hereda de 2024
    expect(r2025.base).toBe(57989.36);
    expect(r2025.heredada).toBe(true);

    // Inmueble sin filas por ejercicio → usa la base calculada (baseporVC 12.345),
    // NO el campo único 99.999 (el fallback campo_unico no sustituye la N2).
    const db = await initDB();
    await db.add('properties', {
      id: 9,
      aeatAmortization: {
        cadastralValue: 20000, constructionCadastralValue: 12345,
        constructionPercentage: 50, baseAmortizacion: 99999,
      },
    } as any);
    const r = await calcularBaseAmortizacion(9, 2024);
    expect(r.base).toBe(12345);
    expect(r.origenEjercicio).toBeUndefined();
  });

  it('calculateAEATAmortization propaga baseAmount por ejercicio y baseBloqueada', async () => {
    const c2023 = await calculateAEATAmortization(CB, 2023, 365);
    expect(c2023.baseAmount).toBe(57989.36);
    expect(c2023.baseBloqueada).toBeFalsy();

    const c2022 = await calculateAEATAmortization(CB, 2022, 365);
    expect(c2022.baseAmount).toBe(67436.79);
    expect(c2022.baseBloqueada).toBe(true); // la venta debe declararse bloqueada
  });

  it('prueba de cierre: tras la paralela, 2022 usa 57.989 y ya no bloquea', async () => {
    await svc.aplicarCorreccionParalela(CB, 2022, 57989.36, 'ACTA-2022-IRPF', '2024-01-15');

    const r2022 = await calcularBaseAmortizacion(CB, 2022);
    expect(r2022.base).toBe(57989.36);
    expect(r2022.origenEjercicio).toBe('paralela');
    expect(r2022.bloqueado).toBeFalsy();

    const c2022 = await calculateAEATAmortization(CB, 2022, 365);
    expect(c2022.baseAmount).toBe(57989.36);
    expect(c2022.baseBloqueada).toBeFalsy();
  });
});
