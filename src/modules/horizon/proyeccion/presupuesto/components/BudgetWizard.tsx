import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, X } from 'lucide-react';
import WizardStepAlcance from './WizardStepAlcance';
import WizardStepSemilla from './WizardStepSemilla';
import WizardStepConfiguracion from './WizardStepConfiguracion';
import WizardStepRevision from './WizardStepRevision';
import { BudgetLine } from '../../../../../services/db';

interface BudgetWizardProps {
  year: number;
  onComplete: () => void;
  onCancel: () => void;
}

export interface WizardData {
  scope: {
    propertyIds: number[];
    roomIds?: string[];
    startMonth: number;
    isFullYear: boolean;
  };
  lines: Omit<BudgetLine, 'id' | 'budgetId'>[];
  name: string;
  version: string;
}

const BudgetWizard: React.FC<BudgetWizardProps> = ({ year, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    scope: {
      propertyIds: [],
      startMonth: 1,
      isFullYear: true
    },
    lines: [],
    name: `Presupuesto ${year}`,
    version: 'v1.0'
  });

  const steps = [
    { id: 1, title: 'Alcance', description: 'Selección de inmuebles y período' },
    { id: 2, title: 'Semilla automática', description: 'Datos base y configuración' },
    { id: 3, title: 'Configuración', description: 'Configuración de cada partida' },
    { id: 4, title: 'Revisión', description: 'Confirmación y guardado' }
  ];

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepComplete = (stepData?: any) => {
    if (currentStep === 1) {
      setWizardData(prev => ({
        ...prev,
        scope: stepData
      }));
      handleNext();
    } else if (currentStep === 2) {
      setWizardData(prev => ({
        ...prev,
        lines: stepData
      }));
      handleNext();
    } else if (currentStep === 3) {
      setWizardData(prev => ({
        ...prev,
        lines: stepData
      }));
      handleNext();
    } else if (currentStep === 4) {
      // Final step - save budget
      onComplete();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WizardStepAlcance
            year={year}
            initialData={wizardData.scope}
            onComplete={handleStepComplete}
          />
        );
      case 2:
        return (
          <WizardStepSemilla
            year={year}
            scope={wizardData.scope}
            initialLines={wizardData.lines}
            onComplete={handleStepComplete}
          />
        );
      case 3:
        return (
          <WizardStepConfiguracion
            year={year}
            scope={wizardData.scope}
            initialLines={wizardData.lines}
            onComplete={handleStepComplete}
          />
        );
      case 4:
        return (
          <WizardStepRevision
            year={year}
            wizardData={wizardData}
            onComplete={handleStepComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onCancel}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Volver
              </button>
              <div className="border-l border-gray-300 h-6"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                Crear Presupuesto {year}
              </h1>
            </div>
            
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex justify-center">
            <ol className="flex items-center space-x-8">
              {steps.map((step, index) => (
                <li key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        currentStep > step.id
                          ? 'bg-primary-600 border-primary-600'
                          : currentStep === step.id
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="h-5 w-5 text-white" />
                      ) : (
                        <span
                          className={`text-sm font-medium ${
                            currentStep === step.id ? 'text-primary-600' : 'text-gray-500'
                          }`}
                        >
                          {step.id}
                        </span>
                      )}
                    </div>
                    <div className="ml-3">
                      <p
                        className={`text-sm font-medium ${
                          currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="ml-8 flex h-8 w-8 items-center">
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderStep()}
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentStep === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </button>
            
            <div className="text-sm text-gray-500">
              Paso {currentStep} de {steps.length}
            </div>
            
            <div className="w-24"></div> {/* Spacer for symmetry */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetWizard;