/**
 * Ficha de inmueble · alta/edición · pantalla única ATLAS (rediseño · decisión Jose).
 *
 * Cuatro capítulos: 1 El activo · 2 Características del activo (con iconos) · 3
 * Fiscalidad · 4 La compra. Campos del ANCHO de su dato; toggles de un toque;
 * ubicación derivada del CP; impuestos AUTO por estado (ITP o IVA+AJD);
 * financiación con "vincular existente" inline. Importes en es-ES (miles + coma)
 * vía `MoneyInput`. El raíl DERECHO es navy "en directo" con el mismo lenguaje que
 * el asistente de préstamo (número en oro, tarjetas navy) e incluye la subsección
 * de FOTO (se añade ahí mismo, sin drawer). El estado pasa por un MODELO con
 * mappers SIN pérdida (`inmuebleForm/model.ts`).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Home as IconHome,
  ParkingSquare as IconParking,
  Archive as IconStorage,
  Store as IconStore,
  HelpCircle as IconOther,
  X as IconX,
  Check as IconCheck,
  AlertCircle as IconAlert,
  Banknote as IconBank,
  Image as IconImage,
  MapPin as IconPin,
  Plus as IconPlus,
  ExternalLink as IconExternal,
} from 'lucide-react';

import { initDB } from '../../services/db';
import { TipoActivo } from '../../types/tipoActivo';
import { personalDataService } from '../../services/personalDataService';
import type { Prestamo } from '../../types/prestamos';
import type { FinanciacionLineaInmueble } from '../../modules/inmuebles/adapters/patrimonioInmuebleAdapter';
import {
  getLocationFromPostalCode,
  inferLocationFromPostalCodeRange,
  getCCAAFromProvince,
} from '../../utils/locationUtils';
import { calcularInmuebleResumen } from '../../services/inmuebleCalculatorService';
import { parseIsoDateAsUTC } from '../../utils/recurrenceDateUtils';
import styles from './InmueblePage.module.css';
import {
  emptyModel,
  emptyMeta,
  modelFromProperty,
  propertyFromModel,
  visibilidad,
  impuestosTotal,
  type InmuebleFormModel,
  type InmuebleFormMeta,
} from './inmuebleForm/model';
import { calcularTributosAuto } from './inmuebleForm/tributos';
import {
  prefillPrestamoDesdeInmueble,
  prestamosVinculablesA,
  leerFinanciacionInmueble,
  fijarPrestamoVinculado,
} from './inmuebleForm/financiacion';

interface InmueblePageProps {
  mode: 'create' | 'edit';
}

const DIAS_ARRENDADO_PREVIEW = 365;

type IconComp = React.ComponentType<{ size?: number; className?: string }>;
const TIPO_ICONS: Record<TipoActivo, IconComp> = {
  piso: IconHome as unknown as IconComp,
  parking: IconParking as unknown as IconComp,
  trastero: IconStorage as unknown as IconComp,
  local: IconStore as unknown as IconComp,
  otro: IconOther as unknown as IconComp,
};
const TIPO_LABELS: Record<TipoActivo, string> = {
  piso: 'Piso',
  parking: 'Parking',
  trastero: 'Trastero',
  local: 'Local',
  otro: 'Otro',
};

// ─── formato / parseo es-ES ───
const nfEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfMoney = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const nfPlain = new Intl.NumberFormat('es-ES', { useGrouping: false, maximumFractionDigits: 2 });
const eur = (n: number): string => nfEur.format(n || 0);
const int = (n: number): string => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number): string => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n || 0)} %`;
/** Muestra el importe agrupado (miles + coma) para el campo, vacío si es 0. */
const fmtCampo = (n: number): string => (n ? nfMoney.format(n) : '');
/** Parsea "75.285,13" / "75285,13" / "75285.13" → número. */
const parseEs = (s: string): number => {
  if (!s) return 0;
  let t = s.replace(/[^\d.,-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
};

const formatDateLong = (iso: string): string => {
  if (!iso) return '';
  const d = parseIsoDateAsUTC(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

// ─── Campo de importe · formatea en es-ES (agrupado + coma) y no trunca ───
const MoneyInput: React.FC<{ value: number; onChange: (n: number) => void; className: string; ariaLabel: string; readOnly?: boolean }> = ({
  value,
  onChange,
  className,
  ariaLabel,
  readOnly,
}) => {
  const [text, setText] = useState<string>(() => fmtCampo(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmtCampo(value));
  }, [value, focused]);
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={text}
      onFocus={() => { setFocused(true); setText(value ? nfPlain.format(value) : ''); }}
      onChange={(e) => { setText(e.target.value); onChange(parseEs(e.target.value)); }}
      onBlur={() => { setFocused(false); const n = parseEs(text); onChange(n); setText(fmtCampo(n)); }}
    />
  );
};

// ─── Toggle de un toque (booleano · azul) ───
const Toggle: React.FC<{ label: string; on: boolean; onChange: (v: boolean) => void; onText?: string; offText?: string }> = ({
  label,
  on,
  onChange,
  onText = 'Sí',
  offText = 'No',
}) => (
  <div className={styles.toggleField}>
    <span className={styles.lab}>{label}</span>
    <div className={styles.tog}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`${styles.togSw} ${on ? styles.togSwOn : ''}`}
        onClick={() => onChange(!on)}
      />
      <span className={styles.togVal}>{on ? onText : offText}</span>
    </div>
  </div>
);

const InmueblePage: React.FC<InmueblePageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';
  const propertyId = id ? parseInt(id, 10) : undefined;

  const [form, setForm] = useState<InmuebleFormModel>(() => emptyModel());
  const metaRef = useRef<InmuebleFormMeta>(emptyMeta());
  const [originalSnapshot, setOriginalSnapshot] = useState<string>('');
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!propertyId);
  const [isSaving, setIsSaving] = useState(false);
  const [vinculadas, setVinculadas] = useState<FinanciacionLineaInmueble[]>([]);
  const [vinculables, setVinculables] = useState<Prestamo[]>([]);
  const [purchaseDateOriginal, setPurchaseDateOriginal] = useState<string>('');
  const [vincularOpen, setVincularOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const recargarFinanciacion = React.useCallback(async (inmuebleId: number) => {
    const [lineas, cand] = await Promise.all([
      leerFinanciacionInmueble(inmuebleId).catch(() => [] as FinanciacionLineaInmueble[]),
      prestamosVinculablesA(inmuebleId).catch(() => [] as Prestamo[]),
    ]);
    setVinculadas(lineas);
    setVinculables(cand);
  }, []);

  // ─── carga inicial ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const personal = await personalDataService.getPersonalData();
        const fallbackCCAA = personal?.comunidadAutonoma || '';
        if (mode === 'edit' && propertyId) {
          const db = await initDB();
          const prop = await db.get('properties', propertyId);
          if (cancelled) return;
          if (!prop) {
            toast.error('Inmueble no encontrado');
            navigate('/inmuebles');
            return;
          }
          const { model, meta } = modelFromProperty(prop, fallbackCCAA);
          metaRef.current = meta;
          setForm(model);
          setOriginalSnapshot(JSON.stringify(model));
          setPurchaseDateOriginal(meta.purchaseDateOriginal);
          await recargarFinanciacion(propertyId);
        } else {
          const next = { ...emptyModel(fallbackCCAA) };
          metaRef.current = emptyMeta();
          setForm(next);
          setOriginalSnapshot(JSON.stringify(next));
        }
      } catch (err) {
        console.error('Error loading property wizard:', err);
        if (!cancelled) toast.error('Error al cargar los datos del inmueble');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, propertyId]);

  // ─── ESC cierra ───
  const cancelRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── auto-rellenar ubicación desde CP ───
  useEffect(() => {
    if (!/^\d{5}$/.test(form.cp)) return;
    const exact = getLocationFromPostalCode(form.cp);
    const inferred = exact ?? inferLocationFromPostalCodeRange(form.cp);
    if (!inferred) return;
    const inferredMunicipality = inferred.municipalities?.[0] ?? '';
    setForm((prev) => {
      const next: InmuebleFormModel = { ...prev };
      if (!prev.municipality && inferredMunicipality) next.municipality = inferredMunicipality;
      if (!prev.province) next.province = inferred.province;
      if (!prev.ccaaIsManual && (!prev.ccaa || prev.ccaa !== inferred.ccaa)) next.ccaa = inferred.ccaa;
      return next;
    });
  }, [form.cp]);

  // ─── auto-rellenar CCAA desde provincia ───
  useEffect(() => {
    if (form.ccaaIsManual || !form.province.trim()) return;
    const fromProv = getCCAAFromProvince(form.province);
    if (fromProv && fromProv !== form.ccaa) setForm((prev) => ({ ...prev, ccaa: fromProv }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.province, form.ccaaIsManual]);

  // ─── auto-rellenar valorReferencia con precio mientras no sea manual ───
  useEffect(() => {
    if (form.valorReferenciaIsManual) return;
    if (form.valorReferencia !== form.precioCompra) {
      setForm((prev) => ({ ...prev, valorReferencia: form.precioCompra }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.precioCompra, form.valorReferenciaIsManual]);

  // ─── impuestos AUTO por estado (editables · override manual) ───
  const tributosAuto = useMemo(
    () =>
      calcularTributosAuto({
        tipoActivo: form.tipoActivo,
        ccaa: form.ccaa,
        precioCompra: form.precioCompra,
        valorReferencia: form.valorReferencia,
      }),
    [form.tipoActivo, form.ccaa, form.precioCompra, form.valorReferencia],
  );
  useEffect(() => {
    if (form.itpIsManual) return;
    if (Math.abs(form.itp - tributosAuto.itp) > 0.005) setForm((p) => ({ ...p, itp: tributosAuto.itp }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tributosAuto.itp, form.itpIsManual]);
  useEffect(() => {
    if (form.ivaIsManual) return;
    if (Math.abs(form.iva - tributosAuto.iva) > 0.005) setForm((p) => ({ ...p, iva: tributosAuto.iva }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tributosAuto.iva, form.ivaIsManual]);
  useEffect(() => {
    if (form.ajdIsManual) return;
    if (Math.abs(form.ajd - tributosAuto.ajd) > 0.005) setForm((p) => ({ ...p, ajd: tributosAuto.ajd }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tributosAuto.ajd, form.ajdIsManual]);

  // ─── cálculo fiscal (preview) ───
  const resumen = useMemo(
    () =>
      calcularInmuebleResumen({
        precio: form.precioCompra,
        valorReferencia: form.valorReferencia,
        formalizacion: { notaria: form.notaria, registro: form.registro, gestoria: form.gestoria, otros: form.otros },
        impuestos: impuestosTotal(form),
        valorCatastralTotal: form.valorCatastralTotal,
        valorCatastralConstruccion: form.valorCatastralConstruccion,
        diasArrendado: DIAS_ARRENDADO_PREVIEW,
        mejorasPosteriores: [],
      }),
    [form],
  );

  const vis = visibilidad(form);
  const vinculado = vinculadas.length > 0;
  const financiadoDelPrestamo = vinculadas.reduce((s, l) => s + (l.principalInicial || 0), 0);
  const deudaVinculada = vinculadas.reduce((s, l) => s + (l.deudaPendiente || 0), 0);
  const financiadoEfectivo = vinculado ? financiadoDelPrestamo : form.importeFinanciado;
  const costeTotal = resumen.costeBaseAdquisicion;
  const descuadre = costeTotal > 0 ? form.aportacionPropia + financiadoEfectivo - costeTotal : 0;
  const hayDescuadre = costeTotal > 0 && Math.abs(descuadre) >= 1;

  // ─── financiación · normalización (aportación/financiado) ───
  // · Con préstamo: el financiado lo manda el préstamo; si la aportación no se
  //   migró (0), se deriva = coste − financiado (así cuadra y no salta el aviso).
  // · Sin préstamo: el financiado se deriva = coste − aportación.
  useEffect(() => {
    if (isLoading) return;
    if (vinculado) {
      if (form.aportacionPropia === 0 && costeTotal > 0) {
        const ap = Math.max(0, costeTotal - financiadoDelPrestamo);
        if (ap > 0.005) setForm((p) => ({ ...p, aportacionPropia: ap }));
      }
    } else {
      const derived = Math.max(0, costeTotal - form.aportacionPropia);
      if (Math.abs(derived - form.importeFinanciado) > 0.005) setForm((p) => ({ ...p, importeFinanciado: derived }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costeTotal, form.aportacionPropia, vinculado, financiadoDelPrestamo, isLoading]);

  // ─── re-captura del snapshot cuando la carga y sus normalizaciones se asientan,
  //     para que "Cambios sin guardar" NO aparezca solo por abrir la ficha ───
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => setOriginalSnapshot(JSON.stringify(formRef.current)), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const isDirty = useMemo(
    () => originalSnapshot !== '' && JSON.stringify(form) !== originalSnapshot,
    [form, originalSnapshot],
  );

  // ─── helpers ───
  const set = <K extends keyof InmuebleFormModel>(k: K, v: InmuebleFormModel[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));
  const num = (v: string): number => parseEs(v);

  const handleTipoChange = (next: TipoActivo) => {
    setForm((prev) => {
      const u: InmuebleFormModel = { ...prev, tipoActivo: next };
      if (next !== 'piso') {
        u.tieneParking = false;
        u.tieneTrastero = false;
        u.tieneTerraza = false;
        u.tieneAscensor = false;
        u.habitaciones = 0;
        u.banos = 0;
        u.esViviendaHabitual = false;
      }
      return u;
    });
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('La foto excede 1.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, fotoOn: true, foto: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    if (!form.alias.trim()) return 'El alias es obligatorio';
    if (!/^\d{5}$/.test(form.cp)) return 'El código postal debe tener 5 dígitos';
    if (!form.fechaCompra) return 'La fecha de compra es obligatoria';
    if (form.precioCompra <= 0) return 'El precio debe ser mayor que 0';
    const pctMio = form.titularidad === 'pareja' ? 0 : form.porcentajePropiedad;
    const pctPareja = form.titularidad === 'yo' ? 0 : form.porcentajePropiedadPareja;
    if (pctMio < 0 || pctMio > 100 || pctPareja < 0 || pctPareja > 100)
      return 'El % de propiedad debe estar entre 0 y 100';
    if (form.titularidad === 'ambos' && pctMio + pctPareja > 100)
      return 'La suma de los % de ambos titulares no puede superar el 100%';
    return null;
  };

  const persistirInmueble = async (): Promise<number | null> => {
    const err = validate();
    if (err) {
      toast.error(err);
      return null;
    }
    const db = await initDB();
    const propertyData = propertyFromModel(form, metaRef.current);
    let savedId: number;
    if (mode === 'edit' && propertyId) {
      await db.put('properties', { ...propertyData, id: propertyId });
      savedId = propertyId;
    } else {
      savedId = Number(await db.add('properties', propertyData));
    }
    return savedId;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const savedId = await persistirInmueble();
      if (savedId == null) return;
      toast.success(mode === 'edit' ? 'Inmueble actualizado' : 'Inmueble guardado');
      navigate(fromEmpezar ? '/empezar/inmuebles?done=inmueble' : '/inmuebles?tab=cartera&refresh=1');
    } catch (e) {
      console.error('Error al guardar inmueble:', e);
      toast.error('Error al guardar el inmueble');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => navigate(fromEmpezar ? '/empezar/inmuebles' : '/inmuebles?tab=cartera');
  cancelRef.current = handleCancel;

  const handleCrearPrestamo = async () => {
    setIsSaving(true);
    let savedId: number | null = propertyId ?? null;
    try {
      savedId = await persistirInmueble();
    } finally {
      setIsSaving(false);
    }
    if (savedId == null) return;
    const initialData = prefillPrestamoDesdeInmueble({
      alias: form.alias.trim(),
      direccion: form.direccion.trim(),
      importeFinanciado: form.importeFinanciado,
      fechaCompra: form.fechaCompra,
      inmuebleId: savedId,
    });
    navigate('/financiacion/nuevo', { state: { initialData, volverA: `/inmuebles/${savedId}/editar` } });
  };

  const handleVincularExistente = async (prestamoId: string) => {
    if (!propertyId) {
      toast.error('Guarda el inmueble antes de vincular un préstamo');
      return;
    }
    try {
      await fijarPrestamoVinculado(propertyId, prestamoId);
      metaRef.current = { ...metaRef.current, prestamoVinculadoId: prestamoId };
      await recargarFinanciacion(propertyId);
      setVincularOpen(false);
      toast.success('Préstamo vinculado');
    } catch {
      toast.error('No se pudo vincular el préstamo');
    }
  };

  // ─── render ───
  if (isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.loading}>Cargando datos del inmueble…</div>
        </div>
      </div>
    );
  }

  const HeaderIcon = TIPO_ICONS[form.tipoActivo];
  const headerTitle = form.alias || TIPO_LABELS[form.tipoActivo];
  const ubic = [form.municipality, form.ccaa].filter(Boolean).join(' · ') || '—';
  const headerSub =
    mode === 'edit' && purchaseDateOriginal
      ? `${ubic} · adquirido ${formatDateLong(purchaseDateOriginal)}`
      : `${ubic} · nuevo registro`;
  const chipProvCcaa = [form.province, form.ccaa].filter(Boolean).join(' · ');
  const esNueva = form.estado === 'obra-nueva';

  // Campo de importe reutilizable
  const eurField = (label: React.ReactNode, ariaLabel: string, value: number, onChange: (n: number) => void, width: string) => (
    <div className={styles.fld}>
      <label className={styles.lab}>{label}</label>
      <div className={styles.inputSuffix}>
        <MoneyInput className={`${styles.input} ${styles.inputMono} ${width}`} value={value} onChange={onChange} ariaLabel={ariaLabel} />
        <span className={styles.suffix}>€</span>
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Ficha · ${headerTitle}`}>
      <div className={styles.modal}>
        {/* BODY · el raíl navy (preview) ocupa toda la altura; el título va sobre el form (claro), como en el asistente de préstamo */}
        <div className={styles.body}>
          <div className={styles.colForm}>
            {/* CABECERA (clara) */}
            <div className={styles.formHead}>
              <div className={styles.formHeadIcon}>
                <HeaderIcon size={18} />
              </div>
              <div>
                <div className={styles.formHeadTitle}>{headerTitle}</div>
                <div className={styles.formHeadSub}>{headerSub}</div>
              </div>
              <button type="button" className={styles.formHeadClose} onClick={handleCancel} aria-label="Cerrar">
                <IconX size={14} />
              </button>
            </div>

            {/* 1 · EL ACTIVO */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>1</span>
                <span className={styles.bandTitle}>El activo</span>
              </div>
              <div className={styles.types}>
                {(Object.keys(TIPO_LABELS) as TipoActivo[]).map((t) => {
                  const Icon = TIPO_ICONS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.type} ${form.tipoActivo === t ? styles.typeSel : ''}`}
                      onClick={() => handleTipoChange(t)}
                      aria-pressed={form.tipoActivo === t}
                    >
                      <span className={styles.typeIcon}><Icon size={17} /></span>
                      <span>{TIPO_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.wrap}>
                <div className={`${styles.fld} ${styles.wDir}`}>
                  <label className={styles.lab}>Dirección <span className={styles.req}>*</span></label>
                  <input className={styles.input} value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
                </div>
                <div className={styles.fld}>
                  <label className={styles.lab}>CP <span className={styles.req}>*</span></label>
                  <input
                    className={`${styles.input} ${styles.inputMonoL} ${styles.wCp}`}
                    value={form.cp}
                    onChange={(e) => set('cp', e.target.value.replace(/\D/g, '').slice(0, 5))}
                    inputMode="numeric"
                  />
                </div>
                <div className={styles.fld}>
                  <label className={styles.lab}>Población</label>
                  <input className={`${styles.input} ${styles.wPobla}`} value={form.municipality} onChange={(e) => set('municipality', e.target.value)} placeholder="del CP" />
                </div>
                <span className={styles.chip}>
                  <IconPin size={12} /> {chipProvCcaa || 'Provincia · CCAA'}
                </span>
              </div>

              <div className={styles.wrap} style={{ marginTop: 8 }}>
                <div className={styles.fld}>
                  <label className={styles.lab}>Alias <span className={styles.req}>*</span></label>
                  <input className={`${styles.input} ${styles.wAlias}`} value={form.alias} onChange={(e) => set('alias', e.target.value)} />
                </div>
                <div className={styles.fld}>
                  <label className={styles.lab}>Ref. catastral</label>
                  <input
                    className={`${styles.input} ${styles.inputMonoL} ${styles.wRef}`}
                    value={form.refCatastral}
                    onChange={(e) => set('refCatastral', e.target.value)}
                  />
                </div>
                <div className={styles.fld}>
                  <label className={styles.lab}>Titularidad</label>
                  <select
                    className={`${styles.input} ${styles.wTit}`}
                    value={form.titularidad}
                    onChange={(e) => {
                      const t = e.target.value as InmuebleFormModel['titularidad'];
                      setForm((prev) => ({
                        ...prev,
                        titularidad: t,
                        porcentajePropiedad:
                          t === 'ambos' ? 50 : t === 'yo' ? (prev.porcentajePropiedad > 0 ? prev.porcentajePropiedad : 100) : prev.porcentajePropiedad,
                        porcentajePropiedadPareja:
                          t === 'ambos' ? 50 : t === 'pareja' ? (prev.porcentajePropiedadPareja > 0 ? prev.porcentajePropiedadPareja : 100) : prev.porcentajePropiedadPareja,
                      }));
                    }}
                  >
                    <option value="yo">Yo</option>
                    <option value="pareja">Pareja</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
                {form.titularidad !== 'pareja' && (
                  <div className={styles.fld}>
                    <label className={styles.lab}>{form.titularidad === 'ambos' ? '% tuyo' : '% prop.'}</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wPct}`} value={form.porcentajePropiedad || ''} onChange={(e) => set('porcentajePropiedad', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                )}
                {form.titularidad !== 'yo' && (
                  <div className={styles.fld}>
                    <label className={styles.lab}>% pareja</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wPct}`} value={form.porcentajePropiedadPareja || ''} onChange={(e) => set('porcentajePropiedadPareja', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                )}
                {vis.showViviendaHabitual && (
                  <Toggle label="Vivienda habitual" on={form.esViviendaHabitual} onChange={(v) => set('esViviendaHabitual', v)} />
                )}
              </div>
            </div>

            {/* 2 · CARACTERÍSTICAS DEL ACTIVO */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>2</span>
                <span className={styles.bandTitle}>Características del activo</span>
              </div>
              <div className={`${styles.wrap} ${styles.wrapSpread}`}>
                <div className={styles.fld}>
                  <label className={styles.lab}>m²</label>
                  <input className={`${styles.input} ${styles.inputMono} ${styles.wM2}`} value={form.m2 || ''} onChange={(e) => set('m2', num(e.target.value))} inputMode="decimal" />
                </div>
                {vis.showHabitacionesBanos && (
                  <>
                    <div className={styles.fld}>
                      <label className={styles.lab}>Hab.</label>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wInt}`} value={form.habitaciones || ''} onChange={(e) => set('habitaciones', num(e.target.value))} inputMode="numeric" aria-label="Habitaciones" />
                    </div>
                    <div className={styles.fld}>
                      <label className={styles.lab}>Baños</label>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wInt}`} value={form.banos || ''} onChange={(e) => set('banos', num(e.target.value))} inputMode="numeric" aria-label="Baños" />
                    </div>
                  </>
                )}
                <div className={styles.fld}>
                  <label className={styles.lab}>Cert.</label>
                  <select className={styles.input} style={{ width: 72 }} value={form.certificadoEnergetico} onChange={(e) => set('certificadoEnergetico', e.target.value)} aria-label="Certificado energético">
                    <option value="">—</option>
                    <option value="NO">No</option>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                {vis.showAnexos && (
                  <>
                    <Toggle label="Terraza" on={form.tieneTerraza} onChange={(v) => set('tieneTerraza', v)} />
                    <Toggle label="Trastero" on={form.tieneTrastero} onChange={(v) => set('tieneTrastero', v)} />
                    <Toggle label="Parking" on={form.tieneParking} onChange={(v) => set('tieneParking', v)} />
                    <Toggle label="Ascensor" on={form.tieneAscensor} onChange={(v) => set('tieneAscensor', v)} />
                  </>
                )}
              </div>
            </div>

            {/* 3 · FISCALIDAD */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>3</span>
                <span className={styles.bandTitle}>Fiscalidad</span>
              </div>
              <div className={`${styles.wrap} ${styles.wrapSpread}`}>
                <div className={styles.toggleField}>
                  <span className={styles.lab}>Suelo</span>
                  <div className={styles.tog}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.esUrbana}
                      aria-label="Suelo urbano o rústico"
                      className={`${styles.togSw} ${form.esUrbana ? styles.togSwOn : ''}`}
                      onClick={() => set('esUrbana', !form.esUrbana)}
                    />
                    <span className={styles.togVal}>{form.esUrbana ? 'Urbana' : 'Rústica'}</span>
                  </div>
                </div>
                {eurField('V. cat. total', 'Valor catastral total', form.valorCatastralTotal, (n) => set('valorCatastralTotal', n), styles.wEur)}
                {eurField('V. cat. constr.', 'Valor catastral construcción', form.valorCatastralConstruccion, (n) => set('valorCatastralConstruccion', n), styles.wEur)}
                <div className={styles.fld}>
                  <label className={styles.lab}>% const.</label>
                  <input className={`${styles.input} ${styles.inputRo} ${styles.wPct}`} readOnly value={pct(resumen.porcentajeConstruccion)} />
                </div>
                {eurField('Valor referencia', 'Valor de referencia', form.valorReferencia, (n) => { set('valorReferencia', n); set('valorReferenciaIsManual', true); }, styles.wEur)}
                <Toggle label="Catastral revisado" on={form.cadastralRevised} onChange={(v) => set('cadastralRevised', v)} />
              </div>
            </div>

            {/* 4 · LA COMPRA */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>4</span>
                <span className={styles.bandTitle}>La compra</span>
                <span className={styles.estadoWrap}>
                  Estado
                  <div className={styles.tog}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={esNueva}
                      aria-label="Estado usada u obra nueva"
                      className={`${styles.togSw} ${esNueva ? styles.togSwOnGold : styles.togSwNavyLeft}`}
                      onClick={() => set('estado', esNueva ? 'usada' : 'obra-nueva')}
                    />
                    <span className={styles.togVal}>{esNueva ? 'Nueva' : 'Usada'}</span>
                  </div>
                </span>
              </div>
              {/* una sola fila · fecha · precio · impuestos · gastos (repartida a lo ancho) */}
              <div className={`${styles.wrap} ${styles.wrapSpread}`}>
                <div className={styles.fld}>
                  <label className={styles.lab}>Fecha <span className={styles.req}>*</span></label>
                  <input className={`${styles.input} ${styles.inputMonoL} ${styles.wDate}`} type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} />
                </div>
                {eurField(<>Precio <span className={styles.req}>*</span></>, 'Precio de compra', form.precioCompra, (n) => set('precioCompra', n), styles.wEur)}
                {esNueva ? (
                  <>
                    {eurField('IVA', 'IVA', form.iva, (n) => { set('iva', n); set('ivaIsManual', true); }, styles.wEur)}
                    {eurField('AJD', 'AJD', form.ajd, (n) => { set('ajd', n); set('ajdIsManual', true); }, styles.wEur)}
                  </>
                ) : (
                  eurField('ITP', 'ITP', form.itp, (n) => { set('itp', n); set('itpIsManual', true); }, styles.wEur)
                )}
                {eurField('Notaría', 'Notaría', form.notaria, (n) => set('notaria', n), styles.wEurS)}
                {eurField('Registro', 'Registro', form.registro, (n) => set('registro', n), styles.wEurS)}
                {eurField('Gestoría', 'Gestoría', form.gestoria, (n) => set('gestoria', n), styles.wEurS)}
                {eurField('Otros', 'Otros gastos', form.otros, (n) => set('otros', n), styles.wEurS)}
              </div>

              {/* Financiación */}
              <div className={styles.fin}>
                <div className={styles.finHd}>
                  <IconBank size={14} /> Financiación de la operación
                </div>
                <div className={styles.finLine}>
                  {eurField('Aportación propia', 'Aportación propia', form.aportacionPropia, (n) => set('aportacionPropia', n), styles.wEur)}
                  <div className={styles.fld}>
                    <label className={styles.lab}>Importe financiado {vinculado && <span className={styles.hint}>· del préstamo</span>}</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputRo} ${styles.wEur}`} readOnly value={fmtCampo(financiadoEfectivo)} aria-label="Importe financiado" />
                      <span className={styles.suffix}>€</span>
                    </div>
                  </div>
                  <div className={styles.finSpacer} />
                  {financiadoEfectivo > 0 && !vinculado && (
                    <>
                      <button type="button" className={styles.btnSm} onClick={handleCrearPrestamo} disabled={isSaving}>
                        <IconPlus size={13} /> Crear préstamo
                      </button>
                      {vinculables.length > 0 && (
                        <button type="button" className={styles.btnGh} onClick={() => setVincularOpen((v) => !v)}>
                          Vincular existente
                        </button>
                      )}
                    </>
                  )}
                </div>

                {vincularOpen && !vinculado && vinculables.length > 0 && (
                  <div className={styles.finLink}>
                    <label className={styles.lab}>Vincular a un préstamo vivo (no imputado aún a este inmueble)</label>
                    <select
                      className={styles.input}
                      style={{ maxWidth: 380 }}
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) handleVincularExistente(e.target.value); }}
                    >
                      <option value="">— Elige un préstamo —</option>
                      {vinculables.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre || `Préstamo ${p.id}`} · {eur(p.principalVivo ?? 0)} €
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {hayDescuadre && (
                  <div className={styles.warnLine}>
                    Aportación + financiado no cuadra con el coste ({descuadre > 0 ? 'sobran' : 'faltan'} {eur(Math.abs(descuadre))} €)
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* PREVIEW · raíl navy "en directo" (mismo lenguaje que el asistente de préstamo) */}
          <div className={styles.colPreview}>
            <div className={styles.pvHd}>
              <span>Cálculo fiscal</span>
              <span className={styles.pvLive}><span className={styles.pvDot} /> en directo</span>
            </div>

            <div className={styles.pvHero}>
              <div className={styles.pvHeroLab}>Coste base · adquisición</div>
              <div className={styles.pvHeroVal}>{eur(resumen.costeBaseAdquisicion)} <span className={styles.pvCur}>€</span></div>
              <div className={styles.pvHeroSub}>Base de cálculo de plusvalía y amortización</div>
            </div>

            <div className={styles.pvMini}>
              <div className={styles.pvCard}>
                <div className={styles.pvCardL}>Base amortizable</div>
                <div className={styles.pvCardV}>{int(resumen.baseAmortizable)} €</div>
              </div>
              <div className={styles.pvCard}>
                <div className={styles.pvCardL}>Amortización 3%/año</div>
                <div className={styles.pvCardV}>{eur(resumen.amortizacionProrrateada)} €</div>
              </div>
            </div>

            <div className={styles.pvBox}>
              <div className={styles.pvRow}>
                <span className={styles.pvL}>Precio compra</span>
                <span className={styles.pvV}>{eur(form.precioCompra)} €</span>
              </div>
              <div className={styles.pvRow}>
                <span className={styles.pvL}>+ Gastos (notaría · registro · gestoría · otros)</span>
                <span className={styles.pvV}>{eur(resumen.costeTotalFormalizacion)} €</span>
              </div>
              <div className={styles.pvRow}>
                <span className={styles.pvL}>+ Impuestos {esNueva ? 'IVA + AJD' : 'ITP'}</span>
                <span className={styles.pvV}>{eur(impuestosTotal(form))} €</span>
              </div>
              <div className={`${styles.pvRow} ${styles.pvRowTot}`}>
                <span className={styles.pvL}>Coste base adquisición</span>
                <span className={styles.pvV}>{eur(resumen.costeBaseAdquisicion)} €</span>
              </div>
            </div>

            {vinculado && (
              <>
                <div className={styles.pvSubHd}><IconBank size={12} /> Financiación vinculada</div>
                <div className={styles.pvBox}>
                  {vinculadas.map((l) => (
                    <div
                      className={`${styles.pvRow} ${styles.pvRowLink}`}
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      title="Editar préstamo en Financiación"
                      onClick={() => navigate(`/financiacion/${l.id}/editar`)}
                    >
                      <span className={styles.pvL}>
                        {l.nombre || 'Préstamo'} · cuota {eur(l.cuotaMensual)} € <IconExternal size={11} />
                      </span>
                      <span className={styles.pvV}>{eur(l.deudaPendiente)} €</span>
                    </div>
                  ))}
                  <div className={`${styles.pvRow} ${styles.pvRowTot}`}>
                    <span className={styles.pvL}>Deuda pendiente</span>
                    <span className={styles.pvV}>{eur(deudaVinculada)} €</span>
                  </div>
                </div>
              </>
            )}

            {/* FOTO · subsección del raíl (sin drawer · se añade aquí mismo) */}
            <div className={styles.pvFoto}>
              <div className={styles.pvSubHd}><IconImage size={12} /> Foto del inmueble</div>
              <div className={styles.pvFotoBody}>
                {form.foto && <img className={styles.pvFotoThumb} src={form.foto} alt="Foto del inmueble" />}
                {form.foto ? (
                  <div className={styles.pvFotoActions}>
                    <button type="button" className={styles.pvFotoBtn} onClick={() => fileInputRef.current?.click()}>
                      <IconImage size={13} /> Cambiar
                    </button>
                    <button type="button" className={styles.pvFotoBtn} onClick={() => setForm((p) => ({ ...p, foto: undefined, fotoOn: false }))}>
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className={styles.pvFotoDrop} role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()}>
                    <IconImage />
                    <div style={{ marginTop: 6 }}>Pulsa para subir · JPG / PNG · máx 1.5 MB</div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            {isDirty && (
              <>
                <IconAlert size={13} /> Cambios sin guardar · al guardar se recalculan amortización y arrastres
              </>
            )}
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={handleCancel} disabled={isSaving}>
              Cancelar
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={isSaving}>
              <IconCheck size={14} />
              {isSaving ? 'Guardando…' : 'Guardar inmueble'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InmueblePage;
