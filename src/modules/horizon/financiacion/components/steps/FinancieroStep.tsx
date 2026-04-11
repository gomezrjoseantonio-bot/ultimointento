import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { PrestamoFinanciacion, BonificacionFinanciacion } from '../../../../../types/financiacion';

interface FinancieroStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const PRESET_BONIFICACIONES = [
  { tipo: 'NOMINA' as const,        nombre: 'Nómina',              descuentoTIN: 0.30, condicion: 'Nómina ≥ 1.200 €/mes' },
  { tipo: 'SEGURO_HOGAR' as const,  nombre: 'Seguro hogar',        descuentoTIN: 0.20, condicion: 'Seguro hogar contratado' },
  { tipo: 'SEGURO_VIDA' as const,   nombre: 'Seguro vida',         descuentoTIN: 0.20, condicion: 'Seguro vida contratado' },
  { tipo: 'TARJETA' as const,       nombre: 'Uso tarjeta',         descuentoTIN: 0.10, condicion: '≥ 6 operaciones/mes' },
  { tipo: 'PLAN_PENSIONES' as const, nombre: 'Plan pensiones',     descuentoTIN: 0.25, condicion: 'Plan activo' },
  { tipo: 'RECIBOS' as const,       nombre: 'Recibos domiciliados',descuentoTIN: 0.10, condicion: 'Recibos domiciliados' },
  { tipo: 'ALARMA' as const,        nombre: 'Alarma',              descuentoTIN: 0.10, condicion: 'Alarma contratada' },
];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-gray)',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${hasError ? 'var(--error)' : '#ddd'}`,
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--bg)',
  color: 'var(--atlas-navy-1)',
  fontVariantNumeric: 'tabular-nums',
});

const cardStyle = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? 'var(--atlas-blue)' : '#ddd'}`,
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer',
  backgroundColor: active ? 'rgba(4,44,94,0.1)' : 'var(--bg)',
  color: active ? 'var(--atlas-blue)' : 'var(--text-gray)',
  fontWeight: active ? 600 : 400,
  fontSize: 13,
  flex: 1,
  textAlign: 'center' as const,
  transition: 'all 150ms ease',
});

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--atlas-navy-1)',
  marginBottom: 14,
  paddingBottom: 6,
  borderBottom: '1px solid #eee',
};

const FinancieroStep: React.FC<FinancieroStepProps> = ({ data, onChange, errors }) => {
  const tipo = data.tipo || 'FIJO';
  const bonificaciones = data.bonificaciones || [];

  const hasCommissions =
    (data.comisionApertura !== undefined && data.comisionApertura > 0) ||
    (data.comisionMantenimiento !== undefined && data.comisionMantenimiento > 0) ||
    (data.comisionAmortizacionAnticipada !== undefined && data.comisionAmortizacionAnticipada > 0);

  const [showComisiones, setShowComisiones] = useState(!!hasCommissions);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNombre, setCustomNombre] = useState('');
  const [customDescuento, setCustomDescuento] = useState('');

  const selectedIds = new Set(bonificaciones.map((b) => b.tipo));

  const tinBase =
    tipo === 'FIJO' ? (data.tinFijo || 0) :
    tipo === 'VARIABLE' ? (data.valorIndice || 0) + (data.diferencial || 0) :
    (data.tinTramoFijo || 0);

  const totalDescuento = bonificaciones.reduce((sum, b) => sum + b.descuentoTIN, 0);
  const tinEfectivo = Math.max(0, tinBase - totalDescuento);

  const tinCalculadoVariable =
    tipo === 'VARIABLE' &&
    data.valorIndice !== undefined &&
    data.diferencial !== undefined
      ? data.valorIndice + data.diferencial
      : null;

  const addPreset = (preset: typeof PRESET_BONIFICACIONES[0]) => {
    if (selectedIds.has(preset.tipo)) return;
    const newBon: BonificacionFinanciacion = {
      id: `bon_${preset.tipo}_${Date.now()}`,
      tipo: preset.tipo,
      nombre: preset.nombre,
      condicionParametrizable: preset.condicion,
      descuentoTIN: preset.descuentoTIN,
      impacto: { puntos: -preset.descuentoTIN },
      aplicaEn: 'FIJO',
      ventanaEvaluacion: 6,
      fuenteVerificacion: 'MANUAL',
      estadoInicial: 'NO_CUMPLE',
      activa: true,
    };
    onChange({ bonificaciones: [...bonificaciones, newBon] });
  };

  const removePreset = (tipoToRemove: string) => {
    const bon = bonificaciones.find((b) => b.tipo === tipoToRemove);
    if (bon) onChange({ bonificaciones: bonificaciones.filter((b) => b.id !== bon.id) });
  };

  const addCustom = () => {
    if (!customNombre || !customDescuento) return;
    const newBon: BonificacionFinanciacion = {
      id: `bon_custom_${Date.now()}`,
      tipo: 'OTROS',
      nombre: customNombre,
      condicionParametrizable: customNombre,
      descuentoTIN: parseFloat(customDescuento) || 0,
      impacto: { puntos: -(parseFloat(customDescuento) || 0) },
      aplicaEn: 'FIJO',
      ventanaEvaluacion: 6,
      fuenteVerificacion: 'MANUAL',
      estadoInicial: 'NO_CUMPLE',
      activa: true,
    };
    onChange({ bonificaciones: [...bonificaciones, newBon] });
    setCustomNombre('');
    setCustomDescuento('');
    setShowCustomForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── A. ESTRUCTURA ── */}
      <div>
        <div style={sectionTitle}>Estructura del préstamo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Capital */}
          <div>
            <label style={labelStyle}>Capital inicial</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                style={{ ...inputStyle(!!errors.capitalInicial), paddingRight: 30 }}
                placeholder="0"
                min={0}
                value={data.capitalInicial ?? ''}
                onChange={(e) => onChange({ capitalInicial: parseFloat(e.target.value) || 0 })}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)', fontSize: 14 }}>€</span>
            </div>
            {errors.capitalInicial && (
              <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.capitalInicial}</div>
            )}
          </div>

          {/* Plazo */}
          <div>
            <label style={labelStyle}>Plazo total</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                style={{ ...inputStyle(!!errors.plazoTotal), flex: 1 }}
                placeholder="25"
                min={1}
                value={data.plazoTotal ?? ''}
                onChange={(e) => onChange({ plazoTotal: parseInt(e.target.value, 10) || 0 })}
              />
              <select
                style={{ ...inputStyle(), width: 120, flex: 'none' }}
                value={data.plazoPeriodo || 'AÑOS'}
                onChange={(e) => onChange({ plazoPeriodo: e.target.value as 'MESES' | 'AÑOS' })}
              >
                <option value="AÑOS">Años</option>
                <option value="MESES">Meses</option>
              </select>
            </div>
            {errors.plazoTotal && (
              <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.plazoTotal}</div>
            )}
          </div>

          {/* Carencia */}
          <div>
            <label style={labelStyle}>Carencia</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {(['NINGUNA', 'CAPITAL', 'TOTAL'] as const).map((opt) => (
                <button
                  key={opt}
                  style={cardStyle((data.carencia ?? 'NINGUNA') === opt)}
                  onClick={() => onChange({
                    carencia: opt,
                    carenciaMeses: opt === 'NINGUNA' ? undefined : (data.carenciaMeses || 6),
                  })}
                >
                  {opt === 'NINGUNA' ? 'Ninguna' : opt === 'CAPITAL' ? 'Capital' : 'Total'}
                </button>
              ))}
            </div>
            {data.carencia && data.carencia !== 'NINGUNA' && (
              <div>
                <label style={labelStyle}>Meses de carencia</label>
                <input
                  type="number"
                  style={inputStyle()}
                  min={1}
                  max={60}
                  value={data.carenciaMeses ?? ''}
                  onChange={(e) => onChange({ carenciaMeses: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── B. TIPO DE INTERÉS ── */}
      <div>
        <div style={sectionTitle}>Tipo de interés</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['FIJO', 'VARIABLE', 'MIXTO'] as const).map((opt) => (
            <button
              key={opt}
              style={cardStyle(tipo === opt)}
              onClick={() => onChange({ tipo: opt })}
            >
              {opt === 'FIJO' ? 'Fijo' : opt === 'VARIABLE' ? 'Variable' : 'Mixto'}
            </button>
          ))}
        </div>
        {errors.tipo && <div style={{ color: 'var(--error)', fontSize: 12, marginBottom: 12 }}>{errors.tipo}</div>}

        {tipo === 'FIJO' && (
          <div>
            <label style={labelStyle}>TIN fijo (%)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle(!!errors.tinFijo)}
              placeholder="3.45"
              value={data.tinFijo ?? ''}
              onChange={(e) => onChange({ tinFijo: parseFloat(e.target.value) || 0 })}
            />
            {errors.tinFijo && (
              <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.tinFijo}</div>
            )}
          </div>
        )}

        {tipo === 'VARIABLE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Índice de referencia</label>
                <select
                  style={inputStyle()}
                  value={data.indice || 'EURIBOR'}
                  onChange={(e) => onChange({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
                >
                  <option value="EURIBOR">Euríbor</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor actual índice (%)</label>
                <input
                  type="number"
                  step="0.001"
                  style={inputStyle()}
                  placeholder="3.500"
                  value={data.valorIndice ?? ''}
                  onChange={(e) => onChange({ valorIndice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Diferencial (%)</label>
                <input
                  type="number"
                  step="0.01"
                  style={inputStyle(!!errors.diferencial)}
                  placeholder="0.75"
                  value={data.diferencial ?? ''}
                  onChange={(e) => onChange({ diferencial: parseFloat(e.target.value) || 0 })}
                />
                {errors.diferencial && (
                  <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.diferencial}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Revisión</label>
                <select
                  style={inputStyle()}
                  value={data.revision || 12}
                  onChange={(e) => onChange({ revision: parseInt(e.target.value, 10) as 6 | 12 })}
                >
                  <option value={6}>Semestral (6 meses)</option>
                  <option value={12}>Anual (12 meses)</option>
                </select>
              </div>
            </div>
            {tinCalculadoVariable !== null && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(4,44,94,0.1)', borderRadius: 6, fontSize: 13, color: 'var(--atlas-blue)' }}>
                TIN calculado: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{tinCalculadoVariable.toFixed(3)} %</strong>
              </div>
            )}
          </div>
        )}

        {tipo === 'MIXTO' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Duración tramo fijo (años)</label>
              <input
                type="number"
                style={inputStyle()}
                min={1}
                value={data.tramoFijoAnos ?? ''}
                onChange={(e) => onChange({ tramoFijoAnos: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label style={labelStyle}>TIN tramo fijo (%)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle()}
                placeholder="2.50"
                value={data.tinTramoFijo ?? ''}
                onChange={(e) => onChange({ tinTramoFijo: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={labelStyle}>Índice tramo variable</label>
              <select
                style={inputStyle()}
                value={data.indice || 'EURIBOR'}
                onChange={(e) => onChange({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
              >
                <option value="EURIBOR">Euríbor</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Diferencial variable (%)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle()}
                placeholder="0.75"
                value={data.diferencial ?? ''}
                onChange={(e) => onChange({ diferencial: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={labelStyle}>Revisión</label>
              <select
                style={inputStyle()}
                value={data.revision || 12}
                onChange={(e) => onChange({ revision: parseInt(e.target.value, 10) as 6 | 12 })}
              >
                <option value={6}>Semestral (6 meses)</option>
                <option value={12}>Anual (12 meses)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── C. COMISIONES (colapsadas) ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowComisiones(!showComisiones)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '9px 14px',
            border: '1px solid #ddd',
            borderRadius: 8,
            backgroundColor: 'var(--bg)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
          }}
        >
          <span>
            Comisiones{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-gray)' }}>
              {hasCommissions ? '(configuradas)' : '— opcional'}
            </span>
          </span>
          {showComisiones
            ? <ChevronUp size={16} strokeWidth={1.5} />
            : <ChevronDown size={16} strokeWidth={1.5} />}
        </button>

        {showComisiones && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Apertura (%)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle()}
                placeholder="0"
                value={data.comisionApertura !== undefined ? (data.comisionApertura * 100).toFixed(2) : ''}
                onChange={(e) => onChange({ comisionApertura: parseFloat(e.target.value) / 100 || 0 })}
              />
            </div>
            <div>
              <label style={labelStyle}>Mantenimiento (€/mes)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle()}
                placeholder="0"
                value={data.comisionMantenimiento ?? ''}
                onChange={(e) => onChange({ comisionMantenimiento: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={labelStyle}>Amort. anticipada (%)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle()}
                placeholder="0"
                value={data.comisionAmortizacionAnticipada !== undefined ? (data.comisionAmortizacionAnticipada * 100).toFixed(2) : ''}
                onChange={(e) => onChange({ comisionAmortizacionAnticipada: parseFloat(e.target.value) / 100 || 0 })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── D. BONIFICACIONES ── */}
      <div>
        <div style={sectionTitle}>Bonificaciones <span style={{ fontWeight: 400, color: 'var(--text-gray)' }}>— opcional</span></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {PRESET_BONIFICACIONES.map((preset) => {
            const isSelected = selectedIds.has(preset.tipo);
            return (
              <div
                key={preset.tipo}
                style={{
                  border: `1.5px solid ${isSelected ? 'var(--ok)' : '#ddd'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  backgroundColor: isSelected ? 'rgba(40,167,69,0.08)' : 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? 'var(--ok)' : 'var(--atlas-navy-1)' }}>
                  {preset.nombre}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-gray)' }}>{preset.condicion}</div>
                <div style={{ fontSize: 12, color: isSelected ? 'var(--ok)' : 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
                  -{preset.descuentoTIN.toFixed(2)} p.p.
                </div>
                {!isSelected ? (
                  <button
                    onClick={() => addPreset(preset)}
                    style={{ marginTop: 4, border: 'none', borderRadius: 4, backgroundColor: 'var(--atlas-blue)', color: '#fff', fontSize: 12, padding: '4px 0', cursor: 'pointer' }}
                  >
                    + Añadir
                  </button>
                ) : (
                  <button
                    onClick={() => removePreset(preset.tipo)}
                    style={{ marginTop: 4, border: 'none', borderRadius: 4, backgroundColor: 'rgba(40,167,69,0.15)', color: 'var(--ok)', fontSize: 12, padding: '4px 0', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ✓ Añadida
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bonificación personalizada */}
        <div style={{ marginTop: 12 }}>
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1.5px dashed var(--atlas-blue)', borderRadius: 8,
                padding: '8px 14px', backgroundColor: 'transparent',
                color: 'var(--atlas-blue)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
              Añadir bonificación personalizada
            </button>
          ) : (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--atlas-navy-1)' }}>
                Bonificación personalizada
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    type="text"
                    style={{ ...inputStyle(), fontVariantNumeric: 'normal' }}
                    placeholder="Ej. Seguro auto"
                    value={customNombre}
                    onChange={(e) => setCustomNombre(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Descuento p.p.</label>
                  <input
                    type="number"
                    step="0.01"
                    style={inputStyle()}
                    placeholder="0.10"
                    value={customDescuento}
                    onChange={(e) => setCustomDescuento(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={addCustom}
                  disabled={!customNombre || !customDescuento}
                  style={{ padding: '7px 16px', borderRadius: 6, border: 'none', backgroundColor: 'var(--atlas-blue)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Añadir
                </button>
                <button
                  onClick={() => { setShowCustomForm(false); setCustomNombre(''); setCustomDescuento(''); }}
                  style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #ddd', backgroundColor: 'var(--bg)', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Resumen de bonificaciones */}
        {bonificaciones.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: 'rgba(4,44,94,0.07)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-gray)' }}>TIN base:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{tinBase.toFixed(3)} %</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-gray)' }}>Descuento total:</span>
              <span style={{ fontWeight: 700, color: 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
                -{totalDescuento.toFixed(2)} p.p.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #ddd', paddingTop: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--atlas-navy-1)' }}>TIN efectivo:</span>
              <span style={{ fontWeight: 700, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
                {tinEfectivo.toFixed(3)} %
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancieroStep;
