/**
 * Ficha de inmueble · alta/edición · pantalla única ATLAS.
 *
 * Reescritura (decisión Jose): el estado deja de ser un blob de 55 campos y
 * pasa por un MODELO con mappers `Property <-> modelo` SIN pérdida
 * (`inmuebleForm/model.ts`). La financiación deja de ser dato huérfano: se
 * integra con el módulo Financiación (crear préstamo prerrellenado · vincular ·
 * leer el vinculado), en `inmuebleForm/financiacion.ts` y el bloque
 * `<FinanciacionBlock/>`. El preview de "financiación vinculada" usa el servicio
 * CANÓNICO, no una fórmula a mano.
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
import FinanciacionBlock from './inmuebleForm/Financiacion';

interface InmueblePageProps {
  mode: 'create' | 'edit';
}

// Días arrendado del preview · supuesto (365). Ya no es un campo de la ficha:
// el dato real sale de los contratos y no vivía en el modelo (era campo muerto).
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

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const formatInt = (n: number): string =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
const formatPct = (n: number): string =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n)} %`;

const formatDateLong = (iso: string): string => {
  if (!iso) return '';
  const d = parseIsoDateAsUTC(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── carga de la financiación vinculada (reutilizable tras vincular) ───
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
  // ITP = valor de referencia × tipo CCAA · IVA = precio × 10/21% · AJD = precio × 1.5%.
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
        formalizacion: {
          notaria: form.notaria,
          registro: form.registro,
          gestoria: form.gestoria,
          otros: form.otros,
        },
        impuestos: impuestosTotal(form),
        valorCatastralTotal: form.valorCatastralTotal,
        valorCatastralConstruccion: form.valorCatastralConstruccion,
        diasArrendado: DIAS_ARRENDADO_PREVIEW,
        // Mejoras posteriores se gestionan en el detalle · la ficha calcula el
        // coste de adquisición puro (sin mejoras) para no duplicar la fuente.
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

  // ─── financiado DERIVADO del coste cuando NO hay préstamo (una sola variable
  // libre: la aportación). Con préstamo vinculado, el importe lo manda el préstamo. ───
  useEffect(() => {
    // Esperar a que termine la carga (incluida la financiación vinculada) para
    // no pisar el importe con una derivación transitoria antes de saber si hay
    // préstamo.
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
        u.habitaciones = 0;
        u.banos = 0;
        u.esViviendaHabitual = false;
      }
      return u;
    });
  };

  // ─── foto ───
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('La foto excede 1.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('foto', reader.result as string);
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

  /**
   * Persiste el inmueble (el ACTIVO) y devuelve el id, o null si falla. Mejoras
   * y mobiliario ya NO se tocan aquí: viven en sus stores y se gestionan en el
   * detalle · la ficha no crea ni borra esos registros (se conservan).
   */
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
    // El préstamo necesita el inmueble ya guardado (su destino apunta a un id).
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
      importeFinanciado: form.importeFinanciado,
      fechaCompra: form.fechaCompra,
      inmuebleId: savedId,
    });
    navigate('/financiacion/nuevo', {
      state: { initialData, volverA: `/inmuebles/${savedId}/editar` },
    });
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
      toast.success('Préstamo vinculado');
    } catch {
      toast.error('No se pudo vincular el préstamo');
    }
  };

  const handleEditarPrestamo = (prestamoId: string) => {
    navigate(`/financiacion/${prestamoId}/editar`);
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
  const headerTitle =
    mode === 'edit'
      ? `Editar inmueble · ${form.alias || TIPO_LABELS[form.tipoActivo]}`
      : `Nuevo inmueble · ${TIPO_LABELS[form.tipoActivo]}`;
  const headerSub =
    mode === 'edit' && purchaseDateOriginal
      ? `${form.municipality || form.ccaa || '—'} · adquirido ${formatDateLong(purchaseDateOriginal)} · activo`
      : 'Crear nuevo registro';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={headerTitle}>
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
            {/* B1 · TIPO */}
            <Block title="Tipo de activo">
              <div className={styles.typeSelector}>
                {(Object.keys(TIPO_LABELS) as TipoActivo[]).map((t) => {
                  const Icon = TIPO_ICONS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.typeCard} ${form.tipoActivo === t ? styles.selected : ''}`}
                      onClick={() => handleTipoChange(t)}
                      aria-pressed={form.tipoActivo === t}
                    >
                      <Icon size={22} />
                      <span className={styles.typeCardLabel}>{TIPO_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>
            </Block>

            {/* B2 · IDENTIFICACIÓN */}
            <Block title="Identificación">
              <div className={`${styles.fieldsRow} ${styles.rowIdentif}`}>
                <Field label="Alias" required>
                  <input className={styles.input} value={form.alias} onChange={(e) => set('alias', e.target.value)} />
                </Field>
                <Field label="Dirección">
                  <input className={styles.input} value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
                </Field>
                <Field label="Ref. catastral">
                  <input
                    className={`${styles.input} ${styles.inputMono}`}
                    style={{ fontSize: 11 }}
                    value={form.refCatastral}
                    onChange={(e) => set('refCatastral', e.target.value)}
                  />
                </Field>
              </div>
            </Block>

            {/* B3 · UBICACIÓN */}
            <Block title="Ubicación">
              <div className={`${styles.fieldsRow} ${styles.rowUbicac}`}>
                <Field label="CP" required>
                  <input
                    className={`${styles.input} ${styles.inputMono}`}
                    value={form.cp}
                    onChange={(e) => set('cp', e.target.value.replace(/\D/g, '').slice(0, 5))}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Población">
                  <input className={styles.input} value={form.municipality} onChange={(e) => set('municipality', e.target.value)} />
                </Field>
                <Field label="Provincia">
                  <input className={styles.input} value={form.province} onChange={(e) => set('province', e.target.value)} />
                </Field>
                <Field label="Comunidad autónoma" hint={form.ccaaIsManual ? 'manual' : 'auto'}>
                  <input
                    className={styles.input}
                    value={form.ccaa}
                    onChange={(e) => {
                      set('ccaa', e.target.value);
                      set('ccaaIsManual', true);
                    }}
                  />
                </Field>
              </div>
            </Block>

            {/* B4 · COMPRA Y COSTE */}
            <Block title="Compra y coste">
              <div className={`${styles.fieldsRow} ${styles.rowCompra1}`}>
                <Field label="Fecha compra" required>
                  <input className={styles.input} type="date" value={form.fechaCompra} onChange={(e) => set('fechaCompra', e.target.value)} />
                </Field>
                <Field label="Precio compra" required>
                  <Suffix>
                    <input
                      className={`${styles.input} ${styles.inputMono}`}
                      value={form.precioCompra || ''}
                      onChange={(e) => set('precioCompra', num(e.target.value))}
                      inputMode="decimal"
                    />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="Valor referencia" hint="base ITP">
                  <Suffix>
                    <input
                      className={`${styles.input} ${styles.inputMono}`}
                      value={form.valorReferencia || ''}
                      onChange={(e) => {
                        set('valorReferencia', num(e.target.value));
                        set('valorReferenciaIsManual', true);
                      }}
                      inputMode="decimal"
                    />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="Estado">
                  <div className={styles.radioInline}>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={form.estado === 'usada'} onChange={() => set('estado', 'usada')} /> Usada
                    </label>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={form.estado === 'obra-nueva'} onChange={() => set('estado', 'obra-nueva')} /> Nueva
                    </label>
                  </div>
                </Field>
              </div>

              <div className={`${styles.fieldsRow} ${styles.rowCompra2}`} style={{ marginTop: 12 }}>
                <Field label="Notaría">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.notaria || ''} onChange={(e) => set('notaria', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="Registro">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.registro || ''} onChange={(e) => set('registro', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="Gestoría">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.gestoria || ''} onChange={(e) => set('gestoria', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="Otros gastos">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.otros || ''} onChange={(e) => set('otros', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
              </div>

              {/* Impuestos · AUTO por estado · editables (override manual) */}
              <div className={`${styles.fieldsRow} ${styles.rowImpuestos}`} style={{ marginTop: 12 }}>
                {form.estado === 'usada' ? (
                  <Field label="ITP" hint={`${formatPct(tributosAuto.itpRate)} · ${form.itpIsManual ? 'manual' : 'auto · valor ref.'}`}>
                    <Suffix>
                      <input
                        className={`${styles.input} ${styles.inputMono}`}
                        value={form.itp || ''}
                        onChange={(e) => {
                          set('itp', num(e.target.value));
                          set('itpIsManual', true);
                        }}
                        inputMode="decimal"
                      />
                      <span className={styles.suffix}>€</span>
                    </Suffix>
                  </Field>
                ) : (
                  <>
                    <Field label="IVA" hint={`${formatPct(tributosAuto.ivaRate)} · ${form.ivaIsManual ? 'manual' : 'auto · precio'}`}>
                      <Suffix>
                        <input
                          className={`${styles.input} ${styles.inputMono}`}
                          value={form.iva || ''}
                          onChange={(e) => {
                            set('iva', num(e.target.value));
                            set('ivaIsManual', true);
                          }}
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>€</span>
                      </Suffix>
                    </Field>
                    <Field label="AJD" hint={`${formatPct(tributosAuto.ajdRate)} · ${form.ajdIsManual ? 'manual' : 'auto · precio'}`}>
                      <Suffix>
                        <input
                          className={`${styles.input} ${styles.inputMono}`}
                          value={form.ajd || ''}
                          onChange={(e) => {
                            set('ajd', num(e.target.value));
                            set('ajdIsManual', true);
                          }}
                          inputMode="decimal"
                        />
                        <span className={styles.suffix}>€</span>
                      </Suffix>
                    </Field>
                  </>
                )}
              </div>

              <FinanciacionBlock
                costeTotal={resumen.costeBaseAdquisicion}
                aportacion={form.aportacionPropia}
                onAportacion={(n) => set('aportacionPropia', n)}
                num={num}
                vinculadas={vinculadas}
                vinculables={vinculables}
                onCrearPrestamo={handleCrearPrestamo}
                onVincularExistente={handleVincularExistente}
                onEditarPrestamo={handleEditarPrestamo}
              />

              <div className={styles.hintNote}>
                <b>Coste total</b> {formatCurrency(resumen.costeBaseAdquisicion)} € · precio +{' '}
                {formatCurrency(resumen.costeTotalFormalizacion)} € formalización +{' '}
                {formatCurrency(impuestosTotal(form))} €{' '}
                {form.estado === 'usada' ? 'ITP' : 'IVA + AJD'} · usado para cálculo de plusvalía y base
                amortizable. Impuestos <b>auto-calculados</b> ({form.estado === 'usada' ? 'ITP sobre el valor de referencia' : 'IVA + AJD sobre el precio'}) · edítalos si tu caso difiere.
              </div>
            </Block>

            {/* B5 · CARACTERÍSTICAS FÍSICAS */}
            <Block title="Características físicas">
              <div className={`${styles.fieldsRow} ${vis.isPiso ? styles.rowFisicasPiso : styles.rowFisicasOtro}`}>
                <Field label="m² útiles">
                  <input className={`${styles.input} ${styles.inputMono}`} value={form.m2 || ''} onChange={(e) => set('m2', num(e.target.value))} inputMode="decimal" />
                </Field>
                {vis.showHabitacionesBanos && (
                  <>
                    <Field label="Habitaciones">
                      <input className={`${styles.input} ${styles.inputMono}`} value={form.habitaciones || ''} onChange={(e) => set('habitaciones', num(e.target.value))} inputMode="numeric" />
                    </Field>
                    <Field label="Baños">
                      <input className={`${styles.input} ${styles.inputMono}`} value={form.banos || ''} onChange={(e) => set('banos', num(e.target.value))} inputMode="numeric" />
                    </Field>
                  </>
                )}
                <Field label="Tipo">
                  <div className={styles.radioInline}>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={form.esUrbana} onChange={() => set('esUrbana', true)} /> Urbana
                    </label>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={!form.esUrbana} onChange={() => set('esUrbana', false)} /> Rústica
                    </label>
                  </div>
                </Field>
                <Field label="Certificado energético">
                  <select className={styles.input} value={form.certificadoEnergetico} onChange={(e) => set('certificadoEnergetico', e.target.value)}>
                    <option value="">Sin indicar</option>
                    <option value="NO">No lo tiene</option>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
                      <option key={l} value={l}>Letra {l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Titularidad">
                  <select
                    className={styles.input}
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
                    <option value="pareja">Mi pareja</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </Field>
                {form.titularidad !== 'pareja' && (
                  <Field label={form.titularidad === 'ambos' ? '% tuyo' : '% propiedad'}>
                    <Suffix>
                      <input className={`${styles.input} ${styles.inputMono}`} value={form.porcentajePropiedad || ''} onChange={(e) => set('porcentajePropiedad', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>%</span>
                    </Suffix>
                  </Field>
                )}
                {form.titularidad !== 'yo' && (
                  <Field label={form.titularidad === 'ambos' ? '% pareja' : '% propiedad'}>
                    <Suffix>
                      <input className={`${styles.input} ${styles.inputMono}`} value={form.porcentajePropiedadPareja || ''} onChange={(e) => set('porcentajePropiedadPareja', num(e.target.value))} inputMode="decimal" />
                      <span className={styles.suffix}>%</span>
                    </Suffix>
                  </Field>
                )}
              </div>

              {vis.showAnexos && (
                <div className={styles.anexosRow}>
                  <div className={styles.anexosLine}>
                    <span className={styles.anexosLabel}>Anexos</span>
                    <label className={styles.anexoCheck}>
                      <input type="checkbox" checked={form.tieneParking} onChange={(e) => set('tieneParking', e.target.checked)} /> Parking
                    </label>
                    <label className={styles.anexoCheck}>
                      <input type="checkbox" checked={form.tieneTrastero} onChange={(e) => set('tieneTrastero', e.target.checked)} /> Trastero
                    </label>
                  </div>
                  <div className={styles.hintNote} style={{ marginTop: 4 }}>
                    Marcar solo si el anexo <b>comparte RC con el piso</b>. Si el parking o trastero tiene <b>RC propia</b> · se da de alta como inmueble separado.
                  </div>
                </div>
              )}
            </Block>

            {/* B6 · DATOS FISCALES */}
            <Block title="Datos fiscales">
              <div className={`${styles.fieldsRow} ${styles.rowCatastro}`}>
                <Field label="Valor catastral total">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.valorCatastralTotal || ''} onChange={(e) => set('valorCatastralTotal', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="V. cat. construcción">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.valorCatastralConstruccion || ''} onChange={(e) => set('valorCatastralConstruccion', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
                <Field label="% construcción" hint="auto">
                  <input className={`${styles.input} ${styles.inputMono} ${styles.inputReadonlyTeal}`} readOnly value={`${formatPct(resumen.porcentajeConstruccion)}`} />
                </Field>
              </div>
              <label className={styles.checkInline}>
                <input type="checkbox" checked={form.cadastralRevised} onChange={(e) => set('cadastralRevised', e.target.checked)} />
                Valor catastral revisado en el último año (afecta a imputación de rentas)
              </label>
            </Block>

            {/* B7 · VIVIENDA HABITUAL · el arrendamiento se gestiona en el detalle */}
            {vis.showViviendaHabitual && (
              <Block title="Uso">
                <label className={styles.checkInline}>
                  <input
                    type="checkbox"
                    checked={form.esViviendaHabitual}
                    onChange={(e) => set('esViviendaHabitual', e.target.checked)}
                  />
                  Es mi vivienda habitual
                </label>
                <div className={styles.hintNote} style={{ marginTop: 6 }}>
                  Márcalo solo si es tu residencia habitual: no genera imputación de rentas y cuenta
                  para la exención por reinversión si vendes y compras otra. El{' '}
                  <b>alquiler y su tipo de explotación</b> se gestionan en el detalle del inmueble, no aquí.
                </div>
              </Block>
            )}

            {/* B8 · FOTO */}
            <Block title="Foto del inmueble" count="· opcional" toggle={{ on: form.fotoOn, onChange: (v) => set('fotoOn', v) }}>
              {form.fotoOn && (
                <div className={styles.photoBody}>
                  {form.foto ? (
                    <img className={styles.photoPreview} src={form.foto} alt="Foto del inmueble" />
                  ) : (
                    <div className={styles.photoEmpty}>
                      <IconImage size={28} /> <br />
                      Sube una imagen JPG / PNG · máx 1.5 MB
                    </div>
                  )}
                  <div className={styles.photoBtnRow}>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fileInputRef.current?.click()}>
                      {form.foto ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {form.foto && (
                      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => set('foto', undefined)}>
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Block>
          </div>

          {/* PREVIEW */}
          <div className={styles.colPreview}>
            <div className={styles.previewTitle}>
              <IconActivity size={12} /> Cálculo fiscal · vista previa
            </div>

            <div className={styles.previewKpiMain}>
              <div className={styles.previewKpiMainLabel}>Coste base · adquisición</div>
              <div className={styles.previewKpiMainValue}>{formatCurrency(resumen.costeBaseAdquisicion)} €</div>
              <div className={styles.previewKpiMainSub}>
                {resumen.costeMejorasPosteriores > 0
                  ? `+ ${formatCurrency(resumen.costeMejorasPosteriores)} € de mejoras posteriores · base de cálculo plusvalía`
                  : 'Base de cálculo plusvalía y amortización'}
              </div>
            </div>

            <div className={styles.previewDesglose}>
              <div className={styles.previewDesgloseRow}>
                <span className={styles.label}>Precio compra</span>
                <span className={styles.value}>{formatCurrency(form.precioCompra)} €</span>
              </div>
              <div className={styles.previewDesgloseRow}>
                <span className={styles.label}>+ Notaría · Registro · Gestoría · Otros</span>
                <span className={styles.value}>{formatCurrency(resumen.costeTotalFormalizacion)} €</span>
              </div>
              <div className={styles.previewDesgloseRow}>
                <span className={styles.label}>+ Impuestos {form.estado === 'usada' ? 'ITP' : 'IVA + AJD'}</span>
                <span className={styles.value}>{formatCurrency(impuestosTotal(form))} €</span>
              </div>
              <div className={`${styles.previewDesgloseRow} ${styles.total}`}>
                <span className={styles.label}>Coste base adquisición</span>
                <span className={styles.value}>{formatCurrency(resumen.costeBaseAdquisicion)} €</span>
              </div>
            </div>

            <div className={styles.previewKpiSecondary}>
              <div className={styles.previewKpiMini}>
                <div className={styles.previewKpiMiniLabel}>Base amortizable</div>
                <div className={styles.previewKpiMiniValue}>{formatInt(resumen.baseAmortizable)} €</div>
                <div className={styles.previewKpiMiniSub}>Mayor de coste construcción ({formatPct(resumen.porcentajeConstruccion)} del coste) o V.cat construcción</div>
              </div>
              <div className={styles.previewKpiMini}>
                <div className={styles.previewKpiMiniLabel}>Amortización 3 % / año</div>
                <div className={styles.previewKpiMiniValue}>{formatCurrency(resumen.amortizacionProrrateada)} €</div>
                <div className={styles.previewKpiMiniSub}>Casilla 0115 IRPF · supone año completo arrendado</div>
              </div>
            </div>

            <div className={styles.previewKpiSecondary}>
              <div className={styles.previewKpiMini}>
                <div className={styles.previewKpiMiniLabel}>% construcción</div>
                <div className={styles.previewKpiMiniValue}>{formatPct(resumen.porcentajeConstruccion)}</div>
                <div className={styles.previewKpiMiniSub}>{formatInt(form.valorCatastralConstruccion)} € de {formatInt(form.valorCatastralTotal)} € catastral</div>
              </div>
            </div>

            {vinculadas.length > 0 && (
              <>
                <div className={styles.previewTitle}>
                  <IconBank size={12} /> Financiación vinculada
                </div>
                <div className={styles.previewDesglose} style={{ marginBottom: 0 }}>
                  {vinculadas.map((l) => (
                    <React.Fragment key={l.id}>
                      <div className={styles.previewDesgloseRow}>
                        <span className={styles.label}>{l.nombre || 'Préstamo'}</span>
                        <span className={styles.value}>{formatCurrency(l.deudaPendiente)} €</span>
                      </div>
                      {l.porcentajeAfectacion < 100 && (
                        <div className={styles.previewDesgloseRow}>
                          <span className={styles.label}>% afectación a este inmueble</span>
                          <span className={styles.value}>{formatPct(l.porcentajeAfectacion)}</span>
                        </div>
                      )}
                      <div className={styles.previewDesgloseRow}>
                        <span className={styles.label}>Cuota mensual imputada</span>
                        <span className={styles.value}>{formatCurrency(l.cuotaMensual)} €</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            {isDirty && (
              <>
                <IconAlert size={13} /> Cambios sin guardar · al guardar se recalculan amortización y arrastres del ejercicio actual
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

// ─── Sub-componentes ───
const Block: React.FC<{
  title: string;
  count?: string;
  toggle?: { on: boolean; onChange: (v: boolean) => void };
  children?: React.ReactNode;
}> = ({ title, count, toggle, children }) => (
  <div className={styles.block}>
    <div className={styles.blockHd}>
      <div className={styles.blockHdTitle}>
        {title} {count && <span className={styles.count}>{count}</span>}
      </div>
      {toggle && (
        <button
          type="button"
          className={`${styles.toggle} ${toggle.on ? styles.toggleOn : ''}`}
          onClick={() => toggle.onChange(!toggle.on)}
          aria-pressed={toggle.on}
          aria-label={toggle.on ? 'Desactivar' : 'Activar'}
        />
      )}
    </div>
    {(toggle ? toggle.on : true) && children && <div className={styles.blockBody}>{children}</div>}
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({
  label,
  required,
  hint,
  children,
}) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel}>
      {label}
      {required && <span className={styles.req}>*</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
    {children}
  </div>
);

const Suffix: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={styles.inputSuffix}>{children}</div>
);

export default InmueblePage;
