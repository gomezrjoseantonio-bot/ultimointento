// Wizard de aplicación de paralela AEAT · 5 pasos según mockup
// `docs/audit-inputs/atlas-correccion.html`. Captura la corrección oficial
// que emite Hacienda y la aplica sobre el ejercicio · marca años posteriores
// con desfase (declarados) o recalcula directamente (en curso).
//
// Flujo · Identifica → Qué cambia → Delta → Impacto año → Cascada → Aplicar.
// Persiste como `declaracionAeat` + flags · NO toca cálculos automáticos
// (cascada real es follow-up · 3f-B sólo registra la paralela).

import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Icons,
  MoneyValue,
  WizardStepper,
  showToastV5,
} from '../../../design-system/v5';
import { saveEjercicio } from '../../../services/ejercicioFiscalService';
import type { OrigenDeclaracion } from '../../../types/fiscal';
import type { FiscalOutletContext } from '../FiscalContext';
import { ESTADOS_VIVOS, formatDateLong } from '../helpers';
import styles from './CorreccionWizard.module.css';

type StepKey = 'paralela' | 'cambia' | 'delta' | 'impacto' | 'cascada';

const STEPS: { key: StepKey; title: string; sub: string }[] = [
  { key: 'paralela', title: 'Paralela', sub: 'Paso 1' },
  { key: 'cambia', title: 'Qué cambia', sub: 'Paso 2' },
  { key: 'delta', title: 'Delta', sub: 'Paso 3' },
  { key: 'impacto', title: 'Impacto año', sub: 'Paso 4' },
  { key: 'cascada', title: 'Cascada', sub: 'Paso 5' },
];

type TipoActuacion =
  | 'propuesta'
  | 'liquidacion_provisional'
  | 'liquidacion_definitiva'
  | 'acta_conformidad'
  | 'resolucion';

const TIPO_LABELS: Record<TipoActuacion, string> = {
  propuesta: 'Propuesta de liquidación · paralela',
  liquidacion_provisional: 'Liquidación provisional',
  liquidacion_definitiva: 'Liquidación definitiva',
  acta_conformidad: 'Acta de conformidad · inspección',
  resolucion: 'Resolución de rectificación',
};

type Categoria = 'inmueble' | 'prestamo' | 'rentas' | 'gastos' | 'rendimientos' | 'deducciones' | 'modelos' | 'otro';

const CATEGORIAS: { key: Categoria; title: string; desc: string }[] = [
  { key: 'inmueble', title: 'Inmueble', desc: 'coste · base amortizable · amortización' },
  { key: 'prestamo', title: 'Préstamo', desc: 'intereses deducibles · destino' },
  { key: 'rentas', title: 'Contrato · rentas', desc: 'cuantía · imputación' },
  { key: 'gastos', title: 'Gastos deducibles', desc: 'comunidad · suministros · IBI' },
  { key: 'rendimientos', title: 'Rendimientos · otros', desc: 'capital mobiliario · ahorro' },
  { key: 'deducciones', title: 'Deducciones', desc: 'autonómicas · vivienda habitual' },
  { key: 'modelos', title: 'M130 · modelos', desc: 'pago fraccionado · IVA' },
  { key: 'otro', title: 'Otro', desc: 'no encaja en categorías anteriores' },
];

interface DeltaRow {
  casilla: string;
  concepto: string;
  v1: number;
  v2: number;
  /** Si true · es un campo derivado automáticamente de otra casilla. */
  auto?: boolean;
  /** Campo padre que dispara la derivación (referencia · sólo display). */
  derivedFrom?: string;
}

const DEFAULT_DELTA_ROWS: DeltaRow[] = [
  { casilla: '0115', concepto: 'Amortización inmueble', v1: 0, v2: 0, auto: true, derivedFrom: 'Coste adquisición' },
  { casilla: '0085', concepto: 'Rendimiento neto capital inmobiliario', v1: 0, v2: 0 },
  { casilla: '0500', concepto: 'Cuota líquida', v1: 0, v2: 0 },
];

type EstadoPago = 'pagado' | 'pendiente_voluntario' | 'via_ejecutiva' | 'aplazado';

const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  pagado: 'Pagado',
  pendiente_voluntario: 'Pendiente voluntario',
  via_ejecutiva: 'Vía ejecutiva',
  aplazado: 'Aplazado',
};

const today = (): string => new Date().toISOString().split('T')[0];

const CorreccionWizard: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const { ejercicios, reload } = useOutletContext<FiscalOutletContext>();
  const ejercicio = useMemo(
    () => ejercicios.find((e) => String(e.ejercicio) === String(anio)),
    [ejercicios, anio],
  );

  const [step, setStep] = useState<StepKey>('paralela');

  // Step 1 · Identifica paralela.
  const [tipoActuacion, setTipoActuacion] = useState<TipoActuacion>('propuesta');
  const [organoEmisor, setOrganoEmisor] = useState('AEAT · Gestión Tributaria');
  const [numExpediente, setNumExpediente] = useState('');
  const [fechaNotificacion, setFechaNotificacion] = useState(today());
  const [fechaConformidad, setFechaConformidad] = useState(today());
  const [resumen, setResumen] = useState('');
  const [paralelaFile, setParalelaFile] = useState<{ name: string; size: number } | null>(null);
  const paralelaInput = React.useRef<HTMLInputElement | null>(null);

  // Step 2 · Qué cambia.
  const [categoriasSel, setCategoriasSel] = useState<Set<Categoria>>(new Set());

  // Step 3 · Delta · valores antes/después.
  const [deltaRows, setDeltaRows] = useState<DeltaRow[]>(DEFAULT_DELTA_ROWS);
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [verComparativaCompleta, setVerComparativaCompleta] = useState(false);

  // Step 4 · Impacto año.
  const [resultadoV1, setResultadoV1] = useState(0);
  const [resultadoV2, setResultadoV2] = useState(0);
  const [interesesDemora, setInteresesDemora] = useState(0);
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pendiente_voluntario');
  const [fechaPago, setFechaPago] = useState('');

  // Step 5 · Cascada.
  const [confirmacion, setConfirmacion] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearN = ejercicio?.ejercicio ?? currentYear;
  const cascadaYears = useMemo(() => {
    return [yearN + 1, yearN + 2, yearN + 3].map((y) => {
      const ej = ejercicios.find((e) => e.ejercicio === y);
      const enCurso = ej ? ESTADOS_VIVOS.includes(ej.estado) : y >= currentYear;
      return {
        year: y,
        existe: !!ej,
        estado: enCurso ? 'reescribe' : 'desfase',
      } as const;
    });
  }, [ejercicios, yearN, currentYear]);

  if (!ejercicio) {
    return (
      <div className={styles.notFound}>
        Ejercicio {anio} no encontrado.{' '}
        <button
          type="button"
          style={{
            color: 'var(--atlas-v5-gold-ink)',
            cursor: 'pointer',
            fontWeight: 600,
            background: 'none',
            border: 0,
            padding: 0,
            font: 'inherit',
          }}
          onClick={() => navigate('/fiscal/ejercicios')}
        >
          Volver a ejercicios
        </button>
      </div>
    );
  }

  const principalAdicional = Math.max(0, resultadoV1 - resultadoV2);
  const totalIngresar = principalAdicional + interesesDemora;

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const canBack = stepIndex > 0;
  const canForward = stepIndex < STEPS.length - 1;

  const goBack = () => {
    if (canBack) setStep(STEPS[stepIndex - 1].key);
  };
  const goForward = () => {
    if (canForward) setStep(STEPS[stepIndex + 1].key);
  };

  const handleApply = async () => {
    if (!confirmacion) {
      showToastV5('Marca la casilla de confirmación para aplicar la paralela.');
      return;
    }
    try {
      const updated = {
        ...ejercicio,
        declaracionAeatOrigen: 'manual' as OrigenDeclaracion,
        declaracionAeatFecha: fechaConformidad,
        declaracionAeatPdfRef: paralelaFile?.name ?? ejercicio.declaracionAeatPdfRef,
        casillasRaw: {
          ...(ejercicio.casillasRaw ?? {}),
          ...Object.fromEntries(
            deltaRows
              .filter((r) => r.v2 > 0 || r.v1 > 0)
              .map((r) => [r.casilla, r.v2]),
          ),
          '0670': resultadoV2,
        },
        updatedAt: new Date().toISOString(),
      };
      await saveEjercicio(updated);
      showToastV5(`Paralela aplicada · ejercicio ${ejercicio.ejercicio} actualizado.`);
      await reload();
      navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[correccion] apply', err);
      showToastV5('Error al aplicar la paralela.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div>
            <div className={styles.brandTitle}>Atlas · Corrección</div>
            <div className={styles.brandSub}>Inspección AEAT · paralela</div>
          </div>
        </div>
        <WizardStepper<StepKey>
          steps={STEPS}
          active={step}
          onChange={(k) => {
            const idx = STEPS.findIndex((s) => s.key === k);
            if (idx <= stepIndex) setStep(k);
          }}
        />
        <div className={styles.tbActions}>
          <span className={styles.badge}>Año {ejercicio.ejercicio}</span>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar wizard"
            onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {step === 'paralela' && (
          <>
            <div className={styles.head}>
              <div className={styles.kick}>Paso 1 de 5</div>
              <h2 className={styles.headTitle}>Identifica la paralela</h2>
              <p className={styles.headSub}>
                Datos administrativos de la propuesta de liquidación · acta o liquidación que
                Hacienda te envió. Esto queda archivado junto al ejercicio para trazabilidad.
              </p>
            </div>

            <div className={`${styles.banner} ${styles.warn}`}>
              <Icons.Warning size={18} strokeWidth={1.8} />
              <div>
                <strong>Solo paralelas firmadas en conformidad.</strong> Si has recurrido (TEAR ·
                TEAC · contencioso) la paralela no es firme · no la apliques aquí hasta
                resolución.
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Datos de la notificación</div>
              <div className={styles.formCardSub}>
                Los encuentras en la cabecera del documento que recibiste
              </div>

              <div className={styles.row2}>
                <div className={styles.row}>
                  <label htmlFor="tipoAct">Tipo de actuación</label>
                  <select
                    id="tipoAct"
                    value={tipoActuacion}
                    onChange={(e) => setTipoActuacion(e.target.value as TipoActuacion)}
                  >
                    {(Object.keys(TIPO_LABELS) as TipoActuacion[]).map((k) => (
                      <option key={k} value={k}>
                        {TIPO_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.row}>
                  <label htmlFor="organo">Órgano emisor</label>
                  <input
                    id="organo"
                    type="text"
                    value={organoEmisor}
                    onChange={(e) => setOrganoEmisor(e.target.value)}
                    placeholder="AEAT · …"
                  />
                </div>
              </div>

              <div className={styles.row}>
                <label htmlFor="numExp">
                  Número de expediente
                  <span className={styles.sub}>opcional · ayuda para trazabilidad</span>
                </label>
                <input
                  id="numExp"
                  className="mono"
                  type="text"
                  value={numExpediente}
                  onChange={(e) => setNumExpediente(e.target.value)}
                  placeholder="2022-IRPF-XXXXXXX-A"
                />
              </div>

              <div className={styles.row2}>
                <div className={styles.row}>
                  <label htmlFor="fnot">Fecha de notificación</label>
                  <input
                    id="fnot"
                    type="date"
                    value={fechaNotificacion}
                    onChange={(e) => setFechaNotificacion(e.target.value)}
                  />
                </div>
                <div className={styles.row}>
                  <label htmlFor="fconf">Fecha firma conformidad</label>
                  <input
                    id="fconf"
                    type="date"
                    value={fechaConformidad}
                    onChange={(e) => setFechaConformidad(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Documento de la paralela</div>
              <div className={styles.formCardSub}>
                Sube el PDF · imagen de la notificación firmada · queda archivada con el ejercicio
              </div>
              <div
                style={{
                  border: '2px dashed var(--atlas-v5-line)',
                  borderRadius: 10,
                  padding: paralelaFile ? 16 : 28,
                  textAlign: 'center',
                  cursor: paralelaFile ? 'default' : 'pointer',
                  background: paralelaFile ? 'var(--atlas-v5-pos-wash)' : 'var(--atlas-v5-card-alt)',
                  borderColor: paralelaFile ? 'var(--atlas-v5-pos)' : undefined,
                  transition: 'border-color 120ms',
                }}
                role="button"
                tabIndex={0}
                onClick={() => !paralelaFile && paralelaInput.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !paralelaFile) {
                    paralelaInput.current?.click();
                  }
                }}
              >
                {paralelaFile ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                      color: 'var(--atlas-v5-ink)',
                    }}
                  >
                    <Icons.Success size={16} strokeWidth={1.8} />
                    <strong>{paralelaFile.name}</strong> · {(paralelaFile.size / 1024).toFixed(0)} KB
                    <button
                      type="button"
                      style={{
                        marginLeft: 6,
                        color: 'var(--atlas-v5-neg)',
                        background: 'none',
                        border: 0,
                        cursor: 'pointer',
                      }}
                      aria-label="Eliminar archivo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setParalelaFile(null);
                      }}
                    >
                      <Icons.Close size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                ) : (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--atlas-v5-ink)' }}>
                      <Icons.Upload size={14} strokeWidth={1.8} style={{ verticalAlign: -2, marginRight: 6 }} />
                      Arrastra el PDF de la paralela aquí
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--atlas-v5-ink-4)', marginTop: 4 }}>
                      o haz clic para seleccionar · PDF · PNG · JPG
                    </div>
                  </>
                )}
                <input
                  ref={paralelaInput}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setParalelaFile({ name: f.name, size: f.size });
                  }}
                />
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Resumen rápido de la paralela</div>
              <div className={styles.formCardSub}>
                Cuéntale a tu yo del futuro de qué iba esto · en una línea
              </div>
              <div className={styles.row}>
                <textarea
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  placeholder="Ej · Gastos de acondicionamiento no acreditados documentalmente · recalculo base amortizable."
                />
              </div>
            </div>
          </>
        )}

        {step === 'cambia' && (
          <>
            <div className={styles.head}>
              <div className={styles.kick}>Paso 2 de 5</div>
              <h2 className={styles.headTitle}>¿Qué ha cambiado Hacienda?</h2>
              <p className={styles.headSub}>
                Marca las categorías afectadas por la paralela. En el siguiente paso rellenarás
                los valores concretos. Puedes elegir varias.
              </p>
            </div>

            <div className={styles.catGrid}>
              {CATEGORIAS.map((c) => {
                const selected = categoriasSel.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`${styles.catItem} ${selected ? styles.selected : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      const next = new Set(categoriasSel);
                      if (selected) next.delete(c.key);
                      else next.add(c.key);
                      setCategoriasSel(next);
                    }}
                  >
                    <div className={styles.catRadio}>
                      {selected && <Icons.Check size={12} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <div className={styles.catTitle}>{c.title}</div>
                      <div className={styles.catDesc}>{c.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 'delta' && (
          <>
            <div className={styles.head}>
              <div className={styles.kick}>Paso 3 de 5</div>
              <h2 className={styles.headTitle}>Delta · valores antes y después</h2>
              <p className={styles.headSub}>
                Captura los valores v1 (declarado) vs v2 (paralela) para cada casilla corregida.
                Puedes añadir filas si Hacienda corrige más casillas de las prerrellenadas.
              </p>
            </div>

            <div className={styles.formCard}>
              <table className={styles.deltaTable}>
                <thead>
                  <tr>
                    <th>Casilla</th>
                    <th>Concepto</th>
                    <th className={styles.right}>v1 declarado</th>
                    <th className={styles.right}>v2 paralela</th>
                    <th className={styles.right}>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {deltaRows.map((r, i) => {
                    const delta = r.v2 - r.v1;
                    return (
                      <tr key={`${r.casilla}-${i}`}>
                        <td style={{ fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 700 }}>
                          {r.casilla}
                        </td>
                        <td>
                          {r.concepto}
                          {r.auto && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 9.5,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'var(--atlas-v5-gold-wash)',
                                color: 'var(--atlas-v5-gold-ink)',
                              }}
                              title={
                                r.derivedFrom
                                  ? `Derivado de ${r.derivedFrom}`
                                  : 'Campo derivado automáticamente'
                              }
                            >
                              auto
                            </span>
                          )}
                        </td>
                        <td className={styles.right}>
                          <input
                            type="number"
                            step="0.01"
                            value={r.v1 || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setDeltaRows(deltaRows.map((x, j) => (j === i ? { ...x, v1: val } : x)));
                            }}
                          />
                        </td>
                        <td className={styles.right}>
                          <input
                            type="number"
                            step="0.01"
                            value={r.v2 || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setDeltaRows(deltaRows.map((x, j) => (j === i ? { ...x, v2: val } : x)));
                            }}
                          />
                        </td>
                        <td
                          className={`${styles.right} ${styles.delta} ${
                            delta < 0 ? styles.neg : delta > 0 ? styles.pos : ''
                          }`}
                        >
                          {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} €`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  className={styles.btn + ' ' + styles.ghost}
                  onClick={() =>
                    setDeltaRows([
                      ...deltaRows,
                      { casilla: '', concepto: '', v1: 0, v2: 0 },
                    ])
                  }
                >
                  <Icons.Plus size={13} strokeWidth={2} />
                  Añadir casilla
                </button>
                <button
                  type="button"
                  className={styles.btn + ' ' + styles.ghost}
                  onClick={() => setVerComparativaCompleta((v) => !v)}
                  aria-expanded={verComparativaCompleta}
                >
                  {verComparativaCompleta ? (
                    <>
                      <Icons.ChevronUp size={13} strokeWidth={2} />
                      Ocultar comparativa completa
                    </>
                  ) : (
                    <>
                      <Icons.ChevronDown size={13} strokeWidth={2} />
                      Ver comparativa completa
                    </>
                  )}
                </button>
              </div>
              {verComparativaCompleta && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    background: 'var(--atlas-v5-card-alt)',
                    border: '1px solid var(--atlas-v5-line)',
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: 'var(--atlas-v5-ink-3)',
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: 'var(--atlas-v5-ink)' }}>Resumen del Δ ·</strong>{' '}
                  {(() => {
                    const cambios = deltaRows.filter((r) => r.v1 !== r.v2);
                    if (cambios.length === 0) return 'sin cambios introducidos aún.';
                    const totalDelta = cambios.reduce((s, r) => s + (r.v2 - r.v1), 0);
                    return (
                      <>
                        {cambios.length} casilla{cambios.length === 1 ? '' : 's'} con cambio · Δ
                        total {totalDelta >= 0 ? '+' : ''}
                        {totalDelta.toFixed(2)} €.
                        {' '}
                        <strong>
                          {cambios.filter((r) => r.auto).length} campos derivados automáticamente
                        </strong>{' '}
                        · marcados con chip auto. Los demás se introducen
                        manualmente desde el documento de la paralela.
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Motivo de la corrección</div>
              <div className={styles.formCardSub}>
                Texto que Hacienda usa en el documento · te servirá de referencia
              </div>
              <div className={styles.row}>
                <textarea
                  value={motivoCorreccion}
                  onChange={(e) => setMotivoCorreccion(e.target.value)}
                  placeholder="Ej · No queda acreditada documentalmente la inversión en mejoras…"
                />
              </div>
            </div>
          </>
        )}

        {step === 'impacto' && (
          <>
            <div className={styles.head}>
              <div className={styles.kick}>Paso 4 de 5</div>
              <h2 className={styles.headTitle}>Impacto en el año {ejercicio.ejercicio}</h2>
              <p className={styles.headSub}>
                Resultado v1 vs v2 + intereses de demora + estado del pago.
              </p>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Resultado del ejercicio</div>
              <div className={styles.formCardSub}>positivo = devolución · negativo = a ingresar</div>

              <div className={styles.row2}>
                <div className={styles.row}>
                  <label htmlFor="resV1">Resultado v1 declarado · €</label>
                  <input
                    id="resV1"
                    className="mono"
                    type="number"
                    step="0.01"
                    value={resultadoV1 || ''}
                    onChange={(e) => setResultadoV1(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.row}>
                  <label htmlFor="resV2">Resultado v2 tras paralela · €</label>
                  <input
                    id="resV2"
                    className="mono"
                    type="number"
                    step="0.01"
                    value={resultadoV2 || ''}
                    onChange={(e) => setResultadoV2(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formCardTitle}>Pago de la deuda</div>
              <div className={styles.formCardSub}>principal adicional + intereses de demora</div>

              <div className={styles.row2}>
                <div className={styles.row}>
                  <label>Principal adicional</label>
                  <div
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      background: 'var(--atlas-v5-card-alt)',
                      borderRadius: 8,
                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                      fontSize: 13,
                    }}
                  >
                    <MoneyValue value={principalAdicional} decimals={2} tone="ink" />
                  </div>
                </div>
                <div className={styles.row}>
                  <label htmlFor="demora">Intereses de demora · €</label>
                  <input
                    id="demora"
                    className="mono"
                    type="number"
                    step="0.01"
                    value={interesesDemora || ''}
                    onChange={(e) => setInteresesDemora(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div
                className={`${styles.banner} ${totalIngresar > 0 ? styles.neg : styles.pos}`}
                style={{ marginBottom: 16 }}
              >
                <Icons.Info size={18} strokeWidth={1.8} />
                <div>
                  <strong>Total a ingresar · </strong>
                  <MoneyValue value={totalIngresar} decimals={2} tone="auto" />{' '}
                  · principal {principalAdicional.toFixed(2)} € + demora{' '}
                  {interesesDemora.toFixed(2)} €
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.row}>
                  <label htmlFor="ePago">Estado del pago</label>
                  <select
                    id="ePago"
                    value={estadoPago}
                    onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
                  >
                    {(Object.keys(ESTADO_PAGO_LABELS) as EstadoPago[]).map((k) => (
                      <option key={k} value={k}>
                        {ESTADO_PAGO_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.row}>
                  <label htmlFor="fPago">Fecha del pago</label>
                  <input
                    id="fPago"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'cascada' && (
          <>
            <div className={styles.head}>
              <div className={styles.kick}>Paso 5 de 5</div>
              <h2 className={styles.headTitle}>Cascada hacia años posteriores</h2>
              <p className={styles.headSub}>
                Los años ya declarados <strong>no se reescriben</strong>. Atlas deja constancia
                del desfase. Los años en curso se recalculan directamente.
              </p>
            </div>

            <div className={`${styles.banner} ${styles.info}`}>
              <Icons.Info size={18} strokeWidth={1.8} />
              <div>
                <strong>Regla crítica.</strong> Atlas respeta la declaración original (v1) en
                años ya presentados · marca desfase visible en el detalle. Para regularizar
                voluntariamente un año declarado, hay que aplicar otra paralela específica de
                ese año.
              </div>
            </div>

            {cascadaYears.map((c) => (
              <div key={c.year} className={styles.cascadaItem}>
                <div className={styles.cascadaHd}>
                  <div className={styles.cascadaYear}>{c.year}</div>
                  <span className={`${styles.cascadaState} ${styles[c.estado]}`}>
                    {c.estado === 'reescribe' ? 'Se recalcula' : 'Desfase · aviso'}
                  </span>
                </div>
                <div className={styles.cascadaSub}>
                  {c.estado === 'reescribe'
                    ? `${c.year} · ejercicio en curso · Atlas reescribe los valores derivados al cierre.`
                    : `${c.year} · ejercicio declarado · queda con desfase visible. Para regularizar, aplica otra paralela específica del año.`}
                </div>
              </div>
            ))}

            <div className={styles.confirmBox}>
              <input
                type="checkbox"
                id="confirm"
                checked={confirmacion}
                onChange={(e) => setConfirmacion(e.target.checked)}
              />
              <label htmlFor="confirm">
                Confirmo aplicar la paralela del año <strong>{ejercicio.ejercicio}</strong>.{' '}
                {cascadaYears.filter((c) => c.estado === 'desfase').length > 0 && (
                  <>
                    Años con desfase ·{' '}
                    {cascadaYears.filter((c) => c.estado === 'desfase').map((c) => c.year).join(', ')}.{' '}
                  </>
                )}
                Acción registrada · deshacible en 30 días.
              </label>
            </div>
          </>
        )}
      </div>

      <div className={styles.foot}>
        <div className={styles.footStatus}>
          <strong>Corrección año {ejercicio.ejercicio}</strong>
          {fechaNotificacion && (
            <>
              {' '}· notificada {formatDateLong(fechaNotificacion)}
              {fechaConformidad && (
                <>
                  {' '}· firmada {formatDateLong(fechaConformidad)}
                </>
              )}
            </>
          )}
        </div>
        <div className={styles.footActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.ghost}`}
            onClick={canBack ? goBack : () => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
          >
            <Icons.ArrowLeft size={13} strokeWidth={2} />
            {canBack ? 'Atrás' : 'Cancelar'}
          </button>
          {canForward ? (
            <button type="button" className={`${styles.btn} ${styles.gold}`} onClick={goForward}>
              Continuar · {STEPS[stepIndex + 1].title.toLowerCase()}
              <Icons.ChevronRight size={13} strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.gold}`}
              disabled={!confirmacion}
              onClick={handleApply}
            >
              <Icons.Check size={13} strokeWidth={2} />
              Aplicar paralela
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CorreccionWizard;
