import { Icons, type IconComponent } from '../design-system/v5';

export interface NavigationItem {
  name: string;
  href: string;
  icon: IconComponent;
  module: 'shared';
  subTabs?: { name: string; href: string }[];
  section?: 'panel' | 'mis-activos' | 'operativa' | 'ajustes';
}

/**
 * Navegación canónica · alineada a las 11 rutas v5 (T20 Phase 0-3g).
 *
 * Iconos consumidos desde `Icons.<Concepto>` v5 · NO importar directamente
 * Lucide aquí (regla §13.1 de la guía de diseño v5 · 1 icono por concepto).
 *
 * Agrupación T22.1 (§2.1):
 *  - panel      → Panel solo · sin header
 *  - mis-activos → MIS ACTIVOS header · Inmuebles · Inversiones · Tesorería · Financiación · Personal
 *  - operativa  → OPERATIVA header · Contratos · Mi Plan · Fiscal · Archivo
 *  - ajustes    → separador + Ajustes
 */
export const navigationConfig: NavigationItem[] = [
  {
    name: 'Panel',
    href: '/panel',
    icon: Icons.Panel,
    module: 'shared',
    section: 'panel',
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Icons.Inmuebles,
    module: 'shared',
    section: 'mis-activos',
  },
  {
    name: 'Inversiones',
    href: '/inversiones',
    icon: Icons.Inversiones,
    module: 'shared',
    section: 'mis-activos',
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
    icon: Icons.Tesoreria,
    module: 'shared',
    section: 'mis-activos',
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: Icons.Financiacion,
    module: 'shared',
    section: 'mis-activos',
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
    icon: Icons.Personal,  // §AA.9 · User (NO Building2)
    module: 'shared',
    section: 'mis-activos',
  },
  {
    name: 'Contratos',
    href: '/contratos',
    icon: Icons.Contratos,
    module: 'shared',
    section: 'operativa',
  },
  {
    name: 'Mi Plan',
    href: '/mi-plan',
    icon: Icons.MiPlan,
    module: 'shared',
    section: 'operativa',
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
    icon: Icons.Fiscal,
    module: 'shared',
    section: 'operativa',
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
    icon: Icons.Archivo,
    module: 'shared',
    section: 'operativa',
  },
  {
    name: 'Ajustes',
    href: '/ajustes',
    icon: Icons.Ajustes,
    module: 'shared',
    section: 'ajustes',
  },
];

export const getNavigationForModule = (): NavigationItem[] => navigationConfig;
