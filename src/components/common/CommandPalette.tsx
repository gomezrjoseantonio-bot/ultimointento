import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  Building,
  FileText,
  Banknote,
  BarChart3,
  Settings,
  X,
  Clock,
  Star,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigation' | 'action' | 'recent' | 'favorite';
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Define all available commands
  const allCommands: Command[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-dashboard',
      label: 'Ir al Panel',
      description: 'Vista general del dashboard',
      icon: Home,
      action: () => { navigate('/panel'); onClose(); },
      category: 'navigation',
      keywords: ['dashboard', 'panel', 'home', 'inicio'],
    },
    {
      id: 'nav-properties',
      label: 'Ir a Inmuebles',
      description: 'Gestión de propiedades',
      icon: Building,
      action: () => { navigate('/portfolio'); onClose(); },
      category: 'navigation',
      keywords: ['inmuebles', 'propiedades', 'portfolio', 'properties'],
    },
    {
      id: 'nav-treasury',
      label: 'Ir a Tesorería',
      description: 'Gestión de cuentas y movimientos',
      icon: Banknote,
      action: () => { navigate('/treasury'); onClose(); },
      category: 'navigation',
      keywords: ['tesorería', 'treasury', 'cuentas', 'banco', 'movimientos'],
    },
    {
      id: 'nav-documents',
      label: 'Ir a Documentos',
      description: 'Gestión documental',
      icon: FileText,
      action: () => { navigate('/inbox'); onClose(); },
      category: 'navigation',
      keywords: ['documentos', 'documents', 'inbox', 'archivos'],
    },
    {
      id: 'nav-tax',
      label: 'Ir a Fiscalidad',
      description: 'Información fiscal',
      icon: BarChart3,
      action: () => { navigate('/tax'); onClose(); },
      category: 'navigation',
      keywords: ['fiscalidad', 'tax', 'impuestos', 'fiscal'],
    },
    {
      id: 'nav-settings',
      label: 'Ir a Configuración',
      description: 'Ajustes de la aplicación',
      icon: Settings,
      action: () => { navigate('/settings'); onClose(); },
      category: 'navigation',
      keywords: ['configuración', 'settings', 'ajustes', 'preferencias'],
    },
    // Action commands
    {
      id: 'action-new-property',
      label: 'Crear Nuevo Inmueble',
      description: 'Añadir una nueva propiedad',
      icon: Building,
      action: () => { navigate('/portfolio?action=new'); onClose(); },
      category: 'action',
      keywords: ['crear', 'nuevo', 'inmueble', 'propiedad', 'añadir'],
    },
    {
      id: 'action-import-movements',
      label: 'Importar Movimientos',
      description: 'Importar movimientos bancarios',
      icon: Banknote,
      action: () => { navigate('/treasury?action=import'); onClose(); },
      category: 'action',
      keywords: ['importar', 'movimientos', 'banco', 'csv', 'excel'],
    },
    {
      id: 'action-upload-document',
      label: 'Subir Documento',
      description: 'Añadir un nuevo documento',
      icon: FileText,
      action: () => { navigate('/inbox?action=upload'); onClose(); },
      category: 'action',
      keywords: ['subir', 'documento', 'upload', 'archivo'],
    },
  ], [navigate, onClose]);

  // Load recent commands from localStorage - memoized
  const getRecentCommands = useCallback((): string[] => {
    try {
      const recent = localStorage.getItem('atlas_recent_commands');
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  }, []);

  // Load favorite commands from localStorage - memoized
  const getFavoriteCommands = useCallback((): string[] => {
    try {
      const favorites = localStorage.getItem('atlas_favorite_commands');
      return favorites ? JSON.parse(favorites) : [];
    } catch {
      return [];
    }
  }, []);

  // Save command to recent
  const saveToRecent = useCallback((commandId: string) => {
    const recent = getRecentCommands();
    const updated = [commandId, ...recent.filter(id => id !== commandId)].slice(0, 5);
    localStorage.setItem('atlas_recent_commands', JSON.stringify(updated));
  }, [getRecentCommands]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show favorites and recent when no query
      const favorites = getFavoriteCommands();
      const recent = getRecentCommands();
      
      const favoriteCommands = allCommands
        .filter(cmd => favorites.includes(cmd.id))
        .map(cmd => ({ ...cmd, category: 'favorite' as const }));
      
      const recentCommands = recent
        .map(id => allCommands.find(cmd => cmd.id === id))
        .filter((cmd): cmd is Command => cmd !== undefined)
        .map(cmd => ({ ...cmd, category: 'recent' as const }));

      return [...favoriteCommands, ...recentCommands, ...allCommands.slice(0, 6)];
    }

    const lowerQuery = query.toLowerCase();
    return allCommands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some(kw => kw.includes(lowerQuery));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [query, allCommands, getFavoriteCommands, getRecentCommands]);

  // Execute selected command
  const executeCommand = useCallback((command: Command) => {
    saveToRecent(command.id);
    command.action();
  }, [saveToRecent]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose, executeCommand]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group commands by category for display
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryLabels = {
    favorite: '⭐ Favoritos',
    recent: '🕐 Recientes',
    navigation: '🧭 Navegación',
    action: '⚡ Acciones',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      {/* Backdrop - ATLAS light overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

      {/* Command Palette */}
      <div 
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar comandos... (Ej: 'crear inmueble', 'ir a panel')"
            className="flex-1 bg-transparent border-none focus:outline-none text-gray-900 placeholder-gray-400"
            aria-label="Buscar comandos"
            id="command-palette-title"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Command List */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
          role="listbox"
          aria-label="Comandos disponibles"
        >
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category} className="mb-2">
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </div>
              {commands.map((command, idx) => {
                const globalIndex = filteredCommands.indexOf(command);
                const isSelected = globalIndex === selectedIndex;
                const Icon = command.icon;

                return (
                  <button
                    key={command.id}
                    onClick={() => executeCommand(command)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                      ${isSelected 
                        ? 'bg-primary-50 border-l-4 border-primary-700' 
                        : 'hover:bg-gray-50'
                      }
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${
                      isSelected ? 'text-primary-700' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {command.label}
                      </div>
                      {command.description && (
                        <div className="text-sm text-gray-500">
                          {command.description}
                        </div>
                      )}
                    </div>
                    {category === 'favorite' && (
                      <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                    )}
                    {category === 'recent' && (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No se encontraron comandos para "{query}"
            </div>
          )}
        </div>

        {/* Footer with hints */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↑↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↵</kbd> Ejecutar</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">Esc</kbd> Cerrar</span>
          </div>
          <div className="text-gray-400">
            Cmd+K para abrir
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
