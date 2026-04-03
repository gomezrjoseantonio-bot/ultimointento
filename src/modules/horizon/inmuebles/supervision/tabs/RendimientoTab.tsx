import React from 'react';
import type { InmuebleSupervision, TotalesCartera } from '../hooks/useSupervisionData';

interface RendimientoTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const RendimientoTab: React.FC<RendimientoTabProps> = () => {
  return <div>Rendimiento — pendiente PASO 5</div>;
};

export default RendimientoTab;
