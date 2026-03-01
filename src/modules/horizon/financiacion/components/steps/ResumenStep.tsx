import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import CuadroAmortizacion from '../CuadroAmortizacion';

interface ResumenStepProps {
  data: Partial<PrestamoFinanciacion>;
  onSubmit: () => void;
  isLoading: boolean;
  errors: Record<string, string>;
}

const fmt = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sectionStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 8,
  padding: 14,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  color: 'var(--text-gray)',
  letterSpacing: 0.5,
  marginBottom: 10,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 13,
  marginBottom: 5,
};

const ResumenStep: React.FC<ResumenStepProps> = ({ data, onSubmit, isLoading, errors }) => {
  const [showAmortizacion, setShowAmortizacion] = useState(false);

  // Derived values
  const capital = data.capitalInicial || 0;
  const plazoMeses =
    data.plazoPeriodo === 'AÑOS' ? (data.plazoTotal || 0) * 12 : data.plazoTotal || 0;

  let tinBase = 0;
  if (data.tipo === 'FIJO') tinBase = data.tinFijo || 0;
  else if (data.tipo === 'VARIABLE') tinBase = (data.valorIndice || 0) + (data.diferencial || 0);
  else tinBase = data.tinTramoFijo || 0;

  const totalDescuento = (data.bonificaciones || []).reduce((s, b) => s + b.descuentoTIN, 0);
  const tinEfectivo = Math.max(0, tinBase - totalDescuento);

  // Simple French system calculation
  const r = tinEfectivo / 100 / 12;
  const cuotaMensual =
    r > 0 && plazoMeses > 0
      ? (capital * r * Math.pow(1 + r, plazoMeses)) / (Math.pow(1 + r, plazoMeses) - 1)
      : plazoMeses > 0
      ? capital / plazoMeses
      : 0;

  const totalPagar = cuotaMensual * plazoMeses;
  const totalIntereses = totalPagar - capital;

  const plazoLabel =
    data.plazoPeriodo === 'AÑOS'
      ? `${data.plazoTotal} años`
      : `${data.plazoTotal} meses`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ ...sectionStyle, backgroundColor: 'rgba(4,44,94,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 4 }}>Cuota mensual</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(cuotaMensual)} €
          </div>
        </div>
        <div style={{ ...sectionStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 4 }}>Total a pagar</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(totalPagar)} €
          </div>
        </div>
        <div style={{ ...sectionStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 4 }}>Coste total intereses</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: totalIntereses > 0 ? 'var(--error)' : 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(totalIntereses)} €
          </div>
        </div>
      </div>

      {/* 4 compact sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Datos principales */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Datos principales</div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Ámbito</span>
            <span style={{ fontWeight: 600 }}>{data.ambito === 'INMUEBLE' ? 'Inmueble' : 'Personal'}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Alias</span>
            <span style={{ fontWeight: 600 }}>{data.alias || '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Fecha firma</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {data.fechaFirma
                ? new Date(data.fechaFirma).toLocaleDateString('es-ES')
                : '—'}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Primer cargo</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {data.fechaPrimerCargo
                ? new Date(data.fechaPrimerCargo).toLocaleDateString('es-ES')
                : '—'}
            </span>
          </div>
        </div>

        {/* Condiciones */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Condiciones financieras</div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Capital</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(capital)} €</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Plazo</span>
            <span style={{ fontWeight: 600 }}>{plazoLabel}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Tipo</span>
            <span style={{ fontWeight: 600 }}>{data.tipo}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>TIN base</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{tinBase.toFixed(3)} %</span>
          </div>
        </div>

        {/* Bonificaciones */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Bonificaciones</div>
          {(data.bonificaciones || []).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-gray)' }}>Sin bonificaciones</div>
          ) : (
            <>
              {(data.bonificaciones || []).map(b => (
                <div key={b.id} style={rowStyle}>
                  <span style={{ color: 'var(--text-gray)' }}>{b.nombre}</span>
                  <span style={{ fontWeight: 600, color: 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
                    -{b.descuentoTIN.toFixed(2)} p.p.
                  </span>
                </div>
              ))}
              <div style={{ ...rowStyle, borderTop: '1px solid #eee', paddingTop: 4, marginTop: 4 }}>
                <span style={{ fontWeight: 700, color: 'var(--atlas-navy-1)' }}>TIN efectivo</span>
                <span style={{ fontWeight: 700, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
                  {tinEfectivo.toFixed(3)} %
                </span>
              </div>
            </>
          )}
        </div>

        {/* Resultado financiero */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Resultado financiero</div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Cuota estimada</span>
            <span style={{ fontWeight: 700, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>{fmt(cuotaMensual)} €/mes</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Total cuotas</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalPagar)} €</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Total intereses</span>
            <span style={{ fontWeight: 600, color: 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalIntereses)} €</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-gray)' }}>Carencia</span>
            <span style={{ fontWeight: 600 }}>{data.carencia === 'NINGUNA' ? 'Ninguna' : `${data.carencia} (${data.carenciaMeses} meses)`}</span>
          </div>
        </div>
      </div>

      {/* Button to view amortization table */}
      <button
        onClick={() => setShowAmortizacion(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          border: '1.5px solid var(--atlas-blue)',
          borderRadius: 8,
          backgroundColor: 'transparent',
          color: 'var(--atlas-blue)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <TrendingUp size={16} strokeWidth={1.5} />
        {showAmortizacion ? 'Ocultar cuadro de amortización' : 'Ver cuadro de amortización completo'}
      </button>

      {/* Inline amortization table */}
      {showAmortizacion && capital > 0 && plazoMeses > 0 && tinEfectivo >= 0 && (
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 700, fontSize: 14, color: 'var(--atlas-navy-1)' }}>
            Cuadro de amortización
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }} className="hide-scrollbar">
            <CuadroAmortizacion
              capitalInicial={capital}
              tinAnual={tinEfectivo}
              plazoMeses={plazoMeses}
              fechaInicio={data.fechaPrimerCargo || new Date().toISOString().split('T')[0]}
              tramoFijoMeses={data.tramoFijoAnos ? data.tramoFijoAnos * 12 : undefined}
            />
          </div>
        </div>
      )}

      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div style={{ padding: '10px 14px', backgroundColor: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--error)' }}>
          Hay errores de validación. Revisa los pasos anteriores antes de guardar.
        </div>
      )}
    </div>
  );
};

export default ResumenStep;
