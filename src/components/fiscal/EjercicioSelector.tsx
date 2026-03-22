import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, ChevronDown, Circle, Clock, type LucideIcon } from 'lucide-react';
import { getAllEjercicios, getOrCreateEjercicio } from '../../services/ejercicioFiscalService';
import type { EjercicioFiscal, EstadoEjercicio } from '../../types/fiscal';
import './ejercicio-selector.css';

interface Props {
  value: number;
  onChange: (ejercicio: number) => void;
}

type EstadoConfig = {
  label: string;
  colorVar: string;
  bgVar: string;
  Icon: LucideIcon;
};

const ESTADO_CONFIG: Record<EstadoEjercicio, EstadoConfig> = {
  en_curso: {
    label: 'En curso',
    colorVar: 'var(--s-pos)',
    bgVar: 'var(--s-pos-bg)',
    Icon: Circle,
  },
  cerrado: {
    label: 'Pendiente de declarar',
    colorVar: 'var(--s-warn)',
    bgVar: 'var(--s-warn-bg)',
    Icon: Clock,
  },
  declarado: {
    label: 'Declarado',
    colorVar: 'var(--blue)',
    bgVar: 'var(--n-100)',
    Icon: CheckCircle,
  },
};

export default function EjercicioSelector({ value, onChange }: Props) {
  const [ejercicios, setEjercicios] = useState<EjercicioFiscal[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadEjercicios();
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadEjercicios() {
    const currentYear = new Date().getFullYear();
    const requiredYears = Array.from({ length: 7 }, (_, index) => currentYear - index);
    const existing = await getAllEjercicios();

    for (const year of requiredYears) {
      if (!existing.some((ejercicio) => ejercicio.ejercicio === year)) {
        const estado: EstadoEjercicio = year === currentYear ? 'en_curso' : 'cerrado';
        await getOrCreateEjercicio(year, estado);
      }
    }

    const updated = await getAllEjercicios();
    setEjercicios(updated.sort((a, b) => b.ejercicio - a.ejercicio));
  }

  const selected = useMemo(
    () => ejercicios.find((ejercicio) => ejercicio.ejercicio === value),
    [ejercicios, value],
  );

  const config = selected ? ESTADO_CONFIG[selected.estado] : ESTADO_CONFIG.cerrado;
  const SelectedIcon = config.Icon;

  return (
    <div ref={rootRef} className="ejercicio-selector">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="ejercicio-selector__trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value}</span>
        <span
          className="ejercicio-selector__badge"
          style={{
            background: config.bgVar,
            color: config.colorVar,
          }}
        >
          <SelectedIcon size={12} />
          {config.label}
        </span>
        <ChevronDown size={14} className="ejercicio-selector__chevron" />
      </button>

      {open && (
        <div role="listbox" className="ejercicio-selector__menu">
          {ejercicios.map((ejercicio) => {
            const estado = ESTADO_CONFIG[ejercicio.estado];
            const isSelected = ejercicio.ejercicio === value;
            const EstadoIcon = estado.Icon;

            return (
              <button
                key={ejercicio.ejercicio}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="ejercicio-selector__option"
                style={{
                  background: isSelected ? 'var(--n-50)' : 'transparent',
                }}
                onClick={() => {
                  onChange(ejercicio.ejercicio);
                  setOpen(false);
                }}
              >
                <span
                  className="ejercicio-selector__year"
                  style={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {ejercicio.ejercicio}
                </span>
                <span
                  className="ejercicio-selector__badge"
                  style={{
                    background: estado.bgVar,
                    color: estado.colorVar,
                  }}
                >
                  <EstadoIcon size={12} />
                  {estado.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
