import { initDB } from './db';
import type { PersonalData } from '../types/personal';
import type { DeclaracionIRPF } from '../types/fiscal';
import type { Diferencia } from './declaracionOnboardingService';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PersonalDesdeDeclaracion {
  nif: string;
  nombre: string;
  estadoCivil: 'soltero' | 'casado' | 'pareja-hecho' | 'divorciado';
  comunidadAutonoma: string;
  fechaNacimiento: string;
  tributacion: 'individual' | 'conjunta';
}

export interface ResultadoPersonalOnboarding {
  esNuevo: boolean;
  datosAplicados: string[];
  conflictos: Diferencia[];
}

// ═══════════════════════════════════════════════════════════════
// MAPEO ESTADO CIVIL
// ═══════════════════════════════════════════════════════════════

function mapearEstadoCivil(valor?: string): PersonalData['situacionPersonal'] | undefined {
  if (!valor) return undefined;
  const lower = valor.toLowerCase().trim();
  if (lower === 'soltero' || lower === 'soltero/a' || lower === '06') return 'soltero';
  if (lower === 'casado' || lower === 'casado/a' || lower === '07') return 'casado';
  if (lower === 'viudo' || lower === 'viudo/a' || lower === '08') return 'divorciado'; // closest mapping
  if (lower === 'divorciado' || lower === 'divorciado/a' || lower === '09') return 'divorciado';
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// MAPEO CCAA
// ═══════════════════════════════════════════════════════════════

const CCAA_MAP: Record<string, string> = {
  '01': 'Andalucía',
  '02': 'Aragón',
  '03': 'Asturias',
  '04': 'Islas Baleares',
  '05': 'Canarias',
  '06': 'Cantabria',
  '07': 'Castilla-La Mancha',
  '08': 'Castilla y León',
  '09': 'Cataluña',
  '10': 'Extremadura',
  '11': 'Galicia',
  '12': 'Madrid',
  '13': 'Murcia',
  '14': 'La Rioja',
  '15': 'País Vasco',
  '16': 'Navarra',
  '17': 'Comunidad Valenciana',
  '18': 'Ceuta',
  '19': 'Melilla',
};

export function nombreCCAA(codigo: string): string {
  return CCAA_MAP[codigo.padStart(2, '0')] || codigo;
}

// ═══════════════════════════════════════════════════════════════
// EXTRAER DATOS PERSONALES DE LA DECLARACIÓN
// ═══════════════════════════════════════════════════════════════

export function extraerDatosPersonales(
  declaracion: DeclaracionIRPF,
): Partial<PersonalDesdeDeclaracion> {
  const p = declaracion.personal;
  if (!p) return {};

  const result: Partial<PersonalDesdeDeclaracion> = {};

  if (p.nif) result.nif = p.nif.trim();
  if (p.nombre) result.nombre = p.nombre.trim();
  if (p.fechaNacimiento) result.fechaNacimiento = p.fechaNacimiento;
  if (p.comunidadAutonoma) {
    result.comunidadAutonoma = nombreCCAA(p.comunidadAutonoma);
  }
  if (p.estadoCivil) {
    const mapped = mapearEstadoCivil(p.estadoCivil);
    if (mapped) result.estadoCivil = mapped;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISIS: DETECTAR DIFERENCIAS CON PERFIL EXISTENTE
// ═══════════════════════════════════════════════════════════════

export interface AnalisisPersonal {
  esNuevo: boolean;
  camposNuevos: Array<{ campo: string; label: string; valor: string }>;
  conflictos: Diferencia[];
}

export async function analizarDatosPersonales(
  declaracion: DeclaracionIRPF,
): Promise<AnalisisPersonal> {
  const datos = extraerDatosPersonales(declaracion);
  const perfil = await cargarPerfil();

  if (!perfil) {
    const camposNuevos: Array<{ campo: string; label: string; valor: string }> = [];
    if (datos.nif) camposNuevos.push({ campo: 'nif', label: 'NIF', valor: datos.nif });
    if (datos.nombre) camposNuevos.push({ campo: 'nombre', label: 'Nombre', valor: datos.nombre });
    if (datos.estadoCivil) camposNuevos.push({ campo: 'estadoCivil', label: 'Estado civil', valor: datos.estadoCivil });
    if (datos.comunidadAutonoma) camposNuevos.push({ campo: 'comunidadAutonoma', label: 'Comunidad autónoma', valor: datos.comunidadAutonoma });
    if (datos.fechaNacimiento) camposNuevos.push({ campo: 'fechaNacimiento', label: 'Fecha nacimiento', valor: datos.fechaNacimiento });

    return { esNuevo: true, camposNuevos, conflictos: [] };
  }

  const camposNuevos: Array<{ campo: string; label: string; valor: string }> = [];
  const conflictos: Diferencia[] = [];

  const comparar = (campo: string, label: string, valorAeat: string | undefined, valorAtlas: string | undefined) => {
    if (!valorAeat) return;
    if (!valorAtlas || valorAtlas.trim() === '') {
      camposNuevos.push({ campo, label, valor: valorAeat });
      return;
    }
    if (valorAeat.toLowerCase() !== valorAtlas.toLowerCase()) {
      conflictos.push({ campo, labelCampo: label, valorAtlas, valorAeat });
    }
  };

  comparar('nif', 'NIF', datos.nif, perfil.dni);
  comparar('nombre', 'Nombre', datos.nombre, [perfil.nombre, perfil.apellidos].filter(Boolean).join(' '));
  comparar('estadoCivil', 'Estado civil', datos.estadoCivil, perfil.situacionPersonal);
  comparar('comunidadAutonoma', 'Comunidad autónoma', datos.comunidadAutonoma, perfil.comunidadAutonoma);
  comparar('fechaNacimiento', 'Fecha nacimiento', datos.fechaNacimiento, ''); // No stored field to compare

  return { esNuevo: false, camposNuevos, conflictos };
}

// ═══════════════════════════════════════════════════════════════
// EJECUTAR: GUARDAR DATOS PERSONALES
// ═══════════════════════════════════════════════════════════════

export async function ejecutarOnboardingPersonal(
  declaracion: DeclaracionIRPF,
  resoluciones?: Record<string, 'atlas' | 'aeat'>,
): Promise<ResultadoPersonalOnboarding> {
  const datos = extraerDatosPersonales(declaracion);
  const perfil = await cargarPerfil();
  const analisis = await analizarDatosPersonales(declaracion);

  if (!perfil) {
    // Perfil nuevo: crear con todos los datos disponibles
    const [nombre, ...apellidosParts] = (datos.nombre || '').split(' ');
    const apellidos = apellidosParts.join(' ');

    const nuevoPerfil: PersonalData = {
      nombre: nombre || '',
      apellidos: apellidos || '',
      dni: datos.nif || '',
      direccion: '',
      situacionPersonal: datos.estadoCivil || 'soltero',
      situacionLaboral: ['asalariado'],
      comunidadAutonoma: datos.comunidadAutonoma,
      tributacion: datos.tributacion,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };

    const db = await initDB();
    await db.add('personalData', nuevoPerfil);

    return {
      esNuevo: true,
      datosAplicados: analisis.camposNuevos.map((c) => c.label),
      conflictos: [],
    };
  }

  // Perfil existente: aplicar campos nuevos + resoluciones de conflictos
  const updates: Partial<PersonalData> = {};
  const datosAplicados: string[] = [];

  // Campos nuevos (vacíos en Atlas): siempre aplicar
  for (const campo of analisis.camposNuevos) {
    aplicarCampo(updates, campo.campo, campo.valor);
    datosAplicados.push(campo.label);
  }

  // Conflictos: aplicar solo si el usuario eligió 'aeat'
  const conflictosResueltos: Diferencia[] = [];
  for (const conflicto of analisis.conflictos) {
    const resolucion = resoluciones?.[conflicto.campo];
    if (resolucion === 'aeat') {
      aplicarCampo(updates, conflicto.campo, String(conflicto.valorAeat));
      datosAplicados.push(conflicto.labelCampo);
    } else {
      conflictosResueltos.push(conflicto);
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.fechaActualizacion = new Date().toISOString();
    const db = await initDB();
    const updated = { ...perfil, ...updates };
    await db.put('personalData', updated);
  }

  return {
    esNuevo: false,
    datosAplicados,
    conflictos: conflictosResueltos,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════

function aplicarCampo(updates: Partial<PersonalData>, campo: string, valor: string): void {
  switch (campo) {
    case 'nif':
      updates.dni = valor;
      break;
    case 'nombre': {
      const [nombre, ...parts] = valor.split(' ');
      updates.nombre = nombre;
      updates.apellidos = parts.join(' ');
      break;
    }
    case 'estadoCivil':
      updates.situacionPersonal = valor as PersonalData['situacionPersonal'];
      break;
    case 'comunidadAutonoma':
      updates.comunidadAutonoma = valor;
      break;
    case 'fechaNacimiento':
      // PersonalData doesn't have this field yet; skip silently
      break;
    case 'tributacion':
      updates.tributacion = valor as 'individual' | 'conjunta';
      break;
    default:
      break;
  }
}

async function cargarPerfil(): Promise<PersonalData | null> {
  try {
    const db = await initDB();
    const perfiles = (await db.getAll('personalData')) as PersonalData[];
    return perfiles[0] || null;
  } catch {
    return null;
  }
}
