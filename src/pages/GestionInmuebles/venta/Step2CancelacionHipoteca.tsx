// src/pages/GestionInmuebles/venta/Step2CancelacionHipoteca.tsx
// Wizard Venta · Paso 2 — Cancelación hipoteca
// Auto-detecta préstamos vinculados al inmueble y permite editar la
// comisión final aplicada por préstamo (se negocia en notaría).

import React, { useEffect, useState } from 'react';
import type { Property } from '../../../services/db';
import { getLinkedLoansForPropertySale } from '../../../services/propertySaleService';
import {
  W,
  fontFamily,
  fmtEuro,
  inputStyle,
  labelStyle,
  sectionStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './wizardStyles';
import type { VentaWizardState, LoanToCancel } from './wizardTypes';

interface Step2Props {
  property: Property;
  state: VentaWizardState;
  onChange: (patch: Partial<VentaWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

const Step2CancelacionHipoteca: React.FC<Step2Props> = ({
  property,
  state,
  onChange,
  onBack,
  onNext,
}) => {
  const [loading, setLoading] = useState(!state.loansLoaded);

  useEffect(() => {
    if (state.loansLoaded) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getLinkedLoansForPropertySale(property.id!, state.sellDate);
        if (cancelled) return;
        const loansToCancel: LoanToCancel[] = rows.map((r) => ({
          loanId: r.loanId,
          alias: r.alias,
          banco: r.banco,
          outstandingPrincipal: r.outstandingPrincipal,
          comisionContrato: r.comisionContrato,
          comisionFinalAplicada: r.comisionContrato,
          comisionFinalAplicadaInput: r.comisionContrato
            ? String(r.comisionContrato.toFixed(2))
            : '0',
        }));
        onChange({ loansToCancel, loansLoaded: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.loansLoaded, property.id, state.sellDate, onChange]);

  const updateLoanCommission = (idx: number, raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    const sanitized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const next = state.loansToCancel.map((l, i) =>
      i === idx
        ? {
            ...l,
            comisionFinalAplicadaInput: raw,
            comisionFinalAplicada: sanitized,
          }
        : l,
    );
    onChange({ loansToCancel: next });
  };

  return (
    <div style={{ fontFamily }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: W.grey500 }}>
        Se detectan automáticamente los préstamos vinculados al inmueble. La
        fecha de cancelación es la fecha de venta. Puedes editar la comisión
        final aplicada (negociada en notaría).
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: W.grey500 }}>
          Detectando préstamos vinculados...
        </div>
      ) : state.loansToCancel.length === 0 ? (
        <section style={sectionStyle}>
          <div style={{ textAlign: 'center', padding: 24, color: W.grey500 }}>
            Sin préstamos vinculados a este inmueble.
          </div>
        </section>
      ) : (
        state.loansToCancel.map((loan, idx) => (
          <section key={loan.loanId} style={sectionStyle}>
            <div style={sectionTitleStyle}>Préstamo detectado</div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: W.grey900 }}>
                  {loan.alias}
                  {loan.banco ? ` · ${loan.banco}` : ''}
                </div>
                <div style={{ fontSize: 11, color: W.grey500, marginTop: 2 }}>
                  ID {loan.loanId}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: W.grey500,
                    letterSpacing: '.06em',
                  }}
                >
                  Saldo vivo
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: W.grey900,
                    marginTop: 2,
                  }}
                >
                  {fmtEuro(loan.outstandingPrincipal)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Fecha cancelación</label>
                <input
                  type="date"
                  value={state.sellDate}
                  readOnly
                  style={{
                    ...inputStyle,
                    background: W.grey50,
                    color: W.grey500,
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Comisión contrato</label>
                <input
                  type="text"
                  value={fmtEuro(loan.comisionContrato)}
                  readOnly
                  style={{
                    ...inputStyle,
                    background: W.grey50,
                    color: W.grey500,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                />
                <span
                  style={{ fontSize: 11, color: W.grey500, marginTop: 4, display: 'block' }}
                >
                  Del préstamo
                </span>
              </div>
              <div>
                <label style={labelStyle}>Comisión final aplicada</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={loan.comisionFinalAplicadaInput}
                  onChange={(e) => updateLoanCommission(idx, e.target.value)}
                  style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }}
                />
                <span
                  style={{ fontSize: 11, color: W.grey500, marginTop: 4, display: 'block' }}
                >
                  Editable · se negocia en notaría
                </span>
              </div>
            </div>
          </section>
        ))
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>
          ← Anterior
        </button>
        <button type="button" onClick={onNext} style={primaryButtonStyle}>
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default Step2CancelacionHipoteca;
