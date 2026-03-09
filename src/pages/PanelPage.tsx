import React from 'react';
import HorizonPanel from '../modules/horizon/panel/Panel';

/**
 * PanelPage - Entrada principal del panel (/panel)
 *
 * Importante: esta ruta debe renderizar el panel estratégico de Horizon.
 * Antes estaba conectado a InvestorDashboard (legacy), por eso en producción
 * se seguía viendo el dashboard antiguo.
 */
const PanelPage: React.FC = () => {
  return <HorizonPanel />;
};

export default PanelPage;
