// El paso 3 del alta de contrato · Económico.
//
// Sale de `NuevoContratoWizard.tsx` por la misma razón por la que en su día
// salieron los helpers: ese fichero tiene un techo de 800 líneas que el
// trinquete vigila (`archivos_800`), y el bloque «Primer cobro» lo pasaba. Que
// el paso viva aparte además le deja sitio: el resto de sus campos (renta,
// fianza, cuenta de cobro, índice) tiene tarea propia pendiente.
//
// Las clases de layout —campos, etiquetas, inputs— siguen siendo las del wizard:
// se importa su `.module.css` en vez de duplicar una hoja que describa la misma
// rejilla. Importarlo, y no recibirlo por props, también es lo que hace que el
// fichero cuente como migrado a v5: el indicador `ficheros_no_v5` mira si el
// `.tsx` consume un module con tokens `--atlas-v5-*`, y un `styles` que entra
// por parámetro le resulta invisible.

import React from 'react';
import type { FormState } from './contratoWizardHelpers';
import { CuentaCobroField } from './CuentaCobroField';
import PrimerCobroSelector from './PrimerCobroSelector';
import BloqueFiscalContrato from './BloqueFiscalContrato';
import styles from './NuevoContratoWizard.module.css';

interface Props {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  cuentas: React.ComponentProps<typeof CuentaCobroField>['cuentas'];
}

export default function PasoEconomico({
  form,
  update,
  cuentas,
}: Props): React.ReactElement {
  return (
    <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>3 · Económico</div>
                <div className={styles.stepSub}>
                  Renta mensual · día de pago · fianza · indexación.
                </div>
              </div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.label}>Renta mensual (€)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.rentaMensual}
                    onChange={(e) => update('rentaMensual', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Día de pago</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.diaPago}
                    onChange={(e) => update('diaPago', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Fianza (mensualidades)</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    step="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={form.fianzaMensualidades}
                    onChange={(e) => update('fianzaMensualidades', e.target.value)}
                  />
                  <span className={styles.help}>LAU · 2 mensualidades para vivienda habitual.</span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Indexación</label>
                  <select
                    className={styles.select}
                    value={form.indexacion}
                    onChange={(e) => update('indexacion', e.target.value as FormState['indexacion'])}
                  >
                    <option value="none">Sin indexación</option>
                    <option value="ipc">IPC anual</option>
                    <option value="irav">IRAV</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
                <CuentaCobroField
                  cuentas={cuentas}
                  value={form.cuentaCobroId}
                  onChange={(v) => update('cuentaCobroId', v)}
                />
                <PrimerCobroSelector
                  rentaMensual={form.rentaMensual}
                  fechaInicio={form.fechaInicio}
                  value={form.primerCobro}
                  onChange={(v) => update('primerCobro', v)}
                />
                <BloqueFiscalContrato
                  modalidad={form.modalidad}
                  onModalidadChange={(m) => update('modalidad', m)}
                  rentaMensual={form.rentaMensual}
                  fechaInicio={form.fechaInicio}
                  value={form.datosFiscales}
                  onChange={(v) => update('datosFiscales', v)}
                />
              </div>
    </>
  );
}
