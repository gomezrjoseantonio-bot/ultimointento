// ============================================================================
// Tesorería V6 · §4.9 · drawer · calendario diario
// ============================================================================
//
// Navegación ‹ › entre meses SIN CERRAR: la pregunta que responde esta pantalla
// es "¿qué días de este mes se me tuercen?", y contestarla obliga a saltar de
// mes sin perder el sitio.
//
// El punto ámbar marca los días que dejan una cuenta corta. No sale del neto
// del día: un día con neto positivo puede dejar una cuenta en rojo si el
// ingreso entra en una cuenta y el cargo sale de otra. Se calcula por cuenta,
// arrastrando saldo (`calendarioDias`).
//
// **En el día NO se concilia** (§4.9). Conciliar es por cuenta y por fichero,
// en §4.7. Aquí solo se confirma, se edita y se descarta — el mismo vocabulario
// de punteo que en §4.4, y por eso la lista del día es `PunteoList` y no una
// lista propia: el modelo `previsto/confirmado/conciliado` es el mismo en las
// cuatro vistas y no se duplica.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import { eventoAItem, movimientoAItem } from '../../../services/punteo/punteoAdapter';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { esPendiente } from '../../../services/tesoreriaV6Metrics';
import { construirDias, resumirMes, huecosIniciales } from './calendarioDias';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo, nombreMes, fechaLarga } from './formatoV6';
import chasis from './DrawerV6.module.css';
import styles from './DrawerCalendario.module.css';

// §8 · las cabeceras van en formato largo. "L M X J V S D" obliga a
// descifrarlas —la X de miércoles no es evidente— y no ahorra nada: el ancho
// de la columna lo fija la celda, no el rótulo.
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export interface DrawerCalendarioProps {
  abierto: boolean;
  year: number;
  month0: number;
  /** Cambia el mes sin cerrar el drawer (§4.9). */
  onMes: (year: number, month0: number) => void;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  cuentas: Account[];
  saldoPorCuenta: Map<number, number>;
  saldoTotalHoy: number;
  hoy: string;
  aliasInmueble?: (id: number | string) => string | undefined;
  onCerrar: () => void;
  onConfirmar: (item: ItemPunteo) => void | Promise<void>;
  onDescartar: (item: ItemPunteo) => void | Promise<void>;
  onEditar?: (item: ItemPunteo) => void;
  /** Confirmar de golpe todo lo que queda pendiente ese día (§4.9). */
  onConfirmarDia: (items: ItemPunteo[]) => void | Promise<void>;
  /**
   * §9 · anotar un movimiento EN ESE DÍA.
   *
   * Faltaba, y es la mitad que da sentido al panel: mirando el día se ve tanto
   * lo que estaba previsto como lo que pasó y nadie había apuntado. Sin esto
   * había que cerrar, abrir la cuenta y poner la fecha a mano — con el día
   * delante, eso es pedirle al usuario un dato que ya está en pantalla.
   */
  onAnotar?: (fecha: string) => void | Promise<void>;
}

const DrawerCalendario: React.FC<DrawerCalendarioProps> = ({
  abierto,
  year,
  month0,
  onMes,
  eventos,
  movimientos,
  cuentas,
  saldoPorCuenta,
  saldoTotalHoy,
  hoy,
  aliasInmueble,
  onCerrar,
  onConfirmar,
  onDescartar,
  onEditar,
  onConfirmarDia,
  onAnotar,
}) => {
  const [diaElegido, setDiaElegido] = useState<string | null>(null);

  const dias = useMemo(
    () =>
      construirDias({ year, month0, eventos, movimientos, cuentas, saldoPorCuenta, hoy }),
    [year, month0, eventos, movimientos, cuentas, saldoPorCuenta, hoy]
  );

  const resumen = useMemo(
    () => resumirMes({ year, month0, eventos, saldoTotalHoy }),
    [year, month0, eventos, saldoTotalHoy]
  );

  const huecos = useMemo(() => huecosIniciales(year, month0), [year, month0]);

  /** Los apuntes del día elegido, en el mismo formato que §4.4. */
  const itemsDelDia = useMemo<ItemPunteo[]>(() => {
    if (!diaElegido) return [];
    const evs = eventos
      .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
      .filter((e) => esPendiente(e))
      .filter((e) => (e.predictedDate ?? '').slice(0, 10) === diaElegido)
      .map((e) => eventoAItem(e, aliasInmueble));
    const movs = movimientos
      .filter((m): m is Movement & { id: number } => m.id != null)
      .filter((m) => !m.isOpeningBalance)
      .filter((m) => (m.date ?? '').slice(0, 10) === diaElegido)
      .map((m) => movimientoAItem(m, aliasInmueble));
    return [...evs, ...movs];
  }, [diaElegido, eventos, movimientos, aliasInmueble]);

  /** Solo lo que sigue previsto · confirmar el día no toca lo ya confirmado. */
  const pendientesDelDia = useMemo(
    () => itemsDelDia.filter((i) => i.kind === 'evento'),
    [itemsDelDia]
  );

  const irAMes = (delta: number) => {
    const d = new Date(year, month0 + delta, 1);
    setDiaElegido(null);
    onMes(d.getFullYear(), d.getMonth());
  };

  if (!abierto) return null;

  const cuentasParaLista = cuentas
    .filter((c): c is Account & { id: number } => c.id != null)
    .map((c) => ({
      id: c.id,
      label: c.alias || c.banco?.name || `Cuenta ${c.id}`,
      // §9 · el punto del banco en la fila: en un día conviven cargos de varias
      // cuentas y hay que ver de cuál sale cada uno sin leer el nombre.
      color: colorDeBanco(c),
    }));

  return (
    <>
      <div className={`${chasis.back} ${chasis.backOpen}`} onClick={onCerrar} aria-hidden="true" />
      <aside
        className={`${chasis.drw} ${chasis.drwOpen}`}
        role="dialog"
        aria-modal="true"
        aria-label="Calendario"
      >
        <div className={chasis.hd}>
          <div className={chasis.hdTop}>
            <div className={styles.nav}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => irAMes(-1)}
                aria-label="Mes anterior"
              >
                <Icons.ChevronLeft size={16} strokeWidth={2} />
              </button>
              <h2 className={chasis.hdTitle}>
                {nombreMes(month0)} {year}
              </h2>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => irAMes(1)}
                aria-label="Mes siguiente"
              >
                <Icons.ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
            <button
              type="button"
              className={chasis.hdClose}
              onClick={onCerrar}
              aria-label="Cerrar"
            >
              <Icons.Close size={17} strokeWidth={2} />
            </button>
          </div>

          <div className={chasis.kpis}>
            <div className={chasis.ak}>
              <div className={chasis.akl}>Queda entrar</div>
              <div className={chasis.akv}>{importeConSigno(resumen.quedaEntrar)}</div>
            </div>
            <div className={chasis.ak}>
              <div className={chasis.akl}>Queda salir</div>
              <div className={chasis.akv}>{importeConSigno(resumen.quedaSalir)}</div>
            </div>
            <div className={chasis.ak}>
              <div className={chasis.akl}>Cierre</div>
              <div className={`${chasis.akv} ${chasis.akvGold}`}>{importeSaldo(resumen.cierre)}</div>
            </div>
          </div>
        </div>

        <div className={chasis.body}>
          {/* ── Rejilla de días · lunes primero (§4.9) ──────────────────── */}
          <div className={styles.rejilla} role="grid" aria-label={`Días de ${nombreMes(month0)}`}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} className={styles.cabDia} role="columnheader">
                {d}
              </div>
            ))}
            {Array.from({ length: huecos }, (_, i) => (
              <div key={`hueco-${i}`} className={styles.hueco} aria-hidden="true" />
            ))}
            {dias.map((d) => {
              const esHoy = d.fecha === hoy;
              const elegido = d.fecha === diaElegido;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  role="gridcell"
                  className={[
                    styles.dia,
                    esHoy ? styles.diaHoy : '',
                    elegido ? styles.diaOn : '',
                    d.apuntes === 0 ? styles.diaVacio : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setDiaElegido(elegido ? null : d.fecha)}
                  aria-selected={elegido}
                  aria-label={
                    `${d.numero} de ${nombreMes(month0)}` +
                    (d.apuntes === 0 ? ' · sin movimientos' : ` · neto ${importeConSigno(d.neto)}`) +
                    (d.dejaCuentaCorta ? ' · deja una cuenta en negativo' : '')
                  }
                >
                  <span className={styles.diaNum}>{d.numero}</span>
                  {d.apuntes > 0 && (
                    <span className={styles.diaNeto}>{importeConSigno(d.neto)}</span>
                  )}
                  {/* Ámbar · única nota de color de la rejilla (§5). */}
                  {d.dejaCuentaCorta && <span className={styles.avisoDot} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {/* ── El día elegido ──────────────────────────────────────────── */}
          {diaElegido && (
            <div className={styles.detalle}>
              <div className={styles.detalleHd}>
                <div className={styles.detalleT}>{fechaLarga(diaElegido)}</div>
                <div className={styles.detalleAcciones}>
                  {pendientesDelDia.length > 0 && (
                    <button
                      type="button"
                      className={styles.btnDia}
                      onClick={() => void onConfirmarDia(pendientesDelDia)}
                    >
                      <Icons.Check size={13} strokeWidth={2} /> Confirmar el día
                    </button>
                  )}
                  {onAnotar && (
                    <button
                      type="button"
                      className={styles.btnDiaSec}
                      onClick={() => onAnotar(diaElegido)}
                    >
                      <Icons.Plus size={13} strokeWidth={2} /> Anotar movimiento
                    </button>
                  )}
                </div>
              </div>

              {itemsDelDia.length === 0 ? (
                <div className={styles.vacio}>Sin movimientos este día</div>
              ) : (
                <PunteoList
                  items={itemsDelDia}
                  chip="todos"
                  onChipChange={() => {}}
                  mostrarChips={false}
                  cuentas={cuentasParaLista}
                  variant="drawer"
                  // §6.4 · en el día conviven los tres estados.
                  conChipEstado
                  rowVariant="tesoreria"
                  onEditar={onEditar}
                  onConfirmar={onConfirmar}
                  onNoPaso={onDescartar}
                />
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default DrawerCalendario;
