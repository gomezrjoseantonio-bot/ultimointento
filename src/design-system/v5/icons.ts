/**
 * ATLAS · DESIGN SYSTEM v5 · DICCIONARIO DE ICONOS
 *
 * Una iconografía única (Lucide-react). 1 icono por concepto.
 * Fuente: GUIA-DISENO-V5-atlas.md §13.
 *
 * Consumir siempre como `Icons.<Concepto>` (PascalCase) para que JSX
 * cumpla la convención `react/jsx-pascal-case` y para evitar usar Lucide
 * directamente desde la UI v5.
 */

import {
  // Sidebar nav · 11 items canónicos
  LayoutGrid,
  Building2,
  TrendingUp,
  Wallet,
  Landmark,
  Users,
  FileText,
  Compass,
  Monitor,
  Folder,
  Settings,
  // Sub-módulos Mi Plan
  LineChart,
  MoveHorizontal,
  Target,
  Package,
  Star,
  // Tipos · objetivos · fondos · retos
  Shield,
  Home,
  Wrench,
  Gift,
  TrendingDown,
  // Sub-módulos Inversiones
  Briefcase,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  // UI utilitarios
  Upload,
  Download,
  Search,
  Bell,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Plus,
  Minus,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  MoreHorizontal,
  Filter,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Mail,
  Phone,
  MapPin,
  Tag,
  Paperclip,
  RefreshCw,
  Inbox,
} from 'lucide-react';

/**
 * Diccionario canónico · 1 entrada por concepto del repositorio.
 *
 * Convención · claves en PascalCase · uso JSX `<Icons.Concepto />`.
 * Si el código de un módulo necesita un icono nuevo · añadir aquí
 * siguiendo §13 antes de usarlo · NO importar Lucide directamente
 * en la UI v5.
 */
export const Icons = {
  // ===== Módulos sidebar (§13.1) =====
  Panel: LayoutGrid,
  Inmuebles: Building2,
  Inversiones: TrendingUp,
  Tesoreria: Wallet,
  Financiacion: Landmark,
  Personal: Users,
  Contratos: FileText,
  MiPlan: Compass,
  Fiscal: Monitor,
  Archivo: Folder,
  Ajustes: Settings,

  // ===== Sub-módulos Mi Plan =====
  Proyeccion: LineChart,
  Libertad: MoveHorizontal,
  Objetivos: Target,
  Fondos: Package,
  Retos: Star,

  // ===== Sub-módulos Inversiones =====
  Cartera: Briefcase,
  Rendimientos: BarChart3,
  Distribucion: PieChart,
  Activity,
  ArrowUpRight,

  // ===== Tipos de objetivo / fondo =====
  Acumular: Package,
  Amortizar: Landmark,
  Comprar: Home,
  Reducir: TrendingDown,
  Colchon: Shield,
  Compra: Home,
  Reforma: Wrench,
  Impuestos: Monitor,
  Capricho: Gift,

  // ===== UI utilitarios =====
  Upload,
  Download,
  Search,
  Bell,
  Help: HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Close: X,
  Check,
  Plus,
  Minus,
  Warning: AlertTriangle,
  Alert: AlertCircle,
  Info,
  Success: CheckCircle2,
  Error: XCircle,
  Edit: Pencil,
  Delete: Trash2,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  More: MoreHorizontal,
  Filter,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Mail,
  Phone,
  MapPin,
  Tag,
  Attach: Paperclip,
  Refresh: RefreshCw,
  Inbox,
} as const;

export type IconName = keyof typeof Icons;
export type IconComponent = typeof Icons[IconName];
