import { initDB } from '../db';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { mejorasInmuebleService } from '../mejorasInmuebleService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

/**
 * La mejora es un hecho que se arrastra toda la vida del inmueble: la reforma de
 * un año origen aparece en años posteriores como "mejoras anteriores". ATLAS debe
 * reconciliar esa información CONSIGO MISMA — contar cada reforma UNA sola vez en
 * la base de la plusvalía—, sea cual sea el orden de importación.
 */
const REF = '9999999AA9999A0001BC';

const decl = (
  ejercicio: number,
  opts: { mejorasEjercicio?: number; mejorasAnteriores?: number } = {},
): DeclaracionCompleta =>
  ({
    meta: {
      ejercicio,
      modelo: '100',
      fuenteImportacion: 'xml',
      numeroJustificante: '',
      esRectificativa: false,
      esComplementaria: false,
      tipoDeclaracion: 'I',
    },
    declarante: { nombreCompleto: 'Demo', nif: '00000000T' },
    inmuebles: [
      {
        refCatastral: REF,
        direccion: 'CL DEMO 1 OVIEDO',
        porcentajePropiedad: 100,
        esUrbana: true,
        mejorasEjercicio: opts.mejorasEjercicio
          ? [{ importe: opts.mejorasEjercicio, fecha: `${ejercicio}-06-01` }]
          : [],
        mejorasAnteriores: opts.mejorasAnteriores ?? 0,
        usos: [],
        arrendamientos: [],
        gastos: {
          interesesFinanciacion: 0, reparacionConservacion: 0, gastosAplicados: 0,
          comunidad: 0, suministros: 0, seguros: 0, ibiTasas: 0, serviciosTerceros: 0,
          amortizacionMobiliario: 0,
        },
        gastosPendientesPrevios: 0, gastosPendientesPreviosAplicados: 0,
        rendimientoNeto: 0, reduccionVivienda: 0, rendimientoNetoReducido: 0,
        gastosPendientesGenerados: 0, proveedores: [],
      },
    ],
    integracion: {
      baseImponibleGeneral: 0, baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0, baseLiquidableAhorro: 0,
    },
    resultado: {
      cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: 0,
      cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: 0, resultadoDeclaracion: 0,
    },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] },
    casillas: {},
    camposExtra: {},
  }) as any;

async function capexAcumulado(): Promise<number> {
  const db = await initDB();
  const props = await db.getAll('properties');
  const p = props.find(
    (x: any) => (x.cadastralReference || '').replace(/[\s.-]/g, '').toUpperCase() === REF,
  );
  if (!p?.id) return -1;
  const mejoras = await mejorasInmuebleService.getPorInmueble(p.id);
  return mejoras.filter((m) => m.tipo !== 'reparacion').reduce((s, m) => s + m.importe, 0);
}

describe('mejoras · reconciliación self-nourishing entre años', () => {
  beforeEach(async () => {
    const db = await initDB();
    await db.clear('properties');
    await db.clear('mejorasInmueble');
    await db.clear('ejerciciosFiscalesCoord');
  });

  it('orden origen→posterior: la reforma de 2022 no se duplica al ver 2024', async () => {
    await distribuirDeclaracion(decl(2022, { mejorasEjercicio: 3545 }), OPCIONES_DEFAULT);
    await distribuirDeclaracion(decl(2024, { mejorasAnteriores: 3545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(3545, 2);
  });

  it('orden posterior→origen: 2024 crea marcador y 2022 lo disuelve (sin doble conteo)', async () => {
    // 2024 primero: sabe que hay 3.545 € de reformas anteriores, pero no el origen.
    await distribuirDeclaracion(decl(2024, { mejorasAnteriores: 3545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(3545, 2); // marcador pendiente
    // 2022 después: aparece el origen real → el marcador se disuelve.
    await distribuirDeclaracion(decl(2022, { mejorasEjercicio: 3545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(3545, 2); // sigue siendo 3.545, no 7.090
  });

  it('identificación parcial: dos reformas, se importa una y queda pendiente la otra', async () => {
    // 2024 reporta 5.545 € de reformas anteriores (2022=3.545 + 2023=2.000).
    await distribuirDeclaracion(decl(2024, { mejorasAnteriores: 5545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(5545, 2);
    // Importo 2022 (3.545): quedan 2.000 pendientes.
    await distribuirDeclaracion(decl(2022, { mejorasEjercicio: 3545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(5545, 2);
    // Importo 2023 (2.000, con 3.545 anteriores): todo identificado, sin doble conteo.
    await distribuirDeclaracion(
      decl(2023, { mejorasEjercicio: 2000, mejorasAnteriores: 3545 }),
      OPCIONES_DEFAULT,
    );
    expect(await capexAcumulado()).toBeCloseTo(5545, 2);
  });

  it('reimportar el mismo año es idempotente', async () => {
    await distribuirDeclaracion(decl(2022, { mejorasEjercicio: 3545 }), OPCIONES_DEFAULT);
    await distribuirDeclaracion(decl(2022, { mejorasEjercicio: 3545 }), OPCIONES_DEFAULT);
    expect(await capexAcumulado()).toBeCloseTo(3545, 2);
  });
});
