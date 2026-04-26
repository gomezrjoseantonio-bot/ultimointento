// rendimientoActivoService.ts
// Fuente de datos para el componente RendimientoActivo (cuadro fiscal del inmueble).
// Jerarquía de fuentes:
//   1. ejerciciosFiscalesCoord[año].aeat.declaracionCompleta → fuente 'xml_aeat'
//   2. gastosInmueble + rentaMensual → fuente 'atlas'
//   3. Sin datos → fuente 'sin_datos'

import { initDB } from './db';
import { gastosInmuebleService } from './gastosInmuebleService';

export interface RendimientoFiscal {
  // Ingresos
  rentasDeclaradas: number;
  diasArrendado: number;
  rentaImputada: number;
  diasDisposicion: number;
  totalIngresos: number;

  // Gastos deducibles
  interesesFinanciacion: number;
  reparacionConservacion: number;  // total declarado (C_GRCEA)
  reparacionAplicada: number;      // aplicado en ejercicio (≤ ingresos)
  reparacionExceso: number;        // pendiente ejercicios futuros
  ibiTasas: number;
  comunidad: number;
  suministros: number;
  seguros: number;
  amortMobiliario: number;
  amortInmueble: number;
  baseAmortizacion: number;
  totalGastosDeducibles: number;

  // Resultado
  rendimientoNeto: number;
  reduccionVivienda: number;
  tipoArrendamiento: number;       // 1=vivienda, 2=otros/no_vivienda
  rendimientoNetoReducido: number;

  // Meta
  fuente: 'xml_aeat' | 'atlas' | 'sin_datos';
}

function normalizeRef(ref: string): string {
  return (ref ?? '').replace(/\s+/g, '').toUpperCase();
}

function emptyRendimiento(fuente: RendimientoFiscal['fuente'] = 'sin_datos'): RendimientoFiscal {
  return {
    rentasDeclaradas: 0, diasArrendado: 0, rentaImputada: 0, diasDisposicion: 0,
    totalIngresos: 0,
    interesesFinanciacion: 0, reparacionConservacion: 0, reparacionAplicada: 0,
    reparacionExceso: 0, ibiTasas: 0, comunidad: 0, suministros: 0, seguros: 0,
    amortMobiliario: 0, amortInmueble: 0, baseAmortizacion: 0, totalGastosDeducibles: 0,
    rendimientoNeto: 0, reduccionVivienda: 0, tipoArrendamiento: 2, rendimientoNetoReducido: 0,
    fuente,
  };
}

export async function getRendimientoFiscal(
  propertyId: number,
  referenciaCatastral: string,
  año: number,
): Promise<RendimientoFiscal> {
  const db = await initDB();

  // ── 1. Intento AEAT XML ────────────────────────────────────────────────
  if (referenciaCatastral) {
    const ejercicio = await db.get('ejerciciosFiscalesCoord', año);
    const declInmuebles: any[] = ejercicio?.aeat?.declaracionCompleta?.inmuebles ?? [];
    const inmDecl = declInmuebles.find(
      (i: any) => normalizeRef(i.refCatastral ?? '') === normalizeRef(referenciaCatastral),
    );

    if (inmDecl) {
      const arrends: any[] = inmDecl.arrendamientos ?? [];
      const rentasDeclaradas = arrends.reduce((s: number, a: any) => s + (a.ingresos ?? 0), 0);
      const diasArrendado = arrends.reduce((s: number, a: any) => s + (a.diasArrendado ?? 0), 0);

      const disposicionUsos = (inmDecl.usos ?? []).filter((u: any) => u.tipo === 'disposicion');
      const rentaImputada = disposicionUsos.reduce((s: number, u: any) => s + (u.rentaImputada ?? 0), 0);
      const diasDisposicion = disposicionUsos.reduce((s: number, u: any) => s + (u.dias ?? 0), 0);

      const g = inmDecl.gastos ?? {};
      const interesesFinanciacion = g.interesesFinanciacion ?? 0;
      const reparacionConservacion = g.reparacionConservacion ?? 0;
      const reparacionAplicada = g.gastosAplicados ?? reparacionConservacion;
      // C_INTGRCEF está en gastosPendientesGenerados
      const reparacionExceso = inmDecl.gastosPendientesGenerados
        ?? Math.max(0, reparacionConservacion - reparacionAplicada);
      const ibiTasas = g.ibiTasas ?? 0;
      const comunidad = g.comunidad ?? 0;
      const suministros = g.suministros ?? 0;
      const seguros = g.seguros ?? 0;
      const amortMobiliario = inmDecl.amortizacionMobiliario ?? g.amortizacionMobiliario ?? 0;
      const amortInmueble = inmDecl.amortizacionAnualInmueble ?? 0;
      const baseAmortizacion = inmDecl.baseAmortizacion ?? 0;

      const totalIngresos = rentasDeclaradas + rentaImputada;
      // totalGastosDeducibles usa reparacionAplicada (no el total declarado)
      const totalGastosDeducibles =
        interesesFinanciacion + reparacionAplicada + ibiTasas + comunidad +
        suministros + seguros + amortMobiliario + amortInmueble;

      const rendimientoNeto = inmDecl.rendimientoNeto ?? (totalIngresos - totalGastosDeducibles);
      const reduccionVivienda = inmDecl.reduccionVivienda ?? 0;
      const rendimientoNetoReducido = inmDecl.rendimientoNetoReducido ?? (rendimientoNeto - reduccionVivienda);

      const tipoArrStr = arrends[0]?.tipoArrendamiento;
      const tipoArrendamiento = tipoArrStr === 'vivienda' ? 1 : 2;

      return {
        rentasDeclaradas, diasArrendado, rentaImputada, diasDisposicion, totalIngresos,
        interesesFinanciacion, reparacionConservacion, reparacionAplicada, reparacionExceso,
        ibiTasas, comunidad, suministros, seguros,
        amortMobiliario, amortInmueble, baseAmortizacion, totalGastosDeducibles,
        rendimientoNeto, reduccionVivienda, tipoArrendamiento, rendimientoNetoReducido,
        fuente: 'xml_aeat',
      };
    }
  }

  // ── 2. Fallback Atlas: gastosInmueble + rentaMensual ──────────────────
  const gastosCasillas = await gastosInmuebleService.getSumaPorCasilla(propertyId, año);

  // Rentas: contratos del inmueble → registros rentaMensual del año
  const allContracts: any[] = await db.getAll('contracts');
  const propContracts = allContracts.filter(
    (c: any) => (c.inmuebleId ?? c.propertyId) === propertyId,
  );
  let rentasDeclaradas = 0;
  for (const c of propContracts) {
    if (c.id == null) continue;
    // rentaMensual store eliminado en V62 — derivar desde contract.rentaMensual × meses activos en el año.
    const rentaMes = (c as any).rentaMensual ?? 0;
    if (rentaMes > 0) {
      const inicioStr = String((c as any).fechaInicio ?? `${año}-01-01`);
      const finStr = String((c as any).fechaFin ?? `${año + 1}-01-01`);
      const inicioAño = new Date(`${año}-01-01`);
      const finAño = new Date(`${año}-12-31`);
      const inicio = new Date(inicioStr) < inicioAño ? inicioAño : new Date(inicioStr);
      const fin = new Date(finStr) > finAño ? finAño : new Date(finStr);
      if (inicio <= fin) {
        const meses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth()) + 1;
        rentasDeclaradas += rentaMes * Math.max(0, meses);
      }
    }
  }

  // Amortización: desde property.fiscalData
  const property = await db.get('properties', propertyId);
  const baseAmortizacion = property?.fiscalData?.baseAmortizacion ?? 0;
  const amortInmueble = baseAmortizacion > 0
    ? Math.round(baseAmortizacion * 0.03 * 100) / 100
    : (property?.fiscalData?.amortizacionAnualInmueble ?? 0);

  // Mapeo casillas según CATEGORIA_A_CASILLA del gastosInmuebleService:
  //   seguro → 0114, ibi → 0115, gestion/servicio → 0112
  const interesesFinanciacion = gastosCasillas['0105'] ?? 0;
  const reparacionConservacion = gastosCasillas['0106'] ?? 0;
  const comunidad = gastosCasillas['0109'] ?? 0;
  const suministros = gastosCasillas['0113'] ?? 0;
  const seguros = gastosCasillas['0114'] ?? 0;
  const ibiTasas = gastosCasillas['0115'] ?? 0;
  const amortMobiliario = gastosCasillas['0117'] ?? 0;

  const reparacionAplicada = reparacionConservacion; // sin límite en Atlas
  const reparacionExceso = 0;

  const totalIngresos = rentasDeclaradas;
  const totalGastosDeducibles =
    interesesFinanciacion + reparacionAplicada + ibiTasas + comunidad +
    suministros + seguros + amortMobiliario + amortInmueble;

  if (rentasDeclaradas === 0 && totalGastosDeducibles === 0) {
    return emptyRendimiento('sin_datos');
  }

  return {
    rentasDeclaradas, diasArrendado: 0, rentaImputada: 0, diasDisposicion: 0, totalIngresos,
    interesesFinanciacion, reparacionConservacion, reparacionAplicada, reparacionExceso,
    ibiTasas, comunidad, suministros, seguros,
    amortMobiliario, amortInmueble, baseAmortizacion, totalGastosDeducibles,
    rendimientoNeto: 0, reduccionVivienda: 0, tipoArrendamiento: 2, rendimientoNetoReducido: 0,
    fuente: 'atlas',
  };
}
