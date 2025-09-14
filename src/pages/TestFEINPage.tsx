import React from 'react';
import FEINUploader from '../components/financiacion/FEINUploader';
import { FeinLoanDraft } from '../types/fein';

const TestFEINPage: React.FC = () => {
  const handleDraftReady = (draft: FeinLoanDraft) => {
    console.log('FEIN Draft received:', draft);
    alert(`FEIN processed successfully! Extracted data for ${draft.prestamo.banco || 'Unknown bank'}`);
  };

  const handleCancel = () => {
    alert('FEIN upload cancelled');
  };

  return (
    <div>
      <FEINUploader
        onFEINDraftReady={handleDraftReady}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default TestFEINPage;