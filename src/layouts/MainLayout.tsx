import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/navigation/Sidebar';
import Header from '../components/navigation/Header';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Check if user has completed onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('atlas_onboarding_completed');
    if (!hasCompletedOnboarding) {
      // Show onboarding after a short delay for better UX
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sprint 4: Onboarding Wizard for new users */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
      
      {/* Skip Link - Sprint 3: Accessibility improvement */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-medium focus:shadow-lg"
        style={{
          backgroundColor: 'var(--hz-primary)',
          color: 'white',
        }}
      >
        Saltar a contenido principal
      </a>
      
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <Header setSidebarOpen={setSidebarOpen} />
        
        <main 
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6 min-h-0"
          tabIndex={-1}
        >
          <div className="container mx-auto h-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;