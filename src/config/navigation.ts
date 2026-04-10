import {
  LayoutDashboard,
  User,
  Building2,
  TrendingUp,
  Landmark,
  BarChart3,
  Target,
  Scale,
  CreditCard,
  FileText,
  Key,
  FolderOpen,
  Wrench,
  BookOpen,
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  module: 'shared';
  subTabs?: { name: string; href: string }[];
  section?: 'horizon' | 'pulse' | 'documentation';
}

export const navigationConfig: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/panel',
    icon: LayoutDashboard,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Personal',
    href: '/personal/supervision',
    icon: User,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles/supervision',
    icon: Building2,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Supervisión', href: '/inmuebles/supervision' },
      { name: 'Cartera', href: '/inmuebles/cartera' },
      { name: 'Contratos', href: '/inmuebles/contratos' },
      { name: 'Gastos', href: '/inmuebles/gastos-capex' },
    ]
  },
  {
    name: 'Inversiones',
    href: '/inversiones',
    icon: TrendingUp,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/inversiones/resumen' },
      { name: 'Cartera', href: '/inversiones/cartera' },
      { name: 'Rendimientos', href: '/inversiones/rendimientos' },
      { name: 'Individual', href: '/inversiones/individual' },
    ]
  },
  {
    name: 'Previsiones',
    href: '/proyeccion',
    icon: BarChart3,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Proyección', href: '/proyeccion/presupuesto' },
      { name: 'Presupuesto', href: '/proyeccion/comparativa' },
      { name: 'Real vs Previsión', href: '/proyeccion/mensual' },
    ]
  },
  {
    name: 'Mi Plan',
    href: '/mi-plan',
    icon: Target,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Impuestos',
    href: '/fiscalidad',
    icon: Scale,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Mi IRPF', href: '/fiscalidad/mi-irpf' },
      { name: 'Historial', href: '/fiscalidad/historial' },
    ]
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: CreditCard,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Informes',
    href: '/informes',
    icon: FileText,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Alquileres',
    href: '/contratos',
    icon: Key,
    module: 'shared',
    section: 'pulse'
  },
  {
    name: 'Conciliación',
    href: '/conciliacion',
    icon: Landmark,
    module: 'shared',
    section: 'pulse'
  },
  {
    name: 'Gestión Personal',
    href: '/gestion/personal',
    icon: User,
    module: 'shared',
    section: 'pulse'
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Landmark,
    module: 'shared',
    section: 'horizon'
  },
  {
    name: 'Documentación',
    href: '/inbox',
    icon: FolderOpen,
    module: 'shared',
    section: 'documentation'
  },
  {
    name: 'Herramientas',
    href: '/herramientas',
    icon: Wrench,
    module: 'shared',
    section: 'documentation'
  },
  {
    name: 'Glosario',
    href: '/glosario',
    icon: BookOpen,
    module: 'shared',
    section: 'documentation'
  },
];

export const getNavigationForModule = (): NavigationItem[] => navigationConfig;
