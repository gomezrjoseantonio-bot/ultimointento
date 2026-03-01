import React, { useEffect, useState } from 'react';
import { User, Home, CreditCard } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { cuentasService } from '../../../../../services/cuentasService';
import { inmuebleService } from '../../../../../services/inmuebleService';

interface IdentificacionStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
  accounts: any[];
  inmuebles: any[];
}

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

const IdentificacionStep: React.FC<IdentificacionStepProps> = ({ data, onChange, errors }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [inmuebles, setInmuebles] = useState<any[]>([]);

  useEffect(() => {
    cuentasService.list().then(list => setAccounts(list.filter((a: any) => a.activa))).catch(() => {});
    inmuebleService.getAll().then(list => setInmuebles(list)).catch(() => {});
  }, []);

  const origenOptions = [
    { id: 'MANUAL', label: 'Manual' },
    { id: 'IMPORTACION', label: 'Importar existente' },
    { id: 'FEIN', label: 'Desde FEIN' },
  ] as const;

  const ambitoOptions = [
    { id: 'PERSONAL', label: 'Personal', icon: <User size={16} strokeWidth={1.5} /> },
    { id: 'INMUEBLE', label: 'Inmueble', icon: <Home size={16} strokeWidth={1.5} /> },
  ] as const;

  const esquemaOptions = [
    { id: 'NORMAL', label: 'Normal' },
    { id: 'SOLO_INTERESES', label: 'Solo intereses' },
    { id: 'PRORRATA', label: 'Prorrata' },
  ] as const;

  // origen stored as a UI field - we track via data.origenCreacion conceptually but
  // PrestamoFinanciacion doesn't have it, so we use a local workaround via alias comment
  // Actually looking at the type, there's no origenCreacion in PrestamoFinanciacion.
  // We'll just not persist origen in the form data and use a local state trick.
  const [origen, setOrigen] = useState<'MANUAL' | 'IMPORTACION' | 'FEIN'>('MANUAL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Origen */}
      <div>
        <label style={labelStyle}>Origen</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {origenOptions.map(opt => (
            <button key={opt.id} style={cardStyle(origen === opt.id)} onClick={() => setOrigen(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ámbito */}
      <div>
        <label style={labelStyle}>Ámbito</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {ambitoOptions.map(opt => (
            <button
              key={opt.id}
              style={{ ...cardStyle(data.ambito === opt.id), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => onChange({ ambito: opt.id })}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        {errors.ambito && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.ambito}</div>}
      </div>

      {/* Inmueble selector if INMUEBLE */}
      {data.ambito === 'INMUEBLE' && (
        <div>
          <label style={labelStyle}>Inmueble</label>
          <select
            style={inputStyle(!!errors.inmuebleId)}
            value={data.inmuebleId || ''}
            onChange={e => onChange({ inmuebleId: e.target.value })}
          >
            <option value="">Selecciona un inmueble…</option>
            {inmuebles.map((inm: any) => (
              <option key={inm.id} value={inm.id}>{inm.nombre || inm.direccion || inm.id}</option>
            ))}
          </select>
          {errors.inmuebleId && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.inmuebleId}</div>}
        </div>
      )}

      {/* Cuenta de cargo */}
      <div>
        <label style={labelStyle}><CreditCard size={13} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: 'middle' }} />Cuenta de cargo</label>
        <select
          style={inputStyle(!!errors.cuentaCargoId)}
          value={data.cuentaCargoId || ''}
          onChange={e => onChange({ cuentaCargoId: e.target.value })}
        >
          <option value="">Selecciona una cuenta…</option>
          {accounts.map((acc: any) => (
            <option key={acc.id} value={acc.id}>
              {acc.alias || acc.iban || acc.id}
            </option>
          ))}
        </select>
        {errors.cuentaCargoId && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.cuentaCargoId}</div>}
      </div>

      {/* Alias */}
      <div>
        <label style={labelStyle}>Nombre / alias (opcional)</label>
        <input
          type="text"
          style={inputStyle()}
          placeholder="Ej. Hipoteca vivienda habitual"
          value={data.alias || ''}
          onChange={e => onChange({ alias: e.target.value })}
        />
      </div>

      {/* Dates row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Fecha firma</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaFirma)}
            value={data.fechaFirma || ''}
            onChange={e => onChange({ fechaFirma: e.target.value })}
          />
          {errors.fechaFirma && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.fechaFirma}</div>}
        </div>
        <div>
          <label style={labelStyle}>Primer cargo</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaPrimerCargo)}
            value={data.fechaPrimerCargo || ''}
            onChange={e => onChange({ fechaPrimerCargo: e.target.value })}
          />
          {errors.fechaPrimerCargo && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.fechaPrimerCargo}</div>}
        </div>
        <div>
          <label style={labelStyle}>Día de cobro (1–31)</label>
          <input
            type="number"
            style={inputStyle(!!errors.diaCobroMes)}
            min={1}
            max={31}
            value={data.diaCobroMes || ''}
            onChange={e => onChange({ diaCobroMes: parseInt(e.target.value, 10) })}
          />
          {errors.diaCobroMes && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.diaCobroMes}</div>}
        </div>
      </div>

      {/* Esquema primer recibo */}
      <div>
        <label style={labelStyle}>Esquema primer recibo</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {esquemaOptions.map(opt => (
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
    </div>
  );
};

export default IdentificacionStep;
