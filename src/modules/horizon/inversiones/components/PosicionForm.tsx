// PosicionForm.tsx
// ATLAS HORIZON: Investment position form (add/edit modal) - Refactored with type-differentiated sections

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, PieChart, Calendar, Banknote } from 'lucide-react';
import { PosicionInversion, TipoPosicion, PlanAportaciones, PlanLiquidacion } from '../../../../types/inversiones';
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

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Reusable month selector: shows 12 toggle buttons. Hidden when frecuencia === 'mensual'. */
const MonthSelector: React.FC<{
  selected: number[];
  onChange: (months: number[]) => void;
  label?: string;
}> = ({ selected, onChange, label }) => {
  const toggle = (m: number) => {
    if (selected.includes(m)) {
      onChange(selected.filter(x => x !== m));
    } else {
      onChange([...selected, m].sort((a, b) => a - b));
    }
  };

  return (
    <div>
      {label && (
        <label style={{
          display: 'block',
          fontFamily: 'var(--font-inter)',
          fontSize: 'var(--text-caption)',
          fontWeight: 500,
          color: 'var(--atlas-navy-1)',
          marginBottom: '0.5rem',
        }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {MONTH_NAMES.map((name, idx) => {
          const m = idx + 1;
          const active = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              style={{
                padding: '0.35rem 0.65rem',
                border: `1px solid ${active ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
                borderRadius: '6px',
                background: active ? 'var(--atlas-blue)' : 'white',
                color: active ? 'white' : 'var(--atlas-navy-1)',
                fontFamily: 'var(--font-inter)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FRECUENCIA_MESES: Record<string, number> = {
  bimestral: 6,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

const PosicionForm: React.FC<PosicionFormProps> = ({ posicion, onSave, onClose }) => {
  const posAny = posicion as any;
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
    // Bloque ①: compra
    fecha_compra: posicion?.fecha_compra?.split('T')[0] || new Date().toISOString().split('T')[0],
    cuenta_cargo_id: posicion?.cuenta_cargo_id ? String(posicion.cuenta_cargo_id) : '',
    // Rendimiento periódico fields
    tasa_interes_anual: posAny?.rendimiento?.tasa_interes_anual || 0,
    frecuencia_pago: ((posAny?.rendimiento?.frecuencia_pago || 'mensual') as RendimientoPeriodico['frecuencia_pago']),
    meses_cobro_rendimiento: (posAny?.rendimiento?.meses_cobro as number[]) || [],
    dia_cobro_rendimiento: posAny?.rendimiento?.dia_cobro || 1,
    retencion_rendimiento: posAny?.rendimiento?.retencion_porcentaje ?? 19,
    integracion_fiscal_rendimiento: posAny?.rendimiento?.integracion_fiscal ?? 'ahorro',
    reinvertir: posAny?.rendimiento?.reinvertir ?? false,
    cuenta_destino_id: posAny?.rendimiento?.cuenta_destino_id || '',
    fecha_inicio_rendimiento: posAny?.rendimiento?.fecha_inicio_rendimiento?.split('T')[0] || new Date().toISOString().split('T')[0],
    fecha_fin_rendimiento: posAny?.rendimiento?.fecha_fin_rendimiento?.split('T')[0] || '',
    // Dividendos fields
    numero_participaciones: posAny?.numero_participaciones || 0,
    precio_medio_compra: posAny?.precio_medio_compra || 0,
    paga_dividendos: posAny?.dividendos?.paga_dividendos ?? false,
    frecuencia_dividendos: posAny?.dividendos?.frecuencia_dividendos || 'trimestral',
    meses_cobro_dividendos: (posAny?.dividendos?.meses_cobro as number[]) || [],
    dia_cobro_dividendos: posAny?.dividendos?.dia_cobro || 1,
    dividendo_por_accion: posAny?.dividendos?.dividendo_por_accion || 0,
    retencion_dividendos: posAny?.dividendos?.retencion_porcentaje ?? 19,
    retencion_origen_dividendos: posAny?.dividendos?.retencion_origen_porcentaje ?? 0,
    integracion_fiscal_dividendos: posAny?.dividendos?.integracion_fiscal ?? 'ahorro',
    cuenta_destino_dividendos_id: posAny?.dividendos?.cuenta_destino_dividendos_id || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);

  // Plan de Aportaciones
  const existingPlanAp = posicion?.plan_aportaciones;
  const [planApActivo, setPlanApActivo] = useState(existingPlanAp?.activo ?? false);
  const [planAp, setPlanAp] = useState<Omit<PlanAportaciones, 'activo'>>({
    importe: existingPlanAp?.importe || 0,
    frecuencia: existingPlanAp?.frecuencia || 'mensual',
    meses: existingPlanAp?.meses || [],
    dia_cargo: existingPlanAp?.dia_cargo || 1,
    cuenta_cargo_id: existingPlanAp?.cuenta_cargo_id || 0,
    fecha_inicio: existingPlanAp?.fecha_inicio?.split('T')[0] || new Date().toISOString().split('T')[0],
    fecha_fin: existingPlanAp?.fecha_fin?.split('T')[0] || '',
  });

  // Plan de Liquidación
  const existingPlanLiq = posicion?.plan_liquidacion;
  const [planLiqActivo, setPlanLiqActivo] = useState(existingPlanLiq?.activo ?? false);
  const [planLiq, setPlanLiq] = useState<Omit<PlanLiquidacion, 'activo'>>({
    tipo_liquidacion: existingPlanLiq?.tipo_liquidacion || 'venta',
    fecha_estimada: existingPlanLiq?.fecha_estimada?.split('T')[0] || '',
    liquidacion_total: existingPlanLiq?.liquidacion_total ?? true,
    importe_estimado: existingPlanLiq?.importe_estimado || 0,
    cuenta_destino_id: existingPlanLiq?.cuenta_destino_id || 0,
  });
  const [showAdvancedPlans, setShowAdvancedPlans] = useState(
    Boolean(existingPlanAp?.activo || existingPlanLiq?.activo),
  );

  useEffect(() => {
    cuentasService.list().then(setCuentas).catch(() => setCuentas([]));
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Auto-populate liquidation plan for deposito_plazo
  useEffect(() => {
    if (
      formData.tipo === 'deposito_plazo' &&
      formData.fecha_fin_rendimiento &&
      !existingPlanLiq?.activo
    ) {
      setPlanLiqActivo(true);
      setPlanLiq(prev => ({
        ...prev,
        tipo_liquidacion: 'vencimiento',
        fecha_estimada: formData.fecha_fin_rendimiento,
        liquidacion_total: true,
        importe_estimado: formData.valor_actual || formData.importe_inicial,
        cuenta_destino_id: Number(formData.cuenta_destino_id) || prev.cuenta_destino_id,
      }));
    }
  }, [formData.tipo, formData.fecha_fin_rendimiento, formData.cuenta_destino_id, formData.valor_actual, formData.importe_inicial, existingPlanLiq?.activo]);

  const tipoCategoria = getTipoCategoria(formData.tipo);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.entidad.trim()) newErrors.entidad = 'La entidad es obligatoria';
    if (!posicion && formData.importe_inicial <= 0) newErrors.importe_inicial = 'El importe inicial debe ser mayor que 0';
    if (formData.valor_actual <= 0) newErrors.valor_actual = 'El valor debe ser mayor que 0';
    if (!formData.fecha_compra) newErrors.fecha_compra = 'La fecha de compra es obligatoria';
    if (!formData.cuenta_cargo_id) newErrors.cuenta_cargo_id = 'La cuenta de cargo es obligatoria';
    if (tipoCategoria === 'rendimiento') {
      if (formData.tasa_interes_anual <= 0) newErrors.tasa_interes_anual = 'La tasa de interés debe ser mayor que 0';
      if (!formData.fecha_inicio_rendimiento) newErrors.fecha_inicio_rendimiento = 'La fecha de inicio es obligatoria';
      if (!formData.reinvertir && !formData.cuenta_destino_id) newErrors.cuenta_destino_id = 'Selecciona una cuenta destino';
      if (formData.frecuencia_pago !== 'mensual' && formData.meses_cobro_rendimiento.length === 0) {
        newErrors.meses_cobro_rendimiento = `Selecciona los meses de cobro para frecuencia ${formData.frecuencia_pago}`;
      }
    }
    if (tipoCategoria === 'dividendos') {
      if (formData.numero_participaciones <= 0) newErrors.numero_participaciones = 'El número de participaciones debe ser mayor que 0';
      if (formData.paga_dividendos) {
        if (!formData.dividendo_por_accion || formData.dividendo_por_accion <= 0) {
          newErrors.dividendo_por_accion = 'El dividendo por acción debe ser mayor que 0';
        }
        if (formData.frecuencia_dividendos !== 'mensual' && formData.meses_cobro_dividendos.length === 0) {
          newErrors.meses_cobro_dividendos = `Selecciona los meses de cobro para frecuencia ${formData.frecuencia_dividendos}`;
        }
      }
    }
    if (planApActivo) {
      if (!planAp.importe || planAp.importe <= 0) newErrors.planAp_importe = 'El importe de la aportación debe ser mayor que 0';
      if (!planAp.cuenta_cargo_id) newErrors.planAp_cuenta = 'La cuenta de cargo es obligatoria';
      if (!planAp.fecha_inicio) newErrors.planAp_fecha_inicio = 'La fecha de inicio es obligatoria';
      if (planAp.frecuencia !== 'mensual') {
        const expected = FRECUENCIA_MESES[planAp.frecuencia] ?? 0;
        if (expected > 0 && planAp.meses.length !== expected) {
          newErrors.planAp_meses = `Selecciona exactamente ${expected} mes${expected > 1 ? 'es' : ''} para frecuencia ${planAp.frecuencia}`;
        }
      }
    }
    if (planLiqActivo) {
      if (!planLiq.fecha_estimada) newErrors.planLiq_fecha = 'La fecha estimada es obligatoria';
      if (!planLiq.cuenta_destino_id) newErrors.planLiq_cuenta = 'La cuenta destino es obligatoria';
      if (planLiq.liquidacion_total === false) {
        if (!planLiq.importe_estimado || planLiq.importe_estimado <= 0) {
          newErrors.planLiq_importe = 'El importe estimado debe ser mayor que 0 para una liquidación parcial';
        }
      }
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
      fecha_compra: formData.fecha_compra ? `${formData.fecha_compra}T12:00:00.000Z` : undefined,
      cuenta_cargo_id: formData.cuenta_cargo_id ? Number(formData.cuenta_cargo_id) : undefined,
    };

    if (!posicion) {
      dataToSave.importe_inicial = formData.importe_inicial;
      dataToSave.total_aportado = formData.importe_inicial;
    }

    if (tipoCategoria === 'rendimiento') {
      const mesesCobro =
        formData.frecuencia_pago === 'mensual' ? [] : formData.meses_cobro_rendimiento;
      dataToSave.rendimiento = {
        tipo_rendimiento: 'interes_fijo',
        tasa_interes_anual: formData.tasa_interes_anual,
        frecuencia_pago: formData.frecuencia_pago,
        meses_cobro: mesesCobro,
        dia_cobro: formData.dia_cobro_rendimiento,
        retencion_porcentaje: formData.retencion_rendimiento,
        integracion_fiscal: formData.integracion_fiscal_rendimiento,
        reinvertir: formData.reinvertir,
        cuenta_destino_id: formData.reinvertir ? undefined : Number(formData.cuenta_destino_id) || undefined,
        fecha_inicio_rendimiento: new Date(formData.fecha_inicio_rendimiento).toISOString(),
        fecha_fin_rendimiento: formData.fecha_fin_rendimiento ? new Date(formData.fecha_fin_rendimiento).toISOString() : undefined,
        pagos_generados: posAny?.rendimiento?.pagos_generados || [],
      } as RendimientoPeriodico;
    }

    if (tipoCategoria === 'dividendos') {
      dataToSave.numero_participaciones = formData.numero_participaciones;
      dataToSave.precio_medio_compra = formData.precio_medio_compra;
      const mesesCobro =
        formData.frecuencia_dividendos === 'mensual' ? [] : formData.meses_cobro_dividendos;
      dataToSave.dividendos = {
        paga_dividendos: formData.paga_dividendos,
        frecuencia_dividendos: formData.paga_dividendos ? formData.frecuencia_dividendos : undefined,
        meses_cobro: mesesCobro,
        dia_cobro: formData.dia_cobro_dividendos,
        dividendo_por_accion: formData.dividendo_por_accion,
        politica_dividendos: 'distribucion',
        cuenta_destino_dividendos_id: formData.paga_dividendos ? Number(formData.cuenta_destino_dividendos_id) || undefined : undefined,
        retencion_porcentaje: formData.retencion_dividendos,
        retencion_origen_porcentaje: formData.retencion_origen_dividendos,
        integracion_fiscal: formData.integracion_fiscal_dividendos,
        dividendos_recibidos: posAny?.dividendos?.dividendos_recibidos || [],
      };
    }

    if (planApActivo) {
      const mesesAp =
        planAp.frecuencia === 'mensual' ? [] : planAp.meses;
      dataToSave.plan_aportaciones = {
        activo: true,
        importe: planAp.importe,
        frecuencia: planAp.frecuencia,
        meses: mesesAp,
        dia_cargo: planAp.dia_cargo,
        cuenta_cargo_id: planAp.cuenta_cargo_id,
        fecha_inicio: new Date(planAp.fecha_inicio).toISOString(),
        fecha_fin: planAp.fecha_fin ? new Date(planAp.fecha_fin).toISOString() : undefined,
      } as PlanAportaciones;
    } else {
      dataToSave.plan_aportaciones = undefined;
    }

    if (planLiqActivo) {
      dataToSave.plan_liquidacion = {
        activo: true,
        tipo_liquidacion: planLiq.tipo_liquidacion,
        fecha_estimada: new Date(planLiq.fecha_estimada).toISOString(),
        liquidacion_total: planLiq.liquidacion_total,
        importe_estimado: planLiq.liquidacion_total ? formData.valor_actual : planLiq.importe_estimado,
        cuenta_destino_id: planLiq.cuenta_destino_id,
      } as PlanLiquidacion;
    } else {
      dataToSave.plan_liquidacion = undefined;
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

  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };

  const checkboxLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-inter)',
    fontSize: '0.9375rem',
    color: 'var(--atlas-navy-1)',
    cursor: 'pointer',
  };

  const modalBackground = 'var(--surface-card, #FFFFFF)';

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(2, 30, 63, 0.56)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div style={{
        background: modalBackground,
        borderRadius: '14px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: 'calc(100vh - 1.5rem)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-2, 0 10px 28px rgba(2, 30, 63, 0.16))',
        border: '1px solid var(--border, #E2E5EE)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--hz-neutral-300)',
          background: modalBackground,
          position: 'sticky',
          top: 0,
          zIndex: 2,
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
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1.25rem 1.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            overflowY: 'auto',
          }}
        >
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
            {/* Bloque ①: compra */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Fecha de compra" required error={errors.fecha_compra}>
                <input
                  type="date"
                  value={formData.fecha_compra}
                  onChange={(e) => setFormData({ ...formData, fecha_compra: e.target.value })}
                  style={inputStyle(!!errors.fecha_compra)}
                />
              </FormField>
              <FormField label="Cuenta de cargo (compra)" required error={errors.cuenta_cargo_id}>
                <select
                  value={formData.cuenta_cargo_id}
                  onChange={(e) => setFormData({ ...formData, cuenta_cargo_id: e.target.value })}
                  style={{ ...selectStyle, border: errors.cuenta_cargo_id ? '1px solid var(--error)' : '1px solid var(--hz-neutral-300)' }}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
                  ))}
                </select>
              </FormField>
            </div>
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
              {formData.frecuencia_pago !== 'mensual' && (
                <MonthSelector
                  label="Meses de cobro"
                  selected={formData.meses_cobro_rendimiento}
                  onChange={(m) => setFormData({ ...formData, meses_cobro_rendimiento: m })}
                />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="Día de cobro (1-31)">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.dia_cobro_rendimiento}
                    onChange={(e) => setFormData({ ...formData, dia_cobro_rendimiento: parseInt(e.target.value) || 1 })}
                    style={inputStyle()}
                  />
                </FormField>
                <FormField label="Retención fiscal (%)">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={formData.retencion_rendimiento}
                    onChange={(e) => setFormData({ ...formData, retencion_rendimiento: parseFloat(e.target.value) ?? 19 })}
                    style={inputStyle()}
                    placeholder="19"
                  />
                </FormField>
              </div>
              <FormField label="Integración IRPF del rendimiento">
                <select
                  value={formData.integracion_fiscal_rendimiento}
                  onChange={(e) => setFormData({ ...formData, integracion_fiscal_rendimiento: e.target.value as 'ahorro' | 'general' })}
                  style={selectStyle}
                >
                  <option value="ahorro">Base del ahorro (intereses, dividendos ordinarios)</option>
                  <option value="general">Base general (otros rendimientos BIG, casillas 0046-0051)</option>
                </select>
              </FormField>
              {formData.integracion_fiscal_rendimiento === 'general' && (
                <div style={{
                  padding: '0.875rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: 'var(--atlas-navy-1)',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '0.875rem',
                }}>
                  Usa esta opción para rendimientos como “otro rendimiento BIG” de entidades tipo Unihouser.
                  ATLAS los integrará en la base general y mantendrá sus retenciones en el total fiscal.
                </div>
              )}
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
              <div style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  id="reinvertir"
                  checked={formData.reinvertir}
                  onChange={(e) => setFormData({ ...formData, reinvertir: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="reinvertir" style={checkboxLabelStyle}>
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
              <div style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  id="paga_dividendos"
                  checked={formData.paga_dividendos}
                  onChange={(e) => setFormData({ ...formData, paga_dividendos: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="paga_dividendos" style={checkboxLabelStyle}>
                  Paga dividendos
                </label>
              </div>
              {formData.paga_dividendos && (
                <>
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
                  {formData.frecuencia_dividendos !== 'mensual' && (
                    <MonthSelector
                      label="Meses de cobro de dividendos"
                      selected={formData.meses_cobro_dividendos}
                      onChange={(m) => setFormData({ ...formData, meses_cobro_dividendos: m })}
                    />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <FormField label="Día cobro (1-31)">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={formData.dia_cobro_dividendos}
                        onChange={(e) => setFormData({ ...formData, dia_cobro_dividendos: parseInt(e.target.value) || 1 })}
                        style={inputStyle()}
                      />
                    </FormField>
                    <FormField label="Dividendo por acción (€)">
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.dividendo_por_accion}
                        onChange={(e) => setFormData({ ...formData, dividendo_por_accion: parseFloat(e.target.value) || 0 })}
                        style={inputStyle()}
                        placeholder="0.50"
                      />
                    </FormField>
                    <FormField label="Retención España (%)">
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={100}
                        value={formData.retencion_dividendos}
                        onChange={(e) => setFormData({ ...formData, retencion_dividendos: parseFloat(e.target.value) ?? 19 })}
                        style={inputStyle()}
                        placeholder="19"
                      />
                    </FormField>
                  </div>
                  <FormField label="Retención en origen (%) — acciones extranjeras">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={formData.retencion_origen_dividendos}
                      onChange={(e) => setFormData({ ...formData, retencion_origen_dividendos: parseFloat(e.target.value) ?? 0 })}
                      style={inputStyle()}
                      placeholder="0 (EEUU: 15, BE: 30…)"
                    />
                  </FormField>
                  <FormField label="Integración IRPF del dividendo/rendimiento">
                    <select
                      value={formData.integracion_fiscal_dividendos}
                      onChange={(e) => setFormData({ ...formData, integracion_fiscal_dividendos: e.target.value as 'ahorro' | 'general' })}
                      style={selectStyle}
                    >
                      <option value="ahorro">Base del ahorro (dividendos e intereses ordinarios)</option>
                      <option value="general">Base general (otros rendimientos BIG, casillas 0046-0051)</option>
                    </select>
                  </FormField>
                </>
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

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '10px',
            background: 'var(--hz-neutral-50)',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-inter)' }}>
                Configuración avanzada (opcional)
              </p>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-gray)', fontSize: '0.875rem', fontFamily: 'var(--font-inter)' }}>
                Aportaciones periódicas y planificación de liquidación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedPlans(!showAdvancedPlans)}
              style={{
                border: '1px solid var(--hz-neutral-300)',
                borderRadius: '8px',
                background: 'white',
                color: 'var(--atlas-blue)',
                fontWeight: 600,
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              {showAdvancedPlans ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {showAdvancedPlans && (
            <>
              {/* Bloque ①: Plan de Aportaciones Periódicas */}
              <Section title="Plan de Aportaciones Periódicas" icon={Banknote} color="purple">
                <div style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    id="planAp_activo"
                    checked={planApActivo}
                    onChange={(e) => setPlanApActivo(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="planAp_activo" style={checkboxLabelStyle}>
                    Tengo aportaciones periódicas programadas
                  </label>
                </div>
                {planApActivo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <FormField label="Importe por aportación (€)" required error={errors.planAp_importe}>
                        <input
                          type="number"
                          step="0.01"
                          value={planAp.importe}
                          onChange={(e) => setPlanAp({ ...planAp, importe: parseFloat(e.target.value) || 0 })}
                          style={inputStyle(!!errors.planAp_importe)}
                          placeholder="200.00"
                        />
                      </FormField>
                      <FormField label="Frecuencia">
                        <select
                          value={planAp.frecuencia}
                          onChange={(e) => setPlanAp({ ...planAp, frecuencia: e.target.value as PlanAportaciones['frecuencia'] })}
                          style={selectStyle}
                        >
                          <option value="mensual">Mensual</option>
                          <option value="bimestral">Bimestral</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </FormField>
                    </div>
                    {planAp.frecuencia !== 'mensual' && (
                      <div>
                        <MonthSelector
                          label={`Meses de cargo (${FRECUENCIA_MESES[planAp.frecuencia] ?? '?'} meses para ${planAp.frecuencia})`}
                          selected={planAp.meses}
                          onChange={(m) => setPlanAp({ ...planAp, meses: m })}
                        />
                        {errors.planAp_meses && (
                          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
                            {errors.planAp_meses}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <FormField label="Día del cargo (1-31)">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={planAp.dia_cargo}
                          onChange={(e) => setPlanAp({ ...planAp, dia_cargo: parseInt(e.target.value) || 1 })}
                          style={inputStyle()}
                        />
                      </FormField>
                      <FormField label="Cuenta de cargo" required error={errors.planAp_cuenta}>
                        <select
                          value={planAp.cuenta_cargo_id || ''}
                          onChange={(e) => setPlanAp({ ...planAp, cuenta_cargo_id: Number(e.target.value) || 0 })}
                          style={{ ...selectStyle, border: errors.planAp_cuenta ? '1px solid var(--error)' : '1px solid var(--hz-neutral-300)' }}
                        >
                          <option value="">Seleccionar cuenta...</option>
                          {cuentas.map(c => (
                            <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <FormField label="Fecha inicio" required error={errors.planAp_fecha_inicio}>
                        <input
                          type="date"
                          value={planAp.fecha_inicio}
                          onChange={(e) => setPlanAp({ ...planAp, fecha_inicio: e.target.value })}
                          style={inputStyle(!!errors.planAp_fecha_inicio)}
                        />
                      </FormField>
                      <FormField label="Fecha fin (vacío = indefinido)">
                        <input
                          type="date"
                          value={planAp.fecha_fin || ''}
                          onChange={(e) => setPlanAp({ ...planAp, fecha_fin: e.target.value || '' })}
                          style={inputStyle()}
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </Section>

              {/* Bloque ③: Plan de Liquidación */}
              <Section title="Plan de Liquidación" icon={Calendar} color="orange">
                <div style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    id="planLiq_activo"
                    checked={planLiqActivo}
                    onChange={(e) => setPlanLiqActivo(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="planLiq_activo" style={checkboxLabelStyle}>
                    Tengo prevista una fecha de venta/vencimiento/rescate
                  </label>
                </div>
                {planLiqActivo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <FormField label="Tipo de liquidación">
                        <select
                          value={planLiq.tipo_liquidacion}
                          onChange={(e) => setPlanLiq({ ...planLiq, tipo_liquidacion: e.target.value as PlanLiquidacion['tipo_liquidacion'] })}
                          style={selectStyle}
                        >
                          <option value="vencimiento">Vencimiento</option>
                          <option value="venta">Venta</option>
                          <option value="rescate">Rescate</option>
                        </select>
                      </FormField>
                      <FormField label="Fecha estimada" required error={errors.planLiq_fecha}>
                        <input
                          type="date"
                          value={planLiq.fecha_estimada}
                          onChange={(e) => setPlanLiq({ ...planLiq, fecha_estimada: e.target.value })}
                          style={inputStyle(!!errors.planLiq_fecha)}
                        />
                      </FormField>
                    </div>
                    <div style={checkboxRowStyle}>
                      <input
                        type="radio"
                        id="liq_total"
                        name="liquidacion_tipo"
                        checked={planLiq.liquidacion_total}
                        onChange={() => setPlanLiq({ ...planLiq, liquidacion_total: true })}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="liq_total" style={checkboxLabelStyle}>Total</label>
                      <input
                        type="radio"
                        id="liq_parcial"
                        name="liquidacion_tipo"
                        checked={!planLiq.liquidacion_total}
                        onChange={() => setPlanLiq({ ...planLiq, liquidacion_total: false })}
                        style={{ cursor: 'pointer', marginLeft: '1rem' }}
                      />
                      <label htmlFor="liq_parcial" style={checkboxLabelStyle}>Parcial</label>
                    </div>
                    {!planLiq.liquidacion_total && (
                      <FormField label="Importe estimado (€)">
                        <input
                          type="number"
                          step="0.01"
                          value={planLiq.importe_estimado}
                          onChange={(e) => setPlanLiq({ ...planLiq, importe_estimado: parseFloat(e.target.value) || 0 })}
                          style={inputStyle()}
                          placeholder="5000.00"
                        />
                      </FormField>
                    )}
                    <FormField label="Cuenta destino" required error={errors.planLiq_cuenta}>
                      <select
                        value={planLiq.cuenta_destino_id || ''}
                        onChange={(e) => setPlanLiq({ ...planLiq, cuenta_destino_id: Number(e.target.value) || 0 })}
                        style={{ ...selectStyle, border: errors.planLiq_cuenta ? '1px solid var(--error)' : '1px solid var(--hz-neutral-300)' }}
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
            </>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            marginTop: '0.5rem',
            position: 'sticky',
            bottom: 0,
            background: modalBackground,
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--hz-neutral-200)',
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
