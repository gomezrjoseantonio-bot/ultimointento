/**
 * Ficha de inmueble · alta/edición · pantalla única ATLAS (rediseño · decisión Jose).
 *
 * Un solo lienzo sin scroll en 3 capítulos con hilo + foto: 1 El activo · 2
 * Características y fiscal · 3 La compra · 4 Foto (drawer). Campos del ANCHO de su
 * dato, empaquetados; toggles de un toque (booleanos azul · Estado con oro cuando
 * "Nueva"); ubicación derivada del CP; impuestos AUTO por estado (ITP o IVA+AJD);
 * financiación en una línea con "vincular existente" inline. El estado del
 * formulario pasa por un MODELO con mappers SIN pérdida (`inmuebleForm/model.ts`)
 * y la financiación se integra con el módulo Financiación (crear/vincular/leer).
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
  Activity as IconActivity,
  Banknote as IconBank,
  Image as IconImage,
  MapPin as IconPin,
  Plus as IconPlus,
  Link2 as IconLink,
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

// Días arrendado del preview · supuesto (365) para la amortización estimada.
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

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const int = (n: number): string =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
const pct = (n: number): string =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n)} %`;

const formatDateLong = (iso: string): string => {
  if (!iso) return '';
  const d = parseIsoDateAsUTC(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        if (drawerOpen) setDrawerOpen(false);
        else cancelRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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

  const isDirty = useMemo(
    () => originalSnapshot !== '' && JSON.stringify(form) !== originalSnapshot,
    [form, originalSnapshot],
  );

  const vis = visibilidad(form);
  const vinculado = vinculadas.length > 0;
  const financiadoDelPrestamo = vinculadas.reduce((s, l) => s + (l.principalInicial || 0), 0);
  const financiadoEfectivo = vinculado ? financiadoDelPrestamo : form.importeFinanciado;
  const costeTotal = resumen.costeBaseAdquisicion;
  const descuadre = costeTotal > 0 ? form.aportacionPropia + financiadoEfectivo - costeTotal : 0;
  const hayDescuadre = costeTotal > 0 && Math.abs(descuadre) >= 1;

  // ─── financiado DERIVADO del coste cuando NO hay préstamo (aportación = variable libre) ───
  useEffect(() => {
    if (isLoading || vinculado) return;
    const derived = Math.max(0, resumen.costeBaseAdquisicion - form.aportacionPropia);
    if (Math.abs(derived - form.importeFinanciado) > 0.005) {
      setForm((p) => ({ ...p, importeFinanciado: derived }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen.costeBaseAdquisicion, form.aportacionPropia, vinculado, isLoading]);

  // ─── helpers ───
  const set = <K extends keyof InmuebleFormModel>(k: K, v: InmuebleFormModel[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const num = (v: string): number => {
    if (v === '' || v == null) return 0;
    const cleaned = v.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

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

  // ─── validación ───
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

  const handleCancel = () => {
    navigate(fromEmpezar ? '/empezar/inmuebles' : '/inmuebles?tab=cartera');
  };
  cancelRef.current = handleCancel;

  // ─── financiación · crear / vincular / editar ───
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
  const chipUbic = [form.municipality, form.ccaa].filter(Boolean).join(' · ');
  const esNueva = form.estado === 'obra-nueva';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Ficha · ${headerTitle}`}>
      <div className={styles.modal}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerIcon}>
              <HeaderIcon size={19} />
            </div>
            <div>
              <div className={styles.headerTitle}>{headerTitle}</div>
              <div className={styles.headerSub}>{headerSub}</div>
            </div>
          </div>
          <button type="button" className={styles.headerClose} onClick={handleCancel} aria-label="Cerrar">
            <IconX size={14} />
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          <div className={styles.colForm}>
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
                      <Icon size={16} />
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
                {chipUbic && (
                  <span className={styles.chip}>
                    <IconPin size={12} /> {chipUbic}
                  </span>
                )}
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
                    style={{ fontSize: 11 }}
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
                  <div className={`${styles.fld} ${styles.fldC}`}>
                    <label className={styles.lab}>{form.titularidad === 'ambos' ? '% tuyo' : '% prop.'}</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wPct}`} value={form.porcentajePropiedad || ''} onChange={(e) => set('porcentajePropiedad', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                )}
                {form.titularidad !== 'yo' && (
                  <div className={`${styles.fld} ${styles.fldC}`}>
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

            {/* 2 · CARACTERÍSTICAS Y FISCAL */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>2</span>
                <span className={styles.bandTitle}>Características y fiscal</span>
              </div>
              <div className={styles.wrap}>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>m²</label>
                  <input className={`${styles.input} ${styles.inputMono} ${styles.wM2}`} value={form.m2 || ''} onChange={(e) => set('m2', num(e.target.value))} inputMode="decimal" />
                </div>
                {vis.showHabitacionesBanos && (
                  <>
                    <div className={`${styles.fld} ${styles.fldC}`}>
                      <label className={styles.lab}>Hab.</label>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wInt}`} value={form.habitaciones || ''} onChange={(e) => set('habitaciones', num(e.target.value))} inputMode="numeric" />
                    </div>
                    <div className={`${styles.fld} ${styles.fldC}`}>
                      <label className={styles.lab}>Baños</label>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wInt}`} value={form.banos || ''} onChange={(e) => set('banos', num(e.target.value))} inputMode="numeric" />
                    </div>
                  </>
                )}
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Cert.</label>
                  <select className={styles.input} style={{ width: 66 }} value={form.certificadoEnergetico} onChange={(e) => set('certificadoEnergetico', e.target.value)}>
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

              <div className={styles.wrap} style={{ marginTop: 8 }}>
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
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>V. cat. total</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.valorCatastralTotal || ''} onChange={(e) => set('valorCatastralTotal', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>V. cat. constr.</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.valorCatastralConstruccion || ''} onChange={(e) => set('valorCatastralConstruccion', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>% const.</label>
                  <input className={`${styles.input} ${styles.inputRo} ${styles.wPct}`} readOnly value={pct(resumen.porcentajeConstruccion)} />
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Valor referencia</label>
                  <div className={styles.inputSuffix}>
                    <input
                      className={`${styles.input} ${styles.inputMono} ${styles.wEur}`}
                      value={form.valorReferencia || ''}
                      onChange={(e) => { set('valorReferencia', num(e.target.value)); set('valorReferenciaIsManual', true); }}
                      inputMode="decimal"
                    />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <Toggle label="Catastral revisado" on={form.cadastralRevised} onChange={(v) => set('cadastralRevised', v)} />
              </div>
            </div>

            {/* 3 · LA COMPRA */}
            <div className={styles.band}>
              <div className={styles.bandHd}>
                <span className={styles.bandNo}>3</span>
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
              <div className={styles.wrap}>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Fecha <span className={styles.req}>*</span></label>
                  <input className={`${styles.input} ${styles.inputMonoL} ${styles.wDate}`} type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} />
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Precio <span className={styles.req}>*</span></label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.precioCompra || ''} onChange={(e) => set('precioCompra', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                {esNueva ? (
                  <>
                    <div className={`${styles.fld} ${styles.fldC}`}>
                      <label className={styles.lab}>IVA</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.iva || ''} onChange={(e) => { set('iva', num(e.target.value)); set('ivaIsManual', true); }} inputMode="decimal" />
                        <span className={styles.suffix}>€</span>
                      </div>
                    </div>
                    <div className={`${styles.fld} ${styles.fldC}`}>
                      <label className={styles.lab}>AJD</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.ajd || ''} onChange={(e) => { set('ajd', num(e.target.value)); set('ajdIsManual', true); }} inputMode="decimal" />
                        <span className={styles.suffix}>€</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`${styles.fld} ${styles.fldC}`}>
                    <label className={styles.lab}>ITP</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.itp || ''} onChange={(e) => { set('itp', num(e.target.value)); set('itpIsManual', true); }} inputMode="decimal" />
                      <span className={styles.suffix}>€</span>
                    </div>
                  </div>
                )}
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Notaría</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEurS}`} value={form.notaria || ''} onChange={(e) => set('notaria', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Registro</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEurS}`} value={form.registro || ''} onChange={(e) => set('registro', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Gestoría</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEurS}`} value={form.gestoria || ''} onChange={(e) => set('gestoria', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
                <div className={`${styles.fld} ${styles.fldC}`}>
                  <label className={styles.lab}>Otros</label>
                  <div className={styles.inputSuffix}>
                    <input className={`${styles.input} ${styles.inputMono} ${styles.wEurS}`} value={form.otros || ''} onChange={(e) => set('otros', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </div>
                </div>
              </div>

              {/* Financiación · una línea */}
              <div className={styles.fin}>
                <div className={styles.finHd}>
                  <IconBank size={14} /> Financiación de la operación
                </div>
                <div className={styles.finLine}>
                  <div className={`${styles.fld} ${styles.fldC}`}>
                    <label className={styles.lab}>Aportación propia</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputMono} ${styles.wEur}`} value={form.aportacionPropia || ''} onChange={(e) => set('aportacionPropia', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>€</span>
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.fldC}`}>
                    <label className={styles.lab}>Importe financiado</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputRo} ${styles.wEur}`} readOnly value={financiadoEfectivo ? eur(financiadoEfectivo) : '0'} />
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

                {vinculado && (
                  <div className={styles.finLink}>
                    {vinculadas.map((l) => (
                      <button key={l.id} type="button" className={styles.btnGh} style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }} onClick={() => navigate(`/financiacion/${l.id}/editar`)}>
                        <span><IconLink size={12} /> {l.nombre || 'Préstamo'}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(l.principalInicial)} €</span>
                      </button>
                    ))}
                  </div>
                )}

                {hayDescuadre && (
                  <div className={styles.warnLine}>
                    Aportación + financiado no cuadra con el coste ({descuadre > 0 ? 'sobran' : 'faltan'} {eur(Math.abs(descuadre))} €)
                  </div>
                )}
              </div>
            </div>

            {/* 4 · FOTO */}
            <div className={styles.fotoBar}>
              <div className={styles.fotoL}>
                <span className={styles.bandNo}>4</span> Foto del inmueble
              </div>
              <div className={styles.fotoThumbWrap}>
                {form.foto && <img className={styles.fotoThumb} src={form.foto} alt="Miniatura del inmueble" />}
                <button type="button" className={styles.fotoBtn} onClick={() => setDrawerOpen(true)}>
                  <IconImage size={14} /> {form.foto ? 'Cambiar foto' : 'Añadir foto'}
                </button>
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div className={styles.colPreview}>
            <div className={styles.previewTitle}>
              <IconActivity size={12} /> Cálculo fiscal · vista previa
            </div>
            <div className={styles.pvHero}>
              <div className={styles.pvHeroLab}>Coste base · adquisición</div>
              <div className={styles.pvHeroVal}>{eur(resumen.costeBaseAdquisicion)} €</div>
              <div className={styles.pvHeroSub}>Base de cálculo de plusvalía y amortización</div>
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
            {vinculadas.length > 0 && (
              <>
                <div className={styles.previewTitle} style={{ marginTop: 2 }}>
                  <IconBank size={12} /> Financiación vinculada
                </div>
                <div className={styles.pvBox} style={{ marginBottom: 0 }}>
                  {vinculadas.map((l) => (
                    <React.Fragment key={l.id}>
                      <div className={styles.pvRow}>
                        <span className={styles.pvL}>{l.nombre || 'Préstamo'}</span>
                        <span className={styles.pvV}>{eur(l.deudaPendiente)} €</span>
                      </div>
                      <div className={styles.pvRow}>
                        <span className={styles.pvL}>Cuota mensual imputada</span>
                        <span className={styles.pvV}>{eur(l.cuotaMensual)} €</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* DRAWER FOTO */}
          <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
            <div className={styles.drawerHd}>
              Foto del inmueble
              <button type="button" className={styles.headerClose} style={{ color: 'var(--atlas-v5-ink-3)', borderColor: 'var(--atlas-v5-line)' }} onClick={() => setDrawerOpen(false)} aria-label="Cerrar foto">
                <IconX size={14} />
              </button>
            </div>
            {form.foto ? (
              <img className={styles.photoPreview} src={form.foto} alt="Foto del inmueble" />
            ) : (
              <div className={styles.dropZone} onClick={() => fileInputRef.current?.click()}>
                <IconImage size={26} />
                <div style={{ marginTop: 8 }}>
                  Pulsa para subir una imagen
                  <br />
                  <span className={styles.hint}>JPG / PNG · máx 1.5 MB</span>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={styles.btnGh} style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>
                {form.foto ? 'Cambiar' : 'Elegir archivo'}
              </button>
              {form.foto && (
                <button type="button" className={styles.btnGh} style={{ flex: 1 }} onClick={() => setForm((p) => ({ ...p, foto: undefined, fotoOn: false }))}>
                  Quitar
                </button>
              )}
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
