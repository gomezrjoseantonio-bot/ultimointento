// Wrapper v5 que monta el wizard `PrestamosWizard` legacy del horizon.
// La migración profunda del wizard se difiere a Phase 4 cleanup · aquí
// preservamos paridad funcional 100% con la versión actual.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PrestamosWizard from '../../horizon/financiacion/components/PrestamosWizard';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import { FeinToPrestamoMapper } from '../../../services/fein/feinToPrestamoMapper';
import type { FeinLoanDraft } from '../../../types/fein';
import type { PrestamoFinanciacion } from '../../../types/financiacion';

interface Props {
  /** Si `true`, monta el wizard precedido por el upload FEIN (mismo path interno). */
  withFEIN?: boolean;
}

const WizardCreatePage: React.FC<Props> = ({ withFEIN = false }) => {
  const navigate = useNavigate();
  const [feinData, setFeinData] = useState<Partial<PrestamoFinanciacion> | null>(null);
  const [stage, setStage] = useState<'fein' | 'wizard'>(withFEIN ? 'fein' : 'wizard');

  const handleFEINDraftReady = (draft: FeinLoanDraft) => {
    const mapped = FeinToPrestamoMapper.mapToPrestamoFinanciacion(draft);
    const info = FeinToPrestamoMapper.generateMappingInfo(draft);
    setFeinData(mapped);
    if (info.warnings.length > 0 || info.missingFields.length > 0) {
      const msg = [
        info.missingFields.length > 0 ? `Campos pendientes · ${info.missingFields.join(', ')}` : '',
        ...info.warnings.slice(0, 2),
      ]
        .filter(Boolean)
        .join('. ');
      if (msg) toast.error(`Datos extraídos del FEIN. ${msg}.`);
    }
    setStage('wizard');
  };

  const handleSuccess = () => navigate('/financiacion');
  const handleCancel = () => navigate('/financiacion');

  if (stage === 'fein') {
    return (
      <FEINUploader
        onFEINDraftReady={handleFEINDraftReady}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <PrestamosWizard
      prestamoId=""
      initialData={feinData || undefined}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
};

export default WizardCreatePage;
