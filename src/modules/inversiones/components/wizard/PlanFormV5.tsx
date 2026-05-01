// T23.6.3 · PlanFormV5
//
// Basado en `src/components/personal/planes/PlanForm.tsx` (TAREA 13 v2).
// NO redibujar · solo migrar de AtlasModal a layout v5 (dialog.module.css)
// y añadir prop `tipoAdministrativoInicial` para pre-selección desde el wizard.
//
// Submit sigue escribiendo en `planesPensionesService`. NUNCA inversionesService.
// Cero hex hardcoded · todo vía tokens v5.

import React, { useState, useEffect } from 'react';
import { showToastV5 } from '../../../../design-system/v5';
import { Icons } from '../../../../design-system/v5';
import { planesPensionesService } from '../../../../services/planesPensionesService';
import { getFiscalContextSafe } from '../../../../services/fiscalContextService';
import type { PlanPensiones, TipoAdministrativo, EstadoPlan } from '../../../../types/planesPensiones';
import dialog from '../Dialog.module.css';
import styles from './PlanFormV5.module.css';

interface Props {
  onClose: () => void;
  onSaved: (plan: PlanPensiones) => void;
  plan?: PlanPensiones | null;
  /** Pre-selecciona el tipo administrativo al abrir · usuario puede cambiar. */
  tipoAdministrativoInicial?: TipoAdministrativo;
}

const TIPOS_ADMIN: { value: TipoAdministrativo; label: string; desc: string }[] = [
  { value: 'PPI', label: 'PPI — Individual', desc: 'Aportación libre del titular' },
  { value: 'PPE', label: 'PPE — Empleo', desc: 'Empresa promotora' },
  { value: 'PPES', label: 'PPES — Empleo Simplificado', desc: 'Sectorial / autónomos' },
  { value: 'PPA', label: 'PPA — Asegurado', desc: 'Garantizado por aseguradora' },
];

const emptyForm = (tipoInicial: TipoAdministrativo = 'PPI') => ({
  nombre: '',
  tipoAdministrativo: tipoInicial,
  gestoraActual: '',
  isinActual: '',
  fechaContratacion: new Date().toISOString().split('T')[0],
  importeInicial: '',
  valorActual: '',
  titular: 'yo' as 'yo' | 'pareja',
  estado: 'activo' as EstadoPlan,
});

const PlanFormV5: React.FC<Props> = ({
  onClose,
  onSaved,
  plan,
  tipoAdministrativoInicial = 'PPI',
}) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm(tipoAdministrativoInicial));

  useEffect(() => {
    (async () => {
      try {
        const ctx = await getFiscalContextSafe();
        if (ctx) setPersonalDataId(ctx.personalDataId);
      } catch {/* ignore */}
    })();
  }, []);

  useEffect(() => {
    if (plan) {
      setFormData({
        nombre: plan.nombre,
        tipoAdministrativo: plan.tipoAdministrativo,
        gestoraActual: plan.gestoraActual,
        isinActual: plan.isinActual ?? '',
        fechaContratacion: plan.fechaContratacion,
        importeInicial: plan.importeInicial?.toString() ?? '',
        valorActual: plan.valorActual?.toString() ?? '',
        titular: plan.titular,
        estado: plan.estado,
      });
    } else {
      // Si no hay plan que editar, resetear el form con el tipo inicial de la prop.
      // tipoAdministrativoInicial no se incluye en el array de deps de forma
      // intencionada: solo queremos resetear cuando cambia la visibilidad del
      // form (plan → null), no cada vez que el padre re-renderiza con un prop
      // de tipo diferente; el wizard ya pasa el tipo en el montaje del paso 2.
      setFormData(emptyForm(tipoAdministrativoInicial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Lock scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalDataId) {
      showToastV5('Error: No se encontraron datos personales');
      return;
    }
    if (!formData.nombre.trim() || !formData.gestoraActual.trim() || !formData.fechaContratacion) {
      showToastV5('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const planData: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        nombre: formData.nombre.trim(),
        tipoAdministrativo: formData.tipoAdministrativo,
        gestoraActual: formData.gestoraActual.trim(),
        isinActual: formData.isinActual.trim() || undefined,
        fechaContratacion: formData.fechaContratacion,
        importeInicial: formData.importeInicial ? parseFloat(formData.importeInicial) : undefined,
        valorActual: formData.valorActual ? parseFloat(formData.valorActual) : undefined,
        titular: formData.titular,
        estado: formData.estado,
        origen: 'manual',
      };

      const savedPlan = plan?.id
        ? await planesPensionesService.updatePlan(plan.id, planData)
        : await planesPensionesService.createPlan(planData);

      showToastV5(plan ? 'Plan actualizado.' : 'Plan creado.');
      onSaved(savedPlan);
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] plan save', err);
      showToastV5('Error al guardar el plan de pensiones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={dialog.overlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${dialog.dialog} ${dialog.sizeLg}`}>
        <div className={dialog.header}>
          <div>
            <h2>{plan ? 'Editar plan de pensiones' : 'Nuevo plan de pensiones'}</h2>
          </div>
          <button
            type="button"
            className={dialog.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={dialog.body}>

            {/* Tipo administrativo */}
            <div className={styles.tiposLabel}>Tipo administrativo *</div>
            <div className={styles.tiposGrid}>
              {TIPOS_ADMIN.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.tipoBtn} ${formData.tipoAdministrativo === value ? styles.tipoBtnActive : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, tipoAdministrativo: value }))}
                >
                  <span className={styles.tipoBtnLabel}>{label}</span>
                  <span className={styles.tipoBtnDesc}>{desc}</span>
                </button>
              ))}
            </div>

            {/* Nombre y gestora */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-nombre">Nombre del plan *</label>
                <input
                  id="pf-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Plan Naranja IRPF"
                  required
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-gestora">Entidad gestora *</label>
                <input
                  id="pf-gestora"
                  type="text"
                  value={formData.gestoraActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, gestoraActual: e.target.value }))}
                  placeholder="Ej: ING, Caixabank, Renta 4…"
                  required
                />
              </div>
            </div>

            {/* ISIN y fecha */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-isin">ISIN (opcional)</label>
                <input
                  id="pf-isin"
                  type="text"
                  value={formData.isinActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, isinActual: e.target.value }))}
                  placeholder="Ej: ES0123456789"
                  maxLength={12}
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-fecha">Fecha de apertura *</label>
                <input
                  id="pf-fecha"
                  type="date"
                  value={formData.fechaContratacion}
                  onChange={(e) => setFormData(prev => ({ ...prev, fechaContratacion: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Valores */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-importe-inicial">Valor inicial (€)</label>
                <input
                  id="pf-importe-inicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.importeInicial}
                  onChange={(e) => setFormData(prev => ({ ...prev, importeInicial: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-valor-actual">Valor actual (€)</label>
                <input
                  id="pf-valor-actual"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valorActual}
                  onChange={(e) => setFormData(prev => ({ ...prev, valorActual: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Titular y estado */}
            <div className={dialog.row2}>
              <div className={dialog.field}>
                <label htmlFor="pf-titular">Titular</label>
                <select
                  id="pf-titular"
                  value={formData.titular}
                  onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value as 'yo' | 'pareja' }))}
                >
                  <option value="yo">Yo</option>
                  <option value="pareja">Pareja</option>
                </select>
              </div>
              <div className={dialog.field}>
                <label htmlFor="pf-estado">Estado del plan</label>
                <select
                  id="pf-estado"
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value as EstadoPlan }))}
                >
                  <option value="activo">Activo</option>
                  <option value="rescatado_total">Rescatado (total)</option>
                  <option value="rescatado_parcial">Rescatado (parcial)</option>
                  <option value="traspasado_externo">Traspasado a externo</option>
                </select>
              </div>
            </div>

          </div>

          <div className={dialog.footer}>
            <button
              type="button"
              className={dialog.btnSecondary}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={dialog.btnPrimary}
              disabled={loading}
            >
              {loading ? 'Guardando…' : plan ? 'Actualizar plan' : 'Crear plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanFormV5;
