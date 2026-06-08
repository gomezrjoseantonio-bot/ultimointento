/**
 * Metadatos de los 7 bloques del onboarding (mockup pantalla 02 · hub).
 * Orden, títulos, iconos, núcleo y textos · fuente única para hub + widget.
 *
 * FIX PUNTO 4 · la tarjeta "Tu vida financiera" (`finanzas`) desaparece: la
 * subida de extractos y la revisión de sugerencias viven ahora DENTRO del
 * bloque `cuentas` (fusión cuentas+extractos).
 */
import { Icons } from '../../../design-system/v5';
import type { IconComponent } from '../../../design-system/v5';
import type { BloqueId } from '../../../services/onboardingProgressService';
import { BLOQUES_ORDEN, NUCLEO_BLOQUES } from '../../../services/onboardingProgressService';

export interface BloqueMeta {
  id: BloqueId;
  /** Título de la tarjeta (mockup pantalla 02). */
  titulo: string;
  /** Icono Lucide vía diccionario v5. */
  Icon: IconComponent;
  /** Pertenece al núcleo (persona · inmuebles · contratos · cuentas). */
  nucleo: boolean;
  /** Texto del pie izquierdo (vía/tiempo típico). */
  pie: string;
  /** Texto que aparece cuando el bloque está pendiente. */
  pendienteText: string;
}

export const BLOQUES_META: Record<BloqueId, BloqueMeta> = {
  persona: {
    id: 'persona',
    titulo: 'Quién eres',
    Icon: Icons.Personal,
    nucleo: true,
    pie: '2 min',
    pendienteText: 'Pendiente · tus datos personales y fiscales',
  },
  inmuebles: {
    id: 'inmuebles',
    titulo: 'Qué tienes · inmuebles',
    Icon: Icons.Inmuebles,
    nucleo: true,
    pie: 'Plantilla o manual',
    pendienteText: 'Pendiente · tus inmuebles y su compra',
  },
  contratos: {
    id: 'contratos',
    titulo: 'Quién te paga · contratos',
    Icon: Icons.Contratos,
    nucleo: true,
    pie: 'Importar o manual',
    pendienteText: 'Pendiente · tus contratos vigentes',
  },
  cuentas: {
    id: 'cuentas',
    titulo: 'Tus cuentas',
    Icon: Icons.Tesoreria,
    nucleo: true,
    pie: 'Saldo o extracto · por cuenta',
    pendienteText: 'Pendiente · tus cuentas con saldo de hoy',
  },
  prestamos: {
    id: 'prestamos',
    titulo: 'Qué debes · préstamos',
    Icon: Icons.Financiacion,
    nucleo: false,
    pie: 'Plantilla o manual',
    pendienteText: 'Pendiente · tus préstamos e hipotecas',
  },
  nomina: {
    id: 'nomina',
    titulo: 'Tu nómina o autónomo',
    Icon: Icons.Banknote,
    nucleo: false,
    pie: '10 min · pre-rellenado',
    pendienteText: 'Pendiente · enciende tu IRPF estimado',
  },
  inversiones: {
    id: 'inversiones',
    titulo: 'Tus inversiones',
    Icon: Icons.Inversiones,
    nucleo: false,
    pie: 'Plantilla o manual',
    pendienteText: 'Pendiente · fondos · acciones · planes · con su coste',
  },
};

/** Lista ordenada de metadatos (núcleo primero · igual que el mockup). */
export const BLOQUES_META_LIST: BloqueMeta[] = BLOQUES_ORDEN.map((id) => BLOQUES_META[id]);

export { BLOQUES_ORDEN, NUCLEO_BLOQUES };
