import type { Contract, Property } from './db';
import { initDB } from './db';
import type {
  DeclaracionActividad,
  DeclaracionIRPF,
  DeclaracionInmueble,
} from '../types/fiscal';
import type { ExtraccionCompleta } from './aeatParserService';
import type { Prestamo } from '../types/prestamos';
import type { PersonalData } from '../types/personal';
import { prestamosService } from './prestamosService';
import { saveContract } from './contractService';
import { declararEjercicio, ejercicioFiscalService } from './ejercicioFiscalService';

// ═══════════════════════════════════════════════════════════════
// TIPOS DEL RESULTADO DE ANÁLISIS
// ═══════════════════════════════════════════════════════════════

export interface ResultadoAnalisis {
  ejercicio: number;
  fechaPresentacion?: string;

  perfil: {
    nif: string;
    nombre: string;
    comunidadAutonoma: string;
    estadoCivil: string;
    fechaNacimiento: string;
    esNuevo: boolean;
    diferencias: Diferencia[];
  };

  inmuebles: {
    nuevos: InmuebleParaCrear[];
    actualizar: InmuebleParaActualizar[];
    coinciden: InmuebleCoincide[];
    soloEnAtlas: InmuebleSoloEnAtlas[];
  };

  prestamos: PrestamoDetectado[];
  contratos: ContratoDetectado[];
  actividades: ActividadDetectada[];

  capitalMobiliario?: {
    intereses: number;
    esNuevo: boolean;
  };

  planPensiones?: {
    aportacionesTrabajador: number;
    contribucionesEmpresariales: number;
    esNuevo: boolean;
  };

  arrastres: {
    gastos0105_0106: ArrastreDetectado[];
    perdidasAhorro: PerdidaDetectada[];
  };

  resumen: {
    totalEntidadesNuevas: number;
    totalActualizaciones: number;
    totalArrastres: number;
    requiereConfirmacion: boolean;
  };

  declaracion: DeclaracionIRPF;
}

export interface Diferencia {
  campo: string;
  labelCampo: string;
  valorAtlas: unknown;
  valorAeat: unknown;
}

export interface InmuebleParaCrear {
  datos: DeclaracionInmueble;
  camposRellenados: string[];
  camposPendientes: string[];
  esAccesorio: boolean;
  principalRef?: string;
}

export interface InmuebleParaActualizar {
  inmuebleIdExistente: string;
  referenciaCatastral: string;
  direccion: string;
  diferencias: Diferencia[];
}

export interface InmuebleCoincide {
  inmuebleIdExistente: string;
  referenciaCatastral: string;
  direccion: string;
}

export interface InmuebleSoloEnAtlas {
  inmuebleIdExistente: string;
  referenciaCatastral: string;
  direccion: string;
  hipotesis: 'vendido' | 'no_arrendado_ese_anio' | 'error' | 'desconocido';
}

export interface PrestamoDetectado {
  inmuebleRef: string;
  direccion: string;
  interesesAnuales: number;
  ejercicio: number;
  yaExisteEnAtlas: boolean;
  prestamoIdExistente?: string;
}

export interface ContratoDetectado {
  inmuebleRef: string;
  direccion: string;
  nifArrendatario: string;
  fechaContrato?: string;
  ingresosAnuales: number;
  diasArrendado: number;
  derechoReduccion: boolean;
  yaExisteEnAtlas: boolean;
  contratoIdExistente?: string;
}

export interface ActividadDetectada {
  tipoActividad: string;
  epigrafeIAE: string;
  modalidad: string;
  ingresos: number;
  gastos: number;
  rendimientoNeto: number;
  yaExisteEnAtlas: boolean;
}

export interface ArrastreDetectado {
  inmuebleRef: string;
  direccion: string;
  ejercicioOrigen: number;
  importePendiente: number;
  importeAplicado: number;
  importeGenerado: number;
}

export interface PerdidaDetectada {
  ejercicioOrigen: number;
  importePendiente: number;
  importeAplicado: number;
  origen: string;
  caducaEjercicio: number;
}

interface PropiedadExistente {
  id: string;
  idNumerico?: number;
  referenciaCatastral: string;
  direccion: string;
  alias: string;
  estado: Property['state'];
  valorCatastral?: number;
  valorCatastralConstruccion?: number;
  porcentajeConstruccion?: number;
  precioAdquisicion?: number;
  gastosAdquisicion?: number;
  fechaAdquisicion?: string;
}

interface PrestamoExistente {
  id: string;
  referenciasRelacionadas: string[];
}

interface ContratoExistente {
  id: string;
  inmuebleRef: string;
  nifArrendatario: string;
}

interface ActividadExistente {
  epigrafeIAE: string;
}

interface PerfilExistente {
  nif: string;
  nombre: string;
  comunidadAutonoma: string;
  estadoCivil?: string;
}

const EMPTY_ADDRESS = {
  postalCode: '',
  province: '',
  municipality: '',
  ccaa: '',
};

function normalizeRef(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

function normalizeNif(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function splitAddress(address: string): typeof EMPTY_ADDRESS {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const cityPart = parts[parts.length - 1] ?? '';
  const postalMatch = cityPart.match(/(\d{5})/);
  const postalCode = postalMatch?.[1] ?? '';
  const municipality = cityPart.replace(postalCode, '').trim() || '';

  return {
    postalCode,
    province: municipality,
    municipality,
    ccaa: '',
  };
}

function normalizeDbKey(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function getPropertyRefs(property: Property): string[] {
  return [
    property.cadastralReference,
    property.fiscalData?.accessoryData?.cadastralReference,
    property.alias,
    property.address,
    property.id != null ? String(property.id) : undefined,
  ]
    .map((value) => normalizeRef(value))
    .filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: ANALIZAR
// ═══════════════════════════════════════════════════════════════

export async function analizarDeclaracion(
  extraccion: ExtraccionCompleta,
): Promise<ResultadoAnalisis> {
  const ejercicio = extraccion.meta.ejercicio;
  const decl = extraccion.declaracion;

  const propiedadesExistentes = await cargarPropiedadesExistentes();
  const prestamosExistentes = await cargarPrestamosExistentes();
  const contratosExistentes = await cargarContratosExistentes();
  const perfilExistente = await cargarPerfilExistente();
  const actividadesExistentes = await cargarActividadesExistentes();

  const perfil = analizarPerfil(decl, perfilExistente);
  const inmuebles = analizarInmuebles(decl.inmuebles, propiedadesExistentes);
  const prestamos = analizarPrestamos(decl.inmuebles, prestamosExistentes, ejercicio);
  const contratos = analizarContratos(decl.inmuebles, contratosExistentes);
  const actividades = analizarActividades(decl.actividades, actividadesExistentes);
  const arrastres = analizarArrastres(extraccion);

  const capitalMobiliario = decl.capitalMobiliario.interesesCuentas > 0
    ? { intereses: decl.capitalMobiliario.interesesCuentas, esNuevo: true }
    : undefined;

  const planPensiones = decl.planPensiones.totalConDerecho > 0
    ? {
        aportacionesTrabajador: decl.planPensiones.aportacionesTrabajador,
        contribucionesEmpresariales: decl.planPensiones.contribucionesEmpresariales,
        esNuevo: true,
      }
    : undefined;

  const totalEntidadesNuevas =
    inmuebles.nuevos.length
    + prestamos.filter((item) => !item.yaExisteEnAtlas).length
    + contratos.filter((item) => !item.yaExisteEnAtlas).length
    + actividades.filter((item) => !item.yaExisteEnAtlas).length;

  const totalActualizaciones = inmuebles.actualizar.length + perfil.diferencias.length;
  const totalArrastres = arrastres.gastos0105_0106.length + arrastres.perdidasAhorro.length;

  return {
    ejercicio,
    fechaPresentacion: extraccion.meta.fechaPresentacion,
    perfil,
    inmuebles,
    prestamos,
    contratos,
    actividades,
    capitalMobiliario,
    planPensiones,
    arrastres,
    resumen: {
      totalEntidadesNuevas,
      totalActualizaciones,
      totalArrastres,
      requiereConfirmacion: totalEntidadesNuevas > 0 || totalActualizaciones > 0 || totalArrastres > 0,
    },
    declaracion: decl,
  };
}

export async function analizarDeclaracionParaOnboarding(
  extraccion: ExtraccionCompleta,
): Promise<ResultadoAnalisis> {
  return analizarDeclaracion(extraccion);
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISIS DE INMUEBLES
// ═══════════════════════════════════════════════════════════════

function analizarInmuebles(
  inmueblesDecl: DeclaracionInmueble[],
  propiedadesExistentes: PropiedadExistente[],
): ResultadoAnalisis['inmuebles'] {
  const nuevos: InmuebleParaCrear[] = [];
  const actualizar: InmuebleParaActualizar[] = [];
  const coinciden: InmuebleCoincide[] = [];
  const refsEnDeclaracion = new Set<string>();

  for (const inmDecl of inmueblesDecl) {
    const ref = normalizeRef(inmDecl.referenciaCatastral);
    if (!ref) continue;
    refsEnDeclaracion.add(ref);

    const existente = propiedadesExistentes.find((item) => normalizeRef(item.referenciaCatastral) === ref);

    if (!existente) {
      nuevos.push({
        datos: inmDecl,
        esAccesorio: inmDecl.esAccesorio,
        principalRef: inmDecl.refCatastralPrincipal,
        camposRellenados: detectarCamposRellenados(inmDecl),
        camposPendientes: detectarCamposPendientes(inmDecl),
      });
      continue;
    }

    const diferencias = compararInmueble(inmDecl, existente);
    if (diferencias.length === 0) {
      coinciden.push({
        inmuebleIdExistente: existente.id,
        referenciaCatastral: inmDecl.referenciaCatastral,
        direccion: existente.direccion || inmDecl.direccion,
      });
      continue;
    }

    actualizar.push({
      inmuebleIdExistente: existente.id,
      referenciaCatastral: inmDecl.referenciaCatastral,
      direccion: existente.direccion || inmDecl.direccion,
      diferencias,
    });
  }

  const soloEnAtlas = propiedadesExistentes
    .filter((item) => {
      const ref = normalizeRef(item.referenciaCatastral);
      return ref && !refsEnDeclaracion.has(ref);
    })
    .map((item) => ({
      inmuebleIdExistente: item.id,
      referenciaCatastral: item.referenciaCatastral,
      direccion: item.direccion || item.alias,
      hipotesis: item.estado === 'vendido' ? 'vendido' as const : 'desconocido' as const,
    }));

  return { nuevos, actualizar, coinciden, soloEnAtlas };
}

function compararInmueble(
  decl: DeclaracionInmueble,
  existente: PropiedadExistente,
): Diferencia[] {
  const diferencias: Diferencia[] = [];

  const comparar = (campo: string, labelCampo: string, valorAeat: unknown, valorAtlas: unknown) => {
    if (valorAeat === undefined || valorAeat === null || valorAeat === '') return;

    if (typeof valorAeat === 'number' && valorAeat === 0) return;

    if (valorAtlas === undefined || valorAtlas === null || valorAtlas === '' || valorAtlas === 0) {
      diferencias.push({ campo, labelCampo, valorAtlas: '—', valorAeat });
      return;
    }

    if (typeof valorAeat === 'number' && typeof valorAtlas === 'number') {
      if (Math.abs(valorAeat - valorAtlas) > 1) {
        diferencias.push({ campo, labelCampo, valorAtlas, valorAeat });
      }
      return;
    }

    if (String(valorAeat) !== String(valorAtlas)) {
      diferencias.push({ campo, labelCampo, valorAtlas, valorAeat });
    }
  };

  comparar('valorCatastral', 'Valor catastral', decl.valorCatastral, existente.valorCatastral);
  comparar('valorCatastralConstruccion', 'VC construcción', decl.valorCatastralConstruccion, existente.valorCatastralConstruccion);
  comparar('porcentajeConstruccion', '% construcción', decl.porcentajeConstruccion, existente.porcentajeConstruccion);
  comparar('importeAdquisicion', 'Precio compra', decl.importeAdquisicion, existente.precioAdquisicion);
  comparar('gastosAdquisicion', 'Gastos adquisición', decl.gastosAdquisicion, existente.gastosAdquisicion);
  comparar('fechaAdquisicion', 'Fecha compra', decl.fechaAdquisicion, existente.fechaAdquisicion);

  return diferencias;
}

function detectarCamposRellenados(inm: DeclaracionInmueble): string[] {
  const campos: string[] = [];
  if (inm.referenciaCatastral) campos.push('Referencia catastral');
  if (inm.direccion) campos.push('Dirección');
  if (inm.valorCatastral) campos.push('Valor catastral');
  if (inm.valorCatastralConstruccion) campos.push('VC construcción');
  if (inm.porcentajeConstruccion) campos.push('% construcción');
  if (inm.importeAdquisicion) campos.push('Precio compra');
  if (inm.gastosAdquisicion) campos.push('Gastos adquisición');
  if (inm.fechaAdquisicion) campos.push('Fecha adquisición');
  if (inm.porcentajePropiedad) campos.push('% propiedad');
  if (inm.nifArrendatario1) campos.push('NIF arrendatario');
  if (inm.fechaContrato) campos.push('Fecha contrato');
  if (inm.interesesFinanciacion > 0) campos.push('Intereses financiación');
  return campos;
}

function detectarCamposPendientes(inm: DeclaracionInmueble): string[] {
  const pendientes = ['Alias / nombre visible', 'Metros', 'Habitaciones', 'Cuenta bancaria asociada', 'Documentos'];
  if (!inm.nifArrendatario1 && (inm.uso === 'arrendamiento' || inm.uso === 'mixto')) pendientes.push('NIF arrendatario');
  return pendientes;
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISIS DE PRÉSTAMOS / CONTRATOS / ACTIVIDADES / ARRASTRES
// ═══════════════════════════════════════════════════════════════

function analizarPrestamos(
  inmueblesDecl: DeclaracionInmueble[],
  prestamosExistentes: PrestamoExistente[],
  ejercicio: number,
): PrestamoDetectado[] {
  return inmueblesDecl
    .filter((inm) => inm.interesesFinanciacion > 0 && !inm.esAccesorio && Boolean(normalizeRef(inm.referenciaCatastral)))
    .map((inm) => {
      const ref = normalizeRef(inm.referenciaCatastral);
      const existente = prestamosExistentes.find((item) => item.referenciasRelacionadas.includes(ref));
      return {
        inmuebleRef: inm.referenciaCatastral,
        direccion: inm.direccion,
        interesesAnuales: inm.interesesFinanciacion,
        ejercicio,
        yaExisteEnAtlas: Boolean(existente),
        prestamoIdExistente: existente?.id,
      };
    });
}

function analizarContratos(
  inmueblesDecl: DeclaracionInmueble[],
  contratosExistentes: ContratoExistente[],
): ContratoDetectado[] {
  return inmueblesDecl
    .filter((inm) => !inm.esAccesorio)
    .filter((inm) => inm.uso === 'arrendamiento' || inm.uso === 'mixto')
    .filter((inm) => Boolean(inm.nifArrendatario1) || inm.ingresosIntegros > 0)
    .map((inm) => {
      const ref = normalizeRef(inm.referenciaCatastral);
      const nif = normalizeNif(inm.nifArrendatario1);
      const existente = contratosExistentes.find((item) => normalizeRef(item.inmuebleRef) === ref && normalizeNif(item.nifArrendatario) === nif);

      return {
        inmuebleRef: inm.referenciaCatastral,
        direccion: inm.direccion,
        nifArrendatario: inm.nifArrendatario1 || '',
        fechaContrato: inm.fechaContrato,
        ingresosAnuales: inm.ingresosIntegros,
        diasArrendado: inm.diasArrendado,
        derechoReduccion: inm.derechoReduccion,
        yaExisteEnAtlas: Boolean(existente),
        contratoIdExistente: existente?.id,
      };
    });
}

function analizarActividades(
  actividadesDecl: DeclaracionActividad[],
  actividadesExistentes: ActividadExistente[],
): ActividadDetectada[] {
  return actividadesDecl.map((actividad) => {
    const existente = actividadesExistentes.find((item) => item.epigrafeIAE === actividad.epigrafeIAE);
    return {
      tipoActividad: actividad.tipoActividad,
      epigrafeIAE: actividad.epigrafeIAE,
      modalidad: actividad.modalidad,
      ingresos: actividad.ingresos,
      gastos: actividad.gastos,
      rendimientoNeto: actividad.rendimientoNeto,
      yaExisteEnAtlas: Boolean(existente),
    };
  });
}

function analizarArrastres(extraccion: ExtraccionCompleta): ResultadoAnalisis['arrastres'] {
  return {
    gastos0105_0106: extraccion.arrastres.gastos0105_0106.map((item) => ({
      inmuebleRef: item.referenciaCatastral,
      direccion: '',
      ejercicioOrigen: item.ejercicioOrigen || extraccion.meta.ejercicio,
      importePendiente: item.pendienteFuturo,
      importeAplicado: item.aplicadoEstaDeclaracion,
      importeGenerado: item.generadoEsteEjercicio,
    })),
    perdidasAhorro: extraccion.arrastres.perdidasAhorro.map((item) => ({
      ejercicioOrigen: item.ejercicioOrigen,
      importePendiente: item.pendienteFuturo,
      importeAplicado: item.aplicado,
      origen: `perdidas_${item.tipo}_${item.ejercicioOrigen}`,
      caducaEjercicio: item.ejercicioOrigen + 4,
    })),
  };
}

function analizarPerfil(
  decl: DeclaracionIRPF,
  perfilExistente: PerfilExistente | null,
): ResultadoAnalisis['perfil'] {
  const p = decl.personal || {};
  const diferencias: Diferencia[] = [];

  if (perfilExistente) {
    if (p.nombre && p.nombre !== perfilExistente.nombre) {
      diferencias.push({
        campo: 'nombre',
        labelCampo: 'Nombre',
        valorAtlas: perfilExistente.nombre || '—',
        valorAeat: p.nombre,
      });
    }

    if (p.comunidadAutonoma && p.comunidadAutonoma !== perfilExistente.comunidadAutonoma) {
      diferencias.push({
        campo: 'comunidadAutonoma',
        labelCampo: 'Comunidad autónoma',
        valorAtlas: perfilExistente.comunidadAutonoma || '—',
        valorAeat: p.comunidadAutonoma,
      });
    }

    if (p.estadoCivil && p.estadoCivil !== perfilExistente.estadoCivil) {
      diferencias.push({
        campo: 'estadoCivil',
        labelCampo: 'Estado civil',
        valorAtlas: perfilExistente.estadoCivil || '—',
        valorAeat: p.estadoCivil,
      });
    }
  }

  return {
    nif: p.nif || '',
    nombre: p.nombre || '',
    comunidadAutonoma: p.comunidadAutonoma || '',
    estadoCivil: p.estadoCivil || '',
    fechaNacimiento: p.fechaNacimiento || '',
    esNuevo: !perfilExistente,
    diferencias,
  };
}

// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: EJECUTAR
// ═══════════════════════════════════════════════════════════════

export interface OpcionesEjecucion {
  crearInmueblesNuevos: boolean;
  actualizarInmueblesExistentes: boolean;
  crearPrestamos: boolean;
  crearContratos: boolean;
  importarArrastres: boolean;
  guardarDeclaracion: boolean;
}

export interface ResumenEjecucion {
  exito: boolean;
  inmueblesCreados: number;
  inmueblesActualizados: number;
  prestamosCreados: number;
  contratosCreados: number;
  arrastresImportados: number;
  declaracionGuardada: boolean;
  inmuebleIdsCreados: number[];
  errores: string[];
}

export async function ejecutarImportacion(
  resultado: ResultadoAnalisis,
  opciones: OpcionesEjecucion,
): Promise<ResumenEjecucion> {
  const resumen: ResumenEjecucion = {
    exito: true,
    inmueblesCreados: 0,
    inmueblesActualizados: 0,
    prestamosCreados: 0,
    contratosCreados: 0,
    arrastresImportados: 0,
    declaracionGuardada: false,
    inmuebleIdsCreados: [],
    errores: [],
  };

  const refsAIds = new Map<string, number>();
  const propiedadesExistentes = await cargarPropiedadesExistentes();
  propiedadesExistentes.forEach((item) => {
    if (item.idNumerico != null) refsAIds.set(normalizeRef(item.referenciaCatastral), item.idNumerico);
  });

  try {
    if (opciones.crearInmueblesNuevos) {
      const principales = resultado.inmuebles.nuevos.filter((item) => !item.esAccesorio);
      const accesorios = resultado.inmuebles.nuevos.filter((item) => item.esAccesorio);

      for (const inmueble of principales) {
        try {
          const id = await crearInmuebleDesdeDeclaracion(inmueble.datos);
          refsAIds.set(normalizeRef(inmueble.datos.referenciaCatastral), id);
          resumen.inmueblesCreados += 1;
          resumen.inmuebleIdsCreados.push(id);
        } catch (error) {
          resumen.errores.push(`Error creando ${inmueble.datos.direccion}: ${String(error)}`);
        }
      }

      for (const inmueble of accesorios) {
        try {
          const principalId = inmueble.principalRef ? refsAIds.get(normalizeRef(inmueble.principalRef)) : undefined;
          const id = await crearInmuebleDesdeDeclaracion(inmueble.datos, principalId);
          refsAIds.set(normalizeRef(inmueble.datos.referenciaCatastral), id);
          resumen.inmueblesCreados += 1;
          resumen.inmuebleIdsCreados.push(id);
        } catch (error) {
          resumen.errores.push(`Error creando accesorio ${inmueble.datos.referenciaCatastral}: ${String(error)}`);
        }
      }
    }

    if (opciones.actualizarInmueblesExistentes) {
      for (const inmueble of resultado.inmuebles.actualizar) {
        try {
          await actualizarInmuebleDesdeDeclaracion(inmueble);
          resumen.inmueblesActualizados += 1;
          if (inmueble.inmuebleIdExistente) {
            const numId = Number(inmueble.inmuebleIdExistente);
            if (!Number.isNaN(numId)) resumen.inmuebleIdsCreados.push(numId);
          }
        } catch (error) {
          resumen.errores.push(`Error actualizando ${inmueble.direccion}: ${String(error)}`);
        }
      }
    }

    if (opciones.crearPrestamos) {
      for (const prestamo of resultado.prestamos) {
        if (prestamo.yaExisteEnAtlas) continue;
        try {
          await crearPrestamoDesdeDeclaracion(prestamo, refsAIds.get(normalizeRef(prestamo.inmuebleRef)));
          resumen.prestamosCreados += 1;
        } catch (error) {
          resumen.errores.push(`Error creando préstamo ${prestamo.inmuebleRef}: ${String(error)}`);
        }
      }
    }

    if (opciones.crearContratos) {
      for (const contrato of resultado.contratos) {
        if (contrato.yaExisteEnAtlas) continue;
        try {
          await crearContratoDesdeDeclaracion(contrato, refsAIds.get(normalizeRef(contrato.inmuebleRef)));
          resumen.contratosCreados += 1;
        } catch (error) {
          resumen.errores.push(`Error creando contrato ${contrato.nifArrendatario || contrato.inmuebleRef}: ${String(error)}`);
        }
      }
    }

    if (opciones.guardarDeclaracion) {
      try {
        await declararEjercicio(
          resultado.ejercicio,
          resultado.declaracion,
          'pdf_importado',
          resultado.fechaPresentacion,
        );
        resumen.declaracionGuardada = true;
      } catch (error) {
        resumen.errores.push(`Error guardando declaración: ${String(error)}`);
      }
    }

    if (opciones.importarArrastres) {
      try {
        resumen.arrastresImportados = await importarArrastresDesdeDeclaracion(resultado);
      } catch (error) {
        resumen.errores.push(`Error importando arrastres: ${String(error)}`);
      }
    }

    resumen.exito = resumen.errores.length === 0;
  } catch (error) {
    resumen.exito = false;
    resumen.errores.push(`Error general: ${String(error)}`);
  }

  return resumen;
}

// ═══════════════════════════════════════════════════════════════
// CREACIÓN DE ENTIDADES
// ═══════════════════════════════════════════════════════════════

async function crearInmuebleDesdeDeclaracion(
  datos: DeclaracionInmueble,
  principalPropertyId?: number,
): Promise<number> {
  const db = await initDB();
  const addressMeta = splitAddress(datos.direccion);

  const property: Omit<Property, 'id'> = {
    alias: datos.direccion || `Inmueble ${datos.orden}`,
    address: datos.direccion || `Inmueble ${datos.orden}`,
    postalCode: addressMeta.postalCode,
    province: addressMeta.province,
    municipality: addressMeta.municipality,
    ccaa: addressMeta.ccaa,
    purchaseDate: datos.fechaAdquisicion || '',
    cadastralReference: datos.referenciaCatastral || undefined,
    squareMeters: 0,
    bedrooms: 0,
    bathrooms: 0,
    transmissionRegime: 'usada',
    state: 'activo',
    notes: 'Creado desde importación AEAT.',
    documents: [],
    acquisitionCosts: {
      price: datos.importeAdquisicion || 0,
      notary: 0,
      registry: 0,
      management: 0,
      other: datos.gastosAdquisicion
        ? [{ concept: 'Gastos importados AEAT', amount: datos.gastosAdquisicion }]
        : [],
    },
    fiscalData: {
      cadastralValue: datos.valorCatastral || undefined,
      constructionCadastralValue: datos.valorCatastralConstruccion || undefined,
      constructionPercentage: datos.porcentajeConstruccion || undefined,
      acquisitionDate: datos.fechaAdquisicion || undefined,
      contractUse: datos.uso === 'arrendamiento' || datos.uso === 'mixto' ? 'vivienda-habitual' : 'otros',
      housingReduction: datos.derechoReduccion || false,
      isAccessory: datos.esAccesorio || false,
      mainPropertyId: principalPropertyId,
      accessoryData: datos.esAccesorio ? {
        cadastralReference: datos.referenciaCatastral,
        acquisitionDate: datos.fechaAdquisicion || '',
        cadastralValue: datos.valorCatastral || 0,
        constructionCadastralValue: datos.valorCatastralConstruccion || 0,
      } : undefined,
    },
    aeatAmortization: {
      acquisitionType: datos.tipoAdquisicion || 'onerosa',
      firstAcquisitionDate: datos.fechaAdquisicion || '',
      cadastralValue: datos.valorCatastral || 0,
      constructionCadastralValue: datos.valorCatastralConstruccion || 0,
      constructionPercentage: datos.porcentajeConstruccion || 0,
      onerosoAcquisition: {
        acquisitionAmount: datos.importeAdquisicion || 0,
        acquisitionExpenses: datos.gastosAdquisicion || 0,
      },
    },
  };

  const id = await db.add('properties', property);
  return Number(id);
}

async function actualizarInmuebleDesdeDeclaracion(actualizacion: InmuebleParaActualizar): Promise<void> {
  const db = await initDB();
  const property = await db.get('properties', normalizeDbKey(actualizacion.inmuebleIdExistente));

  if (!property) {
    throw new Error(`Inmueble ${actualizacion.inmuebleIdExistente} no encontrado`);
  }

  const next: Property = {
    ...property,
    fiscalData: { ...(property.fiscalData || {}) },
    acquisitionCosts: { ...(property.acquisitionCosts || { price: 0 }) },
    aeatAmortization: property.aeatAmortization
      ? { ...property.aeatAmortization, onerosoAcquisition: { ...(property.aeatAmortization.onerosoAcquisition || { acquisitionAmount: 0, acquisitionExpenses: 0 }) } }
      : undefined,
  };

  for (const diff of actualizacion.diferencias) {
    switch (diff.campo) {
      case 'valorCatastral':
        next.fiscalData = { ...(next.fiscalData || {}), cadastralValue: Number(diff.valorAeat) };
        if (next.aeatAmortization) next.aeatAmortization.cadastralValue = Number(diff.valorAeat);
        break;
      case 'valorCatastralConstruccion':
        next.fiscalData = { ...(next.fiscalData || {}), constructionCadastralValue: Number(diff.valorAeat) };
        if (next.aeatAmortization) next.aeatAmortization.constructionCadastralValue = Number(diff.valorAeat);
        break;
      case 'porcentajeConstruccion':
        next.fiscalData = { ...(next.fiscalData || {}), constructionPercentage: Number(diff.valorAeat) };
        if (next.aeatAmortization) next.aeatAmortization.constructionPercentage = Number(diff.valorAeat);
        break;
      case 'importeAdquisicion':
        next.acquisitionCosts = { ...(next.acquisitionCosts || { price: 0 }), price: Number(diff.valorAeat) };
        if (next.aeatAmortization?.onerosoAcquisition) next.aeatAmortization.onerosoAcquisition.acquisitionAmount = Number(diff.valorAeat);
        break;
      case 'gastosAdquisicion': {
        const amount = Number(diff.valorAeat);
        next.acquisitionCosts = {
          ...(next.acquisitionCosts || { price: 0 }),
          other: [{ concept: 'Gastos adquisición importados AEAT', amount }],
        };
        if (next.aeatAmortization?.onerosoAcquisition) next.aeatAmortization.onerosoAcquisition.acquisitionExpenses = amount;
        break;
      }
      case 'fechaAdquisicion':
        next.purchaseDate = String(diff.valorAeat);
        next.fiscalData = { ...(next.fiscalData || {}), acquisitionDate: String(diff.valorAeat) };
        if (next.aeatAmortization) next.aeatAmortization.firstAcquisitionDate = String(diff.valorAeat);
        break;
      default:
        break;
    }
  }

  await db.put('properties', next);
}

async function crearPrestamoDesdeDeclaracion(pres: PrestamoDetectado, inmuebleId?: number): Promise<void> {
  const prestamo: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
    ambito: 'INMUEBLE',
    inmuebleId: inmuebleId != null ? String(inmuebleId) : undefined,
    nombre: `Préstamo ${pres.direccion.slice(0, 30)}`,
    principalInicial: 0,
    principalVivo: 0,
    fechaFirma: `${pres.ejercicio}-01-01`,
    fechaPrimerCargo: `${pres.ejercicio}-01-01`,
    plazoMesesTotal: 1,
    diaCargoMes: 1,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    sistema: 'FRANCES',
    tipoNominalAnualFijo: 0,
    carencia: 'NINGUNA',
    cuentaCargoId: '',
    cuotasPagadas: 0,
    estado: 'vivo',
    origenCreacion: 'IMPORTACION',
    activo: true,
    finalidad: 'ADQUISICION',
    cobroMesVencido: false,
    interesesAnualesDeclarados: { [pres.ejercicio]: pres.interesesAnuales },
  } as Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> & { interesesAnualesDeclarados: Record<number, number> };

  await prestamosService.createPrestamo(prestamo as unknown as Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>);
}

async function crearContratoDesdeDeclaracion(cont: ContratoDetectado, inmuebleId?: number): Promise<void> {
  if (inmuebleId == null) {
    throw new Error('No se ha podido resolver el inmueble del contrato');
  }

  const db = await initDB();
  const accounts = await db.getAll('accounts');
  const firstActiveAccount = accounts.find((account: any) => account.isActive ?? account.activa ?? true);
  const fechaInicio = cont.fechaContrato || `${new Date().getFullYear()}-01-01`;
  const fechaFin = `${new Date(fechaInicio).getFullYear() + 1}-12-31`;
  const rentaMensual = cont.ingresosAnuales > 0 ? Math.max(0, Math.round(cont.ingresosAnuales / 12)) : 0;

  await saveContract({
    inmuebleId,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: {
      nombre: '',
      apellidos: '',
      dni: cont.nifArrendatario,
      telefono: '',
      email: '',
    },
    fechaInicio,
    fechaFin,
    rentaMensual,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: rentaMensual,
    fianzaEstado: 'retenida',
    cuentaCobroId: Number(firstActiveAccount?.id || 0),
    estadoContrato: 'activo',
    documentoContrato: {
      plantilla: 'habitual',
      incluirInventario: false,
      incluirCertificadoEnergetico: false,
    },
    firma: {
      metodo: 'manual',
      emails: [],
      enviarCopiaPropietario: false,
      estado: 'borrador',
    },
    propertyId: inmuebleId,
    tenant: {
      name: cont.nifArrendatario,
      nif: cont.nifArrendatario,
      email: '',
    },
    startDate: fechaInicio,
    endDate: fechaFin,
    monthlyRent: rentaMensual,
    paymentDay: 1,
    periodicity: 'monthly',
    status: 'active',
    documents: [],
  });
}

async function importarArrastresDesdeDeclaracion(resultado: ResultadoAnalisis): Promise<number> {
  const ejercicio = await ejercicioFiscalService.getOrCreateEjercicio(resultado.ejercicio, 'declarado');
  const next = {
    ...ejercicio,
    arrastresGenerados: {
      ...ejercicio.arrastresGenerados,
      gastos0105_0106: [...ejercicio.arrastresGenerados.gastos0105_0106],
      perdidasPatrimonialesAhorro: [...ejercicio.arrastresGenerados.perdidasPatrimonialesAhorro],
      amortizacionesAcumuladas: [...ejercicio.arrastresGenerados.amortizacionesAcumuladas],
      porInmueble: [...(ejercicio.arrastresGenerados.porInmueble ?? ejercicio.arrastresGenerados.gastos0105_0106)],
      porAnio: [...(ejercicio.arrastresGenerados.porAnio ?? ejercicio.arrastresGenerados.perdidasPatrimonialesAhorro)],
    },
    updatedAt: new Date().toISOString(),
  };

  let count = 0;

  for (const gasto of resultado.arrastres.gastos0105_0106) {
    if (gasto.importePendiente <= 0 && gasto.importeGenerado <= 0) continue;

    const existe = next.arrastresGenerados.gastos0105_0106.some((item) =>
      normalizeRef(item.referenciaCatastral) === normalizeRef(gasto.inmuebleRef)
      && item.ejercicioOrigen === gasto.ejercicioOrigen
      && Math.abs(item.importePendiente - (gasto.importePendiente || gasto.importeGenerado)) < 0.01,
    );

    if (existe) continue;

    const record = {
      referenciaCatastral: gasto.inmuebleRef,
      ejercicioOrigen: gasto.ejercicioOrigen,
      importeOriginal: gasto.importePendiente || gasto.importeGenerado,
      importeAplicado: gasto.importeAplicado,
      importePendiente: gasto.importePendiente || gasto.importeGenerado,
      caducaEjercicio: gasto.ejercicioOrigen + 4,
    };

    next.arrastresGenerados.gastos0105_0106.push(record);
    next.arrastresGenerados.porInmueble?.push(record);
    count += 1;
  }

  for (const perdida of resultado.arrastres.perdidasAhorro) {
    if (perdida.importePendiente <= 0) continue;

    const existe = next.arrastresGenerados.perdidasPatrimonialesAhorro.some((item) =>
      item.ejercicioOrigen === perdida.ejercicioOrigen
      && Math.abs(item.importePendiente - perdida.importePendiente) < 0.01,
    );

    if (existe) continue;

    const record = {
      ejercicioOrigen: perdida.ejercicioOrigen,
      importeOriginal: perdida.importePendiente,
      importeAplicado: perdida.importeAplicado,
      importePendiente: perdida.importePendiente,
      caducaEjercicio: perdida.caducaEjercicio,
      origen: perdida.origen,
    };

    next.arrastresGenerados.perdidasPatrimonialesAhorro.push(record);
    next.arrastresGenerados.porAnio?.push(record);
    count += 1;
  }

  await ejercicioFiscalService.saveEjercicio(next);
  return count;
}

// ═══════════════════════════════════════════════════════════════
// CARGADORES DE DATOS EXISTENTES
// ═══════════════════════════════════════════════════════════════

async function cargarPropiedadesExistentes(): Promise<PropiedadExistente[]> {
  try {
    const db = await initDB();
    const properties = await db.getAll('properties') as Property[];
    return properties.map((property) => ({
      id: String(property.id ?? ''),
      idNumerico: property.id,
      referenciaCatastral: property.cadastralReference || property.fiscalData?.accessoryData?.cadastralReference || '',
      direccion: property.address || '',
      alias: property.alias || '',
      estado: property.state,
      valorCatastral: property.fiscalData?.cadastralValue || property.aeatAmortization?.cadastralValue,
      valorCatastralConstruccion: property.fiscalData?.constructionCadastralValue || property.aeatAmortization?.constructionCadastralValue,
      porcentajeConstruccion: property.fiscalData?.constructionPercentage || property.aeatAmortization?.constructionPercentage,
      precioAdquisicion: property.acquisitionCosts?.price,
      gastosAdquisicion: property.aeatAmortization?.onerosoAcquisition?.acquisitionExpenses
        || property.acquisitionCosts?.other?.reduce((sum, item) => sum + (item.amount || 0), 0),
      fechaAdquisicion: property.fiscalData?.acquisitionDate || property.purchaseDate,
    }));
  } catch {
    return [];
  }
}

async function cargarPrestamosExistentes(): Promise<PrestamoExistente[]> {
  try {
    const db = await initDB();
    const [prestamos, properties] = await Promise.all([
      db.getAll('prestamos') as Promise<Prestamo[]>,
      db.getAll('properties') as Promise<Property[]>,
    ]);

    const propertiesById = new Map(properties.map((property) => [String(property.id), property]));

    return prestamos.map((prestamo) => {
      const referencias = new Set<string>();

      const property = prestamo.inmuebleId ? propertiesById.get(String(prestamo.inmuebleId)) : undefined;
      if (property) {
        getPropertyRefs(property).forEach((value) => referencias.add(value));
      }

      if (prestamo.inmuebleId) referencias.add(normalizeRef(prestamo.inmuebleId));
      if (prestamo.afectacionesInmueble?.length) {
        prestamo.afectacionesInmueble.forEach((afectacion) => {
          referencias.add(normalizeRef(afectacion.inmuebleId));
          const affected = propertiesById.get(String(afectacion.inmuebleId));
          if (affected) getPropertyRefs(affected).forEach((value) => referencias.add(value));
        });
      }

      return {
        id: prestamo.id,
        referenciasRelacionadas: [...referencias].filter(Boolean),
      };
    });
  } catch {
    return [];
  }
}

async function cargarContratosExistentes(): Promise<ContratoExistente[]> {
  try {
    const db = await initDB();
    const [contracts, properties] = await Promise.all([
      db.getAll('contracts') as Promise<Contract[]>,
      db.getAll('properties') as Promise<Property[]>,
    ]);

    const propertiesById = new Map(properties.map((property) => [property.id, property]));

    return contracts.map((contract) => ({
      id: String(contract.id ?? ''),
      inmuebleRef: propertiesById.get(contract.inmuebleId)?.cadastralReference || String(contract.inmuebleId),
      nifArrendatario: contract.inquilino?.dni || contract.tenant?.nif || '',
    }));
  } catch {
    return [];
  }
}

async function cargarActividadesExistentes(): Promise<ActividadExistente[]> {
  try {
    const db = await initDB();
    const autonomos = await db.getAll('autonomos') as Array<{ epigrafeIAE?: string; activo?: boolean }>;
    return autonomos
      .filter((item) => Boolean(item.epigrafeIAE))
      .filter((item) => item.activo !== false)
      .map((item) => ({ epigrafeIAE: item.epigrafeIAE || '' }));
  } catch {
    return [];
  }
}

async function cargarPerfilExistente(): Promise<PerfilExistente | null> {
  try {
    const db = await initDB();
    const perfiles = await db.getAll('personalData') as PersonalData[];
    const perfil = perfiles[0];
    if (!perfil) return null;

    return {
      nif: perfil.dni || '',
      nombre: [perfil.nombre, perfil.apellidos].filter(Boolean).join(' '),
      comunidadAutonoma: perfil.comunidadAutonoma || '',
      estadoCivil: perfil.situacionPersonal || '',
    };
  } catch {
    return null;
  }
}

export function describirResumenAcciones(resultado: ResultadoAnalisis): string[] {
  const lines: string[] = [];

  if (resultado.inmuebles.nuevos.length > 0) {
    lines.push(`${resultado.inmuebles.nuevos.length} inmuebles nuevos listos para crear.`);
  }
  if (resultado.inmuebles.actualizar.length > 0) {
    lines.push(`${resultado.inmuebles.actualizar.length} inmuebles con diferencias para actualizar.`);
  }
  if (resultado.prestamos.filter((item) => !item.yaExisteEnAtlas).length > 0) {
    lines.push(`${resultado.prestamos.filter((item) => !item.yaExisteEnAtlas).length} préstamos parciales detectados.`);
  }
  if (resultado.contratos.filter((item) => !item.yaExisteEnAtlas).length > 0) {
    lines.push(`${resultado.contratos.filter((item) => !item.yaExisteEnAtlas).length} contratos listos para crear.`);
  }
  if (resultado.arrastres.gastos0105_0106.length + resultado.arrastres.perdidasAhorro.length > 0) {
    lines.push(`${resultado.resumen.totalArrastres} arrastres fiscales listos para importar.`);
  }
  if (lines.length === 0) {
    lines.push('No hay entidades nuevas; solo se guardará la declaración si el usuario lo confirma.');
  }

  return lines;
}

export function describirDiferencia(diff: Diferencia): string {
  if (typeof diff.valorAeat === 'number') {
    return `${diff.labelCampo}: ATLAS ${String(diff.valorAtlas)} → AEAT ${formatCurrency(diff.valorAeat)}`;
  }
  return `${diff.labelCampo}: ATLAS ${String(diff.valorAtlas)} → AEAT ${String(diff.valorAeat)}`;
}
