import React, { useState, useEffect } from 'react';
import { HelpCircle, BookOpen, X } from 'lucide-react';
import FeatureTour from '../common/FeatureTour';
import { AVAILABLE_TOURS, isTourCompleted, startTour } from '../../config/tours';

interface TourManagerProps {
  onClose: () => void;
}

/**
 * Sprint 4: Tour Manager Component
 * Central hub for accessing all available feature tours
 */

// Helper function to get a tour by ID with type safety
const getTourById = (tourId: string | null) => {
  if (!tourId) return null;
  return AVAILABLE_TOURS[tourId as keyof typeof AVAILABLE_TOURS] || null;
};

const TourManager: React.FC<TourManagerProps> = ({ onClose }) => {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  const handleStartTour = (tourId: string) => {
    startTour(tourId);
    setActiveTourId(tourId);
  };

  const handleCompleteTour = () => {
    setActiveTourId(null);
  };

  const handleSkipTour = () => {
    setActiveTourId(null);
  };

  // Validate active tour ID and reset if invalid
  useEffect(() => {
    if (activeTourId) {
      const tour = getTourById(activeTourId);
      // If tour is invalid, reset the state
      if (!tour || tour.id !== activeTourId) {
        setActiveTourId(null);
      }
    }
  }, [activeTourId]);

  // If a tour is active, render it
  if (activeTourId) {
    const tour = getTourById(activeTourId);
    // Runtime check for safety
    if (tour && tour.id === activeTourId) {
      return (
        <FeatureTour
          steps={tour.steps}
          tourId={tour.id}
          onComplete={handleCompleteTour}
          onSkip={handleSkipTour}
        />
      );
    }
    // Return null while useEffect resets the invalid tour ID
    return null;
  }

  // Otherwise, show tour selection modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/40 to-teal-900/40 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-blue-400" />
              <div>
                <h2 className="text-xl font-bold text-white">Tours Guiados</h2>
                <p className="text-sm text-gray-400">Aprende a usar las funcionalidades de ATLAS</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(AVAILABLE_TOURS).map((tour) => {
              const isCompleted = isTourCompleted(tour.id);
              
              return (
                <div
                  key={tour.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold">{tour.name}</h3>
                        {isCompleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-300 border border-green-700/30">
                            ✓ Completado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{tour.description}</p>
                      <div className="text-xs text-gray-500 mb-3">
                        {tour.steps.length} pasos
                      </div>
                      <button
                        onClick={() => handleStartTour(tour.id)}
                        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                      >
                        {isCompleted ? 'Ver de nuevo' : 'Iniciar tour'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            💡 Consejo: Puedes volver a ver cualquier tour en cualquier momento desde este menú
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourManager;
