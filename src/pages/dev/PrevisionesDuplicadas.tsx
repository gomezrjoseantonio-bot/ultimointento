/**
 * P0 · DUPLICACIÓN DE PREVISIONES · página DEV-only `/dev/previsiones-duplicadas`.
 *
 * Cuenta primero, informa después y solo limpia si se le dice explícitamente.
 * La limpieza retira ÚNICAMENTE previsiones `predicted` vivas sobrantes; las
 * duplicadas confirmadas, conciliadas o descartadas se listan aparte y no se
 * tocan (pueden ser un cargo real repetido).
 */

import React, { useCallback, useEffect, useState } from 'react';
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

  const limpiar = useCallback(async () => {
    const seco = await limpiarPrevisionesDuplicadas();
    const ok = window.confirm(
      `Se van a retirar ${seco.retiradas} previsiones duplicadas (solo predicted vivas).\n` +
        `${seco.pendientesRevisionManual} duplicadas confirmadas/conciliadas quedan intactas para revisión manual.\n\n` +
        '¿Continuar?',
    );
    if (!ok) return;
    setCargando(true);
    try {
      const res = await limpiarPrevisionesDuplicadas({ confirmar: true });
      setUltimaLimpieza(`Retiradas ${res.retiradas} previsiones · IDs: ${res.ids.join(', ') || '—'}`);
      await contar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [contar]);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Previsiones duplicadas</h1>
      <p style={{ color: '#555', fontSize: 14, marginTop: 0 }}>
        Agrupa por clave de origen (<code>origen · id · año-mes · cuenta</code>). Solo puede haber una
        previsión viva por clave. Contar no toca nada.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button type="button" onClick={() => void contar()} disabled={cargando} style={btn}>
          {cargando ? 'Contando…' : 'Volver a contar'}
        </button>
        <button
          type="button"
          onClick={() => void limpiar()}
          disabled={cargando || !reporte || reporte.sobrantesLimpiables === 0}
          style={{ ...btn, borderColor: '#b45309', color: '#b45309' }}
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

      {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>Error: {error}</div>}
      {ultimaLimpieza && <div style={{ color: '#065f46', marginBottom: 12 }}>{ultimaLimpieza}</div>}

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
            <p style={{ marginTop: 24, color: '#065f46' }}>
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
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
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
    </div>
  );
};

const btn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const tabla: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align }) => (
  <th style={{ textAlign: align ?? 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb' }}>
    {children}
  </th>
);
const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align }) => (
  <td style={{ textAlign: align ?? 'left', padding: '8px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
    {children}
  </td>
);

const Kpi: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280' }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
  </div>
);

export default PrevisionesDuplicadas;
