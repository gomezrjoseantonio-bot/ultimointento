import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ExportRecord {
  id: string;
  exerciseYear: number;
  dateTime: string;
  user: string;
  propertyScope: 'todos' | number;
  fileName: string;
}

interface FiscalExportsState {
  export_history: ExportRecord[];
}

const initialState: FiscalExportsState = {
  export_history: []
};

const fiscalExportsSlice = createSlice({
  name: 'fiscal_exports',
  initialState,
  reducers: {
    addExportRecord: (state, action: PayloadAction<ExportRecord>) => {
      state.export_history = [action.payload, ...state.export_history].slice(0, 50);
    },
    clearExportHistory: (state) => {
      state.export_history = [];
    }
  }
});

export const { addExportRecord, clearExportHistory } = fiscalExportsSlice.actions;
export default fiscalExportsSlice.reducer;
