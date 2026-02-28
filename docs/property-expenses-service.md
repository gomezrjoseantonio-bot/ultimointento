# Servicio centralizado de gastos por inmueble (OPEX/CAPEX)

## Objetivo
Centralizar la lectura de gastos de inmueble en un único punto (`src/services/propertyExpenses.ts`) para evitar cálculos inconsistentes entre módulos.

## Modelo unificado
Se introduce `PropertyExpense` (`src/types/propertyExpenses.ts`) como shape común para exponer:
- Reglas OPEX (`opexRules`) como fuente principal.
- Datos legacy (`gastos`, `expensesH5`, `expenses`, `capex`) como compatibilidad temporal.

## API pública
- `getAllExpensesForProperty(propertyId)`
- `getAnnualOpexForProperty(propertyId)`
- `normalizeExpenseToAnnual(expense)`
- `getExpenseDiagnosticsForProperty(propertyId)`

## Estrategia de migración progresiva
1. **Fuente de verdad nueva**: `opexRules` (modelo ya existente en IndexedDB).
2. **Fallback temporal**: si no hay reglas activas, se usan gastos legacy del último año.
3. **Salida de legacy**: cuando todos los inmuebles tengan reglas OPEX activas, dejar de depender de stores legacy para cálculos operativos.

## Plan mínimo de migración de datos
Aunque esta app usa IndexedDB local, para backend SQL equivalente:

```sql
-- Tabla destino sugerida
CREATE TABLE property_expenses (
  id UUID PRIMARY KEY,
  property_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  frequency TEXT NOT NULL,
  account_id INTEGER NULL,
  source TEXT NOT NULL,
  expense_class TEXT NOT NULL,
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### Sync recomendado
- Importar `opexRules` -> `property_expenses` (`source='opex_rule'`, `is_legacy=false`).
- Importar `gastos`/`expensesH5`/`expenses`/`capex` -> `property_expenses` (`is_legacy=true`).
- Ejecutar reconciliación por inmueble y confirmar que `annual_opex_new ~= annual_opex_legacy` antes de apagar fallback.
