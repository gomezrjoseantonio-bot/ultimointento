import React, { useEffect, useMemo, useState } from 'react';
import {
  auditKeyval,
  readKeyvalValue,
  type KeyvalAuditEntry,
  type KeyvalAuditReport,
  type KeyvalCategory,
} from '../../services/__keyvalAudit';
import styles from './KeyvalAudit.module.css';

const CATEGORY_LABELS: Record<KeyvalCategory, string> = {
  A: 'Configuración',
  B: 'Cache',
  C: 'Datos usuario',
  D: 'Flag migración',
  unknown: 'Desconocida',
};

const CATEGORY_CLASS: Record<KeyvalCategory, string> = {
  A: styles.catA,
  B: styles.catB,
  C: styles.catC,
  D: styles.catD,
  unknown: styles.catUnknown,
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface RowProps {
  entry: KeyvalAuditEntry;
}

const Row: React.FC<RowProps> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<unknown>(undefined);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (value !== undefined) return;
    setLoading(true);
    setError(null);
    try {
      const res = await readKeyvalValue(entry.key);
      setValue(res.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const recClass = (() => {
    switch (entry.recommendation) {
      case 'KEEP':
        return styles.recKEEP;
      case 'DELETE':
        return styles.recDELETE;
      case 'MOVE':
        return styles.recMOVE;
      case 'TODO_T14':
        return styles.recTODO_T14;
      case 'TODO_PROYECCION':
        return styles.recTODO_PROYECCION;
      case 'TODO_REVIEW':
      default:
        return styles.recTODO_REVIEW;
    }
  })();

  return (
    <>
      <tr>
        <td className={styles.keyCell}>{entry.key}</td>
        <td>
          <span className={`${styles.cat} ${CATEGORY_CLASS[entry.category]}`}>
            {entry.category} · {CATEGORY_LABELS[entry.category]}
          </span>
        </td>
        <td>{entry.valueType}</td>
        <td>{formatBytes(entry.byteSize)}</td>
        <td>
          <span className={`${styles.rec} ${recClass}`}>{entry.recommendation}</span>
        </td>
        <td className={styles.muted}>{entry.reason}</td>
        <td>
          <button type="button" className={styles.actionBtn} onClick={handleToggle}>
            {expanded ? 'Ocultar' : 'Mostrar valor'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7}>
            <div className={styles.valuePanel}>
              {loading && <span className={styles.muted}>Cargando…</span>}
              {error && <span className={styles.error}>Error · {error}</span>}
              {!loading && !error && (
                <pre>{safeStringify(value)}</pre>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const KeyvalAudit: React.FC = () => {
  const [report, setReport] = useState<KeyvalAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await auditKeyval();
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runAudit();
  }, []);

  const totalBytes = useMemo(() => {
    if (!report) return 0;
    return report.entries.reduce((sum, e) => sum + e.byteSize, 0);
  }, [report]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Atlas · Auditoría keyval · T15.1</h1>
        <p className={styles.lead}>
          Lista todas las claves vivas en el store IndexedDB <code>keyval</code> con
          su clasificación A/B/C/D y la recomendación de saneamiento. Base para
          la decisión de Jose antes de las sub-tareas 15.2 (limpieza) y 15.3
          (migración planpagos_*).
        </p>
        <div className={styles.devNotice}>
          DEV ONLY · esta página no se sirve en producción · ruta `/dev/keyval-audit`.
        </div>
      </header>

      <section className={styles.section}>
        <h2>Resumen</h2>
        {loading && <p className={styles.muted}>Ejecutando auditoría…</p>}
        {error && <p className={styles.error}>Error · {error}</p>}
        {report && !loading && (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Total claves</div>
                <div className={styles.value}>{report.totalKeys}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Cat A · config</div>
                <div className={styles.value}>{report.byCategory.A}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Cat B · cache</div>
                <div className={styles.value}>{report.byCategory.B}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Cat C · datos usuario</div>
                <div className={styles.value}>{report.byCategory.C}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Cat D · flags</div>
                <div className={styles.value}>{report.byCategory.D}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Desconocidas</div>
                <div className={styles.value}>{report.byCategory.unknown}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Tamaño total</div>
                <div className={styles.value}>{formatBytes(totalBytes)}</div>
              </div>
            </div>
            <p className={styles.muted} style={{ marginTop: 16 }}>
              Botón <code>Refrescar</code> para volver a leer la DB tras
              modificaciones manuales en DevTools.
            </p>
            <button type="button" className={styles.actionBtn} onClick={() => void runAudit()}>
              Refrescar auditoría
            </button>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2>Claves</h2>
        {report && report.entries.length === 0 && !loading && (
          <p className={styles.muted}>El store keyval está vacío.</p>
        )}
        {report && report.entries.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Categoría</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th>Recomendación</th>
                  <th>Razón</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {report.entries.map((entry) => (
                  <Row key={entry.key} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report && report.unknownKeys.length > 0 && (
        <section className={styles.section}>
          <h2>Claves no clasificadas · requieren input Jose</h2>
          <p className={styles.muted}>
            Estas claves no aparecen en el catálogo de T15.1 · clasificarlas
            antes de avanzar a sub-tarea 15.2.
          </p>
          <ul>
            {report.unknownKeys.map((k) => (
              <li key={k} className={styles.keyCell}>{k}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default KeyvalAudit;
