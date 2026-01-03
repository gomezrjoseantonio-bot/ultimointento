import React from 'react';
import { useNavigate } from 'react-router-dom';
import InvestorDashboard from '../components/dashboard/InvestorDashboard';

/**
 * PanelPage - Dashboard principal del inversor
 * 
 * Muestra el InvestorDashboard con:
 * 1. Patrimonio neto total + variación
 * 2. 3 Bolsillos (Trabajo, Inmuebles, Inversiones)
 * 3. Liquidez con proyección 30d
 * 4. Alertas que requieren atención
 */
const PanelPage: React.FC = () => {
  const navigate = useNavigate();
  
  const handleNavigate = (route: string) => {
    navigate(route);
  };
  
  return <InvestorDashboard onNavigate={handleNavigate} />;
};

export default PanelPage;
