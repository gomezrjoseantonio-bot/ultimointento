import React, { useState, useMemo } from 'react';
import { Search, Book, X } from 'lucide-react';
import { TECHNICAL_TERMS } from './Tooltip';

/**
 * ATLAS Glossary Component
 * Sprint 3: UX improvement for navigation and comprehension
 * 
 * Provides an accessible glossary of technical terms
 */

interface GlossaryProps {
  inline?: boolean;
  selectedTerm?: string;
  onClose?: () => void;
}

export const Glossary: React.FC<GlossaryProps> = ({ 
  inline = false, 
  selectedTerm,
  onClose 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Organize terms by category
  const categorizedTerms = useMemo(() => {
    const categories = {
      'financial': {
        name: 'Financiero y Propiedades',
        terms: ['inmueble', 'vacacional', 'lar', 'rentabilidad', 'reforma', 'tesorería', 'conciliación', 'extracto']
      },
      'modules': {
        name: 'Módulos ATLAS',
        terms: ['horizon', 'pulse', 'dashboard', 'kpi', 'proyección']
      },
      'tax': {
        name: 'Fiscal y Contable',
        terms: ['irpf', 'tributación', 'iae']
      },
      'documents': {
        name: 'Gestión Documental',
        terms: ['inbox', 'clasificación', 'ocr', 'fein']
      }
    };

    return categories;
  }, []);

  // Filter terms based on search query
  const filteredTerms = useMemo(() => {
    const allTerms = Object.keys(TECHNICAL_TERMS) as Array<keyof typeof TECHNICAL_TERMS>;
    
    return allTerms.filter(term => {
      const matchesSearch = searchQuery === '' || 
        term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        TECHNICAL_TERMS[term].toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeCategory === 'all') return matchesSearch;
      
      const categoryTerms = categorizedTerms[activeCategory as keyof typeof categorizedTerms]?.terms || [];
      return matchesSearch && categoryTerms.includes(term);
    });
  }, [searchQuery, activeCategory, categorizedTerms]);

  // Get category for a term
  const getCategoryForTerm = (term: string): string => {
    for (const [, category] of Object.entries(categorizedTerms)) {
      if (category.terms.includes(term)) {
        return category.name;
      }
    }
    return 'Otros';
  };

  const renderContent = () => (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5"
            style={{ color: 'var(--hz-neutral-500)' }}
          />
          <input
            type="text"
            placeholder="Buscar término..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
            style={{ 
              borderColor: 'var(--hz-neutral-300)',
              backgroundColor: 'var(--hz-bg)',
            }}
            aria-label="Buscar en el glosario"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            activeCategory === 'all'
              ? 'font-medium'
              : 'hover:bg-gray-100'
          }`}
          style={{
            backgroundColor: activeCategory === 'all' ? 'var(--hz-primary)' : 'transparent',
            color: activeCategory === 'all' ? 'white' : 'var(--hz-text)',
          }}
        >
          Todos
        </button>
        {Object.entries(categorizedTerms).map(([key, category]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeCategory === key
                ? 'font-medium'
                : 'hover:bg-gray-100'
            }`}
            style={{
              backgroundColor: activeCategory === key ? 'var(--hz-primary)' : 'transparent',
              color: activeCategory === key ? 'white' : 'var(--hz-text)',
            }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Terms List */}
      <div className="space-y-4">
        {filteredTerms.length === 0 ? (
          <div className="text-center py-12">
            <Book className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--hz-neutral-400)' }} />
            <p className="text-sm" style={{ color: 'var(--hz-neutral-600)' }}>
              No se encontraron términos
            </p>
          </div>
        ) : (
          filteredTerms.map((term) => (
            <div
              key={term}
              className={`p-4 border rounded-lg transition-colors ${
                selectedTerm === term ? 'ring-2' : ''
              }`}
              style={{ 
                borderColor: selectedTerm === term ? 'var(--hz-primary)' : 'var(--hz-neutral-300)',
                backgroundColor: selectedTerm === term ? 'rgba(4, 44, 94, 0.05)' : 'white',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 
                      className="text-base font-semibold capitalize"
                      style={{ color: 'var(--hz-text)' }}
                    >
                      {term.toUpperCase()}
                    </h3>
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: 'var(--hz-neutral-200)',
                        color: 'var(--hz-neutral-700)'
                      }}
                    >
                      {getCategoryForTerm(term)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--hz-neutral-700)' }}>
                    {TECHNICAL_TERMS[term as keyof typeof TECHNICAL_TERMS]}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (inline) {
    return <div className="w-full">{renderContent()}</div>;
  }

  // Full page/modal view
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--hz-primary)', color: 'white' }}
          >
            <Book className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--hz-text)' }}>
              Glosario de Términos
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--hz-neutral-600)' }}>
              Definiciones de conceptos financieros y técnicos de ATLAS
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cerrar glosario"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {renderContent()}
    </div>
  );
};

export default Glossary;
