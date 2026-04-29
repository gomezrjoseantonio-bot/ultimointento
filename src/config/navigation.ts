import {
  LayoutDashboard,
  User,
  Building2,
  TrendingUp,
  Landmark,
  Compass,
  Monitor,
  CreditCard,
  Folder,
  Settings,
  Key,
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  module: 'shared';
  subTabs?: { name: string; href: string }[];
  section?: 'horizon' | 'pulse' | 'documentation';
}

/**
 * Navegación canónica · alineada a las 11 rutas v5 (T20 Phase 0-3g).
 *
 * Las rutas legacy `/personal/supervision`, `/inmuebles/supervision` y
 * `/fiscalidad` permanecen accesibles como redirects (App.tsx) pero el
 * menú principal apunta directamente a la v5. Las páginas `/proyeccion`
 * legacy se sustituyen por Mi Plan · Proyección.
 */
export const navigationConfig: NavigationItem[] = [
  {
    name: 'Panel',
    href: '/panel',
    icon: LayoutDashboard,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Building2,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Inversiones',
    href: '/inversiones',
    icon: TrendingUp,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/inversiones' },
      { name: 'Cartera', href: '/inversiones/cartera' },
      { name: 'Rendimientos', href: '/inversiones/rendimientos' },
      { name: 'Individual', href: '/inversiones/individual' },
    ],
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Landmark,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: CreditCard,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Dashboard', href: '/financiacion' },
      { name: 'Listado', href: '/financiacion/listado' },
      { name: 'Snowball', href: '/financiacion/snowball' },
      { name: 'Calendario', href: '/financiacion/calendario' },
    ],
  },
  {
    name: 'Personal',
    href: '/personal',
    icon: User,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Contratos',
    href: '/inmuebles/contratos',
    icon: Key,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Mi Plan',
    href: '/mi-plan',
    icon: Compass,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Mi Plan', href: '/mi-plan' },
      { name: 'Proyección', href: '/mi-plan/proyeccion' },
      { name: 'Libertad financiera', href: '/mi-plan/libertad' },
      { name: 'Objetivos', href: '/mi-plan/objetivos' },
      { name: 'Fondos de ahorro', href: '/mi-plan/fondos' },
      { name: 'Retos', href: '/mi-plan/retos' },
    ],
  },
  {
    name: 'Fiscal',
    href: '/fiscal',
    icon: Monitor,
    module: 'shared',
    section: 'horizon',
    subTabs: [
      { name: 'Calendario', href: '/fiscal' },
      { name: 'Ejercicios', href: '/fiscal/ejercicios' },
      { name: 'Deudas', href: '/fiscal/deudas' },
      { name: 'Configuración', href: '/fiscal/configuracion' },
    ],
  },
  {
    name: 'Archivo',
    href: '/archivo',
    icon: Folder,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Ajustes',
    href: '/ajustes',
    icon: Settings,
    module: 'shared',
    section: 'horizon',
  },
];

export const getNavigationForModule = (): NavigationItem[] => navigationConfig;
