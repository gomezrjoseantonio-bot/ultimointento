// S-WIZARD-PRESTAMO-V2 · wrapper de creación.
// Monta la pantalla única ATLAS v8 (`PrestamoPageV2`). En el modo "con FEIN"
// primero presenta el upload FEIN y, al obtener un draft, hidrata la pantalla.

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import { FeinToPrestamoMapper } from '../../../services/fein/feinToPrestamoMapper';
import type { FeinLoanDraft } from '../../../types/fein';
import type { PrestamoFinanciacion } from '../../../types/financiacion';
import PrestamoPageV2 from '../wizards/PrestamoPageV2';

interface Props {
  /** Si `true`, monta el wizard precedido por el upload FEIN. */
  withFEIN?: boolean;
}

const WizardCreatePage: React.FC<Props> = ({ withFEIN = false }) => {
  const navigate = useNavigate();
  // FIX PUNTO 5 · cuando el alta se lanza desde el bloque préstamos del
  // onboarding (`?from=empezar`), al guardar/cancelar se vuelve SOBRE el flujo
  // (`/empezar/prestamos`) en vez de a Financiación · el bloque se marca solo
  // al re-montar /empezar (syncBloquesFromData detecta ≥1 préstamo). El wizard
  // (PrestamoPageV2) queda intacto · solo cambia el destino de navegación.
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get('from') === 'empezar' ? '/empezar/prestamos' : '/financiacion';
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

  const handleSuccess = () => navigate(backTarget);
  const handleCancel = () => navigate(backTarget);

  if (stage === 'fein') {
    return (
      <FEINUploader
        onFEINDraftReady={handleFEINDraftReady}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <PrestamoPageV2
      initialData={feinData || undefined}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
};

export default WizardCreatePage;
