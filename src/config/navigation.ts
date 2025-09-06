import { Home, Building, Banknote, Calculator, TrendingUp, Settings, DollarSign, CreditCard, Users, Inbox } from 'lucide-react';
import { AppModule } from '../contexts/ThemeContext';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  module: AppModule | 'shared';
  subTabs?: NavigationItem[];
}

export const navigationConfig: NavigationItem[] = [
  // Panel is shared but content differs per module
  {
    name: 'Panel',
    href: '/panel',
    icon: Home,
    module: 'shared',
  },
  
  // Bandeja de entrada - Horizon specific
  {
    name: 'Bandeja de entrada',
    href: '/inbox',
    icon: Inbox,
    module: 'horizon',
  },
  
  // Horizon (Invest) specific navigation
  {
    name: 'Inmuebles',
    href: '/inmuebles',
    icon: Building,
    module: 'horizon',
    subTabs: [
      { name: 'Cartera', href: '/inmuebles/cartera', icon: Building, module: 'horizon' },
      { name: 'Contratos', href: '/inmuebles/contratos', icon: Users, module: 'horizon' },
      { name: 'Préstamos', href: '/inmuebles/prestamos', icon: Banknote, module: 'horizon' },
      { name: 'Gastos', href: '/inmuebles/gastos-capex', icon: Calculator, module: 'horizon' },
      { name: 'Análisis', href: '/inmuebles/analisis', icon: TrendingUp, module: 'horizon' },
    ]
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Banknote,
    module: 'horizon',
    subTabs: [
      { name: 'Radar', href: '/tesoreria#radar', icon: TrendingUp, module: 'horizon' },
      { name: 'Cuentas', href: '/tesoreria#cuentas', icon: Banknote, module: 'horizon' },
      { name: 'Movimientos', href: '/tesoreria#movimientos', icon: CreditCard, module: 'horizon' },
      { name: 'Automatizaciones', href: '/tesoreria#automatizaciones', icon: Settings, module: 'horizon' },
    ]
  },
  {
    name: 'Fiscalidad',
    href: '/fiscalidad',
    icon: Calculator,
    module: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/fiscalidad/resumen', icon: Calculator, module: 'horizon' },
      { name: 'Detalle', href: '/fiscalidad/detalle', icon: TrendingUp, module: 'horizon' },
      { name: 'Declaraciones', href: '/fiscalidad/declaraciones', icon: Settings, module: 'horizon' },
    ]
  },
  {
    name: 'Proyección',
    href: '/proyeccion',
    icon: TrendingUp,
    module: 'horizon',
    subTabs: [
      { name: 'Presupuesto', href: '/proyeccion/presupuesto', icon: Calculator, module: 'horizon' },
      { name: 'Desviaciones', href: '/proyeccion/comparativa', icon: TrendingUp, module: 'horizon' },
      { name: 'Horizontes', href: '/proyeccion/escenarios', icon: TrendingUp, module: 'horizon' },
    ]
  },
  
  // Personal section within Horizon (neutral styling)
  {
    name: 'Personal',
    href: '/personal',
    icon: Users,
    module: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/personal/resumen', icon: Home, module: 'horizon' },
      { name: 'Cuentas', href: '/personal/cuentas', icon: Banknote, module: 'horizon' },
      { name: 'Movimientos', href: '/personal/movimientos', icon: CreditCard, module: 'horizon' },
      { name: 'Presupuesto', href: '/personal/presupuesto', icon: TrendingUp, module: 'horizon' },
      { name: 'Reglas', href: '/personal/reglas', icon: Settings, module: 'horizon' },
    ]
  },
  
  // Pulse (Management) specific navigation
  {
    name: 'Contratos',
    href: '/contratos',
    icon: Users,
    module: 'pulse',
    subTabs: [
      { name: 'Lista', href: '/contratos/lista', icon: Users, module: 'pulse' },
      { name: 'Nuevo', href: '/contratos/nuevo', icon: Users, module: 'pulse' },
      { name: 'Gestión', href: '/contratos/gestion', icon: Settings, module: 'pulse' },
    ]
  },
  {
    name: 'Firmas',
    href: '/firmas',
    icon: CreditCard,
    module: 'pulse',
    subTabs: [
      { name: 'Pendientes', href: '/firmas/pendientes', icon: CreditCard, module: 'pulse' },
      { name: 'Completadas', href: '/firmas/completadas', icon: CreditCard, module: 'pulse' },
      { name: 'Plantillas', href: '/firmas/plantillas', icon: Settings, module: 'pulse' },
    ]
  },
  {
    name: 'Cobros',
    href: '/cobros',
    icon: DollarSign,
    module: 'pulse',
    subTabs: [
      { name: 'Pendientes', href: '/cobros/pendientes', icon: DollarSign, module: 'pulse' },
      { name: 'Conciliación', href: '/cobros/conciliacion', icon: Banknote, module: 'pulse' },
      { name: 'Histórico', href: '/cobros/historico', icon: TrendingUp, module: 'pulse' },
    ]
  },
  {
    name: 'Automatizaciones',
    href: '/automatizaciones',
    icon: Settings,
    module: 'pulse',
    subTabs: [
      { name: 'Reglas', href: '/automatizaciones/reglas', icon: Settings, module: 'pulse' },
      { name: 'Flujos', href: '/automatizaciones/flujos', icon: TrendingUp, module: 'pulse' },
      { name: 'Historial', href: '/automatizaciones/historial', icon: Users, module: 'pulse' },
    ]
  },
  {
    name: 'Tareas',
    href: '/tareas',
    icon: TrendingUp,
    module: 'pulse',
    subTabs: [
      { name: 'Pendientes', href: '/tareas/pendientes', icon: TrendingUp, module: 'pulse' },
      { name: 'Completadas', href: '/tareas/completadas', icon: TrendingUp, module: 'pulse' },
      { name: 'Programadas', href: '/tareas/programadas', icon: Settings, module: 'pulse' },
    ]
  },
  
  // Configuración for Horizon
  {
    name: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    module: 'horizon',
    subTabs: [
      { name: 'Bancos & Cuentas', href: '/configuracion/bancos-cuentas', icon: Banknote, module: 'horizon' },
      { name: 'Usuarios & Roles', href: '/configuracion/usuarios-roles', icon: Users, module: 'horizon' },
      { name: 'Preferencias & Datos', href: '/configuracion/preferencias-datos', icon: Settings, module: 'horizon' },
      { name: 'Email entrante', href: '/configuracion/email-entrante', icon: Inbox, module: 'horizon' },
    ]
  },

  // Configuración for Pulse
  {
    name: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    module: 'pulse',
    subTabs: [
      { name: 'Preferencias & Datos', href: '/configuracion/preferencias-datos', icon: Settings, module: 'pulse' },
      { name: 'Email entrante', href: '/configuracion/email-entrante', icon: Inbox, module: 'pulse' },
    ]
  },
];

export const getNavigationForModule = (module: AppModule): NavigationItem[] => {
  return navigationConfig.filter(item => 
    item.module === module || item.module === 'shared'
  );
};