// ============================================================================
// Las decisiones de la sesión · todo lo que el usuario hace sobre una línea
// ============================================================================
//
// Salieron de `DrawerExtracto` porque son una cosa entera y separable: los
// gestos que sólo tocan `DecisionesSesion`, sin red, sin base de datos y sin
// saber nada del fichero ni del paso en que está la pantalla. El drawer los
// tenía dentro por costumbre, no por necesidad, y esa costumbre lo había puesto
// por encima de las 800 líneas.
//
// Todo pasa por `conDecisiones`, que CLONA antes de mutar. Es lo que hace que
// React vea un objeto nuevo y vuelva a pintar: mutar los `Set` y `Map` en su
// sitio dejaba la pantalla congelada enseñando el estado anterior, que es la
// clase de fallo que parece «no funciona el botón».
//
// Los borrados que arrastra cada gesto tampoco son ceremonia: los destinos son
// EXCLUYENTES. Una línea no puede estar a la vez asignada a un previsto,
// ignorada y marcada como traspaso; si pudiera, `payloadDeConfirmacion` la
// escribiría dos veces y el mismo dinero se contaría dos veces.
//
// Y todo va envuelto en `useCallback`/`useMemo` a propósito: el drawer mete
// varios de estos gestos en las dependencias de sus propios `useCallback`, y
// una identidad que cambia en cada render los invalidaría a todos.
// ============================================================================

import { useCallback, useMemo, useState } from 'react';
import {
  decisionesVacias,
  idsIgualesAResolver,
  type DecisionesSesion,
  type LineaExtracto,
} from './extractoSesion';

export interface AccionesDeSesion {
  decisiones: DecisionesSesion;
  /** Vuelve al estado inicial · al abrir otro fichero. */
  reiniciarDecisiones: () => void;
  ignorar: (lineaId: number) => void;
  recuperar: (lineaId: number) => void;
  desemparejar: (lineaId: number) => void;
  ignorarVarias: (lineaIds: number[]) => void;
  traspasarVarias: (lineaIds: number[], cuentaDestinoId: number) => void;
  asignar: (lineaId: number, eventoId: number) => void;
  marcarEfectivo: (lineaId: number) => void;
  desmarcarEfectivo: (lineaId: number) => void;
  marcarTraspaso: (lineaId: number, cuentaDestinoId: number) => void;
  desmarcarTraspaso: (lineaId: number) => void;
  marcarTraspasoLote: (linea: LineaExtracto) => void;
  marcarCreado: (lineaId: number) => void;
}

export function useDecisionesDeSesion(lineas: LineaExtracto[]): AccionesDeSesion {
  const [decisiones, setDecisiones] = useState<DecisionesSesion>(decisionesVacias);

  const conDecisiones = useCallback((mut: (d: DecisionesSesion) => void) => {
    setDecisiones((prev) => {
      const d: DecisionesSesion = {
        asignados: new Map(prev.asignados),
        ignorados: new Set(prev.ignorados),
        creados: new Set(prev.creados),
        recuperados: new Set(prev.recuperados),
        aEfectivo: new Set(prev.aEfectivo),
        aTraspaso: new Map(prev.aTraspaso),
        desemparejados: new Set(prev.desemparejados),
      };
      mut(d);
      return d;
    });
  }, []);

  const ignorar = useCallback(
    (lineaId: number) =>
      conDecisiones((d) => {
        d.ignorados.add(lineaId);
        d.asignados.delete(lineaId);
        d.aTraspaso.delete(lineaId);
      }),
    [conDecisiones],
  );

  const recuperar = useCallback(
    (lineaId: number) =>
      conDecisiones((d) => {
        d.ignorados.delete(lineaId);
        d.recuperados.add(lineaId);
      }),
    [conDecisiones],
  );

  /**
   * «No es esto» · la vuelta atrás sobre lo que ATLAS colocó solo.
   *
   * La línea vuelve a «te necesitan», y con ella se va el emparejamiento
   * automático que la había sacado de ahí: si el previsto con el que casó era
   * el equivocado, dejar el `asignados` puesto la mandaría otra vez a
   * «resueltas» en el mismo render. No se borra nada — el `Movement` sigue
   * donde estaba.
   */
  const desemparejar = useCallback(
    (lineaId: number) =>
      conDecisiones((d) => {
        d.desemparejados.add(lineaId);
        d.asignados.delete(lineaId);
      }),
    [conDecisiones],
  );

  /** Ignorar de un gesto lo que el usuario haya elegido en la pantalla. */
  const ignorarVarias = useCallback(
    (lineaIds: number[]) =>
      conDecisiones((d) => {
        for (const id of lineaIds) {
          d.ignorados.add(id);
          d.asignados.delete(id);
          d.aTraspaso.delete(id);
        }
      }),
    [conDecisiones],
  );

  /**
   * «Son traspaso a esta cuenta» sobre todas las elegidas de un gesto.
   *
   * Es `marcarTraspaso` en bucle, ni más ni menos: los veintiocho cargos de
   * Revolut de un extracto son el mismo gesto repetido veintiocho veces, y
   * repetirlo a mano no añade ninguna información que ATLAS no tenga ya.
   */
  const traspasarVarias = useCallback(
    (lineaIds: number[], cuentaDestinoId: number) =>
      conDecisiones((d) => {
        for (const id of lineaIds) {
          d.aTraspaso.set(id, cuentaDestinoId);
          d.ignorados.delete(id);
          d.asignados.delete(id);
          d.aEfectivo.delete(id);
        }
      }),
    [conDecisiones],
  );

  const asignar = useCallback(
    (lineaId: number, eventoId: number) =>
      conDecisiones((d) => {
        d.asignados.set(lineaId, eventoId);
        d.ignorados.delete(lineaId);
        d.aEfectivo.delete(lineaId);
        d.aTraspaso.delete(lineaId);
        // Asignar es decir QUÉ es · deshace el «No es esto» de antes.
        d.desemparejados.delete(lineaId);
      }),
    [conDecisiones],
  );

  // "Es efectivo" · el cargo pasa a un traspaso a Efectivo al guardar (sacar del
  // cajero no es gasto: el dinero cambia de sitio).
  const marcarEfectivo = useCallback(
    (lineaId: number) =>
      conDecisiones((d) => {
        d.aEfectivo.add(lineaId);
        d.ignorados.delete(lineaId);
        d.asignados.delete(lineaId);
        d.aTraspaso.delete(lineaId);
      }),
    [conDecisiones],
  );

  const desmarcarEfectivo = useCallback(
    (lineaId: number) => conDecisiones((d) => d.aEfectivo.delete(lineaId)),
    [conDecisiones],
  );

  // "Es traspaso" · el cargo pasa a un traspaso a la cuenta destino al guardar
  // (P1) · el dinero no se gasta, cambia de sitio.
  const marcarTraspaso = useCallback(
    (lineaId: number, cuentaDestinoId: number) =>
      conDecisiones((d) => {
        d.aTraspaso.set(lineaId, cuentaDestinoId);
        d.ignorados.delete(lineaId);
        d.asignados.delete(lineaId);
        d.aEfectivo.delete(lineaId);
      }),
    [conDecisiones],
  );

  const desmarcarTraspaso = useCallback(
    (lineaId: number) => conDecisiones((d) => d.aTraspaso.delete(lineaId)),
    [conDecisiones],
  );

  // A2 · las iguales sin resolver como traspaso a la misma cuenta (28 Revolut de un clic).
  const marcarTraspasoLote = useCallback(
    (linea: LineaExtracto) => {
      const destino = decisiones.aTraspaso.get(linea.lineaId);
      if (destino == null) return;
      const ids = idsIgualesAResolver(lineas, decisiones, linea);
      conDecisiones((d) => {
        for (const id of ids) {
          d.aTraspaso.set(id, destino);
          d.ignorados.delete(id);
          d.asignados.delete(id);
          d.aEfectivo.delete(id);
        }
      });
    },
    [lineas, decisiones, conDecisiones],
  );

  /**
   * Una línea que el usuario acaba de clasificar con la ficha de crear.
   *
   * Sale de ignorados a la vez: si la ha clasificado ya no la está apartando, y
   * dejarla en los dos sitios la contaría dos veces al guardar.
   */
  const marcarCreado = useCallback(
    (lineaId: number) =>
      conDecisiones((d) => {
        d.creados.add(lineaId);
        d.ignorados.delete(lineaId);
      }),
    [conDecisiones],
  );

  const reiniciarDecisiones = useCallback(() => setDecisiones(decisionesVacias()), []);

  return useMemo(
    () => ({
      decisiones,
      reiniciarDecisiones,
      ignorar,
      recuperar,
      desemparejar,
      ignorarVarias,
      traspasarVarias,
      asignar,
      marcarEfectivo,
      desmarcarEfectivo,
      marcarTraspaso,
      desmarcarTraspaso,
      marcarTraspasoLote,
      marcarCreado,
    }),
    [
      decisiones,
      reiniciarDecisiones,
      ignorar,
      recuperar,
      desemparejar,
      ignorarVarias,
      traspasarVarias,
      asignar,
      marcarEfectivo,
      desmarcarEfectivo,
      marcarTraspaso,
      desmarcarTraspaso,
      marcarTraspasoLote,
      marcarCreado,
    ],
  );
}
