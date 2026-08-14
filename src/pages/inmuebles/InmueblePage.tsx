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
  Plus as IconPlus,
  Trash2 as IconTrash,
  Check as IconCheck,
  AlertCircle as IconAlert,
  Activity as IconActivity,
  Banknote as IconBank,
  Image as IconImage,
} from 'lucide-react';

import { initDB, MejoraInmueble, MuebleInmueble } from '../../services/db';
import { TipoActivo } from '../../types/tipoActivo';
import { mejorasInmuebleService } from '../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../services/mueblesInmuebleService';
import { prestamosService } from '../../services/prestamosService';
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
  type InmuebleFormModel,
  type InmuebleFormMeta,
  type UsoTipo,
} from './inmuebleForm/model';
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

const USO_OPTIONS_PISO: { value: UsoTipo; label: string; sub: string }[] = [
  { value: 'larga_estancia', label: 'Larga estancia', sub: 'Reducción 50-90% según contrato' },
  { value: 'temporada', label: 'Temporada', sub: 'Sin reducción' },
  { value: 'turistico', label: 'Turístico', sub: 'Actividad económica · IVA' },
  { value: 'mixto', label: 'Mixto', sub: 'Larga + temporada · habitaciones' },
  { value: 'vivienda_habitual', label: 'Vivienda habitual', sub: 'Tu residencia · no genera renta' },
  { value: 'disponible', label: 'Disponible', sub: 'Sin uso · imputación rentas' },
];

const USO_OPTIONS_LOCAL: { value: UsoTipo; label: string; sub: string }[] = [
  { value: 'larga_estancia', label: 'Larga estancia', sub: 'Reducción 50-90% según contrato' },
  { value: 'temporada', label: 'Temporada', sub: 'Sin reducción' },
  { value: 'turistico', label: 'Turístico', sub: 'Actividad económica · IVA' },
  { value: 'disponible', label: 'Disponible', sub: 'Sin uso · imputación rentas' },
];

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

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ejercicioFromDate = (iso: string): number => {
  if (iso) {
    const d = parseIsoDateAsUTC(iso);
    if (!isNaN(d.getTime())) return d.getUTCFullYear();
  }
  return new Date().getFullYear();
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
          const [mejorasDB, mueblesDB] = await Promise.all([
            mejorasInmuebleService.getPorInmueble(propertyId),
            mueblesInmuebleService.getPorInmueble(propertyId),
          ]);
          if (cancelled) return;

          const { model, meta } = modelFromProperty(prop, mejorasDB, mueblesDB, fallbackCCAA);
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
        impuestos: form.impuestos,
        valorCatastralTotal: form.valorCatastralTotal,
        valorCatastralConstruccion: form.valorCatastralConstruccion,
        diasArrendado: DIAS_ARRENDADO_PREVIEW,
        mejorasPosteriores: form.mejoras
          .filter((m) => !m._deleted)
          .map((m) => ({ importe: m.importe, tipo: m.tipo })),
      }),
    [form],
  );

  const isDirty = useMemo(
    () => originalSnapshot !== '' && JSON.stringify(form) !== originalSnapshot,
    [form, originalSnapshot],
  );

  const vis = visibilidad(form);
  const usoOptions = vis.isPiso ? USO_OPTIONS_PISO : USO_OPTIONS_LOCAL;

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
        u.alquilerHabActivo = false;
        u.alquilerHabNum = 0;
        if ((next === 'local' || next === 'otro') && (u.usoTipo === 'vivienda_habitual' || u.usoTipo === 'mixto')) {
          u.usoTipo = 'larga_estancia';
        }
      }
      return u;
    });
  };

  // ─── mejoras ───
  const addMejora = () =>
    setForm((p) => ({ ...p, mejoras: [...p.mejoras, { concepto: '', fecha: today(), importe: 0, tipo: 'mejora' }] }));
  const updateMejora = (idx: number, patch: Partial<InmuebleFormModel['mejoras'][number]>) =>
    setForm((p) => ({ ...p, mejoras: p.mejoras.map((m, i) => (i === idx ? { ...m, ...patch } : m)) }));
  const removeMejora = (idx: number) =>
    setForm((p) => ({
      ...p,
      mejoras: p.mejoras.map((m, i) => (i === idx ? { ...m, _deleted: true } : m)).filter((m) => m.id !== undefined || !m._deleted),
    }));

  // ─── muebles ───
  const addMueble = () =>
    setForm((p) => ({ ...p, muebles: [...p.muebles, { concepto: '', fechaAlta: today(), importe: 0 }] }));
  const updateMueble = (idx: number, patch: Partial<InmuebleFormModel['muebles'][number]>) =>
    setForm((p) => ({ ...p, muebles: p.muebles.map((m, i) => (i === idx ? { ...m, ...patch } : m)) }));
  const removeMueble = (idx: number) =>
    setForm((p) => ({
      ...p,
      muebles: p.muebles.map((m, i) => (i === idx ? { ...m, _deleted: true } : m)).filter((m) => m.id !== undefined || !m._deleted),
    }));

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

  /** Persiste el inmueble (+ mejoras/muebles) y devuelve el id, o null si falla. */
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

    // mejoras · upsert uno-a-uno
    if (form.mejorasOn) {
      for (const m of form.mejoras) {
        if (m._deleted && m.id) {
          await mejorasInmuebleService.eliminar(m.id);
        } else if (!m._deleted && m.concepto.trim() && m.importe > 0) {
          const payload: Omit<MejoraInmueble, 'id' | 'createdAt' | 'updatedAt'> = {
            inmuebleId: savedId,
            ejercicio: ejercicioFromDate(m.fecha),
            descripcion: m.concepto.trim(),
            tipo: m.tipo,
            importe: m.importe,
            fecha: m.fecha,
          };
          if (m.id) await mejorasInmuebleService.actualizar(m.id, payload);
          else await mejorasInmuebleService.crear(payload);
        }
      }
    } else {
      for (const m of form.mejoras) if (m.id) await mejorasInmuebleService.eliminar(m.id);
    }

    if (form.mueblesOn) {
      for (const mu of form.muebles) {
        if (mu._deleted && mu.id) {
          await mueblesInmuebleService.eliminar(mu.id);
        } else if (!mu._deleted && mu.concepto.trim() && mu.importe > 0) {
          const payload: Omit<MuebleInmueble, 'id' | 'createdAt' | 'updatedAt'> = {
            inmuebleId: savedId,
            ejercicio: ejercicioFromDate(mu.fechaAlta),
            descripcion: mu.concepto.trim(),
            fechaAlta: mu.fechaAlta,
            importe: mu.importe,
            vidaUtil: 10,
            activo: true,
          };
          if (mu.id) await mueblesInmuebleService.actualizar(mu.id, payload);
          else await mueblesInmuebleService.crear(payload);
        }
      }
    } else {
      for (const mu of form.muebles) if (mu.id) await mueblesInmuebleService.eliminar(mu.id);
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
                <Field label="Impuestos" hint="ITP / AJD">
                  <Suffix>
                    <input className={`${styles.input} ${styles.inputMono}`} value={form.impuestos || ''} onChange={(e) => set('impuestos', num(e.target.value))} inputMode="decimal" />
                    <span className={styles.suffix}>€</span>
                  </Suffix>
                </Field>
              </div>

              <FinanciacionBlock
                costeTotal={resumen.costeBaseAdquisicion}
                aportacion={form.aportacionPropia}
                financiado={form.importeFinanciado}
                onAportacion={(n) => set('aportacionPropia', n)}
                onFinanciado={(n) => set('importeFinanciado', n)}
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
                {formatCurrency(form.impuestos)} € impuestos · usado para cálculo de plusvalía y base
                amortizable. <b>Valor referencia</b> auto-rellenado con el precio · modifícalo si tu
                valor de referencia catastral es distinto (Ley 11/2021 · ITP desde 2022).
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

            {/* B7 · USO Y ALQUILER */}
            {vis.showUso && (
              <Block title="Uso y alquiler">
                <div className={`${styles.usoCards} ${usoOptions.length === 6 ? styles.usoCards6 : ''}`}>
                  {usoOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.usoCard} ${form.usoTipo === opt.value ? styles.selected : ''}`}
                      onClick={() => set('usoTipo', opt.value)}
                      aria-pressed={form.usoTipo === opt.value}
                    >
                      <span className={styles.usoCardLabel}>{opt.label}</span>
                      <span className={styles.usoCardSub}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
                {vis.showAlquilerHab && (
                  <div className={styles.subBlock}>
                    <span className={styles.subBlockLabel}>Alquiler por habitaciones</span>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={!form.alquilerHabActivo} onChange={() => set('alquilerHabActivo', false)} /> No · piso completo
                    </label>
                    <label className={styles.radioOpt}>
                      <input type="radio" checked={form.alquilerHabActivo} onChange={() => set('alquilerHabActivo', true)} /> Sí
                    </label>
                    {form.alquilerHabActivo && (
                      <>
                        <span className={styles.subBlockLabel}>Nº habitaciones</span>
                        <input className={styles.subBlockInput} value={form.alquilerHabNum || ''} onChange={(e) => set('alquilerHabNum', num(e.target.value))} inputMode="numeric" />
                      </>
                    )}
                  </div>
                )}
              </Block>
            )}

            {/* B8 · MEJORAS */}
            <Block
              title="Mejoras previas"
              count={
                form.mejorasOn && form.mejoras.filter((m) => !m._deleted).length > 0
                  ? `· ${form.mejoras.filter((m) => !m._deleted).length} registrada${form.mejoras.filter((m) => !m._deleted).length === 1 ? '' : 's'} · CAPEX ${formatInt(form.mejoras.filter((m) => !m._deleted && m.tipo !== 'reparacion').reduce((s, m) => s + (m.importe || 0), 0))} €`
                  : undefined
              }
              toggle={{ on: form.mejorasOn, onChange: (v) => set('mejorasOn', v) }}
            >
              {form.mejorasOn && (
                <>
                  <div className={styles.rowList}>
                    {form.mejoras.map((m, i) => ({ m, i })).filter(({ m }) => !m._deleted).map(({ m, i }) => (
                      <div key={i} className={styles.capexRow}>
                        <input className={styles.input} placeholder="Concepto" value={m.concepto} onChange={(e) => updateMejora(i, { concepto: e.target.value })} />
                        <input className={`${styles.input} ${styles.inputMono}`} type="date" value={m.fecha} onChange={(e) => updateMejora(i, { fecha: e.target.value })} />
                        <Suffix>
                          <input className={`${styles.input} ${styles.inputMono}`} value={m.importe || ''} onChange={(e) => updateMejora(i, { importe: num(e.target.value) })} inputMode="decimal" />
                          <span className={styles.suffix}>€</span>
                        </Suffix>
                        <select className={styles.select} value={m.tipo} onChange={(e) => updateMejora(i, { tipo: e.target.value as 'mejora' | 'reparacion' })}>
                          <option value="mejora">Mejora · amortizable</option>
                          <option value="reparacion">Reparación · gasto</option>
                        </select>
                        <button type="button" className={styles.del} onClick={() => removeMejora(i)} aria-label="Eliminar mejora">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className={styles.rowAdd} onClick={addMejora}>
                      <IconPlus size={14} /> Añadir mejora previa
                    </button>
                  </div>
                  <div className={styles.hintNote}>
                    Las mejoras suman al coste de adquisición y aumentan la base amortizable. Las reparaciones son gasto deducible del año.
                  </div>
                </>
              )}
            </Block>

            {/* B9 · MOBILIARIO */}
            <Block
              title="Mobiliario"
              count={
                form.mueblesOn && form.muebles.filter((m) => !m._deleted).length > 0
                  ? `· ${form.muebles.filter((m) => !m._deleted).length} registrado${form.muebles.filter((m) => !m._deleted).length === 1 ? '' : 's'}`
                  : undefined
              }
              toggle={{ on: form.mueblesOn, onChange: (v) => set('mueblesOn', v) }}
            >
              {form.mueblesOn && (
                <>
                  <div className={styles.rowList}>
                    {form.muebles.map((m, i) => ({ m, i })).filter(({ m }) => !m._deleted).map(({ m, i }) => (
                      <div key={i} className={styles.muebleRow}>
                        <input className={styles.input} placeholder="Concepto" value={m.concepto} onChange={(e) => updateMueble(i, { concepto: e.target.value })} />
                        <input className={`${styles.input} ${styles.inputMono}`} type="date" value={m.fechaAlta} onChange={(e) => updateMueble(i, { fechaAlta: e.target.value })} />
                        <Suffix>
                          <input className={`${styles.input} ${styles.inputMono}`} value={m.importe || ''} onChange={(e) => updateMueble(i, { importe: num(e.target.value) })} inputMode="decimal" />
                          <span className={styles.suffix}>€</span>
                        </Suffix>
                        <button type="button" className={styles.del} onClick={() => removeMueble(i)} aria-label="Eliminar mueble">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className={styles.rowAdd} onClick={addMueble}>
                      <IconPlus size={14} /> Añadir mueble
                    </button>
                  </div>
                  <div className={styles.hintNote}>Amortización al 10 % anual durante 10 años (casilla 0117 IRPF).</div>
                </>
              )}
            </Block>

            {/* B10 · FOTO */}
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
                <span className={styles.label}>+ Impuestos ITP / AJD</span>
                <span className={styles.value}>{formatCurrency(form.impuestos)} €</span>
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
