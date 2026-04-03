import React from 'react';
import type { InmuebleSupervision, TotalesCartera } from '../hooks/useSupervisionData';

interface PatrimonioTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const PatrimonioTab: React.FC<PatrimonioTabProps> = () => {
  return <div>Patrimonio — pendiente PASO 4</div>;
};

export default PatrimonioTab;
