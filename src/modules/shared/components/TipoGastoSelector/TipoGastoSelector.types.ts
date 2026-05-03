import type { LucideIcon } from 'lucide-react';

export interface SubtipoGasto {
  id: string;
  label: string;
  isCustom?: boolean;
}

export interface TipoGasto {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  subtipos: SubtipoGasto[];
}

export interface TipoGastoValue {
  tipoId: string;
  subtipoId: string;
  nombrePersonalizado?: string;
}

export interface TipoGastoSelectorProps {
  catalog: TipoGasto[];
  value: TipoGastoValue | null;
  onChange: (value: TipoGastoValue | null) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
}
