// ============================================================================
// El cuadre con el banco · «el banco dice X, ATLAS calcula Y» · ¿anclo?
// ============================================================================
//
// E1.5-anclaje-saldo. Cuando el extracto trae columna de saldo, ATLAS compara
// lo que el banco afirma a la fecha de la última línea con lo que él calcula
// a esa misma fecha. Si cuadra, lo dice. Si no, PROPONE fijar la apertura de
// la cuenta para que cuadre y el usuario CONFIRMA con una casilla; se aplica
// al Guardar. Nunca se ancla solo (§9: el saldo del fichero puede llevar
// retenidos). Y si la cuenta ya tenía apertura, el descuadre se ve, no se pisa.
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { PropuestaDeAnclaje } from '../../../../services/anclajeSaldoExtracto';
import { fechaLarga, importeSaldo } from '../formatoV6';
import styles from './CuadreBanco.module.css';

export interface CuadreConElBancoProps {
  propuesta: PropuestaDeAnclaje;
  /** Lo que el usuario ha decidido · se aplica al guardar. */
  anclar: boolean;
  onAnclar: (anclar: boolean) => void;
  desactivado?: boolean;
}

const CuadreConElBanco: React.FC<CuadreConElBancoProps> = ({ propuesta, anclar, onAnclar, desactivado }) => {
  const p = propuesta;
  const banco = `El banco dice que a ${fechaLarga(p.fecha)} tenías ${importeSaldo(p.saldoBanco)}`;

  if (p.cuadra) {
    return (
      <div className={`${styles.banco} ${styles.bancoOk}`} data-testid="cuadre-banco" data-estado="cuadra">
        <Icons.Check size={15} />
        <span>
          {banco} · <b>ATLAS calcula lo mismo</b>
        </span>
      </div>
    );
  }

  if (!p.aplicable) {
    return (
      <div className={`${styles.banco} ${styles.bancoAviso}`} data-testid="cuadre-banco" data-estado="anterior">
        <Icons.Warning size={15} />
        <span>
          {banco} · ATLAS calcula {importeSaldo(p.saldoAtlas)}. Este extracto es <b>anterior a la apertura</b>{' '}
          de la cuenta{p.aperturaActual.fecha ? ` (${fechaLarga(p.aperturaActual.fecha)})` : ''}, así que no se
          ancla a él · si el saldo no cuadra, ajusta la apertura a mano.
        </span>
      </div>
    );
  }

  // Hay apertura previa si la cuenta tiene FECHA de apertura, aunque el saldo
  // sea 0: «0 € a 31 de agosto» es justo lo que explica el descuadre.
  const teniaApertura = p.aperturaActual.fecha != null;
  return (
    <div className={`${styles.banco} ${styles.bancoAviso}`} data-testid="cuadre-banco" data-estado="descuadre">
      <Icons.Warning size={15} />
      <div className={styles.bancoTexto}>
        <span>
          {banco} · ATLAS calcula <b>{importeSaldo(p.saldoAtlas)}</b> · {importeSaldo(Math.abs(p.descuadre))} de
          diferencia
          {teniaApertura
            ? ` · tu apertura actual es ${importeSaldo(p.aperturaActual.saldo)} a ${fechaLarga(p.aperturaActual.fecha as string)}`
            : ''}
          .
        </span>
        <label className={styles.bancoCheck}>
          <input
            type="checkbox"
            checked={anclar}
            disabled={desactivado}
            onChange={(e) => onAnclar(e.target.checked)}
          />
          <span>
            Fijar mi saldo de apertura en <b>{importeSaldo(p.aperturaPropuesta)}</b> a {fechaLarga(p.fecha)} para
            que cuadre con el banco · se aplica al guardar
          </span>
        </label>
        <span className={styles.bancoNota}>
          Si no reconoces ese saldo (retenidos, fecha valor), déjalo sin marcar y ajusta la apertura a mano.
        </span>
      </div>
    </div>
  );
};

export default CuadreConElBanco;
