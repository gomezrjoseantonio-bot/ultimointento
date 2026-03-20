import React, { useEffect, useMemo } from 'react';
import { useProyeccionAutomatica } from '../hooks/useProyeccionAutomatica';
import ProyeccionFooterWarning from './ProyeccionFooterWarning';
import FlujoCajaChart from './FlujoCajaChart';
import ProyeccionKPICards from './ProyeccionKPICards';
import ProyeccionTable from './ProyeccionTable';

import type { ProyeccionMensualData } from '../types/ProyeccionData';

interface ProyeccionAutomaticaViewProps {
  year: number;
  onDataReady?: (data: ProyeccionMensualData | null) => void;
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export default function ProyeccionAutomaticaView({ year, onDataReady }: ProyeccionAutomaticaViewProps) {
  const { data, isLoading, error } = useProyeccionAutomatica(year);

  useEffect(() => {
    onDataReady?.(data);
  }, [data, onDataReady]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return MESES.map((mes, index) => ({
      mes,
      flujo: data.flujoCaja[index] ?? 0,
      caja: data.cajaFinal[index] ?? 0,
    }));
  }, [data]);

  if (isLoading) {
    return <div className="proyeccion-status">Calculando proyección automática…</div>;
  }

  if (error) {
    return <div className="proyeccion-error">{error}</div>;
  }

  if (!data) {
    return <div className="proyeccion-empty">No hay datos de proyección para este año.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
      <ProyeccionKPICards data={data} />
      <FlujoCajaChart data={chartData} year={year} />
      <ProyeccionTable data={data} year={year} />
      <ProyeccionFooterWarning flujoCaja={data.flujoCaja} />
    </div>
  );
}
