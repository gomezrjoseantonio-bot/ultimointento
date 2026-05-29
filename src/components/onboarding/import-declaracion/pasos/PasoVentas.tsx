/**
 * PasoVentas.tsx · Wizard import XML V2 · paso 8 (§ 4.11 · § 7.9).
 * Solo inmuebles. Si el XML trajera transmisión de inmueble, ofrecería 1-click
 * para registrarla (opciones.ventasConfirmadas, persistido por Fase B vía
 * confirmPropertySale). Hoy el modelo parseado no expone la transmisión a nivel
 * de inmueble (vive en gananciasPerdidas), por lo que se muestra el empty state
 * honesto del mockup · la detección fina queda como apunte.
 */

import React, { useState } from 'react';
import { Lightbulb, X, Home } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import styles from '../WizardImportarDeclaracion.module.css';

const PasoVentas: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  // Sin detección de venta de inmueble en el modelo actual.
  const ventas = s.opciones.ventasConfirmadas ?? [];

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>08</span> Ventas de inmuebles detectadas
      </div>
      <div className={styles.stepSub}>
        Si detectamos una transmisión patrimonial de inmueble en el XML, te ofrecemos registrarla
        retrospectivamente con pre-relleno del wizard de venta.
      </div>

      {ventas.length === 0 ? (
        <div className={styles.skipEmpty}>
          <div className={styles.skipIcon}>
            <Home size={38} strokeWidth={1.5} />
          </div>
          <div className={styles.skipTitle}>No se detectaron ventas de inmueble en los XMLs subidos</div>
          <div className={styles.skipSub}>
            Si vendiste algún inmueble, regístralo manualmente desde Inmuebles · ATLAS cierra la
            cadena de amortización y libera arrastres.
          </div>
        </div>
      ) : (
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>{ventas.length} venta(s) confirmada(s)</div>
        </div>
      )}

      {!smartCerrado && (
        <div className={styles.smart} style={{ marginTop: 18 }}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>Otras transmisiones (fondos · crypto) · </strong>
            se procesan en el módulo Inversiones, no en este wizard. Aquí solo gestionamos ventas de
            inmueble.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
};

export default PasoVentas;
