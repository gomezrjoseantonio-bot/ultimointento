import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'actions' | 'general';
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts: KeyboardShortcut[] = [
    // General
    {
      keys: ['Cmd/Ctrl', 'K'],
      description: 'Abrir paleta de comandos',
      category: 'general',
    },
    {
      keys: ['?'],
      description: 'Mostrar esta ayuda',
      category: 'general',
    },
    {
      keys: ['Esc'],
      description: 'Cerrar modal o cancelar',
      category: 'general',
    },
    
    // Navigation
    {
      keys: ['G', 'H'],
      description: 'Ir al Panel (Home)',
      category: 'navigation',
    },
    {
      keys: ['G', 'P'],
      description: 'Ir a Inmuebles (Properties)',
      category: 'navigation',
    },
    {
      keys: ['G', 'T'],
      description: 'Ir a Tesorería (Treasury)',
      category: 'navigation',
    },
    {
      keys: ['G', 'D'],
      description: 'Ir a Documentos',
      category: 'navigation',
    },
    {
      keys: ['G', 'S'],
      description: 'Ir a Configuración (Settings)',
      category: 'navigation',
    },
    
    // Actions
    {
      keys: ['N'],
      description: 'Nueva acción (según contexto)',
      category: 'actions',
    },
    {
      keys: ['Cmd/Ctrl', 'S'],
      description: 'Guardar',
      category: 'actions',
    },
    {
      keys: ['Cmd/Ctrl', 'F'],
      description: 'Buscar',
      category: 'actions',
    },
  ];

  const categories = {
    general: 'General',
    navigation: 'Navegación',
    actions: 'Acciones',
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      {/* Backdrop - ATLAS light overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Command className="w-6 h-6 text-atlas-blue-600" />
            <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900">
              Atajos de Teclado
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                {categories[category as keyof typeof categories]}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-700">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <kbd className="px-2 py-1 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-gray-400 mx-1">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            💡 <strong>Consejo:</strong> Presiona <kbd className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded">?</kbd> en cualquier momento para ver estos atajos
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
