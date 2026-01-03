import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, X } from 'lucide-react';
import WizardStepScopeSelection from './WizardStepScopeSelection';
import WizardStepSemillaNuevo from './WizardStepSemillaNuevo';
import WizardStepConfiguracionNuevo from './WizardStepConfiguracionNuevo';
import WizardStepRevisionNuevo from './WizardStepRevisionNuevo';
import { PresupuestoLinea } from '../../../../../services/db';

interface BudgetWizardProps {
  year: number;
  onComplete: () => void;
  onCancel: () => void;
}

export interface WizardData {
  scopes: ('PERSONAL' | 'INMUEBLES')[];
  startMonth: number;
  isFullYear: boolean;
  lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[];
  name: string;
}

const BudgetWizard: React.FC<BudgetWizardProps> = ({ year, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    scopes: [],
    startMonth: 1,
    isFullYear: true,
    lines: [],
    name: `Presupuesto ${year}`
  });

  const steps = [
    { id: 1, title: 'Ámbitos', description: 'Selección de ámbitos y período' },
    { id: 2, title: 'Semilla automática', description: 'Datos base y configuración' },
    { id: 3, title: 'Configuración', description: 'Configuración de cada partida' },
    { id: 4, title: 'Revisión', description: 'Confirmación y guardado' }
  ];

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepComplete = (stepData?: any) => {
    if (currentStep === 1) {
      // Scope selection step
      setWizardData(prev => ({
        ...prev,
        scopes: stepData.selectedScopes,
        startMonth: stepData.startMonth,
        isFullYear: stepData.isFullYear
      }));
      handleNext();
    } else if (currentStep === 2) {
      // Semilla step
      setWizardData(prev => ({
        ...prev,
        lines: stepData
      }));
      handleNext();
    } else if (currentStep === 3) {
      // Configuration step
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
          <WizardStepScopeSelection
            year={year}
            initialData={{
              selectedScopes: wizardData.scopes,
              year,
              startMonth: wizardData.startMonth,
              isFullYear: wizardData.isFullYear
            }}
            onComplete={handleStepComplete}
          />
        );
      case 2:
        return (
          <WizardStepSemillaNuevo
            year={year}
            scopes={wizardData.scopes}
            startMonth={wizardData.startMonth}
            isFullYear={wizardData.isFullYear}
            initialLines={wizardData.lines}
            onComplete={handleStepComplete}
          />
        );
      case 3:
        return (
          <WizardStepConfiguracionNuevo
            year={year}
            scopes={wizardData.scopes}
            initialLines={wizardData.lines}
            onComplete={handleStepComplete}
          />
        );
      case 4:
        return (
          <WizardStepRevisionNuevo
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
    </div>
  );
};

export default BudgetWizard;