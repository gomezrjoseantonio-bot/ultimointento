import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPage from './pages/InboxPage';
import RealEstatePortfolioPage from './pages/RealEstatePortfolioPage';
import ExpensesPage from './pages/ExpensesPage';
import ContractsPage from './pages/ContractsPage';
import TreasuryPage from './pages/TreasuryPage';
import TaxPage from './pages/TaxPage';
import ProjectionsPage from './pages/ProjectionsPage';
import PulseCentersPage from './pages/PulseCentersPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="real-estate" element={<RealEstatePortfolioPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="treasury" element={<TreasuryPage />} />
          <Route path="tax" element={<TaxPage />} />
          <Route path="projections" element={<ProjectionsPage />} />
          <Route path="pulse" element={<PulseCentersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;