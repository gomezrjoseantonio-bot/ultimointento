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
      { name: 'Gastos & CAPEX', href: '/inmuebles/gastos-capex', icon: Calculator, module: 'horizon' },
      { name: 'Análisis', href: '/inmuebles/analisis', icon: TrendingUp, module: 'horizon' },
    ]
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: Banknote,
    module: 'horizon',
    subTabs: [
      { name: 'Movimientos', href: '/tesoreria#movimientos', icon: CreditCard, module: 'horizon' },
      { name: 'Gastos', href: '/tesoreria#gastos', icon: CreditCard, module: 'horizon' },
      { name: 'CAPEX', href: '/tesoreria#capex', icon: Calculator, module: 'horizon' },
      { name: 'Ingresos', href: '/tesoreria#ingresos', icon: DollarSign, module: 'horizon' },
      { name: 'Radar', href: '/tesoreria/radar', icon: TrendingUp, module: 'horizon' },
      { name: 'Automatizaciones', href: '/tesoreria/automatizaciones', icon: Settings, module: 'horizon' },
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
      { name: 'Cartera', href: '/proyeccion/cartera', icon: Building, module: 'horizon' },
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