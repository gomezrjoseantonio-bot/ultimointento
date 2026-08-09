import React, { useCallback, useMemo } from 'react';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { MoneyValue } from '../../../design-system/v5';
import {
  construirListaVisualGastosInmueble,
  type GastoInmuebleVisual,
} from '../adapters/gastosInmuebleAdapter';
import type {
  RegistroInmuebleEditable,
  TipoRegistroInmueble,
} from './EditarRegistroInmuebleModal';
import styles from './GastosRegistradosInmueble.module.css';

export interface GastosRegistradosInmuebleProps {
  inmuebleId: number;
  /** Año seleccionado; sin valor → datos de todos los años. */
  ejercicio?: number;
  gastosReales?: readonly GastoInmueble[];
  mejoras?: readonly MejoraInmueble[];
  mobiliario?: readonly MuebleInmueble[];
  /** Callback opcional para redirigir al usuario a la vista Recurrentes. */
  onIrARecurrentes?: () => void;
  /**
   * Años fiscales bloqueados (declarado/prescrito). Las filas de esos años se
   * muestran en solo lectura, sin botones de editar/borrar.
   */
  ejerciciosBloqueados?: readonly number[];
  /** Abre la edición del registro. Sin este callback la vista es de consulta. */
  onEditar?: (registro: RegistroInmuebleEditable) => void;
  /** Solicita el borrado del registro. Sin este callback no se ofrece borrar. */
  onBorrar?: (registro: RegistroInmuebleEditable) => void;
  /** Abre el alta de un registro. Sin este callback no se ofrece añadir. */
  onAlta?: (tipo: TipoRegistroInmueble) => void;
}

const ALTA_BOTONES: Array<{ tipo: TipoRegistroInmueble; label: string }> = [
  { tipo: 'real', label: 'Añadir gasto' },
  { tipo: 'mejora', label: 'Añadir mejora' },
  { tipo: 'mobiliario', label: 'Añadir mobiliario' },
];

type OrigenRegistrado = 'real' | 'mejora' | 'mobiliario';

const ORIGEN_LABEL: Record<OrigenRegistrado, string> = {
  real: 'Real registrado',
  mejora: 'Mejora',
  mobiliario: 'Mobiliario',
};

const ORIGEN_CLASS: Record<OrigenRegistrado, string> = {
  real: styles.origenReal,
  mejora: styles.origenMejora,
  mobiliario: styles.origenMobiliario,
};

/**
 * `true` si el registro no debe poder editarse ni borrarse: pertenece a un
 * ejercicio fiscal declarado/prescrito, procede del XML de la AEAT, o el propio
 * gasto ya está marcado como `declarado`.
 */
export function registroInmuebleBloqueado(
  ref: RegistroInmuebleEditable,
  ejerciciosBloqueados: readonly number[],
): boolean {
  const ejercicio = ref.registro.ejercicio;
  if (ejercicio !== undefined && ejerciciosBloqueados.includes(ejercicio)) return true;
  if (ref.tipo === 'real') {
    if (ref.registro.origen === 'xml_aeat') return true;
    if (ref.registro.estado === 'declarado') return true;
  }
  return false;
}

function formatFecha(fecha: string | undefined | null): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

interface SeccionProps {
  label: string;
  items: GastoInmuebleVisual[];
  renderAcciones?: (item: GastoInmuebleVisual) => React.ReactNode;
}

function Seccion({ label, items, renderAcciones }: SeccionProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section className={styles.seccion} aria-label={label}>
      <div className={styles.seccionHeader}>
        <span className={styles.seccionLabel}>{label}</span>
        <span className={styles.seccionBadge} aria-label={`${items.length} registros`}>
          {items.length}
        </span>
      </div>
      <ul className={styles.lista}>
        {items.map((item) => {
          const origen = item.origen as OrigenRegistrado;
          const acciones = renderAcciones?.(item);
          return (
            <li key={item.idVisual} className={styles.fila}>
              <span
                className={`${styles.filaOrigen} ${ORIGEN_CLASS[origen] ?? styles.origenReal}`}
                aria-label={ORIGEN_LABEL[origen] ?? origen}
              >
                {ORIGEN_LABEL[origen] ?? origen}
              </span>
              <span className={styles.filaDescripcion} title={item.descripcion}>
                {item.descripcion}
              </span>
              <span className={styles.filaFecha}>{formatFecha(item.fecha)}</span>
              {item.importeReal !== undefined && (
                <span className={styles.filaImporte}>
                  <MoneyValue value={item.importeReal} />
                </span>
              )}
              {acciones}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const GastosRegistradosInmueble: React.FC<GastosRegistradosInmuebleProps> = ({
  inmuebleId,
  ejercicio,
  gastosReales = [],
  mejoras = [],
  mobiliario = [],
  onIrARecurrentes,
  ejerciciosBloqueados = [],
  onEditar,
  onBorrar,
  onAlta,
}) => {
  const toolbar = onAlta ? (
    <div className={styles.toolbar}>
      {ALTA_BOTONES.map(({ tipo, label }) => (
        <button
          key={tipo}
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onAlta(tipo)}
        >
          + {label}
        </button>
      ))}
    </div>
  ) : null;

  const lista = useMemo(
    () =>
      construirListaVisualGastosInmueble({
        inmuebleId,
        // Compromisos recurrentes no se listan en Registrados
        compromisosRecurrentes: [] as CompromisoRecurrente[],
        gastosReales,
        mejoras,
        mobiliario,
      }),
    [inmuebleId, gastosReales, mejoras, mobiliario],
  );

  // Mapas id → entidad para resolver la fila visual a su registro editable.
  const gastoPorId = useMemo(
    () => new Map(gastosReales.filter((g) => g.id != null).map((g) => [g.id as number, g])),
    [gastosReales],
  );
  const mejoraPorId = useMemo(
    () => new Map(mejoras.filter((m) => m.id != null).map((m) => [m.id as number, m])),
    [mejoras],
  );
  const mueblePorId = useMemo(
    () => new Map(mobiliario.filter((m) => m.id != null).map((m) => [m.id as number, m])),
    [mobiliario],
  );

  const construirRef = useCallback(
    (item: GastoInmuebleVisual): RegistroInmuebleEditable | null => {
      if (item.registroId == null) return null;
      if (item.origen === 'real') {
        const g = gastoPorId.get(item.registroId);
        return g ? { tipo: 'real', registro: g } : null;
      }
      if (item.origen === 'mejora') {
        const m = mejoraPorId.get(item.registroId);
        return m ? { tipo: 'mejora', registro: m } : null;
      }
      if (item.origen === 'mobiliario') {
        const mu = mueblePorId.get(item.registroId);
        return mu ? { tipo: 'mobiliario', registro: mu } : null;
      }
      return null;
    },
    [gastoPorId, mejoraPorId, mueblePorId],
  );

  const puedeOperar = Boolean(onEditar || onBorrar);

  const renderAcciones = useCallback(
    (item: GastoInmuebleVisual): React.ReactNode => {
      if (!puedeOperar) return null;
      const ref = construirRef(item);
      if (!ref) return null;
      if (registroInmuebleBloqueado(ref, ejerciciosBloqueados)) {
        return (
          <span
            className={styles.filaBloqueada}
            title="Ejercicio declarado o registro de solo lectura"
          >
            Bloqueado
          </span>
        );
      }
      return (
        <span className={styles.filaAcciones}>
          {onEditar && (
            <button
              type="button"
              className={styles.accionBtn}
              onClick={() => onEditar(ref)}
              aria-label={`Editar ${item.descripcion}`}
            >
              Editar
            </button>
          )}
          {onBorrar && (
            <button
              type="button"
              className={`${styles.accionBtn} ${styles.accionBorrar}`}
              onClick={() => onBorrar(ref)}
              aria-label={`Borrar ${item.descripcion}`}
            >
              Borrar
            </button>
          )}
        </span>
      );
    },
    [puedeOperar, construirRef, ejerciciosBloqueados, onEditar, onBorrar],
  );

  const filtrada = useMemo(() => {
    if (ejercicio === undefined) return lista;
    return lista.filter(
      (item) => item.ejercicio === undefined || item.ejercicio === ejercicio,
    );
  }, [lista, ejercicio]);

  const gastosOp = useMemo(
    () => filtrada.filter((i) => i.origen === 'real'),
    [filtrada],
  );
  const gastosOpMantener = useMemo(
    () => gastosOp.filter((i) => i.grupoVisual === 'mantener' || i.grupoVisual === 'sin_clasificar'),
    [gastosOp],
  );
  const gastosOpExplotar = useMemo(
    () => gastosOp.filter((i) => i.grupoVisual === 'explotar'),
    [gastosOp],
  );
  const mejoraItems = useMemo(
    () => filtrada.filter((i) => i.origen === 'mejora'),
    [filtrada],
  );
  const mobiliarioItems = useMemo(
    () => filtrada.filter((i) => i.origen === 'mobiliario'),
    [filtrada],
  );

  const hayDatos =
    gastosOp.length > 0 || mejoraItems.length > 0 || mobiliarioItems.length > 0;

  if (!hayDatos) {
    return (
      <div className={styles.root}>
        {toolbar}
        <div className={styles.vacio} role="status">
          <p className={styles.vacioTexto}>
            No hay gastos registrados
            {ejercicio !== undefined ? ` en ${ejercicio}` : ''}.
          </p>
          {onIrARecurrentes && (
            <button
              type="button"
              className={styles.vacioCta}
              onClick={onIrARecurrentes}
            >
              Ver compromisos recurrentes
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {toolbar}
      {ejercicio !== undefined && (
        <div className={styles.ejercicioRow}>
          <span>Ejercicio {ejercicio}</span>
        </div>
      )}
      <Seccion label="Gastos operativos · mantener" items={gastosOpMantener} renderAcciones={renderAcciones} />
      <Seccion label="Gastos operativos · explotar" items={gastosOpExplotar} renderAcciones={renderAcciones} />
      <Seccion label="Mejoras" items={mejoraItems} renderAcciones={renderAcciones} />
      <Seccion label="Mobiliario" items={mobiliarioItems} renderAcciones={renderAcciones} />
    </div>
  );
};

export default GastosRegistradosInmueble;
