// La revisión que espera a que digas qué pasó · §6 ter.
//
// ATLAS no ve la carta del banco. Puede decir qué demuestran tus movimientos,
// pero **no si te dejaron la bonificación**: eso lo decide el banco y llega por
// correo. Por eso una revisión que ya pasó no cambia el cuadro sola.
//
// Esto es un hook y no una tarjeta a propósito. Como tarjeta aparte, la revisión
// enseñaba **la misma lista de bonificaciones** que la tarjeta de al lado, y
// contestar en una no tenía nada que ver con lo que decía la otra. Son la misma
// pregunta hecha dos veces: qué bonificaciones tienes, y cuáles te ha dejado el
// banco ahora. Una lista, un sitio donde contestar *(Jose · 8 ago 2026)*.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { showToastV5 } from '../../../design-system/v5';
import { revisionPendiente } from '../../../services/bonificaciones/revisionDelBanco';
import type { RevisionPendiente } from '../../../services/bonificaciones/revisionDelBanco';
import { confirmarRevision } from '../../../services/prestamos/confirmarRevision';
import type { LoQueDecidioElBanco } from '../../../services/prestamos/confirmarRevision';
import { getFinancialValuesSnapshot } from '../../../services/financialValuesService';
import { esNumero, fmtNumeroEs, parseNum } from '../wizards/numeros';
import type { Prestamo } from '../../../types/prestamos';

export interface RevisionEnCurso {
  /** La revisión que reclama respuesta · `null` si no hay ninguna. */
  pendiente: RevisionPendiente | null;
  /** Qué se ha contestado de cada bonificación · vacío al empezar. */
  decision: LoQueDecidioElBanco;
  responder: (bonificacionId: string, valor: 'CUMPLIDA' | 'PERDIDA') => void;
  /** El índice que aplicó el banco, tal como se teclea. */
  indiceRaw: string;
  setIndiceRaw: (v: string) => void;
  /** De dónde salió el índice que aparece escrito · para poder decirlo. */
  indiceSugerido: number | null;
  /** Si en la fecha de la revisión manda un índice · si no, no se pregunta. */
  pideIndice: boolean;
  confirmar: () => Promise<void>;
  descartar: () => void;
  guardando: boolean;
}

/** Si el tramo que empieza va a índice · un fijo no revisa nada. */
const revisaElIndice = (p: Prestamo): boolean =>
  p.tipo === 'VARIABLE' || (p.tipo === 'MIXTO' && (p.tramoFijoMeses ?? 0) > 0);

// El nombre va en inglés a la fuerza: la regla `react-hooks/rules-of-hooks`
// reconoce un hook por el prefijo `use`, y con `usarRevisionPendiente` no
// comprobaba ninguna de sus reglas — que es justo lo que hay que tener vigilado
// en un componente que lee de la base y navega entre préstamos.
export function useRevisionPendiente(
  prestamo: Prestamo,
  hoy: string,
  alConfirmar: () => void
): RevisionEnCurso {
  const [decision, setDecision] = useState<LoQueDecidioElBanco>({});
  const [indiceRaw, setIndiceRaw] = useState('');
  const [indiceSugerido, setIndiceSugerido] = useState<number | null>(null);
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

  const pideIndice = revisaElIndice(prestamo);

  // Lo contestado es de ESTE préstamo · navegar a otro arrastraría la decisión
  // al equivocado, o le escondería su revisión por una que se confirmó antes.
  useEffect(() => {
    setDecision({});
    setIndiceRaw('');
    setAtendida(false);
  }, [prestamo.id]);

  /**
   * El euríbor que ya tienes apuntado, propuesto de entrada.
   *
   * Vive en «Actualizar valores» y lo actualizas para todo el patrimonio, así
   * que tecleárselo otra vez a cada hipoteca era pedir dos veces el mismo dato
   * — y dos sitios donde escribir el mismo número acaban diciendo dos números.
   *
   * Se **propone**, no se impone: lo que manda es la carta del banco, y si dice
   * otra cosa se escribe encima. Al confirmar, el valor queda guardado como el
   * que rige hasta la revisión siguiente.
   */
  useEffect(() => {
    if (!pendiente || !pideIndice) return;
    let cancelado = false;
    (async () => {
      try {
        const { euriborPercent } = await getFinancialValuesSnapshot();
        if (cancelado || euriborPercent == null) return;
        setIndiceSugerido(euriborPercent);
        setIndiceRaw((actual) => (actual === '' ? fmtNumeroEs(euriborPercent, 3) : actual));
      } catch {
        // Sin valoraciones se teclea a mano · no se inventa un índice.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pendiente, pideIndice, prestamo.id]);

  const responder = useCallback((bonificacionId: string, valor: 'CUMPLIDA' | 'PERDIDA') => {
    // Volver a pulsar lo mismo lo suelta · sin esto no hay forma de retirar una
    // respuesta dada por error, y lo que no se contesta se queda como estaba.
    setDecision((d) => (d[bonificacionId] === valor ? quitar(d, bonificacionId) : { ...d, [bonificacionId]: valor }));
  }, []);

  const confirmar = useCallback(async () => {
    if (!pendiente) return;
    setGuardando(true);
    try {
      const valorIndice = esNumero(indiceRaw) ? parseNum(indiceRaw) : undefined;
      const r = await confirmarRevision(prestamo.id, {
        fecha: pendiente.fecha,
        aplicaDesde: pendiente.aplicaDesde,
        decision,
        // Ausente es una respuesta legítima · hay revisiones que solo miran las
        // bonificaciones y cartas que no dicen el índice. Inventarlo sería
        // fabricar el dato del que cuelga el cuadro entero.
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
  }, [pendiente, indiceRaw, decision, prestamo.id, alConfirmar]);

  return {
    pendiente: atendida ? null : pendiente,
    decision,
    responder,
    indiceRaw,
    setIndiceRaw,
    indiceSugerido,
    pideIndice,
    confirmar,
    // Descartar no confirma nada · la revisión seguirá pendiente mañana. Es
    // distinto de decir «no cambió nada», que sí es una respuesta.
    descartar: () => setAtendida(true),
    guardando,
  };
}

const quitar = (d: LoQueDecidioElBanco, id: string): LoQueDecidioElBanco => {
  const { [id]: _fuera, ...resto } = d;
  return resto;
};
