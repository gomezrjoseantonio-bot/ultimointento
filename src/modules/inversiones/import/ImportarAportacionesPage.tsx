// Wrapper v5 que monta `ImportarAportaciones` legacy. La migración
// profunda se difiere a Phase 4 cleanup · aquí preservamos paridad
// funcional 100% para que el importador sea accesible desde el header
// v5 de Inversiones.

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImportarAportaciones from '../../../pages/account/migracion/ImportarAportaciones';

const ImportarAportacionesPage: React.FC = () => {
  const navigate = useNavigate();
  // FIX onboarding PUNTO 7 (P1) · si venimos de /empezar, al completar volvemos
  // al bloque con `?done` (cierra el bucle) · al cancelar, sin marcar.
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';
  return (
    <ImportarAportaciones
      onComplete={() => navigate(fromEmpezar ? '/empezar/inversiones?done=import' : '/inversiones')}
      onBack={() => navigate(fromEmpezar ? '/empezar/inversiones' : '/inversiones')}
    />
  );
};

export default ImportarAportacionesPage;
