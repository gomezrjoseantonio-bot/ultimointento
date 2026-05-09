# Algoritmos rescatables de `budgetService.ts` · pre-eliminación

> Capturado en PR-C-PROY-1-bis · 2026-05-09 · antes de eliminar el archivo
> Para reuso cuando se construya `presupuestoService` desde el modelo Mi Plan v2

## Resumen del archivo eliminado

- **Ruta original**: `src/modules/horizon/proyeccion/presupuesto/services/budgetService.ts`
- **Líneas**: 275
- **Imports**: `initDB, Budget, BudgetLine` desde `src/services/db.ts`
- **Stores que intentaba escribir**: `'budgets'` y `'budgetLines'` (FANTASMAS · ningún `createObjectStore` los crea en `db.ts`; aparecen únicamente en `STORES_OBSOLETOS` de la migración V44, donde se borran defensivamente si existieran).
- **Consumers en main pre-borrado** (3, todos caso (b) — importan también código vivo):
  1. `src/modules/horizon/proyeccion/presupuesto/ProyeccionPresupuesto.tsx` — usaba `getBudgetsByYear`
  2. `src/modules/horizon/proyeccion/presupuesto/components/WizardStepConfiguracion.tsx` — usaba `calculateMonthlyAmounts` (función pura)
  3. `src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts` — usaba `getLatestBudgetByYear`

## Funciones/algoritmos potencialmente reutilizables

### `calculateMonthlyAmounts`

- **Propósito**: dado un importe anual, una frecuencia de pago, un mes inicial y (opcional) un número de plazos, devuelve el reparto mes a mes (array de 12 posiciones) con redondeo a 2 decimales.
- **Input**: `(amount: number, frequency: 'mensual' | 'trimestral' | 'anual' | 'fraccionado' | 'unico', startMonth: number, installments?: number)`
- **Output**: `number[]` (longitud 12)
- **Notas**: pura, sin dependencias de DB. Buena base para cualquier presupuesto futuro. Maneja casos especiales para `installments === 2` (semestral) y `installments === 3` (cuatrimestral). El resto cae en distribución genérica.
- **Código**:
  ```ts
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
        const quarterStartMonth = startMonth - 1;
        for (let i = 0; i < 4; i++) {
          const monthIndex = (quarterStartMonth + i * 3) % 12;
          months[monthIndex] = quarterlyAmount;
        }
        break;

      case 'anual':
        months[startMonth - 1] = amount;
        break;

      case 'fraccionado':
        if (installments && installments > 0 && installments <= 12) {
          const installmentAmount = amount / installments;
          const monthsPerInstallment = Math.floor(12 / installments);

          if (installments === 2) {
            months[startMonth - 1] = installmentAmount;
            months[(startMonth - 1 + 6) % 12] = installmentAmount;
          } else if (installments === 3) {
            for (let i = 0; i < installments; i++) {
              const monthIndex = (startMonth - 1 + i * 4) % 12;
              months[monthIndex] = installmentAmount;
            }
          } else {
            for (let i = 0; i < installments; i++) {
              const monthIndex = (startMonth - 1 + i * monthsPerInstallment) % 12;
              months[monthIndex] = installmentAmount;
            }
          }
        }
        break;

      case 'unico':
        months[startMonth - 1] = amount;
        break;
    }

    return months.map(m => Math.round(m * 100) / 100);
  };
  ```

### `generateNextVersion`

- **Propósito**: dado un array de strings de versión `vMAJOR.MINOR`, devuelve el siguiente minor (p.ej. `['v1.0','v1.2']` → `'v1.3'`).
- **Input**: `existingVersions: string[]`
- **Output**: `string`
- **Notas**: pura. Útil para versionado de presupuestos confirmados. No maneja saltos de major; si Mi Plan v2 quiere bump major, ampliar.
- **Código**:
  ```ts
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
  ```

### `calculateBudgetTotals`

- **Propósito**: agrega líneas de presupuesto en totales anuales y desglose mensual de ingresos / gastos / resultado neto.
- **Input**: `lines: BudgetLine[]` (con campo `monthlyAmounts: number[]` ya calculado)
- **Output**: `{ annualIncome, annualExpenses, monthlyBreakdown: { income, expenses, result } }`
- **Notas**: pura. Clasifica como ingreso únicamente la categoría `'ingresos-alquiler'`; el resto cuenta como gasto. Cuando el modelo Mi Plan v2 amplíe categorías de ingreso (rendimientos, dividendos, etc.), parametrizar esa lista en lugar de hardcodear.
- **Código**:
  ```ts
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
  ```

### `generateBudgetSeed`

- **Propósito**: auto-genera líneas de presupuesto a partir de contratos activos (ingresos por alquiler) más placeholders para categorías de gasto comunes (IBI, comunidad, seguros, reparación, suministros, gestión).
- **Input**: `(year: number, propertyIds: number[], isFullYear: boolean, startMonth: number)`
- **Output**: `Promise<Omit<BudgetLine, 'id' | 'budgetId'>[]>`
- **Notas**: depende del store `contracts` (vivo). El esqueleto sirve para Mi Plan v2: la idea de seedear partidas desde fuentes ya conocidas (contratos, hipotecas históricas, IBI/comunidad históricos) es reutilizable, aunque la API final probablemente maneje también gastos personales.
- **Código** (estructura, simplificada para futura referencia — el original incluye una sección `// TODO` con extensiones pendientes):
  ```ts
  export const generateBudgetSeed = async (
    year: number,
    propertyIds: number[],
    isFullYear: boolean,
    startMonth: number
  ): Promise<Omit<BudgetLine, 'id' | 'budgetId'>[]> => {
    const db = await initDB();
    const lines: Omit<BudgetLine, 'id' | 'budgetId'>[] = [];
    const now = new Date().toISOString();

    const contractsStore = db.transaction('contracts', 'readonly').store;
    const allContracts = await contractsStore.getAll();
    const activeContracts = allContracts.filter(
      contract =>
        propertyIds.includes(contract.propertyId) &&
        contract.status === 'active'
    );

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

    // Placeholders por inmueble: IBI, comunidad, seguros, reparación, suministros, gestión
    const expenseCategories = [
      { category: 'ibi', description: 'IBI' },
      { category: 'comunidad', description: 'Gastos de comunidad' },
      { category: 'seguros', description: 'Seguros' },
      { category: 'reparacion-conservacion', description: 'Reparación y conservación' },
      { category: 'suministros', description: 'Suministros (agua, luz, gas)' },
      { category: 'gestion-psi-administracion', description: 'Gestión y administración' }
    ];

    for (const propertyId of propertyIds) {
      for (const { category, description } of expenseCategories) {
        lines.push({
          propertyId,
          category: category as any,
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
  ```

## Funciones que NO vale la pena rescatar

CRUD puro sobre el store fantasma `'budgets'` / `'budgetLines'` — no aporta lógica reutilizable más allá de `db.put/get/delete` con índice por `year` o `budgetId`:

- `getBudgetsByYear` — `transaction('budgets').index('year').getAll(year)` ordenado por versión
- `getLatestBudgetByYear` — wrapper que devuelve el último de `getBudgetsByYear`
- `createBudget` — `db.add('budgets', ...)` con timestamps
- `updateBudget` — `db.get` + `db.put` con `updatedAt`
- `deleteBudget` — borra budget + sus lines en transacción
- `getBudgetLines` — `transaction('budgetLines').index('budgetId').getAll(budgetId)`
- `createBudgetLines` — bucle `add` en transacción

Cuando se construya `presupuestoService` (V61+ ya tiene `presupuestos` y `presupuestoLineas` reales en `db.ts`), el CRUD se reescribe con la API real del store; la firma es trivial.

## Conclusión

Cuando se construya `presupuestoService` desde Mi Plan v2 · revisar este documento como referencia. Probablemente la API final será distinta · pero los cálculos puros (`calculateMonthlyAmounts`, `calculateBudgetTotals`, `generateNextVersion`) y la idea de seedear desde contratos/hipotecas (`generateBudgetSeed`) pueden ahorrar trabajo.
