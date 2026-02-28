import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PrestamoFinanciacion, BonificacionFinanciacion } from '../../../../../types/financiacion';

interface BonificacionesStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const PRESET_BONIFICACIONES = [
  { tipo: 'NOMINA' as const, nombre: 'Nómina', descuentoTIN: 0.003, condicion: 'Nómina ≥ 1.200 €/mes' },
  { tipo: 'SEGURO_HOGAR' as const, nombre: 'Seguro hogar', descuentoTIN: 0.002, condicion: 'Seguro hogar contratado' },
  { tipo: 'SEGURO_VIDA' as const, nombre: 'Seguro vida', descuentoTIN: 0.002, condicion: 'Seguro vida contratado' },
  { tipo: 'TARJETA' as const, nombre: 'Uso tarjeta', descuentoTIN: 0.001, condicion: '≥ 6 operaciones/mes' },
  { tipo: 'PLAN_PENSIONES' as const, nombre: 'Plan pensiones', descuentoTIN: 0.002, condicion: 'Plan activo' },
  { tipo: 'RECIBOS' as const, nombre: 'Recibos domiciliados', descuentoTIN: 0.001, condicion: 'Recibos domiciliados' },
  { tipo: 'ALARMA' as const, nombre: 'Alarma', descuentoTIN: 0.001, condicion: 'Alarma contratada' },
];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-gray)',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--bg)',
  color: 'var(--atlas-navy-1)',
};

const BonificacionesStep: React.FC<BonificacionesStepProps> = ({ data, onChange, errors }) => {
  const bonificaciones = data.bonificaciones || [];
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNombre, setCustomNombre] = useState('');
  const [customDescuento, setCustomDescuento] = useState('');

  const selectedIds = new Set(bonificaciones.map(b => b.tipo));

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

  const removeBonificacion = (id: string) => {
    onChange({ bonificaciones: bonificaciones.filter(b => b.id !== id) });
  };

  const addCustom = () => {
    if (!customNombre || !customDescuento) return;
    const newBon: BonificacionFinanciacion = {
      id: `bon_custom_${Date.now()}`,
      tipo: 'OTROS',
      nombre: customNombre,
      condicionParametrizable: customNombre,
      descuentoTIN: parseFloat(customDescuento) / 100,
      impacto: { puntos: -(parseFloat(customDescuento) / 100) },
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

  const totalDescuento = bonificaciones.reduce((sum, b) => sum + b.descuentoTIN, 0);

  // Get TIN base from data
  const tinBase =
    data.tipo === 'FIJO'
      ? (data.tinFijo || 0)
      : data.tipo === 'VARIABLE'
      ? (data.valorIndice || 0) + (data.diferencial || 0)
      : (data.tinTramoFijo || 0);

  const tinEfectivo = Math.max(0, tinBase - totalDescuento);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Preset bonifications grid */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--atlas-navy-1)' }}>
          Bonificaciones habituales
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {PRESET_BONIFICACIONES.map(preset => {
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
                  -{(preset.descuentoTIN * 100).toFixed(2)} p.p.
                </div>
                {!isSelected && (
                  <button
                    onClick={() => addPreset(preset)}
                    style={{
                      marginTop: 4,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: 'var(--atlas-blue)',
                      color: '#fff',
                      fontSize: 12,
                      padding: '4px 0',
                      cursor: 'pointer',
                    }}
                  >
                    + Añadir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected bonifications list */}
      {bonificaciones.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--atlas-navy-1)' }}>
            Bonificaciones seleccionadas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bonificaciones.map(bon => (
              <div
                key={bon.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(40,167,69,0.06)',
                  borderRadius: 6,
                  border: '1px solid rgba(40,167,69,0.2)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--atlas-navy-1)' }}>{bon.nombre}</span>
                  <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
                    -{(bon.descuentoTIN * 100).toFixed(2)} p.p.
                  </span>
                </div>
                <button
                  onClick={() => removeBonificacion(bon.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', display: 'flex' }}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: 'rgba(4,44,94,0.1)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-gray)' }}>Descuento total:</span>
              <span style={{ fontWeight: 700, color: 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
                -{(totalDescuento * 100).toFixed(2)} p.p.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span style={{ color: 'var(--text-gray)' }}>TIN efectivo resultante:</span>
              <span style={{ fontWeight: 700, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
                {(tinEfectivo * 100).toFixed(3)} %
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Custom bonification */}
      <div>
        {!showCustomForm ? (
          <button
            onClick={() => setShowCustomForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1.5px dashed var(--atlas-blue)',
              borderRadius: 8,
              padding: '10px 14px',
              backgroundColor: 'transparent',
              color: 'var(--atlas-blue)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
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
                  style={inputStyle}
                  placeholder="Ej. Seguro auto"
                  value={customNombre}
                  onChange={e => setCustomNombre(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Descuento p.p. (%)</label>
                <input
                  type="number"
                  step="0.01"
                  style={inputStyle}
                  placeholder="0.10"
                  value={customDescuento}
                  onChange={e => setCustomDescuento(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={addCustom}
                disabled={!customNombre || !customDescuento}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'var(--atlas-blue)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
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
    </div>
  );
};

export default BonificacionesStep;
