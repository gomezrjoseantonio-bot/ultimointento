// T23.6.4 · Dialog "Aportar" para planes de pensiones · camino doble.
// Escribe en `aportacionesPlan` (via aportacionesPlanService) y, si hay
// cuenta de cargo, crea un movement + treasuryEvent en los stores de tesorería.
// NO toca inversionesService · NO mueve el valor del plan.

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { initDB } from '../../../services/db';
import type { Account } from '../../../services/db';
import { aportacionesPlanService } from '../../../services/aportacionesPlanService';
import type { PlanPensiones } from '../../../types/planesPensiones';
import styles from './Dialog.module.css';

interface Props {
  plan: PlanPensiones;
  onSaved: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AportacionPlanDialog: React.FC<Props> = ({ plan, onSaved, onClose }) => {
  const [fecha, setFecha] = useState(today());
  const [importeTitular, setImporteTitular] = useState('');
  const [importeEmpresa, setImporteEmpresa] = useState('');
  const [cuentaCargoId, setCuentaCargoId] = useState('');
  const [notas, setNotas] = useState('');
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const esPPEoPPES = plan.tipoAdministrativo === 'PPE' || plan.tipoAdministrativo === 'PPES';

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const all = await db.getAll('accounts');
        setCuentas(all as Account[]);
      } catch {
        setCuentas([]);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const iT = parseFloat(importeTitular) || 0;
    const iE = parseFloat(importeEmpresa) || 0;

    if (iT <= 0 && iE <= 0) {
      errs.importeTitular = 'Introduce al menos un importe (titular o empresa).';
    }
    if (!fecha) errs.fecha = 'La fecha es obligatoria.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const ejercicioFiscal = parseInt(fecha.slice(0, 4), 10);
      const total = iT + iE;
      let movementId: string | undefined;

      // 1 · Camino doble: si hay cuenta de cargo, crear movement + treasuryEvent primero
      if (cuentaCargoId) {
        const accountId = parseInt(cuentaCargoId, 10);
        try {
          const db = await initDB();
          const now = new Date().toISOString();

          // Movement (gasto de tesorería)
          const mvId = await db.add('movements' as any, {
            accountId,
            date: fecha,
            amount: -total,
            description: `Aportación plan pensiones: ${plan.nombre}`,
            type: 'Gasto',
            status: 'Confirmado',
            unifiedStatus: 'confirmado',
            source: 'manual',
            createdAt: now,
            updatedAt: now,
          } as any);

          // TreasuryEvent vinculado al movement
          await db.add('treasuryEvents' as any, {
            type: 'expense',
            amount: total,
            predictedDate: fecha,
            description: `Aportación plan pensiones: ${plan.nombre}`,
            sourceType: 'inversion_aportacion',
            status: 'executed',
            accountId,
            movementId: mvId as number,
            createdAt: now,
            updatedAt: now,
          } as any);

          movementId = String(mvId);
        } catch (mvErr) {
          // eslint-disable-next-line no-console
          console.warn('[inversiones] aportacion plan · movement creation failed (non-fatal)', mvErr);
        }
      }

      // 2 · Escribir en aportacionesPlan (con movementId si se creó)
      await aportacionesPlanService.crearAportacion({
        planId: plan.id,
        fecha,
        ejercicioFiscal,
        importeTitular: iT,
        importeEmpresa: iE,
        origen: 'manual',
        granularidad: 'puntual',
        notas: notas.trim() || undefined,
        movementId,
      });

      onSaved();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion plan', err);
      setErrors({ submit: 'Error al guardar la aportación. Inténtalo de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${styles.sizeSm}`}>
        <div className={styles.header}>
          <div>
            <h2>Aportar al plan</h2>
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
            <div className={`${styles.field} ${errors.fecha ? styles.error : ''}`}>
              <label htmlFor="apd-fecha">Fecha de aportación *</label>
              <input
                id="apd-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              {errors.fecha && <span className={styles.err}>{errors.fecha}</span>}
            </div>

            <div className={styles.row2}>
              <div className={`${styles.field} ${errors.importeTitular ? styles.error : ''}`}>
                <label htmlFor="apd-titular">
                  {esPPEoPPES ? 'Aportación trabajador · €' : 'Aportación titular · €'} *
                </label>
                <input
                  id="apd-titular"
                  type="number"
                  step="0.01"
                  min="0"
                  value={importeTitular}
                  onChange={(e) => setImporteTitular(e.target.value)}
                  placeholder="0.00"
                />
                {errors.importeTitular && <span className={styles.err}>{errors.importeTitular}</span>}
              </div>

              {esPPEoPPES && (
                <div className={styles.field}>
                  <label htmlFor="apd-empresa">Aportación empresa · €</label>
                  <input
                    id="apd-empresa"
                    type="number"
                    step="0.01"
                    min="0"
                    value={importeEmpresa}
                    onChange={(e) => setImporteEmpresa(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="apd-cuenta">Cuenta de cargo (camino doble · opcional)</label>
              <select
                id="apd-cuenta"
                value={cuentaCargoId}
                onChange={(e) => setCuentaCargoId(e.target.value)}
              >
                <option value="">Sin cuenta vinculada…</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c as any).alias || (c as any).iban || `Cuenta #${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="apd-notas">Notas (opcional)</label>
              <textarea
                id="apd-notas"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones…"
              />
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
              {saving ? 'Guardando…' : 'Guardar aportación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AportacionPlanDialog;
