import {
  Home,
  Wrench,
  TrendingUp,
  Armchair,
  Users,
  Shield,
  Landmark,
  Zap,
  Briefcase,
  ShoppingBag,
  DollarSign,
  Tag,
  type LucideIcon,
} from 'lucide-react';

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Devuelve el icono lucide que representa una categoría del modelo de
 * Conciliación. Usado en la columna "Concepto" de cada fila.
 */
export function categoryToIcon(categoryLabel: string | undefined | null): LucideIcon {
  if (!categoryLabel) return Tag;
  const n = normalize(categoryLabel);

  if (n.includes('alquiler') || n.includes('renta')) return Home;
  if (n.includes('reparacion')) return Wrench;
  if (n.includes('mejora') || n.includes('ampliacion')) return TrendingUp;
  if (n.includes('mobiliario') || n.includes('mueble')) return Armchair;
  if (n.includes('comunidad')) return Users;
  if (n.includes('seguro')) return Shield;
  if (n.includes('suministro') || n.includes('luz') || n.includes('agua') || n.includes('gas')) return Zap;
  if (n.includes('ibi') || n.includes('tribut') || n.includes('basura')) return DollarSign;
  if (n.includes('hipoteca') || n.includes('financiacion') || n.includes('prestamo') || n.includes('cuota')) return Landmark;
  if (n.includes('nomina') || n.includes('autonomo') || n.includes('trabajo')) return Briefcase;
  if (n.includes('personal') || n.includes('compra') || n.includes('super')) return ShoppingBag;
  return Tag;
}
