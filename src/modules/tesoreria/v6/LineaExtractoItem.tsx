// Tesorería V6 · §4.7 · una línea del extracto en el Paso 2 (cotejo).
//
// Extraído de `DrawerExtracto` (que estaba en el techo de tamaño): aquí vive el
// render de cada línea y sus acciones —asignar a un previsto, crear, ignorar,
// "es efectivo" y "es traspaso a [cuenta]" (P1)—. La lógica de decisión sigue
// en `extractoSesion` (puro); esto solo pinta y llama a los handlers.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent } from '../../../services/db';
import { candidatosDeLinea } from './conciliacionCandidatos';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { pareceRetiradaDeCajero } from '../../../services/retiradaCajero';
import { importeConSigno, fechaLarga } from './formatoV6';
import { veredictoEfectivo, type LineaExtracto, type DecisionesSesion } from './extractoSesion';
import styles from './DrawerExtracto.module.css';

export interface LineaExtractoItemProps {
  linea: LineaExtracto;
  decisiones: DecisionesSesion;
  previstos: TreasuryEvent[];
  cuentas: Account[];
  /** La cuenta del extracto · se excluye como destino de un traspaso. */
  cuentaActivaId: number | undefined;
  cuentaEfectivo: Account | undefined;
  asignando: number | null;
  setAsignando: (id: number | null) => void;
  traspasando: number | null;
  setTraspasando: (id: number | null) => void;
  asignar: (movementId: number, eventoId: number) => void;
  ignorar: (movementId: number) => void;
  marcarEfectivo: (movementId: number) => void;
  desmarcarEfectivo: (movementId: number) => void;
  marcarTraspaso: (movementId: number, cuentaDestinoId: number) => void;
  desmarcarTraspaso: (movementId: number) => void;
  /** A2 · cuántas líneas iguales (mismo texto y signo) quedan sin resolver. */
  igualesSinResolver?: number;
  /** A2 · marca todas las iguales como traspaso a la misma cuenta de esta. */
  onMarcarIguales?: () => void;
  abrirCrear: (linea: LineaExtracto) => void;
  nombrarPrevisto: (ev: TreasuryEvent) => string;
  nombrarPrevistoPorId: (id: number | null | undefined, respaldo: string) => string;
  /**
   * Dentro de una tarjeta de conciliar, esta línea NO pinta su propia caja.
   *
   * La tarjeta ya tiene borde, radio y fondo; sin esto salía una caja dentro de
   * otra, con dos bordes concéntricos y un hueco muerto debajo por el
   * `margin-bottom` de la línea. Es una propiedad del CONTENEDOR, no del
   * contenido, y por eso la decide quien monta la línea.
   */
  sinCaja?: boolean;
}

const LineaExtractoItem: React.FC<LineaExtractoItemProps> = ({
  linea: l,
  decisiones,
  previstos,
  cuentas,
  cuentaActivaId,
  cuentaEfectivo,
  asignando,
  setAsignando,
  traspasando,
  setTraspasando,
  asignar,
  ignorar,
  marcarEfectivo,
  desmarcarEfectivo,
  marcarTraspaso,
  desmarcarTraspaso,
  igualesSinResolver = 0,
  onMarcarIguales,
  abrirCrear,
  nombrarPrevisto,
  nombrarPrevistoPorId,
  sinCaja = false,
}) => {
  const v = veredictoEfectivo(l, decisiones);
  const asignado = decisiones.asignados.get(l.movementId);
  const previstoMostrado = asignado != null ? previstos.find((p) => p.id === asignado) : undefined;
  // Candidatos para asignar · una entrada por serie, por cercanía.
  const candidatos = candidatosDeLinea({ fecha: l.fecha, importe: l.importe }, previstos);

  // Destino de un traspaso · tus cuentas menos la del extracto (§4). Incluye
  // Efectivo, que es un traspaso más. Solo tiene sentido para cargos: la salida
  // de un traspaso es un cargo, y la pata de entrada del otro extracto se
  // concilia aparte (§4.4).
  const destinosTraspaso = cuentasEnUso(cuentas).filter((c) => c.id !== cuentaActivaId);
  const puedeSerTraspaso = l.importe < 0 && destinosTraspaso.length > 0;
  const cuentaTraspaso = decisiones.aTraspaso.has(l.movementId)
    ? cuentas.find((c) => c.id === decisiones.aTraspaso.get(l.movementId))
    : undefined;

  return (
    <div className={sinCaja ? styles.lineaDesnuda : styles.linea}>
      <div className={styles.lineaTop}>
        {/* El texto LITERAL del banco · §4.7. */}
        <div className={styles.lineaTexto}>{l.textoBanco}</div>
        <div className={styles.lineaImporte}>{importeConSigno(l.importe)}</div>
      </div>
      <div className={styles.lineaFecha}>{fechaLarga(l.fecha)}</div>

      {decisiones.aEfectivo.has(l.movementId) ? (
        <div className={styles.veredicto}>
          <Icons.Check size={13} aria-hidden="true" />
          <span>
            pasa a {cuentaEfectivo?.alias || 'Efectivo'} · el dinero no se gasta, cambia de sitio
          </span>
          <button
            type="button"
            className={styles.btnLinea}
            onClick={() => desmarcarEfectivo(l.movementId)}
          >
            Deshacer
          </button>
        </div>
      ) : cuentaTraspaso ? (
        <div className={styles.veredicto}>
          <Icons.Check size={13} aria-hidden="true" />
          <span>traspaso a {cuentaTraspaso.alias} · no es gasto, el dinero cambia de sitio</span>
          {/* A2 · marcar de una vez las líneas IGUALES sin resolver (mismo texto
              del banco y mismo signo): 28 "Pago en Revolut −30" de golpe. */}
          {igualesSinResolver > 0 && onMarcarIguales && (
            <button type="button" className={styles.btnLinea} onClick={onMarcarIguales}>
              y las {igualesSinResolver} iguales
            </button>
          )}
          <button
            type="button"
            className={styles.btnLinea}
            onClick={() => desmarcarTraspaso(l.movementId)}
          >
            Deshacer
          </button>
        </div>
      ) : v === 'cuadra' ? (
        <div className={styles.veredicto}>
          <Icons.Check size={13} aria-hidden="true" />
          <span>
            cuadra con{' '}
            {previstoMostrado
              ? nombrarPrevisto(previstoMostrado)
              : l.previsto?.descripcion ?? (l.confirmado ? 'lo que ya tenías anotado' : 'un previsto')}
          </span>
        </div>
      ) : asignando === l.movementId ? (
        <div className={styles.acciones}>
          <select
            className={styles.selectPrevisto}
            aria-label={`Previsto para ${l.textoBanco}`}
            defaultValue=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) asignar(l.movementId, id);
              setAsignando(null);
            }}
          >
            <option value="">Elige un previsto…</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {nombrarPrevistoPorId(c.id, c.descripcion)} · {importeConSigno(c.importe)}
                {c.exacto ? '' : ' · no cuadra'}
              </option>
            ))}
          </select>
        </div>
      ) : traspasando === l.movementId ? (
        <div className={styles.acciones}>
          <select
            className={styles.selectPrevisto}
            aria-label={`Cuenta destino del traspaso para ${l.textoBanco}`}
            defaultValue=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) marcarTraspaso(l.movementId, id);
              setTraspasando(null);
            }}
          >
            <option value="">¿A qué cuenta tuya?…</option>
            {destinosTraspaso.map((c) => (
              <option key={c.id} value={c.id}>
                {c.alias}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={styles.acciones}>
          {/* Asignar solo si hay algún previsto que pueda ser. */}
          {candidatos.length > 0 && (
            <button
              type="button"
              className={styles.btnLinea}
              onClick={() => setAsignando(l.movementId)}
            >
              Asignar a un previsto
            </button>
          )}
          <button type="button" className={styles.btnLinea} onClick={() => abrirCrear(l)}>
            Crear movimiento
          </button>
          {/* Traspaso a otra cuenta tuya · un cargo que no es gasto (§4). */}
          {puedeSerTraspaso && (
            <button
              type="button"
              className={styles.btnLinea}
              onClick={() => setTraspasando(l.movementId)}
            >
              Es traspaso
            </button>
          )}
          {/* Retirada de cajero · atajo a Efectivo cuando el texto lo delata. */}
          {cuentaEfectivo?.id != null && pareceRetiradaDeCajero(l.textoBanco, l.importe) && (
            <button
              type="button"
              className={styles.btnLinea}
              onClick={() => marcarEfectivo(l.movementId)}
            >
              Es efectivo
            </button>
          )}
          <button type="button" className={styles.btnLinea} onClick={() => ignorar(l.movementId)}>
            Ignorar
          </button>
        </div>
      )}
    </div>
  );
};

export default LineaExtractoItem;
