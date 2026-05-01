/**
 * ATLAS · DESIGN SYSTEM v5 · BARREL EXPORT
 *
 * Punto único de entrada para los módulos productivos. Importar desde aquí
 * y NO desde rutas internas, para mantener la API estable.
 *
 * Las modificaciones al sistema de diseño (añadir componente · ajustar
 * variantes) deben pasar por aquí y por la guía v5 antes de propagarse a
 * los módulos que lo consumen.
 */

export { default as PageHead } from './PageHead';
export type { PageHeadProps, PageHeadButton, BreadcrumbItem } from './PageHead';

export { default as TabsUnderline } from './TabsUnderline';
export type { TabsUnderlineProps, TabItem } from './TabsUnderline';

export {
  default as CardV5,
  CardHead,
  CardBody,
  CardFoot,
  CardTitle,
  CardSubtitle,
} from './CardV5';
export type { CardV5Props, CardAccent } from './CardV5';

export { default as KPIStrip } from './KPIStrip';
export type { KPIStripProps } from './KPIStrip';

export { default as KPI } from './KPI';
export type { KPIProps, KPIValueTone } from './KPI';

export { default as HeroBanner } from './HeroBanner';
export type {
  HeroBannerProps,
  HeroVariant,
  HeroCompactProps,
  HeroToggleProps,
  HeroProgressProps,
  HeroChartProps,
  HeroCompactStats,
  HeroToggleOption,
  HeroChartLegendItem,
} from './HeroBanner';

export { default as UploadZone } from './UploadZone';
export type { UploadZoneProps } from './UploadZone';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Toast, ToastHost, showToastV5 } from './Toast';
export type { ToastProps, ToastVariant, ToastMessage } from './Toast';

export { default as Pill } from './Pill';
export type { PillProps, PillVariant } from './Pill';

export { default as MoneyValue } from './MoneyValue';
export type { MoneyValueProps, MoneyTone, MoneySize } from './MoneyValue';

export { default as DateLabel } from './DateLabel';
export type {
  DateLabelProps,
  DateFormat,
  DateLabelTone,
  DateLabelSize,
} from './DateLabel';

export { default as IconButton } from './IconButton';
export type {
  IconButtonProps,
  IconButtonVariant,
  IconButtonSize,
} from './IconButton';

export { default as WizardStepper } from './WizardStepper';
export type { WizardStepperProps, WizardStep } from './WizardStepper';

export { default as TopbarV5 } from './TopbarV5';
export type { TopbarV5Props } from './TopbarV5';

export { Icons } from './icons';
export type { IconName, IconComponent } from './icons';

export { useChartColors } from './useChartColors';
export type { ChartColors } from './useChartColors';
