// Wrapper v5 que monta el wizard de edición de préstamo (legacy horizon).

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PrestamosWizard from '../../horizon/financiacion/components/PrestamosWizard';

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
    <PrestamosWizard
      prestamoId={id}
      onSuccess={() => navigate(`/financiacion/${id}`)}
      onCancel={() => navigate(`/financiacion/${id}`)}
    />
  );
};

export default WizardEditPage;
