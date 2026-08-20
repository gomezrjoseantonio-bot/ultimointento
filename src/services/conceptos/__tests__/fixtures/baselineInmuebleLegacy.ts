// BASELINE HISTÓRICO CONGELADO · SOLO TESTS (P8c, 20 ago 2026).
//
// Esto FUE el 4º catálogo (el árbol familia→concepto del alta de gasto del
// inmueble). Se retiró del runtime: el alta del inmueble y el semillado de OPEX
// ya consumen el catálogo unificado (`services/conceptos/`). Pero los tests de
// equivalencia lo siguen usando como FOTO FIJA contra la que comprobar que el
// catálogo unificado no ha cambiado en silencio la clasificación fiscal de un
// gasto de inmueble. No lo importa ningún código de producción; no lo edites
// para «arreglar» un test —eso taparía justo lo que vigila—.

import { Landmark, Users, Zap, Shield, Briefcase, Wrench, Sparkles, Armchair, CirclePlus } from 'lucide-react';
import type { TipoGasto, SubtipoGasto } from '../../../../modules/shared/components/TipoGastoSelector';
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
      { id: 'tasa_basuras', label: 'Basuras y alcantarillado', tipoCompromiso: 'impuesto', categoria: 'inmueble.ibi' },
      { id: 'licencia_turistica', label: 'Licencia turística', tipoCompromiso: 'impuesto', categoria: 'inmueble.otros' },
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
      { id: 'telefonia', label: 'Telefonía', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
      { id: 'alarma', label: 'Alarma', tipoCompromiso: 'suministro', categoria: 'inmueble.suministros' },
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
      // Vida: sólo tiene sentido en el inmueble si está vinculado a la hipoteca.
      // Se resuelve al alta (ver SeguroVidaModal · decisión Jose §4).
      { id: 'otros', label: 'Otros', tipoCompromiso: 'seguro', categoria: 'inmueble.seguros' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    description: 'Agencia · gestoría · asesoría',
    icon: Briefcase,
    subtipos: [
      { id: 'honorarios_agencia', label: 'Gestión del alquiler', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'gestoria', label: 'Gestoría', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'asesoria', label: 'Asesoría', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'comision_plataformas', label: 'Comisión de plataformas', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'inmueble.gestionAlquiler' },
    ],
  },
  {
    id: 'reparacion',
    label: 'Reparación y conservación',
    description: 'Caldera · mantenimiento integral',
    icon: Wrench,
    subtipos: [
      { id: 'mantenimiento_caldera', label: 'Mantenimiento de la caldera', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'mantenimiento_integral', label: 'Mantenimiento integral', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
    ],
  },
  {
    // V6 · D3 · familia nueva. "Reparación y conservación" mezclaba dos cosas
    // fiscalmente distintas: reparar el inmueble (0106) y los servicios
    // recurrentes de explotarlo (0108). Separarlas resolvió cinco de las trece
    // traducciones pendientes de una vez.
    id: 'servicios',
    label: 'Servicios y explotación',
    description: 'Limpieza · lavandería · consumibles',
    icon: Sparkles,
    subtipos: [
      { id: 'limpieza', label: 'Limpieza', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'limpieza_zonas_comunes', label: 'Limpieza de zonas comunes', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'limpieza_por_estancia', label: 'Limpieza por estancia', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      // Desdoblado de `ropa_cama_lavanderia`: el SERVICIO recurrente se queda
      // aquí (0108) y el BIEN duradero se va a Mobiliario (0117, amortizable).
      { id: 'lavanderia', label: 'Lavandería', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'consumibles_bienvenida', label: 'Consumibles de bienvenida', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'otros', label: 'Otros', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
    ],
  },
  {
    // V6 · D3 · el mobiliario y los enseres son bien duradero: NO son gasto del
    // ejercicio, se amortizan (0117). Por eso van en familia propia y no
    // colgando de Servicios.
    id: 'mobiliario',
    label: 'Mobiliario y enseres',
    description: 'Ropa de cama · menaje · muebles',
    icon: Armchair,
    subtipos: [
      { id: 'ropa_enseres', label: 'Ropa de cama y enseres', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
      { id: 'muebles', label: 'Muebles', tipoCompromiso: 'otros', categoria: 'inmueble.opex' },
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
  if (!subtipoDb) return undefined;
  for (const tipo of TIPOS_GASTO_INMUEBLE_V2) {
    for (const sub of tipo.subtipos) {
      if (sub.tipoCompromiso === tipoCompromiso && sub.id === subtipoDb) {
        return { tipoId: tipo.id, subtipoId: sub.id };
      }
    }
  }
  return undefined;
}
