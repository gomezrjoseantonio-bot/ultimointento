// La revisión que espera a que digas qué pasó · §6 ter.
//
// ATLAS no ve la carta del banco. Puede decir qué demuestran tus movimientos,
// pero **no si te dejaron la bonificación**: eso lo decide el banco y llega por
// correo. Por eso una revisión que ya pasó no cambia el cuadro sola — queda
// pendiente hasta que la confirmas.
//
// Esta pieza existía y se quedó a oscuras: `revisionPendiente` y
// `confirmarRevision` llevaban dos entregas alcanzables solo desde sus pruebas,
// porque la pantalla que las llamaba se sustituyó por otra. Un motor sin puerta
// es lo mismo que no tenerlo.

import React, { useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import { revisionPendiente } from '../../../services/bonificaciones/revisionDelBanco';
import { confirmarRevision } from '../../../services/prestamos/confirmarRevision';
import type { LoQueDecidioElBanco } from '../../../services/prestamos/confirmarRevision';
import { esNumero, fmtNumeroEs, parseNum } from '../wizards/numeros';
import type { Prestamo } from '../../../types/prestamos';
import base from './DetallePrestamo.module.css';
import styles from './RevisionPendiente.module.css';

interface Props {
  prestamo: Prestamo;
  hoy: string;
  /** Para recargar la ficha cuando el cuadro se rehace. */
  alConfirmar: () => void;
}

/** Si en la fecha de la revisión manda un índice · si no, el campo no se pide. */
const revisaElIndice = (p: Prestamo): boolean =>
  p.tipo === 'VARIABLE' || (p.tipo === 'MIXTO' && (p.tramoFijoMeses ?? 0) > 0);

const RevisionPendienteCard: React.FC<Props> = ({ prestamo, hoy, alConfirmar }) => {
  const [decision, setDecision] = useState<LoQueDecidioElBanco>({});
  const [indiceRaw, setIndiceRaw] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [atendida, setAtendida] = useState(false);

  const pendiente = useMemo(
    () =>
      revisionPendiente(
        {
          desdeLaFirma: prestamo.fechaFirma ?? '',
          proximaSegunElBanco: prestamo.proximaRevisionBonificaciones,
          cadaMeses: prestamo.periodoRevisionBonificacionMeses,
          graciaMeses: prestamo.graciaMesesBonificaciones,
        },
        hoy,
        prestamo.ultimaRevisionBonificacionesConfirmada
      ),
    [prestamo, hoy]
  );

  if (!pendiente || atendida) return null;

  const bonificaciones = prestamo.bonificaciones ?? [];

  const confirmar = async () => {
    setGuardando(true);
    try {
      const valorIndice = esNumero(indiceRaw) ? parseNum(indiceRaw) : undefined;
      const r = await confirmarRevision(prestamo.id, {
        fecha: pendiente.fecha,
        aplicaDesde: pendiente.aplicaDesde,
        decision,
        // Ausente es una respuesta legítima · hay revisiones que solo miran las
        // bonificaciones, y cartas que no dicen el índice. Inventarlo sería
        // fabricar un hecho del que cuelga el cuadro entero.
        ...(valorIndice != null ? { valorIndice } : {}),
      });
      setAtendida(true);
      if (r) {
        showToastV5(
          r.tinDespues === r.tinAntes
            ? 'Revisión apuntada · tu tipo no cambia'
            : `Revisión apuntada · pasas del ${fmtNumeroEs(r.tinAntes, 3)} % al ${fmtNumeroEs(r.tinDespues, 3)} %`
        );
      }
      alConfirmar();
    } catch {
      showToastV5('No se ha podido apuntar la revisión.');
      setGuardando(false);
    }
  };

  const cuando =
    pendiente.precision === 'mes'
      ? `${pendiente.fecha.slice(5, 7)}/${pendiente.fecha.slice(0, 4)}`
      : `${pendiente.fecha.slice(8, 10)}/${pendiente.fecha.slice(5, 7)}/${pendiente.fecha.slice(0, 4)}`;

  return (
    <div className={`${base.card} ${base.topGold}`}>
      <div className={base.cardT}>
        <Icons.Alert size={15} strokeWidth={2} aria-hidden />
        Revisión de {cuando}
        <span className={base.cardNota}>ATLAS no ve la carta del banco</span>
      </div>

      <div className={styles.revTexto}>
        Tu banco ya ha revisado. Dinos qué te dejó y el cuadro se rehace desde{' '}
        <strong>{pendiente.aplicaDesde.split('-').reverse().join('/')}</strong>.
      </div>

      {bonificaciones.length > 0 && (
        <div className={styles.revLista}>
          {bonificaciones.map((b) => (
            <div key={b.id} className={styles.revFila}>
              <span className={styles.revNombre}>{b.nombre}</span>
              <div className={styles.revBotones}>
                {/* Las dos respuestas explícitas, y ninguna marcada de salida:
                    lo que no se conteste se queda como está, porque no decir
                    nada de una bonificación no es decir que se perdió. */}
                <button
                  type="button"
                  className={
                    decision[b.id] === 'CUMPLIDA' ? styles.revSiOn : styles.revSi
                  }
                  onClick={() => setDecision((d) => ({ ...d, [b.id]: 'CUMPLIDA' }))}
                >
                  me la dejan
                </button>
                <button
                  type="button"
                  className={
                    decision[b.id] === 'PERDIDA' ? styles.revNoOn : styles.revNo
                  }
                  onClick={() => setDecision((d) => ({ ...d, [b.id]: 'PERDIDA' }))}
                >
                  la pierdo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {revisaElIndice(prestamo) && (
        <div className={styles.revIndice}>
          <label htmlFor="rev-indice">Índice que aplicó (sin diferencial)</label>
          <div className={styles.revInpGrupo}>
            <input
              id="rev-indice"
              className={styles.revInp}
              value={indiceRaw}
              placeholder="2,145"
              onChange={(e) => setIndiceRaw(e.target.value)}
            />
            <span>%</span>
          </div>
          <span className={styles.revPista}>
            si la carta no lo dice, déjalo vacío · se sigue proyectando con el último conocido
          </span>
        </div>
      )}

      <div className={styles.revPie}>
        <button
          type="button"
          className={styles.revConfirmar}
          onClick={confirmar}
          disabled={guardando}
        >
          {guardando ? 'Apuntando…' : 'Apuntar lo que dijo el banco'}
        </button>
        {/* Descartar no confirma nada: la revisión seguirá pendiente mañana.
            Es distinto de decir «no cambió nada», que sí es una respuesta. */}
        <button type="button" className={styles.revLuego} onClick={() => setAtendida(true)}>
          ahora no
        </button>
      </div>
    </div>
  );
};

export default RevisionPendienteCard;
