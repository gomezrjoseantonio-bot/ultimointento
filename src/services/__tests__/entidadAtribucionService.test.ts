import { initDB } from '../db';
import {
  actualizarEjercicio,
  crearEntidad,
  getEntidades,
  getRendimientosAtribuidosEjercicio,
} from '../entidadAtribucionService';

describe('entidadAtribucionService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('entidadesAtribucion');
  });

  it('crea entidades y agrupa rendimientos por ejercicio/tipo', async () => {
    const entidad = await crearEntidad({
      nif: 'E25904640',
      nombre: 'Residencial Smart Santa Catalina CB',
      tipoEntidad: 'CB',
      porcentajeParticipacion: 10,
      tipoRenta: 'capital_inmobiliario',
      ejercicios: [
        {
          ejercicio: 2025,
          rendimientosAtribuidos: 1682.8,
          retencionesAtribuidas: 136.05,
        },
      ],
    });

    await actualizarEjercicio(entidad.id!, {
      ejercicio: 2024,
      rendimientosAtribuidos: 1500,
      retencionesAtribuidas: 120,
    });

    const entidades = await getEntidades();
    const agrupado = await getRendimientosAtribuidosEjercicio(2025);

    expect(entidades).toHaveLength(1);
    expect(entidades[0].ejercicios.map((ej) => ej.ejercicio)).toEqual([2025, 2024]);
    expect(agrupado.capitalInmobiliario.total).toBe(1682.8);
    expect(agrupado.capitalInmobiliario.retenciones).toBe(136.05);
    expect(agrupado.capitalInmobiliario.detalle[0].entidad).toContain('Residencial Smart Santa Catalina CB');
  });
});
