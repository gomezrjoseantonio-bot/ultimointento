import React from 'react';
import InvestorDashboard from '../components/dashboard/InvestorDashboard';

/**
 * PanelPage - Dashboard principal del inversor
 * 
 * Muestra el InvestorDashboard con los 3 bolsillos:
 * 1. Liquidez (saldo + proyección)
 * 2. Rentabilidad (KPIs principales)
 * 3. Alertas (items que requieren atención)
 */
const PanelPage: React.FC = () => {
  return <InvestorDashboard />;
};

export default PanelPage;
