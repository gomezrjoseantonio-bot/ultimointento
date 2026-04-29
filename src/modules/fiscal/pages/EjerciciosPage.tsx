import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import type { EjercicioRow } from '../types';
import { ESTADOS_VIVOS, formatDateShort } from '../helpers';
import styles from './EjerciciosPage.module.css';

type Filter = 'todos' | 'curso' | 'declarado' | 'prescrito';

const FILTER_LABEL: Record<Filter, string> = {
  todos: 'Todos',
  curso: 'En curso',
  declarado: 'Declarados',
  prescrito: 'Prescritos',
};

const matchFilter = (r: EjercicioRow, f: Filter): boolean => {
  if (f === 'todos') return true;
  if (f === 'curso') return ESTADOS_VIVOS.includes(r.estado);
  if (f === 'declarado') return r.estado === 'declarado' || r.estado === 'cerrado';
  if (f === 'prescrito') return r.estado === 'prescrito';
  return true;
};

const estadoChipClass = (r: EjercicioRow): string => {
  if (r.estado === 'declarado') return styles.declarado;
  if (r.estado === 'cerrado') return styles.cerrado;
  if (r.estado === 'prescrito') return styles.prescrito;
  if (ESTADOS_VIVOS.includes(r.estado)) return styles.curso;
  return styles.pendiente;
};

const EjerciciosPage: React.FC = () => {
  const navigate = useNavigate();
  const { rows } = useOutletContext<FiscalOutletContext>();
  const [filter, setFilter] = useState<Filter>('todos');

  const counts = useMemo(() => {
    return {
      todos: rows.length,
      curso: rows.filter((r) => ESTADOS_VIVOS.includes(r.estado)).length,
      declarado: rows.filter((r) => r.estado === 'declarado' || r.estado === 'cerrado').length,
      prescrito: rows.filter((r) => r.estado === 'prescrito').length,
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => matchFilter(r, filter)), [rows, filter]);

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no hay ejercicios fiscales registrados. Atlas creará el ejercicio en curso
            automáticamente al detectar movimientos imputables.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.toolLab}>Mostrar</span>
        {(Object.keys(FILTER_LABEL) as Filter[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`${styles.pill} ${filter === k ? styles.active : ''}`}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {FILTER_LABEL[k]}
            <span className={styles.pillCount}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th>Estado</th>
              <th className={styles.right}>Resultado IRPF</th>
              <th>Última actualización</th>
              <th className={styles.center}>Prescribe</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.ejercicio}
                tabIndex={0}
                role="link"
                aria-label={`Abrir ejercicio ${r.ejercicio}`}
                onClick={() => navigate(`/fiscal/ejercicio/${r.ejercicio}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/fiscal/ejercicio/${r.ejercicio}`);
                  }
                }}
              >
                <td>
                  <span className={styles.year}>{r.ejercicio}</span>
                </td>
                <td>
                  <span className={`${styles.estadoChip} ${estadoChipClass(r)}`}>
                    {r.estadoLabel}
                  </span>
                </td>
                <td className={styles.right}>
                  {r.cuotaResultadoEur === 0 ? (
                    <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>
                  ) : (
                    <MoneyValue
                      value={r.cuotaResultadoEur}
                      decimals={2}
                      showSign
                      tone="auto"
                    />
                  )}
                </td>
                <td>{formatDateShort(r.fechaUltimaActualizacion)}</td>
                <td className={styles.center}>
                  {r.prescribeAnio ?? <span style={{ color: 'var(--atlas-v5-ink-4)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default EjerciciosPage;
