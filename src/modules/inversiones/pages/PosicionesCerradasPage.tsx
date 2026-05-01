// T23.1 · Placeholder · `/inversiones/cerradas`.
// La vista expandida con KPIs · sub-stats · filtros y cartas con narrativa
// inversor (sin lenguaje fiscal) la construye T23.4 · § 5 spec.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../../design-system/v5';
import styles from '../InversionesGaleria.module.css';

const PosicionesCerradasPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <PageHead
        title="Posiciones cerradas"
        sub="tu trayectoria como inversor"
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
        <strong>TODO · T23.4</strong> · Vista expandida de posiciones cerradas con
        narrativa de inversor (KPIs · tasa de acierto · CAGR ponderado · filtros
        por tipo / resultado / broker). La fuente de datos serán las operaciones
        del XML AEAT importado · expuestas con un adaptador que oculta el
        lenguaje fiscal.
      </div>
    </div>
  );
};

export default PosicionesCerradasPage;
