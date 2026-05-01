// Wrapper v5 que monta `ImportarIndexaCapital` legacy. Importa los datos
// históricos (aportaciones · valoraciones · IndexaCapital). La migración
// profunda se difiere a Phase 4 cleanup.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ImportarIndexaCapital from '../../../pages/account/migracion/ImportarIndexaCapital';

const ImportarIndexaCapitalPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ImportarIndexaCapital
      onComplete={() => navigate('/inversiones')}
      onBack={() => navigate('/inversiones')}
    />
  );
};

export default ImportarIndexaCapitalPage;
