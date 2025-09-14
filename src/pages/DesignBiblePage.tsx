import React from 'react';
import { ExternalLink, Book, Palette, Component, Users, Settings, CheckSquare, Code, GitBranch } from 'lucide-react';

const DesignBiblePage: React.FC = () => {
  const sections = [
    {
      title: 'Foundations',
      icon: Palette,
      description: 'Tokens y fundamentos (colores, tipografía, iconos, espaciado)',
      items: [
        'Color Tokens ATLAS',
        'Typography (Inter)',
        'Iconography (Lucide)',
        'Spacing System (4px grid)',
        'Formatos ES'
      ]
    },
    {
      title: 'Components',
      icon: Component,
      description: 'Guías de cada componente UI',
      items: [
        'Buttons (primario, secundario, destructivo)',
        'Chips/Badges',
        'Alerts/Toasts/Modals',
        'Tables & Forms',
        'Cards & Empty States'
      ]
    },
    {
      title: 'Patterns',
      icon: GitBranch,
      description: 'Patrones de interacción y UX',
      items: [
        'SUA Help (4 patrones únicos)',
        'Confirmaciones destructivas',
        'Carga/Progreso',
        'Importar/Subir',
        'Navegación canónica'
      ]
    },
    {
      title: 'Content',
      icon: Book,
      description: 'Tono de voz y formatos de contenido',
      items: [
        'Tono: directo, profesional, empático',
        'Microcopy y placeholders',
        'Formato ES (1.234,56 €)',
        'Lenguaje usuario',
        'Capitalización'
      ]
    },
    {
      title: 'Accessibility',
      icon: Users,
      description: 'Normas WCAG AA/AAA',
      items: [
        'Contraste WCAG AA (4.5:1)',
        'Navegación por teclado',
        'ARIA labels y roles',
        'Screen readers',
        'Touch targets (44px)'
      ]
    },
    {
      title: 'Governance',
      icon: Settings,
      description: 'Proceso de cambios y versionado',
      items: [
        'Versionado semántico',
        'Proceso de cambios',
        'Roles y responsabilidades',
        'Métricas y adoption',
        'Comunicación'
      ]
    },
    {
      title: 'Checklists',
      icon: CheckSquare,
      description: 'Listas de validación rápidas',
      items: [
        'Checklist por pantalla',
        'Checklist por feature',
        'CI Compliance',
        'Release checklist',
        'QA validation'
      ]
    },
    {
      title: 'CI Audit',
      icon: Code,
      description: 'Validaciones automáticas bloqueantes',
      items: [
        'No hardcoded colors',
        'Solo iconos Lucide',
        'Solo font Inter',
        'No dark themes',
        'Sidebar order correcto'
      ]
    }
  ];

  const handleSectionClick = (sectionTitle: string) => {
    const fileName = sectionTitle.toLowerCase();
    const url = `/design-bible/${fileName}/README.md`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-atlas-teal flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <h1 className="text-2xl font-bold text-atlas-navy-1">
                  ATLAS Design Bible
                </h1>
                <p className="text-sm text-text-gray">
                  La única fuente de verdad para el diseño visual y experiencia de usuario
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-ok/10 text-ok text-sm font-medium rounded-full">
                v1.0.0
              </span>
              <button
                onClick={() => window.close()}
                className="atlas-btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Introduction */}
        <div className="mb-12">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-atlas-navy-1 mb-4">
              🎯 Propósito
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-text-gray mb-4">
                  Este Design Bible es la <strong>única referencia autorizada</strong> para 
                  todo el sistema de diseño ATLAS. Define tokens, componentes, patrones y 
                  procesos que garantizan consistencia visual y experiencia de usuario.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-ok">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Tokens de diseño bloqueados
                  </div>
                  <div className="flex items-center text-sm text-ok">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Componentes especificados
                  </div>
                  <div className="flex items-center text-sm text-ok">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Auditoría CI bloqueante
                  </div>
                  <div className="flex items-center text-sm text-ok">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    WCAG AA compliance
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-atlas-navy-1 mb-2">
                  🚦 Compliance Obligatorio
                </h3>
                <p className="text-sm text-text-gray mb-3">
                  Todo cambio visual debe pasar por este Design Bible:
                </p>
                <ol className="text-sm text-text-gray space-y-1">
                  <li>1. Proponer cambio en documentación</li>
                  <li>2. Actualizar ejemplos y changelog</li>
                  <li>3. Pasar auditoría CI</li>
                  <li>4. Review y merge</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Sections Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sections.map((section) => (
            <div
              key={section.title}
              onClick={() => handleSectionClick(section.title)}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md hover:border-atlas-blue transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start space-x-3 mb-4">
                <div className="p-2 bg-atlas-blue/10 rounded-lg group-hover:bg-atlas-blue/20 transition-colors">
                  <section.icon className="h-6 w-6 text-atlas-blue" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-atlas-navy-1 group-hover:text-atlas-blue transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm text-text-gray mt-1">
                    {section.description}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-atlas-blue transition-colors" />
              </div>
              
              <ul className="space-y-1">
                {section.items.map((item, index) => (
                  <li key={index} className="text-sm text-text-gray flex items-start">
                    <span className="text-atlas-blue mr-2">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-atlas-navy-1 mb-4">
            🔗 Enlaces Rápidos
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-atlas-navy-1 mb-2">Para Developers</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button 
                    onClick={() => handleSectionClick('foundations')}
                    className="text-atlas-blue hover:underline"
                  >
                    Color Tokens & Typography
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSectionClick('components')}
                    className="text-atlas-blue hover:underline"
                  >
                    Component Specifications
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSectionClick('checklists')}
                    className="text-atlas-blue hover:underline"
                  >
                    Development Checklists
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-atlas-navy-1 mb-2">Para Diseñadores</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button 
                    onClick={() => handleSectionClick('patterns')}
                    className="text-atlas-blue hover:underline"
                  >
                    Interaction Patterns
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSectionClick('accessibility')}
                    className="text-atlas-blue hover:underline"
                  >
                    Accessibility Guidelines
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSectionClick('content')}
                    className="text-atlas-blue hover:underline"
                  >
                    Content & Voice
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-atlas-navy-1 mb-2">Para Product/QA</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button 
                    onClick={() => handleSectionClick('checklists')}
                    className="text-atlas-blue hover:underline"
                  >
                    QA Validation Checklists
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSectionClick('governance')}
                    className="text-atlas-blue hover:underline"
                  >
                    Change Process
                  </button>
                </li>
                <li>
                  <a 
                    href="/design-bible/changelog.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-atlas-blue hover:underline"
                  >
                    Changelog & Releases
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-text-gray">
          <p>
            Mantenido por ATLAS Design System Team • Última actualización: Marzo 2024
          </p>
          <p className="mt-1">
            ¿Encontraste un error? 
            <button 
              onClick={() => window.open('mailto:design-system@atlas.com', '_blank')}
              className="text-atlas-blue hover:underline ml-1"
            >
              Reportar issue
            </button>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default DesignBiblePage;