import React from 'react';
import TesoreriaV4 from '../../../components/treasury/TesoreriaV4';

/**
 * ATLAS HORIZON - Treasury entry point.
 * TesoreriaV4 handles tab routing internally:
 *  - Default (no ?año)  → Evolución tab (multi-year overview)
 *  - ?año=YYYY          → Flujo de caja tab for that year
 */
const Tesoreria: React.FC = () => <TesoreriaV4 />;

export default Tesoreria;
