// T23.6.3 · PosicionFormV5
//
// Basado en `src/modules/inversiones/components/PosicionFormDialog.tsx`.
// NO redibujar · solo ampliar TIPO_MAP de 6 → 10 tipos no-plan y añadir
// prop `tipoInicial` para pre-selección desde el wizard.
//
// Tipos nuevos (respecto a PosicionFormDialog):
//   - 'etf'              → TipoPosicion: 'etf'
//   - 'reit'             → TipoPosicion: 'reit'
//   - 'prestamo_empresa' → TipoPosicion: 'prestamo_p2p' · marca entidad='propia'
//   - 'cuenta_remunerada'→ TipoPosicion: 'cuenta_remunerada'
//   - 'otro'             → TipoPosicion: 'otro'
//
// Submit sigue escribiendo via `onSave` callback → inversionesService en galería.
// NUNCA planesPensionesService (eso es PlanFormV5).
// Cero hex hardcoded · todo vía tokens v5.

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import type { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
import type { RendimientoPeriodico } from '../../../../types/inversiones-extended';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import dialog from '../Dialog.module.css';
import styles from '../PosicionFormDialog.module.css';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoUI_V5 =
  | 'accion'
  | 'etf'
  | 'reit'
  | 'fondo_inversion'
  | 'prestamo_p2p'
  | 'prestamo_empresa'
  | 'deposito_plazo'
  | 'cuenta_remunerada'
  | 'crypto'
  | 'otro';

type Modalidad = 'solo_intereses' | 'capital_e_intereses' | 'al_vencimiento';
type Frecuencia = 'mensual' | 'trimestral' | 'semestral' | 'anual';
type LiquidacionDeposito = 'al_vencimiento' | 'mensual' | 'trimestral' | 'anual';

interface Props {
  posicion?: PosicionInversion;
  tipoInicial?: TipoUI_V5;
  onSave: (
    posicion: Partial<PosicionInversion> & {
      importe_inicial?: number;
      rendimiento?: RendimientoPeriodico;
      numero_participaciones?: number;
      precio_medio_compra?: number;
      ticker?: string;
      isin?: string;
    },
  ) => void;
  onClose: () => void;
}

interface PosicionLegacy {
  rendimiento?: RendimientoPeriodico & { tasa_interes_anual?: number; frecuencia_pago?: Frecuencia };
  duracion_meses?: number;
  modalidad_devolucion?: Modalidad;
  frecuencia_cobro?: Frecuencia;
  retencion_fiscal?: number;
  liquidacion_intereses?: LiquidacionDeposito;
  numero_participaciones?: number;
  precio_medio_compra?: number;
  dividendo_anual_estimado?: number;
  cuenta_cobro_id?: number;
  total_aportado?: number;
}

// ── Mapas ────────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoUI_V5, string> = {
  accion: 'Acción',
  etf: 'ETF',
  reit: 'REIT',
  fondo_inversion: 'Fondo',
  prestamo_p2p: 'Préstamo P2P',
  prestamo_empresa: 'Préstamo empresa',
  deposito_plazo: 'Depósito',
  cuenta_remunerada: 'Cuenta rem.',
  crypto: 'Crypto',
  otro: 'Otro',
};

const TIPO_MAP: Record<TipoUI_V5, TipoPosicion> = {
  accion: 'accion',
  etf: 'etf',
  reit: 'reit',
  fondo_inversion: 'fondo_inversion',
  prestamo_p2p: 'prestamo_p2p',
  prestamo_empresa: 'prestamo_p2p',
  deposito_plazo: 'deposito_plazo',
  cuenta_remunerada: 'cuenta_remunerada',
  crypto: 'crypto',
  otro: 'otro',
};

const TIPO_UI_FROM_POSICION: Partial<Record<TipoPosicion, TipoUI_V5>> = {
  accion: 'accion',
  etf: 'etf',
  reit: 'reit',
  fondo_inversion: 'fondo_inversion',
  prestamo_p2p: 'prestamo_p2p',
  deposito_plazo: 'deposito_plazo',
  deposito: 'deposito_plazo',
  cuenta_remunerada: 'cuenta_remunerada',
  crypto: 'crypto',
  otro: 'otro',
};

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Valor canónico que identifica un préstamo a la empresa propia en el store de inversiones. */
const ENTIDAD_PROPIA = 'propia';

// Fallback en orden de precedencia: campo directo → rendimiento heredado → default 'mensual'
const resolveFrecuenciaCobro = (l: PosicionLegacy | undefined): Frecuencia =>
  l?.frecuencia_cobro ?? l?.rendimiento?.frecuencia_pago ?? 'mensual';

const PLACEHOLDERS: Record<TipoUI_V5, { nombre: string; entidad: string }> = {
  accion: { nombre: 'Ej. Apple · Inditex', entidad: 'Ej. DEGIRO · Interactive Brokers…' },
  etf: { nombre: 'Ej. iShares Core S&P 500', entidad: 'Ej. DEGIRO · MyInvestor…' },
  reit: { nombre: 'Ej. Realty Income · Merlin', entidad: 'Ej. DEGIRO · Interactive Brokers…' },
  fondo_inversion: { nombre: 'Ej. Indexa Cartera 10', entidad: 'Ej. Indexa · MyInvestor…' },
  prestamo_p2p: { nombre: 'Ej. Smartflip · Juan…', entidad: 'Ej. Mintos · Bondora…' },
  prestamo_empresa: { nombre: 'Ej. Préstamo a empresa propia', entidad: ENTIDAD_PROPIA },
  deposito_plazo: { nombre: 'Ej. Depósito 12m BBVA', entidad: 'Ej. BBVA · Raisin…' },
  cuenta_remunerada: { nombre: 'Ej. Cuenta Naranja ING', entidad: 'Ej. ING · Trade Republic…' },
  crypto: { nombre: 'Ej. Bitcoin · Ethereum', entidad: 'Ej. Binance · Kraken…' },
  otro: { nombre: 'Ej. Crowdlending · Coleccionismo', entidad: 'Ej. plataforma · gestor…' },
};

const PosicionFormV5: React.FC<Props> = ({ posicion, tipoInicial, onSave, onClose }) => {
  const legacy = posicion as (PosicionInversion & PosicionLegacy) | undefined;

  const resolveInitialTipo = (): TipoUI_V5 => {
    if (tipoInicial) return tipoInicial;
    if (posicion) return TIPO_UI_FROM_POSICION[posicion.tipo] ?? 'fondo_inversion';
    return 'accion';
  };

  const [tipoUI, setTipoUI] = useState<TipoUI_V5>(resolveInitialTipo);
  const [cuentas, setCuentas] = useState<Account[]>([]);

  const [form, setForm] = useState({
    nombre: posicion?.nombre ?? '',
    entidad: posicion?.entidad ?? '',
    importe_inicial: legacy?.total_aportado ?? 0,
    valor_actual: posicion?.valor_actual ?? 0,
    fecha_compra: posicion?.fecha_compra?.split('T')[0] ?? today(),
    tasa_interes_anual: legacy?.rendimiento?.tasa_interes_anual ?? 0,
    duracion_meses: legacy?.duracion_meses ?? 12,
    modalidad_devolucion: legacy?.modalidad_devolucion ?? ('solo_intereses' as Modalidad),
    frecuencia_cobro: resolveFrecuenciaCobro(legacy),
    retencion_fiscal: legacy?.retencion_fiscal ?? 19,
    liquidacion_intereses: (legacy?.liquidacion_intereses ?? 'al_vencimiento') as LiquidacionDeposito,
    ticker: posicion?.ticker ?? '',
    isin: posicion?.isin ?? '',
    numero_participaciones: legacy?.numero_participaciones ?? 0,
    precio_medio_compra: legacy?.precio_medio_compra ?? 0,
    dividendo_anual_estimado: legacy?.dividendo_anual_estimado ?? 0,
    cuenta_cargo_id: posicion?.cuenta_cargo_id ? String(posicion.cuenta_cargo_id) : '',
    cuenta_cobro_id: legacy?.cuenta_cobro_id ? String(legacy.cuenta_cobro_id) : '',
    notas: '',
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
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Preview préstamo ──────────────────────────────────────────────────────

  const prestamoPreview = (() => {
    const capital = form.importe_inicial;
    const tasaAnual = form.tasa_interes_anual / 100;
    const duracion = form.duracion_meses;
    const ret = form.retencion_fiscal / 100;
    if (!capital || !tasaAnual || !duracion) return null;

    const mod = form.modalidad_devolucion;
    if (mod === 'al_vencimiento') {
      const capitalFinal = capital * Math.pow(1 + tasaAnual, duracion / 12);
      const intereses = capitalFinal - capital;
      const retEuros = intereses * ret;
      const neto = capitalFinal - retEuros;
      return { tipo: 'vencimiento' as const, capitalFinal, intereses, retEuros, neto };
    }
    if (mod === 'solo_intereses') {
      const divisor =
        form.frecuencia_cobro === 'mensual' ? 12
        : form.frecuencia_cobro === 'trimestral' ? 4
        : form.frecuencia_cobro === 'semestral' ? 2
        : 1;
      const bruto = (capital * tasaAnual) / divisor;
      const retEuros = bruto * ret;
      const neto = bruto - retEuros;
      const netoAnual = neto * divisor;
      return { tipo: 'intereses' as const, divisor, frecuencia: form.frecuencia_cobro, bruto, retEuros, neto, netoAnual };
    }
    if (mod === 'capital_e_intereses') {
      const tasaMensual = tasaAnual / 12;
      const cuota =
        tasaMensual === 0
          ? capital / duracion
          : (capital * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -duracion));
      const totalIntereses = cuota * duracion - capital;
      const retEuros = totalIntereses * ret;
      return { tipo: 'cuotas' as const, cuota, totalIntereses, retEuros };
    }
    return null;
  })();

  // ── Validación ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'Obligatorio';

    const esPrestamo = tipoUI === 'prestamo_p2p' || tipoUI === 'prestamo_empresa';

    if (tipoUI !== 'otro') {
      if (!form.entidad.trim()) e.entidad = 'Obligatorio';
    }

    if (esPrestamo || tipoUI === 'deposito_plazo') {
      if (form.importe_inicial <= 0) e.importe_inicial = 'Debe ser > 0';
      if (form.tasa_interes_anual <= 0) e.tasa_interes_anual = 'Debe ser > 0';
      if (!form.fecha_compra) e.fecha_compra = 'Obligatorio';
      if (form.duracion_meses <= 0) e.duracion_meses = 'Debe ser > 0';
      if (!form.cuenta_cargo_id) e.cuenta_cargo_id = 'Obligatorio';
      if (tipoUI !== 'deposito_plazo' && !form.cuenta_cobro_id) e.cuenta_cobro_id = 'Obligatorio';
    } else if (tipoUI === 'fondo_inversion') {
      if (form.importe_inicial <= 0) e.importe_inicial = 'Debe ser > 0';
      if (form.valor_actual <= 0) e.valor_actual = 'Debe ser > 0';
      if (!form.fecha_compra) e.fecha_compra = 'Obligatorio';
      if (!form.cuenta_cargo_id) e.cuenta_cargo_id = 'Obligatorio';
      if (!form.cuenta_cobro_id) e.cuenta_cobro_id = 'Obligatorio';
    } else if (tipoUI === 'accion' || tipoUI === 'etf' || tipoUI === 'reit' || tipoUI === 'crypto') {
      if (form.numero_participaciones <= 0) e.numero_participaciones = 'Debe ser > 0';
      if (form.precio_medio_compra <= 0) e.precio_medio_compra = 'Debe ser > 0';
      if (form.valor_actual <= 0) e.valor_actual = 'Debe ser > 0';
      if (!form.fecha_compra) e.fecha_compra = 'Obligatorio';
      if (!form.cuenta_cargo_id) e.cuenta_cargo_id = 'Obligatorio';
      if (!form.cuenta_cobro_id) e.cuenta_cobro_id = 'Obligatorio';
    } else if (tipoUI === 'cuenta_remunerada') {
      if (form.importe_inicial <= 0) e.importe_inicial = 'Debe ser > 0';
      if (form.tasa_interes_anual <= 0) e.tasa_interes_anual = 'Debe ser > 0';
      if (!form.cuenta_cargo_id) e.cuenta_cargo_id = 'Obligatorio';
    } else if (tipoUI === 'otro') {
      if (form.valor_actual < 0) e.valor_actual = 'Debe ser ≥ 0';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const tipo = TIPO_MAP[tipoUI];
    const base: Partial<PosicionInversion> & {
      importe_inicial?: number;
      rendimiento?: RendimientoPeriodico;
      numero_participaciones?: number;
      precio_medio_compra?: number;
      ticker?: string;
      isin?: string;
    } = {
      nombre: form.nombre.trim(),
      tipo,
      entidad: form.entidad.trim() || undefined,
      fecha_valoracion: new Date().toISOString(),
      activo: true,
    };

    const esPrestamo = tipoUI === 'prestamo_p2p' || tipoUI === 'prestamo_empresa';

    if (esPrestamo) {
      if (tipoUI === 'prestamo_empresa') {
        base.entidad = form.entidad.trim() || ENTIDAD_PROPIA;
      }
      const esVencimiento = form.modalidad_devolucion === 'al_vencimiento';
      const frecuenciaPago = esVencimiento ? 'anual' : form.frecuencia_cobro;
      Object.assign(base, {
        importe_inicial: form.importe_inicial,
        valor_actual: form.importe_inicial,
        fecha_compra: `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: Number(form.cuenta_cobro_id),
        duracion_meses: form.duracion_meses,
        modalidad_devolucion: form.modalidad_devolucion,
        frecuencia_cobro: esVencimiento ? 'al_vencimiento' : form.frecuencia_cobro,
        retencion_fiscal: form.retencion_fiscal,
        rendimiento: {
          tipo_rendimiento: 'interes_fijo',
          tasa_interes_anual: form.tasa_interes_anual,
          frecuencia_pago: frecuenciaPago,
          reinvertir: esVencimiento,
          fecha_inicio_rendimiento: `${form.fecha_compra}T12:00:00.000Z`,
          retencion_porcentaje: form.retencion_fiscal,
          pagos_generados: legacy?.rendimiento?.pagos_generados ?? [],
        } as RendimientoPeriodico,
      });
    } else if (tipoUI === 'fondo_inversion') {
      Object.assign(base, {
        importe_inicial: form.importe_inicial,
        valor_actual: form.valor_actual,
        isin: form.isin || undefined,
        fecha_compra: `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'accion' || tipoUI === 'etf' || tipoUI === 'reit') {
      Object.assign(base, {
        importe_inicial: form.numero_participaciones * form.precio_medio_compra,
        valor_actual: form.valor_actual,
        ticker: form.ticker || undefined,
        isin: form.isin || undefined,
        numero_participaciones: form.numero_participaciones,
        precio_medio_compra: form.precio_medio_compra,
        dividendo_anual_estimado: form.dividendo_anual_estimado || undefined,
        fecha_compra: `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'crypto') {
      Object.assign(base, {
        importe_inicial: form.numero_participaciones * form.precio_medio_compra,
        valor_actual: form.valor_actual,
        ticker: form.ticker || undefined,
        numero_participaciones: form.numero_participaciones,
        precio_medio_compra: form.precio_medio_compra,
        fecha_compra: `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: Number(form.cuenta_cobro_id),
      });
    } else if (tipoUI === 'deposito_plazo') {
      const frecuenciaPago: Frecuencia =
        form.liquidacion_intereses === 'al_vencimiento' ? 'anual' : form.liquidacion_intereses;
      Object.assign(base, {
        importe_inicial: form.importe_inicial,
        valor_actual: form.importe_inicial,
        fecha_compra: `${form.fecha_compra}T12:00:00.000Z`,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        cuenta_cobro_id: form.cuenta_cobro_id ? Number(form.cuenta_cobro_id) : undefined,
        duracion_meses: form.duracion_meses,
        retencion_fiscal: form.retencion_fiscal,
        liquidacion_intereses: form.liquidacion_intereses,
        rendimiento: {
          tipo_rendimiento: 'interes_fijo',
          tasa_interes_anual: form.tasa_interes_anual,
          frecuencia_pago: frecuenciaPago,
          reinvertir: form.liquidacion_intereses === 'al_vencimiento',
          fecha_inicio_rendimiento: `${form.fecha_compra}T12:00:00.000Z`,
          retencion_porcentaje: form.retencion_fiscal,
          pagos_generados: legacy?.rendimiento?.pagos_generados ?? [],
        } as RendimientoPeriodico,
      });
    } else if (tipoUI === 'cuenta_remunerada') {
      const frecuenciaPago: Frecuencia =
        form.liquidacion_intereses === 'al_vencimiento' ? 'anual' : form.liquidacion_intereses;
      Object.assign(base, {
        importe_inicial: form.importe_inicial,
        valor_actual: form.importe_inicial,
        cuenta_cargo_id: Number(form.cuenta_cargo_id),
        rendimiento: {
          tipo_rendimiento: 'interes_fijo',
          tasa_interes_anual: form.tasa_interes_anual,
          frecuencia_pago: frecuenciaPago,
          reinvertir: false,
          fecha_inicio_rendimiento: new Date().toISOString(),
          retencion_porcentaje: form.retencion_fiscal,
          pagos_generados: [],
        } as RendimientoPeriodico,
      });
    } else if (tipoUI === 'otro') {
      Object.assign(base, {
        importe_inicial: form.importe_inicial || undefined,
        valor_actual: form.valor_actual,
        notas: form.notas || undefined,
      });
    }

    onSave(base);
  };

  // ── Helpers render ────────────────────────────────────────────────────────

  const fieldClass = (key: string) => `${dialog.field} ${errors[key] ? dialog.error : ''}`;

  const renderAccountSelect = (
    label: string,
    key: 'cuenta_cargo_id' | 'cuenta_cobro_id',
    required = true,
  ) => (
    <div className={fieldClass(key)}>
      <label htmlFor={`posv5-${key}`}>{label}{required ? ' *' : ''}</label>
      <select
        id={`posv5-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">Seleccionar cuenta…</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.alias || c.iban}
          </option>
        ))}
      </select>
      {errors[key] && <span className={dialog.err}>{errors[key]}</span>}
    </div>
  );

  const renderPrestamoPreview = () => {
    if (!prestamoPreview) return null;
    const p = prestamoPreview;
    return (
      <div className={styles.preview}>
        <span className={styles.head}>Estimación de rendimiento</span>
        {p.tipo === 'intereses' && (
          <>
            <div className={styles.row}>
              <span className={styles.lab}>Bruto / período</span>
              <span className={styles.val}>{fmt(p.bruto)} €</span>
            </div>
            {form.retencion_fiscal > 0 && (
              <div className={styles.row}>
                <span className={styles.lab}>Retención ({form.retencion_fiscal}%)</span>
                <span className={`${styles.val} ${styles.neg}`}>−{fmt(p.retEuros)} €</span>
              </div>
            )}
            <div className={styles.row}>
              <span className={styles.lab}>Neto / período</span>
              <span className={styles.val}>{fmt(p.neto)} €</span>
            </div>
            <div className={styles.row}>
              <span className={styles.lab}>Neto anual</span>
              <span className={`${styles.val} ${styles.strong}`}>{fmt(p.netoAnual)} €</span>
            </div>
          </>
        )}
        {p.tipo === 'cuotas' && (
          <>
            <div className={styles.row}>
              <span className={styles.lab}>Cuota mensual</span>
              <span className={styles.val}>{fmt(p.cuota)} €</span>
            </div>
            <div className={styles.row}>
              <span className={styles.lab}>Total intereses</span>
              <span className={styles.val}>{fmt(p.totalIntereses)} €</span>
            </div>
            {form.retencion_fiscal > 0 && (
              <div className={styles.row}>
                <span className={styles.lab}>Retención ({form.retencion_fiscal}%)</span>
                <span className={`${styles.val} ${styles.neg}`}>−{fmt(p.retEuros)} €</span>
              </div>
            )}
          </>
        )}
        {p.tipo === 'vencimiento' && (
          <>
            <div className={styles.row}>
              <span className={styles.lab}>Capital al vencimiento</span>
              <span className={styles.val}>{fmt(p.capitalFinal)} €</span>
            </div>
            <div className={styles.row}>
              <span className={styles.lab}>Intereses acumulados</span>
              <span className={styles.val}>{fmt(p.intereses)} €</span>
            </div>
            {form.retencion_fiscal > 0 && (
              <div className={styles.row}>
                <span className={styles.lab}>Retención ({form.retencion_fiscal}%)</span>
                <span className={`${styles.val} ${styles.neg}`}>−{fmt(p.retEuros)} €</span>
              </div>
            )}
            <div className={styles.row}>
              <span className={styles.lab}>Neto al vencimiento</span>
              <span className={`${styles.val} ${styles.strong}`}>{fmt(p.neto)} €</span>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Campos por tipo ───────────────────────────────────────────────────────

  const renderFields = () => {
    const esPrestamo = tipoUI === 'prestamo_p2p' || tipoUI === 'prestamo_empresa';

    if (esPrestamo) {
      const esVencimiento = form.modalidad_devolucion === 'al_vencimiento';
      return (
        <>
          <div className={dialog.row2}>
            <div className={fieldClass('importe_inicial')}>
              <label>Capital prestado *</label>
              <input
                type="number"
                step="0.01"
                value={form.importe_inicial || ''}
                onChange={(e) => set('importe_inicial', parseFloat(e.target.value) || 0)}
                placeholder="10000.00"
              />
              {errors.importe_inicial && <span className={dialog.err}>{errors.importe_inicial}</span>}
            </div>
            <div className={fieldClass('tasa_interes_anual')}>
              <label>TIN anual (%) *</label>
              <input
                type="number"
                step="0.01"
                value={form.tasa_interes_anual || ''}
                onChange={(e) => set('tasa_interes_anual', parseFloat(e.target.value) || 0)}
                placeholder="10.00"
              />
              {errors.tasa_interes_anual && <span className={dialog.err}>{errors.tasa_interes_anual}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('fecha_compra')}>
              <label>Fecha inicio *</label>
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(e) => set('fecha_compra', e.target.value)}
              />
              {errors.fecha_compra && <span className={dialog.err}>{errors.fecha_compra}</span>}
            </div>
            <div className={fieldClass('duracion_meses')}>
              <label>Duración (meses) *</label>
              <input
                type="number"
                min={1}
                value={form.duracion_meses || ''}
                onChange={(e) => set('duracion_meses', parseInt(e.target.value, 10) || 0)}
                placeholder="12"
              />
              {errors.duracion_meses && <span className={dialog.err}>{errors.duracion_meses}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Modalidad *</label>
              <select
                value={form.modalidad_devolucion}
                onChange={(e) => set('modalidad_devolucion', e.target.value as Modalidad)}
              >
                <option value="solo_intereses">Solo intereses (periódicos)</option>
                <option value="capital_e_intereses">Capital + intereses (cuotas)</option>
                <option value="al_vencimiento">Todo al vencimiento</option>
              </select>
            </div>
            {!esVencimiento && (
              <div className={dialog.field}>
                <label>Frecuencia de cobro</label>
                <select
                  value={form.frecuencia_cobro}
                  onChange={(e) => set('frecuencia_cobro', e.target.value as Frecuencia)}
                >
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            )}
          </div>
          <div className={dialog.row2}>
            {renderAccountSelect('Cuenta origen', 'cuenta_cargo_id')}
            {renderAccountSelect('Cuenta cobro', 'cuenta_cobro_id')}
          </div>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Retención fiscal</label>
              <select
                value={form.retencion_fiscal}
                onChange={(e) => set('retencion_fiscal', Number(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={19}>19%</option>
                <option value={21}>21%</option>
                <option value={23}>23%</option>
                <option value={27}>27%</option>
              </select>
            </div>
          </div>
          {renderPrestamoPreview()}
        </>
      );
    }

    if (tipoUI === 'fondo_inversion') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>ISIN</label>
              <input
                type="text"
                value={form.isin}
                onChange={(e) => set('isin', e.target.value)}
                placeholder="ES0…"
              />
            </div>
            <div className={fieldClass('fecha_compra')}>
              <label>Fecha de compra *</label>
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(e) => set('fecha_compra', e.target.value)}
              />
              {errors.fecha_compra && <span className={dialog.err}>{errors.fecha_compra}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('importe_inicial')}>
              <label>Capital invertido *</label>
              <input
                type="number"
                step="0.01"
                value={form.importe_inicial || ''}
                onChange={(e) => set('importe_inicial', parseFloat(e.target.value) || 0)}
                placeholder="5000.00"
              />
              {errors.importe_inicial && <span className={dialog.err}>{errors.importe_inicial}</span>}
            </div>
            <div className={fieldClass('valor_actual')}>
              <label>Valor actual *</label>
              <input
                type="number"
                step="0.01"
                value={form.valor_actual || ''}
                onChange={(e) => set('valor_actual', parseFloat(e.target.value) || 0)}
                placeholder="5200.00"
              />
              {errors.valor_actual && <span className={dialog.err}>{errors.valor_actual}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            {renderAccountSelect('Cuenta origen', 'cuenta_cargo_id')}
            {renderAccountSelect('Cuenta cobro (rescate)', 'cuenta_cobro_id')}
          </div>
        </>
      );
    }

    if (tipoUI === 'accion' || tipoUI === 'etf' || tipoUI === 'reit') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Ticker</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value)}
                placeholder={tipoUI === 'accion' ? 'AAPL · MSFT…' : tipoUI === 'etf' ? 'SPY · CSPX…' : 'O · AMT…'}
              />
            </div>
            <div className={dialog.field}>
              <label>ISIN</label>
              <input
                type="text"
                value={form.isin}
                onChange={(e) => set('isin', e.target.value)}
                placeholder="US0378331005"
              />
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('numero_participaciones')}>
              <label>Nº títulos *</label>
              <input
                type="number"
                step="any"
                value={form.numero_participaciones || ''}
                onChange={(e) => set('numero_participaciones', parseFloat(e.target.value) || 0)}
                placeholder="100"
              />
              {errors.numero_participaciones && (
                <span className={dialog.err}>{errors.numero_participaciones}</span>
              )}
            </div>
            <div className={fieldClass('precio_medio_compra')}>
              <label>Precio medio compra *</label>
              <input
                type="number"
                step="0.0001"
                value={form.precio_medio_compra || ''}
                onChange={(e) => set('precio_medio_compra', parseFloat(e.target.value) || 0)}
                placeholder="25.00"
              />
              {errors.precio_medio_compra && (
                <span className={dialog.err}>{errors.precio_medio_compra}</span>
              )}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('valor_actual')}>
              <label>Valor actual total *</label>
              <input
                type="number"
                step="0.01"
                value={form.valor_actual || ''}
                onChange={(e) => set('valor_actual', parseFloat(e.target.value) || 0)}
                placeholder="2600.00"
              />
              {errors.valor_actual && <span className={dialog.err}>{errors.valor_actual}</span>}
            </div>
            <div className={fieldClass('fecha_compra')}>
              <label>Fecha de compra *</label>
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(e) => set('fecha_compra', e.target.value)}
              />
              {errors.fecha_compra && <span className={dialog.err}>{errors.fecha_compra}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Dividendo anual est. (€/título)</label>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={form.dividendo_anual_estimado || ''}
                onChange={(e) => set('dividendo_anual_estimado', parseFloat(e.target.value) || 0)}
                placeholder="1.20"
              />
            </div>
            {renderAccountSelect('Cuenta cobro', 'cuenta_cobro_id')}
          </div>
          <div className={dialog.row2}>{renderAccountSelect('Cuenta origen', 'cuenta_cargo_id')}</div>
        </>
      );
    }

    if (tipoUI === 'crypto') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Moneda / token</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value)}
                placeholder="BTC · ETH · SOL…"
              />
            </div>
            <div className={fieldClass('fecha_compra')}>
              <label>Fecha de compra *</label>
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(e) => set('fecha_compra', e.target.value)}
              />
              {errors.fecha_compra && <span className={dialog.err}>{errors.fecha_compra}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('numero_participaciones')}>
              <label>Unidades *</label>
              <input
                type="number"
                step="any"
                value={form.numero_participaciones || ''}
                onChange={(e) => set('numero_participaciones', parseFloat(e.target.value) || 0)}
                placeholder="0.5"
              />
              {errors.numero_participaciones && (
                <span className={dialog.err}>{errors.numero_participaciones}</span>
              )}
            </div>
            <div className={fieldClass('precio_medio_compra')}>
              <label>Precio medio compra *</label>
              <input
                type="number"
                step="0.01"
                value={form.precio_medio_compra || ''}
                onChange={(e) => set('precio_medio_compra', parseFloat(e.target.value) || 0)}
                placeholder="30000.00"
              />
              {errors.precio_medio_compra && (
                <span className={dialog.err}>{errors.precio_medio_compra}</span>
              )}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('valor_actual')}>
              <label>Valor actual total *</label>
              <input
                type="number"
                step="0.01"
                value={form.valor_actual || ''}
                onChange={(e) => set('valor_actual', parseFloat(e.target.value) || 0)}
                placeholder="35000.00"
              />
              {errors.valor_actual && <span className={dialog.err}>{errors.valor_actual}</span>}
            </div>
            {renderAccountSelect('Cuenta origen', 'cuenta_cargo_id')}
          </div>
          <div className={dialog.row2}>{renderAccountSelect('Cuenta cobro (venta)', 'cuenta_cobro_id')}</div>
        </>
      );
    }

    if (tipoUI === 'deposito_plazo') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={fieldClass('importe_inicial')}>
              <label>Capital depositado *</label>
              <input
                type="number"
                step="0.01"
                value={form.importe_inicial || ''}
                onChange={(e) => set('importe_inicial', parseFloat(e.target.value) || 0)}
                placeholder="10000.00"
              />
              {errors.importe_inicial && <span className={dialog.err}>{errors.importe_inicial}</span>}
            </div>
            <div className={fieldClass('tasa_interes_anual')}>
              <label>TIN anual (%) *</label>
              <input
                type="number"
                step="0.01"
                value={form.tasa_interes_anual || ''}
                onChange={(e) => set('tasa_interes_anual', parseFloat(e.target.value) || 0)}
                placeholder="3.50"
              />
              {errors.tasa_interes_anual && (
                <span className={dialog.err}>{errors.tasa_interes_anual}</span>
              )}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={fieldClass('fecha_compra')}>
              <label>Fecha de inicio *</label>
              <input
                type="date"
                value={form.fecha_compra}
                onChange={(e) => set('fecha_compra', e.target.value)}
              />
              {errors.fecha_compra && <span className={dialog.err}>{errors.fecha_compra}</span>}
            </div>
            <div className={fieldClass('duracion_meses')}>
              <label>Duración (meses) *</label>
              <input
                type="number"
                min={1}
                value={form.duracion_meses || ''}
                onChange={(e) => set('duracion_meses', parseInt(e.target.value, 10) || 0)}
                placeholder="12"
              />
              {errors.duracion_meses && <span className={dialog.err}>{errors.duracion_meses}</span>}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Retención fiscal</label>
              <select
                value={form.retencion_fiscal}
                onChange={(e) => set('retencion_fiscal', Number(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={19}>19%</option>
                <option value={21}>21%</option>
                <option value={23}>23%</option>
                <option value={27}>27%</option>
              </select>
            </div>
            <div className={dialog.field}>
              <label>Liquidación de intereses</label>
              <select
                value={form.liquidacion_intereses}
                onChange={(e) => set('liquidacion_intereses', e.target.value as LiquidacionDeposito)}
              >
                <option value="al_vencimiento">Al vencimiento</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div className={dialog.row2}>
            {renderAccountSelect('Cuenta origen', 'cuenta_cargo_id')}
            {renderAccountSelect('Cuenta cobro', 'cuenta_cobro_id', false)}
          </div>
          {renderPrestamoPreview()}
        </>
      );
    }

    if (tipoUI === 'cuenta_remunerada') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={fieldClass('importe_inicial')}>
              <label>Capital inicial (€) *</label>
              <input
                type="number"
                step="0.01"
                value={form.importe_inicial || ''}
                onChange={(e) => set('importe_inicial', parseFloat(e.target.value) || 0)}
                placeholder="5000.00"
              />
              {errors.importe_inicial && <span className={dialog.err}>{errors.importe_inicial}</span>}
            </div>
            <div className={fieldClass('tasa_interes_anual')}>
              <label>TIN anual (%) *</label>
              <input
                type="number"
                step="0.01"
                value={form.tasa_interes_anual || ''}
                onChange={(e) => set('tasa_interes_anual', parseFloat(e.target.value) || 0)}
                placeholder="3.50"
              />
              {errors.tasa_interes_anual && (
                <span className={dialog.err}>{errors.tasa_interes_anual}</span>
              )}
            </div>
          </div>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label>Retención fiscal</label>
              <select
                value={form.retencion_fiscal}
                onChange={(e) => set('retencion_fiscal', Number(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={19}>19%</option>
                <option value={21}>21%</option>
                <option value={23}>23%</option>
                <option value={27}>27%</option>
              </select>
            </div>
            <div className={dialog.field}>
              <label>Liquidación de intereses</label>
              <select
                value={form.liquidacion_intereses}
                onChange={(e) => set('liquidacion_intereses', e.target.value as LiquidacionDeposito)}
              >
                <option value="al_vencimiento">Al vencimiento</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div className={dialog.row2}>
            {renderAccountSelect('Cuenta vinculada', 'cuenta_cargo_id')}
          </div>
        </>
      );
    }

    if (tipoUI === 'otro') {
      return (
        <>
          <div className={dialog.row2}>
            <div className={dialog.field}>
              <label htmlFor="posv5-total-aportado">Total aportado (€)</label>
              <input
                id="posv5-total-aportado"
                type="number"
                step="0.01"
                min={0}
                value={form.importe_inicial || ''}
                onChange={(e) => set('importe_inicial', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className={fieldClass('valor_actual')}>
              <label>Valor actual (€)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.valor_actual || ''}
                onChange={(e) => set('valor_actual', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              {errors.valor_actual && <span className={dialog.err}>{errors.valor_actual}</span>}
            </div>
          </div>
          <div className={dialog.field}>
            <label htmlFor="posv5-notas">Notas</label>
            <textarea
              id="posv5-notas"
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              rows={3}
              placeholder="Descripción del activo, condiciones, etc."
            />
          </div>
        </>
      );
    }

    return null;
  };

  const ph = PLACEHOLDERS[tipoUI];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={dialog.overlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${dialog.dialog} ${dialog.sizeMd}`}>
        <div className={dialog.header}>
          <h2>{posicion ? 'Editar posición' : 'Nueva posición'}</h2>
          <button
            type="button"
            className={dialog.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formBody}>
            {/* Tabs tipo */}
            <div className={styles.tabs} role="group" aria-label="Tipo de inversión">
              {(Object.keys(TIPO_LABELS) as TipoUI_V5[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tipoUI === t ? styles.active : ''}
                  aria-pressed={tipoUI === t}
                  onClick={() => {
                    setTipoUI(t);
                    setErrors({});
                  }}
                >
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Nombre y entidad (siempre visibles) */}
            <div className={dialog.row2}>
              <div className={fieldClass('nombre')}>
                <label>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  placeholder={ph.nombre}
                />
                {errors.nombre && <span className={dialog.err}>{errors.nombre}</span>}
              </div>
              {tipoUI !== 'otro' && (
                <div className={fieldClass('entidad')}>
                  <label>Entidad *</label>
                  <input
                    type="text"
                    value={form.entidad}
                    onChange={(e) => set('entidad', e.target.value)}
                    placeholder={ph.entidad}
                  />
                  {errors.entidad && <span className={dialog.err}>{errors.entidad}</span>}
                </div>
              )}
            </div>

            {/* Campos específicos por tipo */}
            {renderFields()}
          </div>

          <div className={dialog.footer}>
            <button type="button" className={dialog.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={dialog.btnPrimary}>
              {posicion ? 'Guardar cambios' : 'Crear posición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosicionFormV5;
