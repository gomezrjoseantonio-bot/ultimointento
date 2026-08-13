import { initDB } from '../db';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { getEjercicio } from '../ejercicioResolverService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

const decl = (resultado: number, previoIngresos?: number): DeclaracionCompleta =>
  ({
    meta: {
      ejercicio: 2024,
      modelo: '100',
      fuenteImportacion: 'xml',
      numeroJustificante: '',
      esRectificativa: previoIngresos != null,
      esComplementaria: false,
      ...(previoIngresos != null ? { declaracionPrevia: { ingresosPrevios: previoIngresos } } : {}),
      tipoDeclaracion: 'I',
    },
    declarante: { nombreCompleto: 'Demo', nif: '00000000T' },
    inmuebles: [],
    integracion: {
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      baseLiquidableAhorro: 0,
    },
    resultado: {
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      resultadoDeclaracion: resultado,
    },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] },
    casillas: { '0695': resultado },
    camposExtra: {},
  }) as any;

describe('versiones rectificativas · el escritor acumula historial y deja activa la última', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('ejerciciosFiscalesCoord');
  });

  it('importar original → rect1 → rect2 deja 3 versiones y la rect2 activa', async () => {
    await distribuirDeclaracion(decl(2077.61), OPCIONES_DEFAULT); // original
    await distribuirDeclaracion(decl(1859.88, 2077.61), OPCIONES_DEFAULT); // rect1
    await distribuirDeclaracion(decl(2899.75, 1859.88), OPCIONES_DEFAULT); // rect2

    const ej = await getEjercicio(2024);
    expect(ej?.aeat?.versiones).toHaveLength(3);
    // La activa (y el snapshot mirror) es la rect2.
    const activa = ej?.aeat?.versiones?.find((v) => v.id === ej.aeat?.versionActivaId);
    expect(activa?.resultado).toBeCloseTo(2899.75, 2);
    expect(ej?.aeat?.declaracionCompleta?.resultado.resultadoDeclaracion).toBeCloseTo(2899.75, 2);
  });

  it('reimportar la misma versión no duplica', async () => {
    await distribuirDeclaracion(decl(2077.61), OPCIONES_DEFAULT);
    await distribuirDeclaracion(decl(2077.61), OPCIONES_DEFAULT); // misma → reemplaza
    const ej = await getEjercicio(2024);
    expect(ej?.aeat?.versiones).toHaveLength(1);
  });
});
