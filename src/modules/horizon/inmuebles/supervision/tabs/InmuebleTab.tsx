import React from 'react';
import type { InmuebleSupervision, TotalesCartera } from '../hooks/useSupervisionData';

interface InmuebleTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const InmuebleTab: React.FC<InmuebleTabProps> = () => {
  return <div>Inmueble — pendiente PASO 6</div>;
};

export default InmuebleTab;
