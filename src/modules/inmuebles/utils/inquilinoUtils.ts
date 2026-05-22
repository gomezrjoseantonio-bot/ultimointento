import type { Contract } from '../../../services/db';

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
 * Hash determinista a partir del id de contrato para escoger un color
 * estable entre renders del mismo registro.
 */
export function colorAvatarPorContrato(c: Contract): string {
  const id = c.id ?? 0;
  return COLORES_AVATAR[Math.abs(id) % COLORES_AVATAR.length];
}
