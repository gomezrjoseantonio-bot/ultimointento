import { configureStore } from '@reduxjs/toolkit';
import fiscalExportsReducer from './fiscalExportsSlice';
import taxReducer from './taxSlice';

export const store = configureStore({
  reducer: {
    fiscal_exports: fiscalExportsReducer,
    tax: taxReducer,
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
