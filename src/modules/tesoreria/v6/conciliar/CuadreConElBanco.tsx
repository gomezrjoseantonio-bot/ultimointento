// ============================================================================
// El cuadre con el banco · «el banco dice X, ATLAS calcula Y» · ¿muevo la apertura?
// ============================================================================
//
// §31 · la apertura no se inventa, se DERIVA del extracto. Aquí se cuentan las
// dos cosas y se ofrece UNA casilla:
//
//   · El CUADRE (§20) · lo que el banco afirma a la fecha de la línea más
//     reciente frente a lo que ATLAS calcula. Se dice siempre, cuadre o no.
//   · La PROPUESTA · si el fichero es más antiguo que la apertura, la apertura
//     RETROCEDE hasta su línea más antigua con el saldo real del banco
//     (`retroceso`); si cae dentro de lo que ATLAS ya cubría, se ajusta el
//     saldo de hoy para cuadrar (`ajuste`).
//
// Nunca se aplica sola (§9: el saldo del fichero puede llevar retenidos o ir
// por fecha valor): la casilla nace sin marcar y se aplica al Guardar.
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { PropuestaDeApertura } from '../../../../services/aperturaDerivada';
import { fechaLarga, importeSaldo } from '../formatoV6';
import styles from './CuadreBanco.module.css';

export interface CuadreConElBancoProps {
  propuesta: PropuestaDeApertura;
  /** Lo que el usuario ha decidido · se aplica al guardar. */
  aplicar: boolean;
  onAplicar: (aplicar: boolean) => void;
  desactivado?: boolean;
}

const CuadreConElBanco: React.FC<CuadreConElBancoProps> = ({ propuesta, aplicar, onAplicar, desactivado }) => {
  const p = propuesta;
  const banco = `El banco dice que a ${fechaLarga(p.fecha)} tenías ${importeSaldo(p.saldoBanco)}`;

  // Cuadra y no hay nada que mover · el caso bueno, una línea y fuera.
  if (p.cuadra && !p.proponer) {
    return (
      <div className={`${styles.banco} ${styles.bancoOk}`} data-testid="cuadre-banco" data-estado="cuadra">
        <Icons.Check size={15} />
        <span>
          {banco} · <b>ATLAS calcula lo mismo</b>
        </span>
      </div>
    );
  }

  // El aviso de descuadre (§20) · se mantiene tal cual, cambie o no la apertura.
  const elCuadre = p.cuadra ? (
    <span>
      {banco} · <b>ATLAS calcula lo mismo</b>
    </span>
  ) : (
    <span>
      {banco} · ATLAS calcula <b>{importeSaldo(p.saldoAtlas)}</b> · {importeSaldo(Math.abs(p.descuadre))} de
      diferencia
      {p.aperturaActual.fecha
        ? ` · tu apertura actual es ${importeSaldo(p.aperturaActual.saldo)} a ${fechaLarga(p.aperturaActual.fecha)}`
        : ''}
      .
    </span>
  );

  if (!p.proponer) {
    return (
      <div className={`${styles.banco} ${styles.bancoAviso}`} data-testid="cuadre-banco" data-estado="descuadre">
        <Icons.Warning size={15} />
        <div className={styles.bancoTexto}>
          {elCuadre}
          <span className={styles.bancoNota}>
            La apertura ya está donde tiene que estar · la diferencia viene de otro sitio, revisa los movimientos.
          </span>
        </div>
      </div>
    );
  }

  const esRetroceso = p.modo === 'retroceso';
  return (
    <div
      className={`${styles.banco} ${p.cuadra ? styles.bancoOk : styles.bancoAviso}`}
      data-testid="cuadre-banco"
      data-estado={p.cuadra ? 'cuadra' : 'descuadre'}
      data-modo={p.modo}
    >
      <Icons.Warning size={15} />
      <div className={styles.bancoTexto}>
        {elCuadre}
        {esRetroceso && (
          <span>
            Este extracto empieza el {fechaLarga(p.extremos.masAntigua.fecha)}, <b>antes</b> de la apertura de tu
            cuenta
            {p.aperturaActual.fecha ? ` (${fechaLarga(p.aperturaActual.fecha)})` : ''} · el propio banco dice con
            cuánto llegabas a su primera línea.
          </span>
        )}
        <label className={styles.bancoCheck}>
          <input
            type="checkbox"
            checked={aplicar}
            disabled={desactivado}
            onChange={(e) => onAplicar(e.target.checked)}
          />
          <span>
            {esRetroceso ? (
              <>
                Llevar mi apertura al {fechaLarga(p.apertura.fecha)} con <b>{importeSaldo(p.apertura.saldo)}</b> —el
                saldo del banco en esa línea— para que ATLAS tenga todo el historial · se aplica al guardar
              </>
            ) : (
              <>
                Fijar mi saldo de apertura en <b>{importeSaldo(p.apertura.saldo)}</b> a{' '}
                {fechaLarga(p.apertura.fecha)} para que cuadre con el banco · se aplica al guardar
              </>
            )}
          </span>
        </label>
        {!p.cuadraTrasAplicar && (
          <span className={styles.bancoNota}>
            Aun así quedarían {importeSaldo(Math.abs(p.saldoBanco - p.saldoAtlasTrasAplicar))} de diferencia a{' '}
            {fechaLarga(p.fecha)} · falta algún movimiento por registrar.
          </span>
        )}
        <span className={styles.bancoNota}>
          Si no reconoces ese saldo (retenidos, fecha valor), déjalo sin marcar y ajusta la apertura a mano.
        </span>
      </div>
    </div>
  );
};

export default CuadreConElBanco;
