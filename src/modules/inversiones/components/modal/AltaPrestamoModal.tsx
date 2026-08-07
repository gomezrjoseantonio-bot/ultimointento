// AltaPrestamoModal · alta y edición de préstamo P2P / a empresa / a familiares
// PR 3 T-INVERSIONES-V5 · Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §E.
// Preview · cálculo financiero · cobros netos previstos en vivo.
//
// Modo edición · se activa pasando `posicion`. Reutiliza el mismo formulario
// (mismos campos, mismo preview) y guarda con `updatePosicion` desde el padre.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion, SubtipoPrestamo } from '../../../../types/inversiones';
import type { RendimientoPeriodico } from '../../../../types/inversiones-extended';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import ModalAtlasPreview, {
  ModalAtlasPreviewBanner,
  ModalAtlasPreviewBlock,
  ModalAtlasPreviewCardDark,
  ModalAtlasPreviewRow,
} from './ModalAtlasPreview';
import CuentaSelect from './CuentaSelect';
import { formatCurrency } from '../../helpers';
import {
  addMonthsISO,
  diaCobroDesde,
  mesesCobroDesde,
  PERIODO_MESES,
  PERIODOS_ANIO,
  primerCobroPorDefecto,
  toDateInput,
  type FrecuenciaCobro,
} from '../../utils/prestamoCalendario';
import styles from '../../styles/atlas-inversiones.module.css';

type Modalidad = 'solo_intereses' | 'capital_e_intereses' | 'al_vencimiento';
type Frecuencia = FrecuenciaCobro;
type Subtipo = SubtipoPrestamo;

export interface AltaPrestamoModalProps {
  /** Presente ⇒ modo edición · el formulario se precarga con sus valores. */
  posicion?: PosicionInversion;
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  /** Solo en modo edición · muestra la zona peligrosa con borrado lógico. */
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const SUBTIPOS: { value: Subtipo; label: string; sub: string }[] = [
  { value: 'p2p', label: 'P2P', sub: 'plataformas (Mintos · SmartFlip…)' },
  { value: 'empresa', label: 'A empresa', sub: 'préstamo a tu propia SL u otra' },
  { value: 'familiar', label: 'A familiares', sub: 'préstamo a un familiar o allegado' },
];

const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: 'solo_intereses', label: 'Solo intereses periódicos · capital al vencimiento' },
  { value: 'capital_e_intereses', label: 'Cuota francesa · capital + intereses' },
  { value: 'al_vencimiento', label: 'Todo al vencimiento (bullet)' },
];

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const ENTIDAD_LABEL: Record<Subtipo, string> = {
  p2p: 'Plataforma',
  empresa: 'Empresa deudora',
  familiar: 'Familiar deudor',
};

const ENTIDAD_PLACEHOLDER: Record<Subtipo, string> = {
  p2p: 'Ej. SmartFlip, Mintos…',
  empresa: 'Ej. propia, Unihouser…',
  familiar: 'Ej. hermano, padres…',
};

/**
 * Retención por defecto. Solo empresarios, profesionales y entidades están
 * obligados a retener; un particular que devuelve un préstamo familiar no
 * practica retención, así que el cobro llega íntegro.
 */
const RETENCION_DEFECTO: Record<Subtipo, string> = {
  p2p: '19',
  empresa: '19',
  familiar: '0',
};

const formatFechaCorta = (iso?: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
};

/** Detecta el subtipo de un préstamo legacy sin `subtipo_prestamo` guardado. */
const inferirSubtipo = (posicion?: PosicionInversion): Subtipo => {
  if (!posicion) return 'p2p';
  if (posicion.subtipo_prestamo) return posicion.subtipo_prestamo;
  const entidad = posicion.entidad ?? '';
  if (/propi[ao]|empresa|\bs\.?l\.?\b|\bs\.?a\.?\b/i.test(entidad)) return 'empresa';
  return 'p2p';
};

const AltaPrestamoModal: React.FC<AltaPrestamoModalProps> = ({
  posicion,
  onSave,
  onDelete,
  onClose,
}) => {
  const uid = useId();
  const esEdicion = posicion != null;
  const rendOrig = posicion?.rendimiento as RendimientoPeriodico | undefined;

  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subtipo, setSubtipo] = useState<Subtipo>(() => inferirSubtipo(posicion));
  const [nombre, setNombre] = useState(posicion?.nombre ?? '');
  const [entidad, setEntidad] = useState(posicion?.entidad ?? '');
  const [capital, setCapital] = useState(() => {
    const cap = posicion?.total_aportado ?? posicion?.valor_actual;
    return cap != null && Number.isFinite(cap) ? String(cap) : '';
  });
  const [tin, setTin] = useState(() => {
    const t = rendOrig?.tasa_interes_anual;
    return t != null && Number.isFinite(t) ? String(t) : '';
  });
  const [duracionMeses, setDuracionMeses] = useState(
    posicion?.duracion_meses != null ? String(posicion.duracion_meses) : '',
  );
  const [modalidad, setModalidad] = useState<Modalidad>(
    posicion?.modalidad_devolucion ?? 'solo_intereses',
  );
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(() => {
    const f = posicion?.frecuencia_cobro;
    if (f && f !== 'al_vencimiento') return f;
    const fp = rendOrig?.frecuencia_pago;
    return fp ?? 'mensual';
  });
  const [retencion, setRetencion] = useState(() => {
    const r = posicion?.retencion_fiscal ?? rendOrig?.retencion_porcentaje;
    if (r != null && Number.isFinite(r)) return String(r);
    return RETENCION_DEFECTO[inferirSubtipo(posicion)];
  });
  // El usuario ha tocado la retención ⇒ dejamos de autoajustarla por subtipo.
  const [retencionTocada, setRetencionTocada] = useState(esEdicion);
  const [fecha, setFecha] = useState(
    () => toDateInput(posicion?.fecha_compra) || today(),
  );
  const [cuentaCargo, setCuentaCargo] = useState(
    posicion?.cuenta_cargo_id != null ? String(posicion.cuenta_cargo_id) : '',
  );
  const [cuentaCobro, setCuentaCobro] = useState(
    posicion?.cuenta_cobro_id != null ? String(posicion.cuenta_cobro_id) : '',
  );

  const esVencimiento = modalidad === 'al_vencimiento';
  const duracionNum = parseFloat(duracionMeses) || 0;

  // ── Fecha a partir de la cual se reciben los intereses ────────────────
  // Se propone automáticamente (firma + 1 periodo · o vencimiento si bullet)
  // mientras el usuario no la haya tocado; a partir de ahí manda su valor.
  const primerCobroSugerido = useMemo(
    () => primerCobroPorDefecto(fecha, frecuencia, esVencimiento, duracionNum),
    [fecha, frecuencia, esVencimiento, duracionNum],
  );

  const [primerCobro, setPrimerCobro] = useState(() => {
    if (rendOrig?.fecha_primer_cobro) return toDateInput(rendOrig.fecha_primer_cobro);
    // Legacy · el primer pago cae un periodo después del inicio del devengo.
    if (rendOrig?.fecha_inicio_rendimiento) {
      const paso = PERIODO_MESES[rendOrig.frecuencia_pago ?? 'mensual'] ?? 1;
      return addMonthsISO(toDateInput(rendOrig.fecha_inicio_rendimiento), paso);
    }
    return '';
  });
  const [primerCobroTocado, setPrimerCobroTocado] = useState(
    Boolean(rendOrig?.fecha_primer_cobro || rendOrig?.fecha_inicio_rendimiento),
  );

  useEffect(() => {
    if (primerCobroTocado) return;
    setPrimerCobro(primerCobroSugerido);
  }, [primerCobroSugerido, primerCobroTocado]);

  useEffect(() => {
    if (retencionTocada) return;
    setRetencion(RETENCION_DEFECTO[subtipo]);
  }, [subtipo, retencionTocada]);

  const fechaVencimiento = useMemo(
    () => (fecha && duracionNum > 0 ? addMonthsISO(fecha, Math.round(duracionNum)) : ''),
    [fecha, duracionNum],
  );

  // ── Preview · cobros netos previstos ─────────────────────────────
  // capital_e_intereses · cuota francesa real (PMT) · convertida a la
  // frecuencia seleccionada. Fórmula: c × i / (1 − (1+i)^−n) con `i` la
  // tasa periódica y `n` el nº de periodos. Resto modalidades · solo
  // intereses devengados en el periodo o `neto` total al vencimiento.
  const calc = useMemo(() => {
    const c = parseFloat(capital) || 0;
    const t = parseFloat(tin) || 0;
    const d = parseFloat(duracionMeses) || 0;
    const r = (parseFloat(retencion) || 0) / 100;
    if (c <= 0 || t <= 0 || d <= 0) {
      return { interesBruto: 0, retencionImporte: 0, neto: 0, cuotaPeriodica: 0 };
    }
    const interesAnual = (c * t) / 100;
    const años = d / 12;
    const interesBruto = interesAnual * años;
    const retencionImporte = interesBruto * r;
    const neto = interesBruto - retencionImporte;

    const periodosAño = PERIODOS_ANIO[frecuencia];

    let cuotaPeriodica: number;
    if (modalidad === 'al_vencimiento') {
      cuotaPeriodica = neto;
    } else if (modalidad === 'capital_e_intereses') {
      // Cuota francesa · capital + intereses · periodicidad de la frecuencia.
      const nPeriodos = Math.round((d / 12) * periodosAño);
      const tasaPeriodo = t / 100 / periodosAño;
      cuotaPeriodica = nPeriodos > 0 && tasaPeriodo > 0
        ? (c * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -nPeriodos))
        : 0;
    } else {
      // solo_intereses · interés del periodo, sin amortizar principal.
      cuotaPeriodica = interesAnual / periodosAño;
    }
    return { interesBruto, retencionImporte, neto, cuotaPeriodica };
  }, [capital, tin, duracionMeses, retencion, frecuencia, modalidad]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseFloat(capital);
    const tinNum = parseFloat(tin);
    const duracion = parseFloat(duracionMeses);
    if (!nombre.trim() || !entidad.trim()) return;
    if (!Number.isFinite(cap) || cap <= 0) {
      showToastV5('El capital debe ser mayor que 0');
      return;
    }
    if (!Number.isFinite(tinNum) || tinNum <= 0) {
      showToastV5('El TIN debe ser mayor que 0');
      return;
    }
    if (!Number.isFinite(duracion) || duracion <= 0) {
      showToastV5('La duración debe ser mayor que 0 meses');
      return;
    }
    if (!cuentaCargo) {
      showToastV5('Selecciona la cuenta de cargo del capital');
      return;
    }
    const fechaPrimerCobro = primerCobro || primerCobroSugerido;
    if (!fechaPrimerCobro) {
      showToastV5('Indica desde cuándo se reciben los intereses');
      return;
    }
    if (fechaPrimerCobro < fecha) {
      showToastV5('El primer cobro de intereses no puede ser anterior a la firma');
      return;
    }
    setLoading(true);
    try {
      const frecuenciaPago: Frecuencia = esVencimiento ? 'anual' : frecuencia;
      const retencionNum = parseFloat(retencion) || 0;
      const vencimiento = addMonthsISO(fecha, Math.round(duracion));
      // Inicio del devengo · el generador emite el primer pago un periodo
      // después, así que retrocedemos un periodo desde el primer cobro. En
      // bullet el devengo arranca en la firma (pago único al vencimiento).
      const inicioDevengo = esVencimiento
        ? fecha
        : addMonthsISO(fechaPrimerCobro, -PERIODO_MESES[frecuencia]);

      // La cuenta de cobro viaja DENTRO del rendimiento porque es la que lee la
      // previsión de tesorería. Sin ella los cobros del préstamo caían en el
      // cajón "SIN CUENTA". Si no se indica una, cobra la de cargo del capital.
      const cuentaDestino = cuentaCobro ? Number(cuentaCobro) : Number(cuentaCargo);

      const rendimiento: RendimientoPeriodico = {
        tipo_rendimiento: 'interes_fijo',
        tasa_interes_anual: tinNum,
        frecuencia_pago: frecuenciaPago,
        cuenta_destino_id: cuentaDestino,
        meses_cobro: esVencimiento
          ? mesesCobroDesde(fechaPrimerCobro, 'anual')
          : mesesCobroDesde(fechaPrimerCobro, frecuencia),
        dia_cobro: diaCobroDesde(fechaPrimerCobro),
        reinvertir: esVencimiento,
        fecha_inicio_rendimiento: `${inicioDevengo}T12:00:00.000Z`,
        fecha_primer_cobro: `${fechaPrimerCobro}T12:00:00.000Z`,
        ...(vencimiento && { fecha_fin_rendimiento: `${vencimiento}T12:00:00.000Z` }),
        retencion_porcentaje: retencionNum,
        pagos_generados: rendOrig?.pagos_generados ?? [],
      };

      const comun: Partial<PosicionInversion> = {
        nombre: nombre.trim(),
        tipo: 'prestamo_p2p',
        entidad: entidad.trim(),
        subtipo_prestamo: subtipo,
        fecha_compra: `${fecha}T12:00:00.000Z`,
        cuenta_cargo_id: Number(cuentaCargo),
        cuenta_cobro_id: cuentaCobro ? Number(cuentaCobro) : undefined,
        duracion_meses: duracion,
        modalidad_devolucion: modalidad,
        frecuencia_cobro: esVencimiento ? 'al_vencimiento' : frecuencia,
        retencion_fiscal: retencionNum,
        rendimiento,
      };

      if (esEdicion && posicion) {
        // Edición · no reescribimos el histórico de cobros. Si cambia el
        // capital, ajustamos la aportación inicial y el valor vivo por delta
        // (así se conserva lo ya amortizado).
        const capitalPrevio = Number(posicion.total_aportado ?? posicion.valor_actual ?? 0);
        const delta = cap - capitalPrevio;
        const aportaciones = [...(posicion.aportaciones ?? [])].sort((a, b) =>
          String(a.fecha).localeCompare(String(b.fecha)),
        );
        const idxInicial = aportaciones.findIndex((a) => a.tipo === 'aportacion');
        if (delta !== 0 && idxInicial >= 0) {
          aportaciones[idxInicial] = {
            ...aportaciones[idxInicial],
            importe: Number(aportaciones[idxInicial].importe ?? 0) + delta,
            fecha: `${fecha}T12:00:00.000Z`,
            cuenta_cargo_id: Number(cuentaCargo),
          };
        }
        const totalAportado = aportaciones.reduce(
          (sum, a) =>
            a.tipo === 'reembolso'
              ? sum - Number(a.importe ?? 0)
              : a.tipo === 'aportacion'
                ? sum + Number(a.importe ?? 0)
                : sum,
          0,
        );
        await onSave({
          ...comun,
          ...(delta !== 0 && {
            aportaciones,
            total_aportado: totalAportado,
            valor_actual: Math.max(0, Number(posicion.valor_actual ?? 0) + delta),
            fecha_valoracion: posicion.fecha_valoracion,
          }),
        });
      } else {
        await onSave({
          ...comun,
          fecha_valoracion: `${fecha}T12:00:00.000Z`,
          valor_actual: cap,
          importe_inicial: cap,
          total_aportado: cap,
          rentabilidad_euros: 0,
          rentabilidad_porcentaje: 0,
          aportaciones: [],
          activo: true,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const sinRetencion = (parseFloat(retencion) || 0) === 0;

  return (
    <ModalAtlas onClose={onClose} ariaLabel={esEdicion ? 'Editar préstamo' : 'Alta préstamo'}>
      <ModalAtlasHeader
        icon={<Icons.Banknote size={18} strokeWidth={1.7} />}
        title={esEdicion ? 'Editar préstamo' : 'Nuevo préstamo'}
        subtitle={
          esEdicion
            ? `${posicion?.nombre ?? ''} · condiciones y calendario de cobros`
            : 'P2P · a empresa o a familiares · cobros netos previstos en vivo'
        }
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Modalidad de préstamo</div>
              <div className={`${styles.selectorH} ${styles.cols3}`} role="radiogroup">
                {SUBTIPOS.map((s) => {
                  const active = subtipo === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.tab}${active ? ' ' + styles.active : ''}`}
                      onClick={() => setSubtipo(s.value)}
                      data-subtipo={s.value}
                    >
                      <span className={styles.tabLabel}>{s.label}</span>
                      <span className={styles.tabSub}>{s.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Identificación</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-nombre`}>
                    Nombre del préstamo<span className={styles.req}>*</span>
                  </label>
                  <input
                    id={`${uid}-nombre`}
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. SmartFlip · 10% TIN"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-entidad`}>
                    {ENTIDAD_LABEL[subtipo]}
                    <span className={styles.req}>*</span>
                  </label>
                  <input
                    id={`${uid}-entidad`}
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder={ENTIDAD_PLACEHOLDER[subtipo]}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Condiciones financieras</div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-capital`}>
                    Capital<span className={styles.req}>€</span>
                  </label>
                  <input
                    id={`${uid}-capital`}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    placeholder="10000"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-tin`}>
                    TIN<span className={styles.req}>%</span>
                  </label>
                  <input
                    id={`${uid}-tin`}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="10.00"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-duracion`}>
                    Duración<span className={styles.req}>meses</span>
                  </label>
                  <input
                    id={`${uid}-duracion`}
                    type="number"
                    step="1"
                    min="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={duracionMeses}
                    onChange={(e) => setDuracionMeses(e.target.value)}
                    placeholder="60"
                  />
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-modalidad`}>
                    Modalidad devolución
                  </label>
                  <select
                    id={`${uid}-modalidad`}
                    className={styles.select}
                    value={modalidad}
                    onChange={(e) => setModalidad(e.target.value as Modalidad)}
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-frecuencia`}>
                    Frecuencia cobro
                  </label>
                  <select
                    id={`${uid}-frecuencia`}
                    className={styles.select}
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
                    disabled={esVencimiento}
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {esVencimiento && (
                    <div className={styles.hint}>Bullet · cobro único al vencimiento.</div>
                  )}
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-retencion`}>
                    Retención<span className={styles.opt}>%</span>
                  </label>
                  <input
                    id={`${uid}-retencion`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className={`${styles.input} ${styles.mono}`}
                    value={retencion}
                    onChange={(e) => {
                      setRetencionTocada(true);
                      setRetencion(e.target.value);
                    }}
                  />
                  {subtipo === 'familiar' && sinRetencion && (
                    <div className={styles.hint}>
                      Un particular no practica retención · el cobro llega íntegro.
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-firma`}>
                    Fecha firma<span className={styles.req}>*</span>
                  </label>
                  <input
                    id={`${uid}-firma`}
                    type="date"
                    className={styles.input}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${uid}-intereses-desde`}>
                    Intereses desde<span className={styles.req}>*</span>
                  </label>
                  <input
                    id={`${uid}-intereses-desde`}
                    type="date"
                    className={styles.input}
                    value={primerCobro}
                    min={fecha || undefined}
                    onChange={(e) => {
                      setPrimerCobroTocado(true);
                      setPrimerCobro(e.target.value);
                    }}
                    required
                  />
                  <div className={styles.hint}>
                    Fecha del primer cobro de intereses · marca el día y los meses
                    del calendario de cobros.
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Cuentas</div>
              <div className={styles.row}>
                <CuentaSelect
                  label="Cuenta de cargo del capital"
                  value={cuentaCargo}
                  onChange={setCuentaCargo}
                  required
                />
                <CuentaSelect
                  label="Cuenta de cobro de los rendimientos"
                  value={cuentaCobro}
                  onChange={setCuentaCobro}
                />
              </div>
            </div>

            {/* Zona peligrosa · soft delete · solo en edición */}
            {esEdicion && onDelete && (
              <div className={styles.section}>
                <div className={styles.sectionTitle} style={{ color: 'var(--atlas-v5-neg)' }}>
                  Zona peligrosa
                </div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => setConfirmDelete(true)}
                    style={{ borderColor: 'var(--atlas-v5-neg)', color: 'var(--atlas-v5-neg)' }}
                  >
                    <Icons.Delete size={13} strokeWidth={2} /> Eliminar préstamo
                  </button>
                ) : (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'var(--atlas-v5-neg-wash)',
                      borderRadius: 8,
                      borderLeft: '3px solid var(--atlas-v5-neg)',
                    }}
                  >
                    <div style={{ fontSize: 12, marginBottom: 10, color: 'var(--atlas-v5-ink-2)' }}>
                      Marca el préstamo como inactivo. No se borra · podrás
                      recuperarlo desde "Posiciones cerradas".
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ModalAtlasButtonGhost
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={loading}
                      >
                        Cancelar
                      </ModalAtlasButtonGhost>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGold}`}
                        onClick={handleDelete}
                        disabled={loading}
                        style={{
                          background: 'var(--atlas-v5-neg)',
                          borderColor: 'var(--atlas-v5-neg)',
                        }}
                      >
                        Confirmar eliminación
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalAtlasForm>
          <ModalAtlasPreview
            header="Cálculo financiero"
            headerIcon={<Icons.Banknote size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Cobros netos previstos"
              value={formatCurrency(calc.neto)}
              valueVariant="gold"
              sub={`bruto ${formatCurrency(calc.interesBruto)} · retención ${formatCurrency(calc.retencionImporte)}`}
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow
                k={`Cuota ${esVencimiento ? 'única' : frecuencia}`}
                v={formatCurrency(calc.cuotaPeriodica)}
              />
              <ModalAtlasPreviewRow k="Interés bruto" v={formatCurrency(calc.interesBruto)} />
              <ModalAtlasPreviewRow
                k="Retención IRPF"
                v={formatCurrency(calc.retencionImporte)}
                variant="neg"
              />
              <ModalAtlasPreviewRow k="Neto final" v={formatCurrency(calc.neto)} variant="pos" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow
                k="Primer cobro"
                v={formatFechaCorta(primerCobro || primerCobroSugerido)}
              />
              <ModalAtlasPreviewRow k="Vencimiento" v={formatFechaCorta(fechaVencimiento)} />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner>
              {subtipo === 'familiar' ? (
                <>
                  Préstamo entre particulares · el prestatario no está obligado a
                  practicar retención, por eso el neto llega íntegro. Los intereses
                  siguen tributando en tu base del ahorro como rendimiento del
                  capital mobiliario. Conviene formalizarlo por escrito y
                  presentar el modelo 600 (exento de ITP).
                </>
              ) : (
                <>
                  Tributación · base ahorro como rendimiento del capital
                  mobiliario. La retención (default 19%) la practica el pagador
                  en cada cobro.
                </>
              )}
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              {esEdicion
                ? 'Los cobros ya registrados se conservan · se recalcula el calendario futuro.'
                : 'Los cobros se generan automáticamente desde la fecha de inicio de intereses.'}
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading
                  ? 'Guardando…'
                  : esEdicion
                    ? 'Guardar cambios'
                    : 'Crear préstamo'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaPrestamoModal;
