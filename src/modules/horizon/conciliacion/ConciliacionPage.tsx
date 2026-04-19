import React from 'react';
import ConciliacionPageV2 from './v2/ConciliacionPageV2';

/**
 * ATLAS HORIZON — Conciliación entry point.
 * Route: /conciliacion
 *
 * PR5: rediseño completo de la pantalla.
 * Timeline por día · rentas agrupadas · punteo inline · documentos inline
 * con mini-popover drag-and-drop. TesoreriaV4 sigue atendiendo /tesoreria.
 */
const ConciliacionPage: React.FC = () => <ConciliacionPageV2 />;

export default ConciliacionPage;
