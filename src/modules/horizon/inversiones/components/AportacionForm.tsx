// AportacionForm.tsx
// ATLAS HORIZON: Modal form to add an aportacion or reembolso to a posicion

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Aportacion } from '../../../../types/inversiones';

interface AportacionFormProps {
  posicionNombre: string;
  onSave: (aportacion: Omit<Aportacion, 'id'>) => void;
  onClose: () => void;
}

const AportacionForm: React.FC<AportacionFormProps> = ({ posicionNombre, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'aportacion' as 'aportacion' | 'reembolso',
    importe: 0,
    notas: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.importe <= 0) {
      newErrors.importe = 'El importe debe ser mayor que 0';
    }
    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      fecha: new Date(formData.fecha).toISOString(),
      tipo: formData.tipo,
      importe: formData.importe,
      notas: formData.notas || undefined,
    });
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
            Añadir aportación
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
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.fecha ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                }}
              />
              {errors.fecha && (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.fecha}
                </span>
              )}
            </div>

            {/* Tipo */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'aportacion' | 'reembolso' })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--hz-neutral-300)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                  background: 'white',
                }}
              >
                <option value="aportacion">Aportación</option>
                <option value="reembolso">Reembolso</option>
              </select>
            </div>

            {/* Importe */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Importe * (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.importe}
                onChange={(e) => setFormData({ ...formData, importe: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.importe ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                }}
                placeholder="500.00"
              />
              {errors.importe && (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.importe}
                </span>
              )}
            </div>

            {/* Notas */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Notas
              </label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--hz-neutral-300)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
                placeholder="Notas opcionales..."
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--hz-neutral-300)',
                borderRadius: '8px',
                background: 'white',
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                background: 'var(--atlas-blue)',
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 500,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AportacionForm;
