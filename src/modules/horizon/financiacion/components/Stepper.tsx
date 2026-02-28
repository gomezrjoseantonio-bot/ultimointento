import React from 'react';
import { CheckCircle } from 'lucide-react';

interface StepperProps {
  steps: { id: string; label: string; isCompleted: boolean; isActive: boolean }[];
  onStepClick?: (stepId: string) => void;
}

const Stepper: React.FC<StepperProps> = ({ steps, onStepClick }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {index > 0 && (
            <div
              style={{
                flex: 1,
                minWidth: 20,
                height: 2,
                backgroundColor: steps[index - 1].isCompleted ? 'var(--ok)' : '#ddd',
              }}
            />
          )}
          <button
            onClick={() => onStepClick?.(step.id)}
            disabled={!onStepClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: onStepClick ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: step.isActive ? 600 : 400,
              backgroundColor: step.isActive
                ? 'var(--atlas-blue)'
                : step.isCompleted
                ? 'rgba(40,167,69,0.1)'
                : 'transparent',
              color: step.isActive
                ? '#fff'
                : step.isCompleted
                ? 'var(--ok)'
                : 'var(--text-gray)',
              transition: 'all 150ms ease',
            }}
          >
            {step.isCompleted && !step.isActive && (
              <CheckCircle size={14} strokeWidth={1.5} />
            )}
            {!step.isCompleted && !step.isActive && (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '1.5px solid currentColor',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </span>
            )}
            {step.isActive && (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </span>
            )}
            {step.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default Stepper;
