// Wizard layout component for 4-step property creation/editing
// Following Horizon design system with clean card layout

import React from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { ComplecionStatus } from '../../types/inmueble';

interface WizardStep {
  id: number;
  title: string;
  status: ComplecionStatus;
  isActive: boolean;
  isCompleted: boolean;
}

interface InmuebleWizardLayoutProps {
  currentStep: number;
  steps: WizardStep[];
  onStepClick: (step: number) => void;
  children: React.ReactNode;
  title?: string;
}

const InmuebleWizardLayout: React.FC<InmuebleWizardLayoutProps> = ({
  currentStep,
  steps,
  onStepClick,
  children,
  title = 'Alta de Inmueble'
}) => {
  return (
    <div className="min-h-screen bg-hz-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-hz-text font-inter">
            {title}
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Progress Steps - Compact Design */}
        <div className="mb-6">
          <nav aria-label="Progreso">
            <ol className="flex items-center justify-between space-x-2">
              {steps.map((step, index) => (
                <li key={step.id} className="flex-1">
                  <div className="flex items-center">
                    {/* Step Button */}
                    <button
                      onClick={() => onStepClick(step.id)}
                      className={`
                        flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors text-xs font-medium
                        ${step.isActive 
                          ? 'border-[#042C5E] bg-[#042C5E] text-white' 
                          : step.status === 'COMPLETO'
                            ? 'border-[#042C5E] bg-[#042C5E] text-white'
                            : 'border-gray-300 bg-white text-gray-500 hover:border-[#042C5E]'
                        }
                      `}
                    >
                      {step.status === 'COMPLETO' && !step.isActive ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </button>

                    {/* Step Title - Compact */}
                    <div className="ml-2 min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${
                        step.isActive ? 'text-[#042C5E]' : 'text-gray-700'
                      }`}>
                        {step.title}
                      </p>
                    </div>

                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className="hidden sm:block w-8 h-0.5 bg-gray-300 ml-2" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InmuebleWizardLayout;