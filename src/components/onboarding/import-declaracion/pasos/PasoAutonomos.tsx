/**
 * PasoAutonomos.tsx · Wizard import XML V2 · paso 7 (§ 4.10 · § 7.8).
 * Toggle opt-in + form simplificado + sugerencia de tramo RETA (E1G6/12).
 * Construye opciones.crearActividadAutonoma + opciones.autonomoPrefill.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { sugerenciasAutonomo, construirAutonomoPrefill, type FormAutonomo } from '../prefill';
import { TRAMOS_RETA_2024 } from '../../../../constants/retaTramos';
import styles from '../WizardImportarDeclaracion.module.css';

const PasoAutonomos: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const sug = useMemo(() => sugerenciasAutonomo(s.declaraciones), [s.declaraciones]);
  const [activar, setActivar] = useState(true);
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [form, setForm] = useState<FormAutonomo | null>(sug?.form ?? null);

  useEffect(() => {
    setForm(sug?.form ?? null);
  }, [sug]);

  useEffect(() => {
    if (activar && form) {
      s.setOpciones({ crearActividadAutonoma: true, autonomoPrefill: construirAutonomoPrefill(form) });
    } else {
      s.setOpciones({ crearActividadAutonoma: false, autonomoPrefill: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activar, form]);

  if (!sug || !form) {
    return (
      <>
        <div className={styles.stepTitle}>
          <span className={styles.stepTitleNum}>07</span> Actividad económica detectada
        </div>
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectó actividad autónoma en los XMLs subidos</div>
          <div className={styles.skipSub}>Puedes crearla manualmente en Personal cuando quieras.</div>
        </div>
      </>
    );
  }

  const upd = (patch: Partial<FormAutonomo>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const seleccionarTramo = (indice: number) =>
    upd({ tramoIndice: indice, cuotaMensual: TRAMOS_RETA_2024[indice].cuotaMensual });

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>07</span> Actividad económica detectada
      </div>
      <div className={styles.stepSub}>
        Detectamos actividad autónoma en {form.ejercicio} · IAE {form.iae || 's/IAE'} ·{' '}
        {sug.ingresos.toLocaleString('es-ES')} € de ingresos con modalidad{' '}
        {form.modalidad === 'simplificada' ? 'simplificada' : 'normal'}.
      </div>

      <div
        className={`${styles.toggleRow} ${activar ? styles.on : ''}`}
        onClick={() => setActivar((v) => !v)}
        role="switch"
        aria-checked={activar}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setActivar((v) => !v);
        }}
      >
        <div className={styles.toggleInfo}>
          <div className={styles.toggleLab}>Crear/actualizar actividad activa en Personal</div>
          <div className={styles.toggleSub}>Pre-rellenamos lo detectable · ajustas el tramo RETA y los demás campos</div>
        </div>
        <div className={`${styles.toggleSwitch} ${activar ? styles.on : ''}`}>
          <div className={styles.toggleKnob} />
        </div>
      </div>

      {activar && (
        <>
          <div className={styles.secTitle}>
            Datos de la actividad <span className={styles.count}>IAE {form.iae || '—'}</span>
          </div>
          <div className={styles.fldGrid3} style={{ marginBottom: 14 }}>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Descripción <span className={styles.req}>*</span>
              </label>
              <input
                className={styles.inp}
                placeholder="Ej. Consultoría informática"
                value={form.descripcion}
                onChange={(e) => upd({ descripcion: e.target.value })}
              />
              <div className={styles.fldHint}>XML solo trae epígrafe · introduce descripción</div>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>IAE / epígrafe</label>
              <input className={`${styles.inp} ${styles.mono} ${form.iae ? styles.withSuggestion : ''}`} value={form.iae} readOnly />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldLab}>
                Modalidad IRPF <span className={styles.req}>*</span>
              </label>
              <select
                className={`${styles.inp} ${styles.withSuggestion}`}
                value={form.modalidad}
                onChange={(e) => upd({ modalidad: e.target.value as FormAutonomo['modalidad'] })}
              >
                <option value="simplificada">Estimación directa simplificada</option>
                <option value="normal">Estimación directa normal</option>
              </select>
              <div className={`${styles.fldHint} ${styles.pos}`}>
                Detectado {form.modalidad === 'simplificada' ? 'E1MED=S' : 'E1MED=N'} en {form.ejercicio}
              </div>
            </div>
          </div>

          <div className={styles.secTitle}>
            Cuota SS autónomo · sugerencia tramo
            <span className={styles.count}>{sug.totalRetaAnual.toLocaleString('es-ES')} € anual</span>
          </div>
          <p className={styles.ppNote} style={{ marginBottom: 10 }}>
            ATLAS calcula tu tramo dividiendo el total RETA del año (E1G6) entre 12. Puedes elegir
            otro tramo si has cambiado de base o tienes bonificación.
          </p>

          <div className={styles.retaTramos}>
            {TRAMOS_RETA_2024.map((t, i) => {
              const sel = form.tramoIndice === i;
              const sugerido = sug.sugerenciaReta?.indice === i;
              return (
                <div
                  key={i}
                  className={`${styles.retaTramo} ${sel ? styles.selected : ''} ${sugerido ? styles.suggested : ''}`}
                  onClick={() => seleccionarTramo(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') seleccionarTramo(i);
                  }}
                >
                  <div className={styles.retaTramoRange}>
                    {t.etiqueta}
                    {sugerido ? ' · sugerido' : ''}
                  </div>
                  <div className={styles.retaTramoVal}>{t.cuotaMensual} €/mes</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>El XML solo trae el agregado anual · </strong>
            no aporta clientes ni facturación mes a mes. Añádelos en{' '}
            <strong>Personal · actividad económica</strong>. La cuota RETA mensual y los modelos
            M303/M130/M390 se gestionan desde el <strong>módulo Fiscal</strong>, no aquí.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoAutonomos;
