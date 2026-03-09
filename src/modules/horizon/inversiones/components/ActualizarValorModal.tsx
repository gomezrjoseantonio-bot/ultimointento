// ActualizarValorModal.tsx
// ATLAS HORIZON: Modal to update the current value of an investment position

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ActualizarValorModalProps {
  posicionNombre: string;
  valorActual: number;
  onSave: (nuevoValor: number, fechaValoracion: string) => void;
  onClose: () => void;
}

const ActualizarValorModal: React.FC<ActualizarValorModalProps> = ({
  posicionNombre,
  valorActual,
  onSave,
  onClose,
}) => {
  const [nuevoValor, setNuevoValor] = useState(valorActual);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (nuevoValor <= 0) {
      newErrors.nuevoValor = 'El valor debe ser mayor que 0';
    }
    if (!fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(nuevoValor, new Date(fecha).toISOString());
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(2, 30, 63, 0.56)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface-card, #FFFFFF)',
        border: '1px solid var(--border, #E2E5EE)',
        boxShadow: 'var(--shadow-2, 0 10px 28px rgba(2, 30, 63, 0.16))',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '520px',
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
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
          }}>
            Actualizar valor
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--gray-500)' }}
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
            {/* Nuevo valor */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Nuevo valor actual * (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={nuevoValor}
                onChange={(e) => setNuevoValor(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.nuevoValor ? 'var(--alert)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  background: 'var(--surface-card)',
                  color: 'var(--gray-900)',
                  fontFamily: 'var(--font-base)',
                  fontSize: '1rem',
                }}
                placeholder="10000.00"
              />
              {errors.nuevoValor && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--alert)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.nuevoValor}
                </span>
              )}
            </div>

            {/* Fecha valoración */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Fecha de valoración *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.fecha ? 'var(--alert)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  background: 'var(--surface-card)',
                  color: 'var(--gray-900)',
                  fontFamily: 'var(--font-base)',
                  fontSize: '1rem',
                }}
              />
              {errors.fecha && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--alert)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.fecha}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--surface-card)',
                fontFamily: 'var(--font-base)',
                fontSize: '1rem',
                fontWeight: 500,
                color: 'var(--gray-900)',
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
                fontFamily: 'var(--font-base)',
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

export default ActualizarValorModal;
