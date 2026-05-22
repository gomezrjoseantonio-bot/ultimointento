import React, { useEffect, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import { ChipBtn } from './ChipBtn';
import { useDebouncedValue } from '../../hooks/useFiltrosActivos';
import type { FiltrosActivos } from '../../utils/filtrosActivos';
import type { CountsChips } from '../../utils/filtrosActivos';
import styles from './BarraFiltros.module.css';

export interface BarraFiltrosProps {
  filtros: FiltrosActivos;
  onChange: (next: FiltrosActivos) => void;
  counts: CountsChips;
}

const BarraFiltros: React.FC<BarraFiltrosProps> = ({ filtros, onChange, counts }) => {
  const [busquedaInput, setBusquedaInput] = useState(filtros.busqueda);
  const busquedaDebounced = useDebouncedValue(busquedaInput, 200);

  // Sync from parent when reset externally
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
    <div className={styles.filters}>
      <div className={styles.search}>
        <Icons.Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          placeholder="Buscar por inquilino, DNI, email…"
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
        <span className={styles.searchKbd} aria-hidden>⌘F</span>
      </div>

      <div className={styles.chipGroup} role="radiogroup" aria-label="Filtrar por tipo">
        <span className={styles.chipGroupLabel}>Tipo</span>
        <ChipBtn
          active={filtros.tipo === 'todos'}
          count={counts.tipo.todos}
          onClick={() => onChange({ ...filtros, tipo: 'todos' })}
        >
          Todos
        </ChipBtn>
        <ChipBtn
          active={filtros.tipo === 'larga'}
          count={counts.tipo.larga}
          disabled={counts.tipo.larga === 0}
          onClick={() => onChange({ ...filtros, tipo: 'larga' })}
        >
          Larga
        </ChipBtn>
        <ChipBtn
          active={filtros.tipo === 'corta'}
          count={counts.tipo.corta}
          disabled={counts.tipo.corta === 0}
          onClick={() => onChange({ ...filtros, tipo: 'corta' })}
        >
          Corta
        </ChipBtn>
      </div>

      <div className={styles.chipGroup} role="radiogroup" aria-label="Filtrar por estado">
        <span className={styles.chipGroupLabel}>Estado</span>
        <ChipBtn
          active={filtros.estado === 'todos'}
          count={counts.estado.todos}
          onClick={() => onChange({ ...filtros, estado: 'todos' })}
        >
          Todos
        </ChipBtn>
        <ChipBtn
          active={filtros.estado === 'al-dia'}
          count={counts.estado['al-dia']}
          countTone="ok"
          disabled={counts.estado['al-dia'] === 0}
          onClick={() => onChange({ ...filtros, estado: 'al-dia' })}
        >
          Al día
        </ChipBtn>
        <ChipBtn
          active={filtros.estado === 'vence-30d'}
          count={counts.estado['vence-30d']}
          countTone="warn"
          disabled={counts.estado['vence-30d'] === 0}
          onClick={() => onChange({ ...filtros, estado: 'vence-30d' })}
        >
          Vence 30 d
        </ChipBtn>
        <ChipBtn
          active={filtros.estado === 'impago'}
          count={counts.estado.impago}
          countTone="neg"
          disabled={counts.estado.impago === 0}
          onClick={() => onChange({ ...filtros, estado: 'impago' })}
        >
          Impago
        </ChipBtn>
        <ChipBtn
          active={filtros.estado === 'sin-firmar'}
          count={counts.estado['sin-firmar']}
          countTone="brand"
          disabled={counts.estado['sin-firmar'] === 0}
          onClick={() => onChange({ ...filtros, estado: 'sin-firmar' })}
        >
          Sin firmar
        </ChipBtn>
      </div>

      <button
        type="button"
        className={styles.moreBtn}
        onClick={() => showToastV5('Filtros adicionales próximamente · T3.5')}
      >
        <Icons.Filter size={12} strokeWidth={1.8} />
        Más filtros
      </button>
    </div>
  );
};

export default BarraFiltros;
export { BarraFiltros };
