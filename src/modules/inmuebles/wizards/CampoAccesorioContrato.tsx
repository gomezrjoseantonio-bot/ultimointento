import React from 'react';
import styles from './NuevoContratoWizard.module.css';

interface PropiedadOpcion {
  id?: number;
  alias?: string;
  address?: string;
}

interface Props {
  /** Inmueble principal del contrato (se excluye de las opciones). */
  principalId: number | null;
  properties: PropiedadOpcion[];
  value: number | null;
  onChange: (id: number | null) => void;
}

/**
 * Campo del wizard de contrato para declarar un accesorio que se alquila JUNTO
 * al inmueble (parking/trastero con referencia catastral propia = Caso 1). Los
 * anexos sin referencia (Caso 2) no son inmuebles, así que no aparecen.
 */
const CampoAccesorioContrato: React.FC<Props> = ({ principalId, properties, value, onChange }) => {
  if (principalId == null) return null;
  return (
    <div className={`${styles.field} ${styles.full}`}>
      <label className={styles.label}>Accesorio que se alquila junto (opcional)</label>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">— sin accesorio —</option>
        {properties
          .filter((p) => p.id !== principalId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.alias} · {p.address}
            </option>
          ))}
      </select>
      <div className={styles.help}>
        Parking o trastero con referencia catastral propia que se alquila con este piso.
        Su amortización y gastos se suman al principal mientras dure el alquiler.
      </div>
    </div>
  );
};

export default CampoAccesorioContrato;
