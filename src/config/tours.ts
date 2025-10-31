import { TourStep } from '../components/common/FeatureTour';

/**
 * Sprint 4: Feature Tour Configurations
 * Defines guided tours for key application features
 */

export const DASHBOARD_TOUR: TourStep[] = [
  {
    target: '[data-tour="dashboard-header"]',
    title: 'Panel de Control',
    content: 'Este es tu panel de control personalizado. Aquí puedes ver las métricas más importantes de tu cartera.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="dashboard-config"]',
    title: 'Personaliza tu Dashboard',
    content: 'Haz clic en este botón para personalizar qué bloques se muestran y en qué orden. Puedes arrastrar y soltar para reorganizar.',
    placement: 'left'
  },
  {
    target: '[data-tour="treasury-block"]',
    title: 'Bloque de Tesorería',
    content: 'Visualiza tu liquidez actual y el balance de tus cuentas bancarias. Incluye filtros para analizar por períodos.',
    placement: 'top'
  },
  {
    target: '[data-tour="kpis-block"]',
    title: 'KPIs Clave',
    content: 'Métricas de rendimiento de tu cartera: rentabilidad, ocupación, ingresos netos y más.',
    placement: 'top'
  }
];

export const PROPERTY_CREATION_TOUR: TourStep[] = [
  {
    target: '[data-tour="wizard-steps"]',
    title: 'Proceso Guiado',
    content: 'Crear una propiedad es sencillo con nuestro asistente de 4 pasos. Puedes navegar entre pasos en cualquier momento.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="view-mode-toggle"]',
    title: 'Modo Simple vs Avanzado',
    content: '¿Muchos campos? Cambia al modo Simple para ver solo los esenciales. Los usuarios avanzados pueden usar el modo Avanzado para ver todas las opciones.',
    placement: 'left'
  },
  {
    target: '[data-tour="step-content"]',
    title: 'Campos del Formulario',
    content: 'Completa la información paso a paso. Los campos con (*) son obligatorios. Puedes guardar en cualquier momento y continuar después.',
    placement: 'top'
  },
  {
    target: '[data-tour="save-button"]',
    title: 'Guardar Progreso',
    content: 'No es necesario completar todo de una vez. Guarda tu progreso y vuelve cuando tengas más información.',
    placement: 'top'
  }
];

export const TREASURY_TOUR: TourStep[] = [
  {
    target: '[data-tour="treasury-header"]',
    title: 'Módulo de Tesorería',
    content: 'Gestiona tus cuentas bancarias y movimientos. Realiza conciliación y análisis de flujos de caja.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="import-movements"]',
    title: 'Importar Movimientos',
    content: 'Importa extractos bancarios fácilmente desde archivos CSV, Excel o PDF. El sistema los clasifica automáticamente.',
    placement: 'left'
  },
  {
    target: '[data-tour="accounts-list"]',
    title: 'Cuentas Bancarias',
    content: 'Visualiza todas tus cuentas y sus saldos. Haz clic en una cuenta para ver sus movimientos detallados.',
    placement: 'right'
  },
  {
    target: '[data-tour="movements-table"]',
    title: 'Tabla de Movimientos',
    content: 'Todos tus movimientos bancarios organizados y clasificados. Usa los filtros para encontrar movimientos específicos.',
    placement: 'top'
  }
];

export const SIDEBAR_NAVIGATION_TOUR: TourStep[] = [
  {
    target: '[data-tour="sidebar-logo"]',
    title: 'Menú de Navegación',
    content: 'Desde este menú lateral accedes a todas las funcionalidades de ATLAS.',
    placement: 'right'
  },
  {
    target: '[data-tour="horizon-section"]',
    title: 'Horizon - Supervisión',
    content: 'El módulo Horizon contiene todas las herramientas de supervisión financiera: cartera, tesorería, proyecciones y fiscalidad.',
    placement: 'right'
  },
  {
    target: '[data-tour="pulse-section"]',
    title: 'Pulse - Gestión',
    content: 'El módulo Pulse es para la gestión operativa diaria: contratos, firmas, cobros y automatizaciones.',
    placement: 'right'
  },
  {
    target: '[data-tour="sidebar-collapse"]',
    title: 'Colapsar Menú',
    content: 'Si necesitas más espacio, puedes colapsar el menú haciendo clic en este botón. Solo verás los iconos.',
    placement: 'right'
  }
];

export const GLOSSARY_TOUR: TourStep[] = [
  {
    target: '[data-tour="glossary-search"]',
    title: 'Buscar Términos',
    content: '¿No entiendes un término? Usa el buscador para encontrar su definición rápidamente.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="glossary-categories"]',
    title: 'Categorías',
    content: 'Los términos están organizados por categorías: Financiero, Módulos ATLAS, Fiscal y Gestión Documental.',
    placement: 'top'
  },
  {
    target: '[data-tour="glossary-terms"]',
    title: 'Definiciones Completas',
    content: 'Cada término incluye una definición clara y ejemplos cuando es relevante.',
    placement: 'left'
  }
];

/**
 * Check if a tour has been completed
 */
export function isTourCompleted(tourId: string): boolean {
  return localStorage.getItem(`atlas_tour_${tourId}_completed`) === 'true';
}

/**
 * Start a tour (mark as not completed)
 */
export function startTour(tourId: string): void {
  localStorage.removeItem(`atlas_tour_${tourId}_completed`);
  localStorage.removeItem(`atlas_tour_${tourId}_skipped`);
}

/**
 * Get all available tours
 */
export const AVAILABLE_TOURS = {
  dashboard: {
    id: 'dashboard',
    name: 'Tour del Dashboard',
    description: 'Aprende a personalizar y usar tu panel de control',
    steps: DASHBOARD_TOUR
  },
  property: {
    id: 'property',
    name: 'Tour de Creación de Propiedad',
    description: 'Guía paso a paso para añadir inmuebles',
    steps: PROPERTY_CREATION_TOUR
  },
  treasury: {
    id: 'treasury',
    name: 'Tour de Tesorería',
    description: 'Gestiona tus cuentas y movimientos bancarios',
    steps: TREASURY_TOUR
  },
  navigation: {
    id: 'navigation',
    name: 'Tour de Navegación',
    description: 'Descubre cómo moverte por ATLAS',
    steps: SIDEBAR_NAVIGATION_TOUR
  },
  glossary: {
    id: 'glossary',
    name: 'Tour del Glosario',
    description: 'Consulta términos técnicos fácilmente',
    steps: GLOSSARY_TOUR
  }
};
