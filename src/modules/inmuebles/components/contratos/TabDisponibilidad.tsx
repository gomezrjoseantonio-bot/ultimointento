import React, { useMemo, useState } from 'react';
import { Icons, EmptyState } from '../../../../design-system/v5';
import type { Contract, Property } from '../../../../services/db';
import {
  type RangoTimeline,
  type RangoFechas,
  calcularRangoFechas,
  calcularLeftPorcentaje,
  contarUnidadesArrendables,
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

const TabDisponibilidad: React.FC<TabDisponibilidadProps> = ({
  contratos,
  properties,
  onNuevoContrato,
  onIrAInmuebles,
}) => {
  const [rango, setRango] = useState<RangoTimeline>('6m');
  const [contratoAbierto, setContratoAbierto] = useState<
    (Contract & { id: number }) | null
  >(null);

  const hoy = useMemo(() => new Date(), []);
  const rangoFechas = useMemo(() => calcularRangoFechas(rango, hoy), [rango, hoy]);

  const propiedadesAlquilables = useMemo(
    () => properties.filter((p) => !p.state || p.state === 'activo'),
    [properties],
  );

  const totalUnidades = useMemo(
    () => contarUnidadesArrendables(propiedadesAlquilables),
    [propiedadesAlquilables],
  );
  const unidadesLabel = totalUnidades === 1 ? 'unidad' : 'unidades';

  if (propiedadesAlquilables.length === 0) {
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
          {propiedadesAlquilables.map((p) => (
            <PropiedadGroup
              key={p.id ?? p.alias}
              propiedad={p}
              contratos={contratos.filter((c) => c.inmuebleId === p.id)}
              rangoFechas={rangoFechas}
              hoy={hoy}
              onAbrirContrato={setContratoAbierto}
              onNuevoContrato={onNuevoContrato}
              onIrAInmuebles={onIrAInmuebles}
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
  contratos: Contract[];
  rangoFechas: RangoFechas;
  hoy: Date;
  onAbrirContrato: (c: Contract & { id: number }) => void;
  onNuevoContrato: (inmuebleId?: number) => void;
  onIrAInmuebles: () => void;
}

const PropiedadGroup: React.FC<PropiedadGroupProps> = ({
  propiedad,
  contratos,
  rangoFechas,
  hoy,
  onAbrirContrato,
  onNuevoContrato,
  onIrAInmuebles,
}) => {
  const { lineas, overlaysCompletos } = useMemo(
    () => generarPropiedadGroupData(propiedad, contratos, rangoFechas, hoy),
    [propiedad, contratos, rangoFechas, hoy],
  );

  // Propiedad sin bedrooms declarado · empty state por propiedad
  if (propiedad.bedrooms == null) {
    return (
      <div className={styles.propGroup}>
        <div className={styles.propHead}>
          <div className={styles.propHeadLab}>
            <span className={styles.propAlias}>{propiedad.alias}</span>
          </div>
          <div className={styles.propMetaWarn}>
            Indica el número de habitaciones para ver disponibilidad ·{' '}
            <button
              type="button"
              className={styles.linkInline}
              onClick={onIrAInmuebles}
            >
              Configurar inmueble →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.propGroup}>
      <PropiedadHeader propiedad={propiedad} numHab={lineas.length} />
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

const PropiedadHeader: React.FC<{ propiedad: Property; numHab: number }> = ({
  propiedad,
  numHab,
}) => (
  <div className={styles.propHead}>
    <div className={styles.propHeadLab}>
      <span className={styles.propAlias}>{propiedad.alias}</span>
    </div>
    <div className={styles.propMeta}>
      {numHab === 1
        ? 'piso completo'
        : `${numHab} habitaciones`}
      {propiedad.municipality ? ` · ${propiedad.municipality}` : ''}
    </div>
  </div>
);

// ─── Línea (track + segmentos) ──────────────────────────────────────────────

const Linea: React.FC<{
  linea: LineaTimeline;
  onClickHueco: (fecha: Date) => void;
  onClickContrato: (c: Contract & { id: number }) => void;
}> = ({ linea, onClickHueco, onClickContrato }) => {
  const labelHab = linea.esPiso
    ? 'Piso'
    : `Hab ${linea.habitacionNumero}`;
  return (
    <div className={styles.row}>
      <div className={styles.rowLab}>
        <span
          className={styles.rowColor}
          style={{ background: CSS_COLOR_HABITACION[linea.color] }}
        />
        <span className={styles.rowName}>{labelHab}</span>
        <span className={styles.rowSuffix}>{linea.tipoLabel}</span>
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
