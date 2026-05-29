/**
 * PasoIBAN.tsx · Wizard import XML V2 · paso 3 (§ 4.6).
 * Decisión por IBAN detectado · crear / vincular / ignorar.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Link2, X, Lightbulb } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import type { IbanAccion } from '../../../../types/opcionesDistribucion';
import styles from '../WizardImportarDeclaracion.module.css';

type Accion = IbanAccion['accion'];

interface IbanDetectado {
  iban: string;
  ejercicios: number[];
  roles: Set<string>;
}

function fmtIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

const PasoIBAN: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  const [acciones, setAcciones] = useState<Record<string, Accion>>({});

  const ibanes = useMemo<IbanDetectado[]>(() => {
    const map = new Map<string, IbanDetectado>();
    for (const d of s.declaraciones) {
      const reg = (iban: string | undefined, rol: string) => {
        if (!iban) return;
        const key = iban.replace(/\s+/g, '');
        const e = map.get(key) ?? { iban: key, ejercicios: [], roles: new Set<string>() };
        if (!e.ejercicios.includes(d.meta.ejercicio)) e.ejercicios.push(d.meta.ejercicio);
        e.roles.add(rol);
        map.set(key, e);
      };
      reg(d.cuentaDevolucion?.iban, 'cobro devolución');
      reg(d.cuentaIngreso?.iban, 'cargo Hacienda');
    }
    return Array.from(map.values()).map((e) => ({
      ...e,
      ejercicios: e.ejercicios.sort((a, b) => a - b),
    }));
  }, [s.declaraciones]);

  // Acción por defecto: crear.
  const accionDe = (iban: string): Accion => acciones[iban] ?? 'crear';

  // Sincronizar a opciones.
  const firma = ibanes.map((i) => i.iban).join(',');
  useEffect(() => {
    if (ibanes.length === 0) return;
    const lista: IbanAccion[] = ibanes.map((i) => ({ iban: i.iban, accion: accionDe(i.iban) }));
    s.setOpciones({ ibanAcciones: lista });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, acciones]);

  const set = (iban: string, accion: Accion) => setAcciones((prev) => ({ ...prev, [iban]: accion }));

  if (ibanes.length === 0) {
    return (
      <>
        <div className={styles.stepTitle}>
          <span className={styles.stepTitleNum}>03</span> Cuentas bancarias en tu declaración
        </div>
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectaron cuentas en los XMLs subidos</div>
          <div className={styles.skipSub}>Puedes configurarlas en Tesorería cuando quieras.</div>
        </div>
      </>
    );
  }

  const pills: { key: Accion; label: string; icon: React.ReactNode }[] = [
    { key: 'crear', label: 'Crear nueva', icon: <Plus size={11} /> },
    { key: 'vincular', label: 'Vincular existente', icon: <Link2 size={11} /> },
    { key: 'ignorar', label: 'Ignorar', icon: <X size={11} /> },
  ];

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>03</span> Cuentas bancarias en tu declaración
      </div>
      <div className={styles.stepSub}>
        Detectamos {ibanes.length} IBAN en los ejercicios subidos · una se usó para cobrar
        devoluciones, otra para pagar a Hacienda. Elige qué hacer con cada una.
      </div>

      <div className={styles.secTitle}>
        IBAN detectados <span className={styles.count}>{ibanes.length}</span>
      </div>

      {ibanes.map((i) => {
        const sel = accionDe(i.iban);
        const ejTxt =
          i.ejercicios.length > 1
            ? `${i.ejercicios.length} ejercicios (${i.ejercicios[0]}-${i.ejercicios[i.ejercicios.length - 1]})`
            : `ejercicio ${i.ejercicios[0]}`;
        return (
          <div key={i.iban} className={styles.inmCard} style={{ marginBottom: 10 }}>
            <div className={styles.inmHead} style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
              <div className={styles.inmId}>
                <div className={styles.inmAlias}>{fmtIban(i.iban)}</div>
                <div className={styles.inmRc}>
                  {ejTxt} · {Array.from(i.roles).join(' · ')}
                </div>
              </div>
              <div className={styles.actionPills}>
                {pills.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`${styles.actionPill} ${sel === p.key ? styles.selected : styles.ghost}`}
                    onClick={() => set(i.iban, p.key)}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {!smartCerrado && (
        <div className={styles.smart} style={{ marginTop: 18 }}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>Por qué solo estas cuentas · </strong>
            el XML AEAT solo trae la cuenta donde Hacienda te devuelve o de la que carga · no trae las
            cuentas de cobro de alquiler ni las de cargo de IBI · esas las configuras en Tesorería
            cuando quieras.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoIBAN;
