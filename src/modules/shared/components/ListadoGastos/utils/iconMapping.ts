import {
  Home,
  Zap,
  ShoppingCart,
  Tv,
  Shield,
  CirclePlus,
  Landmark,
  Users,
  Briefcase,
  Wrench,
  Flame,
  Droplets,
  Globe,
  Smartphone,
  Package,
  GraduationCap,
  Dumbbell,
  Car,
  Newspaper,
  Music,
  Cloud,
  HeartPulse,
  Shirt,
  Scissors,
  Film,
  UtensilsCrossed,
  AlertCircle,
  Building2,
  Layers,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const FAMILY_ICONS_PERSONAL: Record<string, LucideIcon> = {
  vivienda: Home,
  suministros: Zap,
  dia_a_dia: ShoppingCart,
  suscripciones: Tv,
  seguros_cuotas: Shield,
  otros: CirclePlus,
};

export const FAMILY_ICONS_INMUEBLE: Record<string, LucideIcon> = {
  tributos: Landmark,
  comunidad: Users,
  suministros: Zap,
  seguros: Shield,
  gestion: Briefcase,
  reparacion: Wrench,
  otros: CirclePlus,
};

export const SUBTYPE_ICONS: Record<string, LucideIcon> = {
  luz: Zap,
  gas: Flame,
  agua: Droplets,
  internet: Globe,
  movil: Smartphone,
  alquiler: Home,
  ibi: Landmark,
  comunidad: Users,
  seguro_hogar: Shield,
  supermercado: ShoppingCart,
  transporte: Car,
  restaurantes: UtensilsCrossed,
  ocio: Film,
  salud: HeartPulse,
  ropa: Shirt,
  cuidado_personal: Scissors,
  streaming: Tv,
  musica: Music,
  software: Package,
  cloud: Cloud,
  prensa: Newspaper,
  seguro_salud: HeartPulse,
  seguro_coche: Car,
  seguro_vida: Shield,
  seguro_otros: Shield,
  gimnasio: Dumbbell,
  educacion: GraduationCap,
  profesional: Briefcase,
  ong: HeartPulse,
  tasa_basuras: Package,
  cuota_ordinaria: Building2,
  derrama: Layers,
  hogar: Home,
  impago: AlertCircle,
  honorarios_agencia: Briefcase,
  gestoria: FileText,
  asesoria: FileText,
  mantenimiento_caldera: Flame,
  mantenimiento_integral: Wrench,
  limpieza: Droplets,
  personalizado: CirclePlus,
  otros: CirclePlus,
};

export function getSubtypeIcon(subtipo: string | undefined): LucideIcon {
  if (!subtipo) return CirclePlus;
  return SUBTYPE_ICONS[subtipo] ?? CirclePlus;
}

export function getFamilyIcon(familia: string, mode: 'personal' | 'inmueble'): LucideIcon {
  const map = mode === 'personal' ? FAMILY_ICONS_PERSONAL : FAMILY_ICONS_INMUEBLE;
  return map[familia] ?? CirclePlus;
}
