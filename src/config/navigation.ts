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
  
  // Bandeja de Documentos - shared across modules
  {
    name: 'Bandeja de Documentos',
    href: '/inbox',
    icon: Inbox,
    module: 'shared',
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
      { name: 'Gastos & Docs', href: '/inmuebles/gastos-docs', icon: CreditCard, module: 'horizon' },
      { name: 'Análisis', href: '/inmuebles/analisis', icon: TrendingUp, module: 'horizon' },
    ]
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Banknote,
    module: 'horizon',
    subTabs: [
      { name: 'Radar', href: '/tesoreria/radar', icon: TrendingUp, module: 'horizon' },
      { name: 'Movimientos', href: '/tesoreria/movimientos', icon: CreditCard, module: 'horizon' },
      { name: 'Reglas & Sweeps', href: '/tesoreria/reglas-sweeps', icon: Settings, module: 'horizon' },
      { name: 'Alertas', href: '/tesoreria/alertas', icon: Users, module: 'horizon' },
    ]
  },
  {
    name: 'Fiscalidad',
    href: '/fiscalidad',
    icon: Calculator,
    module: 'horizon',
    subTabs: [
      { name: 'Resumen', href: '/fiscalidad/resumen', icon: Calculator, module: 'horizon' },
      { name: 'Deducibles', href: '/fiscalidad/deducibles', icon: TrendingUp, module: 'horizon' },
      { name: 'Declaraciones', href: '/fiscalidad/declaraciones', icon: Settings, module: 'horizon' },
    ]
  },
  {
    name: 'Proyección',
    href: '/proyeccion',
    icon: TrendingUp,
    module: 'horizon',
    subTabs: [
      { name: 'Inmuebles', href: '/proyeccion/inmuebles', icon: Building, module: 'horizon' },
      { name: 'Consolidado', href: '/proyeccion/consolidado', icon: TrendingUp, module: 'horizon' },
    ]
  },
  
  // Pulse (Personal) specific navigation
  {
    name: 'Ingresos',
    href: '/ingresos',
    icon: DollarSign,
    module: 'pulse',
    subTabs: [
      { name: 'Lista', href: '/ingresos/lista', icon: DollarSign, module: 'pulse' },
      { name: 'Nuevo', href: '/ingresos/nuevo', icon: DollarSign, module: 'pulse' },
      { name: 'Importar', href: '/ingresos/importar', icon: DollarSign, module: 'pulse' },
    ]
  },
  {
    name: 'Gastos',
    href: '/gastos',
    icon: CreditCard,
    module: 'pulse',
    subTabs: [
      { name: 'Lista', href: '/gastos/lista', icon: CreditCard, module: 'pulse' },
      { name: 'Nuevo', href: '/gastos/nuevo', icon: CreditCard, module: 'pulse' },
      { name: 'Reglas', href: '/gastos/reglas', icon: Settings, module: 'pulse' },
    ]
  },
  {
    name: 'Tesorería Personal',
    href: '/tesoreria-personal',
    icon: Banknote,
    module: 'pulse',
    subTabs: [
      { name: 'Radar', href: '/tesoreria-personal/radar', icon: TrendingUp, module: 'pulse' },
      { name: 'Movimientos', href: '/tesoreria-personal/movimientos', icon: CreditCard, module: 'pulse' },
      { name: 'Alertas', href: '/tesoreria-personal/alertas', icon: Users, module: 'pulse' },
    ]
  },
  {
    name: 'Proyección Personal',
    href: '/proyeccion-personal',
    icon: TrendingUp,
    module: 'pulse',
    subTabs: [
      { name: 'Presupuesto', href: '/proyeccion-personal/presupuesto', icon: TrendingUp, module: 'pulse' },
      { name: 'Escenarios', href: '/proyeccion-personal/escenarios', icon: TrendingUp, module: 'pulse' },
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
      { name: 'Plan & Facturación', href: '/configuracion/plan-facturacion', icon: CreditCard, module: 'horizon' },
      { name: 'Usuarios & Roles', href: '/configuracion/usuarios-roles', icon: Users, module: 'horizon' },
      { name: 'Preferencias & Datos', href: '/configuracion/preferencias-datos', icon: Settings, module: 'horizon' },
    ]
  },

  // Configuración for Pulse
  {
    name: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    module: 'pulse',
    subTabs: [
      { name: 'Preferencias', href: '/configuracion/preferencias', icon: Settings, module: 'pulse' },
      { name: 'Datos', href: '/configuracion/datos', icon: Settings, module: 'pulse' },
    ]
  },
];

export const getNavigationForModule = (module: AppModule): NavigationItem[] => {
  return navigationConfig.filter(item => 
    item.module === module || item.module === 'shared'
  );
};