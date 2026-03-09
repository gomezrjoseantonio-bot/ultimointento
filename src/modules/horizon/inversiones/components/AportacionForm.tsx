// AportacionForm.tsx
// ATLAS HORIZON: Modal form to add an aportacion or reembolso to a posicion

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Aportacion, PosicionInversion } from '../../../../types/inversiones';
import { cuentasService } from '../../../../services/cuentasService';
import { Account } from '../../../../services/db';
import { calcularGananciaPerdidaFIFO } from '../../../../services/inversionesFiscalService';

interface AportacionFormProps {
  posicionNombre: string;
  posicion: PosicionInversion;
  initialAportacion?: Aportacion;
  onSave: (aportacion: Omit<Aportacion, 'id'>) => void;
  onClose: () => void;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const AportacionForm: React.FC<AportacionFormProps> = ({ posicionNombre, posicion, initialAportacion, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    fecha: initialAportacion?.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
    tipo: (initialAportacion?.tipo || 'aportacion') as 'aportacion' | 'reembolso',
    importe: initialAportacion?.importe || 0,
    notas: initialAportacion?.notas || '',
    cuenta_cargo_id: initialAportacion?.cuenta_cargo_id ? String(initialAportacion.cuenta_cargo_id) : '',
    unidades_vendidas: initialAportacion?.unidades_vendidas || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);

  useEffect(() => {
    cuentasService.list().then(setCuentas).catch(() => setCuentas([]));
  }, []);

  const fifoPreview = useMemo(() => {
    if (formData.tipo !== 'reembolso' || formData.importe <= 0) {
      return { costeAdquisicion: 0, gananciaOPerdida: 0 };
    }

    const reembolsoPreview: Aportacion = {
      id: -1,
      fecha: new Date(formData.fecha).toISOString(),
      tipo: 'reembolso',
      importe: formData.importe,
      unidades_vendidas: formData.unidades_vendidas > 0 ? formData.unidades_vendidas : undefined,
    };

    return calcularGananciaPerdidaFIFO(posicion, reembolsoPreview);
  }, [formData.fecha, formData.importe, formData.tipo, formData.unidades_vendidas, posicion]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.importe <= 0) {
      newErrors.importe = 'El importe debe ser mayor que 0';
    }
    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }
    if (formData.tipo === 'reembolso' && formData.unidades_vendidas < 0) {
      newErrors.unidades_vendidas = 'Las unidades vendidas no pueden ser negativas';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Omit<Aportacion, 'id'> = {
      fecha: new Date(formData.fecha).toISOString(),
      tipo: formData.tipo,
      importe: formData.importe,
      notas: formData.notas || undefined,
      cuenta_cargo_id: formData.cuenta_cargo_id ? Number(formData.cuenta_cargo_id) : undefined,
      unidades_vendidas: formData.tipo === 'reembolso' && formData.unidades_vendidas > 0
        ? formData.unidades_vendidas
        : undefined,
    };

    if (formData.tipo === 'reembolso') {
      payload.coste_adquisicion_fifo = round2(fifoPreview.costeAdquisicion);
      payload.ganancia_perdida = round2(fifoPreview.gananciaOPerdida);
    }

    onSave(payload);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid var(--hz-neutral-300)',
    borderRadius: '8px',
    fontFamily: 'var(--font-inter)',
    fontSize: '1rem',
    background: 'white',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--hz-card-bg)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid var(--hz-neutral-300)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-h2)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
          }}>
            {initialAportacion ? 'Editar movimiento' : 'Añadir aportación'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-gray)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <p style={{
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
            color: 'var(--text-gray)',
            margin: '0 0 1.25rem 0',
          }}>
            {posicionNombre}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Fecha */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: `1px solid ${errors.fecha ? 'var(--error)' : 'var(--hz-neutral-300)'}`, borderRadius: '8px', fontFamily: 'var(--font-inter)', fontSize: '1rem' }}
              />
              {errors.fecha && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>{errors.fecha}</span>}
            </div>

            {/* Tipo */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'aportacion' | 'reembolso' })}
                style={selectStyle}
              >
                <option value="aportacion">Aportación</option>
                <option value="reembolso">Reembolso</option>
              </select>
            </div>

            {/* Importe */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                Importe * (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.importe}
                onChange={(e) => setFormData({ ...formData, importe: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '0.75rem', border: `1px solid ${errors.importe ? 'var(--error)' : 'var(--hz-neutral-300)'}`, borderRadius: '8px', fontFamily: 'var(--font-inter)', fontSize: '1rem' }}
                placeholder="500.00"
              />
              {errors.importe && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>{errors.importe}</span>}
            </div>

            {formData.tipo === 'reembolso' && (
              <>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                    Unidades vendidas (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min={0}
                    value={formData.unidades_vendidas || ''}
                    onChange={(e) => setFormData({ ...formData, unidades_vendidas: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: `1px solid ${errors.unidades_vendidas ? 'var(--error)' : 'var(--hz-neutral-300)'}`, borderRadius: '8px', fontFamily: 'var(--font-inter)', fontSize: '1rem' }}
                    placeholder="Ej: 12.5"
                  />
                  {errors.unidades_vendidas && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>{errors.unidades_vendidas}</span>}
                </div>

                <div style={{ background: 'var(--hz-neutral-100)', border: '1px solid var(--hz-neutral-300)', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
                    Coste de adquisición (FIFO): <strong style={{ color: 'var(--atlas-navy-1)' }}>{fifoPreview.costeAdquisicion.toFixed(2)} €</strong>
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: fifoPreview.gananciaOPerdida >= 0 ? '#0d9488' : '#dc2626' }}>
                    Ganancia/Pérdida estimada: {fifoPreview.gananciaOPerdida >= 0 ? '+' : ''}{fifoPreview.gananciaOPerdida.toFixed(2)} €
                  </div>
                </div>
              </>
            )}

            {/* Cuenta cargo */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                Cuenta de cargo
              </label>
              <select value={formData.cuenta_cargo_id} onChange={(e) => setFormData({ ...formData, cuenta_cargo_id: e.target.value })} style={selectStyle}>
                <option value="">Seleccionar cuenta...</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 500, color: 'var(--atlas-navy-1)', marginBottom: '0.5rem' }}>
                Notas
              </label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--hz-neutral-300)', borderRadius: '8px', fontFamily: 'var(--font-inter)', fontSize: '1rem', resize: 'vertical' }}
                placeholder="Notas opcionales..."
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--hz-neutral-300)', borderRadius: '8px', background: 'white', fontFamily: 'var(--font-inter)', fontSize: '1rem', fontWeight: 500, color: 'var(--atlas-navy-1)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', background: 'var(--atlas-blue)', fontFamily: 'var(--font-inter)', fontSize: '1rem', fontWeight: 500, color: 'white', cursor: 'pointer' }}>
              {initialAportacion ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AportacionForm;
