// src/pages/GestionInmuebles/venta/Step3Confirmar.tsx
// Wizard Venta · Paso 3 — Confirmar y generar
// Bloques: Cálculo fiscal · Preview movimientos Tesorería · También se aplicará

import React, { useEffect, useState } from 'react';
import type { Account, Property } from '../../../services/db';
import {
  calcularGananciaPatrimonial,
  type GananciaPatrimonialResult,
} from '../../../services/gananciaPatrimonialService';
import {
  W,
  fontFamily,
  fmtEuro,
  fmtEuroSigned,
  sectionStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './wizardStyles';
import type { VentaWizardState } from './wizardTypes';

interface Step3Props {
  property: Property;
  accounts: Account[];
  state: VentaWizardState;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: (fiscalSnapshot: GananciaPatrimonialResult) => Promise<void>;
}

const Step3Confirmar: React.FC<Step3Props> = ({
  property,
  accounts,
  state,
  onBack,
  onCancel,
  onConfirm,
}) => {
  const [result, setResult] = useState<GananciaPatrimonialResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await calcularGananciaPatrimonial({
          propertyId: property.id!,
          sellDate: state.sellDate,
          salePrice: state.salePrice,
          agencyCommission: state.agencyCommission,
          municipalTax: state.municipalTax,
          saleNotaryCosts: state.saleNotary + state.saleRegistry,
          otherCosts: 0,
        });
        if (!cancelled) setResult(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    property.id,
    state.sellDate,
    state.salePrice,
    state.agencyCommission,
    state.municipalTax,
    state.saleNotary,
    state.saleRegistry,
  ]);

  if (loading || !result) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: W.grey500 }}>
        Calculando ganancia patrimonial...
      </div>
    );
  }

  const amortizacionTotal =
    result.amortizacionAcumuladaDeclarada + result.amortizacionAcumuladaAtlas;

  const totalLoanSettlement = state.loansToCancel.reduce(
    (s, l) => s + l.outstandingPrincipal + l.comisionFinalAplicada,
    0,
  );
  const netToAccount =
    state.salePrice -
    state.agencyCommission -
    state.saleNotary -
    state.saleRegistry -
    state.municipalTax -
    totalLoanSettlement;

  const propLabel = property.alias;
  const accountLabel = (() => {
    const acc = accounts.find((a) => a.id === state.settlementAccountId);
    if (!acc) return '—';
    const name = acc.alias || acc.name || acc.banco?.name || 'Cuenta';
    const last4 = acc.iban ? acc.iban.replace(/\s+/g, '').slice(-4) : '';
    return last4 ? `${name} ·${last4}` : name;
  })();

  const previewRows: Array<{ label: string; amount: number }> = [
    { label: `Venta ${propLabel} · precio`, amount: state.salePrice },
  ];
  if (state.agencyCommission > 0) {
    previewRows.push({
      label: `Venta · comisión inmobiliaria`,
      amount: -state.agencyCommission,
    });
  }
  if (state.saleNotary + state.saleRegistry > 0) {
    previewRows.push({
      label: `Venta · notaría + registro`,
      amount: -(state.saleNotary + state.saleRegistry),
    });
  }
  if (state.municipalTax > 0) {
    previewRows.push({
      label: `Venta · plusvalía municipal`,
      amount: -state.municipalTax,
    });
  }
  for (const loan of state.loansToCancel) {
    const total = loan.outstandingPrincipal + loan.comisionFinalAplicada;
    if (total > 0) {
      previewRows.push({
        label: `Cancelación hipoteca ${loan.alias}`,
        amount: -total,
      });
    }
  }

  const sellYear = state.sellDate.slice(0, 4);

  return (
    <div style={{ fontFamily }}>
      {/* Bloque 1 · Cálculo fiscal */}
      <section style={sectionStyle}>
        <SectionHeading>Cálculo fiscal · Ganancia patrimonial</SectionHeading>

        <SummaryTable>
          <Row label="Precio adquisición" value={fmtEuro(result.precioAdquisicion)} />
          <Row
            label="Gastos adquisición (ITP + notaría + registro + otros)"
            value={fmtEuro(result.gastosAdquisicion)}
          />
          <Row
            label="Mejoras CAPEX acumuladas"
            value={fmtEuro(result.mejorasCapexAcumuladas)}
          />
          <Row
            label={
              <>
                Amortización acumulada{' '}
                <span style={{ color: W.grey500, fontWeight: 400 }}>
                  ({result.anosDeclaradosXml.length} años declarada AEAT +{' '}
                  {result.anosCalculadosAtlas.length} años ATLAS)
                </span>
              </>
            }
            value={`−${fmtEuro(amortizacionTotal)}`}
          />
          <Row
            label="Coste fiscal de adquisición"
            value={fmtEuro(result.costeFiscalAdquisicion)}
            total
          />
        </SummaryTable>

        <div style={{ height: 12 }} />

        <SummaryTable>
          <Row label="Precio de venta" value={fmtEuro(state.salePrice)} />
          <Row
            label="Gastos venta (inmobiliaria + notaría + registro + plusvalía)"
            value={`−${fmtEuro(result.gastosVenta)}`}
          />
          <Row
            label="Valor neto de transmisión"
            value={fmtEuro(result.valorNetoTransmision)}
            total
          />
        </SummaryTable>

        <div style={{ height: 12 }} />

        <SummaryTable>
          <Row
            label="Ganancia patrimonial · base ahorro IRPF"
            value={fmtEuroSigned(result.gananciaPatrimonial)}
            total
            emphasized
            colorHint={result.gananciaPatrimonial >= 0 ? 'navy' : 'teal'}
          />
          <Row
            label="Tramos aplicables 2025 · IRPF estimado"
            value={`aprox. ${fmtEuro(result.irpfEstimado)}`}
          />
        </SummaryTable>
      </section>

      {/* Bloque 2 · Preview movimientos */}
      <section style={sectionStyle}>
        <SectionHeading>Movimientos que se crearán en Tesorería</SectionHeading>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${W.grey200}` }}>
              <Th>Fecha</Th>
              <Th>Concepto</Th>
              <Th>Cuenta</Th>
              <Th align="right">Importe</Th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${W.grey200}` }}>
                <Td mono>{state.sellDate}</Td>
                <Td>{r.label}</Td>
                <Td>{accountLabel}</Td>
                <Td align="right" mono color={r.amount >= 0 ? W.navy900 : W.grey900}>
                  {fmtEuroSigned(r.amount)}
                </Td>
              </tr>
            ))}
            <tr style={{ background: W.grey50 }}>
              <Td />
              <Td bold>Neto a cuenta</Td>
              <Td>{accountLabel}</Td>
              <Td
                align="right"
                mono
                bold
                color={netToAccount >= 0 ? W.navy900 : W.teal600}
              >
                {fmtEuroSigned(netToAccount)}
              </Td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Bloque 3 · También se aplicará */}
      <section style={sectionStyle}>
        <SectionHeading>También se aplicará</SectionHeading>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            color: W.grey700,
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          <li>· El inmueble pasará a estado vendido</li>
          <li>
            · Cualquier contrato de alquiler activo se cerrará con fecha {state.sellDate}
          </li>
          <li>
            ·{' '}
            {state.loansToCancel.length === 0
              ? 'No hay préstamos vinculados que cancelar'
              : `${state.loansToCancel.length === 1 ? 'El préstamo vinculado' : 'Los préstamos vinculados'} se ${state.loansToCancel.length === 1 ? 'marcará' : 'marcarán'} como ${state.loansToCancel.length === 1 ? 'cancelado' : 'cancelados'}`}
          </li>
          <li>
            · Los datos fiscales quedarán registrados en property_sales para el IRPF del año {sellYear}
          </li>
        </ul>
      </section>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>
          ← Anterior
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(result);
              } finally {
                setSubmitting(false);
              }
            }}
            style={{
              ...primaryButtonStyle,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Confirmando...' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    style={{
      margin: 0,
      marginBottom: 12,
      fontSize: 14,
      fontWeight: 600,
      color: W.grey900,
    }}
  >
    {children}
  </h3>
);

const SummaryTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      border: `1px solid ${W.grey200}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

const Row: React.FC<{
  label: React.ReactNode;
  value: string;
  total?: boolean;
  emphasized?: boolean;
  colorHint?: 'navy' | 'teal';
}> = ({ label, value, total, emphasized, colorHint }) => {
  const valueColor =
    colorHint === 'teal'
      ? W.teal600
      : emphasized
      ? W.navy900
      : total
      ? W.grey900
      : W.grey900;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: total ? W.grey50 : W.white,
        borderTop: total ? `1px solid ${W.grey200}` : undefined,
        fontSize: 13,
      }}
    >
      <span style={{ color: total ? W.grey900 : W.grey700, fontWeight: total ? 600 : 400 }}>
        {label}
      </span>
      <span
        style={{
          color: valueColor,
          fontWeight: total || emphasized ? 600 : 500,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: emphasized ? 15 : 13,
        }}
      >
        {value}
      </span>
    </div>
  );
};

const Th: React.FC<{ children?: React.ReactNode; align?: 'left' | 'right' }> = ({
  children,
  align = 'left',
}) => (
  <th
    style={{
      padding: '10px 12px',
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: W.grey500,
      letterSpacing: '.06em',
    }}
  >
    {children}
  </th>
);

const Td: React.FC<{
  children?: React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  bold?: boolean;
  color?: string;
}> = ({ children, align = 'left', mono, bold, color }) => (
  <td
    style={{
      padding: '10px 12px',
      textAlign: align,
      fontSize: 13,
      color: color ?? W.grey900,
      fontWeight: bold ? 600 : 400,
      fontFamily: mono ? "'IBM Plex Mono', monospace" : fontFamily,
    }}
  >
    {children}
  </td>
);

export default Step3Confirmar;
