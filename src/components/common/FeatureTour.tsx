import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, Target } from 'lucide-react';

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface FeatureTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  tourId: string; // Unique ID for storing completion status
}

/**
 * Sprint 4: Feature Tour Component
 * Provides guided tours for key features with step-by-step instructions
 * Highlights specific UI elements and provides contextual help
 */

// Padding around highlighted elements (in pixels)
const HIGHLIGHT_PADDING = 8;

const FeatureTour: React.FC<FeatureTourProps> = ({ 
  steps, 
  onComplete, 
  onSkip,
  tourId 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // State for spotlight mask and highlight border
  const [spotlightMask, setSpotlightMask] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [highlightBorder, setHighlightBorder] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Get target element for highlighting - memoized to avoid repeated DOM queries
  const targetElement = React.useMemo(
    () => document.querySelector(currentStepData.target),
    [currentStepData.target]
  );

  // Calculate position of tooltip based on target element
  useEffect(() => {
    const updatePosition = () => {
      const targetElement = document.querySelector(currentStepData.target);
      if (!targetElement || !tooltipRef.current) return;

      const targetRect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const placement = currentStepData.placement || 'bottom';

      let top = 0;
      let left = 0;

      switch (placement) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 16;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + 16;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.left - tooltipRect.width - 16;
          break;
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.right + 16;
          break;
      }

      // Ensure tooltip stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 16) left = 16;
      if (left + tooltipRect.width > viewportWidth - 16) {
        left = viewportWidth - tooltipRect.width - 16;
      }

      if (top < 16) top = 16;
      if (top + tooltipRect.height > viewportHeight - 16) {
        top = viewportHeight - tooltipRect.height - 16;
      }

      setPosition({ top, left });

      // Scroll target into view if needed
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Wait for target to be rendered
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentStep, currentStepData.target, currentStepData.placement]);

  // Update spotlight mask and highlight border on scroll, resize, or targetElement change
  useEffect(() => {
    function updateRects() {
      if (!targetElement) {
        setSpotlightMask(null);
        setHighlightBorder(null);
        return;
      }
      const rect = targetElement.getBoundingClientRect();
      
      // Calculate adjusted dimensions once for both spotlight and highlight
      const adjustedRect = {
        x: rect.left - HIGHLIGHT_PADDING,
        y: rect.top - HIGHLIGHT_PADDING,
        width: rect.width + HIGHLIGHT_PADDING * 2,
        height: rect.height + HIGHLIGHT_PADDING * 2
      };
      
      setSpotlightMask({
        x: adjustedRect.x,
        y: adjustedRect.y,
        width: adjustedRect.width,
        height: adjustedRect.height
      });
      setHighlightBorder({
        top: adjustedRect.y,
        left: adjustedRect.x,
        width: adjustedRect.width,
        height: adjustedRect.height
      });
    }

    // Initial update
    updateRects();

    // Update on scroll and resize
    window.addEventListener('scroll', updateRects, true);
    window.addEventListener('resize', updateRects);

    return () => {
      window.removeEventListener('scroll', updateRects, true);
      window.removeEventListener('resize', updateRects);
    };
  }, [targetElement]);

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
    localStorage.setItem(`atlas_tour_${tourId}_completed`, 'true');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(`atlas_tour_${tourId}_completed`, 'true');
    localStorage.setItem(`atlas_tour_${tourId}_skipped`, 'true');
    onSkip();
  };

  return (
    <>
      {/* Overlay with spotlight effect */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightMask && (
                <rect
                  x={spotlightMask.x}
                  y={spotlightMask.y}
                  width={spotlightMask.width}
                  height={spotlightMask.height}
                  fill="black"
                  rx="8"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(255, 255, 255, 0.8)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Highlight border around target */}
      {highlightBorder && (
        <div
          className="fixed z-40 pointer-events-none rounded-lg"
          style={{
            top: highlightBorder.top,
            left: highlightBorder.left,
            width: highlightBorder.width,
            height: highlightBorder.height,
            border: '3px solid var(--atlas-blue)',
            boxShadow: '0 0 0 4px rgba(4, 44, 94, 0.2)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 bg-white rounded-xl shadow-2xl max-w-md border border-gray-200"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-400" />
              <h3 className="text-lg font-bold text-white">{currentStepData.title}</h3>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <p className="text-gray-300 mb-4">{currentStepData.content}</p>

          {/* Action button if provided */}
          {currentStepData.action && (
            <button
              onClick={currentStepData.action.onClick}
              className="w-full mb-3 px-4 py-2 rounded-lg bg-atlas-blue hover:bg-primary-800 text-white font-medium transition-colors"
            >
              {currentStepData.action.label}
            </button>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Paso {currentStep + 1} de {steps.length}
            </div>
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-white text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ backgroundColor: 'var(--atlas-blue)' }}
              >
                {isLastStep ? 'Finalizar' : 'Siguiente'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeatureTour;
