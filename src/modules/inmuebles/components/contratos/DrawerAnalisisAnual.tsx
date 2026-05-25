import React, { useMemo } from 'react';
import { Icons } from '../../../../design-system/v5';
import type { Contract, Property } from '../../../../services/db';
import ContratosDrawer from './ContratosDrawer';
import {
  calcularDatosAnuales,
  esPropiedadAlquilable,
  NOMBRES_MES_CORTO,
  type DatosAnuales,
  type MesHeatmap,
} from '../../utils/calcularDatosAnuales';
import styles from './DrawerAnalisisAnual.module.css';

export interface DrawerAnalisisAnualProps {
  open: boolean;
  onClose: () => void;
  contratos: Contract[];
  properties: Property[];
}

const fmtEuros = (n: number): string => new Intl.NumberFormat('es-ES').format(n);

const DrawerAnalisisAnual: React.FC<DrawerAnalisisAnualProps> = ({
  open,
  onClose,
  contratos,
  properties,
}) => {
  const ano = useMemo(() => new Date().getFullYear(), []);
  const datos = useMemo(
    () => calcularDatosAnuales(contratos, properties, ano),
    [contratos, properties, ano],
  );
  const hayAlquilables = useMemo(
    () => properties.some(esPropiedadAlquilable),
    [properties],
  );

  const perdidos = datos.ingresosPerdidosProyectados;
  const stats = [
    { label: 'Ocupación media', value: `${Math.round(datos.ocupacionMedia * 100)} %` },
    { label: 'Objetivo', value: `${Math.round(datos.objetivo * 100)} %` },
    { label: 'Días vacíos proyectados', value: `~ ${datos.diasVaciosProyectados}` },
    {
      label: 'Ingresos perdidos proyectados',
      value: (
        <span className={perdidos > 0 ? styles.statNeg : undefined}>
          {perdidos > 0 ? `− ${fmtEuros(perdidos)} €` : '0 €'}
        </span>
      ),
    },
  ];

  return (
    <ContratosDrawer
      open={open}
      onClose={onClose}
      wide
      tone="muted"
      label="Análisis"
      title={`Ocupación anual · ${ano}`}
      sub="% de unidades ocupadas día a día · detecta patrones estacionales"
      stats={stats}
    >
      {hayAlquilables ? (
        <>
          <HeatmapAnual datos={datos} />
          <LeyendaHeatmap />
        </>
      ) : (
        <EmptyStateAnual />
      )}
    </ContratosDrawer>
  );
};

const HeatmapAnual: React.FC<{ datos: DatosAnuales }> = ({ datos }) => {
  const mesActual = new Date().getMonth() + 1;
  return (
    <div
      className={styles.heatmap}
      role="grid"
      aria-label="Mapa de calor de ocupación anual · 12 meses por 31 días"
    >
      <div className={styles.dayHeaderRow} role="row" aria-hidden="true">
        <div className={styles.corner} />
        {Array.from({ length: 31 }, (_, i) => (
          <div key={i} className={styles.dayHeaderCell}>
            {i + 1}
          </div>
        ))}
      </div>
      {datos.meses.map((mes) => (
        <FilaMes key={mes.numero} mes={mes} esActual={mes.numero === mesActual} />
      ))}
    </div>
  );
};

const FilaMes: React.FC<{ mes: MesHeatmap; esActual: boolean }> = ({ mes, esActual }) => (
  <div className={styles.monthRow} role="row">
    <div
      className={`${styles.monthLabel} ${esActual ? styles.monthLabelActual : ''}`}
    >
      {NOMBRES_MES_CORTO[mes.numero - 1]}
    </div>
    {mes.celdas.map((celda) => (
      <div
        key={celda.dia}
        className={[
          styles.cell,
          styles[celda.clase],
          celda.esHoy ? styles.cellToday : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-tip={celda.tooltip || undefined}
        role="gridcell"
        aria-label={celda.existe ? celda.tooltip : undefined}
        tabIndex={celda.existe ? 0 : -1}
      />
    ))}
  </div>
);

const ESCALA: Array<'o0' | 'o60' | 'o70' | 'o80' | 'o90' | 'o100'> = [
  'o0', 'o60', 'o70', 'o80', 'o90', 'o100',
];

const LeyendaHeatmap: React.FC = () => (
  <div className={styles.legend}>
    <span className={styles.legendLab}>Menos ocupado</span>
    <div className={styles.legendScale} aria-hidden="true">
      {ESCALA.map((c) => (
        <div key={c} className={`${styles.legendCell} ${styles[c]}`} />
      ))}
    </div>
    <span className={styles.legendLab}>Más ocupado</span>
  </div>
);

const EmptyStateAnual: React.FC = () => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon} aria-hidden="true">
      <Icons.Calendar size={28} strokeWidth={1.6} />
    </div>
    <h3 className={styles.emptyTitle}>Sin propiedades alquilables</h3>
    <p className={styles.emptySub}>
      Configura al menos un inmueble como activo e indica su número de
      habitaciones para ver el análisis anual.
    </p>
  </div>
);

export default DrawerAnalisisAnual;
export { DrawerAnalisisAnual };
