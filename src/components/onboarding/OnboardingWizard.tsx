import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sunrise, 
  Activity, 
  Home, 
  BarChart3, 
  FileText, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
  actionLabel?: string;
  actionRoute?: string;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: '¡Bienvenido a ATLAS!',
      description: 'Tu plataforma integral de gestión de cartera inmobiliaria',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 text-lg">
            ATLAS te ayuda a gestionar tu cartera de inmuebles de forma profesional, 
            combinando supervisión financiera con gestión operativa diaria.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-white font-semibold mb-2">¿Qué vas a descubrir?</h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Los dos módulos principales: Horizon y Pulse</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Cómo añadir tu primera propiedad</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Funcionalidades clave para empezar rápidamente</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'horizon',
      title: 'ATLAS Horizon - Supervisión Financiera',
      description: 'Vista ejecutiva para inversores y gestores de alto nivel',
      icon: Sunrise,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
            <div className="flex items-center gap-3 mb-3">
              <Sunrise className="w-8 h-8 text-atlas-blue" />
              <h3 className="text-xl font-bold text-white">Horizon</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Módulo de supervisión financiera con KPIs y métricas clave para inversores.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-white font-semibold">Funcionalidades principales:</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">📊 Panel de Control</div>
                <div className="text-sm text-gray-600">Dashboard con métricas financieras en tiempo real</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">🏘️ Cartera de Inmuebles</div>
                <div className="text-sm text-gray-600">Gestión completa de propiedades y análisis</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">💰 Tesorería</div>
                <div className="text-sm text-gray-600">Control de liquidez y conciliación bancaria</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">📈 Proyecciones</div>
                <div className="text-sm text-gray-600">Análisis predictivo y escenarios financieros</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pulse',
      title: 'ATLAS Pulse - Gestión Operativa',
      description: 'Herramientas para tareas administrativas y flujos de trabajo diarios',
      icon: Activity,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-teal-900/20 to-teal-800/20 rounded-lg p-6 border border-teal-700/30">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-8 h-8 text-teal-400" />
              <h3 className="text-xl font-bold text-white">Pulse</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Módulo de gestión operativa diaria para el día a día de tu negocio inmobiliario.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-white font-semibold">Funcionalidades principales:</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">📄 Contratos</div>
                <div className="text-sm text-gray-600">Gestión de contratos de alquiler y documentos</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">✍️ Firmas Digitales</div>
                <div className="text-sm text-gray-600">Proceso de firma electrónica de documentos</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">💳 Cobros</div>
                <div className="text-sm text-gray-600">Seguimiento de pagos y recibos</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="font-medium text-white mb-1">⚡ Automatizaciones</div>
                <div className="text-sm text-gray-600">Automatiza tareas repetitivas</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'first-property',
      title: 'Añade tu Primera Propiedad',
      description: 'Comienza creando tu primer inmueble en el sistema',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 text-lg">
            El primer paso es añadir una propiedad a tu cartera. El proceso es simple y guiado.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-white font-semibold mb-3">Proceso de creación (4 pasos):</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-atlas-blue rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">1</div>
                <div>
                  <div className="text-white font-medium">Identificación</div>
                  <div className="text-sm text-gray-600">Alias, dirección y referencia catastral</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-atlas-blue rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">2</div>
                <div>
                  <div className="text-white font-medium">Características</div>
                  <div className="text-sm text-gray-600">Metros cuadrados, habitaciones, baños</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-atlas-blue rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">3</div>
                <div>
                  <div className="text-white font-medium">Costes</div>
                  <div className="text-sm text-gray-600">Precio de compra y gastos asociados</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-atlas-blue rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">4</div>
                <div>
                  <div className="text-white font-medium">Fiscalidad</div>
                  <div className="text-sm text-gray-600">Información fiscal y amortización</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-primary-900/20 rounded-lg p-4 border border-primary-200">
            <p className="text-primary-200 text-sm">
              💡 <strong>Consejo:</strong> No te preocupes si no tienes todos los datos ahora. 
              Puedes guardar y completar la información más adelante.
            </p>
          </div>
        </div>
      ),
      actionLabel: 'Crear mi primera propiedad',
      actionRoute: '/inmuebles/cartera/crear'
    },
    {
      id: 'complete',
      title: '¡Todo Listo!',
      description: 'Ya estás preparado para comenzar a usar ATLAS',
      icon: CheckCircle,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 text-lg">
            Has completado el tour inicial. Ahora puedes explorar todas las funcionalidades de ATLAS.
          </p>
          
          <div className="bg-gradient-to-br from-primary-50 to-atlas-teal/20 rounded-lg p-6 border border-primary-200">
            <h4 className="text-white font-semibold mb-3 text-lg">Recursos Útiles:</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-atlas-blue flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-medium">Glosario</div>
                  <div className="text-sm text-gray-600">Consulta términos técnicos en cualquier momento</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-medium">Dashboard Personalizable</div>
                  <div className="text-sm text-gray-600">Configura tu panel con las métricas que más te interesan</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="atlas-btn-success p-4 border">
            <p className="text-green-200 text-sm">
              ✅ Puedes rehacer la configuración inicial cuando lo necesites desde tu cuenta
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const Icon = currentStepData.icon;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as completed
    localStorage.setItem('atlas_onboarding_completed', 'true');
    toast.success('¡Bienvenido a ATLAS! Comienza a gestionar tu cartera.');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('atlas_onboarding_completed', 'true');
    localStorage.setItem('atlas_onboarding_skipped', 'true');
    onSkip();
  };

  const handleAction = () => {
    if (currentStepData.actionRoute) {
      handleComplete();
      navigate(currentStepData.actionRoute);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-50 to-atlas-teal/20 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-8 h-8 text-atlas-blue" />
              <div>
                <h2 className="text-xl font-bold text-white">{currentStepData.title}</h2>
                <p className="text-sm text-gray-600">{currentStepData.description}</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-600 hover:text-white transition-colors"
              aria-label="Cerrar tutorial"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  index <= currentStep ? 'bg-primary-600' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <div className="text-sm text-gray-600 mt-2 text-center">
            Paso {currentStep + 1} de {steps.length}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-gray-600 hover:text-white transition-colors text-sm font-medium"
          >
            Omitir tutorial
          </button>
          
          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
            
            {currentStepData.actionLabel ? (
              <button
                onClick={handleAction}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: 'var(--atlas-blue)' }}
              >
                {currentStepData.actionLabel}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: 'var(--atlas-blue)' }}
              >
                {isLastStep ? 'Finalizar' : 'Siguiente'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
