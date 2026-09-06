// Puente ÚNICO catálogo único → árbol de presentación `TipoGasto[]`.
//
// La lista de gastos recurrentes, el picker de «Añadir gasto» y el import de
// Excel consumen un árbol `TipoGasto[]`. Aquí se construye UNA vez desde el
// catálogo único (E2.4.1c): `tipo.id` es la `FamiliaId` y `sub.id` el subtipo
// (vacío cuando la familia no tiene segundo nivel · el subtipo es OPCIONAL).
// Lo que se persiste en el compromiso es exactamente ese par.

import {
  Home,
  Landmark,
  Users,
  Zap,
  Shield,
  Tv,
  ShoppingCart,
  Briefcase,
  Wrench,
  Package,
  CirclePlus,
  Sparkles,
  Car,
  Film,
  Scissors,
  Hammer,
  GraduationCap,
  CreditCard,
  Gavel,
  Globe,
  PiggyBank,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TipoGasto } from '../../TipoGastoSelector/TipoGastoSelector.types';
import {
  familiasSugeridas,
  type Ambito,
  type FamiliaId,
} from '../../../../../services/catalogo/catalogoUnico';

/** Un icono por familia de GASTO del catálogo · los que falten caen a `CirclePlus`. */
export const ICONO_FAMILIA: Partial<Record<FamiliaId, LucideIcon>> = {
  comunidad: Users,
  suministro: Zap,
  seguros_alarmas: Shield,
  impuestos_tasas: Landmark,
  reparacion_mantenimiento: Wrench,
  reforma_mejora: Hammer,
  alquiler_renting: Home,
  gestion: Briefcase,
  limpieza: Sparkles,
  mobiliario_enseres: Package,
  prestamo_hipoteca: PiggyBank,
  supermercado: ShoppingCart,
  ocio: Film,
  transporte: Car,
  cuidado_personal: Scissors,
  suscripciones: Tv,
  educacion_formacion: GraduationCap,
  comisiones_bancarias: CreditCard,
  multas: Gavel,
  compra_online: Globe,
  otros: CirclePlus,
};

/**
 * El catálogo de gasto de un ámbito, en la forma `TipoGasto[]`.
 *
 * `familiasSugeridas` es un SUGERIDO para el selector (no ofrecer «supermercado»
 * al clasificar el gasto de un piso); una clasificación fuera de aquí sigue
 * siendo válida. Una familia sin subtipos ofrece un único chip con su nombre y
 * `sub.id === ''` (sin subtipo).
 */
export function catalogoTipoGasto(ambito: Ambito): TipoGasto[] {
  return familiasSugeridas('gasto', ambito).map((familia) => ({
    id: familia.id,
    label: familia.label,
    description: familia.descripcion ?? '',
    icon: ICONO_FAMILIA[familia.id] ?? CirclePlus,
    subtipos:
      familia.subtipos.length > 0
        ? familia.subtipos.map((s) => ({ id: s.id, label: s.label }))
        : [{ id: '', label: familia.label }],
  }));
}
