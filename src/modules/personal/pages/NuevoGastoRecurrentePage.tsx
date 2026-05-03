// ============================================================================
// T34 · Wizard "Nuevo gasto recurrente personal"
// ============================================================================
// Crea un CompromisoRecurrente de ámbito personal e invoca
// regenerateForecastsForward({ force: true }) tras guardar.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../design-system/v5';
import { cuentasService } from '../../../services/cuentasService';
import { personalDataService } from '../../../services/personalDataService';
import { crearCompromiso } from '../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../services/treasuryBootstrapService';
import type { Account } from '../../../services/db';
import type {
  BolsaPresupuesto,
  CategoriaGastoCompromiso,
  ImporteEvento,
  MetodoPagoCompromiso,
  PatronRecurrente,
  ReferenciaDiaRelativo,
  TipoCompromiso,
} from '../../../types/compromisosRecurrentes';
import type { PersonalOutletContext } from '../PersonalContext';

// ─── Constantes de tipos de gasto ──────────────────────────────────────────

interface TipoGastoOption {
  value: string;        // tipo + ':' + subtipo (o solo tipo si sin subtipo)
  tipo: TipoCompromiso;
  subtipo?: string;
  label: string;
  grupo: string;
  categoria: CategoriaGastoCompromiso;
}

const TIPOS_GASTO: TipoGastoOption[] = [
  // Vivienda
  { value: 'comunidad', tipo: 'comunidad', label: 'Comunidad de propietarios', grupo: 'Vivienda', categoria: 'vivienda.comunidad' },
  { value: 'impuesto:ibi', tipo: 'impuesto', subtipo: 'ibi', label: 'IBI', grupo: 'Vivienda', categoria: 'vivienda.ibi' },
  { value: 'seguro:hogar', tipo: 'seguro', subtipo: 'hogar', label: 'Seguro hogar', grupo: 'Vivienda', categoria: 'vivienda.seguros' },

  // Gastos del día a día
  { value: 'suministro:luz', tipo: 'suministro', subtipo: 'luz', label: 'Suministro · Luz', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suministro:gas', tipo: 'suministro', subtipo: 'gas', label: 'Suministro · Gas', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suministro:agua', tipo: 'suministro', subtipo: 'agua', label: 'Suministro · Agua', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suministro:internet', tipo: 'suministro', subtipo: 'internet', label: 'Suministro · Internet', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suministro:movil', tipo: 'suministro', subtipo: 'movil', label: 'Suministro · Móvil', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suministro:otros', tipo: 'suministro', subtipo: 'otros', label: 'Suministro · Otros', grupo: 'Gastos del día a día', categoria: 'vivienda.suministros' },
  { value: 'suscripcion:streaming', tipo: 'suscripcion', subtipo: 'streaming', label: 'Suscripción · Streaming', grupo: 'Gastos del día a día', categoria: 'suscripciones' },
  { value: 'suscripcion:prensa', tipo: 'suscripcion', subtipo: 'prensa', label: 'Suscripción · Prensa', grupo: 'Gastos del día a día', categoria: 'suscripciones' },
  { value: 'suscripcion:software', tipo: 'suscripcion', subtipo: 'software', label: 'Suscripción · Software', grupo: 'Gastos del día a día', categoria: 'suscripciones' },
  { value: 'suscripcion:musica', tipo: 'suscripcion', subtipo: 'musica', label: 'Suscripción · Música', grupo: 'Gastos del día a día', categoria: 'suscripciones' },
  { value: 'suscripcion:cloud', tipo: 'suscripcion', subtipo: 'cloud', label: 'Suscripción · Cloud', grupo: 'Gastos del día a día', categoria: 'suscripciones' },
  { value: 'suscripcion:otros', tipo: 'suscripcion', subtipo: 'otros', label: 'Suscripción · Otros', grupo: 'Gastos del día a día', categoria: 'suscripciones' },

  // Otros
  { value: 'seguro:salud', tipo: 'seguro', subtipo: 'salud', label: 'Seguro · Salud', grupo: 'Otros', categoria: 'salud' },
  { value: 'seguro:coche', tipo: 'seguro', subtipo: 'coche', label: 'Seguro · Coche', grupo: 'Otros', categoria: 'transporte' },
  { value: 'seguro:vida', tipo: 'seguro', subtipo: 'vida', label: 'Seguro · Vida', grupo: 'Otros', categoria: 'salud' },
  { value: 'seguro:inquilino', tipo: 'seguro', subtipo: 'inquilino', label: 'Seguro · Inquilino', grupo: 'Otros', categoria: 'vivienda.seguros' },
  { value: 'seguro:mascotas', tipo: 'seguro', subtipo: 'mascotas', label: 'Seguro · Mascotas', grupo: 'Otros', categoria: 'personal' },
  { value: 'seguro:otros', tipo: 'seguro', subtipo: 'otros', label: 'Seguro · Otros', grupo: 'Otros', categoria: 'personal' },
  { value: 'cuota:gimnasio', tipo: 'cuota', subtipo: 'gimnasio', label: 'Cuota · Gimnasio', grupo: 'Otros', categoria: 'ocio' },
  { value: 'cuota:colegio', tipo: 'cuota', subtipo: 'colegio', label: 'Cuota · Colegio', grupo: 'Otros', categoria: 'educacion' },
  { value: 'cuota:universidad', tipo: 'cuota', subtipo: 'universidad', label: 'Cuota · Universidad', grupo: 'Otros', categoria: 'educacion' },
  { value: 'cuota:profesional', tipo: 'cuota', subtipo: 'profesional', label: 'Cuota · Profesional', grupo: 'Otros', categoria: 'educacion' },
  { value: 'cuota:ong', tipo: 'cuota', subtipo: 'ong', label: 'Cuota · ONG', grupo: 'Otros', categoria: 'ocio' },
  { value: 'cuota:otros', tipo: 'cuota', subtipo: 'otros', label: 'Cuota / membresía · Otros', grupo: 'Otros', categoria: 'personal' },
  { value: 'impuesto:tasas', tipo: 'impuesto', subtipo: 'tasas', label: 'Impuesto · Tasas municipales', grupo: 'Otros', categoria: 'obligaciones.multas' },
  { value: 'impuesto:multas', tipo: 'impuesto', subtipo: 'multas', label: 'Impuesto · Multas', grupo: 'Otros', categoria: 'obligaciones.multas' },
  { value: 'impuesto:otros', tipo: 'impuesto', subtipo: 'otros', label: 'Impuesto · Otros', grupo: 'Otros', categoria: 'obligaciones.multas' },
  { value: 'otros', tipo: 'otros', label: 'Otros pagos recurrentes', grupo: 'Otros', categoria: 'personal' },
];

const GRUPOS_ORDEN = ['Vivienda', 'Gastos del día a día', 'Otros'];

// ─── Inferir bolsa por tipo/subtipo ─────────────────────────────────────────

function inferirBolsa(value: string): BolsaPresupuesto | '' {
  // Vivienda
  if (['comunidad', 'impuesto:ibi', 'seguro:hogar'].includes(value)) return 'necesidades';
  // Suministros
  if (value.startsWith('suministro:')) return 'necesidades';
  // Seguros necesidades
  if (['seguro:salud', 'seguro:coche', 'seguro:vida', 'seguro:inquilino', 'seguro:mascotas'].includes(value)) return 'necesidades';
  if (value === 'seguro:otros') return 'necesidades';
  // Cuotas
  if (['cuota:colegio', 'cuota:universidad', 'cuota:profesional'].includes(value)) return 'necesidades';
  if (['cuota:gimnasio', 'cuota:ong'].includes(value)) return 'deseos';
  if (value === 'cuota:otros') return 'deseos';
  // Suscripciones digitales
  if (value.startsWith('suscripcion:')) return 'deseos';
  // Impuestos
  if (value.startsWith('impuesto:')) return 'necesidades';
  // Otros pagos recurrentes
  if (value === 'otros') return '';
  return '';
}

// ─── Tipo PatronUI ───────────────────────────────────────────────────────────

type PatronUI =
  | 'mensualDiaFijo'
  | 'mensualDiaRelativo'
  | 'bimestral'
  | 'trimestral'
  | 'anual1pago'
  | 'anual2pagos';

type ModoImporte = 'fijo' | 'variable' | 'estacional';

// ─── Estado del formulario ───────────────────────────────────────────────────

export interface FormState {
  // Sección 1
  tipoGastoValue: string;
  proveedor: string;
  nif: string;
  referencia: string;
  // Sección 2
  patronUI: PatronUI | '';
  diaMes: string;       // 1-31
  mesInicio: string;    // 1-12
  mesFin: string;       // 1-12 | '' = indefinido
  diaRelativo: string;  // ReferenciaDiaRelativo
  mesAncla: string;     // 1-12 para bimestral/trimestral
  mesAnual1: string;    // 1-12 para anual1pago
  mesAnual2a: string;   // 1-12 para anual2pagos
  mesAnual2b: string;   // 1-12 para anual2pagos
  // Sección 3
  modoImporte: ModoImporte | '';
  importeFijo: string;
  importeVariable: string;
  importesEstacionales: string[]; // 12 valores (ene-dic)
  // Sección 4
  cuentaCargoId: string;
  bolsa: BolsaPresupuesto | '';
}

const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const initialForm = (): FormState => {
  const now = new Date();
  return {
    tipoGastoValue: '',
    proveedor: '',
    nif: '',
    referencia: '',
    patronUI: '',
    diaMes: '5',
    mesInicio: String(now.getMonth() + 1),
    mesFin: '',
    diaRelativo: 'ultimoHabil',
    mesAncla: String(now.getMonth() + 1),
    mesAnual1: String(now.getMonth() + 1),
    mesAnual2a: '6',
    mesAnual2b: '11',
    modoImporte: '',
    importeFijo: '',
    importeVariable: '',
    importesEstacionales: Array(12).fill(''),
    cuentaCargoId: '',
    bolsa: '',
  };
};

// ─── Helpers de cálculo de coste anual ──────────────────────────────────────

function cargosAlAnio(patronUI: PatronUI | ''): number {
  switch (patronUI) {
    case 'mensualDiaFijo':
    case 'mensualDiaRelativo':
      return 12;
    case 'bimestral':
      return 6;
    case 'trimestral':
      return 4;
    case 'anual1pago':
      return 1;
    case 'anual2pagos':
      return 2;
    default:
      return 0;
  }
}

function calcularCosteAnual(form: FormState): number {
  if (!form.modoImporte) return 0;
  if (form.modoImporte === 'fijo') {
    const imp = parseFloat(form.importeFijo);
    if (isNaN(imp) || imp <= 0) return 0;
    return imp * cargosAlAnio(form.patronUI);
  }
  if (form.modoImporte === 'variable') {
    const imp = parseFloat(form.importeVariable);
    if (isNaN(imp) || imp <= 0) return 0;
    return imp * cargosAlAnio(form.patronUI);
  }
  if (form.modoImporte === 'estacional') {
    return form.importesEstacionales.reduce((sum, v) => {
      const n = parseFloat(v);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }
  return 0;
}

// ─── Build PatronRecurrente desde FormState ──────────────────────────────────

function buildPatron(form: FormState): PatronRecurrente | null {
  const dia = parseInt(form.diaMes, 10);

  switch (form.patronUI) {
    case 'mensualDiaFijo':
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      return { tipo: 'mensualDiaFijo', dia };
    case 'mensualDiaRelativo': {
      const ref = form.diaRelativo as ReferenciaDiaRelativo;
      return { tipo: 'mensualDiaRelativo', referencia: ref };
    }
    case 'bimestral': {
      const ancla = parseInt(form.mesAncla, 10);
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      if (isNaN(ancla) || ancla < 1 || ancla > 12) return null;
      return { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: ancla, dia };
    }
    case 'trimestral': {
      const ancla = parseInt(form.mesAncla, 10);
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      if (isNaN(ancla) || ancla < 1 || ancla > 12) return null;
      return { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: ancla, dia };
    }
    case 'anual1pago': {
      const mes1 = parseInt(form.mesAnual1, 10);
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      if (isNaN(mes1) || mes1 < 1 || mes1 > 12) return null;
      return { tipo: 'anualMesesConcretos', mesesPago: [mes1], diaPago: dia };
    }
    case 'anual2pagos': {
      const mes2a = parseInt(form.mesAnual2a, 10);
      const mes2b = parseInt(form.mesAnual2b, 10);
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      if (isNaN(mes2a) || mes2a < 1 || mes2a > 12) return null;
      if (isNaN(mes2b) || mes2b < 1 || mes2b > 12) return null;
      return { tipo: 'anualMesesConcretos', mesesPago: [mes2a, mes2b], diaPago: dia };
    }
    default:
      return null;
  }
}

function buildImporte(form: FormState): ImporteEvento | null {
  switch (form.modoImporte) {
    case 'fijo': {
      const imp = parseFloat(form.importeFijo);
      if (isNaN(imp) || imp <= 0) return null;
      return { modo: 'fijo', importe: imp };
    }
    case 'variable': {
      const imp = parseFloat(form.importeVariable);
      if (isNaN(imp) || imp <= 0) return null;
      return { modo: 'variable', importeMedio: imp };
    }
    case 'estacional': {
      const vals = form.importesEstacionales.map((v) => {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      });
      if (vals.every((v) => v === 0)) return null;
      return { modo: 'diferenciadoPorMes', importesPorMes: vals };
    }
    default:
      return null;
  }
}

// ─── Errores de validación ───────────────────────────────────────────────────

interface FormErrors {
  tipoGastoValue?: string;
  patronUI?: string;
  diaMes?: string;
  mesInicio?: string;
  modoImporte?: string;
  importeFijo?: string;
  importeVariable?: string;
  importesEstacionales?: string;
  cuentaCargoId?: string;
  bolsa?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.tipoGastoValue) errors.tipoGastoValue = 'Selecciona el tipo de gasto';
  if (!form.patronUI) errors.patronUI = 'Selecciona el patrón de cobro';
  else {
    const dia = parseInt(form.diaMes, 10);
    if (form.patronUI !== 'mensualDiaRelativo') {
      if (isNaN(dia) || dia < 1 || dia > 31) errors.diaMes = 'Día del mes inválido (1-31)';
    }
  }
  if (!form.modoImporte) errors.modoImporte = 'Selecciona el modo de importe';
  else if (form.modoImporte === 'fijo') {
    const imp = parseFloat(form.importeFijo);
    if (isNaN(imp) || imp <= 0) errors.importeFijo = 'Introduce un importe válido mayor que 0';
  } else if (form.modoImporte === 'variable') {
    const imp = parseFloat(form.importeVariable);
    if (isNaN(imp) || imp <= 0) errors.importeVariable = 'Introduce un importe medio válido mayor que 0';
  } else if (form.modoImporte === 'estacional') {
    const vals = form.importesEstacionales.map((v) => parseFloat(v));
    if (vals.every((v) => isNaN(v) || v === 0)) {
      errors.importesEstacionales = 'Introduce al menos un importe mensual';
    }
  }
  if (!form.cuentaCargoId) errors.cuentaCargoId = 'Selecciona la cuenta de cargo';
  if (!form.bolsa) errors.bolsa = 'Selecciona la bolsa presupuestaria';
  return errors;
}

// ─── Formateo de resumen de patrón ──────────────────────────────────────────

function formatPatronResumen(form: FormState): string {
  if (!form.patronUI) return '—';
  const dia = form.diaMes;
  switch (form.patronUI) {
    case 'mensualDiaFijo': return `Mensual · día ${dia}`;
    case 'mensualDiaRelativo': return `Mensual · ${form.diaRelativo}`;
    case 'bimestral': return `Cada 2 meses · día ${dia} · ancla mes ${form.mesAncla}`;
    case 'trimestral': return `Cada 3 meses · día ${dia} · ancla mes ${form.mesAncla}`;
    case 'anual1pago': return `Anual · ${MESES_LABELS[parseInt(form.mesAnual1, 10) - 1] ?? ''} día ${dia}`;
    case 'anual2pagos':
      return `Anual · 2 pagos · ${MESES_LABELS[parseInt(form.mesAnual2a, 10) - 1] ?? ''} + ${MESES_LABELS[parseInt(form.mesAnual2b, 10) - 1] ?? ''} · día ${dia}`;
    default: return '—';
  }
}

function formatModoImporte(form: FormState): string {
  if (!form.modoImporte) return '—';
  if (form.modoImporte === 'fijo') return `Fijo · ${form.importeFijo || '—'} €`;
  if (form.modoImporte === 'variable') return `Variable medio · ${form.importeVariable || '—'} €`;
  return 'Estacional (12 meses)';
}

// ─── Componente principal ────────────────────────────────────────────────────

const NuevoGastoRecurrentePage: React.FC = () => {
  const navigate = useNavigate();
  useOutletContext<PersonalOutletContext>(); // ensures we're inside PersonalPage Outlet

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number>(1);
  const submitGuard = useRef(false);

  // Load cuentas and personalDataId
  useEffect(() => {
    void cuentasService.list().then(setCuentas);
    void personalDataService.getPersonalData().then((d) => {
      if (d?.id != null) setPersonalDataId(d.id);
    });
  }, []);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-inferir bolsa cuando cambia el tipo de gasto
      if (key === 'tipoGastoValue') {
        const bolsa = inferirBolsa(value as string);
        if (bolsa) next.bolsa = bolsa;
      }
      return next;
    });
    // Clear error for the field
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const setEstacional = useCallback((idx: number, val: string) => {
    setForm((prev) => {
      const arr = [...prev.importesEstacionales];
      arr[idx] = val;
      return { ...prev, importesEstacionales: arr };
    });
    setErrors((prev) => ({ ...prev, importesEstacionales: undefined }));
  }, []);

  const costeAnual = useMemo(() => calcularCosteAnual(form), [form]);
  const nCargos = cargosAlAnio(form.patronUI);
  const mediaMensual = nCargos > 0 ? costeAnual / 12 : 0;

  const tipoSeleccionado = TIPOS_GASTO.find((t) => t.value === form.tipoGastoValue);
  const cuentaSeleccionada = cuentas.find((c) => String(c.id) === form.cuentaCargoId);

  const handleSubmit = useCallback(async () => {
    if (submitGuard.current) return;
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const patron = buildPatron(form);
    const importe = buildImporte(form);
    if (!patron || !importe || !tipoSeleccionado || !form.bolsa) {
      setErrors(validate(form));
      return;
    }

    submitGuard.current = true;
    setSubmitting(true);

    try {
      const alias = tipoSeleccionado.subtipo
        ? `${tipoSeleccionado.label}${form.proveedor ? ' · ' + form.proveedor : ''}`
        : form.proveedor || tipoSeleccionado.label;

      const metodo: MetodoPagoCompromiso = 'domiciliacion';

      await crearCompromiso({
        ambito: 'personal',
        personalDataId,
        alias,
        tipo: tipoSeleccionado.tipo,
        subtipo: tipoSeleccionado.subtipo,
        proveedor: {
          nombre: form.proveedor || tipoSeleccionado.label,
          nif: form.nif || undefined,
          referencia: form.referencia || undefined,
        },
        patron,
        importe,
        variacion: { tipo: 'sinVariacion' },
        cuentaCargo: parseInt(form.cuentaCargoId, 10),
        conceptoBancario: form.proveedor.toUpperCase() || tipoSeleccionado.label.toUpperCase(),
        metodoPago: metodo,
        categoria: tipoSeleccionado.categoria,
        bolsaPresupuesto: form.bolsa as BolsaPresupuesto,
        responsable: 'titular',
        fechaInicio: new Date().toISOString().slice(0, 10),
        estado: 'activo',
        derivadoDe: { fuente: 'manual' },
      });

      // Regenerar previsiones
      try {
        await regenerateForecastsForward({ force: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[T34] regenerateForecastsForward falló · el compromiso se creó igualmente', err);
        showToastV5('Gasto creado · las previsiones se regenerarán pronto', 'warn');
      }

      showToastV5(`Gasto recurrente creado · ${nCargos} cargos proyectados en Tesorería`, 'success');
      navigate('/personal/gastos');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[T34] error al crear compromiso', err);
      showToastV5(
        `Error al crear el gasto: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
      submitGuard.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [form, tipoSeleccionado, personalDataId, nCargos, navigate]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const gruposTipos = useMemo(() => {
    return GRUPOS_ORDEN.map((grupo) => ({
      grupo,
      opciones: TIPOS_GASTO.filter((t) => t.grupo === grupo),
    }));
  }, []);

  return (
    <div style={styles.page}>
      {/* ── Layout: form + sidebar ─────────────────────────────────── */}
      <div style={styles.layout}>
        {/* ── Formulario principal ───────────────────────────── */}
        <main style={styles.main}>

          {/* Catálogo placeholder banner */}
          <div style={styles.catalogBanner}>
            <span style={styles.catalogBannerText}>
              ¿Quieres ir más rápido?{' '}
              <strong>Cargar catálogo típico de un hogar</strong>
            </span>
            <button
              type="button"
              style={styles.catalogBannerLink}
              onClick={() => showToastV5('Próximamente · catálogo de hogar', 'info')}
            >
              Cargar catálogo →
            </button>
          </div>

          {/* ── Sección 1 · Qué gasto es ──────────────────────── */}
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionNum}>1</span>
              ¿Qué gasto es?
            </h2>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="tipoGastoValue">
                Tipo de gasto <span style={styles.required}>*</span>
              </label>
              <select
                id="tipoGastoValue"
                style={errors.tipoGastoValue ? { ...styles.select, ...styles.selectError } : styles.select}
                value={form.tipoGastoValue}
                onChange={(e) => setField('tipoGastoValue', e.target.value)}
              >
                <option value="">— Selecciona un tipo —</option>
                {gruposTipos.map(({ grupo, opciones }) => (
                  <optgroup key={grupo} label={grupo}>
                    {opciones.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.tipoGastoValue && <span style={styles.errorMsg}>{errors.tipoGastoValue}</span>}
            </div>

            <div style={styles.fieldRow}>
              <div style={{ ...styles.fieldGroup, flex: 2 }}>
                <label style={styles.label} htmlFor="proveedor">
                  Proveedor{' '}
                  <span style={styles.optionalPill}>opcional · ayuda al matching</span>
                </label>
                <input
                  id="proveedor"
                  type="text"
                  style={styles.input}
                  placeholder="ej. Iberdrola, Vodafone, AXA…"
                  value={form.proveedor}
                  onChange={(e) => setField('proveedor', e.target.value)}
                />
              </div>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label} htmlFor="nif">
                  CIF / NIF <span style={styles.optionalPill}>opcional</span>
                </label>
                <input
                  id="nif"
                  type="text"
                  style={styles.input}
                  placeholder="A12345678"
                  value={form.nif}
                  onChange={(e) => setField('nif', e.target.value)}
                />
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="referencia">
                Referencia / contrato <span style={styles.optionalPill}>opcional</span>
              </label>
              <input
                id="referencia"
                type="text"
                style={styles.input}
                placeholder="Número de contrato, CUPS, ID póliza…"
                value={form.referencia}
                onChange={(e) => setField('referencia', e.target.value)}
              />
              <span style={styles.helperText}>
                Si tu factura tiene un nº de cuenta o contrato · ATLAS lo usará para conciliar mejor
              </span>
            </div>
          </section>

          {/* ── Sección 2 · Cuándo se cobra ───────────────────── */}
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionNum}>2</span>
              ¿Cuándo se cobra?
            </h2>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="patronUI">
                Patrón de cobro <span style={styles.required}>*</span>
              </label>
              <select
                id="patronUI"
                style={errors.patronUI ? { ...styles.select, ...styles.selectError } : styles.select}
                value={form.patronUI}
                onChange={(e) => setField('patronUI', e.target.value as PatronUI)}
              >
                <option value="">— Selecciona un patrón —</option>
                <option value="mensualDiaFijo">Mensual · día fijo</option>
                <option value="mensualDiaRelativo">Mensual · día relativo</option>
                <option value="bimestral">Cada 2 meses · bimestral</option>
                <option value="trimestral">Cada 3 meses · trimestral</option>
                <option value="anual1pago">Anual · 1 pago</option>
                <option value="anual2pagos">Anual · 2 pagos</option>
              </select>
              {errors.patronUI && <span style={styles.errorMsg}>{errors.patronUI}</span>}
            </div>

            {/* Subforms por patrón */}
            {form.patronUI === 'mensualDiaFijo' && (
              <div style={styles.subform}>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="diaMes">Día del mes (1-31) *</label>
                    <input
                      id="diaMes"
                      type="number"
                      min={1}
                      max={31}
                      style={errors.diaMes ? { ...styles.inputSm, ...styles.inputError } : styles.inputSm}
                      value={form.diaMes}
                      onChange={(e) => setField('diaMes', e.target.value)}
                    />
                    {errors.diaMes && <span style={styles.errorMsg}>{errors.diaMes}</span>}
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesInicio">Mes inicio</label>
                    <select
                      id="mesInicio"
                      style={styles.selectSm}
                      value={form.mesInicio}
                      onChange={(e) => setField('mesInicio', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesFin">Mes fin</label>
                    <select
                      id="mesFin"
                      style={styles.selectSm}
                      value={form.mesFin}
                      onChange={(e) => setField('mesFin', e.target.value)}
                    >
                      <option value="">Indefinido</option>
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {form.patronUI === 'mensualDiaRelativo' && (
              <div style={styles.subform}>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="diaRelativo">Referencia del día *</label>
                    <select
                      id="diaRelativo"
                      style={styles.selectSm}
                      value={form.diaRelativo}
                      onChange={(e) => setField('diaRelativo', e.target.value)}
                    >
                      <option value="ultimoHabil">Último hábil</option>
                      <option value="primerHabil">Primer hábil</option>
                      <option value="primerLunes">Primer lunes</option>
                      <option value="segundoLunes">Segundo lunes</option>
                      <option value="tercerLunes">Tercer lunes</option>
                      <option value="ultimoLunes">Último lunes</option>
                      <option value="ultimoViernes">Último viernes</option>
                      <option value="primerViernes">Primer viernes</option>
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesInicio2">Mes inicio</label>
                    <select
                      id="mesInicio2"
                      style={styles.selectSm}
                      value={form.mesInicio}
                      onChange={(e) => setField('mesInicio', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {(form.patronUI === 'bimestral' || form.patronUI === 'trimestral') && (
              <div style={styles.subform}>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="diaMesBi">Día del mes (1-31) *</label>
                    <input
                      id="diaMesBi"
                      type="number"
                      min={1}
                      max={31}
                      style={errors.diaMes ? { ...styles.inputSm, ...styles.inputError } : styles.inputSm}
                      value={form.diaMes}
                      onChange={(e) => setField('diaMes', e.target.value)}
                    />
                    {errors.diaMes && <span style={styles.errorMsg}>{errors.diaMes}</span>}
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesAncla">
                      Mes ancla *
                    </label>
                    <select
                      id="mesAncla"
                      style={styles.selectSm}
                      value={form.mesAncla}
                      onChange={(e) => setField('mesAncla', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesFinBi">Mes fin</label>
                    <select
                      id="mesFinBi"
                      style={styles.selectSm}
                      value={form.mesFin}
                      onChange={(e) => setField('mesFin', e.target.value)}
                    >
                      <option value="">Indefinido</option>
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {form.patronUI === 'anual1pago' && (
              <div style={styles.subform}>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="diaMesA1">Día del mes (1-31) *</label>
                    <input
                      id="diaMesA1"
                      type="number"
                      min={1}
                      max={31}
                      style={errors.diaMes ? { ...styles.inputSm, ...styles.inputError } : styles.inputSm}
                      value={form.diaMes}
                      onChange={(e) => setField('diaMes', e.target.value)}
                    />
                    {errors.diaMes && <span style={styles.errorMsg}>{errors.diaMes}</span>}
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesAnual1">Mes de pago *</label>
                    <select
                      id="mesAnual1"
                      style={styles.selectSm}
                      value={form.mesAnual1}
                      onChange={(e) => setField('mesAnual1', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {form.patronUI === 'anual2pagos' && (
              <div style={styles.subform}>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="diaMesA2">Día del mes (1-31) *</label>
                    <input
                      id="diaMesA2"
                      type="number"
                      min={1}
                      max={31}
                      style={errors.diaMes ? { ...styles.inputSm, ...styles.inputError } : styles.inputSm}
                      value={form.diaMes}
                      onChange={(e) => setField('diaMes', e.target.value)}
                    />
                    {errors.diaMes && <span style={styles.errorMsg}>{errors.diaMes}</span>}
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesAnual2a">Mes 1 *</label>
                    <select
                      id="mesAnual2a"
                      style={styles.selectSm}
                      value={form.mesAnual2a}
                      onChange={(e) => setField('mesAnual2a', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="mesAnual2b">Mes 2 *</label>
                    <select
                      id="mesAnual2b"
                      style={styles.selectSm}
                      value={form.mesAnual2b}
                      onChange={(e) => setField('mesAnual2b', e.target.value)}
                    >
                      {MESES_NUMS.map((m) => (
                        <option key={m} value={m}>{MESES_LABELS[m - 1]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Sección 3 · Cuánto se cobra ───────────────────── */}
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionNum}>3</span>
              ¿Cuánto se cobra?
            </h2>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="modoImporte">
                Modo de importe <span style={styles.required}>*</span>
              </label>
              <select
                id="modoImporte"
                style={errors.modoImporte ? { ...styles.select, ...styles.selectError } : styles.select}
                value={form.modoImporte}
                onChange={(e) => setField('modoImporte', e.target.value as ModoImporte)}
              >
                <option value="">— Selecciona el modo —</option>
                <option value="fijo">Fijo · importe constante cada cargo</option>
                <option value="variable">Variable medio · ATLAS usará una estimación</option>
                <option value="estacional">Estacional · distinto cada mes del año</option>
              </select>
              {errors.modoImporte && <span style={styles.errorMsg}>{errors.modoImporte}</span>}
            </div>

            {form.modoImporte === 'fijo' && (
              <div style={styles.subform}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="importeFijo">
                    Importe €/cargo <span style={styles.required}>*</span>
                  </label>
                  <div style={styles.inputEuroWrapper}>
                    <input
                      id="importeFijo"
                      type="number"
                      min={0.01}
                      step={0.01}
                      style={errors.importeFijo ? { ...styles.inputNum, ...styles.inputError } : styles.inputNum}
                      value={form.importeFijo}
                      onChange={(e) => setField('importeFijo', e.target.value)}
                      placeholder="0,00"
                    />
                    <span style={styles.euroSuffix}>€</span>
                  </div>
                  {errors.importeFijo && <span style={styles.errorMsg}>{errors.importeFijo}</span>}
                </div>
              </div>
            )}

            {form.modoImporte === 'variable' && (
              <div style={styles.subform}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="importeVariable">
                    Importe medio €/cargo <span style={styles.required}>*</span>
                  </label>
                  <div style={styles.inputEuroWrapper}>
                    <input
                      id="importeVariable"
                      type="number"
                      min={0.01}
                      step={0.01}
                      style={errors.importeVariable ? { ...styles.inputNum, ...styles.inputError } : styles.inputNum}
                      value={form.importeVariable}
                      onChange={(e) => setField('importeVariable', e.target.value)}
                      placeholder="0,00"
                    />
                    <span style={styles.euroSuffix}>€</span>
                  </div>
                  {errors.importeVariable && <span style={styles.errorMsg}>{errors.importeVariable}</span>}
                  <span style={styles.helperText}>
                    ATLAS reflejará este importe en cada proyección · al confirmar el cargo real podrás ajustar
                  </span>
                </div>
              </div>
            )}

            {form.modoImporte === 'estacional' && (
              <div style={styles.subform}>
                <div style={styles.estacionalGrid}>
                  {MESES_LABELS.map((mes, idx) => (
                    <div key={mes} style={styles.estacionalCell}>
                      <label style={styles.estacionalLabel}>{mes}</label>
                      <div style={styles.inputEuroWrapper}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          style={styles.inputEstacional}
                          value={form.importesEstacionales[idx]}
                          onChange={(e) => setEstacional(idx, e.target.value)}
                          placeholder="0"
                          aria-label={`Importe ${mes}`}
                        />
                        <span style={styles.euroSuffix}>€</span>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.importesEstacionales && (
                  <span style={styles.errorMsg}>{errors.importesEstacionales}</span>
                )}
                {costeAnual > 0 && (
                  <div style={styles.estacionalResumen}>
                    Total anual: <strong>{costeAnual.toFixed(2)} €</strong>
                    {' · '}
                    Media: <strong>{(costeAnual / 12).toFixed(2)} €/mes</strong>
                    {' · '}
                    Pico:{' '}
                    <strong>
                      {Math.max(
                        ...form.importesEstacionales.map((v) => parseFloat(v) || 0),
                      ).toFixed(2)} €
                    </strong>
                    {' · '}
                    Valle:{' '}
                    <strong>
                      {Math.min(
                        ...form.importesEstacionales.map((v) => parseFloat(v) || 0),
                      ).toFixed(2)} €
                    </strong>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Sección 4 · Dónde se carga y en qué bolsa ─────── */}
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionNum}>4</span>
              ¿Dónde se carga y en qué bolsa?
            </h2>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="cuentaCargoId">
                Cuenta de cargo <span style={styles.required}>*</span>
              </label>
              <select
                id="cuentaCargoId"
                style={errors.cuentaCargoId ? { ...styles.select, ...styles.selectError } : styles.select}
                value={form.cuentaCargoId}
                onChange={(e) => setField('cuentaCargoId', e.target.value)}
              >
                <option value="">— Selecciona una cuenta —</option>
                {cuentas.map((c) => {
                  const label = c.alias || c.banco?.name || c.iban;
                  const saldo = (c as { saldo?: number }).saldo;
                  const saldoStr = saldo != null ? ` · ${saldo.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €` : '';
                  return (
                    <option key={c.id} value={String(c.id)}>
                      {label}{saldoStr}
                    </option>
                  );
                })}
              </select>
              {errors.cuentaCargoId && <span style={styles.errorMsg}>{errors.cuentaCargoId}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Bolsa presupuestaria 50/30/20 <span style={styles.required}>*</span>
              </label>
              <div style={styles.bolsaRow}>
                {(
                  [
                    { value: 'necesidades', label: 'Necesidades', activeStyle: styles.bolsaActivoNavy },
                    { value: 'deseos', label: 'Deseos', activeStyle: styles.bolsaActivoGold },
                    { value: 'ahorroInversion', label: 'Ahorro', activeStyle: styles.bolsaActivoGreen },
                  ] as const
                ).map(({ value, label, activeStyle }) => (
                  <button
                    key={value}
                    type="button"
                    style={
                      form.bolsa === value
                        ? { ...styles.bolsaPill, ...activeStyle }
                        : styles.bolsaPill
                    }
                    onClick={() => setField('bolsa', value)}
                    aria-pressed={form.bolsa === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.bolsa && <span style={styles.errorMsg}>{errors.bolsa}</span>}
            </div>
          </section>

          {/* ── Footer ───────────────────────────────────────── */}
          <div style={styles.footer}>
            <span style={styles.footerHelper}>
              Al guardar · ATLAS proyectará 24 cargos previstos en Tesorería
            </span>
            <div style={styles.footerBtns}>
              <button
                type="button"
                style={styles.btnCancel}
                onClick={() => navigate('/personal/gastos')}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={submitting ? { ...styles.btnSave, opacity: 0.65, cursor: 'not-allowed' } : styles.btnSave}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Guardando…' : (
                  <>
                    <Icons.Check size={14} strokeWidth={2} style={{ marginRight: 6 }} />
                    Guardar y proyectar
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* ── Resumen lateral sticky ─────────────────────────── */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarCard}>
            <h3 style={styles.sidebarTitle}>Resumen</h3>
            <dl style={styles.dl}>
              <dt style={styles.dt}>Tipo</dt>
              <dd style={styles.dd}>{tipoSeleccionado?.label ?? '—'}</dd>

              <dt style={styles.dt}>Proveedor</dt>
              <dd style={styles.dd}>{form.proveedor || '—'}</dd>

              <dt style={styles.dt}>Calendario</dt>
              <dd style={styles.dd}>{formatPatronResumen(form)}</dd>

              <dt style={styles.dt}>Modo importe</dt>
              <dd style={styles.dd}>{formatModoImporte(form)}</dd>

              <dt style={styles.dt}>Cuenta</dt>
              <dd style={styles.dd}>
                {cuentaSeleccionada
                  ? (cuentaSeleccionada.alias || cuentaSeleccionada.banco?.name || cuentaSeleccionada.iban)
                  : '—'}
              </dd>

              <dt style={styles.dt}>Bolsa</dt>
              <dd style={form.bolsa ? { ...styles.dd, ...bolsaColorStyle(form.bolsa) } : styles.dd}>
                {form.bolsa
                  ? ({ necesidades: 'Necesidades', deseos: 'Deseos', ahorroInversion: 'Ahorro', obligaciones: 'Obligaciones', inmueble: 'Inmueble' } as Record<string, string>)[form.bolsa] ?? form.bolsa
                  : '—'}
              </dd>
            </dl>

            <div style={styles.kpiBlock}>
              <div style={styles.kpiLabel}>Coste anual previsto</div>
              <div style={styles.kpiValue}>
                {costeAnual > 0 ? `-${costeAnual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
              </div>
              {costeAnual > 0 && (
                <div style={styles.kpiSub}>
                  media {mediaMensual.toFixed(2)} €/mes{nCargos > 0 ? ` · ${nCargos} cargos` : ''}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ─── Helpers de color bolsa ──────────────────────────────────────────────────

function bolsaColorStyle(bolsa: BolsaPresupuesto | ''): React.CSSProperties {
  switch (bolsa) {
    case 'necesidades': return { color: 'var(--atlas-v5-brand)', fontWeight: 600 };
    case 'deseos': return { color: 'var(--atlas-v5-gold-ink)', fontWeight: 600 };
    case 'ahorroInversion': return { color: 'var(--atlas-v5-pos)', fontWeight: 600 };
    default: return {};
  }
}

// ─── Estilos inline (tokens v5) ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '0 0 80px',
    fontFamily: 'var(--atlas-v5-font-ui)',
  },
  layout: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '16px 16px 0',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
    position: 'sticky',
    top: 80,
  },
  sidebarCard: {
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 10,
    padding: '16px 18px',
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--atlas-v5-ink-4)',
    marginBottom: 12,
  },
  dl: { margin: 0, padding: 0 },
  dt: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: 'var(--atlas-v5-ink-4)',
    marginTop: 10,
    marginBottom: 2,
  },
  dd: {
    fontSize: 12.5,
    color: 'var(--atlas-v5-ink-2)',
    margin: 0,
    wordBreak: 'break-word' as const,
  },
  kpiBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: '1px solid var(--atlas-v5-line)',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: 'var(--atlas-v5-ink-4)',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: 'var(--atlas-v5-font-mono-num)',
    fontWeight: 700,
    color: 'var(--atlas-v5-neg)',
    lineHeight: 1.2,
  },
  kpiSub: {
    fontSize: 11,
    color: 'var(--atlas-v5-ink-4)',
    marginTop: 2,
  },
  catalogBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 16px',
    border: '1.5px dashed var(--atlas-v5-gold-soft)',
    borderRadius: 8,
    background: 'var(--atlas-v5-gold-wash)',
    fontSize: 12.5,
    color: 'var(--atlas-v5-gold-ink)',
    flexWrap: 'wrap' as const,
  },
  catalogBannerText: {
    flex: 1,
    minWidth: 0,
  },
  catalogBannerLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 12.5,
    color: 'var(--atlas-v5-gold-ink)',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--atlas-v5-font-ui)',
    textDecoration: 'underline',
    whiteSpace: 'nowrap' as const,
  },
  card: {
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderTop: '4px solid var(--atlas-v5-gold)',
    borderRadius: 10,
    padding: '20px 22px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--atlas-v5-ink)',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sectionNum: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'var(--atlas-v5-gold-wash)',
    color: 'var(--atlas-v5-gold-ink)',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginBottom: 14,
  },
  fieldRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--atlas-v5-ink-3)',
  },
  required: {
    color: 'var(--atlas-v5-neg)',
    marginLeft: 2,
  },
  optionalPill: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    background: 'var(--atlas-v5-brand-wash)',
    color: 'var(--atlas-v5-brand)',
    padding: '1px 6px',
    borderRadius: 4,
    marginLeft: 4,
    verticalAlign: 'middle' as const,
  },
  select: {
    height: 34,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    fontFamily: 'var(--atlas-v5-font-ui)',
    width: '100%',
  },
  selectError: {
    borderColor: 'var(--atlas-v5-neg)',
  },
  selectSm: {
    height: 34,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '0 8px',
    fontSize: 12.5,
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    fontFamily: 'var(--atlas-v5-font-ui)',
    minWidth: 90,
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
  inputSm: {
    height: 34,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '0 8px',
    fontSize: 13,
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    fontFamily: 'var(--atlas-v5-font-ui)',
    width: 80,
  },
  inputError: {
    borderColor: 'var(--atlas-v5-neg)',
  },
  inputNum: {
    height: 34,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 6,
    padding: '0 8px',
    fontSize: 14,
    fontFamily: 'var(--atlas-v5-font-mono-num)',
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    width: 130,
  },
  inputEstacional: {
    height: 30,
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 4,
    padding: '0 4px',
    fontSize: 12,
    fontFamily: 'var(--atlas-v5-font-mono-num)',
    color: 'var(--atlas-v5-ink-2)',
    background: 'var(--atlas-v5-card)',
    width: 64,
  },
  inputEuroWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  euroSuffix: {
    fontSize: 13,
    color: 'var(--atlas-v5-ink-4)',
    fontFamily: 'var(--atlas-v5-font-mono-num)',
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
  subform: {
    background: 'var(--atlas-v5-gold-wash)',
    border: '1px solid var(--atlas-v5-gold-light)',
    borderRadius: 7,
    padding: '14px 16px',
    marginBottom: 12,
  },
  estacionalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
  },
  estacionalCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  },
  estacionalLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: 'var(--atlas-v5-ink-4)',
    textAlign: 'center' as const,
  },
  estacionalResumen: {
    marginTop: 10,
    fontSize: 12,
    color: 'var(--atlas-v5-ink-3)',
    padding: '8px 10px',
    background: 'var(--atlas-v5-card)',
    borderRadius: 6,
    border: '1px solid var(--atlas-v5-line)',
  },
  bolsaRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  bolsaPill: {
    padding: '8px 18px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    border: '1.5px solid var(--atlas-v5-line)',
    background: 'var(--atlas-v5-card-alt)',
    color: 'var(--atlas-v5-ink-3)',
    cursor: 'pointer',
    fontFamily: 'var(--atlas-v5-font-ui)',
    transition: 'all 0.15s',
  },
  bolsaActivoNavy: {
    background: 'var(--atlas-v5-brand)',
    borderColor: 'var(--atlas-v5-brand)',
    color: 'var(--atlas-v5-white)',
  },
  bolsaActivoGold: {
    background: 'var(--atlas-v5-gold)',
    borderColor: 'var(--atlas-v5-gold)',
    color: 'var(--atlas-v5-white)',
  },
  bolsaActivoGreen: {
    background: 'var(--atlas-v5-pos)',
    borderColor: 'var(--atlas-v5-pos)',
    color: 'var(--atlas-v5-white)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '16px 22px',
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 10,
    flexWrap: 'wrap' as const,
  },
  footerHelper: {
    fontSize: 12,
    color: 'var(--atlas-v5-ink-4)',
  },
  footerBtns: {
    display: 'flex',
    gap: 10,
  },
  btnCancel: {
    padding: '9px 20px',
    border: '1.5px solid var(--atlas-v5-line)',
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--atlas-v5-ink-3)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--atlas-v5-font-ui)',
  },
  btnSave: {
    padding: '9px 22px',
    border: '1.5px solid var(--atlas-v5-gold)',
    borderRadius: 7,
    background: 'var(--atlas-v5-gold)',
    color: 'var(--atlas-v5-white)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--atlas-v5-font-ui)',
    display: 'inline-flex',
    alignItems: 'center',
  },
};

export default NuevoGastoRecurrentePage;
