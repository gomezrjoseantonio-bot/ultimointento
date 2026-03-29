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
    href: '/personal',
    icon: User,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/personal/resumen' },
      { name: 'Gastos', href: '/personal/gastos' },
      { name: 'Ingresos', href: '/personal/ingresos' },
    ]
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Building2,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/inmuebles/resumen' },
      { name: 'Cartera', href: '/inmuebles/cartera' },
      { name: 'Evolución', href: '/inmuebles/evolucion' },
      { name: 'Individual', href: '/inmuebles/individual' },
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
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Landmark,
    module: 'shared',
    section: 'horizon'
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
