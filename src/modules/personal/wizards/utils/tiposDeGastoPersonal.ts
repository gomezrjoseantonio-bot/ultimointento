import { Home, Zap, ShoppingCart, Tv, Shield, CirclePlus } from 'lucide-react';
import type { TipoGasto, SubtipoGasto } from '../../../shared/components/TipoGastoSelector';
import type {
  BolsaPresupuesto,
  CategoriaGastoCompromiso,
  TipoCompromiso,
} from '../../../../types/compromisosRecurrentes';

export interface SubtipoGastoPersonal extends SubtipoGasto {
  tipoCompromiso: TipoCompromiso;
  categoria: CategoriaGastoCompromiso;
  bolsa: BolsaPresupuesto;
}

export interface TipoGastoPersonal extends TipoGasto {
  subtipos: SubtipoGastoPersonal[];
}

export const TIPOS_GASTO_PERSONAL: TipoGastoPersonal[] = [
  {
    id: 'vivienda',
    label: 'Vivienda',
    description: 'Alquiler · IBI · comunidad · seguro hogar',
    icon: Home,
    subtipos: [
      { id: 'alquiler', label: 'Alquiler', tipoCompromiso: 'otros', categoria: 'vivienda.alquiler', bolsa: 'necesidades' },
      { id: 'ibi', label: 'IBI', tipoCompromiso: 'impuesto', categoria: 'vivienda.ibi', bolsa: 'necesidades' },
      { id: 'comunidad', label: 'Comunidad', tipoCompromiso: 'comunidad', categoria: 'vivienda.comunidad', bolsa: 'necesidades' },
      { id: 'seguro_hogar', label: 'Seguro hogar', tipoCompromiso: 'seguro', categoria: 'vivienda.seguros', bolsa: 'necesidades' },
    ],
  },
  {
    id: 'suministros',
    label: 'Suministros',
    description: 'Luz · gas · agua · internet · móvil',
    icon: Zap,
    subtipos: [
      { id: 'luz', label: 'Luz', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
      { id: 'gas', label: 'Gas', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
      { id: 'agua', label: 'Agua', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
      { id: 'internet', label: 'Internet', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
      { id: 'movil', label: 'Móvil', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'suministro', categoria: 'vivienda.suministros', bolsa: 'necesidades' },
    ],
  },
  {
    id: 'dia_a_dia',
    label: 'Día a día',
    description: 'Supermercado · transporte · ocio · salud · ropa',
    icon: ShoppingCart,
    subtipos: [
      { id: 'supermercado', label: 'Supermercado · alimentación', tipoCompromiso: 'otros', categoria: 'alimentacion', bolsa: 'necesidades' },
      { id: 'transporte', label: 'Transporte · gasolina', tipoCompromiso: 'otros', categoria: 'transporte', bolsa: 'necesidades' },
      { id: 'restaurantes', label: 'Restaurantes · cafeterías', tipoCompromiso: 'otros', categoria: 'ocio', bolsa: 'deseos' },
      { id: 'ocio', label: 'Ocio · cine · planes', tipoCompromiso: 'otros', categoria: 'ocio', bolsa: 'deseos' },
      { id: 'salud', label: 'Salud · farmacia · médicos', tipoCompromiso: 'otros', categoria: 'salud', bolsa: 'necesidades' },
      { id: 'ropa', label: 'Ropa · calzado', tipoCompromiso: 'otros', categoria: 'personal', bolsa: 'deseos' },
      { id: 'cuidado_personal', label: 'Cuidado personal · peluquería', tipoCompromiso: 'otros', categoria: 'personal', bolsa: 'deseos' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'personal', bolsa: 'deseos' },
    ],
  },
  {
    id: 'suscripciones',
    label: 'Suscripciones',
    description: 'Streaming · música · software · cloud · prensa',
    icon: Tv,
    subtipos: [
      { id: 'streaming', label: 'Streaming', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
      { id: 'musica', label: 'Música', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
      { id: 'software', label: 'Software', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
      { id: 'cloud', label: 'Cloud', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
      { id: 'prensa', label: 'Prensa', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'suscripcion', categoria: 'suscripciones', bolsa: 'deseos' },
    ],
  },
  {
    id: 'seguros_cuotas',
    label: 'Seguros y cuotas',
    description: 'Seguros · gimnasio · educación · ONG',
    icon: Shield,
    subtipos: [
      { id: 'seguro_salud', label: 'Seguro salud', tipoCompromiso: 'seguro', categoria: 'salud', bolsa: 'necesidades' },
      { id: 'seguro_coche', label: 'Seguro coche', tipoCompromiso: 'seguro', categoria: 'transporte', bolsa: 'necesidades' },
      { id: 'seguro_vida', label: 'Seguro vida', tipoCompromiso: 'seguro', categoria: 'salud', bolsa: 'necesidades' },
      { id: 'seguro_otros', label: 'Seguro · otros', tipoCompromiso: 'seguro', categoria: 'personal', bolsa: 'necesidades' },
      { id: 'gimnasio', label: 'Gimnasio', tipoCompromiso: 'cuota', categoria: 'ocio', bolsa: 'deseos' },
      { id: 'educacion', label: 'Educación · colegio · universidad', tipoCompromiso: 'cuota', categoria: 'educacion', bolsa: 'necesidades' },
      { id: 'profesional', label: 'Profesional · colegio · sindicato', tipoCompromiso: 'cuota', categoria: 'educacion', bolsa: 'necesidades' },
      { id: 'ong', label: 'ONG · donaciones recurrentes', tipoCompromiso: 'cuota', categoria: 'ocio', bolsa: 'deseos' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'cuota', categoria: 'personal', bolsa: 'deseos' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    description: 'Impuestos · multas · coche · personalizado',
    icon: CirclePlus,
    subtipos: [
      { id: 'impuestos', label: 'Impuestos · tasas', tipoCompromiso: 'impuesto', categoria: 'obligaciones.multas', bolsa: 'obligaciones' },
      { id: 'multas', label: 'Multas', tipoCompromiso: 'impuesto', categoria: 'obligaciones.multas', bolsa: 'obligaciones' },
      { id: 'mantenimiento_coche', label: 'Mantenimiento coche', tipoCompromiso: 'otros', categoria: 'transporte', bolsa: 'necesidades' },
      { id: 'personalizado', label: 'Personalizado', isCustom: true, tipoCompromiso: 'otros', categoria: 'personal', bolsa: 'deseos' },
    ],
  },
];

export function findSubtipoPersonal(
  tipoId: string,
  subtipoId: string,
): SubtipoGastoPersonal | undefined {
  const tipo = TIPOS_GASTO_PERSONAL.find((t) => t.id === tipoId);
  return tipo?.subtipos.find((s) => s.id === subtipoId);
}

export function findCatalogEntryByDbFields(
  tipoCompromiso: string,
  subtipoDb: string | undefined,
): { tipoId: string; subtipoId: string } | undefined {
  if (!subtipoDb) return undefined;
  for (const tipo of TIPOS_GASTO_PERSONAL) {
    for (const sub of tipo.subtipos) {
      if (sub.tipoCompromiso === tipoCompromiso && sub.id === subtipoDb) {
        return { tipoId: tipo.id, subtipoId: sub.id };
      }
    }
  }
  return undefined;
}
