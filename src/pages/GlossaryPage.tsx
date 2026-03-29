import React from 'react';
import { BookOpen } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { Glossary } from '../components/common/Glossary';

const GlossaryPage: React.FC = () => {
  return (
    <div>
      <PageHeader icon={BookOpen} title="Glosario" />
      <div className="p-6">
        <Glossary />
      </div>
    </div>
  );
};

export default GlossaryPage;
