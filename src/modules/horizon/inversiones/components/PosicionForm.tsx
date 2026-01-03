// PosicionForm.tsx
// ATLAS HORIZON: Investment position form (add/edit modal)

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';

interface PosicionFormProps {
  posicion?: PosicionInversion;
  onSave: (posicion: Partial<PosicionInversion>) => void;
  onClose: () => void;
}

const PosicionForm: React.FC<PosicionFormProps> = ({ posicion, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    nombre: posicion?.nombre || '',
    tipo: posicion?.tipo || ('fondo_inversion' as TipoPosicion),
    entidad: posicion?.entidad || '',
    isin: posicion?.isin || '',
    ticker: posicion?.ticker || '',
    valor_actual: posicion?.valor_actual || 0,
    fecha_valoracion: posicion?.fecha_valoracion?.split('T')[0] || new Date().toISOString().split('T')[0],
    notas: posicion?.notas || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }
    if (!formData.entidad.trim()) {
      newErrors.entidad = 'La entidad es obligatoria';
    }
    if (formData.valor_actual <= 0) {
      newErrors.valor_actual = 'El valor debe ser mayor que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const dataToSave = {
      ...formData,
      fecha_valoracion: new Date(formData.fecha_valoracion).toISOString(),
    };

    onSave(dataToSave);
  };

  const tipoOptions: { value: TipoPosicion; label: string }[] = [
    { value: 'fondo_inversion', label: 'Fondo de inversión' },
    { value: 'accion', label: 'Acción' },
    { value: 'etf', label: 'ETF' },
    { value: 'plan_pensiones', label: 'Plan de pensiones' },
    { value: 'plan_empleo', label: 'Plan de empleo' },
    { value: 'crypto', label: 'Criptomoneda' },
    { value: 'deposito', label: 'Depósito' },
    { value: 'otro', label: 'Otro' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--hz-card-bg)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
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
            {posicion ? 'Editar posición' : 'Nueva posición'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: 'var(--text-gray)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Nombre */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Nombre *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.nombre ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                }}
                placeholder="Ej: Indexa Capital - Cartera 10"
              />
              {errors.nombre && (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.nombre}
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
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoPosicion })}
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
                {tipoOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entidad */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                marginBottom: '0.5rem',
              }}>
                Entidad *
              </label>
              <input
                type="text"
                value={formData.entidad}
                onChange={(e) => setFormData({ ...formData, entidad: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.entidad ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                }}
                placeholder="Ej: MyInvestor, BBVA, Degiro"
              />
              {errors.entidad && (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                  {errors.entidad}
                </span>
              )}
            </div>

            {/* ISIN & Ticker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: 'var(--atlas-navy-1)',
                  marginBottom: '0.5rem',
                }}>
                  ISIN
                </label>
                <input
                  type="text"
                  value={formData.isin}
                  onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--hz-neutral-300)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '1rem',
                  }}
                  placeholder="ES0..."
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: 'var(--atlas-navy-1)',
                  marginBottom: '0.5rem',
                }}>
                  Ticker
                </label>
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--hz-neutral-300)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '1rem',
                  }}
                  placeholder="AAPL, TSLA..."
                />
              </div>
            </div>

            {/* Valor actual & Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: 'var(--atlas-navy-1)',
                  marginBottom: '0.5rem',
                }}>
                  Valor actual * (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_actual}
                  onChange={(e) => setFormData({ ...formData, valor_actual: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.valor_actual ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
                    borderRadius: '8px',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '1rem',
                  }}
                  placeholder="10000.00"
                />
                {errors.valor_actual && (
                  <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                    {errors.valor_actual}
                  </span>
                )}
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: 'var(--atlas-navy-1)',
                  marginBottom: '0.5rem',
                }}>
                  Fecha valoración *
                </label>
                <input
                  type="date"
                  value={formData.fecha_valoracion}
                  onChange={(e) => setFormData({ ...formData, fecha_valoracion: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--hz-neutral-300)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '1rem',
                  }}
                />
              </div>
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
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--hz-neutral-300)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem',
            justifyContent: 'flex-end',
          }}>
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
              {posicion ? 'Guardar cambios' : 'Crear posición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosicionForm;
