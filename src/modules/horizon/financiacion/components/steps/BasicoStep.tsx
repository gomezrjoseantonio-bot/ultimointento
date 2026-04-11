import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { cuentasService } from '../../../../../services/cuentasService';

interface BasicoStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

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

const BasicoStep: React.FC<BasicoStepProps> = ({ data, onChange, errors }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAvanzado, setShowAvanzado] = useState(
    data.esquemaPrimerRecibo !== undefined && data.esquemaPrimerRecibo !== 'NORMAL',
  );

  useEffect(() => {
    cuentasService.list()
      .then((list) => setAccounts(list.filter((a: any) => a.activa)))
      .catch(() => {});
  }, []);

  const esquemaOptions = [
    { id: 'NORMAL' as const,         label: 'Normal' },
    { id: 'SOLO_INTERESES' as const, label: 'Solo intereses' },
    { id: 'PRORRATA' as const,       label: 'Prorrata' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cuenta de cargo */}
      <div>
        <label style={labelStyle}>
          <CreditCard size={13} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Cuenta de cargo
        </label>
        <select
          style={inputStyle(!!errors.cuentaCargoId)}
          value={data.cuentaCargoId || ''}
          onChange={(e) => onChange({ cuentaCargoId: e.target.value })}
        >
          <option value="">Selecciona una cuenta…</option>
          {accounts.map((acc: any) => (
            <option key={acc.id} value={acc.id}>
              {acc.alias || acc.iban || acc.id}
            </option>
          ))}
        </select>
        {errors.cuentaCargoId && (
          <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.cuentaCargoId}</div>
        )}
      </div>

      {/* Alias */}
      <div>
        <label style={labelStyle}>Nombre / alias (opcional)</label>
        <input
          type="text"
          style={inputStyle()}
          placeholder="Ej. Hipoteca vivienda habitual"
          value={data.alias || ''}
          onChange={(e) => onChange({ alias: e.target.value })}
        />
      </div>

      {/* Fechas y día de cobro */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Fecha firma</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaFirma)}
            value={data.fechaFirma || ''}
            onChange={(e) => onChange({ fechaFirma: e.target.value })}
          />
          {errors.fechaFirma && (
            <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.fechaFirma}</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Primer cargo</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaPrimerCargo)}
            value={data.fechaPrimerCargo || ''}
            onChange={(e) => onChange({ fechaPrimerCargo: e.target.value })}
          />
          {errors.fechaPrimerCargo && (
            <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.fechaPrimerCargo}</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Día de cobro (1–31)</label>
          <input
            type="number"
            style={inputStyle(!!errors.diaCobroMes)}
            min={1}
            max={31}
            value={data.diaCobroMes || ''}
            onChange={(e) => onChange({ diaCobroMes: parseInt(e.target.value, 10) })}
          />
          {errors.diaCobroMes && (
            <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.diaCobroMes}</div>
          )}
        </div>
      </div>

      {/* Opciones avanzadas (colapsadas) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAvanzado(!showAvanzado)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-gray)',
            fontSize: 12,
            fontWeight: 500,
            padding: 0,
          }}
        >
          {showAvanzado ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
          Opciones avanzadas
        </button>

        {showAvanzado && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Esquema primer recibo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {esquemaOptions.map((opt) => (
                <button
                  key={opt.id}
                  style={cardStyle(data.esquemaPrimerRecibo === opt.id)}
                  onClick={() => onChange({ esquemaPrimerRecibo: opt.id })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BasicoStep;
