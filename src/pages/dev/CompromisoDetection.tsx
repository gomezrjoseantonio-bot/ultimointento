import React, { useEffect, useState } from 'react';
import {
  detectCompromisos,
  type CandidatoCompromiso,
  type DetectionOptions,
  type DetectionReport,
} from '../../services/compromisoDetectionService';
import styles from './CompromisoDetection.module.css';

function fmtImporte(value: number): string {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

function patronToText(patron: CandidatoCompromiso['patronInferido']): string {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return `mensual día ${patron.dia}`;
    case 'mensualDiaRelativo':
      return `mensual ${patron.referencia}`;
    case 'cadaNMeses':
      return `cada ${patron.cadaNMeses} meses · día ${patron.dia}`;
    case 'trimestralFiscal':
      return `trimestral fiscal · día ${patron.diaPago}`;
    case 'anualMesesConcretos':
      return `anual · meses [${patron.mesesPago.join(', ')}] · día ${patron.diaPago}`;
    case 'pagasExtra':
      return `pagas extra · meses [${patron.mesesExtra.join(', ')}]`;
    case 'variablePorMes':
      return `variable por mes · ${patron.mesesPago.length} meses`;
    case 'puntual':
      return `puntual · ${patron.fecha}`;
    default:
      return JSON.stringify(patron);
  }
}

function importeToText(importe: CandidatoCompromiso['importeInferido']): string {
  switch (importe.modo) {
    case 'fijo':
      return `${fmtImporte(importe.importe)} · fijo`;
    case 'variable':
      return `${fmtImporte(importe.importeMedio)} · variable`;
    case 'diferenciadoPorMes':
      return `por mes · 12 valores`;
    case 'porPago':
      return `por pago · ${Object.keys(importe.importesPorPago).length} fechas`;
    default:
      return JSON.stringify(importe);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface RowProps {
  candidato: CandidatoCompromiso;
}

const Row: React.FC<RowProps> = ({ candidato }) => {
  const [showOcurrencias, setShowOcurrencias] = useState(false);
  const [showPropuesta, setShowPropuesta] = useState(false);

  const fillClass = (() => {
    if (candidato.confidence >= 80) return '';
    if (candidato.confidence >= 65) return styles.scoreBarFillMid;
    return styles.scoreBarFillLow;
  })();

  const ocurrenciasPanelId = `ocurrencias-${candidato.id}`;
  const propuestaPanelId = `propuesta-${candidato.id}`;

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600 }}>{candidato.propuesta.alias}</div>
          <div className={styles.muted}>{candidato.conceptoNormalizado}</div>
        </td>
        <td>
          <span className={styles.chip}>{candidato.propuesta.tipo}</span>
          {candidato.propuesta.subtipo && (
            <span className={styles.chip}>{candidato.propuesta.subtipo}</span>
          )}
        </td>
        <td className={styles.muted}>cuenta {candidato.cuentaCargo}</td>
        <td>{candidato.ocurrencias.length}</td>
        <td>{patronToText(candidato.patronInferido)}</td>
        <td>{importeToText(candidato.importeInferido)}</td>
        <td>
          <div>
            <span className={styles.scoreBar}>
              <span
                className={`${styles.scoreBarFill} ${fillClass}`}
                style={{ width: `${candidato.confidence}%` }}
              />
            </span>
            <span className={styles.scoreValue}>{candidato.confidence}</span>
          </div>
          <div className={styles.muted}>{candidato.razonesScore.join(' · ')}</div>
        </td>
        <td>
          {candidato.avisos.length === 0 ? (
            <span className={styles.muted}>—</span>
          ) : (
            candidato.avisos.map((a, i) => (
              <div key={i} className={`${styles.chip} ${styles.chipWarn}`}>
                {a}
              </div>
            ))
          )}
        </td>
        <td>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowOcurrencias((v) => !v)}
            aria-expanded={showOcurrencias}
            aria-controls={ocurrenciasPanelId}
          >
            {showOcurrencias ? 'Ocultar ocurrencias' : 'Ocurrencias'}
          </button>{' '}
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowPropuesta((v) => !v)}
            aria-expanded={showPropuesta}
            aria-controls={propuestaPanelId}
          >
            {showPropuesta ? 'Ocultar propuesta' : 'Propuesta JSON'}
          </button>
        </td>
      </tr>
      {showOcurrencias && (
        <tr>
          <td colSpan={9}>
            <div
              id={ocurrenciasPanelId}
              className={styles.expandPanel}
              role="region"
              aria-label={`Ocurrencias de ${candidato.propuesta.alias}`}
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>Descripción raw</th>
                    <th>movementId</th>
                  </tr>
                </thead>
                <tbody>
                  {candidato.ocurrencias.map((o) => (
                    <tr key={o.movementId}>
                      <td>{o.fecha.slice(0, 10)}</td>
                      <td>{fmtImporte(o.importe)}</td>
                      <td className={styles.muted}>{o.descripcionRaw}</td>
                      <td className={styles.muted}>{o.movementId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
      {showPropuesta && (
        <tr>
          <td colSpan={9}>
            <div
              id={propuestaPanelId}
              className={styles.expandPanel}
              role="region"
              aria-label={`Propuesta JSON de ${candidato.propuesta.alias}`}
            >
              <pre>{safeStringify(candidato.propuesta)}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const CompromisoDetection: React.FC = () => {
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minOcurrencias, setMinOcurrencias] = useState<number>(3);
  const [maxAntiguedadMeses, setMaxAntiguedadMeses] = useState<number>(18);

  const runDetection = async (opts?: DetectionOptions) => {
    setLoading(true);
    setError(null);
    try {
      const r = await detectCompromisos(opts);
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Atlas · Detección de compromisos · T9.1</h1>
        <p className={styles.lead}>
          Servicio <code>compromisoDetectionService</code> · solo lectura · analiza
          el store <code>movements</code> y propone candidatos a{' '}
          <code>CompromisoRecurrente</code> sin escribir nada. Sub-tarea 9.1 ·
          la aprobación y persistencia se implementan en 9.2/9.3.
        </p>
        <div className={styles.devNotice}>
          DEV ONLY · esta página no se sirve en producción · ruta{' '}
          <code>/dev/compromiso-detection</code>.
        </div>
      </header>

      <section className={styles.section}>
        <h2>Configuración</h2>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label htmlFor="min-ocurrencias">Mínimo ocurrencias</label>
            <input
              id="min-ocurrencias"
              type="number"
              min={2}
              max={24}
              value={minOcurrencias}
              onChange={(e) => setMinOcurrencias(Number(e.target.value))}
            />
          </div>
          <div className={styles.controlGroup}>
            <label htmlFor="max-antiguedad">Antigüedad (meses)</label>
            <select
              id="max-antiguedad"
              value={maxAntiguedadMeses}
              onChange={(e) => setMaxAntiguedadMeses(Number(e.target.value))}
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={18}>18</option>
              <option value={24}>24</option>
              <option value={36}>36</option>
            </select>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={loading}
            onClick={() =>
              void runDetection({ minOcurrencias, maxAntiguedadMeses })
            }
          >
            {loading ? 'Analizando…' : 'Analizar movimientos'}
          </button>
        </div>
        {error && <p className={styles.error}>Error · {error}</p>}
      </section>

      {report && (
        <section className={styles.section}>
          <h2>Estadísticas globales</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.label}>Movements en DB</div>
              <div className={styles.value}>{report.estadisticas.movementsEnDB}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.label}>Analizados</div>
              <div className={styles.value}>{report.estadisticas.movementsAnalizados}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.label}>En cluster</div>
              <div className={styles.value}>{report.estadisticas.movementsAgrupados}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.label}>Sin cluster</div>
              <div className={styles.value}>{report.estadisticas.movementsDescartados}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.label}>Clusters</div>
              <div className={styles.value}>{report.estadisticas.clustersTotales}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.label}>Candidatos</div>
              <div className={styles.value}>{report.estadisticas.candidatosPropuestos}</div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardWarn}`}>
              <div className={styles.label}>Filtr · vivienda hab.</div>
              <div className={styles.value}>
                {report.estadisticas.candidatosFiltrados.porViviendaHabitual}
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardWarn}`}>
              <div className={styles.label}>Filtr · inmueble inv.</div>
              <div className={styles.value}>
                {report.estadisticas.candidatosFiltrados.porInmuebleInversion}
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardWarn}`}>
              <div className={styles.label}>Filtr · ya existente</div>
              <div className={styles.value}>
                {report.estadisticas.candidatosFiltrados.porCompromisoExistente}
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardWarn}`}>
              <div className={styles.label}>Filtr · score &lt; 60</div>
              <div className={styles.value}>
                {report.estadisticas.candidatosFiltrados.porScoreInsuficiente}
              </div>
            </div>
          </div>

          {report.warnings.length > 0 && (
            <div className={styles.warningsList}>
              <strong>Warnings · clusters descartados sin patrón conocido</strong>
              <ul>
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {report && (
        <section className={styles.section}>
          <h2>Candidatos · {report.candidatos.length}</h2>
          {report.candidatos.length === 0 ? (
            <p className={styles.muted}>
              Sin candidatos propuestos en este run · revisa estadísticas para
              ver el motivo.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Alias / concepto</th>
                    <th>Tipo</th>
                    <th>Cuenta</th>
                    <th>Ocurr.</th>
                    <th>Patrón</th>
                    <th>Importe</th>
                    <th>Score · razones</th>
                    <th>Avisos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {report.candidatos.map((c) => (
                    <Row key={c.id} candidato={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default CompromisoDetection;
