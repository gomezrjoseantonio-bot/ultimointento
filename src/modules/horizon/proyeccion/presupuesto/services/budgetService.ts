import { initDB, Budget, BudgetLine } from '../../../../../services/db';

// Get all budgets for a specific year
export const getBudgetsByYear = async (year: number): Promise<Budget[]> => {
  const db = await initDB();
  const tx = db.transaction('budgets', 'readonly');
  const index = tx.store.index('year');
  const budgets = await index.getAll(year);
  return budgets.sort((a, b) => a.version.localeCompare(b.version));
};

// Get latest budget version for a year
export const getLatestBudgetByYear = async (year: number): Promise<Budget | null> => {
  const budgets = await getBudgetsByYear(year);
  return budgets.length > 0 ? budgets[budgets.length - 1] : null;
};

// Create a new budget
export const createBudget = async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  const db = await initDB();
  const now = new Date().toISOString();
  
  const budget: Omit<Budget, 'id'> = {
    ...budgetData,
    createdAt: now,
    updatedAt: now
  };
  
  return db.add('budgets', budget) as Promise<number>;
};

// Update a budget
export const updateBudget = async (id: number, updates: Partial<Budget>): Promise<void> => {
  const db = await initDB();
  const budget = await db.get('budgets', id);
  if (!budget) throw new Error('Budget not found');
  
  const updatedBudget: Budget = {
    ...budget,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put('budgets', updatedBudget);
};

// Delete a budget and its lines
export const deleteBudget = async (id: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['budgets', 'budgetLines'], 'readwrite');
  
  // Delete budget lines first
  const linesIndex = tx.objectStore('budgetLines').index('budgetId');
  const lines = await linesIndex.getAll(id);
  for (const line of lines) {
    await tx.objectStore('budgetLines').delete(line.id!);
  }
  
  // Delete budget
  await tx.objectStore('budgets').delete(id);
};

// Get budget lines for a budget
export const getBudgetLines = async (budgetId: number): Promise<BudgetLine[]> => {
  const db = await initDB();
  const tx = db.transaction('budgetLines', 'readonly');
  const index = tx.store.index('budgetId');
  return index.getAll(budgetId);
};

// Create budget lines
export const createBudgetLines = async (lines: Omit<BudgetLine, 'id'>[]): Promise<number[]> => {
  const db = await initDB();
  const tx = db.transaction('budgetLines', 'readwrite');
  const ids: number[] = [];
  
  for (const line of lines) {
    const id = await tx.store.add(line);
    ids.push(id as number);
  }
  
  return ids;
};

// Calculate monthly amounts based on frequency
export const calculateMonthlyAmounts = (
  amount: number, 
  frequency: BudgetLine['frequency'], 
  startMonth: number, 
  installments?: number
): number[] => {
  const months = new Array(12).fill(0);
  
  switch (frequency) {
    case 'mensual':
      const monthlyAmount = amount / 12;
      for (let i = 0; i < 12; i++) {
        months[i] = monthlyAmount;
      }
      break;
      
    case 'trimestral':
      const quarterlyAmount = amount / 4;
      // Default pattern: January, April, July, October (0, 3, 6, 9)
      months[0] = quarterlyAmount;
      months[3] = quarterlyAmount;
      months[6] = quarterlyAmount;
      months[9] = quarterlyAmount;
      break;
      
    case 'anual':
      months[startMonth - 1] = amount;
      break;
      
    case 'fraccionado':
      if (installments && installments > 0) {
        const installmentAmount = amount / installments;
        const monthsPerInstallment = Math.floor(12 / installments);
        for (let i = 0; i < installments; i++) {
          const monthIndex = (startMonth - 1 + i * monthsPerInstallment) % 12;
          months[monthIndex] = installmentAmount;
        }
      }
      break;
      
    case 'unico':
      months[startMonth - 1] = amount;
      break;
  }
  
  return months.map(m => Math.round(m * 100) / 100); // Round to 2 decimals
};

// Generate next version string
export const generateNextVersion = (existingVersions: string[]): string => {
  if (existingVersions.length === 0) return 'v1.0';
  
  const versions = existingVersions
    .map(v => v.replace('v', ''))
    .map(v => v.split('.').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  
  const latest = versions[versions.length - 1];
  const nextMinor = latest[1] + 1;
  
  return `v${latest[0]}.${nextMinor}`;
};

// Auto-populate budget from existing data
export const generateBudgetSeed = async (
  year: number, 
  propertyIds: number[], 
  isFullYear: boolean,
  startMonth: number
): Promise<Omit<BudgetLine, 'id' | 'budgetId'>[]> => {
  const db = await initDB();
  const lines: Omit<BudgetLine, 'id' | 'budgetId'>[] = [];
  const now = new Date().toISOString();
  
  // Get active contracts for selected properties
  const contractsStore = db.transaction('contracts', 'readonly').store;
  const allContracts = await contractsStore.getAll();
  const activeContracts = allContracts.filter(
    contract => 
      propertyIds.includes(contract.propertyId) && 
      contract.status === 'active'
  );
  
  // Generate income from contracts
  for (const contract of activeContracts) {
    lines.push({
      propertyId: contract.propertyId,
      category: 'ingresos-alquiler',
      description: `Alquiler - ${contract.tenant.name}`,
      amount: contract.monthlyRent * 12,
      frequency: 'mensual',
      startMonth: 1,
      monthlyAmounts: calculateMonthlyAmounts(contract.monthlyRent * 12, 'mensual', 1),
      isAutoGenerated: true,
      sourceType: 'contract',
      sourceId: contract.id,
      notes: `Generado automáticamente desde contrato`,
      createdAt: now,
      updatedAt: now
    });
  }
  
  // TODO: Add auto-generation for:
  // - Mortgages/loans from property data
  // - Historical expenses (IBI, Community fees, Insurance)
  // - Placeholder lines for manual categories
  
  // Add placeholder lines for common expense categories
  const expenseCategories = [
    { category: 'ibi' as const, description: 'IBI' },
    { category: 'comunidad' as const, description: 'Gastos de comunidad' },
    { category: 'seguros' as const, description: 'Seguros' },
    { category: 'reparacion-conservacion' as const, description: 'Reparación y conservación' },
    { category: 'suministros' as const, description: 'Suministros (agua, luz, gas)' },
    { category: 'gestion-psi-administracion' as const, description: 'Gestión y administración' }
  ];
  
  for (const propertyId of propertyIds) {
    for (const { category, description } of expenseCategories) {
      lines.push({
        propertyId,
        category,
        description,
        amount: 0,
        frequency: 'anual',
        startMonth: 1,
        monthlyAmounts: new Array(12).fill(0),
        isAutoGenerated: false,
        sourceType: 'manual',
        notes: 'Completar manualmente',
        createdAt: now,
        updatedAt: now
      });
    }
  }
  
  return lines;
};

// Calculate budget totals
export const calculateBudgetTotals = (lines: BudgetLine[]) => {
  const incomeCategories = ['ingresos-alquiler'];
  
  let annualIncome = 0;
  let annualExpenses = 0;
  const monthlyIncome = new Array(12).fill(0);
  const monthlyExpenses = new Array(12).fill(0);
  
  for (const line of lines) {
    if (incomeCategories.includes(line.category)) {
      annualIncome += line.amount;
      for (let i = 0; i < 12; i++) {
        monthlyIncome[i] += line.monthlyAmounts[i];
      }
    } else {
      annualExpenses += line.amount;
      for (let i = 0; i < 12; i++) {
        monthlyExpenses[i] += line.monthlyAmounts[i];
      }
    }
  }
  
  const monthlyResult = monthlyIncome.map((income, i) => income - monthlyExpenses[i]);
  
  return {
    annualIncome: Math.round(annualIncome * 100) / 100,
    annualExpenses: Math.round(annualExpenses * 100) / 100,
    monthlyBreakdown: {
      income: monthlyIncome.map(m => Math.round(m * 100) / 100),
      expenses: monthlyExpenses.map(m => Math.round(m * 100) / 100),
      result: monthlyResult.map(m => Math.round(m * 100) / 100)
    }
  };
};