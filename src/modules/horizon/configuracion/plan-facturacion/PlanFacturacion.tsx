/**
 * PROTOTIPO - Plan & Facturación
 * Gestión de suscripciones (mock)
 */

import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface PlanDetails {
  id: 'free' | 'starter' | 'professional';
  name: string;
  price: number;
  interval: string;
  features: string[];
  limits: {
    properties: number;
    contracts: number;
  };
}

const plans: PlanDetails[] = [
  {
    id: 'free',
    name: 'FREE',
    price: 0,
    interval: '/mes',
    features: [
      '3 inmuebles',
      '5 contratos',
      'Funcionalidades básicas',
      'Soporte por email'
    ],
    limits: {
      properties: 3,
      contracts: 5
    }
  },
  {
    id: 'starter',
    name: 'STARTER',
    price: 29,
    interval: '/mes',
    features: [
      '10 inmuebles',
      '20 contratos',
      'Todas las funcionalidades',
      'Soporte prioritario',
      'Exportaciones avanzadas'
    ],
    limits: {
      properties: 10,
      contracts: 20
    }
  },
  {
    id: 'professional',
    name: 'PROFESSIONAL',
    price: 79,
    interval: '/mes',
    features: [
      'Inmuebles ilimitados',
      'Contratos ilimitados',
      'Todas las funcionalidades',
      'Soporte prioritario 24/7',
      'API access',
      'Múltiples usuarios'
    ],
    limits: {
      properties: 999,
      contracts: 999
    }
  }
];

const PlanFacturacion: React.FC = () => {
  const { user, updateSubscription, cancelSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleSelectPlan = async (planId: 'free' | 'starter' | 'professional') => {
    if (user?.subscriptionPlan === planId) {
      toast('Ya tienes este plan activo', { icon: 'ℹ️' });
      return;
    }

    setLoading(true);
    try {
      // Simular pago
      if (planId !== 'free') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast.success('Pago procesado exitosamente (SIMULADO)');
      }
      
      await updateSubscription(planId);
    } catch (error) {
      toast.error('Error al cambiar de plan');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setLoading(true);
    try {
      await cancelSubscription();
      setShowCancelModal(false);
    } catch (error) {
      toast.error('Error al cancelar suscripción');
    } finally {
      setLoading(false);
    }
  };

  const currentPlanDetails = plans.find(p => p.id === user?.subscriptionPlan);
  const isTrialActive = user?.subscriptionStatus === 'trial';

  return (
    <div>
      {/* Prototype Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>🧪 PROTOTIPO</strong> - Pagos simulados. En producción se integrará con Stripe.
        </p>
      </div>

      {/* Current Plan Info */}
      <div className="bg-white rounded-lg shadow-sm border border-hz-neutral-300 p-6 mb-8">
        <h2 className="text-xl font-semibold text-atlas-navy-1 mb-4">Plan Actual</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-atlas-blue">{currentPlanDetails?.name}</p>
            <p className="text-hz-neutral-700 mt-1">
              {currentPlanDetails?.price === 0 
                ? 'Plan gratuito' 
                : `€${currentPlanDetails?.price}/mes`}
            </p>
            {isTrialActive && (
              <p className="text-sm text-ok mt-2">
                🎁 Período de prueba activo hasta {new Date(user.trialEndsAt!).toLocaleDateString('es-ES')}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-hz-neutral-700">Estado</p>
            <span className="inline-block px-3 py-1 text-ok rounded-full text-sm font-medium mt-1" style={{ backgroundColor: 'rgba(40, 167, 69, 0.1)' }}>
              {user?.subscriptionStatus === 'active' ? 'Activo' : 
               user?.subscriptionStatus === 'trial' ? 'Prueba' : 'Cancelado'}
            </span>
          </div>
        </div>

        {user?.subscriptionPlan !== 'free' && (
          <div className="mt-4 pt-4 border-t border-hz-neutral-300">
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-sm text-error hover:text-error-700"
            >
              Cancelar suscripción
            </button>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <h2 className="text-xl font-semibold text-atlas-navy-1 mb-4">Planes Disponibles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === user?.subscriptionPlan;
          const isUpgrade = plans.findIndex(p => p.id === user?.subscriptionPlan) < plans.findIndex(p => p.id === plan.id);

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-md border-2 p-6 ${
                isCurrentPlan
                  ? 'border-atlas-blue ring-2 ring-atlas-blue ring-opacity-50'
                  : 'border-hz-neutral-300'
              }`}
            >
              {/* Plan Name & Price */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-atlas-navy-1 mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold text-atlas-blue mb-1">
                  €{plan.price}
                </div>
                <p className="text-hz-neutral-700 text-sm">{plan.interval}</p>
              </div>

              {/* Features List */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm">
                    <svg className="w-5 h-5 text-ok mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-hz-neutral-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading || isCurrentPlan}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  isCurrentPlan
                    ? 'bg-hz-neutral-300 text-hz-neutral-700 cursor-not-allowed'
                    : isUpgrade
                    ? 'bg-atlas-blue text-white hover:opacity-90'
                    : 'bg-hz-neutral-100 text-atlas-navy-1 hover:bg-hz-neutral-300'
                } disabled:opacity-50`}
              >
                {loading ? (
                  'Procesando...'
                ) : isCurrentPlan ? (
                  'Plan Actual'
                ) : isUpgrade ? (
                  'Mejorar Plan'
                ) : (
                  'Cambiar a este plan'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Mock Invoices Section */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-hz-neutral-300 p-6">
        <h2 className="text-xl font-semibold text-atlas-navy-1 mb-4">Facturas</h2>
        <p className="text-hz-neutral-700 text-sm">
          No hay facturas disponibles aún. Las facturas aparecerán aquí cuando se realice el primer pago.
        </p>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-atlas-navy-1 mb-4">
              ¿Cancelar suscripción?
            </h3>
            <p className="text-hz-neutral-700 mb-6">
              Tu cuenta será degradada al plan FREE. Perderás acceso a las funcionalidades premium
              pero tus datos se mantendrán seguros.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-hz-neutral-300 rounded-lg text-atlas-navy-1 hover:bg-hz-neutral-100"
              >
                Mantener plan
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 disabled:opacity-50"
              >
                {loading ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanFacturacion;