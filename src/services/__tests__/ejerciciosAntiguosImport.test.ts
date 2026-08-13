import { initDB } from '../db';
import {
  importarDeclaracionAEAT,
  getOrCreateEjercicio,
  bootstrapEjercicios,
} from '../ejercicioResolverService';

describe('ejercicios antiguos · importar declaraciones anteriores a 2020 para reconstruir historia fiscal', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('ejerciciosFiscalesCoord');
  });

  it('un ejercicio antiguo IMPORTADO (con datos AEAT) sobrevive al bootstrap', async () => {
    // Declaración de 2012 (muy anterior al rango por defecto).
    await importarDeclaracionAEAT({ año: 2012, casillas: { '0435': 12000, '0500': 12000 } });

    const db = await initDB();
    expect(await db.get('ejerciciosFiscalesCoord', 2012)).toBeTruthy();

    // El bootstrap (que crea la ventana reciente y limpia basura) NO debe
    // borrar el año importado.
    await bootstrapEjercicios();

    const ej2012 = await db.get('ejerciciosFiscalesCoord', 2012);
    expect(ej2012).toBeTruthy();
    expect(ej2012?.aeat).toBeTruthy();
    // Un ejercicio de 2012 ya está prescrito.
    expect(ej2012?.estado).toBe('prescrito');
  });

  it('un ejercicio antiguo VACÍO (sin datos AEAT) se sigue limpiando · no es obligatorio traerlos', async () => {
    // Año antiguo sin importar (solo el registro base, sin `aeat`).
    await getOrCreateEjercicio(2010);
    const db = await initDB();
    expect(await db.get('ejerciciosFiscalesCoord', 2010)).toBeTruthy();

    await bootstrapEjercicios();

    // Sin datos reales, se limpia (no se fuerza mantener años antiguos vacíos).
    expect(await db.get('ejerciciosFiscalesCoord', 2010)).toBeFalsy();
  });
});
