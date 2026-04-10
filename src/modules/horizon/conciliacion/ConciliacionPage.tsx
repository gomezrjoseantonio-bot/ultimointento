import React from 'react';
import TesoreriaV4 from '../../../components/treasury/TesoreriaV4';

/**
 * ATLAS HORIZON — Conciliación entry point.
 * Route: /conciliacion
 * Shows only Punteo mensual + Cuentas bancarias tabs (no Evolución).
 */
const ConciliacionPage: React.FC = () => <TesoreriaV4 conciliacionMode />;

export default ConciliacionPage;
