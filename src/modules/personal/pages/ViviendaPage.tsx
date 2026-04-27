import React from 'react';
import { CardV5, EmptyState, Icons } from '../../../design-system/v5';

/**
 * Mi vivienda · pestaña pendiente de implementación completa.
 *
 * El modelo de datos `viviendaHabitual` está descrito en
 * docs/audit-inputs/ATLAS-Personal-modelo-datos-v1.md sección 6 pero el
 * store NO existe todavía en `services/db.ts`. Esta sub-tarea (20.3b)
 * NO toca DB ni servicios (regla §0.7 spec).
 *
 * TODO formal · sub-tarea follow-up de Personal · crear store
 * `viviendaHabitual` + UI completa con compromisos derivados (alquiler ·
 * cuota hipoteca · IBI · comunidad · seguro vivienda).
 */
const ViviendaPage: React.FC = () => {
  return (
    <>
      <CardV5 accent="gold-soft" style={{ marginBottom: 14 }}>
        <CardV5.Title>Mi vivienda</CardV5.Title>
        <CardV5.Subtitle>
          datos de la vivienda donde vive el hogar · genera compromisos derivados automáticos
        </CardV5.Subtitle>
        <CardV5.Body>
          <EmptyState
            icon={<Icons.Inmuebles size={20} />}
            title="Store viviendaHabitual pendiente"
            sub={
              <>
                El modelo de datos exhaustivo está en docs/audit-inputs/
                ATLAS-Personal-modelo-datos-v1.md (sección 6). El store
                `viviendaHabitual` se creará en sub-tarea follow-up cuando se
                amplíe DB · esta sub-tarea (20.3b) NO toca DB ni servicios per
                §0.7 spec.
                <br />
                <br />
                Mientras tanto · si tu vivienda habitual es propia y está
                registrada como inmueble · gestiónala desde Inmuebles. Si es
                en alquiler · da de alta el alquiler como compromiso recurrente
                en la pestaña Gastos.
              </>
            }
          />
        </CardV5.Body>
      </CardV5>
    </>
  );
};

export default ViviendaPage;
