import React from 'react';
import { Provider } from 'react-redux';
import TaxView from '../../../../components/tax/TaxView';
import { store } from '../../../../store';

const DeclaracionPage: React.FC = () => {
  return (
    <Provider store={store}>
      <TaxView />
    </Provider>
  );
};

export default DeclaracionPage;
