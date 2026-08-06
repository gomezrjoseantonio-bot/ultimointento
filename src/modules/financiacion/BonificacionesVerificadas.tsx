// ============================================================================
// Lo que dicen tus movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// «Las bonificaciones de una hipoteca o un préstamo no se cumplen por
// declararlas: se cumplen porque los movimientos lo demuestran.» Hasta aquí se
// declaraban en el alta y nadie las volvía a mirar — y lo que hay en juego es
// el TIN, o sea la cuota de todos los meses que quedan.
//
// Las que todavía no se pueden mirar salen igual, dichas como lo que son. Una
// lista donde solo aparecen las verificables se leería como que las demás están
// bien.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { initDB, type TreasuryEvent } from '../../services/db';
import { gastoPorTarjeta } from '../../services/gastoPorTarjeta';
import { cobrosDeNomina } from '../../services/bonificaciones/cobrosDeNomina';
import { recibosDomiciliados } from '../../services/bonificaciones/recibosDomiciliados';
import { listarTarjetas } from '../../services/tarjetasService';
import { cierres } from '../../services/cierreDeMes';
import { verificarBonificaciones } from '../../services/bonificaciones/verificarBonificaciones';
import type { MovimientosQuePrueban } from '../../services/bonificaciones/verificarBonificaciones';
import { tinDelTramoSiRevisaranHoy } from '../../services/prestamos/tinDelTramo';
import { tramoVigente } from '../../services/prestamos/tramosDeTipo';
import { queTraeLaRevision } from '../../services/prestamos/queTraeLaRevision';
import { proximaRevision, revisionPendiente } from '../../services/bonificaciones/revisionDelBanco';
import { confirmarRevision } from '../../services/prestamos/confirmarRevision';
import type { LoQueDecidioElBanco } from '../../services/prestamos/confirmarRevision';
import { estaAplicada } from '../../services/bonificaciones/tinEfectivo';
import { esNumero, fmtNumeroEs, parseNum } from './wizards/numeros';
import { nombreMes } from '../tesoreria/v6/formatoV6';
import type { Prestamo } from '../../types/prestamos';
import { cuotaMensualConTin, effectiveTIN } from './helpers';
import {
  textoDeCumplimiento,
  textoDeLoQueEstaEnJuego,
  textoDeLoQueTraeLaRevision,
} from './textoBonificacion';
import styles from './BonificacionesVerificadas.module.css';

const ETIQUETA = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  no_verificable: 'Sin comprobar',
} as const;

interface Props {
  prestamo: Prestamo;
  /** Para que la ficha se refresque cuando una revisión cambia el tipo. */
  onCambio?: () => void;
}

const BonificacionesVerificadas: React.FC<Props> = ({ prestamo, onCambio }) => {
  const bonificaciones = prestamo.bonificaciones;
  const [movimientos, setMovimientos] = useState<MovimientosQuePrueban | null>(null);
  const [decision, setDecision] = useState<LoQueDecidioElBanco>({});
  const [indiceRaw, setIndiceRaw] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [atendida, setAtendida] = useState(false);

  // Lo elegido y el «ya atendida» son de ESTE préstamo · sin esto, navegar a
  // otro arrastraría la decisión al equivocado, o le escondería su revisión
  // pendiente por una que se confirmó en el anterior.
  useEffect(() => {
    setDecision({});
    setIndiceRaw('');
    setAtendida(false);
  }, [prestamo.id]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const db = await initDB();
      const [eventos, tarjetas] = await Promise.all([
        db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
        listarTarjetas(),
      ]);
      if (cancelado) return;
      setMovimientos({
        tarjetas,
        periodosDeTarjeta: gastoPorTarjeta(eventos),
        cobrosDeNomina: cobrosDeNomina(eventos),
        recibosDomiciliados: recibosDomiciliados(eventos),
        // Los meses cerrados · es lo que convierte «todavía no consta» en un
        // NO. Sin esto una bonificación no se pierde nunca (§6 quater).
        mesesCerrados: (await cierres()).map((c) => c.mes),
      });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!bonificaciones?.length) return null;

  // Hoy, en ISO. La ventana se cuenta hacia atrás desde el día en que se mira,
  // no desde el cierre de un periodo: la pregunta es «¿la tengo ahora?».
  const hoy = new Date().toISOString().slice(0, 10);
  const cumplimientos = movimientos
    ? verificarBonificaciones(bonificaciones, movimientos, hoy)
    : [];

  // El tipo que se paga hoy y el que se pagaría si la revisión fuese hoy. La
  // cuota sale de la misma fórmula en los dos casos, solo cambia el tipo — y el
  // segundo se recalcula entero desde el base, no sumando puntos al primero:
  // con un tope, perder una bonificación puede no subir el tipo nada.
  //
  // Los dos se preguntan sobre el tramo que rige HOY. En un mixto que solo
  // bonifica en su tramo variable, durante el fijo los dos valen lo mismo: ahí
  // el tipo no lo mueve nada.
  const tramoHoy = tramoVigente(prestamo, hoy);
  const tinHoy = effectiveTIN(prestamo);
  const tinSiRevisaran = tinDelTramoSiRevisaranHoy(prestamo, tramoHoy, cumplimientos);
  // Cuándo lo mira el banco · `null` cuando la escritura no lo dice, y entonces
  // se sigue diciendo «si la revisión fuera hoy». Inventar un año por defecto
  // pondría una fecha que se lee igual que una real.
  const revision = proximaRevision(
    {
      desdeLaFirma: prestamo.fechaFirma,
      proximaSegunElBanco: prestamo.proximaRevisionBonificaciones,
      cadaMeses: prestamo.periodoRevisionBonificacionMeses,
      graciaMeses: prestamo.graciaMesesBonificaciones,
    },
    hoy
  );

  // La que YA TOCÓ y nadie ha dado por vista · ATLAS no ve la carta del banco,
  // así que no la aplica sola.
  const pendiente = revisionPendiente(
    {
      desdeLaFirma: prestamo.fechaFirma,
      proximaSegunElBanco: prestamo.proximaRevisionBonificaciones,
      cadaMeses: prestamo.periodoRevisionBonificacionMeses,
      graciaMeses: prestamo.graciaMesesBonificaciones,
    },
    hoy,
    prestamo.ultimaRevisionBonificacionesConfirmada
  );

  // Qué trae la revisión además de las bonificaciones · el índice, y en un mixto
  // el día en que se acaba el tramo fijo. La fecha de ese cambio la fija la
  // escritura y no tiene por qué ser la de la revisión del banco, así que se
  // pregunta aparte.
  const textoTrae = textoDeLoQueTraeLaRevision(
    queTraeLaRevision(prestamo, revision?.fecha, hoy)
  );

  const enJuego = {
    tinHoy,
    tinSiRevisaran,
    sobrecosteMensual:
      cuotaMensualConTin(prestamo, tinSiRevisaran) - cuotaMensualConTin(prestamo, tinHoy),
    fechaRevision: revision?.fecha,
    enGracia: revision?.enGracia,
  };

  /**
   * Lo que ATLAS propone marcar en cada bonificación.
   *
   * Sale del veredicto de los movimientos cuando lo hay; cuando no se puede
   * comprobar se propone LO QUE YA ESTABA, porque no saber no es motivo para
   * cambiarle el estado a nadie.
   */
  const propuesta: LoQueDecidioElBanco = {};
  for (const b of bonificaciones) {
    const v = cumplimientos.find((c) => c.bonificacionId === b.id)?.veredicto;
    propuesta[b.id] =
      v === 'cumple' ? 'CUMPLIDA' : v === 'no_cumple' ? 'PERDIDA' : estaAplicada(b) ? 'CUMPLIDA' : 'PERDIDA';
  }

  const elegido = (id: string) => decision[id] ?? propuesta[id];

  // La misma carta trae el índice · si la revisión cae en un tramo que lo lleva,
  // se pregunta aquí en vez de mandar al usuario al asistente a apuntarlo.
  const revisaElIndice = pendiente
    ? tramoVigente(prestamo, pendiente.aplicaDesde).variable
    : false;

  const guardarRevision = async () => {
    if (!pendiente || !prestamo.id) return;
    setGuardando(true);
    try {
      await confirmarRevision(prestamo.id, {
        fecha: pendiente.fecha,
        aplicaDesde: pendiente.aplicaDesde,
        decision: { ...propuesta, ...decision },
        // En blanco o mal escrito no se apunta nada · se sigue proyectando con
        // el último tipo conocido, que va marcado como estimación. Un dedazo
        // guardado aquí diría «el Euríbor de esa revisión fue del 0 %».
        valorIndice: esNumero(indiceRaw) ? parseNum(indiceRaw) : undefined,
      });
      setAtendida(true);
      onCambio?.();
    } finally {
      setGuardando(false);
    }
  };

  /** «marzo de 2026» o «10 de marzo de 2026», según lo que se sepa. */
  const cuando = (iso: string): string => {
    const [anio, mes, dia] = iso.split('-');
    const nombre = `${nombreMes(Number(mes) - 1)} de ${anio}`;
    return dia ? `${Number(dia)} de ${nombre}` : nombre;
  };

  return (
    <div className={styles.card}>
      <div className={styles.hd}>
        <div className={styles.title}>Bonificaciones · lo que dicen tus movimientos</div>
        <div className={styles.sub}>se comprueban con lo ya cobrado, no con lo previsto</div>
      </div>

      {/*
        La revisión que espera respuesta · §6 ter · ter.

        Va ARRIBA y no al final: es lo único de esta ficha que pide hacer algo,
        y de lo que se decida aquí salen el tipo, el cuadro y las previsiones de
        todo lo que queda.

        ATLAS propone lo que dicen los movimientos, pero decide el usuario: la
        carta del banco no la ve nadie más que él, y los bancos perdonan, aplican
        criterios propios y a veces dan una que no esperabas.
      */}
      {pendiente && !atendida && movimientos && (
        <div className={styles.revision}>
          <div className={styles.revisionTitulo}>
            Tocaba revisión en {cuando(pendiente.fecha)}
          </div>
          <div className={styles.revisionSub}>
            Esto es lo que dicen tus movimientos. Corrige lo que el banco haya decidido de
            otra forma — al confirmarlo se recalculan la cuota y las previsiones desde esa
            fecha, sin tocar lo ya pagado.
          </div>

          {bonificaciones.map((b) => (
            <div key={b.id} className={styles.decision}>
              <div className={styles.decisionNombre}>{b.nombre}</div>
              <div className={styles.opciones}>
                <button
                  type="button"
                  className={`${styles.opcion} ${elegido(b.id) === 'CUMPLIDA' ? styles.opcionElegida : ''}`}
                  aria-pressed={elegido(b.id) === 'CUMPLIDA'}
                  onClick={() => setDecision((d) => ({ ...d, [b.id]: 'CUMPLIDA' }))}
                >
                  Me la dieron
                </button>
                <button
                  type="button"
                  className={`${styles.opcion} ${elegido(b.id) === 'PERDIDA' ? styles.opcionElegida : ''}`}
                  aria-pressed={elegido(b.id) === 'PERDIDA'}
                  onClick={() => setDecision((d) => ({ ...d, [b.id]: 'PERDIDA' }))}
                >
                  Me la quitaron
                </button>
              </div>
            </div>
          ))}

          {/*
            El índice de la misma carta · §6 ter · ter.

            Hasta ahora la carta se leía dos veces: aquí lo de las
            bonificaciones y en el asistente el Euríbor. Mientras no se pasara
            por la segunda puerta, el cuadro seguía proyectando con el índice de
            HOY, que para una revisión de hace meses es una presunción.

            Se pide el índice a secas, no el tipo: el diferencial ya lo sabe
            ATLAS y sumarlo dos veces sería el error caro. Por eso se enseña
            delante lo que se le va a sumar.

            En blanco es una respuesta legítima — hay cartas que no lo dicen — y
            entonces se sigue proyectando con el último tipo conocido.
          */}
          {revisaElIndice && (
            <div className={styles.indice}>
              <label className={styles.indiceLabel} htmlFor="revision-indice">
                Índice de la carta
              </label>
              <div className={styles.indiceCampo}>
                <input
                  id="revision-indice"
                  className={styles.indiceInput}
                  value={indiceRaw}
                  placeholder="no lo dice"
                  onChange={(e) => setIndiceRaw(e.target.value)}
                />
                <span className={styles.indiceSufijo}>
                  % + {fmtNumeroEs(prestamo.diferencial ?? 0)} de diferencial
                </span>
              </div>
              <div className={styles.indiceHint}>
                El {prestamo.indice === 'EURIBOR' ? 'Euríbor' : 'índice'} a secas, sin sumarle tu
                diferencial. Si lo dejas en blanco se sigue estimando con el último conocido.
              </div>
            </div>
          )}

          <button
            type="button"
            className={styles.confirmar}
            onClick={guardarRevision}
            disabled={guardando}
          >
            {guardando ? 'Aplicando…' : 'Confirmar revisión'}
          </button>
        </div>
      )}

      {!movimientos && <div className={styles.vacio}>Mirando los movimientos…</div>}

      {cumplimientos.map((c) => (
        <div key={c.bonificacionId} className={styles.item}>
          <div className={styles.nombre}>{c.nombre}</div>
          <span className={`${styles.chip} ${styles[c.veredicto]}`}>{ETIQUETA[c.veredicto]}</span>
          <div className={styles.detalle}>{textoDeCumplimiento(c)}</div>
        </div>
      ))}

      {movimientos && cumplimientos.length === 0 && (
        <div className={styles.vacio}>Ninguna bonificación contratada en este préstamo.</div>
      )}

      {/*
        A qué cuota vas · §6 ter.

        Va debajo y con la condición delante —la fecha de la revisión, o «si la
        revisión fuera hoy» cuando no se sabe— porque lo que gastes este mes NO
        cambia el recibo de este mes: cambia lo que decida el banco cuando mire.
      */}
      {movimientos && cumplimientos.length > 0 && (
        <div className={styles.enJuego}>{textoDeLoQueEstaEnJuego(enJuego)}</div>
      )}

      {/*
        Y qué MÁS trae esa revisión · §6 ter · ter.

        La línea de arriba solo habla de bonificaciones, y eso es la respuesta
        entera solo en un préstamo a tipo fijo. Va aparte porque no es lo mismo:
        arriba están los euros que dependen de lo que haga el usuario, y aquí lo
        que va a pasar haga lo que haga.
      */}
      {movimientos && cumplimientos.length > 0 && textoTrae && (
        <div className={styles.trae}>{textoTrae}</div>
      )}
    </div>
  );
};

export default BonificacionesVerificadas;
