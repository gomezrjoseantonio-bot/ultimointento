import React, { useEffect, useState } from 'react';
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
import { saveContract, getContract, updateContract } from '../../../services/contractService';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  type FormState,
  emptyForm,
  toLocalDate,
  contratoAForm,
  rentaPrefillHabitacion,
} from './contratoWizardHelpers';
import { useHabitacionesContrato } from './useHabitacionesContrato';
import CampoHabitacionContrato from './CampoHabitacionContrato';
import { CuentaCobroField } from './CuentaCobroField';
import { useCuentasCobro } from './cuentaCobro';
import { construirPayloadCompleto, construirPayloadBorrador } from './contratoWizardPayload';
import { vincularAccesorioDesdeContrato } from '../../../services/vinculoAccesorioService';
import CampoAccesorioContrato from './CampoAccesorioContrato';
import styles from './NuevoContratoWizard.module.css';

type StepKey = 'donde' | 'inquilino' | 'economico' | 'documentos' | 'firma';

const NuevoContratoWizard: React.FC = () => {
  const navigate = useNavigate();
  const { properties } = useOutletContext<InmueblesOutletContext>();
  const [searchParams] = useSearchParams();
  // FIX P1 · entrada desde el onboarding · al guardar/cancelar vuelve a /empezar.
  const fromEmpezar = searchParams.get('from') === 'empezar';
  const initialInmuebleId = (() => {
    const v = searchParams.get('inmueble');
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  // Modo edición · `?edit=<id>` · corrige un contrato ya creado.
  const editId = (() => {
    const v = searchParams.get('edit');
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();
  const esEdicion = editId !== null;

  const [step, setStep] = useState<StepKey>('donde');
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    inmuebleId: initialInmuebleId,
  });
  const [creando, setCreando] = useState(false);
  const [errorSave, setErrorSave] = useState<string | null>(null);
  const [accesorioId, setAccesorioId] = useState<number | null>(null); // accesorio que se alquila junto
  // ¿Se puede guardar como borrador? Alta nueva sí; en edición solo si el
  // contrato es aún un borrador (`sin_firmar`) para no degradar uno activo.
  const [permiteBorrador, setPermiteBorrador] = useState(!esEdicion);
  const cuentas = useCuentasCobro();
  // Alta nueva · preselecciona la primera cuenta (en edición manda el prefill).
  useEffect(() => {
    if (esEdicion || cuentas.length === 0) return;
    setForm((p) => (p.cuentaCobroId === '' ? { ...p, cuentaCobroId: String(cuentas[0].id) } : p));
  }, [cuentas, esEdicion]);

  // Prefill del formulario al editar (una vez, al montar con `?edit`).
  useEffect(() => {
    if (editId === null) return;
    let cancelado = false;
    void (async () => {
      try {
        const existente = await getContract(editId);
        if (!cancelado && existente) {
          setForm(contratoAForm(existente));
          setPermiteBorrador(existente.estadoContrato === 'sin_firmar');
        } else if (!cancelado) {
          showToastV5('No se encontró el contrato a editar', 'error');
          navigate('/contratos?tab=vigentes');
        }
      } catch {
        if (!cancelado) showToastV5('No se pudo cargar el contrato', 'error');
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const inmuebleSeleccionado = properties.find((p) => p.id === form.inmuebleId);
  // R3 · habitaciones desde la explotación · pre-rellena la renta objetivo.
  const opcionesHabitacion = useHabitacionesContrato(
    form.inmuebleId,
    inmuebleSeleccionado?.bedrooms ?? 0,
  );
  const seleccionarHabitacion = (habitacionId: string) => {
    update('habitacionId', habitacionId);
    const hab = opcionesHabitacion.find((h) => h.id === habitacionId);
    const prefill = rentaPrefillHabitacion(hab?.rentaObjetivo, form.rentaMensual);
    if (prefill != null) update('rentaMensual', prefill);
  };

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
          Number(form.diaPago) <= 31 &&
          form.cuentaCobroId !== ''
        );
      case 'documentos':
        return true;
      case 'firma':
        return true;
    }
  })();

  const stepIndex = steps.findIndex((s) => s.key === step);
  const isLast = step === 'firma';

  const handleCrearContrato = async (): Promise<void> => {
    if (creando) return;
    setErrorSave(null);
    const res = construirPayloadCompleto(form);
    if (!res.ok) {
      setErrorSave(res.error);
      showToastV5(res.error, 'error');
      return;
    }
    const payload = res.payload;
    setCreando(true);
    try {
      if (esEdicion && editId !== null) {
        // Edición · se actualizan solo los campos editables; NO se toca el
        // estado del ciclo de vida (estadoContrato / firma / histórico de
        // indexaciones / cuenta de cobro / margen de gracia se preservan).
        await updateContract(editId, {
          inmuebleId: payload.inmuebleId,
          unidadTipo: payload.unidadTipo,
          habitacionId: payload.habitacionId,
          modalidad: payload.modalidad,
          inquilino: payload.inquilino,
          fechaInicio: payload.fechaInicio,
          fechaFin: payload.fechaFin,
          rentaMensual: payload.rentaMensual,
          diaPago: payload.diaPago,
          indexacion: payload.indexacion,
          fianzaMeses: payload.fianzaMeses,
          fianzaImporte: payload.fianzaImporte,
        });
        showToastV5(
          `Contrato actualizado · ${payload.inquilino.nombre} ${payload.inquilino.apellidos}`.trim(),
          'success',
        );
        navigate('/contratos?tab=vigentes');
        return;
      }

      const id = await saveContract(payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
      if (typeof id !== 'number') {
        throw new Error('saveContract devolvió sin id');
      }
      const verificado = await getContract(id);
      if (!verificado) {
        throw new Error(`Contrato ${id} no se pudo recuperar tras guardar`);
      }
      const vinculado = await vincularAccesorioDesdeContrato(accesorioId, payload);
      if (!vinculado) showToastV5('Contrato creado, pero el accesorio no se pudo vincular', 'error');
      showToastV5(
        `Contrato creado · ${payload.inquilino.nombre} ${payload.inquilino.apellidos}`.trim(),
        'success',
      );
      // FIX P1/P2 · desde onboarding vuelve a cerrar el bucle (marca el bloque);
      // en uso normal, al listado de activos de siempre.
      navigate(fromEmpezar ? '/empezar/contratos?done=contrato' : '/contratos?tab=activos');
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

  // Borrador · mínimo para que sea localizable en la lista: inmueble + nombre.
  const puedeGuardarBorrador =
    permiteBorrador && form.inmuebleId != null && form.inquilinoNombre.trim() !== '';

  const handleGuardarBorrador = async (): Promise<void> => {
    if (!puedeGuardarBorrador || creando) return;
    setErrorSave(null);
    setCreando(true);
    try {
      const payload = construirPayloadBorrador(form);
      if (esEdicion && editId !== null) {
        await updateContract(editId, payload);
      } else {
        await saveContract(payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
      }
      showToastV5('Borrador guardado · puedes completarlo más tarde', 'success');
      navigate('/contratos?tab=vigentes');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'error desconocido';
      // eslint-disable-next-line no-console
      console.error('[WizardNuevoContrato] error al guardar borrador:', e);
      setErrorSave(`No se pudo guardar el borrador · ${mensaje}`);
      showToastV5('Error al guardar el borrador', 'error');
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
      // FIX P1 · cancelar desde onboarding vuelve al bloque SIN marcar.
      if (fromEmpezar) navigate('/empezar/contratos');
      else navigate(-1);
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
          { label: esEdicion ? 'Editar' : 'Nuevo' },
        ]}
        onBack={() => navigate(fromEmpezar ? '/empezar/contratos' : '/contratos')}
        title={esEdicion ? 'Editar contrato' : 'Nuevo contrato'}
        sub={
          esEdicion
            ? 'corrige los datos del contrato · los cambios se aplican al guardar'
            : 'completa los datos del contrato · revisa el resumen antes de crearlo'
        }
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
                <CampoAccesorioContrato
                  principalId={form.inmuebleId}
                  properties={properties}
                  value={accesorioId}
                  onChange={setAccesorioId}
                />
                <CampoHabitacionContrato
                  opciones={opcionesHabitacion}
                  value={form.habitacionId}
                  onChange={seleccionarHabitacion}
                />
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
                <CuentaCobroField
                  cuentas={cuentas}
                  value={form.cuentaCobroId}
                  onChange={(v) => update('cuentaCobroId', v)}
                />
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
                Puedes adjuntar los documentos más tarde desde la ficha del
                contrato · la subida real llega en una sub-tarea follow-up.
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
                Al pulsar <strong>Crear contrato</strong> Atlas lo guarda con los
                datos introducidos. La generación de PDF y la firma electrónica
                con FactorID/Docusign llegan en sub-tarea follow-up.
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
              Paso {stepIndex + 1} de {steps.length}
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
              {permiteBorrador && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => void handleGuardarBorrador()}
                  disabled={!puedeGuardarBorrador || creando}
                  title={
                    puedeGuardarBorrador
                      ? undefined
                      : 'Necesitas al menos el inmueble y el nombre del inquilino'
                  }
                >
                  Guardar borrador
                </button>
              )}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGold}`}
                onClick={handleNext}
                disabled={!canAdvance || creando}
                aria-busy={creando || undefined}
              >
                {isLast
                  ? creando
                    ? esEdicion
                      ? 'Guardando...'
                      : 'Creando...'
                    : esEdicion
                      ? 'Guardar cambios'
                      : 'Crear contrato'
                  : 'Siguiente'}
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
              {form.fechaInicio ? <DateLabel value={toLocalDate(form.fechaInicio) ?? form.fechaInicio} format="short" size="sm" /> : '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Fin</span>
            <span className={`${styles.asideVal} ${!form.fechaFin ? styles.muted : ''}`}>
              {form.fechaFin ? <DateLabel value={toLocalDate(form.fechaFin) ?? form.fechaFin} format="short" size="sm" /> : '—'}
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
