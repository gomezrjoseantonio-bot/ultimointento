import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons, EmptyState } from '../../../../design-system/v5';
import type {
  Contract,
  Property,
  ExplotacionAlquiler,
  ModoExplotacionAlquiler,
  EstadoExplotacion,
  HabitacionAlquiler,
} from '../../../../services/db';
import {
  getExplotacionesPorInmueble,
  marcarAlquilable,
  actualizarExplotacion,
  desmarcarAlquilable,
  anadirHabitacion,
  actualizarHabitacion,
  eliminarHabitacion,
} from '../../../../services/explotacionAlquilerService';
import {
  type RangoTimeline,
  type RangoFechas,
  calcularRangoFechas,
  calcularLeftPorcentaje,
} from '../../utils/timelineRango';
import {
  type LineaTimeline,
  type Segmento,
  type OverlayCompleto,
  generarPropiedadGroupData,
} from '../../utils/timelineLineas';
import { CSS_COLOR_HABITACION } from '../../utils/timelineColores';
import DrawerFichaContrato from './DrawerFichaContrato';
import styles from './TabDisponibilidad.module.css';

export interface TabDisponibilidadProps {
  contratos: Contract[];
  properties: Property[];
  onNuevoContrato: (inmuebleId?: number) => void;
  onIrAInmuebles: () => void;
  /** Corregir un error · recargar / editar / eliminar desde el drawer. */
  onContratoActualizado?: () => void;
  onEditarContrato?: (id: number) => void;
  onEliminarContrato?: (contrato: Contract & { id: number }) => void;
}

const RANGO_LABEL: Record<RangoTimeline, string> = {
  '3m': 'próximos 3 meses',
  '6m': 'próximos 6 meses',
  '12m': 'próximos 12 meses',
};

const NOMBRES_MES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MODO_LABEL: Record<ModoExplotacionAlquiler, string> = {
  completo: 'Piso completo',
  habitaciones: 'Por habitaciones',
  turistico: 'Turístico',
};

const ESTADO_LABEL: Record<EstadoExplotacion, string> = {
  operativo: 'Operativo',
  vacante: 'Vacante',
  en_reforma: 'En reforma',
};

/** Unidades arrendables de una explotación · por habitaciones cuenta las habitaciones. */
function unidadesDeExplotacion(e: ExplotacionAlquiler): number {
  return e.modo === 'habitaciones' ? Math.max(1, e.habitaciones?.length ?? 1) : 1;
}

const TabDisponibilidad: React.FC<TabDisponibilidadProps> = ({
  contratos,
  properties,
  onNuevoContrato,
  onIrAInmuebles,
  onContratoActualizado,
  onEditarContrato,
  onEliminarContrato,
}) => {
  const [rango, setRango] = useState<RangoTimeline>('6m');
  const [contratoAbierto, setContratoAbierto] = useState<
    (Contract & { id: number }) | null
  >(null);
  const [explotaciones, setExplotaciones] = useState<Map<number, ExplotacionAlquiler>>(
    new Map(),
  );

  const recargarExplotaciones = useCallback(() => {
    getExplotacionesPorInmueble()
      .then(setExplotaciones)
      .catch(() => {});
  }, []);
  useEffect(() => {
    recargarExplotaciones();
  }, [recargarExplotaciones]);

  const hoy = useMemo(() => new Date(), []);
  const rangoFechas = useMemo(() => calcularRangoFechas(rango, hoy), [rango, hoy]);

  const propiedadesActivas = useMemo(
    () => properties.filter((p) => !p.state || p.state === 'activo'),
    [properties],
  );

  // Las unidades del mercado son las de los inmuebles MARCADOS como alquilables,
  // no las de todos los activos (un inmueble sin marcar es uso propio).
  const totalUnidades = useMemo(() => {
    let n = 0;
    for (const p of propiedadesActivas) {
      const e = p.id != null ? explotaciones.get(p.id) : undefined;
      if (e) n += unidadesDeExplotacion(e);
    }
    return n;
  }, [propiedadesActivas, explotaciones]);
  const unidadesLabel = totalUnidades === 1 ? 'unidad' : 'unidades';

  if (propiedadesActivas.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Calendar size={20} />}
        title="Sin propiedades alquilables"
        sub="Configura al menos un inmueble activo para ver la vista de disponibilidad."
        ctaLabel="Ir a Inmuebles"
        onCtaClick={onIrAInmuebles}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>
            Ocupación {RANGO_LABEL[rango]} · {totalUnidades} {unidadesLabel}
          </h2>
          <p className={styles.headSub}>
            Vista cronológica por inmueble · cada habitación con su color · click en un hueco para crear contrato · click en barra existente para ver detalle.
          </p>
        </div>
        <ToggleRango value={rango} onChange={setRango} />
      </div>

      <div className={styles.container}>
        <HeaderMeses rangoFechas={rangoFechas} />

        <div className={styles.bodyWrap}>
          <LineaHoy rangoFechas={rangoFechas} hoy={hoy} />
          {propiedadesActivas.map((p) => (
            <PropiedadGroup
              key={p.id ?? p.alias}
              propiedad={p}
              explotacion={p.id != null ? explotaciones.get(p.id) : undefined}
              contratos={contratos.filter((c) => c.inmuebleId === p.id)}
              rangoFechas={rangoFechas}
              hoy={hoy}
              onAbrirContrato={setContratoAbierto}
              onNuevoContrato={onNuevoContrato}
              onExplotacionCambio={recargarExplotaciones}
            />
          ))}
        </div>
      </div>

      <Leyenda />

      {contratoAbierto && (
        <DrawerFichaContrato
          contrato={contratoAbierto}
          inmuebleAlias={
            properties.find((p) => p.id === contratoAbierto.inmuebleId)?.alias
          }
          open
          onClose={() => setContratoAbierto(null)}
          onContratoActualizado={onContratoActualizado}
          onEditarContrato={onEditarContrato}
          onEliminarContrato={onEliminarContrato}
        />
      )}
    </div>
  );
};

// ─── Toggle rango ────────────────────────────────────────────────────────────

const ToggleRango: React.FC<{
  value: RangoTimeline;
  onChange: (r: RangoTimeline) => void;
}> = ({ value, onChange }) => (
  <div className={styles.toggle} role="radiogroup" aria-label="Rango temporal">
    {(['3m', '6m', '12m'] as RangoTimeline[]).map((r) => (
      <button
        key={r}
        type="button"
        className={`${styles.toggleBtn} ${value === r ? styles.toggleBtnActive : ''}`}
        onClick={() => onChange(r)}
        role="radio"
        aria-checked={value === r}
      >
        {r === '3m' ? '3 m' : r === '6m' ? '6 m' : '12 m'}
      </button>
    ))}
  </div>
);

// ─── Header de meses ────────────────────────────────────────────────────────

const HeaderMeses: React.FC<{ rangoFechas: RangoFechas }> = ({ rangoFechas }) => (
  <div className={styles.headerRow}>
    <div className={styles.headerLabCol}>Inmueble · habitación</div>
    <div
      className={styles.headerMonths}
      style={{
        gridTemplateColumns: `repeat(${rangoFechas.meses.length}, 1fr)`,
      }}
    >
      {rangoFechas.meses.map((m) => (
        <div key={`${m.ano}-${m.mes}`} className={styles.headerMonth}>
          {NOMBRES_MES[m.mes]} {String(m.ano).slice(-2)}
        </div>
      ))}
    </div>
  </div>
);

// ─── Línea HOY ──────────────────────────────────────────────────────────────

const LineaHoy: React.FC<{ rangoFechas: RangoFechas; hoy: Date }> = ({
  rangoFechas,
  hoy,
}) => {
  if (hoy < rangoFechas.inicio || hoy > rangoFechas.fin) return null;
  const leftPct = calcularLeftPorcentaje(hoy, rangoFechas);
  return (
    <div
      className={styles.todayLine}
      style={{ left: `${leftPct}%` }}
      aria-hidden
    >
      <div className={styles.todayLabel}>HOY</div>
    </div>
  );
};

// ─── PropiedadGroup ─────────────────────────────────────────────────────────

interface PropiedadGroupProps {
  propiedad: Property;
  explotacion?: ExplotacionAlquiler;
  contratos: Contract[];
  rangoFechas: RangoFechas;
  hoy: Date;
  onAbrirContrato: (c: Contract & { id: number }) => void;
  onNuevoContrato: (inmuebleId?: number) => void;
  onExplotacionCambio: () => void;
}

const PropiedadGroup: React.FC<PropiedadGroupProps> = ({
  propiedad,
  explotacion,
  contratos,
  rangoFechas,
  hoy,
  onAbrirContrato,
  onNuevoContrato,
  onExplotacionCambio,
}) => {
  // R3 · las habitaciones vienen de la explotación, no de `bedrooms`. Por
  // habitaciones → su lista; completo/turístico → `[]` (una sola línea "Piso").
  const { lineas, overlaysCompletos } = useMemo(() => {
    const habitaciones =
      explotacion?.modo === 'habitaciones' ? explotacion.habitaciones ?? [] : [];
    return generarPropiedadGroupData(
      propiedad,
      contratos,
      rangoFechas,
      hoy,
      explotacion ? habitaciones : undefined,
    );
  }, [propiedad, contratos, rangoFechas, hoy, explotacion]);

  // Un inmueble NO marcado como alquilable no está en el mercado: se muestra con
  // su control para ponerlo en alquiler, sin dibujar disponibilidad (uso propio).
  if (!explotacion) {
    return (
      <div className={styles.propGroup}>
        <PropiedadHeader
          propiedad={propiedad}
          explotacion={undefined}
          numHab={lineas.length}
          onExplotacionCambio={onExplotacionCambio}
        />
        <div className={styles.noAlquiler}>No está en alquiler · uso propio.</div>
      </div>
    );
  }

  return (
    <div className={styles.propGroup}>
      <PropiedadHeader
        propiedad={propiedad}
        explotacion={explotacion}
        numHab={lineas.length}
        onExplotacionCambio={onExplotacionCambio}
      />
      <div className={styles.lineasWrap}>
        {lineas.map((linea) => (
          <Linea
            key={linea.key}
            linea={linea}
            onClickHueco={(fecha) => {
              // Wizard sólo acepta ?inmueble= en main · prefill habitacion/fecha
              // se enviará por params auxiliares (T5.1) · de momento pasamos sólo inmueble
              void fecha;
              onNuevoContrato(propiedad.id ?? undefined);
            }}
            onClickContrato={onAbrirContrato}
          />
        ))}
        {overlaysCompletos.length > 0 && lineas.length > 1 && (
          <div
            className={styles.overlayLayer}
            style={{ height: `${lineas.length * 30}px` }}
          >
            {overlaysCompletos.map((ov) => (
              <Overlay
                key={ov.contrato.id}
                overlay={ov}
                onClick={() => onAbrirContrato(ov.contrato)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Header de una propiedad ────────────────────────────────────────────────

const PropiedadHeader: React.FC<{
  propiedad: Property;
  explotacion?: ExplotacionAlquiler;
  numHab: number;
  onExplotacionCambio: () => void;
}> = ({ propiedad, explotacion, onExplotacionCambio }) => (
  <div className={styles.propHead}>
    <div className={styles.propHeadLab}>
      <span className={styles.propAlias}>{propiedad.alias}</span>
      {propiedad.municipality ? (
        <span className={styles.propMeta}>{propiedad.municipality}</span>
      ) : null}
    </div>
    <ControlExplotacion
      propiedad={propiedad}
      explotacion={explotacion}
      onCambio={onExplotacionCambio}
    />
  </div>
);

// ─── Control de explotación · marcar / modo / estado / desmarcar ─────────────
//
// Aquí es donde se «pone y quita un inmueble del mercado» (Jose, 20 ago). Un
// inmueble sin explotación enseña «Poner en alquiler»; uno marcado enseña su
// modo y estado editables y un «Quitar del alquiler». Toda escritura recarga la
// lista en el padre.

const ControlExplotacion: React.FC<{
  propiedad: Property;
  explotacion?: ExplotacionAlquiler;
  onCambio: () => void;
}> = ({ propiedad, explotacion, onCambio }) => {
  const [guardando, setGuardando] = useState(false);
  const inmuebleId = propiedad.id;

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>) => {
      if (inmuebleId == null) return;
      setGuardando(true);
      try {
        await accion();
        onCambio();
      } finally {
        setGuardando(false);
      }
    },
    [inmuebleId, onCambio],
  );

  if (inmuebleId == null) return null;

  if (!explotacion) {
    return (
      <div className={styles.controlExplotacion}>
        <button
          type="button"
          className={styles.ponerEnAlquiler}
          disabled={guardando}
          onClick={() =>
            ejecutar(() =>
              marcarAlquilable(inmuebleId, { modo: 'completo', estado: 'vacante' }),
            )
          }
        >
          <Icons.Plus size={13} /> Poner en alquiler
        </button>
      </div>
    );
  }

  return (
    <div className={styles.controlColumna}>
      <div className={styles.controlExplotacion}>
        <label className={styles.controlCampo}>
          <span className={styles.controlLab}>Modo</span>
          <select
            className={styles.selectMini}
            value={explotacion.modo}
            disabled={guardando}
            onChange={(e) =>
              ejecutar(() =>
                marcarAlquilable(inmuebleId, {
                  modo: e.target.value as ModoExplotacionAlquiler,
                  estado: explotacion.estado,
                  numeroHabitaciones: propiedad.bedrooms ?? 1,
                }),
              )
            }
          >
            {(Object.keys(MODO_LABEL) as ModoExplotacionAlquiler[]).map((m) => (
              <option key={m} value={m}>
                {MODO_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.controlCampo}>
          <span className={styles.controlLab}>Estado</span>
          <select
            className={styles.selectMini}
            value={explotacion.estado}
            disabled={guardando}
            onChange={(e) =>
              ejecutar(() =>
                actualizarExplotacion(inmuebleId, {
                  estado: e.target.value as EstadoExplotacion,
                }),
              )
            }
          >
            {(Object.keys(ESTADO_LABEL) as EstadoExplotacion[]).map((s) => (
              <option key={s} value={s}>
                {ESTADO_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.linkInline}
          disabled={guardando}
          onClick={() => ejecutar(() => desmarcarAlquilable(inmuebleId))}
        >
          Quitar del alquiler
        </button>
      </div>
      {explotacion.modo === 'habitaciones' && (
        <EditorHabitaciones
          inmuebleId={inmuebleId}
          habitaciones={explotacion.habitaciones ?? []}
          guardando={guardando}
          ejecutar={ejecutar}
        />
      )}
    </div>
  );
};

// ─── Editor de habitaciones · nombre + renta objetivo + estado ───────────────

const EditorHabitaciones: React.FC<{
  inmuebleId: number;
  habitaciones: HabitacionAlquiler[];
  guardando: boolean;
  ejecutar: (accion: () => Promise<unknown>) => Promise<void>;
}> = ({ inmuebleId, habitaciones, guardando, ejecutar }) => (
  <div className={styles.editorHabitaciones}>
    {habitaciones.map((h) => (
      <div key={h.id} className={styles.habitacionFila}>
        <input
          className={styles.habInput}
          type="text"
          defaultValue={h.nombre}
          disabled={guardando}
          aria-label={`Nombre de ${h.nombre}`}
          onBlur={(e) => {
            const nombre = e.target.value.trim();
            if (nombre && nombre !== h.nombre) {
              ejecutar(() => actualizarHabitacion(inmuebleId, h.id, { nombre }));
            }
          }}
        />
        <div className={styles.habRenta}>
          <input
            className={styles.habInputNum}
            type="number"
            min={0}
            step={5}
            defaultValue={h.rentaObjetivo ?? ''}
            disabled={guardando}
            placeholder="renta"
            aria-label={`Renta objetivo de ${h.nombre}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              const rentaObjetivo = v === '' ? undefined : Number(v);
              if (rentaObjetivo !== h.rentaObjetivo) {
                ejecutar(() =>
                  actualizarHabitacion(inmuebleId, h.id, { rentaObjetivo }),
                );
              }
            }}
          />
          <span className={styles.habEuro}>€</span>
        </div>
        <select
          className={styles.selectMini}
          value={h.estado ?? 'operativo'}
          disabled={guardando}
          aria-label={`Estado de ${h.nombre}`}
          onChange={(e) =>
            ejecutar(() =>
              actualizarHabitacion(inmuebleId, h.id, {
                estado: e.target.value as EstadoExplotacion,
              }),
            )
          }
        >
          {(Object.keys(ESTADO_LABEL) as EstadoExplotacion[]).map((s) => (
            <option key={s} value={s}>
              {ESTADO_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.habQuitar}
          disabled={guardando}
          aria-label={`Quitar ${h.nombre}`}
          onClick={() => ejecutar(() => eliminarHabitacion(inmuebleId, h.id))}
        >
          <Icons.Delete size={13} />
        </button>
      </div>
    ))}
    <button
      type="button"
      className={styles.linkInline}
      disabled={guardando}
      onClick={() => ejecutar(() => anadirHabitacion(inmuebleId))}
    >
      + Añadir habitación
    </button>
  </div>
);

// ─── Línea (track + segmentos) ──────────────────────────────────────────────

const Linea: React.FC<{
  linea: LineaTimeline;
  onClickHueco: (fecha: Date) => void;
  onClickContrato: (c: Contract & { id: number }) => void;
}> = ({ linea, onClickHueco, onClickContrato }) => {
  // R3 · si la habitación tiene nombre propio (explotación) se usa; si no, «Hab N».
  const labelHab = linea.nombre?.trim()
    ? linea.nombre
    : linea.esPiso
      ? 'Piso'
      : `Hab ${linea.habitacionNumero}`;
  const enReforma = linea.estadoHabitacion === 'en_reforma';
  return (
    <div className={`${styles.row} ${enReforma ? styles.rowReforma : ''}`}>
      <div className={styles.rowLab}>
        <span
          className={styles.rowColor}
          style={{ background: CSS_COLOR_HABITACION[linea.color] }}
        />
        <span className={styles.rowName}>{labelHab}</span>
        <span className={styles.rowSuffix}>
          {enReforma ? 'en reforma' : linea.tipoLabel}
        </span>
      </div>
      <div className={styles.track}>
        {linea.segmentos.map((s, idx) => (
          <SegmentoBarra
            key={`${linea.key}-${idx}`}
            segmento={s}
            onClickHueco={onClickHueco}
            onClickContrato={onClickContrato}
          />
        ))}
      </div>
    </div>
  );
};

// ─── SegmentoBarra ──────────────────────────────────────────────────────────

const SegmentoBarra: React.FC<{
  segmento: Segmento;
  onClickHueco: (fecha: Date) => void;
  onClickContrato: (c: Contract & { id: number }) => void;
}> = ({ segmento, onClickHueco, onClickContrato }) => {
  if (segmento.widthPct <= 0) return null;
  const handleClick = (): void => {
    if (segmento.tipo === 'libre') onClickHueco(segmento.fechaInicioReal);
    else onClickContrato(segmento.contrato);
  };
  return (
    <div
      className={`${styles.bar} ${styles[`bar-${segmento.claseBarra}`]}`}
      style={{
        left: `${segmento.leftPct}%`,
        width: `${segmento.widthPct}%`,
      }}
      title={segmento.textoBarra}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={segmento.textoBarra}
    >
      <span className={styles.barText}>{segmento.textoBarra}</span>
    </div>
  );
};

// ─── Overlay piso completo ──────────────────────────────────────────────────

const Overlay: React.FC<{
  overlay: OverlayCompleto;
  onClick: () => void;
}> = ({ overlay, onClick }) => (
  <div
    className={`${styles.overlay} ${styles[`bar-${overlay.claseBarra}`]}`}
    style={{
      left: `${overlay.leftPct}%`,
      width: `${overlay.widthPct}%`,
    }}
    title={overlay.textoBarra}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
    role="button"
    tabIndex={0}
    aria-label={`Piso completo · ${overlay.textoBarra}`}
  >
    <span className={styles.barText}>{overlay.textoBarra}</span>
  </div>
);

// ─── Leyenda ────────────────────────────────────────────────────────────────

const Leyenda: React.FC = () => (
  <div className={styles.leyenda}>
    <LegendItem className="bar-vigente-l" label="Vigente · larga" />
    <LegendItem className="bar-vigente-c" label="Vigente · corta/vacacional" />
    <LegendItem className="bar-renovado" label="Renovado · últimos 30 d" />
    <LegendItem className="bar-pendiente-firma" label="Firma pendiente" />
    <LegendItem className="bar-impago" label="Impago" />
    <LegendItem className="bar-libre" label="Libre · click para crear contrato" />
  </div>
);

const LegendItem: React.FC<{ className: string; label: string }> = ({
  className,
  label,
}) => (
  <div className={styles.legendItem}>
    <span className={`${styles.legendSwatch} ${styles[className]}`} />
    <span className={styles.legendLab}>{label}</span>
  </div>
);

export default TabDisponibilidad;
export { TabDisponibilidad };
