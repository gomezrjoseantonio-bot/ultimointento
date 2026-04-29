import { Icons, type IconComponent } from '../design-system/v5';

export interface NavigationItem {
  name: string;
  href: string;
  icon: IconComponent;
  module: 'shared';
  subTabs?: { name: string; href: string }[];
  section?: 'horizon' | 'pulse' | 'documentation';
}

/**
 * Navegación canónica · alineada a las 11 rutas v5 (T20 Phase 0-3g).
 *
 * Iconos consumidos desde `Icons.<Concepto>` v5 · NO importar directamente
 * Lucide aquí (regla §13.1 de la guía de diseño v5 · 1 icono por concepto).
 *
 * Estado de las rutas legacy ·
 *  - `/personal/supervision` y `/fiscalidad` son redirects (App.tsx) → v5.
 *  - `/inmuebles/supervision` sigue activa como ruta legacy (no redirect)
 *    hasta Phase 4 cleanup · el menú principal apunta a `/inmuebles` v5.
 *  - `/proyeccion/*` legacy se sustituye por Mi Plan · Proyección.
 *
 * Secciones · 'horizon' (módulos principales) · 'documentation' (archivo +
 * ajustes). 'pulse' queda vacía hasta que se incorpore alguna gestión
 * legacy mientras llega Phase 4.
 */
export const navigationConfig: NavigationItem[] = [
  {
    name: 'Panel',
    href: '/panel',
    icon: Icons.Panel,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Icons.Inmuebles,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Inversiones',
    href: '/inversiones',
    icon: Icons.Inversiones,
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
    icon: Icons.Tesoreria,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Financiación',
    href: '/financiacion',
    icon: Icons.Financiacion,
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
    icon: Icons.Personal,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Contratos',
    href: '/contratos',
    icon: Icons.Contratos,
    module: 'shared',
    section: 'horizon',
  },
  {
    name: 'Mi Plan',
    href: '/mi-plan',
    icon: Icons.MiPlan,
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
    icon: Icons.Fiscal,
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
    icon: Icons.Archivo,
    module: 'shared',
    section: 'documentation',
  },
  {
    name: 'Ajustes',
    href: '/ajustes',
    icon: Icons.Ajustes,
    module: 'shared',
    section: 'documentation',
  },
];

export const getNavigationForModule = (): NavigationItem[] => navigationConfig;
