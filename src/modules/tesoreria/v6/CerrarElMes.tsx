// ============================================================================
// Cerrar el mes · VOCABULARIO §6 quater
// ============================================================================
//
// El motor vive en `services/cierreDeMes`. Esto es lo que faltaba: el sitio
// desde donde se cierra. Sin pantalla, el servicio no lo llamaba nadie y un mes
// no se cerraba nunca — con lo que «el cobro está por llegar» y «el cobro no ha
// llegado» seguían siendo lo mismo para el resto de ATLAS.
//
// Las tres reglas son las que pidió Jose *(5 ago 2026: «mes entero, con la
// lista delante y pudiendo reabrir»)*, y aquí se ven las tres:
//
//   · **mes entero** · se cierra un mes, no una cuenta;
//   · **la lista delante** · antes de confirmar se enseña, uno a uno, lo que se
//     va a dar por no ocurrido, con sus importes;
//   · **se puede reabrir** · y cada mes cerrado lleva su botón al lado.
//
// Qué meses se ofrecen NO se decide aquí: lo dice `mesesParaCerrar`, la misma
// regla con la que `cerrarMes` se niega a cerrar un mes en curso.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import {
  cerrarMes,
  loQueQuedaAbierto,
  mesesCerrables,
  reabrirMes,
  type LoQueQuedaAbierto,
  type MesCerrable,
} from '../../../services/cierreDeMes';
import { diaYMes, importeConSigno, importeSaldo, nombreMes } from './formatoV6';
import styles from './CerrarElMes.module.css';

/** `2026-07` → `julio 2026`. */
const rotuloMes = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  return `${nombreMes(m - 1)} ${y}`;
};

interface Props {
  hoy: string;
  /**
   * Cerrar y reabrir mueven previsiones · la pantalla de detrás tiene que
   * recargar saldos y proyecciones, o enseñaría un cierre que ya no es.
   */
  onCambio: () => void | Promise<void>;
}

const CerrarElMes: React.FC<Props> = ({ hoy, onCambio }) => {
  const [filas, setFilas] = useState<MesCerrable[]>([]);
  const [confirmando, setConfirmando] = useState<LoQueQuedaAbierto | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const recargar = useCallback(async () => {
    try {
      setFilas(await mesesCerrables(hoy));
    } catch (err) {
      // Sin la tira no se puede cerrar, pero la pantalla de detrás sigue
      // sirviendo · reventar aquí se llevaría toda la tesorería por delante.
      console.error('[CerrarElMes] no se pudieron leer los meses', err);
    }
  }, [hoy]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /** Mirar no es cerrar · esto solo pide la lista. */
  const pedirCierre = useCallback(async (mes: string) => {
    try {
      setConfirmando(await loQueQuedaAbierto(mes));
    } catch (err) {
      console.error('[CerrarElMes] no se pudo leer lo que queda abierto', err);
    }
  }, []);

  const confirmar = useCallback(async () => {
    if (!confirmando || trabajando) return;
    setTrabajando(true);
    try {
      await cerrarMes(confirmando.mes, hoy);
      setConfirmando(null);
      await recargar();
      await onCambio();
    } catch (err) {
      console.error('[CerrarElMes] no se pudo cerrar el mes', err);
    } finally {
      setTrabajando(false);
    }
  }, [confirmando, trabajando, hoy, recargar, onCambio]);

  const reabrir = useCallback(
    async (mes: string) => {
      if (trabajando) return;
      setTrabajando(true);
      try {
        await reabrirMes(mes);
        await recargar();
        await onCambio();
      } catch (err) {
        console.error('[CerrarElMes] no se pudo reabrir el mes', err);
      } finally {
        setTrabajando(false);
      }
    },
    [trabajando, recargar, onCambio]
  );

  if (filas.length === 0) return null;

  return (
    <section className={styles.sec}>
      <div className={styles.hd}>
        <div className={styles.k}>Cerrar el mes</div>
        <div className={styles.t}>
          lo que siga previsto cuando cierres un mes se da por no ocurrido · no se borra, y el mes
          se puede reabrir
        </div>
      </div>

      <div className={styles.lista}>
        {filas.map((f) => (
          <div key={f.mes} className={`${styles.fila} ${f.cerradoAt ? styles.filaCerrada : ''}`}>
            <span className={styles.mes}>{rotuloMes(f.mes)}</span>

            {f.cerradoAt ? (
              <span className={styles.estado}>
                <Icons.Lock size={13} strokeWidth={1.9} />
                cerrado el {diaYMes(f.cerradoAt.slice(0, 10))}
                {f.cuantos > 0 && (
                  <span className={styles.detalle}>
                    · {f.cuantos} {f.cuantos === 1 ? 'previsión dada' : 'previsiones dadas'} por no
                    ocurrida{f.cuantos === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            ) : (
              <span className={styles.estado}>
                {f.cuantos === 0
                  ? 'no queda nada abierto'
                  : `${f.cuantos} ${f.cuantos === 1 ? 'movimiento' : 'movimientos'} sin ocurrir`}
                {f.cuantos > 0 && (
                  <span className={styles.detalle}>
                    · {importeConSigno(f.totalEntra)} sin entrar ·{' '}
                    {importeConSigno(-Math.abs(f.totalSale))} sin salir
                  </span>
                )}
              </span>
            )}

            {f.cerradoAt ? (
              <button
                type="button"
                className={styles.accion}
                disabled={trabajando}
                onClick={() => void reabrir(f.mes)}
              >
                <Icons.Unlock size={13} strokeWidth={1.9} /> Reabrir
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.accion} ${styles.accionCerrar}`}
                disabled={trabajando}
                onClick={() => void pedirCierre(f.mes)}
              >
                Cerrar {rotuloMes(f.mes).split(' ')[0]}
              </button>
            )}
          </div>
        ))}
      </div>

      {confirmando && (
        <div className={styles.velo} role="dialog" aria-modal="true" aria-label="Cerrar el mes">
          <div className={styles.panel}>
            <div className={styles.panelTt}>Cerrar {rotuloMes(confirmando.mes)}</div>
            <div className={styles.panelSs}>
              {confirmando.eventos.length === 0
                ? 'No queda nada abierto. Cerrar el mes deja constancia de que está completo: lo que no llegó cuenta como que no llegó.'
                : 'Esto se dará por NO ocurrido. No se borra: reabrir el mes lo devuelve tal cual.'}
            </div>

            {confirmando.eventos.length > 0 && (
              <>
                <div className={styles.tabla}>
                  {confirmando.eventos.map((e) => (
                    <div key={e.id} className={styles.linea}>
                      <span className={styles.lineaDia}>{diaYMes(e.predictedDate)}</span>
                      <span className={styles.lineaTxt}>{e.description || 'Sin concepto'}</span>
                      <span className={styles.lineaImp}>
                        {importeConSigno(
                          e.type === 'income'
                            ? Math.abs(Number(e.amount) || 0)
                            : -Math.abs(Number(e.amount) || 0)
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.totales}>
                  <span>
                    No entraron <b>{importeSaldo(confirmando.totalEntra)}</b>
                  </span>
                  <span>
                    No salieron <b>{importeSaldo(confirmando.totalSale)}</b>
                  </span>
                </div>
              </>
            )}

            <div className={styles.botones}>
              <button
                type="button"
                className={styles.btn}
                disabled={trabajando}
                onClick={() => setConfirmando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGold}`}
                disabled={trabajando}
                onClick={() => void confirmar()}
              >
                <Icons.Lock size={14} strokeWidth={1.9} /> Cerrar el mes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CerrarElMes;
