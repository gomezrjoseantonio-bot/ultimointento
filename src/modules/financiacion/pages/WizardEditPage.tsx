// S-WIZARD-PRESTAMO-V2 · wrapper de edición.
// Monta la pantalla única ATLAS v8 (`PrestamoPageV2`) pasando el id.

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PrestamoPageV2 from '../wizards/PrestamoPageV2';

const WizardEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div style={{ padding: 24, color: 'var(--atlas-v5-ink-4)' }}>
        ID de préstamo no especificado.
      </div>
    );
  }

  return (
    <PrestamoPageV2
      prestamoId={id}
      onSuccess={() => navigate(`/financiacion/${id}`)}
      onCancel={() => navigate(`/financiacion/${id}`)}
    />
  );
};

export default WizardEditPage;
