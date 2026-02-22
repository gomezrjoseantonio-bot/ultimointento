// PosicionForm.tsx
// ATLAS HORIZON: Investment position form (add/edit modal) - Refactored with type-differentiated sections

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
import { RendimientoPeriodico } from '../../../../types/inversiones-extended';
import { cuentasService } from '../../../../services/cuentasService';
import { Account } from '../../../../services/db';
import FormField from './FormField';
import Section from './Section';
import PreviewCard from './PreviewCard';

interface PosicionFormProps {
  posicion?: PosicionInversion;
  onSave: (posicion: Partial<PosicionInversion> & { importe_inicial?: number; rendimiento?: RendimientoPeriodico; numero_participaciones?: number; precio_medio_compra?: number; ticker?: string; isin?: string; }) => void;
  onClose: () => void;
}

type TipoCategoria = 'rendimiento' | 'dividendos' | 'simple';

function getTipoCategoria(tipo: TipoPosicion): TipoCategoria {
  if (['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(tipo)) return 'rendimiento';
  if (['accion', 'etf', 'reit'].includes(tipo)) return 'dividendos';
  return 'simple';
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.75rem',
  border: `1px solid ${hasError ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
  borderRadius: '8px',
  fontFamily: 'var(--font-inter)',
  fontSize: '1rem',
  boxSizing: 'border-box',
});

const PosicionForm: React.FC<PosicionFormProps> = ({ posicion, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    nombre: posicion?.nombre || '',
    tipo: posicion?.tipo || ('fondo_inversion' as TipoPosicion),
    entidad: posicion?.entidad || '',
    isin: posicion?.isin || '',
    ticker: posicion?.ticker || '',
    importe_inicial: posicion?.total_aportado || 0,
    valor_actual: posicion?.valor_actual || 0,
    fecha_valoracion: posicion?.fecha_valoracion?.split('T')[0] || new Date().toISOString().split('T')[0],
    notas: posicion?.notas || '',
    // Rendimiento periódico fields
    tasa_interes_anual: (posicion as any)?.rendimiento?.tasa_interes_anual || 0,
    frecuencia_pago: ((posicion as any)?.rendimiento?.frecuencia_pago || 'mensual') as RendimientoPeriodico['frecuencia_pago'],
    reinvertir: (posicion as any)?.rendimiento?.reinvertir ?? false,
    cuenta_destino_id: (posicion as any)?.rendimiento?.cuenta_destino_id || '',
    fecha_inicio_rendimiento: (posicion as any)?.rendimiento?.fecha_inicio_rendimiento?.split('T')[0] || new Date().toISOString().split('T')[0],
    fecha_fin_rendimiento: (posicion as any)?.rendimiento?.fecha_fin_rendimiento?.split('T')[0] || '',
    // Dividendos fields
    numero_participaciones: (posicion as any)?.numero_participaciones || 0,
    precio_medio_compra: (posicion as any)?.precio_medio_compra || 0,
    paga_dividendos: (posicion as any)?.dividendos?.paga_dividendos ?? false,
    frecuencia_dividendos: (posicion as any)?.dividendos?.frecuencia_dividendos || 'trimestral',
    cuenta_destino_dividendos_id: (posicion as any)?.dividendos?.cuenta_destino_dividendos_id || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);

  useEffect(() => {
    cuentasService.list().then(setCuentas).catch(() => setCuentas([]));
  }, []);

  const tipoCategoria = getTipoCategoria(formData.tipo);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.entidad.trim()) newErrors.entidad = 'La entidad es obligatoria';
    if (!posicion && formData.importe_inicial <= 0) newErrors.importe_inicial = 'El importe inicial debe ser mayor que 0';
    if (formData.valor_actual <= 0) newErrors.valor_actual = 'El valor debe ser mayor que 0';
    if (tipoCategoria === 'rendimiento') {
      if (formData.tasa_interes_anual <= 0) newErrors.tasa_interes_anual = 'La tasa de interés debe ser mayor que 0';
      if (!formData.fecha_inicio_rendimiento) newErrors.fecha_inicio_rendimiento = 'La fecha de inicio es obligatoria';
      if (!formData.reinvertir && !formData.cuenta_destino_id) newErrors.cuenta_destino_id = 'Selecciona una cuenta destino';
    }
    if (tipoCategoria === 'dividendos') {
      if (formData.numero_participaciones <= 0) newErrors.numero_participaciones = 'El número de participaciones debe ser mayor que 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const dataToSave: any = {
      nombre: formData.nombre,
      tipo: formData.tipo,
      entidad: formData.entidad,
      isin: formData.isin || undefined,
      ticker: formData.ticker || undefined,
      valor_actual: formData.valor_actual,
      fecha_valoracion: new Date(formData.fecha_valoracion).toISOString(),
      notas: formData.notas || undefined,
    };

    if (!posicion) {
      dataToSave.importe_inicial = formData.importe_inicial;
      dataToSave.total_aportado = formData.importe_inicial;
    }

    if (tipoCategoria === 'rendimiento') {
      dataToSave.rendimiento = {
        tipo_rendimiento: 'interes_fijo',
        tasa_interes_anual: formData.tasa_interes_anual,
        frecuencia_pago: formData.frecuencia_pago,
        reinvertir: formData.reinvertir,
        cuenta_destino_id: formData.reinvertir ? undefined : Number(formData.cuenta_destino_id) || undefined,
        fecha_inicio_rendimiento: new Date(formData.fecha_inicio_rendimiento).toISOString(),
        fecha_fin_rendimiento: formData.fecha_fin_rendimiento ? new Date(formData.fecha_fin_rendimiento).toISOString() : undefined,
        pagos_generados: (posicion as any)?.rendimiento?.pagos_generados || [],
      } as RendimientoPeriodico;
    }

    if (tipoCategoria === 'dividendos') {
      dataToSave.numero_participaciones = formData.numero_participaciones;
      dataToSave.precio_medio_compra = formData.precio_medio_compra;
      dataToSave.dividendos = {
        paga_dividendos: formData.paga_dividendos,
        frecuencia_dividendos: formData.paga_dividendos ? formData.frecuencia_dividendos : undefined,
        politica_dividendos: 'distribucion',
        cuenta_destino_dividendos_id: formData.paga_dividendos ? Number(formData.cuenta_destino_dividendos_id) || undefined : undefined,
        dividendos_recibidos: (posicion as any)?.dividendos?.dividendos_recibidos || [],
      };
    }

    onSave(dataToSave);
  };

  const tipoOptionGroups = [
    {
      label: 'Rendimiento Periódico',
      options: [
        { value: 'cuenta_remunerada', label: 'Cuenta remunerada' },
        { value: 'prestamo_p2p', label: 'Préstamo P2P' },
        { value: 'deposito_plazo', label: 'Depósito a plazo' },
      ],
    },
    {
      label: 'Dividendos',
      options: [
        { value: 'accion', label: 'Acción' },
        { value: 'etf', label: 'ETF' },
        { value: 'reit', label: 'REIT' },
      ],
    },
    {
      label: 'Valoración Simple',
      options: [
        { value: 'fondo_inversion', label: 'Fondo de inversión' },
        { value: 'plan_pensiones', label: 'Plan de pensiones' },
        { value: 'plan_empleo', label: 'Plan de empleo' },
        { value: 'crypto', label: 'Criptomoneda' },
        { value: 'otro', label: 'Otro' },
      ],
    },
  ];

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid var(--hz-neutral-300)',
    borderRadius: '8px',
    fontFamily: 'var(--font-inter)',
    fontSize: '1rem',
    background: 'white',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
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
        maxWidth: '640px',
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
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-gray)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section: Datos Básicos */}
          <Section title="Datos Básicos">
            <FormField label="Nombre" required error={errors.nombre}>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={inputStyle(!!errors.nombre)}
                placeholder="Ej: Indexa Capital - Cartera 10"
              />
            </FormField>
            <FormField label="Tipo" required>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoPosicion })}
                style={selectStyle}
              >
                {tipoOptionGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </FormField>
            <FormField label="Entidad" required error={errors.entidad}>
              <input
                type="text"
                value={formData.entidad}
                onChange={(e) => setFormData({ ...formData, entidad: e.target.value })}
                style={inputStyle(!!errors.entidad)}
                placeholder="Ej: MyInvestor, BBVA, Degiro"
              />
            </FormField>
          </Section>

          {/* Section: Valoración */}
          <Section title="Valoración">
            <div style={{ display: 'grid', gridTemplateColumns: posicion ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              {!posicion && (
                <FormField label="Importe aportado inicial (€)" required error={errors.importe_inicial}>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.importe_inicial}
                    onChange={(e) => setFormData({ ...formData, importe_inicial: parseFloat(e.target.value) || 0 })}
                    style={inputStyle(!!errors.importe_inicial)}
                    placeholder="1000.00"
                  />
                </FormField>
              )}
              <FormField label="Valor actual (€)" required error={errors.valor_actual}>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_actual}
                  onChange={(e) => setFormData({ ...formData, valor_actual: parseFloat(e.target.value) || 0 })}
                  style={inputStyle(!!errors.valor_actual)}
                  placeholder="10000.00"
                />
              </FormField>
            </div>
            <FormField label="Fecha valoración" required>
              <input
                type="date"
                value={formData.fecha_valoracion}
                onChange={(e) => setFormData({ ...formData, fecha_valoracion: e.target.value })}
                style={inputStyle()}
              />
            </FormField>
          </Section>

          {/* Conditional: Rendimiento Periódico */}
          {tipoCategoria === 'rendimiento' && (
            <Section title="Configuración de Rendimiento Periódico" icon={TrendingUp} color="green">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="Tasa interés anual (%)" required error={errors.tasa_interes_anual}>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tasa_interes_anual}
                    onChange={(e) => setFormData({ ...formData, tasa_interes_anual: parseFloat(e.target.value) || 0 })}
                    style={inputStyle(!!errors.tasa_interes_anual)}
                    placeholder="10.00"
                  />
                </FormField>
                <FormField label="Frecuencia de pago">
                  <select
                    value={formData.frecuencia_pago}
                    onChange={(e) => setFormData({ ...formData, frecuencia_pago: e.target.value as RendimientoPeriodico['frecuencia_pago'] })}
                    style={selectStyle}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Fecha inicio rendimiento" required error={errors.fecha_inicio_rendimiento}>
                <input
                  type="date"
                  value={formData.fecha_inicio_rendimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio_rendimiento: e.target.value })}
                  style={inputStyle(!!errors.fecha_inicio_rendimiento)}
                />
              </FormField>
              {formData.tipo === 'deposito_plazo' && (
                <FormField label="Fecha fin (vencimiento)">
                  <input
                    type="date"
                    value={formData.fecha_fin_rendimiento}
                    onChange={(e) => setFormData({ ...formData, fecha_fin_rendimiento: e.target.value })}
                    style={inputStyle()}
                  />
                </FormField>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="reinvertir"
                  checked={formData.reinvertir}
                  onChange={(e) => setFormData({ ...formData, reinvertir: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="reinvertir" style={{ fontFamily: 'var(--font-inter)', fontSize: '0.9375rem', color: 'var(--atlas-navy-1)', cursor: 'pointer' }}>
                  Reinvertir automáticamente los rendimientos
                </label>
              </div>
              {!formData.reinvertir && (
                <FormField label="Cuenta destino" required error={errors.cuenta_destino_id}>
                  <select
                    value={formData.cuenta_destino_id}
                    onChange={(e) => setFormData({ ...formData, cuenta_destino_id: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
                    ))}
                  </select>
                </FormField>
              )}
              <PreviewCard
                tasaAnual={formData.tasa_interes_anual}
                capital={formData.valor_actual || formData.importe_inicial}
                frecuencia={formData.frecuencia_pago}
              />
            </Section>
          )}

          {/* Conditional: Dividendos */}
          {tipoCategoria === 'dividendos' && (
            <Section title="Configuración de Dividendos" icon={DollarSign} color="blue">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="Nº acciones/participaciones" required error={errors.numero_participaciones}>
                  <input
                    type="number"
                    step="1"
                    value={formData.numero_participaciones}
                    onChange={(e) => setFormData({ ...formData, numero_participaciones: parseFloat(e.target.value) || 0 })}
                    style={inputStyle(!!errors.numero_participaciones)}
                    placeholder="100"
                  />
                </FormField>
                <FormField label="Precio medio de compra (€)">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio_medio_compra}
                    onChange={(e) => setFormData({ ...formData, precio_medio_compra: parseFloat(e.target.value) || 0 })}
                    style={inputStyle()}
                    placeholder="25.00"
                  />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="Ticker">
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    style={inputStyle()}
                    placeholder="AAPL, MSFT..."
                  />
                </FormField>
                <FormField label="ISIN">
                  <input
                    type="text"
                    value={formData.isin}
                    onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
                    style={inputStyle()}
                    placeholder="ES0..."
                  />
                </FormField>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="paga_dividendos"
                  checked={formData.paga_dividendos}
                  onChange={(e) => setFormData({ ...formData, paga_dividendos: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="paga_dividendos" style={{ fontFamily: 'var(--font-inter)', fontSize: '0.9375rem', color: 'var(--atlas-navy-1)', cursor: 'pointer' }}>
                  Paga dividendos
                </label>
              </div>
              {formData.paga_dividendos && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <FormField label="Frecuencia dividendos">
                    <select
                      value={formData.frecuencia_dividendos}
                      onChange={(e) => setFormData({ ...formData, frecuencia_dividendos: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </FormField>
                  <FormField label="Cuenta destino dividendos">
                    <select
                      value={formData.cuenta_destino_dividendos_id}
                      onChange={(e) => setFormData({ ...formData, cuenta_destino_dividendos_id: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {cuentas.map(c => (
                        <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}
            </Section>
          )}

          {/* Conditional: Valoración Simple info */}
          {tipoCategoria === 'simple' && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem',
              background: '#f9fafb',
              border: '1px solid var(--hz-neutral-300)',
              borderRadius: '10px',
            }}>
              <PieChart size={20} style={{ color: 'var(--text-gray)', flexShrink: 0, marginTop: '0.125rem' }} />
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', color: 'var(--text-gray)', margin: 0 }}>
                <strong>Inversión de valoración simple.</strong> La rentabilidad se calcula por diferencia entre el valor actual y el total aportado.
              </p>
            </div>
          )}

          {/* Optional: ISIN & Ticker for simple types */}
          {tipoCategoria === 'simple' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="ISIN">
                <input
                  type="text"
                  value={formData.isin}
                  onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
                  style={inputStyle()}
                  placeholder="ES0..."
                />
              </FormField>
              <FormField label="Ticker">
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                  style={inputStyle()}
                  placeholder="AAPL, TSLA..."
                />
              </FormField>
            </div>
          )}

          {/* Notas */}
          <FormField label="Notas">
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={3}
              style={{
                ...inputStyle(),
                resize: 'vertical',
              }}
              placeholder="Notas adicionales..."
            />
          </FormField>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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
