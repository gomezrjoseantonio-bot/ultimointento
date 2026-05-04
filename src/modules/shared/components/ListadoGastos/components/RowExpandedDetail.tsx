import React from 'react';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';
import { expandirPatron } from '../../../../services/personal/patronCalendario';
import { computeMonthly } from '../../utils/compromisoUtils';
import { formatEur } from '../utils/amountFormatter';

const MESES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface RowExpandedDetailProps {
  compromiso: CompromisoRecurrente & { id: number };
}

const RowExpandedDetail: React.FC<RowExpandedDetailProps> = ({ compromiso: c }) => {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 12);
  const horizonStr = horizon.toISOString().slice(0, 10);

  let proximosCargos: Date[] = [];
  try {
    proximosCargos = expandirPatron(c.patron, from, horizonStr).slice(0, 6);
  } catch {
    proximosCargos = [];
  }

  const mensual = computeMonthly(c);

  return (
    <tr aria-label={`Detalle de ${c.alias}`}>
      <td
        colSpan={7}
        style={{ padding: '0 20px 14px', background: 'var(--atlas-v5-gold-wash-2)' }}
      >
        <div style={{ display: 'flex', gap: 24, paddingTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={detailTitle}>Datos del gasto</div>
            <dl style={dlStyle}>
              <dt style={dtStyle}>Proveedor</dt>
              <dd style={ddStyle}>{c.proveedor?.nombre || '—'}</dd>
              {c.proveedor?.nif && (
                <>
                  <dt style={dtStyle}>CIF/NIF</dt>
                  <dd style={ddStyle}>{c.proveedor.nif}</dd>
                </>
              )}
              {c.proveedor?.referencia && (
                <>
                  <dt style={dtStyle}>Referencia</dt>
                  <dd style={ddStyle}>{c.proveedor.referencia}</dd>
                </>
              )}
              <dt style={dtStyle}>Método pago</dt>
              <dd style={ddStyle}>{c.metodoPago}</dd>
              <dt style={dtStyle}>Inicio</dt>
              <dd style={ddStyle}>{c.fechaInicio}</dd>
              {c.fechaFin && (
                <>
                  <dt style={dtStyle}>Fin</dt>
                  <dd style={ddStyle}>{c.fechaFin}</dd>
                </>
              )}
              <dt style={dtStyle}>Mensual est.</dt>
              <dd style={{ ...ddStyle, color: 'var(--atlas-v5-neg)', fontWeight: 600 }}>
                {formatEur(mensual)}
              </dd>
            </dl>
          </div>

          {proximosCargos.length > 0 && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={detailTitle}>Próximos cargos (12 meses)</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {proximosCargos.map((d, i) => (
                  <li key={i} style={chargeItem}>
                    <span
                      style={{
                        color: 'var(--atlas-v5-ink-3)',
                        fontFamily: 'var(--atlas-v5-font-mono-tech)',
                        fontSize: 12,
                      }}
                    >
                      {d.getDate()} {MESES_SHORT[d.getMonth()]} {d.getFullYear()}
                    </span>
                    <span
                      style={{
                        color: 'var(--atlas-v5-neg)',
                        fontFamily: 'var(--atlas-v5-font-mono-num)',
                        fontSize: 12,
                      }}
                    >
                      {formatEur(mensual)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.notas && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={detailTitle}>Notas</div>
              <p style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)', margin: 0 }}>{c.notas}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

const detailTitle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 8,
};
const dlStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px 12px',
  margin: 0,
};
const dtStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  fontWeight: 500,
};
const ddStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-2)',
  margin: 0,
};
const chargeItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  borderBottom: '1px solid var(--atlas-v5-line-3)',
};

export default RowExpandedDetail;
