// Puente ÚNICO catálogo unificado → árbol de presentación `TipoGasto[]`.
//
// Hasta aquí, la lista de gastos recurrentes recibía su catálogo POR PROP, y
// cada pantalla le pasaba uno distinto (el viejo de inmueble o el viejo de
// personal). El mismo gasto se elegía y se agrupaba de forma diferente según
// dónde estuvieras: ese era el descontrol.
//
// Aquí se construye ese árbol UNA vez, desde el catálogo unificado
// (`catalogoConceptos`), filtrado por ámbito. `tipo.id` es la familia unificada
// (`FamiliaId`) y `sub.id` es el id de concepto unificado — los mismos que se
// persisten en `CompromisoRecurrente.concepto`. Cada concepto arrastra
// `tipoCompromiso` y `categoria` (de su proyección) porque el picker y el
// matcher del import los leen sueltos del subtipo.

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
  Settings,
  Bell,
  Sparkles,
  Car,
  Pill,
  Film,
  Plane,
  UtensilsCrossed,
  Shirt,
  Scissors,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TipoGasto } from '../../TipoGastoSelector/TipoGastoSelector.types';
import {
  familiasDeAmbito,
  conceptosDe,
  proyectar,
  type Ambito,
  type FamiliaId,
} from '../../../../../services/conceptos/catalogoConceptos';

/** Un icono por Tipo del catálogo unificado · los que falten caen a `CirclePlus`. */
const ICONO_FAMILIA: Partial<Record<FamiliaId, LucideIcon>> = {
  comunidad: Users,
  tributos: Landmark,
  seguros: Shield,
  reparacion: Wrench,
  mantenimiento: Settings,
  suministros: Zap,
  alarma: Bell,
  gestion: Briefcase,
  limpieza: Sparkles,
  supermercado: ShoppingCart,
  transporte: Car,
  farmacia: Pill,
  suscripciones: Tv,
  ocio: Film,
  viaje: Plane,
  restaurante: UtensilsCrossed,
  ropa: Shirt,
  cuidado_personal: Scissors,
  alquiler: Home,
  mobiliario: Package,
  otros: CirclePlus,
};

/**
 * El catálogo unificado de un ámbito, en la forma `TipoGasto[]` que consumen el
 * picker (`ConceptoPickerModal`), la agrupación personal (`groupByCatalog`) y el
 * import de Excel (`ImportarGastosModal`).
 *
 * `sub.id` es el id de concepto unificado · lo que se guarda como `concepto`.
 */
export function catalogoTipoGasto(ambito: Ambito): TipoGasto[] {
  return familiasDeAmbito(ambito).map((familia) => ({
    id: familia.id,
    label: familia.label,
    description: familia.descripcion,
    icon: ICONO_FAMILIA[familia.id] ?? CirclePlus,
    subtipos: conceptosDe(familia.id, ambito).map((concepto) => {
      const proy = proyectar(concepto.id, ambito);
      return {
        id: concepto.id,
        label: concepto.label,
        // El picker y el matcher los leen sueltos del subtipo (cast en origen).
        tipoCompromiso: concepto.tipoCompromiso,
        categoria: proy?.categoria ?? 'otros',
      } as { id: string; label: string; tipoCompromiso: string; categoria: string };
    }),
  }));
}
