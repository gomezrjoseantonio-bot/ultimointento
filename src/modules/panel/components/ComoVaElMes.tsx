// Panel · "Cómo va el mes" · cinco celdas. Split cobrado/pendiente por `type` +
// `status` de treasuryEvents (nunca por el signo de `amount`, que se guarda en
// positivo · informe FASE A §Cómo va el mes, gate del bug de signo).
// Cierra con el saldo a fin de mes sobre --card-alt (§B.4).
//
// Las cuatro celdas de flujo se pueden PULSAR para ver, uno a uno, los apuntes
// que suman a esa cifra (decisión Jose · "si no, no sé si está cuadrado"). El
// detalle sale de las MISMAS poblaciones que el número, así que cuadra solo.

import React, { useState } from 'react';
import { fmtEur } from './format';
import type { FlujosMes, FlujoClave, MesVM } from './types';
import DetalleFlujoModal, { type SignoFlujo } from './DetalleFlujoModal';
import styles from './ComoVaElMes.module.css';

export interface ComoVaElMesProps {
  mesNombre: string;
  /** Si false · no hay datos de tesorería → estado vacío. */
  hayDatos: boolean;
  mes: MesVM;
  /** Apuntes detrás de cada cifra · para el detalle al pulsar. */
  flujos: FlujosMes;
  saldoActual: number;
  onIrTesoreria: () => void;
}

const META: Record<FlujoClave, { titulo: string; signo: SignoFlujo }> = {
  haEntrado: { titulo: 'Ha entrado', signo: 'pos' },
  quedaEntrar: { titulo: 'Queda por entrar', signo: 'neutro' },
  haSalido: { titulo: 'Ha salido', signo: 'neg' },
  quedaSalir: { titulo: 'Queda por salir', signo: 'neg' },
};

const ComoVaElMes: React.FC<ComoVaElMesProps> = ({
  mesNombre,
  hayDatos,
  mes,
  flujos,
  saldoActual,
  onIrTesoreria,
}) => {
  const [abierto, setAbierto] = useState<FlujoClave | null>(null);

  // Props comunes de una celda pulsable (div con semántica de botón · ver CSS).
  const clickable = (clave: FlujoClave) => ({
    className: `${styles.c} ${styles.cClick}`,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Ver detalle de ${META[clave].titulo.toLowerCase()}`,
    onClick: () => setAbierto(clave),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setAbierto(clave);
      }
    },
  });

  return (
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
          <div {...clickable('haEntrado')}>
            <div className={styles.lab}>Ha entrado</div>
            <div className={`${styles.mval} ${styles.pos} mono`}>{fmtEur(mes.haEntrado)}</div>
            <div className={styles.msub}>
              {mes.nEntrado > 0 ? `${mes.nEntrado} ingresos ya cobrados` : 'nada cobrado aún'}
              {mes.nEntrado > 0 ? <span className={styles.hint}> · ver detalle</span> : null}
            </div>
          </div>
          <div {...clickable('quedaEntrar')}>
            <div className={styles.lab}>Queda por entrar</div>
            <div className={`${styles.mval} mono`}>{fmtEur(mes.quedaEntrar)}</div>
            <div className={styles.msub}>
              {mes.nQuedaEntrar > 0 ? `${mes.nQuedaEntrar} ingresos previstos` : 'nada previsto este mes'}
              {mes.nQuedaEntrar > 0 ? <span className={styles.hint}> · ver detalle</span> : null}
            </div>
          </div>
          <div {...clickable('haSalido')}>
            <div className={styles.lab}>Ha salido</div>
            <div className={`${styles.mval} ${styles.neg} mono`}>{fmtEur(-mes.haSalido, true)}</div>
            <div className={styles.msub}>
              {mes.nSalido > 0 ? `${mes.nSalido} pagos ya hechos` : 'nada pagado aún'}
              {mes.nSalido > 0 ? <span className={styles.hint}> · ver detalle</span> : null}
            </div>
          </div>
          <div {...clickable('quedaSalir')}>
            <div className={styles.lab}>Queda por salir</div>
            <div className={`${styles.mval} ${styles.neg} mono`}>{fmtEur(-mes.quedaSalir, true)}</div>
            <div className={styles.msub}>
              {mes.nQuedaSalir > 0 ? `${mes.nQuedaSalir} pagos previstos` : 'nada previsto este mes'}
              {mes.nQuedaSalir > 0 ? <span className={styles.hint}> · ver detalle</span> : null}
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

      {abierto ? (
        <DetalleFlujoModal
          titulo={META[abierto].titulo}
          signo={META[abierto].signo}
          filas={flujos[abierto]}
          onClose={() => setAbierto(null)}
        />
      ) : null}
    </section>
  );
};

export default ComoVaElMes;
