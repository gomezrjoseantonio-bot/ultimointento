import { configureStore } from '@reduxjs/toolkit';
import fiscalExportsReducer from './fiscalExportsSlice';

export const store = configureStore({
  reducer: {
    fiscal_exports: fiscalExportsReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
