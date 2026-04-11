import React, { useEffect, useState } from 'react';
import {
  AlertCircle, BarChart2, ChevronDown, ChevronUp,
  Home, MoreHorizontal, Plus, Trash2, Wrench, CreditCard, TrendingUp, User,
} from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { DestinoCapital, Garantia } from '../../../../../types/prestamos';
import { inmuebleService } from '../../../../../services/inmuebleService';

interface DestinoCapitalStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const TIPO_OPTIONS: { id: DestinoCapital['tipo']; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'ADQUISICION',       label: 'Comprar inmueble',  sub: 'Adquisición de vivienda o local', icon: <Home size={16} strokeWidth={1.5} /> },
  { id: 'REFORMA',           label: 'Reformar inmueble', sub: 'Obras, mejoras o rehabilitación', icon: <Wrench size={16} strokeWidth={1.5} /> },
  { id: 'CANCELACION_DEUDA', label: 'Cancelar deuda',    sub: 'Cancelar otro préstamo o deuda',  icon: <CreditCard size={16} strokeWidth={1.5} /> },
  { id: 'INVERSION',         label: 'Inversión',         sub: 'Financiar activo financiero',      icon: <TrendingUp size={16} strokeWidth={1.5} /> },
  { id: 'PERSONAL',          label: 'Personal',          sub: 'Gasto personal (no deducible)',    icon: <User size={16} strokeWidth={1.5} /> },
  { id: 'OTRA',              label: 'Otra',              sub: 'Otro destino',                    icon: <MoreHorizontal size={16} strokeWidth={1.5} /> },
];

const GARANTIA_OPTIONS: { id: Garantia['tipo']; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'HIPOTECARIA',  label: 'Hipotecaria',  sub: 'Un inmueble responde como garantía',       icon: <Home size={18} strokeWidth={1.5} /> },
  { id: 'PERSONAL',     label: 'Personal',     sub: 'El titular responde con su patrimonio',     icon: <User size={18} strokeWidth={1.5} /> },
  { id: 'PIGNORATICIA', label: 'Pignoraticia', sub: 'Activo financiero pignorado (fondo, PP…)',  icon: <BarChart2 size={18} strokeWidth={1.5} /> },
];

const needsInmueble = (tipo: DestinoCapital['tipo']) =>
  tipo === 'ADQUISICION' || tipo === 'REFORMA';

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `d_${globalThis.crypto.randomUUID()}`;
  }
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sugerirGarantia(destinos: DestinoCapital[] | undefined): Garantia[] {
  if (!destinos?.length) return [{ tipo: 'PERSONAL' }];
  const primerInmueble = destinos.find((d) => d.inmuebleId)?.inmuebleId;
  if (!primerInmueble) return [{ tipo: 'PERSONAL' }];
  return [{ tipo: 'HIPOTECARIA', inmuebleId: primerInmueble }];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: 'var(--bg)',
  color: 'var(--atlas-navy-1)',
  boxSizing: 'border-box',
};

const DestinoCapitalStep: React.FC<DestinoCapitalStepProps> = ({ data, onChange, errors }) => {
  const [inmuebles, setInmuebles] = useState<any[]>([]);
  const [showGarantia, setShowGarantia] = useState(false);

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

  const deriveAmbito = (ds: DestinoCapital[]): Partial<PrestamoFinanciacion> => ({
    ambito: ds.some((d) => d.inmuebleId) ? 'INMUEBLE' : 'PERSONAL',
  });

  const handleAdd = () => {
    const remaining = Math.max(0, capitalInicial - totalImporte);
    const newDestino: DestinoCapital = { id: generateId(), tipo: 'ADQUISICION', importe: remaining };
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

  // Garantía
  const garantias: Garantia[] = data.garantias ?? sugerirGarantia(destinos);
  const tipoGarantia = garantias[0]?.tipo ?? 'PERSONAL';
  const inmuebleGarantia = garantias[0]?.inmuebleId ?? '';
  const descripcionGarantia = garantias[0]?.descripcion ?? '';

  const handleGarantiaTipo = (tipo: Garantia['tipo']) => {
    onChange({
      garantias: [{
        tipo,
        inmuebleId: tipo === 'HIPOTECARIA' ? garantias[0]?.inmuebleId : undefined,
      }],
    });
  };

  const handleGarantiaOpen = () => {
    if (!showGarantia && !data.garantias?.length) {
      // Auto-inicializar con la sugerencia cuando el usuario abre la sección
      onChange({ garantias: sugerirGarantia(destinos) });
    }
    setShowGarantia(!showGarantia);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cabecera */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--atlas-navy-1)', marginBottom: 4 }}>
          ¿Para qué se pide el dinero?
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-gray)', marginBottom: 16 }}>
          El destino determina qué intereses son deducibles fiscalmente.
        </div>

        {/* Lista vacía */}
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

        {/* Lista de destinos */}
        {destinos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {destinos.map((destino, idx) => (
              <div
                key={destino.id}
                style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, backgroundColor: 'var(--bg)' }}
              >
                {/* Selector tipo */}
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
                          borderRadius: 7, padding: '8px 6px', cursor: 'pointer',
                          backgroundColor: destino.tipo === opt.id ? 'rgba(4,44,94,0.07)' : 'var(--bg)',
                          color: destino.tipo === opt.id ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)',
                          fontSize: 11, fontWeight: destino.tipo === opt.id ? 600 : 400,
                          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          transition: 'all 150ms ease',
                        }}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector inmueble */}
                {needsInmueble(destino.tipo) && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-gray)', marginBottom: 4, fontWeight: 500 }}>
                      Inmueble
                    </label>
                    <select
                      style={inputStyle}
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

                {/* Descripción */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-gray)', marginBottom: 4, fontWeight: 500 }}>
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder={needsInmueble(destino.tipo) ? 'Ej: Compra Tenderina 48' : 'Ej: Cancelar préstamo Santander'}
                    value={destino.descripcion || ''}
                    onChange={(e) => handleUpdate(destino.id, { descripcion: e.target.value || undefined })}
                    style={inputStyle}
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
                      style={inputStyle}
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
              padding: '10px 14px', borderRadius: 8,
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

      {/* Error destinos */}
      {errors.destinos && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: 12 }}>
          <AlertCircle size={14} strokeWidth={1.5} />
          {errors.destinos}
        </div>
      )}

      {/* Nota fiscal */}
      {destinos.some((d) => d.tipo === 'CANCELACION_DEUDA' || d.tipo === 'PERSONAL' || d.tipo === 'INVERSION') && (
        <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#fffbeb', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
          Solo los destinos <strong>Comprar inmueble</strong> o <strong>Reformar inmueble</strong> generan
          intereses deducibles (casilla 0105).
        </div>
      )}

      {/* ── GARANTÍA (colapsada) ── */}
      <div>
        <button
          type="button"
          onClick={handleGarantiaOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '9px 14px',
            border: '1px solid #ddd', borderRadius: 8,
            backgroundColor: 'var(--bg)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--atlas-navy-1)',
          }}
        >
          <span>
            Garantía{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-gray)' }}>— informativa, no afecta a cálculos</span>
          </span>
          {showGarantia
            ? <ChevronUp size={16} strokeWidth={1.5} />
            : <ChevronDown size={16} strokeWidth={1.5} />}
        </button>

        {showGarantia && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Tipo de garantía */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {GARANTIA_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleGarantiaTipo(opt.id)}
                  style={{
                    border: `2px solid ${tipoGarantia === opt.id ? 'var(--atlas-blue)' : '#ddd'}`,
                    borderRadius: 8, padding: '12px 8px', cursor: 'pointer',
                    backgroundColor: tipoGarantia === opt.id ? 'rgba(4,44,94,0.07)' : 'var(--bg)',
                    color: tipoGarantia === opt.id ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)',
                    textAlign: 'left', transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>{opt.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: tipoGarantia === opt.id ? 700 : 500 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* Inmueble garante */}
            {tipoGarantia === 'HIPOTECARIA' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-gray)', marginBottom: 6 }}>
                  Inmueble en garantía
                </label>
                <select
                  style={inputStyle}
                  value={inmuebleGarantia}
                  onChange={(e) => {
                    const g = garantias[0] ?? { tipo: 'HIPOTECARIA' as const };
                    onChange({ garantias: [{ ...g, inmuebleId: e.target.value || undefined }] });
                  }}
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

            {/* Descripción */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-gray)', marginBottom: 6 }}>
                Descripción (opcional)
              </label>
              <input
                type="text"
                placeholder={
                  tipoGarantia === 'HIPOTECARIA' ? 'Ej: Buigas 15, Sant Fruitós' :
                  tipoGarantia === 'PIGNORATICIA' ? 'Ej: Plan Pensiones Orange' :
                  'Ej: Aval personal de Jose'
                }
                value={descripcionGarantia}
                onChange={(e) => {
                  const g = garantias[0] ?? { tipo: tipoGarantia };
                  onChange({ garantias: [{ ...g, descripcion: e.target.value || undefined }] });
                }}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinoCapitalStep;
