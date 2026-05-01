// Wrapper v5 que monta `ImportarAportaciones` legacy. La migración
// profunda se difiere a Phase 4 cleanup · aquí preservamos paridad
// funcional 100% para que el importador sea accesible desde el header
// v5 de Inversiones.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ImportarAportaciones from '../../../pages/account/migracion/ImportarAportaciones';

const ImportarAportacionesPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ImportarAportaciones
      onComplete={() => navigate('/inversiones')}
      onBack={() => navigate('/inversiones')}
    />
  );
};

export default ImportarAportacionesPage;
