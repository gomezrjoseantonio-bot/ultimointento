// T23.1 · Placeholder · `/inversiones/:posicionId`.
// Las fichas detalle dedicadas por tipo (`<FichaValoracionSimple>` ·
// `<FichaRendimientoPeriodico>` · `<FichaDividendos>`) las construye
// T23.3 · § 4 spec.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHead } from '../../../design-system/v5';
import { inversionesService } from '../../../services/inversionesService';
import type { PosicionInversion } from '../../../types/inversiones';
import { clasificarTipo, getTipoLabel } from '../helpers';
import styles from '../InversionesGaleria.module.css';

const FichaPosicionPage: React.FC = () => {
  const { posicionId } = useParams();
  const navigate = useNavigate();
  const [posicion, setPosicion] = useState<PosicionInversion | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    const id = Number(posicionId);
    if (!Number.isFinite(id)) {
      setPosicion(null);
      return;
    }
    inversionesService
      .getPosicion(id)
      .then((p) => {
        if (!cancelled) setPosicion(p ?? null);
      })
      .catch(() => {
        if (!cancelled) setPosicion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [posicionId]);

  return (
    <div className={styles.page}>
      <PageHead
        title={posicion ? posicion.nombre || posicion.entidad || 'Posición' : 'Posición'}
        sub={posicion ? getTipoLabel(posicion.tipo) : '—'}
        backLabel="Volver a Inversiones"
        onBack={() => navigate('/inversiones')}
      />
      <div
        style={{
          marginTop: 24,
          padding: 32,
          background: 'var(--atlas-v5-card)',
          border: '1px dashed var(--atlas-v5-line)',
          borderRadius: 'var(--atlas-v5-radius-lg)',
          color: 'var(--atlas-v5-ink-3)',
          fontSize: 13.5,
        }}
      >
        {posicion === undefined && 'Cargando…'}
        {posicion === null && 'No se ha encontrado la posición.'}
        {posicion && (
          <>
            <strong>TODO · T23.3</strong> · Ficha detalle dedicada para el grupo{' '}
            <code>{clasificarTipo(posicion.tipo)}</code>. Renderizará 4 KPIs
            (aportado · valor · rentabilidad · CAGR o equivalente) + sparkline o
            matriz de cobros + tabla de aportaciones + botones acción
            reutilizando los modales existentes (`ActualizarValorDialog` ·
            `AportacionFormDialog` · `PosicionFormDialog`).
          </>
        )}
      </div>
    </div>
  );
};

export default FichaPosicionPage;
