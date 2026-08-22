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
import { calendarioDe, revisionPendiente } from '../../../services/bonificaciones/revisionDelBanco';
import type { RevisionPendiente } from '../../../services/bonificaciones/revisionDelBanco';
import { confirmarRevision } from '../../../services/prestamos/confirmarRevision';
import type { LoQueDecidioElBanco } from '../../../services/prestamos/confirmarRevision';
import { getFinancialValuesSnapshot } from '../../../services/financialValuesService';
import { publicacionDelIndice } from '../../../services/prestamos/indicePublicado';
import { cargarSerie, valorEnMes } from '../../../services/indices/seriesIndicesService';
import { tramoVigente } from '../../../services/prestamos/tramosDeTipo';
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
  /**
   * Qué clase de número se ha propuesto.
   *
   * `'publicado'` es el euríbor del mes que manda según la escritura, tal como
   * lo publicó el organismo. `'manual'` es el de «Actualizar valores», que es
   * el de HOY y solo sirve de orientación. La pantalla tiene que poder decir
   * cuál de los dos está viendo el usuario, porque uno se acepta y el otro se
   * comprueba.
   */
  origenSugerido: 'publicado' | 'manual' | null;
  /** El mes del que sale · solo cuando `origenSugerido` es `'publicado'`. */
  periodoSugerido: string | null;
  /** Si en la fecha de la revisión manda un índice · si no, no se pregunta. */
  pideIndice: boolean;
  confirmar: () => Promise<void>;
  descartar: () => void;
  guardando: boolean;
}



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
  const [origenSugerido, setOrigenSugerido] = useState<'publicado' | 'manual' | null>(null);
  const [periodoSugerido, setPeriodoSugerido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [atendida, setAtendida] = useState(false);

  const pendiente = useMemo(
    () =>
      revisionPendiente(
        calendarioDe(prestamo),
        hoy,
        prestamo.ultimaRevisionBonificacionesConfirmada
      ),
    [prestamo, hoy]
  );

  /**
   * Si esta revisión mueve el índice · la MISMA regla que aplica al guardar.
   *
   * Se decide por el tramo que rige el día en que la revisión empieza, no por
   * el tipo del préstamo. Mirando solo el tipo, un mixto cuya revisión cae
   * todavía dentro del tramo fijo pedía el índice, el usuario lo tecleaba y
   * `confirmarRevision` lo tiraba —porque solo lo apunta si ese tramo es
   * variable— sin decir nada. Pedir un dato y no usarlo es peor que no pedirlo.
   */
  const pideIndice = pendiente != null && tramoVigente(prestamo, pendiente.aplicaDesde).variable;

  // Lo contestado es de ESTE préstamo · navegar a otro arrastraría la decisión
  // al equivocado, o le escondería su revisión por una que se confirmó antes.
  //
  // `indiceSugerido` se suelta con lo demás: es lo que hace que el pie diga «el
  // que tienes en Actualizar valores», y dejarlo puesto mientras carga el
  // siguiente préstamo lo afirmaba de un número que ya no está escrito.
  useEffect(() => {
    setDecision({});
    setIndiceRaw('');
    setIndiceSugerido(null);
    setOrigenSugerido(null);
    setPeriodoSugerido(null);
    setAtendida(false);
  }, [prestamo.id]);

  /**
   * El euríbor propuesto de entrada · el del mes que manda, si se sabe cuál es.
   *
   * `publicacionDelIndice` ya sabía a QUÉ MES hay que ir —lo dice la escritura
   * por su desfase—, pero hasta ahora no había dónde ir a buscarlo: en
   * «Actualizar valores» solo cabe un euríbor, el de hoy. Para una revisión de
   * agosto que se confirma en octubre, ese número no tiene por qué parecerse al
   * que aplicó el banco, y ofrecerlo invita a aceptarlo.
   *
   * Con la serie oficial (`public/data/indices`) el mes que manda tiene valor
   * propio, así que se propone ESE. Cuando la escritura no dice el desfase, o
   * ese mes todavía no está publicado, se vuelve al de «Actualizar valores» —
   * pero marcado como lo que es, para que la pantalla no lo presente como si
   * fuera el bueno.
   *
   * Se **propone**, no se impone: lo que manda es la carta del banco, y si dice
   * otra cosa se escribe encima. Al confirmar, el valor queda guardado como el
   * que rige hasta la revisión siguiente.
   */
  useEffect(() => {
    if (!pendiente || !pideIndice) return;
    let cancelado = false;
    const proponer = (valor: number, origen: 'publicado' | 'manual', periodo: string | null) => {
      if (cancelado) return;
      setIndiceSugerido(valor);
      setOrigenSugerido(origen);
      setPeriodoSugerido(periodo);
      setIndiceRaw((actual) => (actual === '' ? fmtNumeroEs(valor, 3) : actual));
    };
    (async () => {
      const publicacion = publicacionDelIndice(prestamo, pendiente.aplicaDesde);
      if (publicacion) {
        try {
          const serie = await cargarSerie('euribor-12m');
          const publicado = serie ? valorEnMes(serie, publicacion) : null;
          if (publicado) {
            proponer(publicado.valor, 'publicado', publicado.periodo);
            return;
          }
        } catch {
          // Serie no disponible · se sigue por el camino de siempre.
        }
      }
      try {
        const { euriborPercent } = await getFinancialValuesSnapshot();
        if (euriborPercent == null) return;
        proponer(euriborPercent, 'manual', null);
      } catch {
        // Sin valoraciones se teclea a mano · no se inventa un índice.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pendiente, pideIndice, prestamo]);

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
    origenSugerido,
    periodoSugerido,
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
