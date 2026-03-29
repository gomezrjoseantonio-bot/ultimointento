import React from 'react';
import { BookOpen } from 'lucide-react';
import PageLayout from '../components/common/PageLayout';
import { Glossary } from '../components/common/Glossary';

const GlossaryPage: React.FC = () => {
  return (
    <PageLayout
      title="Glosario"
      subtitle="Definiciones de conceptos financieros y técnicos"
      icon={BookOpen}
    >
      <Glossary />
    </PageLayout>
  );
};

export default GlossaryPage;
