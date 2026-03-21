import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Home, Plus, User, X, CreditCard } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { AfectacionInmueblePrestamo } from '../../../../../types/prestamos';
import { cuentasService } from '../../../../../services/cuentasService';
import { inmuebleService } from '../../../../../services/inmuebleService';

interface IdentificacionStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
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

const tableCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderTop: '1px solid #eee',
};

const IdentificacionStep: React.FC<IdentificacionStepProps> = ({ data, onChange, errors }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [inmuebles, setInmuebles] = useState<any[]>([]);

  useEffect(() => {
    cuentasService.list().then((list) => setAccounts(list.filter((a: any) => a.activa))).catch(() => {});
    inmuebleService.getAll().then((list) => setInmuebles(list.filter((inmueble: any) => inmueble.estado === 'ACTIVO'))).catch(() => {});
  }, []);

  const ambitoOptions = [
    { id: 'PERSONAL', label: 'Personal', icon: <User size={16} strokeWidth={1.5} /> },
    { id: 'INMUEBLE', label: 'Inmueble', icon: <Home size={16} strokeWidth={1.5} /> },
  ] as const;

  const esquemaOptions = [
    { id: 'NORMAL', label: 'Normal' },
    { id: 'SOLO_INTERESES', label: 'Solo intereses' },
    { id: 'PRORRATA', label: 'Prorrata' },
  ] as const;

  const afectaciones = data.afectacionesInmueble || [];
  const totalPorcentaje = useMemo(
    () => afectaciones.reduce((sum, afectacion) => sum + (afectacion.porcentaje || 0), 0),
    [afectaciones],
  );

  const handleAddAfectacion = () => {
    const current = data.afectacionesInmueble || [];

    if (current.length === 0 && data.inmuebleId) {
      onChange({
        afectacionesInmueble: [
          { inmuebleId: data.inmuebleId, porcentaje: 50 },
          { inmuebleId: '', porcentaje: 50 },
        ],
        inmuebleId: undefined,
      });
      return;
    }

    onChange({
      afectacionesInmueble: [...current, { inmuebleId: '', porcentaje: 0 }],
    });
  };

  const handleUpdateAfectacion = (index: number, updates: Partial<AfectacionInmueblePrestamo>) => {
    const current = [...afectaciones];
    current[index] = { ...current[index], ...updates };
    onChange({ afectacionesInmueble: current });
  };

  const handleRemoveAfectacion = (index: number) => {
    const current = [...afectaciones];
    current.splice(index, 1);

    if (current.length <= 1) {
      onChange({
        inmuebleId: current[0]?.inmuebleId || undefined,
        afectacionesInmueble: undefined,
      });
      return;
    }

    onChange({ afectacionesInmueble: current });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>Tipo de Préstamo</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {ambitoOptions.map((opt) => (
            <button
              key={opt.id}
              style={{ ...cardStyle(data.ambito === opt.id), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => onChange({ ambito: opt.id, ...(opt.id === 'PERSONAL' ? { inmuebleId: undefined, afectacionesInmueble: undefined } : {}) })}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        {errors.ambito && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.ambito}</div>}
      </div>

      {data.ambito === 'INMUEBLE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Inmueble(s) vinculado(s)</label>
            {(data.inmuebleId || afectaciones.length > 0) && (
              <button
                type="button"
                onClick={handleAddAfectacion}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--atlas-blue)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                <Plus size={14} strokeWidth={1.5} />
                Añadir inmueble
              </button>
            )}
          </div>

          {afectaciones.length === 0 && (
            <div>
              <select
                style={inputStyle(!!errors.inmuebleId)}
                value={data.inmuebleId || ''}
                onChange={(e) => onChange({ inmuebleId: e.target.value || undefined })}
              >
                <option value="">Selecciona un inmueble…</option>
                {inmuebles.map((inm: any) => (
                  <option key={inm.id} value={inm.id}>
                    {inm.alias || (inm.direccion?.calle ? `${inm.direccion.calle}, ${inm.direccion.municipio}` : inm.id)}
                  </option>
                ))}
              </select>
              {errors.inmuebleId && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.inmuebleId}</div>}
            </div>
          )}

          {afectaciones.length > 0 && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Inmueble</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: 130 }}>% préstamo</th>
                    <th style={{ padding: '10px 12px', width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {afectaciones.map((afectacion, index) => (
                    <tr key={`${afectacion.inmuebleId || 'nuevo'}-${index}`}>
                      <td style={tableCellStyle}>
                        <select
                          style={inputStyle(false)}
                          value={afectacion.inmuebleId}
                          onChange={(e) => handleUpdateAfectacion(index, { inmuebleId: e.target.value })}
                        >
                          <option value="">Selecciona un inmueble…</option>
                          {inmuebles.map((inm: any) => (
                            <option key={inm.id} value={inm.id}>
                              {inm.alias || inm.id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={afectacion.porcentaje}
                            onChange={(e) => handleUpdateAfectacion(index, { porcentaje: parseFloat(e.target.value) || 0 })}
                            style={{ ...inputStyle(false), width: 90, textAlign: 'right' }}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveAfectacion(index)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-gray)' }}
                          aria-label={`Eliminar afectación ${index + 1}`}
                        >
                          <X size={16} strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: Math.abs(totalPorcentaje - 100) <= 0.01 ? '#15803d' : 'var(--error)' }}>
                      {totalPorcentaje.toFixed(2)}%
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              {errors.afectacionesInmueble && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: '#fef2f2', color: 'var(--error)', fontSize: 12 }}>
                  <AlertCircle size={14} strokeWidth={1.5} />
                  {errors.afectacionesInmueble}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle}><CreditCard size={13} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: 'middle' }} />Cuenta de cargo</label>
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
        {errors.cuentaCargoId && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.cuentaCargoId}</div>}
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Fecha firma</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaFirma)}
            value={data.fechaFirma || ''}
            onChange={(e) => onChange({ fechaFirma: e.target.value })}
          />
          {errors.fechaFirma && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.fechaFirma}</div>}
        </div>
        <div>
          <label style={labelStyle}>Primer cargo</label>
          <input
            type="date"
            style={inputStyle(!!errors.fechaPrimerCargo)}
            value={data.fechaPrimerCargo || ''}
            onChange={(e) => onChange({ fechaPrimerCargo: e.target.value })}
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
            onChange={(e) => onChange({ diaCobroMes: parseInt(e.target.value, 10) })}
          />
          {errors.diaCobroMes && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.diaCobroMes}</div>}
        </div>
      </div>

      <div>
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
    </div>
  );
};

export default IdentificacionStep;
