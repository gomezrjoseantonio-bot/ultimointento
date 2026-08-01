/**
 * P0 · DUPLICACIÓN DE PREVISIONES · página DEV-only `/dev/previsiones-duplicadas`.
 *
 * Cuenta primero, informa después y solo limpia si se le dice explícitamente.
 * La limpieza retira ÚNICAMENTE previsiones `predicted` vivas sobrantes; las
 * duplicadas confirmadas, conciliadas o descartadas se listan aparte y no se
 * tocan (pueden ser un cargo real repetido).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { showToastV5 } from '../../design-system/v5';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import {
  contarPrevisionesDuplicadas,
  limpiarPrevisionesDuplicadas,
  formatearReporte,
  type ReportePrevisionesDuplicadas,
} from '../../services/__previsionesDuplicadasAudit';

const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const PrevisionesDuplicadas: React.FC = () => {
  const [reporte, setReporte] = useState<ReportePrevisionesDuplicadas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaLimpieza, setUltimaLimpieza] = useState<string | null>(null);
  // Ensayo en seco pendiente de confirmar · informar ANTES de tocar nada.
  const [enSeco, setEnSeco] = useState<{ retiradas: number; revisionManual: number } | null>(null);

  const contar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setReporte(await contarPrevisionesDuplicadas());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void contar();
  }, [contar]);

  /** Paso 1 · ensayo en seco: dice qué se retiraría, sin tocar nada. */
  const proponerLimpieza = useCallback(async () => {
    try {
      const seco = await limpiarPrevisionesDuplicadas();
      setEnSeco({ retiradas: seco.retiradas, revisionManual: seco.pendientesRevisionManual });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /** Paso 2 · retirada real · solo `predicted` vivas sobrantes. */
  const ejecutarLimpieza = useCallback(async () => {
    setCargando(true);
    try {
      const res = await limpiarPrevisionesDuplicadas({ confirmar: true });
      setUltimaLimpieza(`Retiradas ${res.retiradas} previsiones · IDs: ${res.ids.join(', ') || '—'}`);
      showToastV5(`Retiradas ${res.retiradas} previsiones duplicadas`, 'success');
      setEnSeco(null);
      await contar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      showToastV5('No se pudo limpiar · nada se ha borrado', 'error');
    } finally {
      setCargando(false);
    }
  }, [contar]);

  return (
    <div style={{ padding: 24, fontFamily: 'var(--atlas-v5-font-ui)', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Previsiones duplicadas</h1>
      <p style={{ color: 'var(--atlas-v5-ink-3)', fontSize: 14, marginTop: 0 }}>
        Agrupa por clave de origen (<code>origen · id · año-mes · cuenta</code>). Solo puede haber una
        previsión viva por clave. Contar no toca nada.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button type="button" onClick={() => void contar()} disabled={cargando} style={btn}>
          {cargando ? 'Contando…' : 'Volver a contar'}
        </button>
        <button
          type="button"
          onClick={() => void proponerLimpieza()}
          disabled={cargando || !reporte || reporte.sobrantesLimpiables === 0}
          style={{ ...btn, borderColor: 'var(--atlas-v5-gold)', color: 'var(--atlas-v5-gold-ink)' }}
        >
          Limpiar sobrantes (solo predicted)
        </button>
        {reporte && (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(formatearReporte(reporte))}
            style={btn}
          >
            Copiar resumen
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--atlas-v5-neg)', marginBottom: 12 }}>Error: {error}</div>}
      {ultimaLimpieza && <div style={{ color: 'var(--atlas-v5-pos-dark)', marginBottom: 12 }}>{ultimaLimpieza}</div>}

      {reporte && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Kpi label="Eventos examinados" value={String(reporte.eventosExaminados)} />
            <Kpi label="Grupos duplicados" value={String(reporte.grupos.length)} />
            <Kpi label="Sobrantes limpiables" value={String(reporte.sobrantesLimpiables)} />
            <Kpi label="Revisión manual" value={String(reporte.sobrantesRevisionManual)} />
            <Kpi label="Distorsión de cierres" value={eur(reporte.importeSobranteTotal)} />
          </div>

          {reporte.grupos.length === 0 ? (
            <p style={{ marginTop: 24, color: 'var(--atlas-v5-pos-dark)' }}>
              Sin duplicados. Ejecutar de nuevo tras editar gastos recurrentes debe seguir dando 0.
            </p>
          ) : (
            <>
              <h2 style={h2}>Impacto por mes</h2>
              <table style={tabla}>
                <thead>
                  <tr>
                    <Th>Periodo</Th>
                    <Th>Grupos</Th>
                    <Th align="right">Importe sobrante</Th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.impactoPorMes.map((m) => (
                    <tr key={m.periodo}>
                      <Td>{m.periodo}</Td>
                      <Td>{m.gruposAfectados}</Td>
                      <Td align="right">{eur(m.importeSobrante)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 style={h2}>Grupos</h2>
              <table style={tabla}>
                <thead>
                  <tr>
                    <Th>Clave de origen</Th>
                    <Th>Tipo</Th>
                    <Th>Eventos</Th>
                    <Th align="right">Sobrante</Th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.grupos.map((g) => (
                    <tr key={g.clave}>
                      <Td>
                        <code style={{ fontSize: 12 }}>{g.clave}</code>
                        <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 4 }}>
                          {g.eventos
                            .map(
                              (e) =>
                                `#${e.id} ${e.predictedDate} ${eur(e.amount)} ${e.status}` +
                                `${e.descartado ? ' (descartado)' : ''}${e.conciliado ? ' (conciliado)' : ''} → ${e.destino}`,
                            )
                            .join(' · ')}
                        </div>
                      </Td>
                      <Td>{g.exacto ? 'exacto' : 'mismo periodo'}</Td>
                      <Td>{g.sobrantes}</Td>
                      <Td align="right">{eur(g.importeSobrante)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {enSeco && (
        <ConfirmationModal
          isOpen={true}
          title="Retirar previsiones duplicadas"
          message={
            `Se retirarían ${enSeco.retiradas} previsiones duplicadas · solo las «predicted» vivas. ` +
            `${enSeco.revisionManual} duplicadas confirmadas, conciliadas o descartadas quedan INTACTAS: ` +
            'pueden corresponder a un cargo real repetido y se revisan una a una.'
          }
          confirmText="Retirar"
          cancelText="Cancelar"
          onConfirm={() => void ejecutarLimpieza()}
          onClose={() => setEnSeco(null)}
          isLoading={cargando}
          variant="danger"
        />
      )}
    </div>
  );
};

const btn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const tabla: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align }) => (
  <th style={{ textAlign: align ?? 'left', padding: '8px 10px', borderBottom: '2px solid var(--atlas-v5-line-2)' }}>
    {children}
  </th>
);
const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align }) => (
  <td style={{ textAlign: align ?? 'left', padding: '8px 10px', borderBottom: '1px solid var(--atlas-v5-line-3)', verticalAlign: 'top' }}>
    {children}
  </td>
);

const Kpi: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ border: '1px solid var(--atlas-v5-line-2)', borderRadius: 10, padding: 12 }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atlas-v5-ink-4)' }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
  </div>
);

export default PrevisionesDuplicadas;
