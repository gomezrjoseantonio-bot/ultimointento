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
import { calcularDeclaracionIRPF } from '../irpfCalculationService';
import { invalidateFiscalCache } from '../fiscalCacheService';
import { extraerCasillasDeterministasDesdeTexto } from '../aeatParserService';
import { construirDeclaracionCompletaDesdeCasillas } from '../justificantePdfImportService';
import { parseIrpfXml } from '../irpfXmlParserService';
import { getEntidades } from '../entidadAtribucionService';
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
    await distribuirDeclaracion(declaracion(2025, [], {
      entidades: [{ nif: 'E25904640', tipoEntidad: 'CB', porcentajeParticipacion: 10, tipoRenta: 'capital_inmobiliario', rendimientoAtribuido: 1682.8, retencionAtribuida: 136.05 }],
    }), OPCIONES_DEFAULT);
    const entidades = await getEntidades();
    expect(entidades).toHaveLength(1);
    expect(entidades[0].nif).toBe('E25904640');
    expect((await props())).toHaveLength(0); // no se crea como inmueble
  });

  it('Comunidad de Bienes por XML ENVUELTO real (DocumentoElectronicoV2 + CDATA): parser → distribuidor → store', async () => {
    // El XML de Renta Web viene envuelto: <DocumentoElectronicoV2> con un CDATA
    // que contiene un JSON {"fichero": "<xml interno crudo>"}, y la entidad de
    // atribución cuelga de Declaracion>DatosEconomicos>TomaDatosAmpliada>
    // RegimenesEspeciales>REAtRentas>ENTIDADAR. El harness inyectaba las entidades
    // a mano; esto ejercita el PARSER sobre la estructura real (fixture sintético,
    // sin datos personales) para que la CB no vuelva a perderse en el import.
    const inner =
      '<?xml version="1.0" encoding="ISO-8859-1"?>' +
      '<Declaracion modelo="100" ejercicio="2025" periodo="0A" versionxsd="1.02">' +
      '<Declarante><NIFDeclarante>00000000T</NIFDeclarante></Declarante>' +
      '<DatosEconomicos><TomaDatosAmpliada><RegimenesEspeciales>' +
      '<REAtRentas><ENTIDADAR>' +
      '<AR_NifContribuyente><F1NIFNACDLG>E00000000</F1NIFNACDLG><F1PCTDLG>10.00</F1PCTDLG></AR_NifContribuyente>' +
      '<AR_RendCapiInmobiliario><IMP1>1682.80</IMP1><VRET5B>136.05</VRET5B></AR_RendCapiInmobiliario>' +
      '<F1NIFAR>E00000000</F1NIFAR><F1PCT>10.00</F1PCT><F1EG>1682.80</F1EG><F1EP>136.05</F1EP>' +
      '</ENTIDADAR></REAtRentas>' +
      '</RegimenesEspeciales></TomaDatosAmpliada></DatosEconomicos></Declaracion>';
    const outer =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<DocumentoElectronicoV2><DatosDocumento>' +
      `<Declaracion csv="TESTCSV"><![CDATA[${JSON.stringify({ fichero: inner })}]]></Declaracion>` +
      '</DatosDocumento></DocumentoElectronicoV2>';

    const decl = parseIrpfXml(outer);
    // El parser extrae la CB de la estructura envuelta.
    expect(decl.entidadesAtribucion).toHaveLength(1);
    expect(decl.entidadesAtribucion![0].nif).toBe('E00000000');
    expect(decl.entidadesAtribucion![0].tipoEntidad).toBe('CB');
    expect(decl.entidadesAtribucion![0].tipoRenta).toBe('capital_inmobiliario');
    expect(decl.entidadesAtribucion![0].rendimientoAtribuido).toBeCloseTo(1682.8, 2);

    // Y el distribuidor la persiste en el store (no como inmueble).
    await distribuirDeclaracion(decl, OPCIONES_DEFAULT);
    const ents = await getEntidades();
    expect(ents).toHaveLength(1);
    expect(ents[0].nif).toBe('E00000000');
    expect(ents[0].ejercicios.find((e: any) => e.ejercicio === 2025)?.rendimientosAtribuidos).toBeCloseTo(1682.8, 2);
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

  it('imputación días vacantes: el import propaga VC + revisado y el motor imputa 2% / 1,1% prorrateado', async () => {
    // Dos inmuebles a disposición del titular todo el año (sin arrendamiento).
    // Mismo valor catastral; uno con catastral SIN revisar (2%) y otro revisado
    // (1,1%). Antes el motor leía un campo legacy que el import nunca escribe, de
    // modo que todo importado se imputaba al 2% fijo; este test lo blinda.
    const IMP_NR = '4444444DD4444D0001EE'; // no revisado
    const IMP_RV = '5555555EE5555E0001FF'; // revisado
    const disposicionTodoElAnio = [{ tipo: 'disposicion' as const, dias: 365 }];
    await distribuirDeclaracion(declaracion(2023, [
      inmueble({ refCatastral: IMP_NR, direccion: 'CL VACIA 1 A VALENCIA',
        valorCatastral: 100000, catastralRevisado: false, usos: disposicionTodoElAnio }),
      inmueble({ refCatastral: IMP_RV, direccion: 'CL VACIA 2 B VALENCIA',
        valorCatastral: 100000, catastralRevisado: true, usos: disposicionTodoElAnio }),
    ]), OPCIONES_DEFAULT);

    // El import creó las properties con fiscalData.cadastralValue + cadastralRevised.
    const pNr = await propByRef(IMP_NR);
    const pRv = await propByRef(IMP_RV);
    expect(pNr.fiscalData?.cadastralValue).toBe(100000);
    expect(pNr.fiscalData?.cadastralRevised).toBe(false);
    expect(pRv.fiscalData?.cadastralRevised).toBe(true);

    invalidateFiscalCache(2023); // el motor cachea por ejercicio en memoria
    const decl = await calcularDeclaracionIRPF(2023);
    const impNr = decl.baseGeneral.imputacionRentas.find((i) => i.inmuebleId === pNr.id);
    const impRv = decl.baseGeneral.imputacionRentas.find((i) => i.inmuebleId === pRv.id);

    // Sin alquiler ni obras → días vacantes = año completo (365). Prorrateo ×1.
    expect(impNr?.diasVacio).toBe(365);
    expect(impNr?.imputacion).toBeCloseTo(2000, 2);   // 100000 × 2%   × 365/365
    expect(impRv?.imputacion).toBeCloseTo(1100, 2);   // 100000 × 1,1% × 365/365
    // El prorrateo por días es real: mismo VC, mismo tipo, media imputación si
    // se vendiera a mitad de año lo verifica el bloque de venta; aquí basta con
    // que el denominador sea el año y el porcentaje dependa de `revisado`.
    expect(impRv!.imputacion).toBeLessThan(impNr!.imputacion);
  });

  it('import PDF (justificante): del texto → DeclaracionCompleta pdf → mismo pipeline, sin conversores externos', async () => {
    // Texto tal como lo devuelve pdfjs de un justificante de la AEAT (una página
    // por string). La extracción es 100% determinista —regex sobre el texto, sin
    // IA ni servicios externos— reutilizando la del parser AEAT ya existente.
    const paginasJustificante = [[
      'Agencia Tributaria',
      'Impuesto sobre la Renta de las Personas Físicas',
      'Ejercicio 2023',
      'Número de justificante 2023000111222',
      'Código Seguro de Verificación: ABC123XYZ456',
      'Base imponible general 0435 30000,00',
      'Base imponible del ahorro 0460 2000,00',
      'Cuota íntegra estatal 0545 4000,00',
      'Cuota íntegra autonómica 0546 3800,00',
      'Retenciones y demás pagos a cuenta 0609 9500,00',
      'Cuota diferencial 0610 -800,00',
      'Resultado de la declaración 0670 -800,00',
    ].join('\n')];

    const raw = extraerCasillasDeterministasDesdeTexto(paginasJustificante);
    const decl = construirDeclaracionCompletaDesdeCasillas(raw, { ejercicioFallback: 2023 });

    // El resumen se extrae fiable y determinista (sin red).
    expect(decl.meta.fuenteImportacion).toBe('pdf');
    expect(decl.meta.ejercicio).toBe(2023);
    expect(decl.meta.numeroJustificante).toBe('2023000111222');
    expect(decl.meta.csv).toBe('ABC123XYZ456');
    expect(decl.resultado.resultadoDeclaracion).toBeCloseTo(-800, 2);
    expect(decl.integracion.baseImponibleGeneral).toBeCloseTo(30000, 2);
    expect(decl.integracion.baseImponibleAhorro).toBeCloseTo(2000, 2);

    // Y fluye por el MISMO distribuidor que el XML.
    await distribuirDeclaracion(decl, OPCIONES_DEFAULT);
    const ej = await getEjercicio(2023);
    const activa = ej?.aeat?.versiones?.find((v) => v.id === ej.aeat?.versionActivaId);
    expect(activa?.resultado).toBeCloseTo(-800, 2);
    expect(activa?.fuenteImportacion).toBe('pdf');
    expect((await props())).toHaveLength(0); // este texto no trae bloques de inmueble
  });

  it('import PDF COMPLETO: inmuebles + Comunidad de Bienes + arrastres, igual que el XML', async () => {
    // Texto de un justificante con el detalle completo (mismo formato que el
    // Modelo 100 real): un inmueble arrendado con sus casillas por bloque
    // `Inmueble N`, y el apartado de atribución de rentas (CB). El PDF debe
    // reconstruir la DeclaracionCompleta con inmuebles y CB, no solo el resumen.
    const paginas = [[
      'Ejercicio 2024',
      'Número de justificante 2024000999888',
      'Bienes inmuebles',
      'Inmueble 1',
      'Porcentaje de propiedad.   100,00   0063',
      'Referencia catastral.   9999999XX9999X0001XX   0066',
      'Urbana.   X   0067',
      'Dirección del inmueble   CL EJEMPLO 0010 1 A MADRID   0069',
      'Arrendamiento.   X   0075',
      'Nº de días que el inmueble ha estado arrendado   366   0101',
      'Ingresos íntegros computables de capital inmobiliario.   12.000,00   0102',
      'Gastos de comunidad   600,00   0109',
      'Amortización del inmueble   1.100,00   0131',
      'Rendimiento neto.   9.100,00   0149',
      'Rendimiento neto reducido.   9.100,00   0154',
      'Regímenes especiales de imputación de rentas',
      'IMPUTACIONES DE ENTIDADES EN RÉGIMEN DE ATRIBUCIÓN DE RENTAS',
      'N.I.F. de la entidad en régimen de atribución de rentas   E00000000   1562',
      'Porcentaje de participación del contribuyente en la entidad   10,00   1564',
      'Rendimiento neto atribuido por la entidad   1.682,80   1571',
      'Atribución de retenciones de rendimientos de capital inmobiliario   136,05   1598',
      'Base imponible general   30000,00   0435',
      'Resultado de la declaración   -500,00   0670',
    ].join('\n')];

    const decl = construirDeclaracionCompletaDesdeCasillas(
      extraerCasillasDeterministasDesdeTexto(paginas), { ejercicioFallback: 2024 });

    // Inmueble reconstruido con su desglose (no vacío).
    expect(decl.inmuebles).toHaveLength(1);
    const inm = decl.inmuebles[0];
    expect(inm.refCatastral).toBe('9999999XX9999X0001XX');
    expect(inm.amortizacionAnualInmueble).toBeCloseTo(1100, 2);
    expect(inm.rendimientoNetoReducido).toBeCloseTo(9100, 2);
    expect(inm.gastos.comunidad).toBeCloseTo(600, 2);
    expect(inm.arrendamientos[0].ingresos).toBeCloseTo(12000, 2);

    // Comunidad de Bienes extraída del apartado de atribución del PDF.
    expect(decl.entidadesAtribucion).toHaveLength(1);
    expect(decl.entidadesAtribucion![0].nif).toBe('E00000000');
    expect(decl.entidadesAtribucion![0].tipoEntidad).toBe('CB');
    expect(decl.entidadesAtribucion![0].rendimientoAtribuido).toBeCloseTo(1682.8, 2);

    // Fluye por el MISMO distribuidor: crea la property y la entidad.
    await distribuirDeclaracion(decl, OPCIONES_DEFAULT);
    expect((await props())).toHaveLength(1);
    const ents = await getEntidades();
    expect(ents).toHaveLength(1);
    expect(ents[0].nif).toBe('E00000000');
  });
});
