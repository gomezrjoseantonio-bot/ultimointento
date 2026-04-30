import React, { useEffect, useState } from 'react';
import {
  auditFiscalContext,
  type FiscalContextAuditReport,
  type FiscalFieldAudit,
  type FiscalSiteStatus,
} from '../../services/__fiscalContextAudit';
import styles from './FiscalContextAudit.module.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const STATUS_LABEL: Record<FiscalSiteStatus, string> = {
  populated: 'poblado',
  empty: 'vacío',
  not_found: 'no encontrado',
};

const STATUS_CLASS: Record<FiscalSiteStatus, string> = {
  populated: styles.statusPopulated,
  empty: styles.statusEmpty,
  not_found: styles.statusNotFound,
};

// ─── Fila de campo con botón "Mostrar valor" ──────────────────────────────────

interface FieldRowProps {
  entry: FiscalFieldAudit;
  rawValue: unknown;
}

const FieldRow: React.FC<FieldRowProps> = ({ entry, rawValue }) => {
  const [expanded, setExpanded] = useState(false);
  const [valueJson] = useState(() => safeStringify(rawValue));
  const panelId = `fiscal-audit-panel-${entry.field.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <>
      <tr>
        <td className={styles.fieldCell}>{entry.field}</td>
        <td>
          {entry.present ? (
            <span className={styles.presentYes}>✓ sí</span>
          ) : (
            <span className={styles.presentNo}>✗ no</span>
          )}
        </td>
        <td className={styles.fieldCell}>{entry.valueType}</td>
        <td>{formatBytes(entry.byteSize)}</td>
        <td className={styles.noteCell}>{entry.note ?? '—'}</td>
        <td>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            {expanded ? 'Ocultar' : 'Mostrar valor'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6}>
            <div
              id={panelId}
              className={styles.valuePanel}
              role="region"
              aria-label={`Valor de ${entry.field}`}
            >
              <pre>{valueJson}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Tabla de campos de un sitio ──────────────────────────────────────────────

interface SiteTableProps {
  fields: FiscalFieldAudit[];
  rawRecord: Record<string, unknown> | null;
}

const SiteTable: React.FC<SiteTableProps> = ({ fields, rawRecord }) => {
  if (fields.length === 0) {
    return <p className={styles.muted}>No hay campos para mostrar.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Presente</th>
            <th>Tipo</th>
            <th>Tamaño</th>
            <th>Nota</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <FieldRow
              key={f.field}
              entry={f}
              rawValue={rawRecord?.[f.field]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const FiscalContextAudit: React.FC = () => {
  const [report, setReport] = useState<FiscalContextAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await auditFiscalContext();
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

  const pdRecord = (report?.personalData.record ?? null) as Record<string, unknown> | null;
  const pmcRecord = (report?.personalModuleConfig.record ?? null) as Record<string, unknown> | null;
  const vhRecord = (report?.viviendaHabitual.viviendaActiva ?? null) as Record<string, unknown> | null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Atlas · Auditoría Contexto Fiscal · T14.1</h1>
        <p className={styles.lead}>
          Inspecciona en runtime los 4 sitios donde vive información fiscal en
          IndexedDB: <code>personalData</code> · <code>personalModuleConfig</code> ·{' '}
          <code>viviendaHabitual</code> · <code>keyval['configFiscal']</code>.
          Base para la decisión del enfoque T14.2.
        </p>
        <div className={styles.devNotice}>
          DEV ONLY · esta página no se sirve en producción · ruta{' '}
          <code>/dev/fiscal-context-audit</code>
        </div>
      </header>

      {/* Resumen */}
      <section className={styles.section}>
        <h2>Resumen</h2>
        {loading && <p className={styles.muted}>Ejecutando auditoría…</p>}
        {error && <p className={styles.error}>Error · {error}</p>}
        {report && !loading && (
          <>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.label}>personalData</div>
                <div className={styles.value}>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[report.personalData.status]}`}>
                    {STATUS_LABEL[report.personalData.status]}
                  </span>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>personalModuleConfig</div>
                <div className={styles.value}>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[report.personalModuleConfig.status]}`}>
                    {STATUS_LABEL[report.personalModuleConfig.status]}
                  </span>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>viviendaHabitual</div>
                <div className={styles.value}>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[report.viviendaHabitual.status]}`}>
                    {STATUS_LABEL[report.viviendaHabitual.status]}
                  </span>
                  {report.viviendaHabitual.totalRegistros > 0 && (
                    <span className={styles.muted}> · {report.viviendaHabitual.totalRegistros} reg.</span>
                  )}
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>keyval[configFiscal]</div>
                <div className={styles.value}>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[report.configFiscalKeyval.status]}`}>
                    {STATUS_LABEL[report.configFiscalKeyval.status]}
                  </span>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Inconsistencias</div>
                <div className={styles.value}>{report.inconsistencias.length}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.label}>Gaps críticos</div>
                <div className={styles.value}>{report.gapsCriticos.length}</div>
              </div>
            </div>
            <p className={styles.metaRow}>
              Generado: {report.generatedAt}
            </p>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => void runAudit()}
              style={{ marginTop: 12 }}
            >
              Refrescar auditoría
            </button>
          </>
        )}
      </section>

      {/* Alertas */}
      {report && (report.gapsCriticos.length > 0 || report.inconsistencias.length > 0) && (
        <section className={styles.section}>
          <h2>Alertas</h2>
          {report.gapsCriticos.length > 0 && (
            <>
              <p className={styles.sectionSub}>Gaps críticos · campos fiscales no poblados que afectan a cálculos IRPF</p>
              <ul className={styles.alertList}>
                {report.gapsCriticos.map((g, i) => (
                  <li key={i} className={styles.alertGap}>{g}</li>
                ))}
              </ul>
            </>
          )}
          {report.inconsistencias.length > 0 && (
            <>
              <p className={styles.sectionSub} style={{ marginTop: 12 }}>
                Inconsistencias detectadas entre sitios
              </p>
              <ul className={styles.alertList}>
                {report.inconsistencias.map((inc, i) => (
                  <li key={i} className={styles.alertInconsistencia}>{inc}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* personalData */}
      <section className={styles.section}>
        <h2>
          Store <code>personalData</code>
          {report && (
            <span className={`${styles.statusBadge} ${STATUS_CLASS[report.personalData.status]}`}>
              {STATUS_LABEL[report.personalData.status]}
            </span>
          )}
        </h2>
        <p className={styles.sectionSub}>
          Fuente principal de información fiscal · CORE FISCAL · 14+ consumidores identificados
        </p>
        {loading && <p className={styles.muted}>Cargando…</p>}
        {report && (
          <SiteTable fields={report.personalData.fiscalFields} rawRecord={pdRecord} />
        )}
      </section>

      {/* personalModuleConfig */}
      <section className={styles.section}>
        <h2>
          Store <code>personalModuleConfig</code>
          {report && (
            <span className={`${styles.statusBadge} ${STATUS_CLASS[report.personalModuleConfig.status]}`}>
              {STATUS_LABEL[report.personalModuleConfig.status]}
            </span>
          )}
        </h2>
        <p className={styles.sectionSub}>
          Flags UI/integración derivados automáticamente de personalData · NO contiene información fiscal real · NO migrará en T14
        </p>
        {loading && <p className={styles.muted}>Cargando…</p>}
        {report && (
          <SiteTable fields={report.personalModuleConfig.fields} rawRecord={pmcRecord} />
        )}
      </section>

      {/* viviendaHabitual */}
      <section className={styles.section}>
        <h2>
          Store <code>viviendaHabitual</code>
          {report && (
            <span className={`${styles.statusBadge} ${STATUS_CLASS[report.viviendaHabitual.status]}`}>
              {STATUS_LABEL[report.viviendaHabitual.status]}
            </span>
          )}
        </h2>
        <p className={styles.sectionSub}>
          Datos catastral/adquisición/IBI fiscalmente relevantes · sin consumidor activo en irpfCalc aún (GAP §5.3)
        </p>
        {loading && <p className={styles.muted}>Cargando…</p>}
        {report && report.viviendaHabitual.status === 'not_found' && (
          <p className={styles.muted}>Sin registros en viviendaHabitual.</p>
        )}
        {report && report.viviendaHabitual.status !== 'not_found' && (
          <SiteTable fields={report.viviendaHabitual.fiscalFields} rawRecord={vhRecord} />
        )}
      </section>

      {/* keyval configFiscal */}
      <section className={styles.section}>
        <h2>
          <code>keyval['configFiscal']</code>
          {report && (
            <span className={`${styles.statusBadge} ${STATUS_CLASS[report.configFiscalKeyval.status]}`}>
              {STATUS_LABEL[report.configFiscalKeyval.status]}
            </span>
          )}
        </h2>
        <p className={styles.sectionSub}>
          Documentada en db.ts JSDoc · sin escritor activo · T15.1 audit confirmó que está vacía · T14.2 decidirá si eliminarla
        </p>
        {loading && <p className={styles.muted}>Cargando…</p>}
        {report && (
          <>
            <p className={styles.muted}>{report.configFiscalKeyval.note}</p>
            {report.configFiscalKeyval.status === 'populated' && (
              <div className={styles.valuePanel} style={{ marginTop: 12 }}>
                <pre>{safeStringify(report.configFiscalKeyval.value)}</pre>
              </div>
            )}
            <p className={styles.metaRow}>Tamaño: {formatBytes(report.configFiscalKeyval.byteSize)}</p>
          </>
        )}
      </section>
    </div>
  );
};

export default FiscalContextAudit;
