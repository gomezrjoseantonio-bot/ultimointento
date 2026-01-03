import { Home, Building, Banknote, Calculator, TrendingUp, Settings, DollarSign, CreditCard, Users, Inbox, Receipt, FileText, Book } from 'lucide-react';
import { AppModule } from '../contexts/ThemeContext';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  module: AppModule | 'shared';
  subTabs?: NavigationItem[];
  section?: 'horizon' | 'pulse' | 'documentation';
}

// ATLAS Unified Navigation - exactly 9 entries as specified
export const navigationConfig: NavigationItem[] = [
  // HORIZON — Supervisión (items 1-7)
  {
    name: 'Dashboard',
    href: '/panel',
    icon: Home,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Personal',
    href: '/personal',
    icon: Users,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/personal/resumen', icon: Home, module: 'horizon' },
      { name: 'Nómina', href: '/personal/nomina', icon: Banknote, module: 'horizon' },
      { name: 'Autónomo', href: '/personal/autonomo', icon: Users, module: 'horizon' },
      { name: 'Pensiones e Inversiones', href: '/personal/pensiones-inversiones', icon: TrendingUp, module: 'horizon' },
      { name: 'Otros Ingresos', href: '/personal/otros-ingresos', icon: DollarSign, module: 'horizon' },
    ]
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Building,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Cartera', href: '/inmuebles/cartera', icon: Building, module: 'horizon' },
      { name: 'Contratos', href: '/inmuebles/contratos', icon: Users, module: 'horizon' },
      { name: 'Gastos', href: '/inmuebles/gastos-capex', icon: Calculator, module: 'horizon' },
      { name: 'Análisis', href: '/inmuebles/analisis', icon: TrendingUp, module: 'horizon' },
      { name: 'Tareas', href: '/inmuebles/tareas', icon: Settings, module: 'horizon' }, // Tareas moved here as tab
    ]
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Banknote,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/tesoreria', icon: Banknote, module: 'horizon' },
      { name: 'Movimientos', href: '/tesoreria/cobros-pagos', icon: DollarSign, module: 'horizon' },
      { name: 'Importar', href: '/tesoreria/importar', icon: Inbox, module: 'horizon' },
    ]
  },
  {
    name: 'Previsiones',
    href: '/proyeccion',
    icon: TrendingUp,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Presupuesto', href: '/proyeccion/presupuesto', icon: Calculator, module: 'horizon' },
      { name: 'Real vs Previsto', href: '/proyeccion/comparativa', icon: TrendingUp, module: 'horizon' },
      { name: 'Escenarios', href: '/proyeccion/escenarios', icon: TrendingUp, module: 'horizon' },
    ]
  },
  {
    name: 'Impuestos',
    href: '/fiscalidad',
    icon: Calculator,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/fiscalidad/resumen', icon: Calculator, module: 'horizon' },
      { name: 'Por inmueble', href: '/fiscalidad/detalle', icon: TrendingUp, module: 'horizon' },
      { name: 'Declaraciones', href: '/fiscalidad/declaraciones', icon: Settings, module: 'horizon' },
    ]
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: Receipt,
    module: 'horizon',
    section: 'horizon'
  },
  
  // PULSE — Gestión (item 8)
  {
    name: 'Alquileres',
    href: '/contratos',
    icon: Users,
    module: 'pulse',
    section: 'pulse',
    subTabs: [
      { name: 'Lista', href: '/contratos/lista', icon: Users, module: 'pulse' },
      { name: 'Nuevo', href: '/contratos/nuevo', icon: Users, module: 'pulse' },
      { name: 'Renovación', href: '/contratos/renovacion', icon: Settings, module: 'pulse' },
      { name: 'Subidas', href: '/contratos/subidas', icon: TrendingUp, module: 'pulse' },
      { name: 'Envío a firmar', href: '/firmas', icon: CreditCard, module: 'pulse' },
    ]
  },
  
  // DOCUMENTACIÓN (item 9)
  {
    name: 'Documentación',
    href: '/documentacion',
    icon: FileText,
    module: 'shared',
    section: 'documentation',
    subTabs: [
      { name: 'Repositorio', href: '/documentacion', icon: FileText, module: 'shared' },
      { name: 'Filtros', href: '/documentacion/filtros', icon: Settings, module: 'shared' },
      { name: 'Extracción fiscal', href: '/documentacion/fiscal', icon: Calculator, module: 'shared' },
      { name: 'Inspecciones', href: '/documentacion/inspecciones', icon: Users, module: 'shared' },
    ]
  },
  
  // GLOSARIO - Sprint 3: Accessible technical terms
  {
    name: 'Glosario',
    href: '/glosario',
    icon: Book,
    module: 'shared',
    section: 'documentation'
  },
];

export const getNavigationForModule = (): NavigationItem[] => {
  // Return all navigation items - unified sidebar
  return navigationConfig;
};