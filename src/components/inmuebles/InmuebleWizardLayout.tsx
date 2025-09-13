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

const StatusChip: React.FC<{ status: ComplecionStatus }> = ({ status }) => {
  // Only show two visual states: Green (complete) or Gray (pending/partial)
  const isComplete = status === 'COMPLETO';
  
  const config = {
    color: isComplete 
      ? 'bg-[#042C5E] bg-opacity-10 text-[#042C5E] border-[#042C5E] border-opacity-20' 
      : 'bg-gray-100 text-gray-600 border-gray-200',
    text: isComplete ? 'Completo' : 'Pendiente'
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium border rounded-md ${config.color}`}>
      {config.text}
    </span>
  );
};

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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-hz-text font-inter">
            {title}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <nav aria-label="Progreso">
            <ol className="flex items-center justify-between">
              {steps.map((step, index) => (
                <li key={step.id} className="flex-1">
                  <div className="flex items-center">
                    {/* Step Button */}
                    <button
                      onClick={() => onStepClick(step.id)}
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                        ${step.isActive 
                          ? 'border-[#042C5E] bg-[#042C5E] text-white' 
                          : step.status === 'COMPLETO'
                            ? 'border-[#042C5E] bg-[#042C5E] text-white'
                            : 'border-gray-300 bg-white text-gray-500 hover:border-[#042C5E]'
                        }
                      `}
                    >
                      {step.status === 'COMPLETO' && !step.isActive ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </button>

                    {/* Step Content */}
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          step.isActive ? 'text-[#042C5E]' : 'text-gray-900'
                        }`}>
                          {step.title}
                        </p>
                        <StatusChip status={step.status} />
                      </div>
                    </div>

                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className="hidden sm:block w-12 h-0.5 bg-gray-300 ml-4" />
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