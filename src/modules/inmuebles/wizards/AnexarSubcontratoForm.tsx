// Gestión delegada · anexar un SUBCONTRATO de inquilino a un contrato de gestión.
// Formulario MÍNIMO (no el wizard LAU): nombre, apellidos, habitación (si el piso
// va por habitaciones), fechas y renta. Sin DNI/fianza/cuenta/firma. Usa el shell
// visual del wizard para verse nativo.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../../design-system/v5';
import type { Contract, Property } from '../../../services/db';
import { saveContract, getContract, updateContract } from '../../../services/contractService';
import type { InmueblesOutletContext } from '../InmueblesContext';
import {
  construirPayloadSubcontrato,
  type AnexarSubcontratoForm as FormState,
} from './anexarSubcontratoPayload';
import styles from './NuevoContratoWizard.module.css';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/** Habitaciones arrendables de un inmueble (H1..Hn) · [] si es piso completo. */
function habitacionesDe(property: Property | undefined): string[] {
  if (!property) return [];
  const porHab = property.modoExplotacion === 'por_habitaciones' || property.modoExplotacion === 'mixto';
  if (!porHab) return [];
  const n = Math.max(1, property.explotacion?.unidadesArrendables ?? property.bedrooms ?? 1);
  return Array.from({ length: n }, (_, i) => `H${i + 1}`);
}

const AnexarSubcontratoForm: React.FC = () => {
  const navigate = useNavigate();
  const { properties } = useOutletContext<InmueblesOutletContext>();
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
    nombre: '',
    apellidos: '',
    dni: '',
    habitacionId: '',
    fechaInicio: hoyISO(),
    fechaFin: '',
    rentaMensual: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (esEdicion && editId != null) {
        const c = await getContract(editId);
        if (!cancelado && c?.id != null) {
          setOriginal(c as Contract & { id: number });
          setForm({
            nombre: c.inquilino?.nombre ?? '',
            apellidos: c.inquilino?.apellidos ?? '',
            dni: c.inquilino?.dni ?? '',
            habitacionId: c.habitacionId ?? '',
            fechaInicio: c.fechaInicio || hoyISO(),
            fechaFin: c.fechaFin ?? '',
            rentaMensual: c.rentaMensual != null ? String(c.rentaMensual) : '',
          });
        }
      } else if (Number.isFinite(padreId)) {
        const c = await getContract(padreId);
        if (!cancelado && c?.id != null) setPadre(c as Contract & { id: number });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esEdicion, editId, padreId]);

  const refInmuebleId = esEdicion ? original?.inmuebleId : padre?.inmuebleId;
  const property = useMemo(
    () => properties.find((p) => p.id === refInmuebleId),
    [properties, refInmuebleId],
  );
  const habitaciones = useMemo(() => habitacionesDe(property), [property]);
  const listo = esEdicion ? original != null : padre != null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (): Promise<void> => {
    // Para validar reutilizamos el builder con un "padre" de referencia (en
    // edición, sintetizado desde el propio subcontrato).
    const padreRef = esEdicion
      ? original && ({ ...original, id: original.gestionPadreId ?? 0 } as Contract & { id: number })
      : padre;
    if (!padreRef) return;
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
          inquilino: p.inquilino,
          unidadTipo: p.unidadTipo,
          habitacionId: p.habitacionId,
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
            {habitaciones.length > 0 ? (
              <div className={styles.field}>
                <label className={styles.label}>Habitación</label>
                <select
                  className={styles.select}
                  value={form.habitacionId}
                  onChange={(e) => set('habitacionId', e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {habitaciones.map((h, i) => (
                    <option key={h} value={h}>
                      Habitación {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.field} aria-hidden="true" />
            )}

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
            <span />
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
    </>
  );
};

export default AnexarSubcontratoForm;
