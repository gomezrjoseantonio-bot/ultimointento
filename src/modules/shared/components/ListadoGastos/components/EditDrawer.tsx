import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cuentasService } from '../../../../services/cuentasService';
import { personalDataService } from '../../../../services/personalDataService';
import { actualizarCompromiso } from '../../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../../services/treasuryBootstrapService';
import { showToastV5 } from '../../../../design-system/v5';
import { useFocusTrap } from '../../../../hooks/useFocusTrap';
import type { Account } from '../../../../services/db';
import type {
  BolsaPresupuesto,
  CompromisoRecurrente,
  ImporteEvento,
  MetodoPagoCompromiso,
  PatronRecurrente,
  ReferenciaDiaRelativo,
} from '../../../../types/compromisosRecurrentes';
import type { TipoGasto } from '../TipoGastoSelector/TipoGastoSelector.types';
import { TipoGastoSelector } from '../TipoGastoSelector';
import type { TipoGastoValue } from '../TipoGastoSelector';
import { buildGastoAlias } from '../../utils/compromisoUtils';

type PatronUI =
  | 'mensualDiaFijo'
  | 'mensualDiaRelativo'
  | 'bimestral'
  | 'trimestral'
  | 'anual1pago'
  | 'anual2pagos';

type ModoImporte = 'fijo' | 'variable' | 'estacional';

interface DrawerFormState {
  tipoGastoId: string;
  subtipoId: string;
  nombrePersonalizado: string;
  proveedor: string;
  nif: string;
  referencia: string;
  patronUI: PatronUI | '';
  diaMes: string;
  diaRelativo: string;
  mesAncla: string;
  mesAnual1: string;
  mesAnual2a: string;
  mesAnual2b: string;
  modoImporte: ModoImporte | '';
  importeFijo: string;
  importeVariable: string;
  importesEstacionales: string[];
  cuentaCargoId: string;
  bolsa: BolsaPresupuesto | '';
}

interface DrawerFormErrors {
  tipoGastoId?: string;
  subtipoId?: string;
  nombrePersonalizado?: string;
  patronUI?: string;
  diaMes?: string;
  modoImporte?: string;
  importeFijo?: string;
  importeVariable?: string;
  importesEstacionales?: string;
  cuentaCargoId?: string;
  bolsa?: string;
}

interface EditDrawerProps {
  catalog: TipoGasto[];
  compromiso: CompromisoRecurrente | null;
  mode: 'personal' | 'inmueble';
  onClose: () => void;
  onSaved: (updated: CompromisoRecurrente) => void;
}

const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const BOLSA_LABELS: Record<BolsaPresupuesto, string> = {
  necesidades: 'Necesidades',
  deseos: 'Deseos',
  ahorroInversion: 'Ahorro',
  obligaciones: 'Obligaciones',
  inmueble: 'Inmueble',
};

function initFormFromCompromiso(c: CompromisoRecurrente): DrawerFormState {
  let patronUI: PatronUI | '' = '';
  let diaMes = '5';
  let diaRelativo = 'ultimoHabil';
  let mesAncla = '1';
  let mesAnual1 = '1';
  let mesAnual2a = '6';
  let mesAnual2b = '11';

  const p = c.patron;
  if (p.tipo === 'mensualDiaFijo') {
    patronUI = 'mensualDiaFijo';
    diaMes = String(p.dia);
  } else if (p.tipo === 'mensualDiaRelativo') {
    patronUI = 'mensualDiaRelativo';
    diaRelativo = p.referencia;
  } else if (p.tipo === 'cadaNMeses') {
    patronUI = p.cadaNMeses === 2 ? 'bimestral' : 'trimestral';
    diaMes = String(p.dia);
    mesAncla = String(p.mesAncla);
  } else if (p.tipo === 'anualMesesConcretos') {
    if (p.mesesPago.length === 1) {
      patronUI = 'anual1pago';
      mesAnual1 = String(p.mesesPago[0]);
      diaMes = String(p.diaPago);
    } else if (p.mesesPago.length >= 2) {
      patronUI = 'anual2pagos';
      mesAnual2a = String(p.mesesPago[0]);
      mesAnual2b = String(p.mesesPago[1]);
      diaMes = String(p.diaPago);
    }
  }

  let modoImporte: ModoImporte | '' = '';
  let importeFijo = '';
  let importeVariable = '';
  let importesEstacionales: string[] = Array(12).fill('');

  if (c.importe.modo === 'fijo') {
    modoImporte = 'fijo';
    importeFijo = String(c.importe.importe);
  } else if (c.importe.modo === 'variable') {
    modoImporte = 'variable';
    importeVariable = String(c.importe.importeMedio);
  } else if (c.importe.modo === 'diferenciadoPorMes') {
    modoImporte = 'estacional';
    importesEstacionales = c.importe.importesPorMes.map(String);
  }

  // Try to infer tipoGastoId / subtipoId from tipoFamilia and subtipo
  const tipoGastoId = c.tipoFamilia ?? '';
  const subtipoId = c.subtipo ?? '';

  return {
    tipoGastoId,
    subtipoId,
    nombrePersonalizado: c.alias ?? '',
    proveedor: c.proveedor?.nombre ?? '',
    nif: c.proveedor?.nif ?? '',
    referencia: c.proveedor?.referencia ?? '',
    patronUI,
    diaMes,
    diaRelativo,
    mesAncla,
    mesAnual1,
    mesAnual2a,
    mesAnual2b,
    modoImporte,
    importeFijo,
    importeVariable,
    importesEstacionales,
    cuentaCargoId: c.cuentaCargo != null ? String(c.cuentaCargo) : '',
    bolsa: c.bolsaPresupuesto ?? '',
  };
}

function buildPatronFromForm(form: DrawerFormState): PatronRecurrente | null {
  const dia = parseInt(form.diaMes, 10);
  switch (form.patronUI) {
    case 'mensualDiaFijo':
      if (isNaN(dia) || dia < 1 || dia > 31) return null;
      return { tipo: 'mensualDiaFijo', dia };
    case 'mensualDiaRelativo':
      return { tipo: 'mensualDiaRelativo', referencia: form.diaRelativo as ReferenciaDiaRelativo };
    case 'bimestral': {
      const ancla = parseInt(form.mesAncla, 10);
      if (isNaN(dia) || isNaN(ancla)) return null;
      return { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: ancla, dia };
    }
    case 'trimestral': {
      const ancla = parseInt(form.mesAncla, 10);
      if (isNaN(dia) || isNaN(ancla)) return null;
      return { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: ancla, dia };
    }
    case 'anual1pago': {
      const mes = parseInt(form.mesAnual1, 10);
      if (isNaN(dia) || isNaN(mes)) return null;
      return { tipo: 'anualMesesConcretos', mesesPago: [mes], diaPago: dia };
    }
    case 'anual2pagos': {
      const m2a = parseInt(form.mesAnual2a, 10);
      const m2b = parseInt(form.mesAnual2b, 10);
      if (isNaN(dia) || isNaN(m2a) || isNaN(m2b)) return null;
      return { tipo: 'anualMesesConcretos', mesesPago: [m2a, m2b], diaPago: dia };
    }
    default:
      return null;
  }
}

function buildImporteFromForm(form: DrawerFormState): ImporteEvento | null {
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

function validateForm(form: DrawerFormState, mode: 'personal' | 'inmueble'): DrawerFormErrors {
  const errors: DrawerFormErrors = {};
  if (!form.tipoGastoId) errors.tipoGastoId = 'Selecciona el tipo de gasto';
  if (!form.patronUI) errors.patronUI = 'Selecciona el patrón de cobro';
  else if (form.patronUI !== 'mensualDiaRelativo') {
    const dia = parseInt(form.diaMes, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) errors.diaMes = 'Día del mes inválido (1-31)';
  }
  if (!form.modoImporte) errors.modoImporte = 'Selecciona el modo de importe';
  else if (form.modoImporte === 'fijo') {
    const imp = parseFloat(form.importeFijo);
    if (isNaN(imp) || imp <= 0) errors.importeFijo = 'Introduce un importe válido';
  } else if (form.modoImporte === 'variable') {
    const imp = parseFloat(form.importeVariable);
    if (isNaN(imp) || imp <= 0) errors.importeVariable = 'Introduce un importe medio válido';
  } else if (form.modoImporte === 'estacional') {
    const vals = form.importesEstacionales.map((v) => parseFloat(v));
    if (vals.every((v) => isNaN(v) || v === 0))
      errors.importesEstacionales = 'Introduce al menos un importe mensual';
  }
  if (!form.cuentaCargoId) errors.cuentaCargoId = 'Selecciona la cuenta de cargo';
  if (mode === 'personal' && !form.bolsa) errors.bolsa = 'Selecciona la bolsa presupuestaria';
  return errors;
}

const EditDrawer: React.FC<EditDrawerProps> = ({ catalog, compromiso, mode, onClose, onSaved }) => {
  const [form, setForm] = useState<DrawerFormState>(() =>
    compromiso ? initFormFromCompromiso(compromiso) : ({} as DrawerFormState),
  );
  const [errors, setErrors] = useState<DrawerFormErrors>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [visible, setVisible] = useState(false);
  const submitGuard = useRef(false);
  const focusTrapRef = useFocusTrap(true);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    void cuentasService.list().then(setCuentas);
  }, []);

  useEffect(() => {
    if (compromiso) {
      setForm(initFormFromCompromiso(compromiso));
      setIsDirty(false);
    }
  }, [compromiso]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseAttempt();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const setField = useCallback(<K extends keyof DrawerFormState>(key: K, value: DrawerFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'tipoGastoId') {
        next.subtipoId = '';
        next.nombrePersonalizado = '';
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setIsDirty(true);
  }, []);

  const setEstacional = useCallback((idx: number, val: string) => {
    setForm((prev) => {
      const arr = [...prev.importesEstacionales];
      arr[idx] = val;
      return { ...prev, importesEstacionales: arr };
    });
    setErrors((prev) => ({ ...prev, importesEstacionales: undefined }));
    setIsDirty(true);
  }, []);

  const handleCloseAttempt = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const tipoGastoValue: TipoGastoValue | null = form.tipoGastoId
    ? { tipoId: form.tipoGastoId, subtipoId: form.subtipoId, nombrePersonalizado: form.nombrePersonalizado }
    : null;

  const tipoSeleccionado = useMemo(
    () => catalog.find((t) => t.id === form.tipoGastoId) ?? null,
    [catalog, form.tipoGastoId],
  );
  const subtipoSeleccionado = useMemo(
    () => tipoSeleccionado?.subtipos.find((s) => s.id === form.subtipoId) ?? null,
    [tipoSeleccionado, form.subtipoId],
  );

  const handleSubmit = useCallback(async () => {
    if (!compromiso?.id || submitGuard.current) return;
    const errs = validateForm(form, mode);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const patron = buildPatronFromForm(form);
    const importe = buildImporteFromForm(form);
    if (!patron || !importe) {
      setErrors(validateForm(form, mode));
      return;
    }

    submitGuard.current = true;
    setSubmitting(true);

    try {
      const alias = buildGastoAlias({
        isCustom: (subtipoSeleccionado as { isCustom?: boolean } | null)?.isCustom ?? false,
        nombrePersonalizado: form.nombrePersonalizado,
        subtipoLabel: subtipoSeleccionado?.label,
        tipoLabel: tipoSeleccionado?.label ?? '',
        proveedor: form.proveedor,
      });

      const metodo: MetodoPagoCompromiso = 'domiciliacion';
      const bolsaFinal: BolsaPresupuesto =
        mode === 'inmueble' ? 'inmueble' : (form.bolsa as BolsaPresupuesto) || 'necesidades';

      const payload: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>> = {
        alias,
        tipoFamilia: form.tipoGastoId || undefined,
        subtipo: form.subtipoId || undefined,
        proveedor: {
          nombre: form.proveedor || (tipoSeleccionado?.label ?? ''),
          nif: form.nif || undefined,
          referencia: form.referencia || undefined,
        },
        patron,
        importe,
        cuentaCargo: parseInt(form.cuentaCargoId, 10),
        conceptoBancario: (form.proveedor
          ? form.proveedor
          : (tipoSeleccionado?.label ?? '')
        ).toUpperCase(),
        metodoPago: metodo,
        categoria: form.tipoGastoId && form.subtipoId
          ? `${form.tipoGastoId}.${form.subtipoId}`
          : compromiso.categoria,
        bolsaPresupuesto: bolsaFinal,
      };

      const updated = await actualizarCompromiso(compromiso.id, payload);

      try {
        await regenerateForecastsForward({ force: true });
      } catch {
        showToastV5('Gasto guardado · las previsiones se regenerarán pronto', 'warn');
      }

      showToastV5(`Gasto "${alias}" actualizado`, 'success');
      setIsDirty(false);
      onSaved(updated);
    } catch (err) {
      showToastV5(
        `Error al guardar: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
      submitGuard.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [compromiso, form, mode, tipoSeleccionado, subtipoSeleccionado, onSaved]);

  if (!compromiso) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={handleCloseAttempt}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar gasto: ${compromiso.alias}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: 'var(--atlas-v5-bg)',
          borderLeft: '1px solid var(--atlas-v5-line)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
          fontFamily: 'var(--atlas-v5-font-ui)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--atlas-v5-line)',
            background: 'var(--atlas-v5-card)',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--atlas-v5-ink)' }}>
              Editar gasto recurrente
            </div>
            <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-4)', marginTop: 2 }}>
              {compromiso.alias}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseAttempt}
            aria-label="Cerrar"
            style={closeBtnStyle}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Tipo de gasto */}
          <div style={sectionCard}>
            <div style={sectionTitle}>Tipo de gasto</div>
            <TipoGastoSelector
              catalog={catalog}
              value={tipoGastoValue}
              onChange={(v) => {
                if (!v) {
                  setField('tipoGastoId', '');
                } else {
                  setForm((prev) => ({
                    ...prev,
                    tipoGastoId: v.tipoId,
                    subtipoId: v.subtipoId,
                    nombrePersonalizado: v.nombrePersonalizado ?? '',
                  }));
                  setErrors((prev) => ({ ...prev, tipoGastoId: undefined, subtipoId: undefined }));
                  setIsDirty(true);
                }
              }}
              error={errors.tipoGastoId}
            />
          </div>

          {/* Proveedor */}
          <div style={sectionCard}>
            <div style={sectionTitle}>Proveedor</div>
            <div style={fieldRow}>
              <label style={fieldLabel}>Nombre</label>
              <input
                type="text"
                value={form.proveedor}
                onChange={(e) => setField('proveedor', e.target.value)}
                style={inputStyle}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div style={fieldRow}>
              <label style={fieldLabel}>CIF / NIF</label>
              <input
                type="text"
                value={form.nif}
                onChange={(e) => setField('nif', e.target.value)}
                style={inputStyle}
                placeholder="Opcional"
              />
            </div>
            <div style={fieldRow}>
              <label style={fieldLabel}>Referencia</label>
              <input
                type="text"
                value={form.referencia}
                onChange={(e) => setField('referencia', e.target.value)}
                style={inputStyle}
                placeholder="CUPS / póliza / cliente"
              />
            </div>
          </div>

          {/* Patrón de cobro */}
          <div style={sectionCard}>
            <div style={sectionTitle}>Patrón de cobro</div>
            <div style={fieldRow}>
              <label style={fieldLabel}>Frecuencia</label>
              <select
                value={form.patronUI}
                onChange={(e) => setField('patronUI', e.target.value as PatronUI | '')}
                style={selectStyle}
              >
                <option value="">— Selecciona —</option>
                <option value="mensualDiaFijo">Mensual · día fijo</option>
                <option value="mensualDiaRelativo">Mensual · día relativo</option>
                <option value="bimestral">Bimestral (cada 2 meses)</option>
                <option value="trimestral">Trimestral (cada 3 meses)</option>
                <option value="anual1pago">Anual · 1 pago</option>
                <option value="anual2pagos">Anual · 2 pagos</option>
              </select>
              {errors.patronUI && <div style={errorText}>{errors.patronUI}</div>}
            </div>

            {form.patronUI === 'mensualDiaRelativo' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Día relativo</label>
                <select
                  value={form.diaRelativo}
                  onChange={(e) => setField('diaRelativo', e.target.value)}
                  style={selectStyle}
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
            )}

            {form.patronUI && form.patronUI !== 'mensualDiaRelativo' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Día del mes</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaMes}
                  onChange={(e) => setField('diaMes', e.target.value)}
                  style={inputStyle}
                />
                {errors.diaMes && <div style={errorText}>{errors.diaMes}</div>}
              </div>
            )}

            {(form.patronUI === 'bimestral' || form.patronUI === 'trimestral') && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Mes ancla</label>
                <select
                  value={form.mesAncla}
                  onChange={(e) => setField('mesAncla', e.target.value)}
                  style={selectStyle}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i} value={String(i + 1)}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.patronUI === 'anual1pago' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Mes de pago</label>
                <select
                  value={form.mesAnual1}
                  onChange={(e) => setField('mesAnual1', e.target.value)}
                  style={selectStyle}
                >
                  {MESES_LABELS.map((m, i) => (
                    <option key={i} value={String(i + 1)}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.patronUI === 'anual2pagos' && (
              <>
                <div style={fieldRow}>
                  <label style={fieldLabel}>Primer mes</label>
                  <select
                    value={form.mesAnual2a}
                    onChange={(e) => setField('mesAnual2a', e.target.value)}
                    style={selectStyle}
                  >
                    {MESES_LABELS.map((m, i) => (
                      <option key={i} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={fieldRow}>
                  <label style={fieldLabel}>Segundo mes</label>
                  <select
                    value={form.mesAnual2b}
                    onChange={(e) => setField('mesAnual2b', e.target.value)}
                    style={selectStyle}
                  >
                    {MESES_LABELS.map((m, i) => (
                      <option key={i} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Importe */}
          <div style={sectionCard}>
            <div style={sectionTitle}>Importe</div>
            <div style={fieldRow}>
              <label style={fieldLabel}>Modo</label>
              <select
                value={form.modoImporte}
                onChange={(e) => setField('modoImporte', e.target.value as ModoImporte | '')}
                style={selectStyle}
              >
                <option value="">— Selecciona —</option>
                <option value="fijo">Importe fijo</option>
                <option value="variable">Variable (importe medio)</option>
                <option value="estacional">Estacional (mes a mes)</option>
              </select>
              {errors.modoImporte && <div style={errorText}>{errors.modoImporte}</div>}
            </div>

            {form.modoImporte === 'fijo' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Importe (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.importeFijo}
                  onChange={(e) => setField('importeFijo', e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
                {errors.importeFijo && <div style={errorText}>{errors.importeFijo}</div>}
              </div>
            )}

            {form.modoImporte === 'variable' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Importe medio (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.importeVariable}
                  onChange={(e) => setField('importeVariable', e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
                {errors.importeVariable && <div style={errorText}>{errors.importeVariable}</div>}
              </div>
            )}

            {form.modoImporte === 'estacional' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {MESES_LABELS.map((m, i) => (
                    <div key={i}>
                      <label style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', display: 'block', marginBottom: 2 }}>
                        {m}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.importesEstacionales[i] ?? ''}
                        onChange={(e) => setEstacional(i, e.target.value)}
                        style={{ ...inputStyle, padding: '5px 8px' }}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                {errors.importesEstacionales && (
                  <div style={errorText}>{errors.importesEstacionales}</div>
                )}
              </div>
            )}
          </div>

          {/* Cuenta y bolsa */}
          <div style={sectionCard}>
            <div style={sectionTitle}>Configuración</div>
            <div style={fieldRow}>
              <label style={fieldLabel}>Cuenta de cargo</label>
              <select
                value={form.cuentaCargoId}
                onChange={(e) => setField('cuentaCargoId', e.target.value)}
                style={selectStyle}
              >
                <option value="">— Selecciona —</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {errors.cuentaCargoId && <div style={errorText}>{errors.cuentaCargoId}</div>}
            </div>

            {mode === 'personal' && (
              <div style={fieldRow}>
                <label style={fieldLabel}>Bolsa presupuestaria</label>
                <select
                  value={form.bolsa}
                  onChange={(e) => setField('bolsa', e.target.value as BolsaPresupuesto | '')}
                  style={selectStyle}
                >
                  <option value="">— Selecciona —</option>
                  {(Object.keys(BOLSA_LABELS) as BolsaPresupuesto[]).map((k) => (
                    <option key={k} value={k}>
                      {BOLSA_LABELS[k]}
                    </option>
                  ))}
                </select>
                {errors.bolsa && <div style={errorText}>{errors.bolsa}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '16px 20px',
            borderTop: '1px solid var(--atlas-v5-line)',
            background: 'var(--atlas-v5-card)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleCloseAttempt}
            disabled={submitting}
            style={cancelBtnStyle}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            style={saveBtnStyle}
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Discard confirmation */}
      {showDiscardConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--atlas-v5-card)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 360,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--atlas-v5-ink)',
                marginBottom: 8,
              }}
            >
              ¿Descartar cambios?
            </div>
            <div style={{ fontSize: 13, color: 'var(--atlas-v5-ink-3)', marginBottom: 20 }}>
              Tienes cambios sin guardar. Si cierras ahora se perderán.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                style={cancelBtnStyle}
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                style={{ ...saveBtnStyle, background: 'var(--atlas-v5-neg)', borderColor: 'var(--atlas-v5-neg)' }}
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 6,
  cursor: 'pointer',
  padding: '6px',
  color: 'var(--atlas-v5-ink-3)',
  display: 'flex',
  alignItems: 'center',
};
const sectionCard: React.CSSProperties = {
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 12,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 12,
};
const fieldRow: React.CSSProperties = {
  marginBottom: 10,
};
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--atlas-v5-ink-3)',
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--atlas-v5-ink-2)',
  background: 'var(--atlas-v5-bg)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
};
const errorText: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--atlas-v5-neg)',
  marginTop: 3,
};
const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 6,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const saveBtnStyle: React.CSSProperties = {
  flex: 2,
  padding: '10px 16px',
  border: '1.5px solid var(--atlas-v5-gold)',
  borderRadius: 6,
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default EditDrawer;
