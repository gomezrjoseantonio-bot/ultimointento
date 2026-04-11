import React, { useEffect, useState } from 'react';
import { AlertCircle, Home, Plus, Trash2, Wrench, CreditCard, TrendingUp, User, MoreHorizontal } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { DestinoCapital } from '../../../../../types/prestamos';
import { inmuebleService } from '../../../../../services/inmuebleService';

interface DestinoCapitalStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const TIPO_OPTIONS: { id: DestinoCapital['tipo']; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'ADQUISICION',       label: 'Comprar inmueble',   sub: 'Adquisición de vivienda o local',  icon: <Home size={16} strokeWidth={1.5} /> },
  { id: 'REFORMA',           label: 'Reformar inmueble',  sub: 'Obras, mejoras o rehabilitación',  icon: <Wrench size={16} strokeWidth={1.5} /> },
  { id: 'CANCELACION_DEUDA', label: 'Cancelar deuda',     sub: 'Cancelar otro préstamo o deuda',   icon: <CreditCard size={16} strokeWidth={1.5} /> },
  { id: 'INVERSION',         label: 'Inversión',          sub: 'Financiar activo financiero',       icon: <TrendingUp size={16} strokeWidth={1.5} /> },
  { id: 'PERSONAL',          label: 'Personal',           sub: 'Gasto personal (no deducible)',     icon: <User size={16} strokeWidth={1.5} /> },
  { id: 'OTRA',              label: 'Otra',               sub: 'Otro destino',                     icon: <MoreHorizontal size={16} strokeWidth={1.5} /> },
];

const needsInmueble = (tipo: DestinoCapital['tipo']) => tipo === 'ADQUISICION' || tipo === 'REFORMA';

function generateId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

const DestinoCapitalStep: React.FC<DestinoCapitalStepProps> = ({ data, onChange, errors }) => {
  const [inmuebles, setInmuebles] = useState<any[]>([]);
  const capitalInicial = data.capitalInicial ?? 0;

  useEffect(() => {
    inmuebleService.getAll()
      .then((list) => setInmuebles(list.filter((i: any) => i.estado === 'ACTIVO')))
      .catch(() => {});
  }, []);

  const destinos: DestinoCapital[] = data.destinos ?? [];

  const totalImporte = destinos.reduce((sum, d) => sum + (d.importe || 0), 0);
  const diff = capitalInicial > 0 ? Math.abs(totalImporte - capitalInicial) : 0;
  const balanced = capitalInicial > 0 && diff <= 0.01;

  const handleAdd = () => {
    const remaining = Math.max(0, capitalInicial - totalImporte);
    const newDestino: DestinoCapital = {
      id: generateId(),
      tipo: 'ADQUISICION',
      importe: remaining,
    };
    const next = [...destinos, newDestino];
    onChange({ destinos: next, ...deriveAmbito(next) });
  };

  const handleUpdate = (id: string, updates: Partial<DestinoCapital>) => {
    const next = destinos.map((d) => (d.id === id ? { ...d, ...updates } : d));
    onChange({ destinos: next, ...deriveAmbito(next) });
  };

  const handleRemove = (id: string) => {
    const next = destinos.filter((d) => d.id !== id);
    onChange({ destinos: next, ...deriveAmbito(next) });
  };

  // Derive ambito from destinos (INMUEBLE if any destino has inmuebleId)
  const deriveAmbito = (ds: DestinoCapital[]): Partial<PrestamoFinanciacion> => {
    const hasInmueble = ds.some((d) => d.inmuebleId);
    return { ambito: hasInmueble ? 'INMUEBLE' : 'PERSONAL' };
  };

  const getInmuebleLabel = (id: string) => {
    const inm = inmuebles.find((i) => i.id === id);
    if (!inm) return id;
    return inm.alias || `${inm.direccion?.calle ?? ''}, ${inm.direccion?.municipio ?? ''}`.trim() || id;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--atlas-navy-1)', marginBottom: 4 }}>
          ¿Para qué se pide el dinero?
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-gray)', marginBottom: 16 }}>
          El destino determina qué intereses son deducibles. La garantía se configura en el paso siguiente.
        </div>

        {destinos.length === 0 && (
          <button
            type="button"
            onClick={handleAdd}
            style={{
              width: '100%', padding: '16px', border: '2px dashed #ddd', borderRadius: 8,
              background: 'none', cursor: 'pointer', color: 'var(--atlas-blue)',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
            Añadir destino del capital
          </button>
        )}

        {destinos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {destinos.map((destino, idx) => (
              <div key={destino.id} style={{
                border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                backgroundColor: 'var(--bg)',
              }}>
                {/* Tipo selector */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-gray)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Destino {idx + 1}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {TIPO_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUpdate(destino.id, {
                          tipo: opt.id,
                          ...(needsInmueble(opt.id) ? {} : { inmuebleId: undefined }),
                        })}
                        style={{
                          border: `2px solid ${destino.tipo === opt.id ? 'var(--atlas-blue)' : '#ddd'}`,
                          borderRadius: 7,
                          padding: '8px 6px',
                          cursor: 'pointer',
                          backgroundColor: destino.tipo === opt.id ? 'rgba(4,44,94,0.07)' : 'var(--bg)',
                          color: destino.tipo === opt.id ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)',
                          fontSize: 11,
                          fontWeight: destino.tipo === opt.id ? 600 : 400,
                          textAlign: 'center',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          transition: 'all 150ms ease',
                        }}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inmueble selector (solo para ADQUISICION/REFORMA) */}
                {needsInmueble(destino.tipo) && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-gray)', marginBottom: 4, fontWeight: 500 }}>
                      Inmueble
                    </label>
                    <select
                      style={{
                        width: '100%', padding: '8px 10px', border: '1px solid #ddd',
                        borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg)', color: 'var(--atlas-navy-1)',
                      }}
                      value={destino.inmuebleId || ''}
                      onChange={(e) => handleUpdate(destino.id, { inmuebleId: e.target.value || undefined })}
                    >
                      <option value="">Selecciona un inmueble…</option>
                      {inmuebles.map((inm: any) => (
                        <option key={inm.id} value={inm.id}>
                          {inm.alias || `${inm.direccion?.calle ?? ''}, ${inm.direccion?.municipio ?? ''}`.trim() || inm.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Descripción libre */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-gray)', marginBottom: 4, fontWeight: 500 }}>
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder={needsInmueble(destino.tipo) ? 'Ej: Compra Tenderina 48' : 'Ej: Cancelar préstamo Santander'}
                    value={destino.descripcion || ''}
                    onChange={(e) => handleUpdate(destino.id, { descripcion: e.target.value || undefined })}
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #ddd',
                      borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg)', color: 'var(--atlas-navy-1)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Importe */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-gray)', marginBottom: 4, fontWeight: 500 }}>
                      Importe (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={destino.importe || ''}
                      onChange={(e) => handleUpdate(destino.id, { importe: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%', padding: '8px 10px', border: '1px solid #ddd',
                        borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg)', color: 'var(--atlas-navy-1)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {capitalInicial > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-gray)', minWidth: 56, textAlign: 'right', paddingTop: 20 }}>
                      {capitalInicial > 0 ? ((destino.importe / capitalInicial) * 100).toFixed(1) : 0}%
                    </div>
                  )}
                  {destinos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(destino.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', paddingTop: 20 }}
                      aria-label="Eliminar destino"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Resumen / validación */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: balanced ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${balanced ? '#86efac' : '#fca5a5'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: balanced ? '#15803d' : '#dc2626', fontWeight: 500 }}>
                {balanced
                  ? 'Los destinos cuadran con el capital inicial'
                  : `Diferencia: ${Math.abs(totalImporte - capitalInicial).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: balanced ? '#15803d' : '#dc2626' }}>
                {totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                {capitalInicial > 0 && ` / ${capitalInicial.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              style={{
                padding: '8px 14px', border: '1px dashed var(--atlas-blue)', borderRadius: 8,
                background: 'none', cursor: 'pointer', color: 'var(--atlas-blue)',
                fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
              Añadir otro destino
            </button>
          </div>
        )}
      </div>

      {errors.destinos && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: 12 }}>
          <AlertCircle size={14} strokeWidth={1.5} />
          {errors.destinos}
        </div>
      )}

      {/* Nota fiscal */}
      {destinos.some((d) => d.tipo === 'CANCELACION_DEUDA' || d.tipo === 'PERSONAL' || d.tipo === 'INVERSION') && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
          fontSize: 12, color: '#92400e',
        }}>
          Solo los destinos <strong>Comprar inmueble</strong> o <strong>Reformar inmueble</strong> generan
          intereses deducibles (casilla 0105). Los demás destinos no son deducibles en rendimiento inmobiliario.
        </div>
      )}
    </div>
  );
};

export default DestinoCapitalStep;
