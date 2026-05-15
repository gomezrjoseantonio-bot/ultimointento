/**
 * Bloque 5 · Arrastres manuales · texto info + botón "+ Añadir arrastre
 * manual" que abre un form simple para registrar un arrastre de gastos
 * vía `carryForwardService.registrarArrastre`.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useState } from 'react';
import { initDB } from '../../../../services/db';
import type { Property } from '../../../../services/db';
import { registrarArrastre } from '../../../../services/carryForwardService';
import styles from '../FiscalAccionesPage.module.css';

interface ToastFn {
  (msg: string): void;
}

export interface ArrastresManualesSectionProps {
  showToast?: ToastFn;
}

const ArrastresManualesSection: React.FC<ArrastresManualesSectionProps> = ({ showToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [añoOrigen, setAñoOrigen] = useState<number>(new Date().getFullYear() - 1);
  const [importeExceso, setImporteExceso] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const all = (await db.getAll('properties')) as Property[];
        const activas = all.filter((p) => p.state !== 'baja');
        setProperties(activas);
        if (activas[0]?.id) setPropertyId(activas[0].id);
      } catch { /* OK */ }
    })();
  }, []);

  const notify = (msg: string): void => {
    if (showToast) showToast(msg);
    else console.info('[fiscal acciones]', msg);
  };

  const onSubmit = async () => {
    if (propertyId === null) return;
    const importe = Number(importeExceso.replace(',', '.'));
    if (!Number.isFinite(importe) || importe <= 0) {
      notify('Indica un importe pendiente válido (>0 €).');
      return;
    }
    // El arrastre caduca a los 4 ejercicios desde el de origen. Si ya
    // caducó · avisamos al usuario en lugar de crear un registro que
    // `getCarryForwardsDisponibles` filtrará silenciosamente.
    const añoActual = new Date().getFullYear();
    const expirationYear = añoOrigen + 4;
    if (expirationYear < añoActual) {
      notify(`El arrastre de ${añoOrigen} ya caducó (31/12/${expirationYear}) · no podrá aplicarse.`);
      return;
    }
    setSubmitting(true);
    try {
      // Semántica correcta de registrarArrastre(propId, año, totalIncome,
      // financingAndRepair, excessAmount):
      // · totalIncome = importe   (tope para limitApplied)
      // · financingAndRepair = importe   (mismo importe · es lo arrastrado)
      // · excessAmount = importe   (importe pendiente a deducir)
      // Resultado · limitApplied = min(importe, importe) = importe ·
      // coherente con arrastres generados desde el motor (S-FISCAL-FIXES Fix 1).
      await registrarArrastre(propertyId, añoOrigen, importe, importe, importe);
      notify(
        `Arrastre manual registrado · ${importe.toFixed(2)} € · ejercicio ${añoOrigen}` +
        ` · caduca 31/12/${expirationYear}.`,
      );
      setShowForm(false);
      setImporteExceso('');
    } catch (err) {
      notify('No se pudo registrar el arrastre · ver consola.');
      // eslint-disable-next-line no-console
      console.error('[fiscal acciones] registrarArrastre falló:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const añosOrigen = (() => {
    const hoy = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => hoy - 1 - i);
  })();

  return (
    <>
      <div className={styles.bodyText}>
        Solo necesitas esto si tienes arrastres pendientes de ejercicios que ATLAS no tiene importados. Para los ejercicios con XML AEAT importado, los arrastres se extraen automáticamente.
      </div>

      {!showForm ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => setShowForm(true)}
          disabled={properties.length === 0}
        >
          + Añadir arrastre manual
        </button>
      ) : (
        <>
          <div className={styles.fld}>
            <label className={styles.fldLab} htmlFor="arr-property">Inmueble</label>
            <select
              id="arr-property"
              className={styles.fldSelect}
              value={propertyId ?? ''}
              onChange={(e) => setPropertyId(Number(e.target.value))}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.alias} {p.address ? `· ${p.address}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fld}>
            <label className={styles.fldLab} htmlFor="arr-anio-origen">Ejercicio origen del arrastre</label>
            <select
              id="arr-anio-origen"
              className={styles.fldSelect}
              value={añoOrigen}
              onChange={(e) => setAñoOrigen(Number(e.target.value))}
            >
              {añosOrigen.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className={styles.fld}>
            <label className={styles.fldLab} htmlFor="arr-importe">Importe pendiente de aplicar (€)</label>
            <input
              id="arr-importe"
              type="text"
              inputMode="decimal"
              className={styles.fldInput}
              value={importeExceso}
              onChange={(e) => setImporteExceso(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : 'Registrar arrastre'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => { setShowForm(false); setImporteExceso(''); }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default ArrastresManualesSection;
