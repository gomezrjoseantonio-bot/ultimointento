import React from 'react';
import TesoreriaSupervisionPage from './TesoreriaSupervisionPage';

/**
 * ATLAS HORIZON - Treasury supervision entry point.
 * Route: /tesoreria
 * Two sub-tabs: Evolución (multi-year overview) + Balances bancarios (read-only)
 */
const Tesoreria: React.FC = () => <TesoreriaSupervisionPage />;

export default Tesoreria;
