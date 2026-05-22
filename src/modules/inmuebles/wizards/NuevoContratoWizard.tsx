import React, { useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  PageHead,
  WizardStepper,
  MoneyValue,
  DateLabel,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { Contract } from '../../../services/db';
import { saveContract, getContract, calculateHabitualEndDate } from '../../../services/contractService';
import { treasuryAPI } from '../../../services/treasuryApiService';
import type { InmueblesOutletContext } from '../InmueblesContext';
import styles from './NuevoContratoWizard.module.css';

type StepKey = 'donde' | 'inquilino' | 'economico' | 'documentos' | 'firma';

interface FormState {
  inmuebleId: number | null;
  habitacionId: string;
  modalidad: 'habitual' | 'temporada' | 'vacacional';
  fechaInicio: string;
  fechaFin: string;
  inquilinoNombre: string;
  inquilinoApellidos: string;
  inquilinoNif: string;
  inquilinoEmail: string;
  inquilinoTelefono: string;
  rentaMensual: string;
  diaPago: string;
  fianzaMensualidades: string;
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';
}

const emptyForm: FormState = {
  inmuebleId: null,
  habitacionId: '',
  modalidad: 'habitual',
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '',
  inquilinoNombre: '',
  inquilinoApellidos: '',
  inquilinoNif: '',
  inquilinoEmail: '',
  inquilinoTelefono: '',
  rentaMensual: '',
  diaPago: '1',
  fianzaMensualidades: '2',
  indexacion: 'ipc',
};

const NuevoContratoWizard: React.FC = () => {
  const navigate = useNavigate();
  const { properties } = useOutletContext<InmueblesOutletContext>();
  const [searchParams] = useSearchParams();
  const initialInmuebleId = (() => {
    const v = searchParams.get('inmueble');
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  const [step, setStep] = useState<StepKey>('donde');
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    inmuebleId: initialInmuebleId,
  });
  const [creando, setCreando] = useState(false);
  const [errorSave, setErrorSave] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const inmuebleSeleccionado = properties.find((p) => p.id === form.inmuebleId);
  const habitacionesTotales = inmuebleSeleccionado?.bedrooms ?? 0;

  const steps = [
    { key: 'donde' as const, title: 'Dónde', sub: 'Inmueble · habitación' },
    { key: 'inquilino' as const, title: 'Inquilino', sub: 'Datos personales' },
    { key: 'economico' as const, title: 'Económico', sub: 'Renta · pago · fianza' },
    { key: 'documentos' as const, title: 'Documentos', sub: 'DNI · contrato' },
    { key: 'firma' as const, title: 'Plantilla y firma', sub: 'Generar' },
  ];

  const canAdvance = (() => {
    switch (step) {
      case 'donde':
        return form.inmuebleId != null && form.fechaInicio.length > 0;
      case 'inquilino':
        return (
          form.inquilinoNombre.length > 0 &&
          form.inquilinoApellidos.length > 0 &&
          form.inquilinoNif.length > 0
        );
      case 'economico':
        return (
          Number(form.rentaMensual) > 0 &&
          Number(form.diaPago) >= 1 &&
          Number(form.diaPago) <= 31
        );
      case 'documentos':
        return true;
      case 'firma':
        return true;
    }
  })();

  const stepIndex = steps.findIndex((s) => s.key === step);
  const isLast = step === 'firma';

  const construirPayloadContrato = async (): Promise<
    Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'documents'>
  > => {
    if (form.inmuebleId == null) {
      throw new Error('Debe seleccionar un inmueble');
    }
    const rentaMensualNum = Number(form.rentaMensual);
    const diaPagoNum = Number(form.diaPago);
    const fianzaMesesNum = Number(form.fianzaMensualidades) || 0;
    if (!Number.isFinite(rentaMensualNum) || rentaMensualNum <= 0) {
      throw new Error('La renta mensual debe ser mayor que 0');
    }
    if (!Number.isFinite(diaPagoNum) || diaPagoNum < 1 || diaPagoNum > 31) {
      throw new Error('El día de cobro debe estar entre 1 y 31');
    }
    if (!form.inquilinoTelefono.trim()) {
      throw new Error('El teléfono del inquilino es obligatorio');
    }
    if (!form.inquilinoEmail.trim()) {
      throw new Error('El email del inquilino es obligatorio');
    }
    const fechaFin = form.fechaFin.trim()
      || (form.modalidad === 'habitual' ? calculateHabitualEndDate(form.fechaInicio) : '');
    if (!fechaFin) {
      throw new Error('La fecha de fin es obligatoria');
    }
    if (new Date(fechaFin) <= new Date(form.fechaInicio)) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    const accounts = await treasuryAPI.accounts.getAccounts();
    const cuentaCobroId = accounts.find((acc) => typeof acc.id === 'number')?.id;
    if (typeof cuentaCobroId !== 'number') {
      throw new Error('Debe seleccionar una cuenta bancaria de cobro');
    }
    const unidadTipo: 'vivienda' | 'habitacion' = form.habitacionId
      ? 'habitacion'
      : 'vivienda';
    return {
      inmuebleId: form.inmuebleId,
      unidadTipo,
      habitacionId: form.habitacionId || undefined,
      modalidad: form.modalidad,
      inquilino: {
        nombre: form.inquilinoNombre.trim(),
        apellidos: form.inquilinoApellidos.trim(),
        dni: form.inquilinoNif.trim(),
        telefono: form.inquilinoTelefono.trim(),
        email: form.inquilinoEmail.trim(),
      },
      fechaInicio: form.fechaInicio,
      fechaFin,
      rentaMensual: rentaMensualNum,
      diaPago: diaPagoNum,
      margenGraciaDias: 5,
      indexacion: form.indexacion,
      historicoIndexaciones: [],
      fianzaMeses: fianzaMesesNum,
      fianzaImporte: Math.round(rentaMensualNum * fianzaMesesNum),
      fianzaEstado: 'retenida',
      cuentaCobroId,
      estadoContrato: 'activo',
    };
  };

  const handleCrearContrato = async (): Promise<void> => {
    if (creando) return;
    setErrorSave(null);
    setCreando(true);
    try {
      const payload = await construirPayloadContrato();
      const id = await saveContract(payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
      if (typeof id !== 'number') {
        throw new Error('saveContract devolvió sin id');
      }
      const verificado = await getContract(id);
      if (!verificado) {
        throw new Error(`Contrato ${id} no se pudo recuperar tras guardar`);
      }
      showToastV5(
        `Contrato creado · ${payload.inquilino.nombre} ${payload.inquilino.apellidos}`.trim(),
        'success',
      );
      navigate('/contratos?tab=activos');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'error desconocido';
      // eslint-disable-next-line no-console
      console.error('[WizardNuevoContrato] error al guardar contrato:', e);
      setErrorSave(`No se pudo guardar el contrato · ${mensaje}`);
      showToastV5('Error al guardar el contrato · vuelve a intentarlo', 'error');
    } finally {
      setCreando(false);
    }
  };

  const handleNext = () => {
    if (!canAdvance) {
      showToastV5('Completa los campos obligatorios para continuar', 'warn');
      return;
    }
    if (isLast) {
      void handleCrearContrato();
      return;
    }
    setStep(steps[stepIndex + 1].key);
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigate(-1);
      return;
    }
    setStep(steps[stepIndex - 1].key);
  };

  const renta = Number(form.rentaMensual) || 0;
  const fianza = Number(form.fianzaMensualidades) || 0;

  return (
    <>
      <PageHead
        breadcrumb={[
          { label: 'Contratos', onClick: () => navigate('/contratos') },
          { label: 'Nuevo' },
        ]}
        onBack={() => navigate('/contratos')}
        title="Nuevo contrato"
        sub="completa los 5 pasos · los cambios se guardan automáticamente como borrador"
      />

      <div style={{ marginBottom: 22 }}>
        <WizardStepper
          steps={steps}
          active={step}
          onChange={(k) => {
            const targetIdx = steps.findIndex((s) => s.key === k);
            // Sólo permitir volver atrás · no saltar adelante.
            if (targetIdx <= stepIndex) setStep(k);
          }}
        />
      </div>

      <div className={styles.wrap}>
        <div className={styles.main}>
          {step === 'donde' && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>1 · Dónde</div>
                <div className={styles.stepSub}>
                  Selecciona el inmueble · habitación si aplica · tipo de contrato y fechas.
                </div>
              </div>
              <div className={styles.fields}>
                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label}>Inmueble</label>
                  <select
                    className={styles.select}
                    value={form.inmuebleId ?? ''}
                    onChange={(e) =>
                      update('inmuebleId', e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">— selecciona inmueble —</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.alias} · {p.address}
                      </option>
                    ))}
                  </select>
                </div>
                {habitacionesTotales > 1 && (
                  <div className={styles.field}>
                    <label className={styles.label}>Habitación</label>
                    <select
                      className={styles.select}
                      value={form.habitacionId}
                      onChange={(e) => update('habitacionId', e.target.value)}
                    >
                      <option value="">— inmueble completo —</option>
                      {Array.from({ length: habitacionesTotales }, (_, i) => (
                        <option key={i} value={`hab-${i + 1}`}>
                          Habitación {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={styles.field}>
                  <label className={styles.label}>Modalidad</label>
                  <select
                    className={styles.select}
                    value={form.modalidad}
                    onChange={(e) => update('modalidad', e.target.value as FormState['modalidad'])}
                  >
                    <option value="habitual">Habitual · LAU 5 años</option>
                    <option value="temporada">Temporada</option>
                    <option value="vacacional">Vacacional</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Fecha inicio</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={form.fechaInicio}
                    onChange={(e) => update('fechaInicio', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Fecha fin</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={form.fechaFin}
                    onChange={(e) => update('fechaFin', e.target.value)}
                  />
                  <span className={styles.help}>
                    Habitual · LAU rellena 5 años · editable.
                  </span>
                </div>
              </div>
            </>
          )}

          {step === 'inquilino' && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>2 · Inquilino</div>
                <div className={styles.stepSub}>
                  Datos personales completos · obligatorios para el contrato.
                </div>
              </div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={form.inquilinoNombre}
                    onChange={(e) => update('inquilinoNombre', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Apellidos</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={form.inquilinoApellidos}
                    onChange={(e) => update('inquilinoApellidos', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>NIF / NIE</label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.inquilinoNif}
                    onChange={(e) => update('inquilinoNif', e.target.value.toUpperCase())}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Teléfono</label>
                  <input
                    type="tel"
                    className={styles.input}
                    value={form.inquilinoTelefono}
                    onChange={(e) => update('inquilinoTelefono', e.target.value)}
                  />
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={form.inquilinoEmail}
                    onChange={(e) => update('inquilinoEmail', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'economico' && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>3 · Económico</div>
                <div className={styles.stepSub}>
                  Renta mensual · día de pago · fianza · indexación.
                </div>
              </div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.label}>Renta mensual (€)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.rentaMensual}
                    onChange={(e) => update('rentaMensual', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Día de pago</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.diaPago}
                    onChange={(e) => update('diaPago', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Fianza (mensualidades)</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.fianzaMensualidades}
                    onChange={(e) => update('fianzaMensualidades', e.target.value)}
                  />
                  <span className={styles.help}>LAU · 2 mensualidades para vivienda habitual.</span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Indexación</label>
                  <select
                    className={styles.select}
                    value={form.indexacion}
                    onChange={(e) => update('indexacion', e.target.value as FormState['indexacion'])}
                  >
                    <option value="none">Sin indexación</option>
                    <option value="ipc">IPC anual</option>
                    <option value="irav">IRAV</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 'documentos' && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>4 · Documentos</div>
                <div className={styles.stepSub}>
                  Listado de tipos de documentos esperados · la subida real
                  llega en sub-tarea follow-up (integración con bandeja Inbox
                  + tipado de documento). Puedes crear el contrato sin docs y
                  adjuntarlos después desde la ficha.
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {[
                  { key: 'dni', label: 'DNI · NIE inquilino', hint: 'PDF · imagen' },
                  { key: 'contrato', label: 'Contrato firmado', hint: 'PDF · plantilla LAU' },
                  { key: 'ingresos', label: 'Justificantes de ingresos', hint: 'nóminas · bancarios' },
                  { key: 'aval', label: 'Aval · si lo hay', hint: 'PDF avalista + DNI' },
                ].map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() =>
                      showToastV5(
                        `Subir ${d.label.toLowerCase()} · sub-tarea follow-up · enlace con bandeja Inbox + tipado documento.`,
                      )
                    }
                    style={{
                      padding: '20px 16px',
                      background: 'var(--atlas-v5-card-alt)',
                      border: '2px dashed var(--atlas-v5-line)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--atlas-v5-ink)',
                        marginBottom: 4,
                      }}
                    >
                      <Icons.Attach
                        size={14}
                        strokeWidth={1.8}
                        style={{ verticalAlign: -2, marginRight: 6 }}
                      />
                      {d.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                      {d.hint} · pendiente
                    </div>
                  </button>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  background: 'var(--atlas-v5-brand-wash)',
                  borderLeft: '3px solid var(--atlas-v5-brand)',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: 'var(--atlas-v5-brand)',
                  lineHeight: 1.55,
                }}
              >
                Atlas guardará el contrato como borrador aunque no subas
                documentos ahora · puedes adjuntarlos después desde la ficha
                (cuando esté disponible la subida real).
              </div>
            </>
          )}

          {step === 'firma' && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>5 · Plantilla y firma</div>
                <div className={styles.stepSub}>
                  Elige plantilla y revisa antes de crear el contrato.
                </div>
              </div>

              <div className={styles.fields}>
                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label}>Plantilla del contrato</label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    {[
                      {
                        key: 'lau-vivienda',
                        title: 'LAU · Vivienda habitual',
                        desc: 'Plantilla estándar 5 años · obligaciones LAU.',
                      },
                      {
                        key: 'lau-temporada',
                        title: 'LAU · Temporada',
                        desc: 'Alquiler temporal · 11 meses · turístico.',
                      },
                      {
                        key: 'local',
                        title: 'Local comercial',
                        desc: 'Uso distinto vivienda · Ley arrendamientos urbanos.',
                      },
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() =>
                          showToastV5(`Plantilla ${p.title} · selección registrada (follow-up persistencia).`)
                        }
                        style={{
                          padding: '12px 14px',
                          background: 'var(--atlas-v5-card)',
                          border: '1px solid var(--atlas-v5-line)',
                          borderRadius: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--atlas-v5-ink)',
                          }}
                        >
                          {p.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--atlas-v5-ink-3)',
                            marginTop: 4,
                          }}
                        >
                          {p.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  background: 'var(--atlas-v5-gold-wash)',
                  borderLeft: '3px solid var(--atlas-v5-gold)',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: 'var(--atlas-v5-gold-ink)',
                  lineHeight: 1.55,
                }}
              >
                Al pulsar <strong>Crear contrato</strong> Atlas lo guarda en estado
                borrador con los datos introducidos. La generación de PDF y la
                firma electrónica con FactorID/Docusign llegan en sub-tarea
                follow-up.
              </div>
            </>
          )}

          {errorSave && (
            <div
              role="alert"
              className={styles.errorAlert}
            >
              {errorSave}
            </div>
          )}

          <div className={styles.footer}>
            <span className={styles.footerNote}>
              Paso {stepIndex + 1} de {steps.length} · cambios guardados como borrador
            </span>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={handleBack}
              >
                <Icons.ChevronLeft size={14} strokeWidth={2} />
                {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGold}`}
                onClick={handleNext}
                disabled={!canAdvance || creando}
                aria-busy={creando || undefined}
              >
                {isLast ? (creando ? 'Creando...' : 'Crear contrato') : 'Siguiente'}
                <Icons.ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.aside}>
          <div className={styles.asideTitle}>Resumen en vivo</div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Inmueble</span>
            <span className={`${styles.asideVal} ${!inmuebleSeleccionado ? styles.muted : ''}`}>
              {inmuebleSeleccionado?.alias ?? '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Modalidad</span>
            <span className={styles.asideVal}>
              {form.modalidad}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Inicio</span>
            <span className={`${styles.asideVal} ${!form.fechaInicio ? styles.muted : ''}`}>
              {form.fechaInicio ? <DateLabel value={form.fechaInicio} format="short" size="sm" /> : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Fin</span>
            <span className={`${styles.asideVal} ${!form.fechaFin ? styles.muted : ''}`}>
              {form.fechaFin ? <DateLabel value={form.fechaFin} format="short" size="sm" /> : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Inquilino</span>
            <span className={`${styles.asideVal} ${!form.inquilinoNombre ? styles.muted : ''}`}>
              {form.inquilinoNombre
                ? `${form.inquilinoNombre} ${form.inquilinoApellidos}`.trim()
                : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Renta mensual</span>
            <span className={`${styles.asideVal} ${renta === 0 ? styles.muted : ''}`}>
              {renta > 0 ? <MoneyValue value={renta} decimals={0} tone="ink" /> : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Renta anual</span>
            <span className={`${styles.asideVal} ${renta === 0 ? styles.muted : ''}`}>
              {renta > 0 ? <MoneyValue value={renta * 12} decimals={0} tone="ink" /> : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Fianza</span>
            <span className={`${styles.asideVal} ${fianza === 0 || renta === 0 ? styles.muted : ''}`}>
              {fianza > 0 && renta > 0 ? (
                <MoneyValue value={renta * fianza} decimals={0} tone="ink" />
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Indexación</span>
            <span className={styles.asideVal}>{form.indexacion}</span>
          </div>
        </aside>
      </div>
    </>
  );
};

export default NuevoContratoWizard;
