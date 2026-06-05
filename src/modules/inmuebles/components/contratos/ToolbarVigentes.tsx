import React, { useEffect, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import { useDebouncedValue } from '../../hooks/useFiltrosActivos';
import type { FiltrosActivos } from '../../utils/filtrosActivos';
import styles from './ToolbarVigentes.module.css';

export interface ToolbarVigentesProps {
  filtros: FiltrosActivos;
  onChange: (next: FiltrosActivos) => void;
  /** Inmuebles disponibles para el selector · [id, alias]. */
  inmuebles: Array<[number, string]>;
}

/**
 * Toolbar único de la tab Vigentes (spec FIX § 1.2) · searchbox + selector de
 * inmueble. SIN chips TIPO/ESTADO · SIN "Más filtros" · SIN botones
 * Exportar/Imprimir/Columnas · SIN línea-resumen (vive en la banda navy).
 */
const ToolbarVigentes: React.FC<ToolbarVigentesProps> = ({
  filtros,
  onChange,
  inmuebles,
}) => {
  const [busquedaInput, setBusquedaInput] = useState(filtros.busqueda);
  const busquedaDebounced = useDebouncedValue(busquedaInput, 200);

  useEffect(() => {
    setBusquedaInput(filtros.busqueda);
  }, [filtros.busqueda]);

  useEffect(() => {
    if (busquedaDebounced !== filtros.busqueda) {
      onChange({ ...filtros, busqueda: busquedaDebounced });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebounced]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Icons.Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          placeholder="Buscar inquilino · DNI · email"
          value={busquedaInput}
          onChange={(e) => setBusquedaInput(e.target.value)}
          aria-label="Buscar contratos"
        />
        {busquedaInput && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setBusquedaInput('')}
            aria-label="Limpiar búsqueda"
          >
            <Icons.Close size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <label className={styles.filterSelect}>
        <span className={styles.filterSelectLabel}>Inmueble</span>
        <select
          value={filtros.inmueble === 'todos' ? 'todos' : String(filtros.inmueble)}
          onChange={(e) =>
            onChange({
              ...filtros,
              inmueble: e.target.value === 'todos' ? 'todos' : Number(e.target.value),
            })
          }
          aria-label="Filtrar por inmueble"
        >
          <option value="todos">Todos los inmuebles</option>
          {inmuebles.map(([id, alias]) => (
            <option key={id} value={String(id)}>
              {alias}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default ToolbarVigentes;
export { ToolbarVigentes };
