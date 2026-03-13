import React from 'react';
import { Provider } from 'react-redux';
import PageLayout from '../../../../components/common/PageLayout';
import TaxView from '../../../../components/tax/TaxView';
import { store } from '../../../../store';

const DeclaracionPage: React.FC = () => {
  return (
    <Provider store={store}>
      <PageLayout title="Declaración" subtitle="Modelo 100 — Estimación en tiempo real">
        <TaxView />
      </PageLayout>
    </Provider>
  );
};

export default DeclaracionPage;
