// V82 · TAREA CC · Bloque B · tests del modelo base-amortizable-por-ejercicio.
// Usa fake-indexeddb (setupTests) contra el store real creado por el upgrade V82.
import { initDB } from '../db';
import {
  baseAmortizableEjercicioService as svc,
  migrarBaseAmortizableEjercicio,
} from '../baseAmortizableEjercicioService';

const now = '2026-07-24T00:00:00.000Z';

// Property mínimo con campo único (aeatAmortization.baseAmortizacion).
const prop = (id: number, campoUnico?: number) =>
  ({
    id,
    alias: `P${id}`,
    aeatAmortization: campoUnico != null ? { baseAmortizacion: campoUnico } : {},
  }) as any;

// Gasto casilla 0130 (base amortizable declarada) de un ejercicio.
const gasto0130 = (inmuebleId: number, ejercicio: number, importe: number) =>
  ({
    inmuebleId,
    ejercicio,
    fecha: `${ejercicio}-12-31`,
    concepto: 'Base amortización',
    categoria: 'otro',
    casillaAEAT: '0130',
    importe,
    origen: 'xml_aeat',
    estado: 'declarado',
    createdAt: now,
    updatedAt: now,
  }) as any;

async function reset() {
  const db = await initDB();
  await db.clear('properties');
  await db.clear('gastosInmueble');
  await db.clear('baseAmortizableEjercicio');
  return db;
}

describe('baseAmortizableEjercicioService · V82 Bloque B', () => {
  beforeEach(async () => {
    await reset();
  });

  // Datos reales de Carles Buigas (id 2): campo único = 57.989,36 (corregido).
  // 0130 por año: 2022=67.436,79 (pre-paralela · el error), 2023/2024=57.989,36.
  const CB = 2;
  async function sembrarCarlesBuigas() {
    const db = await initDB();
    await db.add('properties', prop(CB, 57989.36));
    await db.add('gastosInmueble', gasto0130(CB, 2022, 67436.79));
    await db.add('gastosInmueble', gasto0130(CB, 2023, 57989.36));
    await db.add('gastosInmueble', gasto0130(CB, 2024, 57989.36));
    return migrarBaseAmortizableEjercicio(db);
  }

  it('siembra la base por año desde la casilla 0130 y marca el conflicto de 2022', async () => {
    const n = await sembrarCarlesBuigas();
    expect(n).toBe(3);

    const rows = await svc.getPorInmueble(CB);
    expect(rows.map((r) => r.ejercicio)).toEqual([2022, 2023, 2024]);

    const r2022 = rows.find((r) => r.ejercicio === 2022)!;
    expect(r2022.origen).toBe('conflicto');
    expect(r2022.base).toBe(67436.79);
    expect(r2022.baseCampoUnico).toBe(57989.36);

    const r2023 = rows.find((r) => r.ejercicio === 2023)!;
    expect(r2023.origen).toBe('xml');
    expect(r2023.base).toBe(57989.36);
  });

  it('un año en conflicto se declara BLOQUEADO; un año sin conflicto devuelve su base', async () => {
    await sembrarCarlesBuigas();
    const c2022 = await svc.getBaseParaCalculo(CB, 2022);
    expect(c2022.bloqueado).toBe(true);
    expect(c2022.origen).toBe('conflicto');

    const c2023 = await svc.getBaseParaCalculo(CB, 2023);
    expect(c2023.bloqueado).toBe(false);
    expect(c2023.base).toBe(57989.36);
    expect(c2023.origen).toBe('xml');
  });

  it('importar el XML de 2024 no cambia la base de 2022', async () => {
    await sembrarCarlesBuigas();
    const antes = await svc.getPorInmuebleYEjercicio(CB, 2022);

    // Re-import de 2024 (regla 1: escribe SOLO su año).
    await svc.upsertBaseEjercicio(CB, 2024, 57989.36, 'xml', { baseDeclarada: 57989.36 });

    const despues = await svc.getPorInmuebleYEjercicio(CB, 2022);
    expect(despues!.base).toBe(antes!.base);
    expect(despues!.base).toBe(67436.79);
    expect(despues!.origen).toBe('conflicto');
  });

  it('un inmueble sin corregir: todos los años coinciden → origen xml, sin conflicto', async () => {
    const db = await initDB();
    const T48 = 3; // Tenderina 48 · campo único 63.110,47
    await db.add('properties', prop(T48, 63110.47));
    await db.add('gastosInmueble', gasto0130(T48, 2022, 63110.47));
    await db.add('gastosInmueble', gasto0130(T48, 2023, 63110.47));
    const n = await migrarBaseAmortizableEjercicio(db);
    expect(n).toBe(2);

    const rows = await svc.getPorInmueble(T48);
    expect(rows.every((r) => r.origen === 'xml')).toBe(true);
    expect(rows.every((r) => r.base === 63110.47)).toBe(true);
  });

  it('herencia en lectura: un año sin fila hereda del anterior resuelto (sin inventar filas)', async () => {
    await sembrarCarlesBuigas(); // filas 2022(conflicto),2023,2024
    // 2025 no tiene fila propia → hereda de 2024 (no del conflicto de 2022).
    const c2025 = await svc.getBaseParaCalculo(CB, 2025);
    expect(c2025.heredada).toBe(true);
    expect(c2025.bloqueado).toBe(false);
    expect(c2025.base).toBe(57989.36);
    expect(c2025.ejercicioFuente).toBe(2024);

    // No se han creado filas nuevas por leer.
    const rows = await svc.getPorInmueble(CB);
    expect(rows.length).toBe(3);
  });

  it('fallback al campo único cuando no hay ninguna fila (heredada sin verificar)', async () => {
    const db = await initDB();
    const P = 9;
    await db.add('properties', prop(P, 30000));
    const c = await svc.getBaseParaCalculo(P, 2024, prop(P, 30000));
    expect(c.heredada).toBe(true);
    expect(c.bloqueado).toBe(false);
    expect(c.base).toBe(30000);
  });

  it('la paralela corrige solo su año, deja traza, y un re-import de XML no la pisa (regla 3)', async () => {
    await sembrarCarlesBuigas();
    const corr = await svc.aplicarCorreccionParalela(CB, 2022, 57989.36, 'ACTA-2022-IRPF', '2024-01-15');
    expect(corr.origen).toBe('paralela');
    expect(corr.base).toBe(57989.36);
    expect(corr.reemplazaA).toBe(67436.79);
    expect(corr.actaRef).toBe('ACTA-2022-IRPF');

    // 2022 ya no está bloqueado.
    const c2022 = await svc.getBaseParaCalculo(CB, 2022);
    expect(c2022.bloqueado).toBe(false);
    expect(c2022.base).toBe(57989.36);

    // Re-import del XML original de 2022 (67.436) NO pisa la corrección.
    const tras = await svc.upsertBaseEjercicio(CB, 2022, 67436.79, 'xml', { baseDeclarada: 67436.79 });
    expect(tras.origen).toBe('paralela');
    expect(tras.base).toBe(57989.36);
  });
});
