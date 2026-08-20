// R3 · el `<select>` de habitación del wizard, extraído para no engordar el
// wizard. Muestra las habitaciones por nombre (+ renta objetivo si la tiene).

import React from 'react';
import type { OpcionHabitacion } from './contratoWizardHelpers';
import styles from './NuevoContratoWizard.module.css';

interface Props {
  opciones: OpcionHabitacion[];
  value: string;
  onChange: (habitacionId: string) => void;
}

const CampoHabitacionContrato: React.FC<Props> = ({ opciones, value, onChange }) => {
  if (opciones.length === 0) return null;
  return (
    <div className={styles.field}>
      <label className={styles.label}>Habitación</label>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— inmueble completo —</option>
        {opciones.map((h) => (
          <option key={h.id} value={h.id}>
            {h.nombre}
            {h.rentaObjetivo != null ? ` · ${Math.round(h.rentaObjetivo)} €` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CampoHabitacionContrato;
