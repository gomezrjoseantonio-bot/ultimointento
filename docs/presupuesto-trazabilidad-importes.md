# Trazabilidad de importes en líneas de presupuesto (módulo Previsiones)

## Objetivo
Mapear, para **cada línea que se genera en el presupuesto**, de dónde sale su importe y en qué momento del flujo se fija/edita/persiste.

## Flujo temporal (cuándo entra cada importe)
1. **Paso 2 · Semilla automática**: el wizard llama `generateScopeSeed(...)` y construye `amountByMonth` de cada línea (contratos + plantillas).  
2. **Paso 3 · Configuración**: edición manual inline en tabla (`BudgetTableEditor`), cambiando meses concretos de `amountByMonth`.  
3. **Paso 4 · Confirmación**: se guardan los valores actuales en IndexedDB con `createPresupuestoLinea(...)`.

---

## Catálogo de líneas e importe origen (scope `INMUEBLES`)

### 1) Ingresos de alquiler
- **Línea**: `type=INGRESO`, `category='Rentas de alquiler'`, etiqueta `Alquiler - {alias inmueble} - {inquilino}`.
- **Origen del importe**: `contract.monthlyRent` de cada contrato activo.
- **Cálculo mensual**: para cada mes del año, si aplica por periodo (`isFullYear`/`startMonth`), se asigna `monthlyRent`; si no, `0`.
- **Momento**:
  - se calcula en **semilla automática** (`generateInmueblesSeed`),
  - puede ser editado en **configuración**,
  - se persiste en **confirmación**.

### 2) Costes por plantillas de inmueble (estimación automática o manual)
Para cada inmueble activo se crean líneas de gasto con `amountByMonth` según `calculateMonthlyDistribution(...)`:

- **IBI** (`defaultAmount=400`, `split-payment`)  
  - reparto: julio 62.5% + noviembre 37.5%.
- **Comunidad** (`defaultAmount=80`, `monthly`)  
  - reparto: anual/12 en cada mes aplicable.
- **Seguro hogar** (`defaultAmount=200`, `annual`)  
  - se coloca en enero (año completo) o en `startMonth`.
- **Electricidad** (`defaultAmount=60`, `monthly`).
- **Agua** (`defaultAmount=40`, `monthly`).
- **Gas** (`defaultAmount=50`, `monthly`).
- **Internet/Telecomunicaciones** (`defaultAmount=45`, `monthly`).
- **Reparación y conservación** (`defaultAmount=300`, `annual`).
- **Mejoras** (`defaultAmount=0`, `manual`)  
  - todos los meses a 0 hasta edición manual.
- **Mobiliario** (`defaultAmount=0`, `manual`)  
  - todos los meses a 0 hasta edición manual.

**Momento**: nace en semilla con importes por defecto, luego es editable en configuración y finalmente se guarda en confirmación.

---

## Catálogo de líneas e importe origen (scope `PERSONAL`)

### 1) Ingreso de nómina
- **Línea**: `type=INGRESO`, `category='Nómina'`, `label='Nómina principal'`.
- **Origen del importe**: **no hay origen automático real** (se inicializa a 0).
- **Cálculo mensual inicial**: meses aplicables a 0.
- **Momento**: se crea en semilla a 0, requiere edición manual en configuración antes de confirmación.

### 2) Gastos personales de plantilla
Se crean líneas de gasto con importes por defecto y distribución mensual/manual:

- **Electricidad personal** (`80`, monthly)
- **Agua personal** (`50`, monthly)
- **Gas personal** (`60`, monthly)
- **Internet/Móvil personal** (`50`, monthly)
- **Seguros personales** (`300`, monthly)
- **Otros gastos personales** (`0`, manual)

**Momento**: importes iniciales en semilla, ajuste manual en configuración, persistencia en confirmación.

---

## Dónde se edita realmente el importe
En `BudgetTableEditor`, al editar una celda mensual, se actualiza `line.amountByMonth[mes]` y se propaga por `onLinesChange` hacia el estado del wizard.

## Dónde se guarda finalmente
En revisión, por cada scope seleccionado, se crea un presupuesto y luego cada línea se guarda con `createPresupuestoLinea({...line, presupuestoId})`, preservando el `amountByMonth` resultante tras edición.

---

## Observaciones relevantes para el ajuste posterior
- El módulo mezcla datos **reales** (alquiler de contratos) con **estimaciones fijas** (IBI, comunidad, suministros, etc.).
- En personal, la nómina no se hidrata desde ninguna fuente externa (siempre arranca a 0).
- Existe una nota `TODO` para integrar préstamos/hipotecas en la semilla de inmuebles, por lo que esos importes hoy no entran automáticamente.
