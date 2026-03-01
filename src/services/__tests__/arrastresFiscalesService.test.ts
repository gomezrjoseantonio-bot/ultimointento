import 'fake-indexeddb/auto';

import { initDB } from '../db';
import { aplicarArrastresFIFO, crearArrastreFiscal, recalcularCaducidadArrastres } from '../arrastresFiscalesService';

describe('arrastresFiscalesService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('arrastresIRPF');
  });

  test('aplicarArrastresFIFO consume por orden de ejercicio origen', async () => {
    await crearArrastreFiscal({ ejercicioOrigen: 2021, tipo: 'perdidas_patrimoniales_ahorro', importe: 1000, ejercicioCaducidad: 2025 });
    await crearArrastreFiscal({ ejercicioOrigen: 2022, tipo: 'perdidas_patrimoniales_ahorro', importe: 1000, ejercicioCaducidad: 2026 });

    const result = await aplicarArrastresFIFO({ ejercicioDestino: 2024, tipo: 'perdidas_patrimoniales_ahorro', importeNecesario: 1500 });

    expect(result.aplicadoTotal).toBe(1500);
    expect(result.pendienteSinCubrir).toBe(0);
    expect(result.aplicaciones).toHaveLength(2);
    expect(result.aplicaciones[0]?.importe).toBe(1000);
    expect(result.aplicaciones[1]?.importe).toBe(500);
  });

  test('recalcularCaducidadArrastres marca como caducado cuando supera ejercicio', async () => {
    await crearArrastreFiscal({ ejercicioOrigen: 2019, tipo: 'otros', importe: 500, ejercicioCaducidad: 2021 });

    const updated = await recalcularCaducidadArrastres(2023);
    expect(updated).toBe(1);

    const db = await initDB();
    const all = await db.getAll('arrastresIRPF');
    expect((all[0] as any)?.estado).toBe('caducado');
  });
});
