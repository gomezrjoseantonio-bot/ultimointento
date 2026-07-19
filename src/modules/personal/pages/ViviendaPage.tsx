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

const initialForm = (): FormState => ({
  regimen: '',
  direccion: '',
  cp: '',
  municipio: '',
  provincia: '',
  referenciaCatastral: '',
  notas: '',
});

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

  if (regimen === 'inquilino') {
    const previaInq =
      previa && previa.tipo === 'inquilino' ? previa : null;
    return {
      tipo: 'inquilino',
      direccion,
      contrato: previaInq?.contrato ?? {
        arrendador: { nombre: '' },
        fechaFirma: STUB_FECHA_NEUTRA,
        vigenciaDesde: STUB_FECHA_NEUTRA,
        vigenciaHasta: STUB_FECHA_NEUTRA,
        rentaMensual: 0,
        diaCobro: 1,
        fianza: 0,
        revisionIPC: { aplica: false },
        gastosIncluidos: [],
      },
      cuentaCargo: previaInq?.cuentaCargo ?? 0,
      conceptoBancarioEsperado: previaInq?.conceptoBancarioEsperado ?? '',
    };
  }

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
      comunidad: previaProp?.comunidad,
      ibi: previaProp?.ibi ?? {
        importeAnual: 0,
        mesesPago: [],
        diaPago: 1,
      },
      seguros: previaProp?.seguros ?? {},
      cuentaCargo: previaProp?.cuentaCargo ?? 0,
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
    comunidad: previaHip?.comunidad,
    ibi: previaHip?.ibi ?? {
      importeAnual: 0,
      mesesPago: [],
      diaPago: 1,
    },
    seguros: previaHip?.seguros ?? {},
    cuentaCargo: previaHip?.cuentaCargo ?? 0,
    hipoteca: previaHip?.hipoteca ?? { prestamoId: 0 },
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
  return {
    regimen: v.data.tipo,
    direccion: d.calle ?? '',
    cp: d.cp ?? '',
    municipio: d.municipio ?? '',
    provincia: d.provincia ?? '',
    referenciaCatastral: refCatastral ?? '',
    notas: v.notas ?? '',
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
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
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
