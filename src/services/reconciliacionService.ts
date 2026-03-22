import type { Property } from './db';
import type { DeclaracionIRPF, DeclaracionInmueble, DeclaracionTrabajo, DeclaracionActividad } from '../types/fiscal';
import type { Prestamo } from '../types/prestamos';

export type EstadoReconciliacion = 'pendiente' | 'aceptado' | 'rechazado' | 'vinculado_manual';

export interface ReconciliacionCompleta {
  ejercicio: number;
  inmuebles: ReconciliacionInmueble[];
  prestamos: ReconciliacionPrestamo[];
  trabajo: ReconciliacionSeccion;
  actividad: ReconciliacionSeccion;
  estadisticas: ReconciliacionEstadisticas;
}

export interface ReconciliacionEstadisticas {
  totalCamposComparados: number;
  coincidencias: number;
  diferencias: number;
  sinDatosAtlas: number;
  pendientesDeDecision: number;
}

export interface ReconciliacionInmueble {
  tipo: 'match_exacto' | 'match_parcial' | 'solo_aeat' | 'solo_atlas';
  datosAeat?: DeclaracionInmueble;
  datosAtlas?: PropiedadReconciliable;
  referenciaCatastral: string;
  direccion: string;
  campos: CampoReconciliado[];
  estado: EstadoReconciliacion;
  hipotesis?: 'vendido_antes_del_ejercicio' | 'no_arrendado' | 'accesorio_no_listado' | 'desconocido';
}

export interface CampoReconciliado {
  campo: string;
  label: string;
  seccion: 'identificacion' | 'adquisicion' | 'catastral' | 'ingresos' | 'gastos' | 'amortizacion' | 'resultado';
  valorAtlas: unknown;
  valorAeat: unknown;
  tipo: 'coincide' | 'difiere' | 'solo_aeat' | 'solo_atlas';
  decision: 'mantener_atlas' | 'usar_aeat' | 'pendiente';
  impacto: 'alto' | 'medio' | 'bajo';
  formato: 'moneda' | 'porcentaje' | 'fecha' | 'texto' | 'numero' | 'boolean';
}

export interface ReconciliacionPrestamo {
  inmuebleRef: string;
  direccion: string;
  interesesAeat: number;
  existeEnAtlas: boolean;
  prestamoAtlasId?: string;
  interesesAtlas?: number;
  estado: EstadoReconciliacion;
}

export interface ReconciliacionSeccion {
  campos: CampoReconciliado[];
  tieneAeat: boolean;
  tieneAtlas: boolean;
}

export interface PropiedadReconciliable {
  id: string;
  referenciaCatastral: string;
  direccion: string;
  estado: string;
  valorCatastral?: number;
  valorCatastralConstruccion?: number;
  porcentajeConstruccion?: number;
  precioAdquisicion?: number;
  gastosAdquisicion?: number;
  fechaAdquisicion?: string;
  porcentajePropiedad?: number;
}

const TEXT_ENCODER = new Intl.Collator('es', { sensitivity: 'base', usage: 'search' });

export async function generarReconciliacion(
  declaracion: DeclaracionIRPF,
  ejercicio: number,
): Promise<ReconciliacionCompleta> {
  const propiedades = await cargarPropiedadesReconciliables();
  const prestamosAtlas = await cargarPrestamosReconciliables();

  const inmuebles = reconciliarInmuebles(declaracion.inmuebles, propiedades);
  const prestamos = reconciliarPrestamos(declaracion.inmuebles, prestamosAtlas, ejercicio);
  const trabajo = reconciliarTrabajo(declaracion.trabajo);
  const actividad = reconciliarActividad(declaracion.actividades);

  return {
    ejercicio,
    inmuebles,
    prestamos,
    trabajo,
    actividad,
    estadisticas: calcularEstadisticasReconciliacion({
      inmuebles,
      trabajo,
      actividad,
    }),
  };
}

export function calcularEstadisticasReconciliacion(
  reconciliacion: Pick<ReconciliacionCompleta, 'inmuebles' | 'trabajo' | 'actividad'>,
): ReconciliacionEstadisticas {
  const todosCampos = [
    ...reconciliacion.inmuebles.flatMap((inmueble) => inmueble.campos),
    ...reconciliacion.trabajo.campos,
    ...reconciliacion.actividad.campos,
  ];

  return {
    totalCamposComparados: todosCampos.length,
    coincidencias: todosCampos.filter((campo) => campo.tipo === 'coincide').length,
    diferencias: todosCampos.filter((campo) => campo.tipo === 'difiere').length,
    sinDatosAtlas: todosCampos.filter((campo) => campo.tipo === 'solo_aeat').length,
    pendientesDeDecision: todosCampos.filter((campo) => campo.decision === 'pendiente').length,
  };
}

export function requiereReconciliacion(reconciliacion: ReconciliacionCompleta): boolean {
  return reconciliacion.inmuebles.some(
    (inmueble) => inmueble.tipo !== 'solo_aeat' || inmueble.estado === 'pendiente' || inmueble.campos.some((campo) => campo.tipo !== 'coincide'),
  );
}

function reconciliarInmuebles(
  inmueblesAeat: DeclaracionInmueble[],
  propiedadesAtlas: PropiedadReconciliable[],
): ReconciliacionInmueble[] {
  const resultado: ReconciliacionInmueble[] = [];
  const refsUsadas = new Set<string>();
  const idsUsados = new Set<string>();

  for (const aeat of inmueblesAeat) {
    if (!aeat.referenciaCatastral && !aeat.direccion) continue;

    let atlas = propiedadesAtlas.find(
      (propiedad) => propiedad.referenciaCatastral
        && aeat.referenciaCatastral
        && propiedad.referenciaCatastral === aeat.referenciaCatastral,
    );

    if (!atlas) {
      atlas = buscarMatchParcial(aeat, propiedadesAtlas, idsUsados);
    }

    if (atlas) {
      refsUsadas.add(atlas.referenciaCatastral);
      idsUsados.add(atlas.id);
      const campos = compararCamposInmueble(aeat, atlas);
      const todasCoinciden = campos.every((campo) => campo.tipo === 'coincide');

      resultado.push({
        tipo: todasCoinciden && atlas.referenciaCatastral === aeat.referenciaCatastral ? 'match_exacto' : 'match_parcial',
        datosAeat: aeat,
        datosAtlas: atlas,
        referenciaCatastral: aeat.referenciaCatastral || atlas.referenciaCatastral || `aeat-${aeat.orden}`,
        direccion: aeat.direccion || atlas.direccion,
        campos,
        estado: todasCoinciden ? 'aceptado' : 'pendiente',
      });
    } else {
      resultado.push({
        tipo: 'solo_aeat',
        datosAeat: aeat,
        referenciaCatastral: aeat.referenciaCatastral || `aeat-${aeat.orden}`,
        direccion: aeat.direccion,
        campos: generarCamposSoloAeat(aeat),
        estado: 'pendiente',
      });
    }
  }

  for (const atlas of propiedadesAtlas) {
    if (idsUsados.has(atlas.id) || refsUsadas.has(atlas.referenciaCatastral)) continue;

    resultado.push({
      tipo: 'solo_atlas',
      datosAtlas: atlas,
      referenciaCatastral: atlas.referenciaCatastral || `atlas-${atlas.id}`,
      direccion: atlas.direccion,
      campos: [],
      estado: 'pendiente',
      hipotesis: inferirHipotesis(atlas),
    });
  }

  return resultado;
}

function buscarMatchParcial(
  aeat: DeclaracionInmueble,
  propiedades: PropiedadReconciliable[],
  yaUsadas: Set<string>,
): PropiedadReconciliable | undefined {
  const dirNorm = normalizarDireccion(aeat.direccion);
  if (!dirNorm) return undefined;

  return propiedades.find((propiedad) => {
    if (yaUsadas.has(propiedad.id)) return false;

    const dirAtlasNorm = normalizarDireccion(propiedad.direccion);
    const palabrasAeat = dirNorm.split(' ').filter((word) => word.length > 2);
    const palabrasAtlas = dirAtlasNorm.split(' ').filter((word) => word.length > 2);
    const comunes = palabrasAeat.filter((word) => palabrasAtlas.includes(word));
    return comunes.length >= 3;
  });
}

function normalizarDireccion(dir: string): string {
  return dir
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(CL|AV|PL|CR|PS|RD|TR|UR|CALLE|AVENIDA|PASEO|RONDA|TRAVESIA)\b/g, ' ')
    .replace(/\b(0+)(\d)/g, '$2')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferirHipotesis(atlas: PropiedadReconciliable): ReconciliacionInmueble['hipotesis'] {
  if (['vendido', 'sold', 'inactive', 'baja'].includes((atlas.estado || '').toLowerCase())) {
    return 'vendido_antes_del_ejercicio';
  }

  return 'desconocido';
}

function compararCamposInmueble(
  aeat: DeclaracionInmueble,
  atlas: PropiedadReconciliable,
): CampoReconciliado[] {
  const campos: CampoReconciliado[] = [];

  const add = (
    campo: string,
    label: string,
    seccion: CampoReconciliado['seccion'],
    valorAeat: unknown,
    valorAtlas: unknown,
    impacto: CampoReconciliado['impacto'],
    formato: CampoReconciliado['formato'],
  ) => {
    const aeatVacio = isValorVacio(valorAeat);
    const atlasVacio = isValorVacio(valorAtlas);

    if (aeatVacio && atlasVacio) return;

    let tipo: CampoReconciliado['tipo'];
    if (aeatVacio && !atlasVacio) tipo = 'solo_atlas';
    else if (!aeatVacio && atlasVacio) tipo = 'solo_aeat';
    else if (valoresIguales(valorAeat, valorAtlas, formato)) tipo = 'coincide';
    else tipo = 'difiere';

    campos.push({
      campo,
      label,
      seccion,
      valorAeat,
      valorAtlas,
      tipo,
      decision: tipo === 'coincide' ? 'mantener_atlas' : tipo === 'solo_aeat' ? 'usar_aeat' : 'pendiente',
      impacto,
      formato,
    });
  };

  add('referenciaCatastral', 'Ref. catastral', 'identificacion', aeat.referenciaCatastral, atlas.referenciaCatastral, 'alto', 'texto');
  add('porcentajePropiedad', '% propiedad', 'identificacion', aeat.porcentajePropiedad, atlas.porcentajePropiedad, 'alto', 'porcentaje');
  add('fechaAdquisicion', 'Fecha compra', 'adquisicion', aeat.fechaAdquisicion, atlas.fechaAdquisicion, 'alto', 'fecha');
  add('importeAdquisicion', 'Precio compra', 'adquisicion', aeat.importeAdquisicion, atlas.precioAdquisicion, 'alto', 'moneda');
  add('gastosAdquisicion', 'Gastos adquisición', 'adquisicion', aeat.gastosAdquisicion, atlas.gastosAdquisicion, 'medio', 'moneda');
  add('valorCatastral', 'Valor catastral', 'catastral', aeat.valorCatastral, atlas.valorCatastral, 'alto', 'moneda');
  add('valorCatastralConstruccion', 'VC construcción', 'catastral', aeat.valorCatastralConstruccion, atlas.valorCatastralConstruccion, 'alto', 'moneda');
  add('porcentajeConstruccion', '% construcción', 'catastral', aeat.porcentajeConstruccion, atlas.porcentajeConstruccion, 'alto', 'porcentaje');

  return campos;
}

function isValorVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '' || valor === 0;
}

function valoresIguales(a: unknown, b: unknown, formato: string): boolean {
  if (['moneda', 'numero', 'porcentaje'].includes(formato)) {
    return Math.abs(Number(a) - Number(b)) < 1;
  }

  if (formato === 'fecha') {
    return normalizarFecha(a) === normalizarFecha(b);
  }

  return TEXT_ENCODER.compare(String(a).trim(), String(b).trim()) === 0;
}

function normalizarFecha(value: unknown): string {
  if (!value) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value).trim();
  return parsed.toISOString().slice(0, 10);
}

function generarCamposSoloAeat(aeat: DeclaracionInmueble): CampoReconciliado[] {
  const campos: CampoReconciliado[] = [];

  const add = (
    campo: string,
    label: string,
    seccion: CampoReconciliado['seccion'],
    valor: unknown,
    formato: CampoReconciliado['formato'],
  ) => {
    if (isValorVacio(valor)) return;

    campos.push({
      campo,
      label,
      seccion,
      valorAeat: valor,
      valorAtlas: undefined,
      tipo: 'solo_aeat',
      decision: 'usar_aeat',
      impacto: 'alto',
      formato,
    });
  };

  add('referenciaCatastral', 'Ref. catastral', 'identificacion', aeat.referenciaCatastral, 'texto');
  add('direccion', 'Dirección', 'identificacion', aeat.direccion, 'texto');
  add('fechaAdquisicion', 'Fecha compra', 'adquisicion', aeat.fechaAdquisicion, 'fecha');
  add('importeAdquisicion', 'Precio compra', 'adquisicion', aeat.importeAdquisicion, 'moneda');
  add('gastosAdquisicion', 'Gastos adquisición', 'adquisicion', aeat.gastosAdquisicion, 'moneda');
  add('valorCatastral', 'Valor catastral', 'catastral', aeat.valorCatastral, 'moneda');
  add('valorCatastralConstruccion', 'VC construcción', 'catastral', aeat.valorCatastralConstruccion, 'moneda');
  add('porcentajeConstruccion', '% construcción', 'catastral', aeat.porcentajeConstruccion, 'porcentaje');

  return campos;
}

function reconciliarPrestamos(
  inmueblesAeat: DeclaracionInmueble[],
  prestamosAtlas: Array<{ id: string; inmuebleRef: string; interesesAnuales?: number }>,
  ejercicio: number,
): ReconciliacionPrestamo[] {
  void ejercicio;
  const resultado: ReconciliacionPrestamo[] = [];

  for (const inmueble of inmueblesAeat) {
    if (inmueble.interesesFinanciacion <= 0 || inmueble.esAccesorio) continue;

    const atlas = prestamosAtlas.find((prestamo) => prestamo.inmuebleRef === inmueble.referenciaCatastral);

    resultado.push({
      inmuebleRef: inmueble.referenciaCatastral,
      direccion: inmueble.direccion,
      interesesAeat: inmueble.interesesFinanciacion,
      existeEnAtlas: Boolean(atlas),
      prestamoAtlasId: atlas?.id,
      interesesAtlas: atlas?.interesesAnuales,
      estado: atlas ? 'aceptado' : 'pendiente',
    });
  }

  return resultado;
}

function reconciliarTrabajo(trabajo: DeclaracionTrabajo): ReconciliacionSeccion {
  const campos: CampoReconciliado[] = [];

  if (trabajo.retribucionesDinerarias > 0) {
    campos.push({
      campo: 'retribucionesDinerarias',
      label: 'Retribuciones dinerarias',
      seccion: 'ingresos',
      valorAeat: trabajo.retribucionesDinerarias,
      valorAtlas: undefined,
      tipo: 'solo_aeat',
      decision: 'usar_aeat',
      impacto: 'alto',
      formato: 'moneda',
    });
  }

  if (trabajo.rendimientoNetoReducido > 0) {
    campos.push({
      campo: 'rendimientoNetoReducido',
      label: 'Rendimiento neto reducido',
      seccion: 'resultado',
      valorAeat: trabajo.rendimientoNetoReducido,
      valorAtlas: undefined,
      tipo: 'solo_aeat',
      decision: 'usar_aeat',
      impacto: 'alto',
      formato: 'moneda',
    });
  }

  return { campos, tieneAeat: campos.length > 0, tieneAtlas: false };
}

function reconciliarActividad(actividades: DeclaracionActividad[]): ReconciliacionSeccion {
  const campos: CampoReconciliado[] = actividades.map((actividad) => ({
    campo: `actividad_${actividad.epigrafeIAE}`,
    label: `IAE ${actividad.epigrafeIAE} — Ingresos`,
    seccion: 'ingresos',
    valorAeat: actividad.ingresos,
    valorAtlas: undefined,
    tipo: 'solo_aeat',
    decision: 'usar_aeat',
    impacto: 'medio',
    formato: 'moneda',
  }));

  return { campos, tieneAeat: campos.length > 0, tieneAtlas: false };
}

export async function aplicarReconciliacion(
  reconciliacion: ReconciliacionCompleta,
): Promise<{ actualizados: number; creados: number; errores: string[] }> {
  let actualizados = 0;
  let creados = 0;
  const errores: string[] = [];

  for (const inmueble of reconciliacion.inmuebles) {
    if (inmueble.estado === 'rechazado') continue;

    if (inmueble.tipo === 'solo_aeat' && inmueble.datosAeat) {
      try {
        await crearInmuebleDesdeAeat(inmueble.datosAeat);
        creados += 1;
      } catch (error) {
        errores.push(`Error creando ${inmueble.direccion}: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }

    if ((inmueble.tipo === 'match_parcial' || inmueble.tipo === 'match_exacto') && inmueble.datosAtlas) {
      const camposAActualizar = inmueble.campos.filter((campo) => campo.decision === 'usar_aeat');
      if (camposAActualizar.length === 0) continue;

      try {
        await aplicarCambiosInmueble(inmueble.datosAtlas.id, camposAActualizar);
        actualizados += 1;
      } catch (error) {
        errores.push(`Error actualizando ${inmueble.direccion}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { actualizados, creados, errores };
}

async function aplicarCambiosInmueble(
  inmuebleId: string,
  campos: CampoReconciliado[],
): Promise<void> {
  const { initDB } = await import('./db');
  const db = await initDB();

  const property = await db.get('properties', Number(inmuebleId));
  if (!property) throw new Error(`Inmueble ${inmuebleId} no encontrado`);

  for (const campo of campos) {
    switch (campo.campo) {
      case 'valorCatastral':
        property.fiscalData = { ...property.fiscalData, cadastralValue: toNumber(campo.valorAeat) };
        break;
      case 'valorCatastralConstruccion':
        property.fiscalData = { ...property.fiscalData, constructionCadastralValue: toNumber(campo.valorAeat) };
        break;
      case 'porcentajeConstruccion':
        property.fiscalData = { ...property.fiscalData, constructionPercentage: toNumber(campo.valorAeat) };
        break;
      case 'importeAdquisicion':
        property.acquisitionCosts = { ...property.acquisitionCosts, price: toNumber(campo.valorAeat) };
        break;
      case 'gastosAdquisicion': {
        const otros = property.acquisitionCosts.other ?? [];
        const otrosSinImportacion = otros.filter((item: { concept: string; amount: number }) => item.concept !== 'Importación AEAT');
        property.acquisitionCosts = {
          ...property.acquisitionCosts,
          other: [...otrosSinImportacion, { concept: 'Importación AEAT', amount: toNumber(campo.valorAeat) }],
        };
        break;
      }
      case 'fechaAdquisicion':
        property.purchaseDate = String(campo.valorAeat ?? property.purchaseDate ?? '');
        property.fiscalData = { ...property.fiscalData, acquisitionDate: String(campo.valorAeat ?? '') };
        break;
      case 'referenciaCatastral':
        property.cadastralReference = String(campo.valorAeat ?? '');
        break;
      default:
        break;
    }
  }

  await db.put('properties', property);
}

async function crearInmuebleDesdeAeat(inmueble: DeclaracionInmueble): Promise<number> {
  const { initDB } = await import('./db');
  const db = await initDB();

  const property: Property = {
    alias: construirAlias(inmueble),
    address: inmueble.direccion || inmueble.referenciaCatastral || 'Inmueble importado AEAT',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: inmueble.fechaAdquisicion || new Date().toISOString().slice(0, 10),
    cadastralReference: inmueble.referenciaCatastral || undefined,
    squareMeters: 0,
    bedrooms: 0,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: {
      price: toNumber(inmueble.importeAdquisicion),
      other: inmueble.gastosAdquisicion
        ? [{ concept: 'Importación AEAT', amount: toNumber(inmueble.gastosAdquisicion) }]
        : [],
    },
    documents: [],
    fiscalData: {
      acquisitionDate: inmueble.fechaAdquisicion,
      cadastralValue: inmueble.valorCatastral,
      constructionCadastralValue: inmueble.valorCatastralConstruccion,
      constructionPercentage: inmueble.porcentajeConstruccion,
      housingReduction: inmueble.derechoReduccion,
      isAccessory: inmueble.esAccesorio,
    },
  };

  const propertyId = await db.add('properties', property);
  return Number(propertyId);
}

function construirAlias(inmueble: DeclaracionInmueble): string {
  const direccion = inmueble.direccion?.trim();
  if (direccion) return direccion.slice(0, 80);
  if (inmueble.referenciaCatastral) return `AEAT ${inmueble.referenciaCatastral}`;
  return `Inmueble AEAT ${inmueble.orden}`;
}

function toNumber(valor: unknown): number {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function vincularManualmente(
  inmuebleAeat: DeclaracionInmueble,
  inmuebleAtlasId: string,
): Promise<{ campos: CampoReconciliado[]; inmuebleAtlas: PropiedadReconciliable }> {
  const propiedades = await cargarPropiedadesReconciliables();
  const inmuebleAtlas = propiedades.find((propiedad) => propiedad.id === inmuebleAtlasId);

  if (!inmuebleAtlas) {
    throw new Error('Inmueble ATLAS no encontrado');
  }

  return {
    campos: compararCamposInmueble(inmuebleAeat, inmuebleAtlas),
    inmuebleAtlas,
  };
}

async function cargarPropiedadesReconciliables(): Promise<PropiedadReconciliable[]> {
  const { initDB } = await import('./db');
  const db = await initDB();

  try {
    const todas = await db.getAll('properties');
    return todas.map((property) => mapPropertyToReconciliable(property));
  } catch {
    return [];
  }
}

function mapPropertyToReconciliable(property: Property): PropiedadReconciliable {
  const gastosAdquisicion = [
    property.acquisitionCosts.itp,
    property.acquisitionCosts.iva,
    property.acquisitionCosts.notary,
    property.acquisitionCosts.registry,
    property.acquisitionCosts.management,
    property.acquisitionCosts.psi,
    property.acquisitionCosts.realEstate,
    ...(property.acquisitionCosts.other ?? []).map((item) => item.amount),
  ].reduce<number>((sum, value) => sum + toNumber(value), 0);

  return {
    id: String(property.id),
    referenciaCatastral: property.cadastralReference || '',
    direccion: property.address || property.alias || '',
    estado: property.state || 'activo',
    valorCatastral: property.aeatAmortization?.cadastralValue ?? property.fiscalData?.cadastralValue,
    valorCatastralConstruccion: property.aeatAmortization?.constructionCadastralValue ?? property.fiscalData?.constructionCadastralValue,
    porcentajeConstruccion: property.aeatAmortization?.constructionPercentage ?? property.fiscalData?.constructionPercentage,
    precioAdquisicion: property.aeatAmortization?.onerosoAcquisition?.acquisitionAmount ?? property.acquisitionCosts.price,
    gastosAdquisicion,
    fechaAdquisicion: property.aeatAmortization?.firstAcquisitionDate ?? property.fiscalData?.acquisitionDate ?? property.purchaseDate,
    porcentajePropiedad: 100,
  };
}

async function cargarPrestamosReconciliables(): Promise<Array<{ id: string; inmuebleRef: string; interesesAnuales?: number }>> {
  const { initDB } = await import('./db');
  const db = await initDB();

  try {
    const [prestamos, properties] = await Promise.all([
      db.getAll('prestamos') as Promise<Prestamo[]>,
      db.getAll('properties') as Promise<Property[]>,
    ]);

    const refByPropertyId = new Map(properties.map((property) => [String(property.id), property.cadastralReference || '']));

    return prestamos.map((prestamo) => ({
      id: String(prestamo.id),
      inmuebleRef: prestamo.inmuebleId ? (refByPropertyId.get(prestamo.inmuebleId) || '') : '',
      interesesAnuales: undefined,
    }));
  } catch {
    return [];
  }
}

export const __private__ = {
  normalizarDireccion,
  buscarMatchParcial,
  compararCamposInmueble,
  generarCamposSoloAeat,
  valoresIguales,
  inferirHipotesis,
  calcularEstadisticasReconciliacion,
};
