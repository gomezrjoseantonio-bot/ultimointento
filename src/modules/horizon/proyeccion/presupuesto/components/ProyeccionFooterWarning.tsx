import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ProyeccionFooterWarningProps {
  flujoCaja: number[];
}

const MESES_NOMBRES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export default function ProyeccionFooterWarning({ flujoCaja }: ProyeccionFooterWarningProps) {
  const mesesNegativos = flujoCaja
    .map((value, index) => (value < 0 ? MESES_NOMBRES[index] : null))
    .filter(Boolean) as string[];

  if (mesesNegativos.length === 0) {
    return null;
  }

  return (
    <div className="proyeccion-warning" role="status">
      <AlertTriangle size={16} style={{ color: 'var(--s-warn)', flexShrink: 0 }} />
      <p>
        Se detectan {mesesNegativos.length} meses con flujo negativo ({mesesNegativos.join(', ')}). Considera revisar liquidez en ese periodo.
      </p>
    </div>
  );
}
