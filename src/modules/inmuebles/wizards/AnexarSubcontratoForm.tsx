// Gestión delegada · anexar un SUBCONTRATO de inquilino a un contrato de gestión.
// Formulario MÍNIMO (no el wizard LAU): nombre, apellidos, habitación (si el piso
// va por habitaciones), fechas y renta. Sin DNI/fianza/cuenta/firma. Usa el shell
// visual del wizard para verse nativo.

import React, { useEffect, useMemo, useState } from 'react';
import { NOMBRE_SUBTIPO, SUBTIPOS_ALQUILER, normalizarSubtipo } from '../../../services/db/types-alquiler';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../../design-system/v5';
import type { Contract, Property } from '../../../services/db';
import { saveContract, getContract, updateContract, deleteContractWithCascade } from '../../../services/contractService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  construirPayloadSubcontrato,
  type AnexarSubcontratoForm as FormState,
} from './anexarSubcontratoPayload';
import styles from './NuevoContratoWizard.module.css';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Habitaciones de un inmueble como ids canónicos `hab-1..hab-N`, EXACTAMENTE como
 * el wizard normal (NuevoContratoWizard): la cuenta sale de `property.bedrooms` y
 * el selector solo tiene sentido con más de una. Mismo esquema de id → misma
 * ocupación y misma etiqueta que el resto de contratos (sin texto libre).
 */
function habitacionesDe(property: Property | undefined): string[] {
  const n = property?.bedrooms ?? 0;
  if (n <= 1) return [];
  return Array.from({ length: n }, (_, i) => `hab-${i + 1}`);
}

/** Piso con contrato de gestión · datos que necesita el subcontrato de su padre. */
interface PisoGestion {
  padreId: number;
  inmuebleId: number;
  diaPago: number;
}

const AnexarSubcontratoForm: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();
  const [searchParams] = useSearchParams();
  const padreId = Number(searchParams.get('padre'));
  const editId = (() => {
    const v = searchParams.get('edit');
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  })();
  const esEdicion = editId !== null;

  // Alta: cargamos el contrato de gestión (padre). Edición: cargamos el propio
  // subcontrato y lo prefijamos.
  const [padre, setPadre] = useState<(Contract & { id: number }) | null>(null);
  const [original, setOriginal] = useState<(Contract & { id: number }) | null>(null);
  const [form, setForm] = useState<FormState>({
    inmuebleId: null,
    nombre: '',
    apellidos: '',
    dni: '',
    modalidad: 'larga_estancia',
    habitacionId: '',
    fechaInicio: hoyISO(),
    fechaFin: '',
    rentaMensual: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (esEdicion && editId != null) {
        const c = await getContract(editId);
        if (!cancelado && c?.id != null) {
          setOriginal(c as Contract & { id: number });
          setForm({
            inmuebleId: c.inmuebleId ?? null,
            nombre: c.inquilino?.nombre ?? '',
            apellidos: c.inquilino?.apellidos ?? '',
            dni: c.inquilino?.dni ?? '',
            modalidad: normalizarSubtipo(c.modalidad) ?? 'larga_estancia',
            habitacionId: c.habitacionId ?? '',
            fechaInicio: c.fechaInicio || hoyISO(),
            fechaFin: c.fechaFin ?? '',
            rentaMensual: c.rentaMensual != null ? String(c.rentaMensual) : '',
          });
        }
      } else if (Number.isFinite(padreId)) {
        const c = await getContract(padreId);
        if (!cancelado && c?.id != null) {
          setPadre(c as Contract & { id: number });
          setForm((f) => ({ ...f, inmuebleId: c.inmuebleId ?? null }));
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esEdicion, editId, padreId]);

  // Pisos con contrato de gestión (un subcontrato solo puede colgar de uno). Se
  // arma desde el contexto y se garantiza que el piso actual esté presente.
  const pisosGestion = useMemo(() => {
    const map = new Map<number, PisoGestion>();
    for (const cc of contracts) {
      if (cc.gestion != null && cc.id != null && cc.inmuebleId != null && !map.has(cc.inmuebleId))
        map.set(cc.inmuebleId, { padreId: cc.id, inmuebleId: cc.inmuebleId, diaPago: cc.diaPago ?? 1 });
    }
    if (padre?.id != null && padre.inmuebleId != null && !map.has(padre.inmuebleId))
      map.set(padre.inmuebleId, { padreId: padre.id, inmuebleId: padre.inmuebleId, diaPago: padre.diaPago ?? 1 });
    if (original?.inmuebleId != null && original.gestionPadreId != null && !map.has(original.inmuebleId))
      map.set(original.inmuebleId, {
        padreId: original.gestionPadreId,
        inmuebleId: original.inmuebleId,
        diaPago: original.diaPago ?? 1,
      });
    return map;
  }, [contracts, padre, original]);

  const property = useMemo(
    () => properties.find((p) => p.id === form.inmuebleId),
    [properties, form.inmuebleId],
  );
  const habitaciones = useMemo(() => habitacionesDe(property), [property]);
  const padreSel = form.inmuebleId != null ? pisosGestion.get(form.inmuebleId) : undefined;
  const listo = esEdicion ? original != null : padre != null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));

  // Cambiar de piso resetea la unidad (las habitaciones son propias de cada piso).
  const cambiarInmueble = (id: number): void => {
    setForm((f) => ({ ...f, inmuebleId: id, habitacionId: '' }));
  };

  const onSubmit = async (): Promise<void> => {
    if (!padreSel) {
      setError('Selecciona un inmueble con contrato de gestión');
      return;
    }
    const padreRef = {
      id: padreSel.padreId,
      inmuebleId: padreSel.inmuebleId,
      diaPago: padreSel.diaPago,
    } as Contract & { id: number };
    setError(null);
    const res = construirPayloadSubcontrato(form, padreRef);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardando(true);
    try {
      if (esEdicion && original) {
        const p = res.payload;
        await updateContract(original.id, {
          inmuebleId: p.inmuebleId,
          gestionPadreId: p.gestionPadreId,
          inquilino: p.inquilino,
          unidadTipo: p.unidadTipo,
          habitacionId: p.habitacionId,
          modalidad: p.modalidad,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          rentaMensual: p.rentaMensual,
        });
        showToastV5('Contrato de inquilino actualizado');
      } else {
        await saveContract(res.payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
        showToastV5('Contrato de inquilino anexado');
      }
      navigate('/contratos?tab=vigentes');
    } catch {
      setError('No se pudo guardar el contrato. Inténtalo de nuevo.');
      setGuardando(false);
    }
  };

  // Eliminar el subcontrato · imprescindible cuando se anexó al piso equivocado y
  // no hay otro piso con gestión al que re-vincularlo.
  const eliminar = async (): Promise<void> => {
    if (!original) return;
    setConfirmarBorrado(false);
    setGuardando(true);
    try {
      await deleteContractWithCascade(original.id);
      showToastV5('Contrato de inquilino eliminado');
      navigate('/contratos?tab=vigentes');
    } catch {
      setError('No se pudo eliminar el contrato. Inténtalo de nuevo.');
      setGuardando(false);
    }
  };

  const pisosOrdenados = useMemo(
    () => [...pisosGestion.values()].sort((a, b) => a.inmuebleId - b.inmuebleId),
    [pisosGestion],
  );
  const aliasDe = (id: number): string => properties.find((p) => p.id === id)?.alias ?? `Inmueble ${id}`;

  return (
    <>
      <PageHead
        breadcrumb={[
          { label: 'Alquileres', onClick: () => navigate('/contratos') },
          { label: esEdicion ? 'Editar inquilino' : 'Anexar inquilino' },
        ]}
        onBack={() => navigate('/contratos')}
        title={esEdicion ? 'Editar contrato de inquilino' : 'Anexar contrato de inquilino'}
        sub="registro del contrato que la agencia firma en tu nombre"
      />

      <div className={styles.wrap}>
        <div className={styles.main}>
          <div className={styles.stepHeader}>
            <div className={styles.stepTitle}>Datos del inquilino</div>
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label}>Inmueble</label>
              <select
                className={styles.select}
                aria-label="Inmueble"
                value={form.inmuebleId ?? ''}
                onChange={(e) => cambiarInmueble(Number(e.target.value))}
              >
                {form.inmuebleId == null && <option value="">—</option>}
                {pisosOrdenados.map((p) => (
                  <option key={p.inmuebleId} value={p.inmuebleId}>
                    {aliasDe(p.inmuebleId)}
                  </option>
                ))}
              </select>
              <span className={styles.help}>El piso al que la agencia lo anexa (con gestión).</span>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Tipo de alquiler</label>
              <select
                className={styles.select}
                value={form.modalidad}
                onChange={(e) => set('modalidad', e.target.value as FormState['modalidad'])}
              >
                {SUBTIPOS_ALQUILER.map((s) => (
                  <option key={s} value={s}>{NOMBRE_SUBTIPO[s]}</option>
                ))}
              </select>
              <span className={styles.help}>Decide la reducción fiscal aplicable.</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input
                className={styles.input}
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Apellidos</label>
              <input
                className={styles.input}
                value={form.apellidos}
                onChange={(e) => set('apellidos', e.target.value)}
                placeholder="Apellidos"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>DNI / NIE</label>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={form.dni}
                onChange={(e) => set('dni', e.target.value)}
                placeholder="Opcional"
              />
              <span className={styles.help}>Opcional · si lo conoces.</span>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Unidad</label>
              {habitaciones.length > 0 ? (
                <select
                  className={styles.select}
                  aria-label="Unidad"
                  value={form.habitacionId}
                  onChange={(e) => set('habitacionId', e.target.value)}
                >
                  <option value="">— inmueble completo —</option>
                  {habitaciones.map((h, i) => (
                    <option key={h} value={h}>
                      Habitación {i + 1}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={styles.input} value="Piso completo" disabled />
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Inicio</label>
              <input
                className={styles.input}
                type="date"
                value={form.fechaInicio}
                onChange={(e) => set('fechaInicio', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Fin</label>
              <input
                className={styles.input}
                type="date"
                value={form.fechaFin}
                onChange={(e) => set('fechaFin', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Renta (€/mes)</label>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.rentaMensual}
                onChange={(e) => set('rentaMensual', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className={styles.field} aria-hidden="true" />
          </div>

          {error && (
            <div role="alert" className={styles.errorAlert}>
              {error}
            </div>
          )}

          <div className={styles.footer}>
            {esEdicion ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setConfirmarBorrado(true)}
                disabled={guardando || original == null}
              >
                <Icons.Delete size={14} strokeWidth={2} />
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className={styles.footerActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => navigate('/contratos')}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGold}`}
                onClick={onSubmit}
                disabled={guardando || !listo}
              >
                <Icons.Check size={14} strokeWidth={2} />
                {guardando
                  ? (esEdicion ? 'Guardando…' : 'Anexando…')
                  : (esEdicion ? 'Guardar cambios' : 'Anexar contrato')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        onConfirm={eliminar}
        title="Eliminar contrato de inquilino"
        message="Se eliminará este subcontrato del piso y sus previsiones de tesorería pendientes. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
};

export default AnexarSubcontratoForm;
