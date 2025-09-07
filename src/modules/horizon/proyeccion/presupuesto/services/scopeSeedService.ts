import { 
  initDB, 
  PresupuestoLinea
} from '../../../../../services/db';

export interface ScopeSeededData {
  scope: 'PERSONAL' | 'INMUEBLES';
  lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[];
}

// Auto-seed budget lines for both scopes
export const generateScopeSeed = async (
  year: number,
  selectedScopes: ('PERSONAL' | 'INMUEBLES')[],
  isFullYear: boolean,
  startMonth: number
): Promise<ScopeSeededData[]> => {
  const results: ScopeSeededData[] = [];

  for (const scope of selectedScopes) {
    if (scope === 'INMUEBLES') {
      const inmuebleLines = await generateInmueblesSeed(year, isFullYear, startMonth);
      results.push({
        scope: 'INMUEBLES',
        lines: inmuebleLines
      });
    } else if (scope === 'PERSONAL') {
      const personalLines = await generatePersonalSeed(year, isFullYear, startMonth);
      results.push({
        scope: 'PERSONAL',
        lines: personalLines
      });
    }
  }

  return results;
};

// Generate INMUEBLES scope seed
const generateInmueblesSeed = async (
  year: number,
  isFullYear: boolean,
  startMonth: number
): Promise<Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]> => {
  const db = await initDB();
  const lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[] = [];

  // Get active properties
  const allProperties = await db.getAll('properties');
  const activeProperties = allProperties.filter(p => p.state === 'activo');

  // Generate income from rental contracts
  const allContracts = await db.getAll('contracts');
  const activeContracts = allContracts.filter(
    contract => contract.status === 'active'
  );

  for (const contract of activeContracts) {
    const property = activeProperties.find(p => p.id === contract.propertyId);
    if (!property) continue;

    // Generate monthly amounts for rental income
    const monthlyAmounts = new Array(12).fill(0);
    for (let month = 0; month < 12; month++) {
      if (isFullYear || month >= startMonth - 1) {
        monthlyAmounts[month] = contract.monthlyRent || 0;
      }
    }

    lines.push({
      scope: 'INMUEBLES',
      type: 'INGRESO',
      inmuebleId: property.id?.toString(),
      category: 'Rentas de alquiler',
      subcategory: undefined,
      label: `Alquiler - ${property.alias} - ${contract.tenant?.name || 'Inquilino'}`,
      providerName: contract.tenant?.name,
      accountId: undefined, // To be filled manually
      sourceRef: contract.id?.toString(),
      amountByMonth: monthlyAmounts,
      note: 'Generado automáticamente desde contrato'
    });
  }

  // Generate expense placeholders for each property
  const expenseCategories = [
    { 
      category: 'IBI', 
      subcategory: undefined, 
      defaultAmount: 400,
      description: 'IBI',
      distribution: 'split-payment' // Jul + Nov
    },
    { 
      category: 'Comunidad', 
      subcategory: undefined, 
      defaultAmount: 80,
      description: 'Gastos de comunidad',
      distribution: 'monthly'
    },
    { 
      category: 'Seguros', 
      subcategory: undefined, 
      defaultAmount: 200,
      description: 'Seguro hogar',
      distribution: 'annual'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Luz', 
      defaultAmount: 60,
      description: 'Electricidad',
      distribution: 'monthly'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Agua', 
      defaultAmount: 40,
      description: 'Agua',
      distribution: 'monthly'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Gas', 
      defaultAmount: 50,
      description: 'Gas',
      distribution: 'monthly'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Telco', 
      defaultAmount: 45,
      description: 'Internet/Telecomunicaciones',
      distribution: 'monthly'
    },
    { 
      category: 'Reparación y Conservación', 
      subcategory: undefined, 
      defaultAmount: 300,
      description: 'Reparación y conservación',
      distribution: 'annual'
    },
    { 
      category: 'Mejoras', 
      subcategory: undefined, 
      defaultAmount: 0,
      description: 'Mejoras',
      distribution: 'manual'
    },
    { 
      category: 'Mobiliario', 
      subcategory: undefined, 
      defaultAmount: 0,
      description: 'Mobiliario',
      distribution: 'manual'
    }
  ];

  for (const property of activeProperties) {
    for (const expense of expenseCategories) {
      const monthlyAmounts = calculateMonthlyDistribution(
        expense.defaultAmount,
        expense.distribution,
        isFullYear,
        startMonth
      );

      lines.push({
        scope: 'INMUEBLES',
        type: 'COSTE',
        inmuebleId: property.id?.toString(),
        category: expense.category,
        subcategory: expense.subcategory,
        label: `${expense.description} - ${property.alias}`,
        providerName: undefined,
        accountId: undefined, // To be filled manually
        sourceRef: undefined,
        amountByMonth: monthlyAmounts,
        note: expense.distribution === 'manual' ? 'Completar manualmente' : 'Estimación automática'
      });
    }
  }

  // TODO: Add loan/mortgage data from préstamos module
  // This would require integration with the existing loan module

  return lines;
};

// Generate PERSONAL scope seed
const generatePersonalSeed = async (
  year: number,
  isFullYear: boolean,
  startMonth: number
): Promise<Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]> => {
  const lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[] = [];

  // Generate payroll income placeholder
  const payrollMonthlyAmounts = new Array(12).fill(0);
  for (let month = 0; month < 12; month++) {
    if (isFullYear || month >= startMonth - 1) {
      payrollMonthlyAmounts[month] = 0; // To be filled manually
    }
  }

  lines.push({
    scope: 'PERSONAL',
    type: 'INGRESO',
    inmuebleId: undefined,
    category: 'Nómina',
    subcategory: undefined,
    label: 'Nómina principal',
    providerName: undefined,
    accountId: undefined, // To be filled manually
    sourceRef: undefined,
    amountByMonth: payrollMonthlyAmounts,
    note: 'Completar manualmente con datos de nómina'
  });

  // Generate personal expense placeholders
  const personalExpenses = [
    { 
      category: 'Suministros', 
      subcategory: 'Luz', 
      defaultAmount: 80,
      description: 'Electricidad personal'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Agua', 
      defaultAmount: 50,
      description: 'Agua personal'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Gas', 
      defaultAmount: 60,
      description: 'Gas personal'
    },
    { 
      category: 'Suministros', 
      subcategory: 'Telco', 
      defaultAmount: 50,
      description: 'Internet/Móvil personal'
    },
    { 
      category: 'Seguros', 
      subcategory: undefined, 
      defaultAmount: 300,
      description: 'Seguros personales'
    },
    { 
      category: 'Otros', 
      subcategory: undefined, 
      defaultAmount: 0,
      description: 'Otros gastos personales'
    }
  ];

  for (const expense of personalExpenses) {
    const monthlyAmounts = calculateMonthlyDistribution(
      expense.defaultAmount,
      expense.defaultAmount > 0 ? 'monthly' : 'manual',
      isFullYear,
      startMonth
    );

    lines.push({
      scope: 'PERSONAL',
      type: 'COSTE',
      inmuebleId: undefined,
      category: expense.category,
      subcategory: expense.subcategory,
      label: expense.description,
      providerName: undefined,
      accountId: undefined, // To be filled manually
      sourceRef: undefined,
      amountByMonth: monthlyAmounts,
      note: expense.defaultAmount === 0 ? 'Completar manualmente' : 'Estimación automática'
    });
  }

  return lines;
};

// Calculate monthly distribution based on payment pattern
const calculateMonthlyDistribution = (
  annualAmount: number,
  distribution: string,
  isFullYear: boolean,
  startMonth: number
): number[] => {
  const monthlyAmounts = new Array(12).fill(0);

  if (annualAmount === 0) {
    return monthlyAmounts; // Leave as zeros for manual input
  }

  switch (distribution) {
    case 'monthly':
      const monthlyAmount = annualAmount / 12;
      for (let month = 0; month < 12; month++) {
        if (isFullYear || month >= startMonth - 1) {
          monthlyAmounts[month] = Math.round(monthlyAmount * 100) / 100;
        }
      }
      break;

    case 'annual':
      // Place in January or start month
      const targetMonth = isFullYear ? 0 : startMonth - 1;
      if (targetMonth < 12) {
        monthlyAmounts[targetMonth] = annualAmount;
      }
      break;

    case 'split-payment':
      // IBI typical payment: July + November
      if (isFullYear || 6 >= startMonth - 1) { // July
        monthlyAmounts[6] = Math.round(annualAmount * 0.625 * 100) / 100; // 250€ typically
      }
      if (isFullYear || 10 >= startMonth - 1) { // November  
        monthlyAmounts[10] = Math.round(annualAmount * 0.375 * 100) / 100; // 150€ typically
      }
      break;

    case 'quarterly':
      for (let quarter = 0; quarter < 4; quarter++) {
        const month = quarter * 3;
        if (isFullYear || month >= startMonth - 1) {
          monthlyAmounts[month] = Math.round(annualAmount / 4 * 100) / 100;
        }
      }
      break;

    case 'manual':
    default:
      // Leave as zeros for manual input
      break;
  }

  return monthlyAmounts;
};