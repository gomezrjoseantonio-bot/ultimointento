import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface EmptyPageProps {
  title: string;
  subtitle?: string;
  description?: string;
}

const EmptyPage: React.FC<EmptyPageProps> = ({ title, subtitle, description }) => {
  const { currentModule } = useTheme();

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className={`text-2xl font-semibold ${
          currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
        }`}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-600 mt-1">{subtitle}</p>
        )}
      </div>
      
      <div className="bg-white shadow rounded-atlas border border-gray-200 p-8">
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            currentModule === 'horizon' 
              ? 'bg-brand-navy bg-opacity-10' 
              : 'bg-brand-teal bg-opacity-10'
          }`}>
            <div className={`w-8 h-8 ${
              currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
            }`}>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 014 0v2H6v-2z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">En construcción</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-2">
            Próximo hito: funcionalidades.
          </p>
          {description && (
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmptyPage;