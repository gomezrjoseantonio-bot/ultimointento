import React from 'react';
import PageHeader from '../components/common/PageHeader';
import { Glossary } from '../components/common/Glossary';

/**
 * Glossary Page - Sprint 3: Navigation & Feedback
 * Provides an accessible, searchable glossary of ATLAS technical terms
 */
const GlossaryPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--hz-bg)' }}>
      <PageHeader
        title="Glosario"
        subtitle="Definiciones de conceptos financieros y técnicos utilizados en ATLAS"
        breadcrumb={[
          { name: 'Panel', href: '/' },
          { name: 'Glosario', href: '/glosario' }
        ]}
      />
      
      <div className="px-6 py-6">
        <Glossary />
      </div>
    </div>
  );
};

export default GlossaryPage;
