import { initDB } from './db';
import type { PersonalData, SituacionLaboral } from '../types/personal';
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
  situacionLaboral: SituacionLaboral[];
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

import type { MaritalStatus } from '../types/personal';

function situacionToMarital(sp: PersonalData['situacionPersonal']): MaritalStatus {
  if (sp === 'casado' || sp === 'pareja-hecho') return 'married';
  if (sp === 'divorciado') return 'divorced';
  return 'single';
}

/**
 * Normaliza fecha dd/mm/yyyy → YYYY-MM-DD para <input type="date">.
 * Si ya está en formato ISO o YYYY-MM-DD, la devuelve tal cual.
 */
function normalizarFecha(fecha: string): string {
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = fecha.match(ddmmyyyy);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return fecha;
}

// ═══════════════════════════════════════════════════════════════
// MAPEO CCAA
// ═══════════════════════════════════════════════════════════════

// Valores deben coincidir con el dropdown de ProfileView.tsx
const CCAA_MAP: Record<string, string> = {
  '01': 'Andalucía',
  '02': 'Aragón',
  '03': 'Asturias (Principado de)',
  '04': 'Baleares (Illes)',
  '05': 'Canarias',
  '06': 'Cantabria',
  '07': 'Castilla-La Mancha',
  '08': 'Castilla y León',
  '09': 'Cataluña',
  '10': 'Extremadura',
  '11': 'Galicia',
  '12': 'Madrid (Comunidad de)',
  '13': 'Murcia (Región de)',
  '14': 'La Rioja',
  '15': 'País Vasco',
  '16': 'Navarra (Comunidad Foral de)',
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
  if (p.fechaNacimiento) result.fechaNacimiento = normalizarFecha(p.fechaNacimiento);
  if (p.comunidadAutonoma) {
    result.comunidadAutonoma = nombreCCAA(p.comunidadAutonoma);
  }
  if (p.estadoCivil) {
    const mapped = mapearEstadoCivil(p.estadoCivil);
    if (mapped) result.estadoCivil = mapped;
  }
  if (p.tributacion) result.tributacion = p.tributacion;
  if (p.situacionLaboral?.length) result.situacionLaboral = p.situacionLaboral;

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
  comparar('fechaNacimiento', 'Fecha nacimiento', datos.fechaNacimiento, perfil.fechaNacimiento);

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
    // AEAT format: APELLIDO1 APELLIDO2 NOMBRE(S) — primeros 2 tokens son apellidos
    const { nombre, apellidos } = splitNombreAeat(datos.nombre || '');

    const sp = datos.estadoCivil || 'soltero';
    const nuevoPerfil: PersonalData = {
      nombre: nombre || '',
      apellidos: apellidos || '',
      dni: datos.nif || '',
      direccion: '',
      situacionPersonal: sp,
      maritalStatus: situacionToMarital(sp),
      situacionLaboral: datos.situacionLaboral?.length ? datos.situacionLaboral : ['asalariado'],
      comunidadAutonoma: datos.comunidadAutonoma,
      tributacion: datos.tributacion,
      fechaNacimiento: datos.fechaNacimiento,
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

/**
 * Separa "APELLIDO1 APELLIDO2 NOMBRE(S)" → { nombre, apellidos }.
 * AEAT siempre pone 2 apellidos primero, el resto es nombre.
 */
function splitNombreAeat(fullName: string): { nombre: string; apellidos: string } {
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length <= 2) {
    // Solo 1-2 palabras: no podemos separar, asumimos todo como nombre
    return { nombre: fullName.trim(), apellidos: '' };
  }
  const apellidos = tokens.slice(0, 2).join(' ');
  const nombre = tokens.slice(2).join(' ');
  return { nombre, apellidos };
}

function aplicarCampo(updates: Partial<PersonalData>, campo: string, valor: string): void {
  switch (campo) {
    case 'nif':
      updates.dni = valor;
      break;
    case 'nombre': {
      const { nombre, apellidos } = splitNombreAeat(valor);
      updates.nombre = nombre;
      updates.apellidos = apellidos;
      break;
    }
    case 'estadoCivil': {
      const sp = valor as PersonalData['situacionPersonal'];
      updates.situacionPersonal = sp;
      updates.maritalStatus = situacionToMarital(sp);
      break;
    }
    case 'comunidadAutonoma':
      updates.comunidadAutonoma = valor;
      break;
    case 'fechaNacimiento':
      updates.fechaNacimiento = valor;
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
