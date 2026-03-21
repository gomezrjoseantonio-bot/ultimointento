import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllEjercicios, getOrCreateEjercicio } from '../../services/ejercicioFiscalService';
import type { EjercicioFiscal, EstadoEjercicio } from '../../types/fiscal';

interface Props {
  value: number;
  onChange: (ejercicio: number) => void;
}

const ESTADO_CONFIG: Record<EstadoEjercicio, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  en_curso: {
    label: 'En curso',
    color: '#0F6E56',
    bgColor: '#E1F5EE',
    icon: '◉',
  },
  cerrado: {
    label: 'Pendiente de declarar',
    color: '#854F0B',
    bgColor: '#FAEEDA',
    icon: '◎',
  },
  declarado: {
    label: 'Declarado',
    color: '#185FA5',
    bgColor: '#E6F1FB',
    icon: '✓',
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

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '8px',
          border: `1px solid ${config.color}20`,
          background: config.bgColor,
          color: config.color,
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span>{value}</span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 500,
            padding: '1px 6px',
            borderRadius: '10px',
            background: `${config.color}15`,
          }}
        >
          {config.icon} {config.label}
        </span>
        <span style={{ fontSize: '10px', marginLeft: '4px' }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'var(--color-background-primary, #fff)',
            border: '1px solid var(--color-border-tertiary, #e5e5e5)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 50,
            minWidth: '260px',
            overflow: 'hidden',
          }}
        >
          {ejercicios.map((ejercicio) => {
            const estado = ESTADO_CONFIG[ejercicio.estado];
            const isSelected = ejercicio.ejercicio === value;

            return (
              <button
                key={ejercicio.ejercicio}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(ejercicio.ejercicio);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: isSelected ? 'var(--color-background-secondary, #f5f5f5)' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontWeight: isSelected ? 600 : 400,
                    color: 'var(--color-text-primary, #111827)',
                  }}
                >
                  {ejercicio.ejercicio}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: estado.bgColor,
                    color: estado.color,
                  }}
                >
                  {estado.icon} {estado.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
