// Panel · "Cómo va el mes" · cinco celdas. Split cobrado/pendiente por `type` +
// `status` de treasuryEvents (nunca por el signo de `amount`, que se guarda en
// positivo · informe FASE A §Cómo va el mes, gate del bug de signo).
// Cierra con el saldo a fin de mes sobre --card-alt (§B.4).

import React from 'react';
import { fmtEur } from './format';
import type { MesVM } from './types';
import styles from './ComoVaElMes.module.css';

export interface ComoVaElMesProps {
  mesNombre: string;
  /** Si false · no hay datos de tesorería → estado vacío. */
  hayDatos: boolean;
  mes: MesVM;
  saldoActual: number;
  onIrTesoreria: () => void;
}

const ComoVaElMes: React.FC<ComoVaElMesProps> = ({
  mesNombre,
  hayDatos,
  mes,
  saldoActual,
  onIrTesoreria,
}) => (
  <section className={styles.sec}>
    <div className={styles.head}>
      <div className={styles.tit}>Cómo va {mesNombre}</div>
      <div className={styles.sub}>lo que ya ha pasado y lo que queda por pasar</div>
    </div>

    {!hayDatos ? (
      <div className={styles.empty}>
        Sin datos de tesorería este mes · conecta tus cuentas para ver el movimiento
        <button className={styles.emptyCta} onClick={onIrTesoreria}>
          ir a Tesorería
        </button>
      </div>
    ) : (
      <div className={styles.mov}>
        <div className={styles.c}>
          <div className={styles.lab}>Ha entrado</div>
          <div className={`${styles.mval} ${styles.pos} mono`}>{fmtEur(mes.haEntrado)}</div>
          <div className={styles.msub}>
            {mes.nEntrado > 0 ? `${mes.nEntrado} ingresos ya cobrados` : 'nada cobrado aún'}
          </div>
        </div>
        <div className={styles.c}>
          <div className={styles.lab}>Queda por entrar</div>
          <div className={`${styles.mval} mono`}>{fmtEur(mes.quedaEntrar)}</div>
          <div className={styles.msub}>
            {mes.nQuedaEntrar > 0 ? `${mes.nQuedaEntrar} ingresos previstos` : 'nada previsto este mes'}
          </div>
        </div>
        <div className={styles.c}>
          <div className={styles.lab}>Ha salido</div>
          <div className={`${styles.mval} ${styles.neg} mono`}>{fmtEur(-mes.haSalido, true)}</div>
          <div className={styles.msub}>
            {mes.nSalido > 0 ? `${mes.nSalido} pagos ya hechos` : 'nada pagado aún'}
          </div>
        </div>
        <div className={styles.c}>
          <div className={styles.lab}>Queda por salir</div>
          <div className={`${styles.mval} ${styles.neg} mono`}>{fmtEur(-mes.quedaSalir, true)}</div>
          <div className={styles.msub}>
            {mes.nQuedaSalir > 0 ? `${mes.nQuedaSalir} pagos previstos` : 'nada previsto este mes'}
          </div>
        </div>
        <div className={`${styles.c} ${styles.cierre}`}>
          <div className={styles.lab}>Saldo a fin de mes</div>
          {mes.saldoFinFiable ? (
            <>
              <div className={`${styles.mval} mono`}>{fmtEur(mes.saldoFin)}</div>
              <div className={styles.msub}>
                hoy tienes {fmtEur(saldoActual)} · no incluye gastos recurrentes aún no generados
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.mval} mono`}>—</div>
              <div className={styles.msub}>
                no fiable · faltan gastos recurrentes por generar
                <button className={styles.emptyCta} onClick={onIrTesoreria}>
                  actualiza en Tesorería
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </section>
);

export default ComoVaElMes;
