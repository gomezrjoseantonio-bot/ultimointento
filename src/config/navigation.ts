import {
  LayoutDashboard,
  FileText,
  Building2,
  Wallet,
  Receipt,
  TrendingUp,
  LineChart,
  BarChart3,
  GitBranch,
  Calculator,
  Settings2,
  DollarSign,
  CreditCard,
  UserCircle,
  Upload,
  Landmark,
  FolderOpen,
  Book,
  Calendar,
  KeyRound,
  Wrench,
  Target,
  Rocket,
} from 'lucide-react';
import { AppModule } from '../contexts/ThemeContext';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  module: AppModule | 'shared';
  subTabs?: NavigationItem[];
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
    icon: UserCircle,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/personal/resumen', icon: LayoutDashboard, module: 'horizon' },
      { name: 'Nómina', href: '/personal/nomina', icon: Wallet, module: 'horizon' },
      { name: 'Autónomo', href: '/personal/autonomo', icon: UserCircle, module: 'horizon' },
      { name: 'Pensiones e Inversiones', href: '/personal/pensiones-inversiones', icon: TrendingUp, module: 'horizon' },
      { name: 'Otros Ingresos', href: '/personal/otros-ingresos', icon: DollarSign, module: 'horizon' },
    ]
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Building2,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Cartera', href: '/inmuebles/cartera', icon: Building2, module: 'horizon' },
      { name: 'Evolución', href: '/inmuebles/analisis', icon: TrendingUp, module: 'horizon' },
    ]
  },
  {
    name: 'Inversiones',
    href: '/inversiones',
    icon: TrendingUp,
    module: 'horizon',
    section: 'horizon'
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Wallet,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/tesoreria', icon: Wallet, module: 'horizon' },
      { name: 'Movimientos', href: '/tesoreria/cobros-pagos', icon: DollarSign, module: 'horizon' },
      { name: 'Importar', href: '/tesoreria/importar', icon: Upload, module: 'horizon' },
    ]
  },
  {
    name: 'Previsiones',
    href: '/proyeccion',
    icon: LineChart,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Presupuesto', href: '/proyeccion/presupuesto', icon: Receipt, module: 'horizon' },
      { name: 'Real vs Previsto', href: '/proyeccion/comparativa', icon: BarChart3, module: 'horizon' },
      { name: 'Escenarios', href: '/proyeccion/escenarios', icon: GitBranch, module: 'horizon' },
      { name: 'Valoraciones', href: '/proyeccion/valoraciones', icon: Calculator, module: 'horizon' },
      { name: 'Proyección Mensual', href: '/proyeccion/mensual', icon: Calendar, module: 'horizon' },
    ]
  },
  {
    name: 'Mi Plan',
    href: '/mi-plan',
    icon: Target,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Objetivos', href: '/mi-plan/objetivos', icon: Target, module: 'horizon' },
      { name: 'Libertad financiera', href: '/mi-plan/libertad', icon: Rocket, module: 'horizon' },
    ],
  },
  {
    name: 'Impuestos',
    href: '/fiscalidad',
    icon: Receipt,
    module: 'horizon',
    section: 'horizon',
    subTabs: [
      { name: 'Dashboard', href: '/fiscalidad/dashboard', icon: LayoutDashboard, module: 'horizon' },
      { name: 'Declaración', href: '/fiscalidad/declaracion', icon: Receipt, module: 'horizon' },
      { name: 'Pagos', href: '/fiscalidad/pagos', icon: Calendar, module: 'horizon' },
      { name: 'Histórico', href: '/fiscalidad/historico', icon: Settings2, module: 'horizon' },
      { name: 'Entidades', href: '/fiscalidad/entidades', icon: Building2, module: 'horizon' },
    ]
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: Landmark,
    module: 'horizon',
    section: 'horizon'
  },
  {
    name: 'Alquileres',
    href: '/contratos',
    icon: KeyRound,
    module: 'pulse',
    section: 'pulse',
    subTabs: [
      { name: 'Lista', href: '/contratos/lista', icon: KeyRound, module: 'pulse' },
      { name: 'Nuevo', href: '/contratos/nuevo', icon: KeyRound, module: 'pulse' },
      { name: 'Renovación', href: '/contratos/renovacion', icon: Settings2, module: 'pulse' },
      { name: 'Subidas', href: '/contratos/subidas', icon: TrendingUp, module: 'pulse' },
      { name: 'Envío a firmar', href: '/firmas', icon: CreditCard, module: 'pulse' },
    ]
  },
  {
    name: 'Informes',
    href: '/informes',
    icon: FileText,
    module: 'horizon',
    section: 'horizon'
  },
  {
    name: 'Documentación',
    href: '/inbox',
    icon: FolderOpen,
    module: 'shared',
    section: 'documentation',
    subTabs: [
      { name: 'Repositorio', href: '/inbox', icon: FolderOpen, module: 'shared' },
      { name: 'Inbox (escaneo y subida)', href: '/inbox', icon: Upload, module: 'shared' },
      { name: 'Filtros', href: '/documentacion/filtros', icon: Settings2, module: 'shared' },
      { name: 'Extracción fiscal', href: '/documentacion/fiscal', icon: Receipt, module: 'shared' },
      { name: 'Inspecciones', href: '/documentacion/inspecciones', icon: UserCircle, module: 'shared' },
    ]
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
    icon: Book,
    module: 'shared',
    section: 'documentation'
  },
];

export const getNavigationForModule = (): NavigationItem[] => navigationConfig;
