import React from 'react';
import { useSearchParams } from 'react-router-dom';
import TesoreriaV4 from '../../../components/treasury/TesoreriaV4';
import TreasuryEvolucion from '../../../components/treasury/TreasuryEvolucion';

/**
 * ATLAS HORIZON - Treasury Router Component
 *
 * - Default (no params)   → TreasuryEvolucion: multi-year historical overview
 * - ?año=YYYY             → TesoreriaV4: monthly reconciliation view for that year
 */
const Tesoreria: React.FC = () => {
  const [searchParams] = useSearchParams();
  const añoParam = searchParams.get('año');

  if (añoParam) {
    return <TesoreriaV4 />;
  }

  return <TreasuryEvolucion />;
};

export default Tesoreria;
