/**
 * Arrastre 4 años (intereses+reparación, art. 23.1 LIRPF) · cableado del import
 * al store canónico `aeatCarryForwards`.
 *
 * El motor (FIFO, caducidad +4, consumo) ya existía; aquí se comprueba que el
 * IMPORT lo alimenta con lo que declara la AEAT: pendiente NUEVO generado
 * (C_INTGRCEF / 0108) y pendiente previo APLICADO (IMP4GCPEA / 0103), de forma
 * idempotente y order-independiente.
 *
 * Caso real Tenderina 64: 2024 genera 28.239,24 € pendiente; 2025 aplica
 * 18.412,30 € → quedan 9.826,94 € (caducan en 2028).
 */
import { initDB } from '../db';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { getCarryForwardsDisponibles } from '../carryForwardService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';
import type { DeclaracionCompleta, InmuebleDeclarado } from '../../types/declaracionCompleta';

const REF = '6464646AA6464A0001BB';

const gastosCero = () => ({
  interesesFinanciacion: 0, reparacionConservacion: 0, gastosAplicados: 0,
  comunidad: 0, suministros: 0, seguros: 0, ibiTasas: 0, serviciosTerceros: 0,
  amortizacionMobiliario: 0,
});

function inm(p: Partial<InmuebleDeclarado>): InmuebleDeclarado {
  return {
    refCatastral: REF, direccion: 'CL ARRASTRE 64 1 04 DR OVIEDO',
    porcentajePropiedad: 100, esUrbana: true, mejorasEjercicio: [], usos: [],
    arrendamientos: [], gastos: gastosCero(), gastosPendientesPrevios: 0,
    gastosPendientesPreviosAplicados: 0, rendimientoNeto: 0, reduccionVivienda: 0,
    rendimientoNetoReducido: 0, gastosPendientesGenerados: 0, proveedores: [],
    ...p,
  };
}

function decl(ejercicio: number, inmueble: InmuebleDeclarado): DeclaracionCompleta {
  return {
    meta: { ejercicio, modelo: '100', fuenteImportacion: 'xml', numeroJustificante: '',
      csv: '', referencia: '', fechaPresentacion: '', esComplementaria: false,
      esRectificativa: false, tipoDeclaracion: 'I' },
    declarante: { nif: '00000000T', nombreCompleto: 'FIXTURE', tributacion: 'individual', asignacionSocial: false, asignacionIglesia: false },
    inmuebles: [inmueble],
    integracion: { baseImponibleGeneral: 0, baseImponibleAhorro: 0, reduccionPP: 0, baseLiquidableGeneral: 0, baseLiquidableAhorro: 0, minimoPersonalEstatal: 0, minimoPersonalAutonomico: 0 },
    resultado: { cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: 0, cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: 0, deduccionesAutonomicas: 0, deduccionesEstatales: 0, cuotaAutoliquidacion: 0, totalRetencionesPagos: 0, cuotaDiferencial: 0, resultadoDeclaracion: 0 },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] },
    casillas: {}, camposExtra: {},
  } as DeclaracionCompleta;
}

async function propId(): Promise<number> {
  const props = await (await initDB()).getAll('properties');
  const p = (props as any[]).find((x) => (x.cadastralReference || '').replace(/[\s.-]/g, '').toUpperCase() === REF);
  return p.id;
}
async function pendiente(ejercicio: number): Promise<number> {
  const { total } = await getCarryForwardsDisponibles(await propId(), ejercicio);
  return total;
}
async function limpiar() {
  const db = await initDB();
  await Promise.all([db.clear('properties'), db.clear('ejerciciosFiscalesCoord'),
    db.clear('gastosInmueble'), db.clear('aeatCarryForwards'), db.clear('mejorasInmueble')]);
}

// 2024 genera 28.239,24 de pendiente nuevo.
const y2024 = () => decl(2024, inm({ gastosPendientesGenerados: 28239.24 }));
// 2025 aplica 18.412,30 de lo anterior (y no genera nuevo).
const y2025 = () => decl(2025, inm({ arrastresRecibidos: 18412.30 }));

describe('arrastre 4 años · el import alimenta aeatCarryForwards', () => {
  beforeEach(limpiar);

  it('importar el año que genera crea el pendiente con caducidad +4', async () => {
    await distribuirDeclaracion(y2024(), OPCIONES_DEFAULT);
    const cf = await getCarryForwardsDisponibles(await propId(), 2025);
    expect(cf.total).toBeCloseTo(28239.24, 2);
    expect(cf.detalle[0].expirationYear).toBe(2028);
  });

  it('importar el año que aplica reduce el pendiente (28.239 − 18.412 = 9.827)', async () => {
    await distribuirDeclaracion(y2024(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2025(), OPCIONES_DEFAULT);
    expect(await pendiente(2026)).toBeCloseTo(9826.94, 2);
  });

  it('idempotencia: reimportar 2025 no vuelve a consumir', async () => {
    await distribuirDeclaracion(y2024(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2025(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2025(), OPCIONES_DEFAULT); // otra vez
    expect(await pendiente(2026)).toBeCloseTo(9826.94, 2);
  });

  it('order-independiente: 2025 antes que 2024 deja el mismo pendiente', async () => {
    await distribuirDeclaracion(y2025(), OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2024(), OPCIONES_DEFAULT);
    expect(await pendiente(2026)).toBeCloseTo(9826.94, 2);
  });

  it('caducidad: un pendiente de 2024 no está disponible a partir de 2029', async () => {
    await distribuirDeclaracion(y2024(), OPCIONES_DEFAULT);
    expect(await pendiente(2028)).toBeCloseTo(28239.24, 2); // último año vivo
    expect(await pendiente(2029)).toBe(0);                   // caducado
  });
});
