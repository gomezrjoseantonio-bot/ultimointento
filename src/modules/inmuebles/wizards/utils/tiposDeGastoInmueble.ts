import { Landmark, Users, Zap, Shield, Briefcase, Wrench, CirclePlus } from 'lucide-react';
import type { TipoGasto, SubtipoGasto } from '../../../shared/components/TipoGastoSelector';
import type {
  CategoriaGastoCompromiso,
  TipoCompromiso,
} from '../../../../types/compromisosRecurrentes';

export interface SubtipoGastoInmueble extends SubtipoGasto {
  tipoCompromiso: TipoCompromiso;
  categoria: CategoriaGastoCompromiso;
}

export interface TipoGastoInmueble extends TipoGasto {
  subtipos: SubtipoGastoInmueble[];
}

export const TIPOS_GASTO_INMUEBLE_V2: TipoGastoInmueble[] = [
  {
    id: 'tributos',
    label: 'Tributos',
    description: 'IBI · tasas municipales',
    icon: Landmark,
    subtipos: [
      { id: 'ibi', label: 'IBI', tipoCompromiso: 'impuesto', categoria: 'inmueble.ibi' },
      { id: 'tasa_basuras', label: 'Tasa basuras', tipoCompromiso: 'impuesto', categoria: 'inmueble.ibi' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'impuesto', categoria: 'inmueble.otros' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    description: 'Cuota ordinaria · derramas',
    icon: Users,
    subtipos: [
      { id: 'cuota_ordinaria', label: 'Cuota ordinaria', tipoCompromiso: 'comunidad', categoria: 'inmueble.comunidad' },
      { id: 'derrama', label: 'Derrama', tipoCompromiso: 'comunidad', categoria: 'inmueble.comunidad' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'comunidad', categoria: 'inmueble.comunidad' },
    ],
  },
  {
    id: 'suministros',
    label: 'Suministros',
    description: 'Luz · gas · agua · internet',
    icon: Zap,
    subtipos: [
      { id: 'luz', label: 'Luz', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
      { id: 'gas', label: 'Gas', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
      { id: 'agua', label: 'Agua', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
      { id: 'internet', label: 'Internet', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
    ],
  },
  {
    id: 'seguros',
    label: 'Seguros',
    description: 'Hogar · impago · otros',
    icon: Shield,
    subtipos: [
      { id: 'hogar', label: 'Hogar', tipoCompromiso: 'seguro', categoria: 'inmueble.seguros' },
      { id: 'impago', label: 'Impago', tipoCompromiso: 'seguro', categoria: 'inmueble.seguros' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'seguro', categoria: 'inmueble.seguros' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    description: 'Agencia · gestoría · asesoría',
    icon: Briefcase,
    subtipos: [
      { id: 'honorarios_agencia', label: 'Honorarios agencia', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'gestoria', label: 'Gestoría', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'asesoria', label: 'Asesoría', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
    ],
  },
  {
    id: 'reparacion',
    label: 'Reparación y conservación',
    description: 'Caldera · integral · limpieza',
    icon: Wrench,
    subtipos: [
      { id: 'mantenimiento_caldera', label: 'Mantenimiento caldera', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'mantenimiento_integral', label: 'Mantenimiento integral', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'limpieza', label: 'Limpieza', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    description: 'Gastos personalizados',
    icon: CirclePlus,
    subtipos: [
      { id: 'personalizado', label: 'Personalizado', isCustom: true, tipoCompromiso: 'otros', categoria: 'inmueble.otros' },
    ],
  },
];

export function findSubtipoInmueble(
  tipoId: string,
  subtipoId: string,
): SubtipoGastoInmueble | undefined {
  const tipo = TIPOS_GASTO_INMUEBLE_V2.find((t) => t.id === tipoId);
  return tipo?.subtipos.find((s) => s.id === subtipoId);
}

export function findCatalogEntryInmuebleByDbFields(
  tipoCompromiso: string,
  subtipoDb: string | undefined,
): { tipoId: string; subtipoId: string } | undefined {
  for (const tipo of TIPOS_GASTO_INMUEBLE_V2) {
    for (const sub of tipo.subtipos) {
      if (
        sub.tipoCompromiso === tipoCompromiso &&
        (subtipoDb ? sub.id === subtipoDb : true)
      ) {
        return { tipoId: tipo.id, subtipoId: sub.id };
      }
    }
  }
  return undefined;
}
