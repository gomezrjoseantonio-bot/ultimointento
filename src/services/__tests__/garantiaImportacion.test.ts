/**
 * PIEZA 0 · Garantía de importación end-to-end.
 *
 * Este arnés mete declaraciones a través del pipeline REAL (`distribuirDeclaracion`)
 * y comprueba que todo se propaga a donde toca, con las invariantes que hacen que
 * un cliente pueda "subir sus declaraciones sin miedo":
 *
 *   · Idempotencia         reimportar el mismo año no cambia el estado.
 *   · Orden-independiente  importar 2020→2025 o 2025→2020 da el mismo resultado.
 *   · Sin duplicado        N inmuebles → N properties (emparejadas, no clonadas).
 *   · Sin doble conteo     cada casilla/mejora acaba en un sitio y solo uno.
 *   · Reconciliación       mejoras y estado (vendido) cuadran con lo declarado.
 *
 * Fixtures SINTÉTICAS (nada de datos personales reales en el repo). Los huecos
 * conocidos del modelo quedan marcados abajo como `it.todo` — son el backlog
 * objetivo de "qué falta para vender esto".
 */
import { initDB } from '../db';
import { distribuirDeclaracion } from '../declaracionDistributorService';
import { getEjercicio } from '../ejercicioResolverService';
import { gastosInmuebleService } from '../gastosInmuebleService';
import { mejorasInmuebleService } from '../mejorasInmuebleService';
import { getCarryForwardsDisponibles } from '../carryForwardService';
import { OPCIONES_DEFAULT } from '../../types/opcionesDistribucion';
import type { DeclaracionCompleta, InmuebleDeclarado } from '../../types/declaracionCompleta';

// ── Factoría de fixtures ──────────────────────────────────────────────────
const gastosCero = () => ({
  interesesFinanciacion: 0, reparacionConservacion: 0, gastosAplicados: 0,
  comunidad: 0, suministros: 0, seguros: 0, ibiTasas: 0, serviciosTerceros: 0,
  amortizacionMobiliario: 0,
});

function inmueble(p: Partial<InmuebleDeclarado> & { refCatastral: string; direccion: string }): InmuebleDeclarado {
  return {
    porcentajePropiedad: 100,
    esUrbana: true,
    mejorasEjercicio: [],
    usos: [],
    arrendamientos: [],
    gastos: gastosCero(),
    gastosPendientesPrevios: 0,
    gastosPendientesPreviosAplicados: 0,
    rendimientoNeto: 0,
    reduccionVivienda: 0,
    rendimientoNetoReducido: 0,
    gastosPendientesGenerados: 0,
    proveedores: [],
    ...p,
  };
}

function declaracion(
  ejercicio: number,
  inmuebles: InmuebleDeclarado[],
  opts: { resultado?: number; previaIngresos?: number; perdidas?: any[]; entidades?: any[] } = {},
): DeclaracionCompleta {
  return {
    meta: {
      ejercicio, modelo: '100', fuenteImportacion: 'xml',
      numeroJustificante: '', csv: '', referencia: '', fechaPresentacion: '',
      esComplementaria: false, esRectificativa: opts.previaIngresos != null,
      ...(opts.previaIngresos != null ? { declaracionPrevia: { justificante: '', ingresosPrevios: opts.previaIngresos } } : {}),
      tipoDeclaracion: 'I',
    },
    declarante: { nif: '00000000T', nombreCompleto: 'FIXTURE', tributacion: 'individual', asignacionSocial: false, asignacionIglesia: false },
    inmuebles,
    integracion: {
      baseImponibleGeneral: 0, baseImponibleAhorro: 0, reduccionPP: 0,
      baseLiquidableGeneral: 0, baseLiquidableAhorro: 0,
      minimoPersonalEstatal: 0, minimoPersonalAutonomico: 0,
    },
    resultado: {
      cuotaIntegraEstatal: 0, cuotaIntegraAutonomica: 0,
      cuotaLiquidaEstatal: 0, cuotaLiquidaAutonomica: 0,
      deduccionesAutonomicas: 0, deduccionesEstatales: 0,
      cuotaAutoliquidacion: 0, totalRetencionesPagos: 0, cuotaDiferencial: 0,
      resultadoDeclaracion: opts.resultado ?? 0,
    },
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: opts.perdidas ?? [] },
    entidadesAtribucion: opts.entidades ?? [],
    casillas: { '0695': opts.resultado ?? 0 },
    camposExtra: {},
  } as DeclaracionCompleta;
}

const norm = (r: string) => (r || '').replace(/[\s.-]/g, '').toUpperCase();
async function props() { return (await (await initDB()).getAll('properties')) as any[]; }
async function propByRef(ref: string) {
  return (await props()).find((p) => norm(p.cadastralReference) === norm(ref));
}
async function capex(propId: number) {
  const ms = await mejorasInmuebleService.getPorInmueble(propId);
  return ms.filter((m) => m.tipo !== 'reparacion').reduce((s, m) => s + m.importe, 0);
}

// Refs sintéticas (formato catastral válido, inventadas).
const U1 = '1111111AA1111A0001AA'; // edificio · unidad 1
const U2 = '1111111AA1111A0002BB'; // edificio · unidad 2 (misma calle+número, distinto piso)
const SALE = '2222222BB2222B0001CC';
const MEJ = '3333333CC3333C0001DD';

async function limpiar() {
  const db = await initDB();
  await Promise.all([
    db.clear('properties'), db.clear('ejerciciosFiscalesCoord'),
    db.clear('mejorasInmueble'), db.clear('gastosInmueble'), db.clear('mueblesInmueble'),
    db.clear('aeatCarryForwards'), db.clear('perdidasPatrimonialesAhorro'),
    db.clear('entidadesAtribucion'),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
describe('Garantía de importación · invariantes que se cumplen hoy', () => {
  beforeEach(limpiar);

  it('sin duplicado: dos unidades del mismo edificio crean dos properties distintas', async () => {
    await distribuirDeclaracion(declaracion(2024, [
      inmueble({ refCatastral: U1, direccion: 'CL PRUEBA 10 1 DR MADRID' }),
      inmueble({ refCatastral: U2, direccion: 'CL PRUEBA 10 1 IZ MADRID' }),
    ]), OPCIONES_DEFAULT);
    const p = await props();
    expect(p).toHaveLength(2);
    expect(new Set(p.map((x) => norm(x.cadastralReference))).size).toBe(2);
  });

  it('idempotencia: reimportar el mismo año no duplica properties ni filas de gasto', async () => {
    const decl = declaracion(2024, [
      inmueble({ refCatastral: U1, direccion: 'CL PRUEBA 10 1 DR MADRID',
        gastos: { ...gastosCero(), ibiTasas: 300, comunidad: 600 } }),
    ]);
    await distribuirDeclaracion(decl, OPCIONES_DEFAULT);
    await distribuirDeclaracion(decl, OPCIONES_DEFAULT); // segunda vez
    const p = await propByRef(U1);
    expect((await props())).toHaveLength(1);
    const filas = await gastosInmuebleService.getByInmuebleYEjercicio(p.id, 2024);
    const aeat = filas.filter((g) => g.origen === 'xml_aeat');
    // 2 casillas declaradas (0115 IBI + 0109 comunidad), no 4.
    expect(aeat).toHaveLength(2);
  });

  it('venta: transmisión → estado vendido, y un año anterior no lo revierte', async () => {
    await distribuirDeclaracion(declaracion(2025, [
      inmueble({ refCatastral: SALE, direccion: 'CL VENTA 5 2 A OVIEDO', fechaTransmision: '27/11/2025' }),
    ]), OPCIONES_DEFAULT);
    expect((await propByRef(SALE)).state).toBe('vendido');
    await distribuirDeclaracion(declaracion(2024, [
      inmueble({ refCatastral: SALE, direccion: 'CL VENTA 5 2 A OVIEDO' }),
    ]), OPCIONES_DEFAULT);
    expect((await propByRef(SALE)).state).toBe('vendido');
  });

  it('mejoras orden-independiente: la reforma origen cuenta una sola vez (importe 4.000)', async () => {
    // Orden inverso: primero el año que ve "anteriores", luego el año origen.
    await distribuirDeclaracion(declaracion(2024, [
      inmueble({ refCatastral: MEJ, direccion: 'CL MEJORA 7 BILBAO', mejorasAnteriores: 4000 }),
    ]), OPCIONES_DEFAULT);
    await distribuirDeclaracion(declaracion(2022, [
      inmueble({ refCatastral: MEJ, direccion: 'CL MEJORA 7 BILBAO', mejorasEjercicio: [{ importe: 4000, fecha: '2022-06-01' }] }),
    ]), OPCIONES_DEFAULT);
    const p = await propByRef(MEJ);
    expect(await capex(p.id)).toBeCloseTo(4000, 2);
  });

  it('orden-independiente global: importar años al derecho o al revés deja el mismo CAPEX', async () => {
    const y2022 = declaracion(2022, [inmueble({ refCatastral: MEJ, direccion: 'CL MEJORA 7 BILBAO', mejorasEjercicio: [{ importe: 4000, fecha: '2022-06-01' }] })]);
    const y2024 = declaracion(2024, [inmueble({ refCatastral: MEJ, direccion: 'CL MEJORA 7 BILBAO', mejorasAnteriores: 4000 })]);
    // Derecho
    await limpiar();
    await distribuirDeclaracion(y2022, OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2024, OPCIONES_DEFAULT);
    const derecho = await capex((await propByRef(MEJ)).id);
    // Revés
    await limpiar();
    await distribuirDeclaracion(y2024, OPCIONES_DEFAULT);
    await distribuirDeclaracion(y2022, OPCIONES_DEFAULT);
    const reves = await capex((await propByRef(MEJ)).id);
    expect(derecho).toBeCloseTo(reves, 2);
    expect(derecho).toBeCloseTo(4000, 2);
  });

  it('versiones: original + rectificativa del mismo año dejan 2 versiones, la última activa', async () => {
    await distribuirDeclaracion(declaracion(2024, [], { resultado: 2077.61 }), OPCIONES_DEFAULT);
    await distribuirDeclaracion(declaracion(2024, [], { resultado: 2899.75, previaIngresos: 2077.61 }), OPCIONES_DEFAULT);
    const ej = await getEjercicio(2024);
    expect(ej?.aeat?.versiones).toHaveLength(2);
    const activa = ej?.aeat?.versiones?.find((v) => v.id === ej.aeat?.versionActivaId);
    expect(activa?.resultado).toBeCloseTo(2899.75, 2);
  });

  it('arrastre 4 años: el import alimenta la bolsa aeatCarryForwards (genera y consume)', async () => {
    // Año que genera pendiente, año posterior que lo aplica → queda el resto.
    await distribuirDeclaracion(declaracion(2024, [
      inmueble({ refCatastral: U1, direccion: 'CL PRUEBA 10 1 DR MADRID', gastosPendientesGenerados: 10000 }),
    ]), OPCIONES_DEFAULT);
    await distribuirDeclaracion(declaracion(2025, [
      inmueble({ refCatastral: U1, direccion: 'CL PRUEBA 10 1 DR MADRID', arrastresRecibidos: 4000 }),
    ]), OPCIONES_DEFAULT);
    const p = await propByRef(U1);
    const { total } = await getCarryForwardsDisponibles(p.id, 2026);
    expect(total).toBeCloseTo(6000, 2);
  });

  it('Comunidad de Bienes: el import crea la entidad de atribución (no un inmueble)', async () => {
    const { getEntidades } = await import('../entidadAtribucionService');
    await distribuirDeclaracion(declaracion(2025, [], {
      entidades: [{ nif: 'E25904640', tipoEntidad: 'CB', porcentajeParticipacion: 10, tipoRenta: 'capital_inmobiliario', rendimientoAtribuido: 1682.8, retencionAtribuida: 136.05 }],
    }), OPCIONES_DEFAULT);
    const entidades = await getEntidades();
    expect(entidades).toHaveLength(1);
    expect(entidades[0].nif).toBe('E25904640');
    expect((await props())).toHaveLength(0); // no se crea como inmueble
  });

  it('saldos BIA: el import alimenta perdidasPatrimonialesAhorro (genera y consume)', async () => {
    await distribuirDeclaracion(declaracion(2023, [], {
      perdidas: [{ tipo: 'ahorro', importeInicial: 5000, importeAplicado: 0, importePendiente: 5000, añoOrigen: 0 }],
    }), OPCIONES_DEFAULT);
    await distribuirDeclaracion(declaracion(2025, [], {
      perdidas: [{ tipo: 'ahorro', importeInicial: 5000, importeAplicado: 2000, importePendiente: 3000, añoOrigen: 2 }],
    }), OPCIONES_DEFAULT);
    const all = (await (await initDB()).getAll('perdidasPatrimonialesAhorro')) as any[];
    const r = all.find((x) => x.ejercicioOrigen === 2023 && x.tipoOrigen === 'importado');
    expect(r.importePendiente).toBeCloseTo(3000, 2);
  });

  it('gastos por casilla: se propagan a gastosInmueble con origen xml_aeat', async () => {
    await distribuirDeclaracion(declaracion(2024, [
      inmueble({ refCatastral: U1, direccion: 'CL PRUEBA 10 1 DR MADRID',
        gastos: { ...gastosCero(), ibiTasas: 300, seguros: 120, comunidad: 600 } }),
    ]), OPCIONES_DEFAULT);
    const p = await propByRef(U1);
    const filas = await gastosInmuebleService.getByInmuebleYEjercicio(p.id, 2024);
    const casillas = filas.filter((g) => g.origen === 'xml_aeat').map((g) => g.casillaAEAT).sort();
    expect(casillas).toEqual(['0109', '0114', '0115']); // comunidad, seguros, IBI
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HUECOS CONOCIDOS · el modelo aún no los cubre. Son el backlog objetivo.
// Se dejan como `todo` (visibles en CI, sin romper la build) hasta implementarlos.
// ═══════════════════════════════════════════════════════════════════════════
describe('Garantía de importación · huecos conocidos (pendientes de implementar)', () => {
  it.todo('Imputación de renta: días vacantes generan imputación (2% / 1,1% si catastral revisado) prorrateada');
  it.todo('Import por PDF (justificante): extrae el resumen de forma fiable, sin depender de conversores externos');
});
