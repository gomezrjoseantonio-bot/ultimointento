/**
 * PasoProveedores.tsx · Wizard import XML V2 · paso 4 (§ 4.7).
 * Informativo · sin decisión del usuario · ATLAS creará placeholders con badge
 * "sin nombre" (se crean siempre en Fase A del distribuidor).
 */

import React, { useMemo, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { detectarProveedores } from '../deteccion';
import styles from '../WizardImportarDeclaracion.module.css';

function fmtEuro(n: number): string {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const PasoProveedores: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  const proveedores = useMemo(() => detectarProveedores(s.declaraciones), [s.declaraciones]);

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>04</span> Proveedores detectados en gastos
      </div>
      <div className={styles.stepSub}>
        Estos NIFs aparecen en gastos declarados por inmueble (reparaciones · servicios · mejoras).
        ATLAS los crea como placeholders · puedes nombrarlos y categorizarlos después desde el detalle
        del gasto cuando quieras.
      </div>

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>El XML solo trae el NIF y el importe · </strong>
            no aporta nombre comercial, razón social ni contacto. Cuando vayas al detalle de un gasto
            podrás convertir el NIF en un proveedor con nombre.
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}

      {proveedores.length > 0 ? (
        <>
          <div className={styles.secTitle}>
            Placeholders a crear <span className={styles.count}>{proveedores.length}</span>
          </div>
          <div className={styles.provList}>
            {proveedores.map((p) => (
              <div key={p.nif} className={styles.provItem}>
                <div className={styles.provIcon}>P</div>
                <div className={styles.provNif}>{p.nif}</div>
                <div className={styles.provDesc}>{p.descripcion}</div>
                <div className={styles.provTotal}>{fmtEuro(p.total)}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>No se detectaron proveedores en los gastos</div>
          <div className={styles.skipSub}>Puedes continuar al siguiente paso.</div>
        </div>
      )}
    </>
  );
};

export default PasoProveedores;
