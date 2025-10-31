import React, { useState } from 'react';
import {
  Plus,
  Building,
  FileText,
  Banknote,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  color: string;
}

const FloatingActionButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const quickActions: QuickAction[] = [
    {
      id: 'new-property',
      label: 'Nuevo Inmueble',
      icon: Building,
      action: () => {
        navigate('/portfolio?action=new');
        setIsOpen(false);
      },
      color: 'bg-atlas-blue hover:bg-primary-800',
    },
    {
      id: 'upload-document',
      label: 'Subir Documento',
      icon: FileText,
      action: () => {
        navigate('/inbox?action=upload');
        setIsOpen(false);
      },
      color: 'bg-atlas-teal-600 hover:bg-atlas-teal-700',
    },
    {
      id: 'import-movements',
      label: 'Importar Movimientos',
      icon: Banknote,
      action: () => {
        navigate('/treasury?action=import');
        setIsOpen(false);
      },
      color: 'bg-green-600 hover:bg-green-700',
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Quick Action Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Actions */}
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`
                    group flex items-center gap-3 ${action.color}
                    text-white rounded-full shadow-lg
                    transition-all duration-200 ease-out
                    animate-fade-in-up
                  `}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                  aria-label={action.label}
                >
                  {/* Label (hidden until hover on desktop) */}
                  <span className="
                    max-w-0 overflow-hidden whitespace-nowrap
                    group-hover:max-w-xs group-hover:pl-4
                    transition-all duration-200 ease-out
                    text-sm font-medium
                  ">
                    {action.label}
                  </span>
                  
                  {/* Icon */}
                  <div className="flex items-center justify-center w-12 h-12">
                    <Icon className="w-6 h-6" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-center w-14 h-14
          bg-atlas-blue hover:bg-primary-800
          text-white rounded-full shadow-lg
          transition-all duration-200
          ${isOpen ? 'rotate-45' : 'rotate-0'}
        `}
        aria-label={isOpen ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isOpen ? (
          <X className="w-7 h-7" />
        ) : (
          <Plus className="w-7 h-7" />
        )}
      </button>

      {/* Tooltip hint (shown when closed) */}
      {!isOpen && (
        <div className="
          absolute bottom-full right-0 mb-2
          px-3 py-1.5 bg-white text-white text-sm
          rounded-lg whitespace-nowrap
          opacity-0 group-hover:opacity-100
          transition-opacity pointer-events-none
        ">
          Acciones rápidas
        </div>
      )}
    </div>
  );
};

export default FloatingActionButton;
