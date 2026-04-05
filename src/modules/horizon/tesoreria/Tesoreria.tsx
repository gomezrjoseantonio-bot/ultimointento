import React from 'react';
import TesoreriaV4 from '../../../components/treasury/TesoreriaV4';

/**
 * ATLAS HORIZON - Treasury Router Component (V4)
 *
 * Redesigned treasury view under GESTIÓN section:
 * - Navy header with KPIs
 * - Tabs: Flujo de caja / Cuentas bancarias
 * - Annual 12-month grid + monthly reconciliation view
 */
const Tesoreria: React.FC = () => {
  return <TesoreriaV4 />;
};

export default Tesoreria;