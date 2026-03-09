import React, { useEffect, useState } from 'react';

interface StepTransitionProps {
  children: React.ReactNode;
  stepKey: string;
}

const StepTransition: React.FC<StepTransitionProps> = ({ children, stepKey }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [stepKey]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
    >
      {children}
    </div>
  );
};

export default StepTransition;
