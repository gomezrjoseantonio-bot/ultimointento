// ============================================================================
// PR-B · Mi vivienda habitual · alcance esencial
// ============================================================================
//
// Ficha única de la vivienda habitual del titular. Persistencia REAL contra
// `viviendaHabitual` vía `viviendaHabitualService` · alcance A:
//   - Régimen (inquilino · propietario sin hipoteca · propietario con hipoteca)
//   - Dirección · CP · municipio · provincia · ref. catastral
//   - Notas
//
// Los subcampos detallados por régimen (contrato del arrendador · datos
// catastrales completos · adquisición · IBI · comunidad · seguros · hipoteca)
// y el motor de derivación a `treasuryEvents` se completan en PR-B-bis. En
// alcance A se persisten stubs neutros (importes 0 · meses vacíos · vigencias
// 1970) para satisfacer la unión discriminada del schema TS sin generar
// eventos parásitos.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardV5, Icons, showToastV5 } from '../../../design-system/v5';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { prestamosService } from '../../../services/prestamosService';
import {
  obtenerViviendaActiva,
  guardarVivienda,
  eliminarVivienda,
} from '../../../services/personal/viviendaHabitualService';
import type {
  ViviendaHabitual,
  ViviendaHabitualData,
  DireccionVivienda,
} from '../../../types/viviendaHabitual';

// ─── Tipos UI ──────────────────────────────────────────────────────────────

type RegimenUI = 'inquilino' | 'propietarioSinHipoteca' | 'propietarioConHipoteca';

interface FormState {
  regimen: RegimenUI | '';
  direccion: string;
  cp: string;
  municipio: string;
  provincia: string;
  referenciaCatastral: string;
  notas: string;
  // ─── Gastos que propagan a Tesorería (PR-B-bis) ───
  cuentaCargo: string;      // accountId de la cuenta de cargo/pago
  // Inquilino
  rentaMensual: string;
  diaCobro: string;
  arrendadorNombre: string;
  // Propietario · gastos periódicos (opcionales)
  comunidadImporte: string;
  comunidadDia: string;
  ibiImporteAnual: string;
  ibiMes: string;
  ibiDia: string;
  seguroHogarAnual: string;
  seguroHogarMes: string;
  seguroHogarDia: string;
  // Propietario con hipoteca
  prestamoId: string;       // ref a un préstamo de Financiación
}

interface FormErrors {
  regimen?: string;
  direccion?: string;
  cp?: string;
  municipio?: string;
  provincia?: string;
  referenciaCatastral?: string;
  notas?: string;
}

const REGIMEN_OPTIONS: Array<{
  value: RegimenUI;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}> = [
  {
    value: 'inquilino',
    title: 'Inquilino',
    desc: 'Vivo de alquiler.',
    icon: Icons.Contratos,
  },
  {
    value: 'propietarioSinHipoteca',
    title: 'Propietario sin hipoteca',
    desc: 'Vivienda en propiedad · sin préstamo hipotecario activo.',
    icon: Icons.Inmuebles,
  },
  {
    value: 'propietarioConHipoteca',
    title: 'Propietario con hipoteca',
    desc: 'Vivienda en propiedad · con préstamo hipotecario activo.',
    icon: Icons.Financiacion,
  },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const initialForm = (): FormState => ({
  regimen: '',
  direccion: '',
  cp: '',
  municipio: '',
  provincia: '',
  referenciaCatastral: '',
  notas: '',
  cuentaCargo: '',
  rentaMensual: '',
  diaCobro: '1',
  arrendadorNombre: '',
  comunidadImporte: '',
  comunidadDia: '1',
  ibiImporteAnual: '',
  ibiMes: '11',
  ibiDia: '5',
  seguroHogarAnual: '',
  seguroHogarMes: '1',
  seguroHogarDia: '5',
  prestamoId: '',
});

// Parseo tolerante de importes/enteros del formulario.
const numOrNull = (s: string): number | null => {
  const n = parseFloat(String(s).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const intOr = (s: string, def: number): number => {
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : def;
};

// ─── Adaptación entre form ↔ schema TS ────────────────────────────────────

// Stubs neutros para los subcampos requeridos por la unión discriminada.
// Producen 0 eventos en `regenerarEventosVivienda` (alcance A · PR-B-bis los
// reemplaza con datos reales y activa la generación).
const STUB_FECHA_NEUTRA = '1970-01-01';

function fillDataFromForm(
  form: FormState,
  previa: ViviendaHabitualData | null,
): ViviendaHabitualData {
  const direccion: DireccionVivienda = {
    calle: form.direccion.trim(),
    municipio: form.municipio.trim(),
    cp: form.cp.trim(),
    provincia: form.provincia.trim() || undefined,
    referenciaCatastral: form.referenciaCatastral.trim() || undefined,
  };

  const regimen = form.regimen as RegimenUI;

  const cuentaCargo = intOr(form.cuentaCargo, 0);

  if (regimen === 'inquilino') {
    const previaInq =
      previa && previa.tipo === 'inquilino' ? previa : null;
    const hoy = new Date().toISOString().slice(0, 10);
    const realDesde = (v?: string) => (v && v !== STUB_FECHA_NEUTRA ? v : undefined);
    return {
      tipo: 'inquilino',
      direccion,
      contrato: {
        arrendador: {
          nombre: form.arrendadorNombre.trim() || previaInq?.contrato.arrendador.nombre || '',
          nif: previaInq?.contrato.arrendador.nif,
        },
        fechaFirma: realDesde(previaInq?.contrato.fechaFirma) ?? hoy,
        vigenciaDesde: realDesde(previaInq?.contrato.vigenciaDesde) ?? hoy,
        // Sin fin explícito · proyectamos 5 años (LAU) para que la renta se
        // materialice en Tesorería. El usuario puede acotar al renovar.
        vigenciaHasta:
          realDesde(previaInq?.contrato.vigenciaHasta) ?? `${new Date().getFullYear() + 5}-12-31`,
        rentaMensual: numOrNull(form.rentaMensual) ?? 0,
        diaCobro: intOr(form.diaCobro, 1),
        fianza: previaInq?.contrato.fianza ?? 0,
        revisionIPC: previaInq?.contrato.revisionIPC ?? { aplica: false },
        gastosIncluidos: previaInq?.contrato.gastosIncluidos ?? [],
      },
      cuentaCargo,
      conceptoBancarioEsperado: previaInq?.conceptoBancarioEsperado ?? '',
    };
  }

  // Gastos periódicos comunes a propietario (con y sin hipoteca).
  const comunidadImporte = numOrNull(form.comunidadImporte);
  const comunidad =
    comunidadImporte && comunidadImporte > 0
      ? { importe: comunidadImporte, diaCargo: intOr(form.comunidadDia, 1) }
      : undefined;
  const ibiImporte = numOrNull(form.ibiImporteAnual);
  const ibi =
    ibiImporte && ibiImporte > 0
      ? { importeAnual: ibiImporte, mesesPago: [intOr(form.ibiMes, 11)], diaPago: intOr(form.ibiDia, 5) }
      : { importeAnual: 0, mesesPago: [], diaPago: intOr(form.ibiDia, 5) };
  const seguroHogarImporte = numOrNull(form.seguroHogarAnual);
  const seguroHogar =
    seguroHogarImporte && seguroHogarImporte > 0
      ? {
          importeAnual: seguroHogarImporte,
          mesPago: intOr(form.seguroHogarMes, 1),
          diaPago: intOr(form.seguroHogarDia, 5),
        }
      : undefined;

  // Para propietarios la referencia catastral canónica vive en
  // `data.catastro.referenciaCatastral` (la consume `fiscalContextService`).
  // Sincronizamos siempre el input con el campo canónico · `direccion.referenciaCatastral`
  // queda como duplicado para uniformidad con inquilino.
  const refCatastral = form.referenciaCatastral.trim();

  if (regimen === 'propietarioSinHipoteca') {
    const previaProp =
      previa && previa.tipo === 'propietarioSinHipoteca' ? previa : null;
    return {
      tipo: 'propietarioSinHipoteca',
      direccion,
      catastro: {
        ...(previaProp?.catastro ?? {
          valorCatastral: 0,
          superficie: 0,
          porcentajeTitularidad: 100,
        }),
        referenciaCatastral: refCatastral,
      },
      adquisicion: previaProp?.adquisicion ?? {
        fecha: STUB_FECHA_NEUTRA,
        precio: 0,
        gastosAdquisicion: 0,
        mejorasAcumuladas: [],
      },
      comunidad,
      ibi,
      seguros: { ...(previaProp?.seguros ?? {}), hogar: seguroHogar },
      cuentaCargo,
    };
  }

  // propietarioConHipoteca
  const previaHip =
    previa && previa.tipo === 'propietarioConHipoteca' ? previa : null;
  return {
    tipo: 'propietarioConHipoteca',
    direccion,
    catastro: {
      ...(previaHip?.catastro ?? {
        valorCatastral: 0,
        superficie: 0,
        porcentajeTitularidad: 100,
      }),
      referenciaCatastral: refCatastral,
    },
    adquisicion: previaHip?.adquisicion ?? {
      fecha: STUB_FECHA_NEUTRA,
      precio: 0,
      gastosAdquisicion: 0,
      mejorasAcumuladas: [],
    },
    comunidad,
    ibi,
    seguros: { ...(previaHip?.seguros ?? {}), hogar: seguroHogar },
    cuentaCargo,
    hipoteca: { prestamoId: form.prestamoId || previaHip?.hipoteca.prestamoId || 0 },
    beneficioFiscal: previaHip?.beneficioFiscal,
  };
}

function formFromVivienda(v: ViviendaHabitual): FormState {
  const d = v.data.direccion;
  // Para propietarios la referencia canónica está en `data.catastro.referenciaCatastral`
  // (consumida por `fiscalContextService`) · cae a `direccion.referenciaCatastral` como
  // duplicado por compatibilidad. Inquilino sólo tiene el campo en `direccion`.
  const refCatastral =
    v.data.tipo === 'inquilino'
      ? d.referenciaCatastral
      : v.data.catastro.referenciaCatastral || d.referenciaCatastral;

  const numStr = (n: number | undefined): string => (n && n > 0 ? String(n) : '');

  const base: FormState = {
    ...initialForm(),
    regimen: v.data.tipo,
    direccion: d.calle ?? '',
    cp: d.cp ?? '',
    municipio: d.municipio ?? '',
    provincia: d.provincia ?? '',
    referenciaCatastral: refCatastral ?? '',
    notas: v.notas ?? '',
    cuentaCargo: v.data.cuentaCargo ? String(v.data.cuentaCargo) : '',
  };

  if (v.data.tipo === 'inquilino') {
    const c = v.data.contrato;
    return {
      ...base,
      rentaMensual: numStr(c.rentaMensual),
      diaCobro: String(c.diaCobro || 1),
      arrendadorNombre: c.arrendador?.nombre ?? '',
    };
  }

  // Propietario (con y sin hipoteca)
  const comunidad = v.data.comunidad;
  const ibi = v.data.ibi;
  const hogar = v.data.seguros?.hogar;
  return {
    ...base,
    comunidadImporte: numStr(comunidad?.importe),
    comunidadDia: String(comunidad?.diaCargo ?? 1),
    ibiImporteAnual: numStr(ibi?.importeAnual),
    ibiMes: String(ibi?.mesesPago?.[0] ?? 11),
    ibiDia: String(ibi?.diaPago ?? 5),
    seguroHogarAnual: numStr(hogar?.importeAnual),
    seguroHogarMes: String(hogar?.mesPago ?? 1),
    seguroHogarDia: String(hogar?.diaPago ?? 5),
    prestamoId:
      v.data.tipo === 'propietarioConHipoteca' && v.data.hipoteca?.prestamoId
        ? String(v.data.hipoteca.prestamoId)
        : '',
  };
}

// ─── Validación ────────────────────────────────────────────────────────────

const REGEX_CP = /^\d{5}$/;
const REGEX_REF_CATASTRAL = /^[0-9A-Z]{20}$/;

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.regimen) errors.regimen = 'Selecciona un régimen';

  const direccion = form.direccion.trim();
  if (!direccion) errors.direccion = 'Indica la dirección';
  else if (direccion.length < 3) errors.direccion = 'Mínimo 3 caracteres';
  else if (direccion.length > 200) errors.direccion = 'Máximo 200 caracteres';

  const cp = form.cp.trim();
  if (!cp) errors.cp = 'Indica el código postal';
  else if (!REGEX_CP.test(cp)) errors.cp = 'Debe tener 5 dígitos';

  const municipio = form.municipio.trim();
  if (!municipio) errors.municipio = 'Indica el municipio';
  else if (municipio.length < 2) errors.municipio = 'Mínimo 2 caracteres';
  else if (municipio.length > 100) errors.municipio = 'Máximo 100 caracteres';

  const provincia = form.provincia.trim();
  if (!provincia) errors.provincia = 'Indica la provincia';
  else if (provincia.length < 2) errors.provincia = 'Mínimo 2 caracteres';
  else if (provincia.length > 100) errors.provincia = 'Máximo 100 caracteres';

  const ref = form.referenciaCatastral.trim();
  if (ref && !REGEX_REF_CATASTRAL.test(ref)) {
    errors.referenciaCatastral = 'Formato inválido · 20 caracteres alfanuméricos';
  }

  if (form.notas.length > 500) errors.notas = 'Máximo 500 caracteres';

  return errors;
}

// ─── Componente ────────────────────────────────────────────────────────────

const ViviendaPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [vivienda, setVivienda] = useState<ViviendaHabitual | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [cuentas, setCuentas] = useState<Array<{ id: number; label: string }>>([]);
  const [prestamos, setPrestamos] = useState<Array<{ id: string; label: string }>>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showBanner, setShowBanner] = useState(false);
  const kebabRef = useRef<HTMLDivElement | null>(null);

  const modo: 'alta' | 'edicion' = vivienda ? 'edicion' : 'alta';

  // Cargar vivienda activa al montar
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      const pdId = personalData?.id ?? 1;
      setPersonalDataId(pdId);

      // Cuentas (para «cuenta de cargo») y préstamos (para vincular hipoteca).
      try {
        const lista = await cuentasService.list();
        setCuentas(
          (lista as Array<{ id?: number; alias?: string; name?: string; iban?: string; banco?: { name?: string } }>)
            .filter((c) => c.id != null)
            .map((c) => ({
              id: c.id as number,
              label:
                c.alias || c.name || c.banco?.name || (c.iban ? `···${String(c.iban).slice(-4)}` : `Cuenta ${c.id}`),
            })),
        );
      } catch {
        setCuentas([]);
      }
      try {
        const todos = await prestamosService.getAllPrestamos();
        setPrestamos(
          (todos as Array<{ id: string; nombre?: string; banco?: string }>).map((p) => ({
            id: p.id,
            label: p.nombre || p.banco || `Préstamo ${p.id}`,
          })),
        );
      } catch {
        setPrestamos([]);
      }

      const activa = await obtenerViviendaActiva(pdId);
      if (activa) {
        setVivienda(activa);
        setForm(formFromVivienda(activa));
      } else {
        setVivienda(null);
        setForm(initialForm());
      }
      setErrors({});
      setShowBanner(false);
    } catch (err) {
      console.error('[ViviendaPage] error cargando vivienda', err);
      showToastV5('No se pudo cargar la ficha de vivienda', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cierra kebab al click fuera
  useEffect(() => {
    if (!showKebab) return;
    const onDocClick = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setShowKebab(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showKebab]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if ((errors as Partial<Record<keyof FormState, string>>)[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
    if (showBanner) setShowBanner(false);
  };

  const isFormReady = useMemo(() => {
    return (
      !!form.regimen &&
      form.direccion.trim().length >= 3 &&
      REGEX_CP.test(form.cp.trim()) &&
      form.municipio.trim().length >= 2 &&
      form.provincia.trim().length >= 2
    );
  }, [form]);

  const onGuardar = async () => {
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setShowBanner(true);
      return;
    }
    if (personalDataId == null) {
      showToastV5('No se pudo determinar el titular activo', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = fillDataFromForm(form, vivienda?.data ?? null);
      const ahora = new Date().toISOString().slice(0, 10);
      const payload: Omit<ViviendaHabitual, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: number;
      } = {
        id: vivienda?.id,
        personalDataId,
        data,
        vigenciaDesde: vivienda?.vigenciaDesde ?? ahora,
        vigenciaHasta: vivienda?.vigenciaHasta,
        activa: true,
        notas: form.notas.trim() || undefined,
      };
      const saved = await guardarVivienda(payload);
      setVivienda(saved);
      setForm(formFromVivienda(saved));
      setErrors({});
      setShowBanner(false);
      showToastV5(
        modo === 'alta' ? 'Vivienda habitual guardada' : 'Cambios guardados',
        'success',
      );
    } catch (err) {
      console.error('[ViviendaPage] error guardando', err);
      showToastV5('No se pudo guardar la vivienda', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onEliminar = async () => {
    if (!vivienda?.id) return;
    setDeleting(true);
    try {
      await eliminarVivienda(vivienda.id);
      setShowDeleteModal(false);
      setVivienda(null);
      setForm(initialForm());
      setErrors({});
      setShowBanner(false);
      showToastV5('Vivienda habitual eliminada', 'success');
    } catch (err) {
      console.error('[ViviendaPage] error eliminando', err);
      showToastV5('No se pudo eliminar la vivienda', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <CardV5 accent="gold-soft">
        <style>{`@keyframes atlas-spin { to { transform: rotate(360deg); } }`}</style>
        <CardV5.Body>
          <div style={styles.loading}>
            <span style={styles.spinner} />
            <span>Cargando…</span>
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <style>{`@keyframes atlas-spin { to { transform: rotate(360deg); } }`}</style>
      <CardV5 accent="gold-soft">
        <div style={styles.headerRow}>
          <div>
            <CardV5.Title>Mi vivienda habitual</CardV5.Title>
            <CardV5.Subtitle>
              datos básicos de la vivienda donde vive el hogar
            </CardV5.Subtitle>
          </div>
          {modo === 'edicion' && (
            <div ref={kebabRef} style={styles.kebabWrap}>
              <button
                type="button"
                aria-label="Más acciones"
                onClick={() => setShowKebab((v) => !v)}
                style={styles.kebabBtn}
              >
                <Icons.More size={18} strokeWidth={1.8} />
              </button>
              {showKebab && (
                <div role="menu" style={styles.kebabMenu}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowKebab(false);
                      setShowDeleteModal(true);
                    }}
                    style={styles.kebabItemDestructive}
                  >
                    <Icons.Delete size={14} strokeWidth={1.8} />
                    <span>Eliminar vivienda</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <CardV5.Body>
          {showBanner && Object.keys(errors).length > 0 && (
            <div role="alert" style={styles.banner}>
              <Icons.Alert size={14} strokeWidth={1.8} />
              <span>Revisa los campos marcados</span>
            </div>
          )}

          {/* SECCIÓN A · Régimen */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Régimen</div>
            <div style={styles.regimenGrid}>
              {REGIMEN_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.regimen === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('regimen', opt.value)}
                    aria-pressed={active}
                    style={{
                      ...styles.regimenCard,
                      ...(active ? styles.regimenCardActive : {}),
                      ...(errors.regimen && !active ? styles.regimenCardError : {}),
                    }}
                  >
                    <span style={styles.regimenIcon}>
                      <Icon size={20} strokeWidth={1.7} />
                    </span>
                    <div style={styles.regimenTitle}>{opt.title}</div>
                    <div style={styles.regimenDesc}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            {errors.regimen && <div style={styles.errorMsg}>{errors.regimen}</div>}
          </div>

          {/* SECCIÓN B · Dirección */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Dirección</div>
            <div style={styles.fieldGroup}>
              <label htmlFor="vh-direccion" style={styles.label}>
                Dirección<span style={styles.required}>*</span>
              </label>
              <input
                id="vh-direccion"
                type="text"
                value={form.direccion}
                onChange={(e) => setField('direccion', e.target.value)}
                placeholder="Calle, número, piso"
                maxLength={200}
                style={errors.direccion ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errors.direccion && <div style={styles.errorMsg}>{errors.direccion}</div>}
            </div>

            <div style={styles.fieldRow3}>
              <div style={styles.fieldGroup}>
                <label htmlFor="vh-cp" style={styles.label}>
                  Código postal<span style={styles.required}>*</span>
                </label>
                <input
                  id="vh-cp"
                  type="text"
                  inputMode="numeric"
                  value={form.cp}
                  onChange={(e) =>
                    setField('cp', e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                  placeholder="28020"
                  maxLength={5}
                  style={errors.cp ? { ...styles.input, ...styles.inputError } : styles.input}
                />
                {errors.cp && <div style={styles.errorMsg}>{errors.cp}</div>}
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="vh-municipio" style={styles.label}>
                  Municipio<span style={styles.required}>*</span>
                </label>
                <input
                  id="vh-municipio"
                  type="text"
                  value={form.municipio}
                  onChange={(e) => setField('municipio', e.target.value)}
                  placeholder="Madrid"
                  maxLength={100}
                  style={errors.municipio ? { ...styles.input, ...styles.inputError } : styles.input}
                />
                {errors.municipio && <div style={styles.errorMsg}>{errors.municipio}</div>}
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="vh-provincia" style={styles.label}>
                  Provincia<span style={styles.required}>*</span>
                </label>
                <input
                  id="vh-provincia"
                  type="text"
                  value={form.provincia}
                  onChange={(e) => setField('provincia', e.target.value)}
                  placeholder="Madrid"
                  maxLength={100}
                  style={errors.provincia ? { ...styles.input, ...styles.inputError } : styles.input}
                />
                {errors.provincia && <div style={styles.errorMsg}>{errors.provincia}</div>}
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="vh-ref" style={styles.label}>
                Referencia catastral
                <span style={styles.optionalHint}> · opcional</span>
              </label>
              <input
                id="vh-ref"
                type="text"
                value={form.referenciaCatastral}
                onChange={(e) =>
                  setField(
                    'referenciaCatastral',
                    e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 20),
                  )
                }
                placeholder="20 caracteres alfanuméricos"
                maxLength={20}
                style={
                  errors.referenciaCatastral
                    ? { ...styles.input, ...styles.inputMono, ...styles.inputError }
                    : { ...styles.input, ...styles.inputMono }
                }
              />
              {errors.referenciaCatastral && (
                <div style={styles.errorMsg}>{errors.referenciaCatastral}</div>
              )}
            </div>
          </div>

          {/* SECCIÓN C · Gastos que propagan a Tesorería (según régimen) */}
          {form.regimen && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                {form.regimen === 'inquilino' ? 'Alquiler' : 'Gastos de la vivienda'}
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="vh-cuenta" style={styles.label}>
                  Cuenta de cargo<span style={styles.optionalHint}> · de dónde salen los pagos</span>
                </label>
                <select
                  id="vh-cuenta"
                  value={form.cuentaCargo}
                  onChange={(e) => setField('cuentaCargo', e.target.value)}
                  style={styles.input}
                >
                  <option value="">Selecciona una cuenta</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.label}</option>
                  ))}
                </select>
              </div>

              {form.regimen === 'inquilino' && (
                <>
                  <div style={styles.fieldRow3}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-renta" style={styles.label}>Renta mensual (€)</label>
                      <input
                        id="vh-renta" type="text" inputMode="decimal"
                        value={form.rentaMensual}
                        onChange={(e) => setField('rentaMensual', e.target.value)}
                        placeholder="950" style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-diacobro" style={styles.label}>Día de cargo</label>
                      <input
                        id="vh-diacobro" type="text" inputMode="numeric"
                        value={form.diaCobro}
                        onChange={(e) => setField('diaCobro', e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="1" style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-arrendador" style={styles.label}>
                        Arrendador<span style={styles.optionalHint}> · opcional</span>
                      </label>
                      <input
                        id="vh-arrendador" type="text"
                        value={form.arrendadorNombre}
                        onChange={(e) => setField('arrendadorNombre', e.target.value)}
                        placeholder="Nombre" style={styles.input}
                      />
                    </div>
                  </div>
                  <div style={styles.helperText}>
                    La renta se proyecta en Tesorería el día indicado hasta 5 años (LAU).
                  </div>
                </>
              )}

              {(form.regimen === 'propietarioSinHipoteca' || form.regimen === 'propietarioConHipoteca') && (
                <>
                  {/* Comunidad */}
                  <div style={styles.fieldRow3}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-comunidad" style={styles.label}>
                        Comunidad (€/mes)<span style={styles.optionalHint}> · opcional</span>
                      </label>
                      <input
                        id="vh-comunidad" type="text" inputMode="decimal"
                        value={form.comunidadImporte}
                        onChange={(e) => setField('comunidadImporte', e.target.value)}
                        placeholder="60" style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-comunidad-dia" style={styles.label}>Día de cargo</label>
                      <input
                        id="vh-comunidad-dia" type="text" inputMode="numeric"
                        value={form.comunidadDia}
                        onChange={(e) => setField('comunidadDia', e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="1" style={styles.input}
                      />
                    </div>
                    <div />
                  </div>
                  {/* IBI */}
                  <div style={styles.fieldRow3}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-ibi" style={styles.label}>
                        IBI (€/año)<span style={styles.optionalHint}> · opcional</span>
                      </label>
                      <input
                        id="vh-ibi" type="text" inputMode="decimal"
                        value={form.ibiImporteAnual}
                        onChange={(e) => setField('ibiImporteAnual', e.target.value)}
                        placeholder="450" style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-ibi-mes" style={styles.label}>Mes de pago</label>
                      <select
                        id="vh-ibi-mes" value={form.ibiMes}
                        onChange={(e) => setField('ibiMes', e.target.value)}
                        style={styles.input}
                      >
                        {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                      </select>
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-ibi-dia" style={styles.label}>Día</label>
                      <input
                        id="vh-ibi-dia" type="text" inputMode="numeric"
                        value={form.ibiDia}
                        onChange={(e) => setField('ibiDia', e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="5" style={styles.input}
                      />
                    </div>
                  </div>
                  {/* Seguro hogar */}
                  <div style={styles.fieldRow3}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-seguro" style={styles.label}>
                        Seguro hogar (€/año)<span style={styles.optionalHint}> · opcional</span>
                      </label>
                      <input
                        id="vh-seguro" type="text" inputMode="decimal"
                        value={form.seguroHogarAnual}
                        onChange={(e) => setField('seguroHogarAnual', e.target.value)}
                        placeholder="220" style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-seguro-mes" style={styles.label}>Mes de pago</label>
                      <select
                        id="vh-seguro-mes" value={form.seguroHogarMes}
                        onChange={(e) => setField('seguroHogarMes', e.target.value)}
                        style={styles.input}
                      >
                        {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                      </select>
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="vh-seguro-dia" style={styles.label}>Día</label>
                      <input
                        id="vh-seguro-dia" type="text" inputMode="numeric"
                        value={form.seguroHogarDia}
                        onChange={(e) => setField('seguroHogarDia', e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="5" style={styles.input}
                      />
                    </div>
                  </div>
                </>
              )}

              {form.regimen === 'propietarioConHipoteca' && (
                <div style={styles.fieldGroup}>
                  <label htmlFor="vh-hipoteca" style={styles.label}>
                    Préstamo hipotecario<span style={styles.optionalHint}> · se da de alta en Financiación</span>
                  </label>
                  <select
                    id="vh-hipoteca" value={form.prestamoId}
                    onChange={(e) => setField('prestamoId', e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Selecciona el préstamo…</option>
                    {prestamos.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <div style={styles.helperText}>
                    {prestamos.length === 0
                      ? 'No hay préstamos dados de alta · créalo en Financiación y aparecerá aquí.'
                      : 'La cuota la genera Financiación (no se duplica el cuadro de amortización).'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN D · Notas */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Notas</div>
            <div style={styles.fieldGroup}>
              <label htmlFor="vh-notas" style={styles.label}>
                Notas
                <span style={styles.optionalHint}> · opcional</span>
              </label>
              <textarea
                id="vh-notas"
                value={form.notas}
                onChange={(e) => setField('notas', e.target.value.slice(0, 500))}
                placeholder="Cualquier observación que quieras recordar"
                rows={3}
                maxLength={500}
                style={errors.notas ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
              />
              <div style={styles.helperText}>{form.notas.length}/500</div>
              {errors.notas && <div style={styles.errorMsg}>{errors.notas}</div>}
            </div>
          </div>

          {/* Acciones */}
          <div style={styles.footerRow}>
            <button
              type="button"
              onClick={onGuardar}
              disabled={saving || !isFormReady}
              className="atlas-btn-primary"
              style={styles.btnPrimary}
            >
              {saving ? (
                <>
                  <span style={styles.spinnerInline} />
                  Guardando…
                </>
              ) : modo === 'alta' ? (
                'Guardar vivienda'
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </CardV5.Body>
      </CardV5>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vh-del-title"
          style={styles.modalBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div style={styles.modalCard}>
            <div id="vh-del-title" style={styles.modalTitle}>
              Eliminar vivienda habitual
            </div>
            <div style={styles.modalBody}>
              Esta acción es irreversible. Se eliminará la ficha de tu vivienda
              habitual. Los movimientos de Tesorería que ya existan NO se borran.
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={styles.btnSecondary}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onEliminar}
                disabled={deleting}
                style={styles.btnDestructive}
              >
                {deleting ? (
                  <>
                    <span style={styles.spinnerInline} />
                    Eliminando…
                  </>
                ) : (
                  'Eliminar vivienda'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  loading: {
    padding: '40px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: 'var(--atlas-v5-ink-3)',
    fontSize: 13,
  },
  spinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid var(--atlas-v5-line)',
    borderTopColor: 'var(--atlas-v5-ink-3)',
    borderRadius: '50%',
    animation: 'atlas-spin 0.7s linear infinite',
  },
  spinnerInline: {
    display: 'inline-block',
    width: 12,
    height: 12,
    border: '2px solid currentColor',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'atlas-spin 0.7s linear infinite',
    marginRight: 8,
    opacity: 0.8,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 18px 0',
  },
  kebabWrap: {
    position: 'relative' as const,
  },
  kebabBtn: {
    width: 32,
    height: 32,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 7,
    background: 'var(--atlas-v5-card)',
    color: 'var(--atlas-v5-ink-3)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  kebabMenu: {
    position: 'absolute' as const,
    top: 36,
    right: 0,
    minWidth: 200,
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 8,
    boxShadow: 'var(--atlas-v5-shadow-modal)',
    padding: 4,
    zIndex: 50, /* --atlas-v5-z-dropdown */
  },
  kebabItemDestructive: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    border: 'none',
    background: 'transparent',
    color: 'var(--atlas-v5-neg)',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 6,
    textAlign: 'left' as const,
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    margin: '0 0 14px',
    background: 'var(--atlas-v5-neg-wash, rgba(220, 38, 38, 0.08))',
    border: '1px solid var(--atlas-v5-neg)',
    borderRadius: 7,
    color: 'var(--atlas-v5-neg)',
    fontSize: 12.5,
    fontWeight: 500,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--atlas-v5-ink-4)',
    marginBottom: 10,
  },
  regimenGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  regimenCard: {
    padding: '14px 16px',
    background: 'var(--atlas-v5-card)',
    border: '1.5px solid var(--atlas-v5-line)',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    transition: 'border-color 120ms, box-shadow 120ms',
  },
  regimenCardActive: {
    borderColor: 'var(--atlas-v5-gold)',
    boxShadow: '0 0 0 1px var(--atlas-v5-gold)',
    background: 'var(--atlas-v5-gold-wash)',
  },
  regimenCardError: {
    borderColor: 'var(--atlas-v5-neg)',
  },
  regimenIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'var(--atlas-v5-card-alt)',
    color: 'var(--atlas-v5-ink-3)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regimenTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: 'var(--atlas-v5-ink)',
    marginTop: 4,
  },
  regimenDesc: {
    fontSize: 12,
    color: 'var(--atlas-v5-ink-3)',
    lineHeight: 1.45,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginBottom: 12,
    minWidth: 0,
  },
  fieldRow3: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 1fr',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--atlas-v5-ink-3)',
  },
  optionalHint: {
    fontWeight: 400,
    color: 'var(--atlas-v5-ink-4)',
  },
  required: {
    color: 'var(--atlas-v5-neg)',
    marginLeft: 2,
  },
  input: {
    height: 34,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    fontFamily: 'var(--atlas-v5-font-ui)',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  inputMono: {
    fontFamily: 'var(--atlas-v5-font-mono-num)',
    letterSpacing: '0.04em',
  },
  inputError: {
    borderColor: 'var(--atlas-v5-neg)',
  },
  textarea: {
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    fontFamily: 'var(--atlas-v5-font-ui)',
    width: '100%',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    minHeight: 70,
  },
  helperText: {
    fontSize: 11,
    color: 'var(--atlas-v5-ink-4)',
    marginTop: 2,
  },
  errorMsg: {
    fontSize: 11,
    color: 'var(--atlas-v5-neg)',
    marginTop: 2,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100, /* --atlas-v5-z-modal */
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 12,
    padding: '20px 22px',
    boxShadow: 'var(--atlas-v5-shadow-modal)',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--atlas-v5-ink)',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: 'var(--atlas-v5-ink-3)',
    lineHeight: 1.55,
    marginBottom: 18,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnSecondary: {
    padding: '8px 16px',
    border: '1.5px solid var(--atlas-v5-line)',
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--atlas-v5-ink-3)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDestructive: {
    padding: '8px 16px',
    border: '1.5px solid var(--atlas-v5-neg)',
    borderRadius: 7,
    background: 'var(--atlas-v5-neg)',
    color: 'var(--atlas-v5-white)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
  },
};

export default ViviendaPage;
