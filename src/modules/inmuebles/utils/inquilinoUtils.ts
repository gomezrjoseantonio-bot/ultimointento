import type { Contract } from '../../../services/db';

// Paleta de avatares para contratos FIRMADOS · hash determinista del nombre
// (NO del id ni random por render) · ergo el mismo inquilino tiene siempre el
// mismo color. Los contratos sin firmar NO usan esta paleta · van apagados
// (clase `unsigned`, dashed gris) · ver § 1.2 spec FIX.
const COLORES_AVATAR = [
  'var(--atlas-v5-c1)', // azul
  'var(--atlas-v5-c2)', // verde
  'var(--atlas-v5-c3)', // gold
  'var(--atlas-v5-c4)', // rojo
  'var(--atlas-v5-c5)', // gris
  'var(--atlas-v5-c6)', // morado
];

export function getInquilinoNombre(c: Contract): string {
  const nombre = `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim();
  return nombre || '—';
}

/**
 * FIX § 1.4 · ¿el contrato tiene un inquilino REAL identificado?
 *
 * `false` para los placeholders de renta declarada en IRPF/AEAT sin NIF de
 * inquilino (`estadoContrato === 'sin_identificar'`) y para cualquier contrato
 * sin nombre real ("—" / vacío / "sin identificar"). Estos NO deben aparecer en
 * Vigentes · Próximos · Histórico: su sitio es exclusivamente Por conciliar
 * (donde ya viven como rentas declaradas pendientes de vincular).
 */
export function esInquilinoIdentificado(c: Contract): boolean {
  if (c.estadoContrato === 'sin_identificar') return false;
  const nombre = getInquilinoNombre(c).trim().toLowerCase();
  if (!nombre || nombre === '—') return false;
  if (nombre.includes('sin identificar')) return false;
  return true;
}

/**
 * Hash determinista de un string (djb2). Estable entre renders y sesiones · el
 * mismo nombre siempre cae en el mismo color de la paleta.
 */
function hashString(texto: string): number {
  let hash = 5381;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) + hash + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generarIniciales(nombreCompleto: string | null | undefined): string {
  if (!nombreCompleto) return '·';
  const partes = nombreCompleto
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '·';
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * Color de avatar para un contrato FIRMADO · hash determinista del nombre del
 * inquilino. El mismo inquilino mantiene el mismo color en cualquier render.
 */
export function colorAvatarPorContrato(c: Contract): string {
  const nombre = getInquilinoNombre(c);
  return COLORES_AVATAR[hashString(nombre) % COLORES_AVATAR.length];
}

export interface AvatarInfo {
  /** `true` · falta soporte documental firmado → avatar apagado (dashed gris). */
  unsigned: boolean;
  /** Color de fondo (solo aplica cuando `unsigned === false`). */
  color: string;
  iniciales: string;
  nombre: string;
}

/**
 * Resuelve la presentación del avatar de un contrato según § 1.2:
 * · `!documentoFirmado` → `unsigned` (dashed gris · color apagado).
 * · firmado → color de la paleta por hash del nombre.
 */
export function avatarInfoPorContrato(c: Contract): AvatarInfo {
  const nombre = getInquilinoNombre(c);
  const unsigned = c.documentoFirmado === false;
  return {
    unsigned,
    color: COLORES_AVATAR[hashString(nombre) % COLORES_AVATAR.length],
    iniciales: generarIniciales(nombre),
    nombre,
  };
}
