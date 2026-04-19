// src/pages/GestionInmuebles/venta/Step1DatosVenta.tsx
// Wizard Venta · Paso 1 — Datos de la venta
// Secciones: Aviso (si aplica) · Operación · Gastos de venta · Cuenta destino
// V4: sin rojos/amarillos/verdes; alert box usa teal-100 con borde teal-600.

import React from 'react';
import type { Account, Property } from '../../../services/db';
import { W, fontFamily, fmtEuro, inputStyle, labelStyle, sectionStyle, sectionTitleStyle, primaryButtonStyle, secondaryButtonStyle } from './wizardStyles';
import type { VentaWizardState } from './wizardTypes';

interface Step1Props {
  property: Property;
  accounts: Account[];
  sinIdentificarCount: number;
  state: VentaWizardState;
  onChange: (patch: Partial<VentaWizardState>) => void;
  onNext: () => void;
  onCancel: () => void;
}

const isPositive = (n: number): boolean => Number.isFinite(n) && n > 0;

const Step1DatosVenta: React.FC<Step1Props> = ({
  property,
  accounts,
  sinIdentificarCount,
  state,
  onChange,
  onNext,
  onCancel,
}) => {
  const canContinue =
    !!state.sellDate &&
    isPositive(state.salePrice) &&
    state.settlementAccountId !== '' &&
    state.settlementAccountId != null;

  const accountLabel = (acc: Account): string => {
    const name = acc.alias || acc.name || acc.banco?.name || 'Cuenta';
    const last4 = acc.iban ? acc.iban.replace(/\s+/g, '').slice(-4) : '';
    return last4 ? `${name} ·${last4}` : name;
  };

  return (
    <div style={{ fontFamily }}>
      {sinIdentificarCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            marginBottom: 16,
            background: W.teal100,
            borderLeft: `3px solid ${W.teal600}`,
            borderRadius: 8,
            color: W.grey900,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <strong>Aviso.</strong> Este inmueble tiene {sinIdentificarCount} año
            {sinIdentificarCount !== 1 ? 's' : ''} declarado
            {sinIdentificarCount !== 1 ? 's' : ''} fiscalmente sin vincular a
            contratos. Puedes vender igualmente; la vinculación pendiente quedará
            congelada con el inmueble ya vendido.
          </div>
        </div>
      )}

      {/* Operación */}
      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Operación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <Field label="Fecha de venta">
            <input
              type="date"
              value={state.sellDate}
              onChange={(e) => onChange({ sellDate: e.target.value })}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Precio de venta (€)">
            <input
              type="text"
              inputMode="decimal"
              value={state.salePriceInput}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = parseFloat(raw.replace(',', '.'));
                onChange({
                  salePriceInput: raw,
                  salePrice: Number.isFinite(parsed) ? parsed : 0,
                });
              }}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Comprador · NIF (opcional)" colSpan={2}>
            <input
              type="text"
              value={state.buyerNif}
              onChange={(e) => onChange({ buyerNif: e.target.value.toUpperCase() })}
              placeholder="B12345678"
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      {/* Gastos de venta */}
      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Gastos de venta</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <Field label="Comisión inmobiliaria">
            <NumberInput
              value={state.agencyCommissionInput}
              onChange={(raw, parsed) =>
                onChange({ agencyCommissionInput: raw, agencyCommission: parsed })
              }
            />
          </Field>
          <Field label="Notaría">
            <NumberInput
              value={state.saleNotaryInput}
              onChange={(raw, parsed) =>
                onChange({ saleNotaryInput: raw, saleNotary: parsed })
              }
            />
          </Field>
          <Field label="Registro">
            <NumberInput
              value={state.saleRegistryInput}
              onChange={(raw, parsed) =>
                onChange({ saleRegistryInput: raw, saleRegistry: parsed })
              }
            />
          </Field>
          <Field label="Plusvalía municipal" hint="Según ayuntamiento">
            <NumberInput
              value={state.municipalTaxInput}
              onChange={(raw, parsed) =>
                onChange({ municipalTaxInput: raw, municipalTax: parsed })
              }
            />
          </Field>
        </div>
        <div
          style={{
            marginTop: 10,
            textAlign: 'right',
            fontSize: 12,
            color: W.grey500,
          }}
        >
          Total gastos venta:{' '}
          <strong style={{ color: W.grey900, fontFamily: "'IBM Plex Mono', monospace" }}>
            {fmtEuro(
              (state.agencyCommission || 0) +
                (state.saleNotary || 0) +
                (state.saleRegistry || 0) +
                (state.municipalTax || 0),
            )}
          </strong>
        </div>
      </section>

      {/* Cuenta destino */}
      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Cuenta destino del neto</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'end' }}>
          <Field label="Cuenta">
            <select
              value={state.settlementAccountId === '' ? '' : String(state.settlementAccountId)}
              onChange={(e) =>
                onChange({
                  settlementAccountId: e.target.value ? Number(e.target.value) : '',
                })
              }
              required
              style={inputStyle}
            >
              <option value="">— Selecciona cuenta —</option>
              {accounts
                .filter((a) => a.status !== 'DELETED' && a.activa !== false)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={() => {
              window.open('/tesoreria', '_blank', 'noopener');
            }}
            style={{
              ...secondaryButtonStyle,
              height: 34,
              fontSize: 12,
              padding: '0 12px',
            }}
          >
            Crear cuenta bancaria
          </button>
        </div>
      </section>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          style={{
            ...primaryButtonStyle,
            opacity: canContinue ? 1 : 0.5,
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          Siguiente →
        </button>
      </div>

      {/* Reference to property for alias usage in Aviso */}
      <div style={{ display: 'none' }}>{property.alias}</div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  hint?: string;
  colSpan?: number;
  children: React.ReactNode;
}> = ({ label, hint, colSpan, children }) => (
  <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && (
      <span
        style={{ fontSize: 11, color: W.grey500, marginTop: 4, display: 'block' }}
      >
        {hint}
      </span>
    )}
  </div>
);

const NumberInput: React.FC<{
  value: string;
  onChange: (raw: string, parsed: number) => void;
}> = ({ value, onChange }) => (
  <input
    type="text"
    inputMode="decimal"
    value={value}
    onChange={(e) => {
      const raw = e.target.value;
      const parsed = parseFloat(raw.replace(',', '.'));
      onChange(raw, Number.isFinite(parsed) ? parsed : 0);
    }}
    style={inputStyle}
  />
);

export default Step1DatosVenta;
