// T23.6.4 · Dialog "Actualizar valoración" para planes de pensiones.
// Escribe en `valoraciones_historicas` (via valoracionesService) y actualiza
// `valorActual` + `fechaUltimaValoracion` en planesPensiones (vía planesPensionesService).
// Única acción autónoma del plan · cero movimiento de dinero.

import React, { useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { valoracionesService } from '../../../services/valoracionesService';
import type { PlanPensiones } from '../../../types/planesPensiones';
import styles from './Dialog.module.css';

interface Props {
  plan: PlanPensiones;
  onSaved: () => void;
  onClose: () => void;
}

const ActualizarValorPlanDialog: React.FC<Props> = ({ plan, onSaved, onClose }) => {
  const valorInicial = plan.valorActual ?? 0;
  const [nuevoValor, setNuevoValor] = useState<number>(valorInicial);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (nuevoValor <= 0) errs.nuevoValor = 'El valor debe ser mayor que 0.';
    if (!fecha) errs.fecha = 'La fecha es obligatoria.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      // Formato YYYY-MM para valoraciones_historicas
      const fechaYYYYMM = fecha.slice(0, 7);

      // valoracionesService.guardarValoracionActivo espera activo_id: number,
      // pero los planes del store planesPensiones usan UUIDs (strings).
      // El servicio y la DB tratan el campo como opaco · la búsqueda usa
      // String(v.activo_id) === planId (ver planesPensionesService.eliminarPlan).
      await valoracionesService.guardarValoracionActivo(fechaYYYYMM, {
        tipo_activo: 'plan_pensiones',
        activo_id: plan.id as unknown as number, // UUID almacenado como string
        activo_nombre: plan.nombre,
        valor: nuevoValor,
      });

      // 2 · Actualizar valorActual y fechaUltimaValoracion en el plan
      await planesPensionesService.updatePlan(plan.id, {
        valorActual: nuevoValor,
        fechaUltimaValoracion: fecha,
      });

      onSaved();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] actualizar valor plan', err);
      setErrors({ submit: 'Error al guardar la valoración. Inténtalo de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${styles.sizeSm}`}>
        <div className={styles.header}>
          <div>
            <h2>Actualizar valoración</h2>
            <div className={styles.sub}>{plan.nombre}</div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <div className={`${styles.field} ${errors.nuevoValor ? styles.error : ''}`}>
              <label htmlFor="vpd-valor">Nuevo valor actual · €</label>
              <input
                id="vpd-valor"
                type="number"
                step="0.01"
                min="0.01"
                value={nuevoValor || ''}
                onChange={(e) => setNuevoValor(parseFloat(e.target.value) || 0)}
                placeholder={valorInicial > 0 ? String(valorInicial) : '10000.00'}
              />
              {errors.nuevoValor && <span className={styles.err}>{errors.nuevoValor}</span>}
            </div>

            <div className={`${styles.field} ${errors.fecha ? styles.error : ''}`}>
              <label htmlFor="vpd-fecha">Fecha de valoración</label>
              <input
                id="vpd-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              {errors.fecha && <span className={styles.err}>{errors.fecha}</span>}
            </div>

            {errors.submit && (
              <div className={styles.err} style={{ marginTop: 8 }}>{errors.submit}</div>
            )}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActualizarValorPlanDialog;
