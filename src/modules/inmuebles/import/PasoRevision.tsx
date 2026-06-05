// Commit 6 · Paso 3 del wizard · revisión y mapeo en 3 secciones independientes.
// Réplica de docs/mockups/atlas-importer-contratos-v4.html (paso 3).
// La creación efectiva de Contracts (saveContract + postContractCreated) la
// inyecta el wizard vía onCrear; aquí solo se gestiona la UI y la edición.
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Check, CheckCircle2, Copy, Info,
} from 'lucide-react';
import styles from './ImportarContratosWizard.module.css';
import { ContractDraft, agruparPorSeccion, InmuebleOpcion } from '../../../services/contractDraftService';

/** Selector de habitación · inmueble por_habitaciones sin sufijo HX (§ 1.3). */
const SelectorHabitacion: React.FC<{
  draft: ContractDraft;
  habitaciones: number;
  onChange: (value: string) => void;
}> = ({ draft, habitaciones, onChange }) => (
  <select
    className={styles.selWarn}
    value={draft.habitacionConfirmada != null ? String(draft.habitacionConfirmada) : ''}
    aria-label={`Habitación para ${draft.inmuebleRaw}`}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="" disabled>Elegir habitación...</option>
    {Array.from({ length: habitaciones }, (_, i) => i + 1).map((n) => (
      <option key={n} value={String(n)}>Habitación {n}</option>
    ))}
  </select>
);

interface PasoRevisionProps {
  drafts: ContractDraft[];
  inmuebleOpciones: InmuebleOpcion[];
  origen: 'rentila' | 'plantilla_atlas';
  onCrear: (drafts: ContractDraft[]) => Promise<void> | void;
  onContinuar: () => void;
  onAtras: () => void;
}

const PREVIEW = 4;
const VALOR_NUEVO = 'nuevo';

const cx = (...classes: Array<string | false | undefined>): string => classes.filter(Boolean).join(' ');

const filaKey = (d: ContractDraft): string => `${d.ficheroOrigen}#${d.filaOriginal}`;

const formatFechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
};

const formatEuro = (n: number): string =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

const modalidadLabel = (m: ContractDraft['modalidadAtlas']): string =>
  m === 'vacacional' ? 'Vacacional' : 'Habitual';

const PasoRevision: React.FC<PasoRevisionProps> = ({
  drafts, inmuebleOpciones, origen, onCrear, onContinuar, onAtras,
}) => {
  const [items, setItems] = useState<ContractDraft[]>(() => drafts.map((d) => ({ ...d })));
  const [done, setDone] = useState({ listos: false, revisar: false, duplicados: false });
  const [verTodosListos, setVerTodosListos] = useState(false);
  const [creando, setCreando] = useState<string | null>(null);

  const opcionLabel = useMemo(() => {
    const map = new Map<number, string>();
    inmuebleOpciones.forEach((o) => map.set(o.id, o.label));
    return map;
  }, [inmuebleOpciones]);

  // FIX § 1.3 · opciones de inmueble indexadas · para saber modoExplotacion y
  // número de habitaciones del inmueble resuelto en cada fila.
  const opcionById = useMemo(() => {
    const map = new Map<number, InmuebleOpcion>();
    inmuebleOpciones.forEach((o) => map.set(o.id, o));
    return map;
  }, [inmuebleOpciones]);

  const grupos = useMemo(() => agruparPorSeccion(items), [items]);

  const setInmuebleRevisar = (key: string, value: string) =>
    setItems((prev) =>
      prev.map((d) => {
        if (filaKey(d) !== key) return d;
        if (value === VALOR_NUEVO) return { ...d, crearInmuebleNuevo: true, inmuebleIdConfirmado: null, habitacionConfirmada: null };
        if (value === '') return { ...d, crearInmuebleNuevo: false, inmuebleIdConfirmado: null, habitacionConfirmada: null };
        // Al cambiar de inmueble, la habitación elegida deja de ser válida.
        return { ...d, crearInmuebleNuevo: false, inmuebleIdConfirmado: Number(value), habitacionConfirmada: null };
      }),
    );

  const setHabitacion = (key: string, value: string) =>
    setItems((prev) =>
      prev.map((d) =>
        filaKey(d) === key
          ? { ...d, habitacionConfirmada: value === '' ? null : Number(value) }
          : d,
      ),
    );

  // Inmueble destino actualmente resuelto para una fila (confirmado o sugerido).
  const inmuebleResuelto = (d: ContractDraft): number | null =>
    d.crearInmuebleNuevo ? null : d.inmuebleIdConfirmado ?? d.inmuebleIdSugerido;

  // ¿Esta fila necesita que el usuario elija habitación? · inmueble
  // por_habitaciones, sin sufijo HX parseado y sin elección previa (§ 1.3).
  const necesitaHabitacion = (d: ContractDraft): boolean => {
    const id = inmuebleResuelto(d);
    if (id == null) return false;
    const opt = opcionById.get(id);
    return (
      opt?.modoExplotacion === 'por_habitaciones' &&
      d.habitacionParseada == null &&
      d.habitacionConfirmada == null
    );
  };

  const habitacionResuelta = (d: ContractDraft): boolean => !necesitaHabitacion(d);

  const setDecision = (key: string, value: ContractDraft['decisionDuplicado']) =>
    setItems((prev) => prev.map((d) => (filaKey(d) === key ? { ...d, decisionDuplicado: value } : d)));

  const revisarResuelto = (d: ContractDraft): boolean =>
    (d.inmuebleIdConfirmado != null || d.crearInmuebleNuevo === true) && habitacionResuelta(d);
  const todosRevisarResueltos = grupos.revisar.every(revisarResuelto);
  // Las filas "listas" cuyo inmueble es por_habitaciones sin HX también deben
  // tener habitación antes de crear (§ 1.3 · NUNCA un default "no especificada").
  const todasListosConHabitacion = grupos.listos.every(habitacionResuelta);

  const crearSeccion = async (seccion: 'listos' | 'revisar' | 'duplicados') => {
    setCreando(seccion);
    try {
      await onCrear(grupos[seccion]);
      setDone((prev) => ({ ...prev, [seccion]: true }));
    } finally {
      setCreando(null);
    }
  };

  const algunaCreada = done.listos || done.revisar || done.duplicados;

  const verListos = verTodosListos ? grupos.listos : grupos.listos.slice(0, PREVIEW);

  const inquilinoMeta = (d: ContractDraft): string => {
    if (d.inquilinoCotitulares.length > 0) {
      return `+ ${d.inquilinoCotitulares.length} cotitular${d.inquilinoCotitulares.length > 1 ? 'es' : ''} · ${d.inquilinoCotitulares.join(', ')}`;
    }
    return 'Nuevo inquilino';
  };

  return (
    <section className={styles.stepContent}>
      <div className={styles.revHeader}>
        <div>
          <div className={styles.panelH}>Revisa los contratos antes de crearlos</div>
          <div className={styles.panelSub}>
            ATLAS ha leído <strong>{items.length} contratos</strong>. Los hemos agrupado en secciones · revisa cada una y crea por bloques.
          </div>
        </div>
        {origen === 'rentila' && (
          <div className={styles.formatTip} title="ATLAS reconoció automáticamente las 12 columnas de Rentila">
            <CheckCircle2 size={13} /> Rentila reconocido
          </div>
        )}
      </div>

      {/* ── Sección 1 · Listos ── */}
      {!done.listos && grupos.listos.length > 0 && (
        <div className={styles.sect}>
          <div className={styles.sectHead}>
            <div className={styles.sectHeadLeft}>
              <div className={cx(styles.sectIcon, styles.ok)}><CheckCircle2 size={20} /></div>
              <div>
                <div className={styles.sectTitle}>Listos para crear <span className={cx(styles.sectCount, styles.mono)}>{grupos.listos.length}</span></div>
                <div className={styles.sectSub}>Mapeo automático correcto · todos los datos cuadran.</div>
              </div>
            </div>
            <button
              type="button"
              className={cx(styles.btn, styles.btnPrimary)}
              disabled={creando != null || !todasListosConHabitacion}
              title={todasListosConHabitacion ? undefined : 'Asigna la habitación de las filas por habitaciones'}
              onClick={() => crearSeccion('listos')}
            >
              <Check size={14} /> Crear {grupos.listos.length} contratos
            </button>
          </div>

          <div className={styles.sectTable}>
            <div className={cx(styles.sectRow, styles.gridListos, styles.head)}>
              <div>Inmueble → ATLAS</div><div>Inquilino</div><div>Tipo</div><div>Fechas</div><div>Renta · fianza</div>
            </div>
            {verListos.map((d) => {
              const idResuelto = inmuebleResuelto(d);
              const opt = idResuelto != null ? opcionById.get(idResuelto) : undefined;
              return (
              <div key={filaKey(d)} className={cx(styles.sectRow, styles.gridListos)}>
                <div className={styles.revCell}>
                  <div className={styles.revName}>{d.inmuebleRaw}</div>
                  <div className={styles.revMeta}>→ {opcionLabel.get(d.inmuebleIdConfirmado as number) ?? 'inmueble'}</div>
                  {necesitaHabitacion(d) && opt && (
                    <SelectorHabitacion
                      draft={d}
                      habitaciones={opt.habitaciones}
                      onChange={(v) => setHabitacion(filaKey(d), v)}
                    />
                  )}
                </div>
                <div className={styles.revCell}>
                  <div className={styles.revName}>{d.inquilinoNombre}</div>
                  <div className={styles.revMeta}>{inquilinoMeta(d)}</div>
                </div>
                <div className={styles.revCell}>
                  <div className={styles.revName}>{modalidadLabel(d.modalidadAtlas)}</div>
                </div>
                <div className={styles.revCell}>
                  <div className={cx(styles.revName, styles.mono)}>{formatFechaCorta(d.fechaInicio)}</div>
                  <div className={cx(styles.revMeta, styles.mono)}>→ {formatFechaCorta(d.fechaFin)}</div>
                </div>
                <div className={styles.revCell}>
                  <div className={cx(styles.revName, styles.mono)}>{formatEuro(d.rentaMensual)}</div>
                  <div className={cx(styles.revMeta, styles.mono)}>fianza {formatEuro(d.fianza)}</div>
                </div>
              </div>
              );
            })}
            {grupos.listos.length > PREVIEW && (
              <div className={styles.sectMore}>
                ... y {grupos.listos.length - PREVIEW} contratos más en esta sección ·{' '}
                <button type="button" className={styles.btnLink} onClick={() => setVerTodosListos((v) => !v)}>
                  {verTodosListos ? 'ver menos' : 'ver todos'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sección 2 · Requieren revisión ── */}
      {!done.revisar && grupos.revisar.length > 0 && (
        <div className={styles.sect}>
          <div className={styles.sectHead}>
            <div className={styles.sectHeadLeft}>
              <div className={cx(styles.sectIcon, styles.warn)}><AlertTriangle size={20} /></div>
              <div>
                <div className={styles.sectTitle}>Requieren revisión <span className={cx(styles.sectCount, styles.warn, styles.mono)}>{grupos.revisar.length}</span></div>
                <div className={styles.sectSub}>ATLAS no ha podido mapear el inmueble · elige uno o crea uno nuevo.</div>
              </div>
            </div>
            <button
              type="button"
              className={cx(styles.btn, styles.btnPrimary)}
              disabled={!todosRevisarResueltos || creando != null}
              title={todosRevisarResueltos ? undefined : 'Resuelve todas las filas para activar'}
              onClick={() => crearSeccion('revisar')}
            >
              <Check size={14} /> Crear {grupos.revisar.length} contratos
            </button>
          </div>

          <div className={styles.sectTable}>
            <div className={cx(styles.sectRow, styles.gridListos, styles.head)}>
              <div>Inmueble · elige</div><div>Inquilino</div><div>Tipo</div><div>Fechas</div><div>Renta · fianza</div>
            </div>
            {grupos.revisar.map((d) => {
              const key = filaKey(d);
              const resuelto = revisarResuelto(d);
              const valor = d.crearInmuebleNuevo ? VALOR_NUEVO : d.inmuebleIdConfirmado != null ? String(d.inmuebleIdConfirmado) : '';
              const idResuelto = inmuebleResuelto(d);
              const opt = idResuelto != null ? opcionById.get(idResuelto) : undefined;
              return (
                <div key={key} className={cx(styles.sectRow, styles.gridListos)}>
                  <div className={styles.revCell}>
                    <div className={styles.revName}>{d.inmuebleRaw}</div>
                    <select
                      className={cx(styles.selWarn, resuelto && styles.resuelto)}
                      value={valor}
                      aria-label={`Inmueble para ${d.inmuebleRaw}`}
                      onChange={(e) => setInmuebleRevisar(key, e.target.value)}
                    >
                      <option value="" disabled>Elegir inmueble...</option>
                      {inmuebleOpciones.map((o) => (
                        <option key={o.id} value={String(o.id)}>{o.label}</option>
                      ))}
                      <option value={VALOR_NUEVO}>+ Crear inmueble nuevo</option>
                    </select>
                    {necesitaHabitacion(d) && opt && (
                      <SelectorHabitacion
                        draft={d}
                        habitaciones={opt.habitaciones}
                        onChange={(v) => setHabitacion(key, v)}
                      />
                    )}
                  </div>
                  <div className={styles.revCell}>
                    <div className={styles.revName}>{d.inquilinoNombre}</div>
                    <div className={styles.revMeta}>{inquilinoMeta(d)}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={styles.revName}>{modalidadLabel(d.modalidadAtlas)}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={cx(styles.revName, styles.mono)}>{formatFechaCorta(d.fechaInicio)}</div>
                    <div className={cx(styles.revMeta, styles.mono)}>→ {formatFechaCorta(d.fechaFin)}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={cx(styles.revName, styles.mono)}>{formatEuro(d.rentaMensual)}</div>
                    <div className={cx(styles.revMeta, styles.mono)}>fianza {formatEuro(d.fianza)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sección 3 · Posibles duplicados ── */}
      {!done.duplicados && grupos.duplicados.length > 0 && (
        <div className={styles.sect}>
          <div className={styles.sectHead}>
            <div className={styles.sectHeadLeft}>
              <div className={cx(styles.sectIcon, styles.neg)}><Copy size={20} /></div>
              <div>
                <div className={styles.sectTitle}>Posibles duplicados <span className={cx(styles.sectCount, styles.neg, styles.mono)}>{grupos.duplicados.length}</span></div>
                <div className={styles.sectSub}>El inquilino ya existe en ATLAS · decide qué hacer con cada uno.</div>
              </div>
            </div>
            <button
              type="button"
              className={cx(styles.btn, styles.btnPrimary)}
              disabled={creando != null}
              onClick={() => crearSeccion('duplicados')}
            >
              <Check size={14} /> Aplicar decisiones
            </button>
          </div>

          <div className={styles.sectTable}>
            <div className={cx(styles.sectRow, styles.gridDuplicados, styles.head)}>
              <div>Decisión</div><div>Inmueble → ATLAS</div><div>Inquilino · ya existe</div><div>Fechas</div><div>Motivo</div>
            </div>
            {grupos.duplicados.map((d) => {
              const key = filaKey(d);
              return (
                <div key={key} className={cx(styles.sectRow, styles.gridDuplicados)}>
                  <div className={styles.revCell}>
                    <select
                      className={styles.selNeg}
                      value={d.decisionDuplicado ?? 'omitir'}
                      aria-label={`Decisión para ${d.inquilinoNombre}`}
                      onChange={(e) => setDecision(key, e.target.value as ContractDraft['decisionDuplicado'])}
                    >
                      <option value="omitir">Omitir esta fila</option>
                      <option value="fusionar">Fusionar con existente</option>
                      <option value="crear_nuevo">Crear nuevo igualmente</option>
                    </select>
                  </div>
                  <div className={styles.revCell}>
                    <div className={styles.revName}>{d.inmuebleRaw}</div>
                    <div className={styles.revMeta}>→ {opcionLabel.get(d.inmuebleIdSugerido as number) ?? 'inmueble'}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={styles.revName}>{d.inquilinoNombre}</div>
                    <div className={styles.revMeta}>{d.motivoSeccion}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={cx(styles.revName, styles.mono)}>{formatFechaCorta(d.fechaInicio)}</div>
                    <div className={cx(styles.revMeta, styles.mono)}>→ {formatFechaCorta(d.fechaFin)}</div>
                  </div>
                  <div className={styles.revCell}>
                    <div className={cx(styles.revName, styles.mono)}>{formatEuro(d.rentaMensual)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Banner SIN FIRMAR */}
      <div className={styles.infoBannerBrand}>
        <Info size={16} />
        <div>
          Los contratos se crean como <strong>SIN FIRMAR</strong>. Podrás completar DNIs, emails, documentos y corregir datos antes de marcarlos como activos. Una vez activos, cambiar términos requerirá un anexo.
        </div>
      </div>

      <div className={styles.wizFoot}>
        <button type="button" className={cx(styles.btn, styles.btnGhost)} onClick={onAtras}><ArrowLeft size={14} /> Atrás</button>
        <div className={styles.wizFootInfo}>Procesa las secciones · cada una se crea por separado</div>
        <button
          type="button"
          className={cx(styles.btn, algunaCreada ? styles.btnPrimary : styles.btnGhost)}
          disabled={!algunaCreada}
          onClick={onContinuar}
        >
          Continuar a resumen <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
};

export default PasoRevision;
