import React, { useState, useMemo } from 'react';
import { Search, Settings } from 'lucide-react';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  section: string;
}

interface SettingsSearchProps {
  onNavigate?: (sectionId: string) => void;
}

const SettingsSearch: React.FC<SettingsSearchProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');

  // Define all settings that can be searched
  const allSettings: SettingItem[] = useMemo(() => [
    {
      id: 'providers',
      title: 'Directorio de Proveedores',
      description: 'Gestionar proveedores y sus alias',
      category: 'Datos',
      keywords: ['proveedores', 'suppliers', 'empresas', 'nif', 'alias'],
      section: 'providers',
    },
    {
      id: 'autosave',
      title: 'Autoguardado',
      description: 'Configurar autoguardado automático',
      category: 'Sistema',
      keywords: ['autosave', 'guardar', 'automático', 'save'],
      section: 'autosave',
    },
    {
      id: 'theme',
      title: 'Tema y Apariencia',
      description: 'Personalizar colores y tema',
      category: 'Apariencia',
      keywords: ['theme', 'tema', 'colores', 'dark', 'oscuro'],
      section: 'theme',
    },
    {
      id: 'notifications',
      title: 'Notificaciones',
      description: 'Configurar alertas y notificaciones',
      category: 'Sistema',
      keywords: ['notifications', 'notificaciones', 'alerts', 'avisos'],
      section: 'notifications',
    },
    {
      id: 'language',
      title: 'Idioma',
      description: 'Cambiar idioma de la aplicación',
      category: 'General',
      keywords: ['language', 'idioma', 'español', 'english'],
      section: 'language',
    },
    {
      id: 'export',
      title: 'Exportar Datos',
      description: 'Exportar datos a CSV, Excel o PDF',
      category: 'Datos',
      keywords: ['export', 'exportar', 'csv', 'excel', 'pdf', 'backup'],
      section: 'export',
    },
    {
      id: 'import',
      title: 'Importar Datos',
      description: 'Importar datos desde archivos',
      category: 'Datos',
      keywords: ['import', 'importar', 'csv', 'excel', 'restore'],
      section: 'import',
    },
    {
      id: 'keyboard',
      title: 'Atajos de Teclado',
      description: 'Ver y personalizar atajos',
      category: 'Accesibilidad',
      keywords: ['keyboard', 'teclado', 'shortcuts', 'atajos'],
      section: 'keyboard',
    },
  ], []);

  // Filter settings based on query
  const filteredSettings = useMemo(() => {
    if (!query.trim()) {
      return allSettings;
    }

    const lowerQuery = query.toLowerCase();
    return allSettings.filter(setting => {
      const titleMatch = setting.title.toLowerCase().includes(lowerQuery);
      const descMatch = setting.description.toLowerCase().includes(lowerQuery);
      const categoryMatch = setting.category.toLowerCase().includes(lowerQuery);
      const keywordMatch = setting.keywords.some(kw => kw.includes(lowerQuery));
      
      return titleMatch || descMatch || categoryMatch || keywordMatch;
    });
  }, [query, allSettings]);

  // Group by category
  const groupedSettings = useMemo(() => {
    return filteredSettings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {} as Record<string, SettingItem[]>);
  }, [filteredSettings]);

  const handleSettingClick = (setting: SettingItem) => {
    if (onNavigate) {
      onNavigate(setting.section);
    }
    
    // Scroll to section if it exists
    const element = document.getElementById(setting.section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Search Input */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar ajustes... (ej: 'proveedores', 'tema', 'exportar')"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
            aria-label="Buscar configuración"
          />
        </div>
      </div>

      {/* Settings Results */}
      {query && (
        <div className="p-2">
          {Object.keys(groupedSettings).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No se encontraron ajustes para "{query}"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSettings).map(([category, settings]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {settings.map(setting => (
                      <button
                        key={setting.id}
                        onClick={() => handleSettingClick(setting)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-gray-900">
                          {setting.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {setting.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Links (shown when no search) */}
      {!query && (
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            💡 Busca cualquier ajuste escribiendo arriba
          </p>
          <div className="flex flex-wrap gap-2">
            {['Proveedores', 'Autoguardado', 'Exportar', 'Atajos'].map(keyword => (
              <button
                key={keyword}
                onClick={() => setQuery(keyword.toLowerCase())}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsSearch;
