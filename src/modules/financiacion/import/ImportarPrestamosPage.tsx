// Wrapper v5 que monta `ImportarPrestamos` legacy. Permite carga masiva
// de préstamos vía CSV. La migración profunda se difiere a Phase 4
// cleanup.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ImportarPrestamos from '../../../pages/account/migracion/ImportarPrestamos';

const ImportarPrestamosPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ImportarPrestamos
      onComplete={() => navigate('/financiacion/listado')}
      onBack={() => navigate('/financiacion')}
    />
  );
};

export default ImportarPrestamosPage;
