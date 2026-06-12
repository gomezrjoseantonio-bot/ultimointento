// Wrapper v5 que monta `ImportarIndexaCapital` legacy. Importa los datos
// históricos (aportaciones · valoraciones · IndexaCapital). La migración
// profunda se difiere a Phase 4 cleanup.

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImportarIndexaCapital from '../../../pages/account/migracion/ImportarIndexaCapital';

const ImportarIndexaCapitalPage: React.FC = () => {
  const navigate = useNavigate();
  // FIX onboarding PUNTO 7 (P1) · si venimos de /empezar, al completar volvemos
  // al bloque con `?done` (cierra el bucle) · al cancelar, sin marcar.
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';
  return (
    <ImportarIndexaCapital
      onComplete={() => navigate(fromEmpezar ? '/empezar/inversiones?done=import' : '/inversiones', fromEmpezar ? { replace: true } : undefined)}
      onBack={() => navigate(fromEmpezar ? '/empezar/inversiones' : '/inversiones', fromEmpezar ? { replace: true } : undefined)}
    />
  );
};

export default ImportarIndexaCapitalPage;
