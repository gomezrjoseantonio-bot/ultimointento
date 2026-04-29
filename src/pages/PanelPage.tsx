import React from 'react';
import PanelV5 from '../modules/panel/PanelPage';

/**
 * PanelPage · entrada principal `/panel`. Migrada a v5 en T20 Fase 3g
 * (mockup `docs/audit-inputs/atlas-panel.html`).
 *
 * Sustituye el HorizonPanel legacy. El módulo legacy queda intacto en
 * `src/modules/horizon/panel/Panel.tsx` y se purga en Phase 4 cleanup.
 */
const PanelPage: React.FC = () => <PanelV5 />;

export default PanelPage;
