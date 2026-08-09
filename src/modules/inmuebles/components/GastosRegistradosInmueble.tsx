import React, { useMemo } from 'react';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { MoneyValue } from '../../../design-system/v5';
import {
  construirListaVisualGastosInmueble,
  type GastoInmuebleVisual,
} from '../adapters/gastosInmuebleAdapter';
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
}

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

function formatFecha(fecha: string | undefined | null): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

interface SeccionProps {
  label: string;
  items: GastoInmuebleVisual[];
}

function Seccion({ label, items }: SeccionProps): React.ReactElement | null {
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
}) => {
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
  const gastosOp_mantener = useMemo(
    () => gastosOp.filter((i) => i.grupoVisual === 'mantener' || i.grupoVisual === 'sin_clasificar'),
    [gastosOp],
  );
  const gastosOp_explotar = useMemo(
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
    );
  }

  return (
    <div className={styles.root}>
      {ejercicio !== undefined && (
        <div className={styles.ejercicioRow}>
          <span>Ejercicio {ejercicio}</span>
        </div>
      )}
      <Seccion label="Gastos operativos · mantener" items={gastosOp_mantener} />
      <Seccion label="Gastos operativos · explotar" items={gastosOp_explotar} />
      <Seccion label="Mejoras" items={mejoraItems} />
      <Seccion label="Mobiliario" items={mobiliarioItems} />
    </div>
  );
};

export default GastosRegistradosInmueble;
