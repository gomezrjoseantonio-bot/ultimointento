// PosicionForm.tsx
// ATLAS HORIZON: Adaptive investment form — type tabs, minimal fields, no scroll

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
import { RendimientoPeriodico } from '../../../../types/inversiones-extended';
import { cuentasService } from '../../../../services/cuentasService';
import { Account } from '../../../../services/db';

interface PosicionFormProps {
  posicion?: PosicionInversion;
  onSave: (posicion: Partial<PosicionInversion> & {
    importe_inicial?: number;
    rendimiento?: RendimientoPeriodico;
    numero_participaciones?: number;
    precio_medio_compra?: number;
    ticker?: string;
    isin?: string;
  }) => void;
  onClose: () => void;
}

// ── UI type tabs ──────────────────────────────────────────────────────────────

type TipoUI = 'prestamo' | 'plan_pp' | 'fondo' | 'accion' | 'crypto' | 'deposito';

const TIPO_LABELS: Record<TipoUI, string> = {
  prestamo: 'Préstamo',
  plan_pp: 'Plan PP',
  fondo: 'Fondo',
  accion: 'Acción',
  crypto: 'Crypto',
  deposito: 'Depósito',
};

const TIPO_MAP: Record<TipoUI, TipoPosicion> = {
  prestamo: 'prestamo_p2p',
  plan_pp: 'plan_pensiones',
  fondo: 'fondo_inversion',
  accion: 'accion',
  crypto: 'crypto',
  deposito: 'deposito_plazo',
};

const TIPO_UI_FROM_POSICION: Partial<Record<TipoPosicion, TipoUI>> = {
  prestamo_p2p: 'prestamo',
  plan_pensiones: 'plan_pp',
  plan_empleo: 'plan_pp',
  fondo_inversion: 'fondo',
  accion: 'accion',
  etf: 'accion',
  reit: 'accion',
  crypto: 'crypto',
  deposito_plazo: 'deposito',
  deposito: 'deposito',
};

const PLACEHOLDERS: Record<TipoUI, { nombre: string; entidad: string }> = {
  prestamo: { nombre: 'Ej: Smartflip, Juan...', entidad: 'Ej: Smartflip, Particular...' },
  plan_pp:  { nombre: 'Ej: Plan Orange',        entidad: 'Ej: VidaCaixa, BBVA...' },
  fondo:    { nombre: 'Ej: Indexa Cartera 10',  entidad: 'Ej: Indexa, MyInvestor...' },
  accion:   { nombre: 'Ej: Apple, Inditex',     entidad: 'Ej: DEGIRO, Interactive Brokers...' },
  crypto:   { nombre: 'Ej: Bitcoin, Ethereum',  entidad: 'Ej: Binance, Kraken...' },
  deposito: { nombre: 'Ej: Depósito 12m BBVA',  entidad: 'Ej: BBVA, Raisin...' },
};

const today = () => new Date().toISOString().split('T')[0];

// ── Component ─────────────────────────────────────────────────────────────────

const PosicionForm: React.FC<PosicionFormProps> = ({ posicion, onSave, onClose }) => {
  const posAny = posicion as any;

  const initialTipo: TipoUI = posicion
    ? (TIPO_UI_FROM_POSICION[posicion.tipo] ?? 'fondo')
    : 'prestamo';

  const [tipoUI, setTipoUI] = useState<TipoUI>(initialTipo);
  const [cuentas, setCuentas] = useState<Account[]>([]);

  const [form, setForm] = useState({
    nombre:               posicion?.nombre ?? '',
    entidad:              posicion?.entidad ?? '',
    // Money
    importe_inicial:      (posAny?.total_aportado as number) ?? 0,
    valor_actual:         posicion?.valor_actual ?? 0,
    // Date
    fecha_compra:         posicion?.fecha_compra?.split('T')[0] ?? today(),
    // Interest (prestamo, deposito)
    tasa_interes_anual:   (posAny?.rendimiento?.tasa_interes_anual as number) ?? 0,
    duracion_meses:       (posAny?.duracion_meses as number) ?? 12,
    modalidad_devolucion: ((posAny?.modalidad_devolucion ?? 'solo_intereses') as 'solo_intereses' | 'capital_e_intereses'),
    frecuencia_cobro:     ((posAny?.frecuencia_cobro ?? posAny?.rendimiento?.frecuencia_pago ?? 'mensual') as 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'al_vencimiento'),
    retencion_fiscal:     (posAny?.retencion_fiscal ?? posAny?.rendimiento?.retencion_porcentaje ?? 19) as number,
    // Deposito
    liquidacion_intereses: ((posAny?.liquidacion_intereses ?? 'al_vencimiento') as 'al_vencimiento' | 'mensual' | 'trimestral' | 'anual'),
    // Securities
    ticker:                posicion?.ticker ?? '',
    isin:                  posicion?.isin ?? '',
    numero_participaciones: (posAny?.numero_participaciones as number) ?? 0,
    precio_medio_compra:    (posAny?.precio_medio_compra as number) ?? 0,
    // Accounts
    cuenta_cargo_id: posicion?.cuenta_cargo_id ? String(posicion.cuenta_cargo_id) : '',
    cuenta_cobro_id: posAny?.cuenta_cobro_id   ? String(posAny.cuenta_cobro_id)   : '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    cuentasService.list().then(setCuentas).catch(() => setCuentas([]));
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!form.nombre.trim())  e.nombre  = 'Obligatorio';
    if (!form.entidad.trim()) e.entidad = 'Obligatorio';

    if (tipoUI === 'prestamo') {
      if (form.importe_inicial <= 0)    e.importe_inicial    = 'Debe ser > 0';
      if (form.tasa_interes_anual <= 0) e.tasa_interes_anual = 'Debe ser > 0';
      if (!form.fecha_compra)           e.fecha_compra       = 'Obligatorio';
      if (form.duracion_meses <= 0)     e.duracion_meses     = 'Debe ser > 0';
      if (!form.cuenta_cargo_id)        e.cuenta_cargo_id    = 'Obligatorio';
    } else if (tipoUI === 'plan_pp') {
      if (!form.fecha_compra)    e.fecha_compra = 'Obligatorio';
      if (form.valor_actual < 0) e.valor_actual = 'Debe ser ≥ 0';
    } else if (tipoUI === 'fondo') {
      if (form.importe_inicial <= 0) e.importe_inicial = 'Debe ser > 0';
      if (form.valor_actual <= 0)    e.valor_actual    = 'Debe ser > 0';
      if (!form.fecha_compra)        e.fecha_compra    = 'Obligatorio';
      if (!form.cuenta_cargo_id)     e.cuenta_cargo_id = 'Obligatorio';
      if (!form.cuenta_cobro_id)     e.cuenta_cobro_id = 'Obligatorio';
    } else if (tipoUI === 'accion') {
      if (form.numero_participaciones <= 0) e.numero_participaciones = 'Debe ser > 0';
      if (form.precio_medio_compra <= 0)    e.precio_medio_compra    = 'Debe ser > 0';
      if (form.valor_actual <= 0)           e.valor_actual           = 'Debe ser > 0';
      if (!form.fecha_compra)               e.fecha_compra           = 'Obligatorio';
      if (!form.cuenta_cargo_id)            e.cuenta_cargo_id        = 'Obligatorio';
      if (!form.cuenta_cobro_id)            e.cuenta_cobro_id        = 'Obligatorio';
    } else if (tipoUI === 'crypto') {
      if (form.numero_participaciones <= 0) e.numero_participaciones = 'Debe ser > 0';
      if (form.precio_medio_compra <= 0)    e.precio_medio_compra    = 'Debe ser > 0';
      if (form.valor_actual <= 0)           e.valor_actual           = 'Debe ser > 0';
      if (!form.fecha_compra)               e.fecha_compra           = 'Obligatorio';
      if (!form.cuenta_cobro_id)            e.cuenta_cobro_id        = 'Obligatorio';
    } else if (tipoUI === 'deposito') {
      if (form.importe_inicial <= 0)    e.importe_inicial    = 'Debe ser > 0';
      if (form.tasa_interes_anual <= 0) e.tasa_interes_anual = 'Debe ser > 0';
      if (!form.fecha_compra)           e.fecha_compra       = 'Obligatorio';
      if (form.duracion_meses <= 0)     e.duracion_meses     = 'Debe ser > 0';
      if (!form.cuenta_cargo_id)        e.cuenta_cargo_id    = 'Obligatorio';
      if (!form.cuenta_cobro_id)        e.cuenta_cobro_id    = 'Obligatorio';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const tipo = TIPO_MAP[tipoUI];
    const base: any = {
      nombre:           form.nombre.trim(),
      tipo,
      entidad:          form.entidad.trim(),
      fecha_valoracion: new Date().toISOString(),
      activo:           true,
    };

    if (tipoUI === 'prestamo') {
      const frecuenciaPago = form.frecuencia_cobro === 'al_vencimiento' ? 'anual' : form.frecuencia_cobro;
      Object.assign(base, {
        importe_inicial:      form.importe_inicial,
        valor_actual:         form.importe_inicial,
        fecha_compra:         `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id:      Number(form.cuenta_cargo_id),
        duracion_meses:       form.duracion_meses,
        modalidad_devolucion: form.modalidad_devolucion,
        frecuencia_cobro:     form.frecuencia_cobro,
        retencion_fiscal:     form.retencion_fiscal,
        rendimiento: {
          tipo_rendimiento:         'interes_fijo',
          tasa_interes_anual:       form.tasa_interes_anual,
          frecuencia_pago:          frecuenciaPago,
          reinvertir:               form.frecuencia_cobro === 'al_vencimiento',
          fecha_inicio_rendimiento: `${form.fecha_compra}T12:00:00.000Z`,
          retencion_porcentaje:     form.retencion_fiscal,
          pagos_generados:          posAny?.rendimiento?.pagos_generados ?? [],
        } as RendimientoPeriodico,
      });
    } else if (tipoUI === 'plan_pp') {
      const v = form.valor_actual ?? 0;
      Object.assign(base, {
        importe_inicial: v,
        valor_actual:    v,
        fecha_compra:    `${form.fecha_compra}T12:00:00.000Z`,
      });
    } else if (tipoUI === 'fondo') {
      Object.assign(base, {
        importe_inicial: form.importe_inicial,
        valor_actual:    form.valor_actual,
        isin:            form.isin || undefined,
        fecha_compra:    `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'accion') {
      Object.assign(base, {
        importe_inicial:        form.numero_participaciones * form.precio_medio_compra,
        valor_actual:           form.valor_actual,
        ticker:                 form.ticker || undefined,
        isin:                   form.isin   || undefined,
        numero_participaciones: form.numero_participaciones,
        precio_medio_compra:    form.precio_medio_compra,
        fecha_compra:           `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id:        Number(form.cuenta_cargo_id),
        cuenta_cobro_id:        Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'crypto') {
      Object.assign(base, {
        importe_inicial:        form.numero_participaciones * form.precio_medio_compra,
        valor_actual:           form.valor_actual,
        ticker:                 form.ticker || undefined,
        numero_participaciones: form.numero_participaciones,
        precio_medio_compra:    form.precio_medio_compra,
        fecha_compra:           `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cobro_id:        Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'deposito') {
      const frecuenciaPago = form.liquidacion_intereses === 'al_vencimiento' ? 'anual' : form.liquidacion_intereses;
      Object.assign(base, {
        importe_inicial:       form.importe_inicial,
        valor_actual:          form.importe_inicial,
        fecha_compra:          `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id:       Number(form.cuenta_cargo_id),
        cuenta_cobro_id:       Number(form.cuenta_cobro_id),
        duracion_meses:        form.duracion_meses,
        retencion_fiscal:      form.retencion_fiscal,
        liquidacion_intereses: form.liquidacion_intereses,
        rendimiento: {
          tipo_rendimiento:         'interes_fijo',
          tasa_interes_anual:       form.tasa_interes_anual,
          frecuencia_pago:          frecuenciaPago,
          reinvertir:               form.liquidacion_intereses === 'al_vencimiento',
          fecha_inicio_rendimiento: `${form.fecha_compra}T12:00:00.000Z`,
          retencion_porcentaje:     form.retencion_fiscal,
          pagos_generados:          posAny?.rendimiento?.pagos_generados ?? [],
        } as RendimientoPeriodico,
      });
    }

    onSave(base);
  };

  // ── Style helpers ───────────────────────────────────────────────────────────

  const inp = (err?: string): React.CSSProperties => ({
    width: '100%',
    padding: '6px 10px',
    border: `1px solid ${err ? 'var(--error)' : 'var(--hz-neutral-300)'}`,
    borderRadius: '6px',
    fontFamily: 'var(--font-inter)',
    fontSize: '0.8125rem',
    boxSizing: 'border-box',
    background: 'var(--surface-card, #fff)',
    color: 'var(--atlas-navy-1)',
  });

  const monoInp = (err?: string): React.CSSProperties => ({
    ...inp(err),
    fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
  });

  const sel = (err?: string): React.CSSProperties => ({
    ...inp(err),
    cursor: 'pointer',
  });

  const labelSt: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-inter)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--atlas-navy-1)',
    marginBottom: '4px',
    letterSpacing: '0.01em',
  };

  const errSt: React.CSSProperties = {
    display: 'block',
    fontSize: '0.625rem',
    color: 'var(--error)',
    marginTop: '3px',
  };

  const row2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  };

  // Inline field renderer to avoid extra DOM nodes from wrapper components
  const F = (
    label: string,
    req: boolean,
    err: string | undefined,
    children: React.ReactNode,
  ) => (
    <div>
      <label style={labelSt}>{label}{req ? ' *' : ''}</label>
      {children}
      {err && <span style={errSt}>{err}</span>}
    </div>
  );

  const AccountSel = (
    label: string,
    key: 'cuenta_cargo_id' | 'cuenta_cobro_id',
    req: boolean,
  ) => F(label, req, errors[key], (
    <select
      value={form[key]}
      onChange={e => set(key, e.target.value)}
      style={sel(errors[key])}
    >
      <option value="">Seleccionar cuenta...</option>
      {cuentas.map(c => (
        <option key={c.id} value={c.id}>{c.alias || c.iban}</option>
      ))}
    </select>
  ));

  // ── Type-specific fields ────────────────────────────────────────────────────

  const renderFields = () => {
    if (tipoUI === 'prestamo') return (
      <>
        <div style={row2}>
          {F('Capital prestado', true, errors.importe_inicial,
            <input type="number" step="0.01" value={form.importe_inicial || ''} onChange={e => set('importe_inicial', parseFloat(e.target.value) || 0)} style={monoInp(errors.importe_inicial)} placeholder="10000.00" />
          )}
          {F('Tipo de interés anual (%)', true, errors.tasa_interes_anual,
            <input type="number" step="0.01" value={form.tasa_interes_anual || ''} onChange={e => set('tasa_interes_anual', parseFloat(e.target.value) || 0)} style={monoInp(errors.tasa_interes_anual)} placeholder="10.00" />
          )}
        </div>
        <div style={row2}>
          {F('Fecha del préstamo', true, errors.fecha_compra,
            <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
          )}
          {F('Duración (meses)', true, errors.duracion_meses,
            <input type="number" min={1} value={form.duracion_meses || ''} onChange={e => set('duracion_meses', parseInt(e.target.value) || 0)} style={monoInp(errors.duracion_meses)} placeholder="12" />
          )}
        </div>
        <div style={row2}>
          {F('Modalidad', true, undefined,
            <select value={form.modalidad_devolucion} onChange={e => set('modalidad_devolucion', e.target.value as 'solo_intereses' | 'capital_e_intereses')} style={sel()}>
              <option value="solo_intereses">Solo intereses</option>
              <option value="capital_e_intereses">Capital e intereses</option>
            </select>
          )}
          {F('Frecuencia de cobro', true, undefined,
            <select value={form.frecuencia_cobro} onChange={e => set('frecuencia_cobro', e.target.value as typeof form.frecuencia_cobro)} style={sel()}>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="al_vencimiento">Al vencimiento</option>
            </select>
          )}
        </div>
        <div style={row2}>
          {F('Retención fiscal', false, undefined,
            <select value={form.retencion_fiscal} onChange={e => set('retencion_fiscal', Number(e.target.value))} style={sel()}>
              <option value={0}>0%</option>
              <option value={19}>19%</option>
              <option value={21}>21%</option>
              <option value={23}>23%</option>
              <option value={27}>27%</option>
            </select>
          )}
          {AccountSel('Cuenta origen', 'cuenta_cargo_id', true)}
        </div>
      </>
    );

    if (tipoUI === 'plan_pp') return (
      <div style={row2}>
        {F('Fecha de apertura', true, errors.fecha_compra,
          <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
        )}
        {F('Valor actual', true, errors.valor_actual,
          <input type="number" step="0.01" min={0} value={form.valor_actual || ''} onChange={e => set('valor_actual', parseFloat(e.target.value) || 0)} style={monoInp(errors.valor_actual)} placeholder="0.00" />
        )}
      </div>
    );

    if (tipoUI === 'fondo') return (
      <>
        <div style={row2}>
          {F('ISIN', false, undefined,
            <input type="text" value={form.isin} onChange={e => set('isin', e.target.value)} style={inp()} placeholder="ES0..." />
          )}
          {F('Fecha de compra', true, errors.fecha_compra,
            <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
          )}
        </div>
        <div style={row2}>
          {F('Capital invertido', true, errors.importe_inicial,
            <input type="number" step="0.01" value={form.importe_inicial || ''} onChange={e => set('importe_inicial', parseFloat(e.target.value) || 0)} style={monoInp(errors.importe_inicial)} placeholder="5000.00" />
          )}
          {F('Valor actual', true, errors.valor_actual,
            <input type="number" step="0.01" value={form.valor_actual || ''} onChange={e => set('valor_actual', parseFloat(e.target.value) || 0)} style={monoInp(errors.valor_actual)} placeholder="5200.00" />
          )}
        </div>
        <div style={row2}>
          {AccountSel('Cuenta origen', 'cuenta_cargo_id', true)}
          {AccountSel('Cuenta cobro (rescate)', 'cuenta_cobro_id', true)}
        </div>
      </>
    );

    if (tipoUI === 'accion') return (
      <>
        <div style={row2}>
          {F('Ticker', false, undefined,
            <input type="text" value={form.ticker} onChange={e => set('ticker', e.target.value)} style={inp()} placeholder="AAPL, MSFT..." />
          )}
          {F('ISIN', false, undefined,
            <input type="text" value={form.isin} onChange={e => set('isin', e.target.value)} style={inp()} placeholder="US0378331005" />
          )}
        </div>
        <div style={row2}>
          {F('Nº títulos', true, errors.numero_participaciones,
            <input type="number" step="any" value={form.numero_participaciones || ''} onChange={e => set('numero_participaciones', parseFloat(e.target.value) || 0)} style={monoInp(errors.numero_participaciones)} placeholder="100" />
          )}
          {F('Precio medio de compra', true, errors.precio_medio_compra,
            <input type="number" step="0.0001" value={form.precio_medio_compra || ''} onChange={e => set('precio_medio_compra', parseFloat(e.target.value) || 0)} style={monoInp(errors.precio_medio_compra)} placeholder="25.00" />
          )}
        </div>
        <div style={row2}>
          {F('Valor actual total', true, errors.valor_actual,
            <input type="number" step="0.01" value={form.valor_actual || ''} onChange={e => set('valor_actual', parseFloat(e.target.value) || 0)} style={monoInp(errors.valor_actual)} placeholder="2600.00" />
          )}
          {F('Fecha de compra', true, errors.fecha_compra,
            <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
          )}
        </div>
        <div style={row2}>
          {AccountSel('Cuenta origen', 'cuenta_cargo_id', true)}
          {AccountSel('Cuenta cobro', 'cuenta_cobro_id', true)}
        </div>
      </>
    );

    if (tipoUI === 'crypto') return (
      <>
        <div style={row2}>
          {F('Moneda / Token', false, undefined,
            <input type="text" value={form.ticker} onChange={e => set('ticker', e.target.value)} style={inp()} placeholder="BTC, ETH, SOL..." />
          )}
          {F('Fecha de compra', true, errors.fecha_compra,
            <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
          )}
        </div>
        <div style={row2}>
          {F('Unidades', true, errors.numero_participaciones,
            <input type="number" step="any" value={form.numero_participaciones || ''} onChange={e => set('numero_participaciones', parseFloat(e.target.value) || 0)} style={monoInp(errors.numero_participaciones)} placeholder="0.5" />
          )}
          {F('Precio medio de compra', true, errors.precio_medio_compra,
            <input type="number" step="0.01" value={form.precio_medio_compra || ''} onChange={e => set('precio_medio_compra', parseFloat(e.target.value) || 0)} style={monoInp(errors.precio_medio_compra)} placeholder="30000.00" />
          )}
        </div>
        <div style={row2}>
          {F('Valor actual total', true, errors.valor_actual,
            <input type="number" step="0.01" value={form.valor_actual || ''} onChange={e => set('valor_actual', parseFloat(e.target.value) || 0)} style={monoInp(errors.valor_actual)} placeholder="35000.00" />
          )}
          {AccountSel('Cuenta cobro (venta)', 'cuenta_cobro_id', true)}
        </div>
      </>
    );

    if (tipoUI === 'deposito') return (
      <>
        <div style={row2}>
          {F('Capital depositado', true, errors.importe_inicial,
            <input type="number" step="0.01" value={form.importe_inicial || ''} onChange={e => set('importe_inicial', parseFloat(e.target.value) || 0)} style={monoInp(errors.importe_inicial)} placeholder="10000.00" />
          )}
          {F('Tipo de interés anual (%)', true, errors.tasa_interes_anual,
            <input type="number" step="0.01" value={form.tasa_interes_anual || ''} onChange={e => set('tasa_interes_anual', parseFloat(e.target.value) || 0)} style={monoInp(errors.tasa_interes_anual)} placeholder="3.50" />
          )}
        </div>
        <div style={row2}>
          {F('Fecha de inicio', true, errors.fecha_compra,
            <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} style={inp(errors.fecha_compra)} />
          )}
          {F('Duración (meses)', true, errors.duracion_meses,
            <input type="number" min={1} value={form.duracion_meses || ''} onChange={e => set('duracion_meses', parseInt(e.target.value) || 0)} style={monoInp(errors.duracion_meses)} placeholder="12" />
          )}
        </div>
        <div style={row2}>
          {F('Retención fiscal', false, undefined,
            <select value={form.retencion_fiscal} onChange={e => set('retencion_fiscal', Number(e.target.value))} style={sel()}>
              <option value={0}>0%</option>
              <option value={19}>19%</option>
              <option value={21}>21%</option>
              <option value={23}>23%</option>
              <option value={27}>27%</option>
            </select>
          )}
          {F('Liquidación de intereses', false, undefined,
            <select value={form.liquidacion_intereses} onChange={e => set('liquidacion_intereses', e.target.value as typeof form.liquidacion_intereses)} style={sel()}>
              <option value="al_vencimiento">Al vencimiento</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
          )}
        </div>
        <div style={row2}>
          {AccountSel('Cuenta origen', 'cuenta_cargo_id', true)}
          {AccountSel('Cuenta cobro', 'cuenta_cobro_id', true)}
        </div>
      </>
    );

    return null;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const ph = PLACEHOLDERS[tipoUI];

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 30, 63, 0.56)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--surface-card, #fff)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '576px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-2, 0 10px 28px rgba(2, 30, 63, 0.16))',
        border: '1px solid var(--border, #E2E5EE)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--hz-neutral-300)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-inter)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
          }}>
            {posicion ? 'Editar posición' : 'Nueva posición'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-gray)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Type tabs */}
          <div style={{
            display: 'flex',
            padding: '10px 20px 0',
            gap: '4px',
          }}>
            {(Object.keys(TIPO_LABELS) as TipoUI[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipoUI(t); setErrors({}); }}
                style={{
                  padding: '5px 9px',
                  border: `1px solid ${tipoUI === t ? 'var(--atlas-navy-1)' : 'var(--hz-neutral-300)'}`,
                  borderRadius: '6px',
                  background: tipoUI === t ? 'var(--atlas-navy-1)' : 'transparent',
                  color: tipoUI === t ? 'var(--surface-card, #fff)' : 'var(--text-gray)',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '11px',
                  fontWeight: tipoUI === t ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 120ms, color 120ms, border-color 120ms',
                }}
              >
                {TIPO_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Fields area — no overflow, fixed layout */}
          <div style={{
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {/* Nombre + Entidad: always first row */}
            <div style={row2}>
              {F('Nombre', true, errors.nombre,
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  style={inp(errors.nombre)}
                  placeholder={ph.nombre}
                />
              )}
              {F('Entidad', true, errors.entidad,
                <input
                  type="text"
                  value={form.entidad}
                  onChange={e => set('entidad', e.target.value)}
                  style={inp(errors.entidad)}
                  placeholder={ph.entidad}
                />
              )}
            </div>

            {/* Type-specific fields — conditional render, not display:none */}
            {renderFields()}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 20px 14px',
            borderTop: '1px solid var(--hz-neutral-300)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              type="submit"
              style={{
                padding: '8px 20px',
                background: 'var(--atlas-navy-1)',
                color: 'var(--surface-card, #fff)',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'var(--font-inter)',
                fontSize: '0.875rem',
                fontWeight: 600,
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
