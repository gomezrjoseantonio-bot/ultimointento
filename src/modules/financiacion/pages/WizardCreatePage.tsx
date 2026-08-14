// S-WIZARD-PRESTAMO-V2 · wrapper de creación.
// Monta la pantalla única ATLAS v8 (`PrestamoPageV2`). En el modo "con FEIN"
// primero presenta el upload FEIN y, al obtener un draft, hidrata la pantalla.

import React, { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import { prestamoDesdeDraft } from '../../../services/fein/prestamoDesdeDraft';
import type { FeinLoanDraft } from '../../../types/fein';
import type { Prestamo } from '../../../types/prestamos';
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
  // La ficha de inmueble abre este asistente prerrellenado por `location.state`
  // (`initialData` = el inmueble como destino/garantía + importe) y con `volverA`
  // para regresar a la ficha tras crear el préstamo. Si no viene de ahí, el
  // comportamiento es el de siempre.
  const location = useLocation();
  const navState = (location.state ?? null) as
    | { initialData?: Partial<Prestamo>; volverA?: string }
    | null;
  const backTarget =
    navState?.volverA ??
    (searchParams.get('from') === 'empezar' ? '/empezar/prestamos' : '/financiacion');
  const [feinData, setFeinData] = useState<Partial<Prestamo> | null>(null);
  const [stage, setStage] = useState<'fein' | 'wizard'>(withFEIN ? 'fein' : 'wizard');

  const handleFEINDraftReady = (draft: FeinLoanDraft) => {
    // Sin escalas · el borrador va directo al tipo bueno. Pasaba antes por
    // `PrestamoFinanciacion`, que no tiene dónde poner el valor del índice, la
    // base de cálculo ni la tasación: los tres se leían y se perdían ahí.
    setFeinData(prestamoDesdeDraft(draft));

    // Lo que el modelo dijo que NO encontró, y los números con los que el banco
    // se deja comprobar. Es tan útil como los datos.
    const notas = draft.metadata.warnings ?? [];
    if (notas.length > 0) toast(notas.join(' · '), { duration: 8000 });
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
      initialData={feinData || navState?.initialData || undefined}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
};

export default WizardCreatePage;
