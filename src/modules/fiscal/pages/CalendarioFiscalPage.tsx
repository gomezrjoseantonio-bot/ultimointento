// Vista detallada del calendario fiscal · placeholder.
// El Dashboard ya muestra la timeline 4 años; esta página será la vista
// completa con drill-down por modelo · 18 años · alertas · próximas
// presentaciones. Sub-tarea follow-up post 3f-B.

import React from 'react';
import { CardV5 } from '../../../design-system/v5';

const CalendarioFiscalPage: React.FC = () => (
  <CardV5>
    <CardV5.Title>Calendario fiscal completo</CardV5.Title>
    <CardV5.Subtitle>
      vista plurianual · drill-down por modelo · alertas
    </CardV5.Subtitle>
    <CardV5.Body>
      <div
        style={{
          padding: '32px 8px',
          textAlign: 'center',
          color: 'var(--atlas-v5-ink-4)',
          fontSize: 13,
        }}
      >
        La vista completa del calendario fiscal llega en una sub-tarea posterior.
        <br />
        Mientras tanto, la <strong>timeline 4 años</strong> en el dashboard cubre las
        obligaciones del ejercicio en curso y los 3 anteriores.
      </div>
    </CardV5.Body>
  </CardV5>
);

export default CalendarioFiscalPage;
