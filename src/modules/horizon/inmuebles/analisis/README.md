# Módulo de Análisis de Inmuebles

Este módulo implementa un sistema completo de análisis de rentabilidad y rendimiento fiscal para inmuebles usando exclusivamente datos reales de IndexedDB (stores `properties`, `contracts`, `ingresos`, `gastos`, `prestamos` y `valoraciones_historicas`).

## Estructura

```
src/modules/horizon/inmuebles/analisis/
├── Analisis.tsx                              # Componente principal
└── components/
    ├── PropertyHeader.tsx                    # Cabecera con semáforo
    ├── OperationalPerformanceSection.tsx     # BLOQUE 1.A
    ├── FinancialProfitabilitySection.tsx     # BLOQUE 1.B
    ├── FiscalROISection.tsx                  # BLOQUE 1.C
    ├── SaleSimulationSection.tsx             # BLOQUE 3.1
    └── RecommendationActionSection.tsx       # BLOQUE 3.2 y 3.3
```

## Tipos de Datos

Definidos en `src/types/propertyAnalysis.ts`:

- `OperationalPerformance`: Rendimiento operativo mensual y anual
- `FinancialProfitability`: Métricas de rentabilidad financiera
- `FiscalROI`: ROI fiscal neto y comparativa con coste de oportunidad
- `SaleSimulation`: Simulación de venta con cálculos de capital neto
- `PropertyAnalysis`: Estructura completa del análisis

## Funciones Utilitarias

Implementadas en `src/utils/propertyAnalysisUtils.ts`:

### Cálculos Principales

1. **`calculateOperationalPerformance()`**
   - Calcula cashflow mensual y anual
   - Input: ingresos, gastos, cuota hipoteca
   - Output: cashflow neto mensual y anual

2. **`calculateFinancialProfitability()`**
   - Calcula métricas de rentabilidad
   - Input: valor activo, deuda, precio compra, ingresos, etc.
   - Output: ROI equity, ROI total, rentabilidades

3. **`calculateFiscalROI()`**
   - Calcula ROI fiscal neto tras impuestos
   - Compara con coste de oportunidad
   - Genera recomendación automática
   - Output: ROI fiscal neto, diferencial, conclusión

4. **`calculateSaleSimulation()`**
   - Simula venta del inmueble
   - Calcula capital neto final tras impuestos
   - Output: plusvalía, IRPF, capital liberable

### Funciones de Apoyo

- `getRecommendationText()`: Genera texto de recomendación
- `getTrafficLightColor()`: Color del semáforo
- `getTrafficLightEmoji()`: Emoji del semáforo

## Sistema de Semáforo (Traffic Light)

El sistema genera recomendaciones automáticas basadas en la comparación entre ROI fiscal neto y coste de oportunidad:

| Estado | Emoji | Condición | Recomendación |
|--------|-------|-----------|---------------|
| MANTENER | 🟢 | ROI fiscal ≥ coste oportunidad | "Este activo trabaja bien" |
| REVISAR | ⚪ | ROI fiscal ± 1% del coste oportunidad | "Valora mejoras o refinanciación" |
| VENDER | 🔴 | ROI fiscal < coste oportunidad (>1%) | "Liberar capital puede mejorar tu posición" |

## BLOQUE 1: Rendimiento Actual y ROI Fiscal

### A. Rendimiento Operativo
- Ingresos mensuales (€)
- Gastos operativos (€)
- Cuota hipoteca (€)
- Cashflow neto mensual (€)
- Cashflow anual (€)

### B. Rentabilidad Financiera
- Valor actual del activo (€)
- Deuda pendiente (€)
- Equity actual (€)
- Rentabilidad bruta (%)
- Rentabilidad neta (%)
- ROI equity real (%)
- ROI total (%)

### C. ROI Fiscal y Rendimiento Real
- Impuesto sobre rentas (€)
- Cashflow neto tras impuestos (€)
- ROI fiscal neto (%)
- ROI alternativo / coste de oportunidad (%)
- ROI diferencial (%)
- Conclusión automática (🟢/⚪/🔴)

## BLOQUE 3: Simulación de Venta + Recomendación + Acción

### 3.1 Simulación de Venta (Siempre Visible)

**Campos Editables:**
- Precio venta (€)
- Comisión venta (€)

**Campos Automáticos:**
- Impuestos (3%) (€)
- Deuda pendiente (€)
- Comisión cancelación (€)
- Capital liberable (sin IRPF) (€)
- Plusvalía estimada (€)
- IRPF (26%) (€)
- Capital neto final (€)
- Intereses futuros evitados (€)

### 3.2 Recomendación Automática

Genera texto dinámico basado en el análisis fiscal:

```typescript
if (ROI fiscal >= coste oportunidad) {
  // 🟢 MANTENER
  "Tu ROI fiscal neto (X%) supera el coste de oportunidad (Y%). Este activo trabaja bien."
} else if (Math.abs(diferencial) <= 1) {
  // ⚪ REVISAR
  "Tu ROI fiscal neto (X%) está en el umbral de rentabilidad esperada. Valora mejoras o refinanciación."
} else {
  // 🔴 VENDER
  "Tu ROI fiscal neto (X%) está por debajo del coste de oportunidad (Y%). Liberar Z€ puede mejorar tu posición."
}
```

### 3.3 Acciones Manuales

| Acción | Color | Comportamiento |
|--------|-------|----------------|
| 🟢 Mantener | Verde | Guarda estado "mantener" y cierra ficha |
| ⚪ Revisar | Gris | Guarda "revisar" y agenda revisión a 6 meses |
| 🔴 Vender | Rojo | Pide fecha objetivo → recalcula intereses → envía a Plan Base |

## Configuración

Valores por defecto en `DEFAULT_ANALYSIS_CONFIG`:

```typescript
{
  tipoMarginalIRPF: 0.47,    // 47% tipo marginal IRPF
  roiAlternativo: 0.10,      // 10% coste de oportunidad
  irpfPlusvalia: 0.26,       // 26% IRPF sobre plusvalías
  impuestosVenta: 0.03,      // 3% impuestos de venta
}
```

## Reglas de Diseño

- **Tipografía**: 14px uniforme en todo el módulo
- **Layout**: Grid de 3 columnas (33% / 33% / 34%)
- **Colores**: Variables ATLAS (`--text-primary`, `--text-secondary`, `--border-color`, `--bg-secondary`)
- **Estilo**: Sin fondos ni saturaciones, diseño limpio
- **Sin duplicados**: Cada campo aparece una sola vez

## Testing

Tests completos en `src/utils/__tests__/propertyAnalysisUtils.test.ts`:

```bash
npm test -- --testPathPattern=propertyAnalysisUtils
```

**Cobertura:**
- ✅ 11 tests unitarios
- ✅ 100% de las funciones de cálculo
- ✅ Todos los escenarios de recomendación
- ✅ Casos edge (plusvalías negativas, equity cero, etc.)

## Uso

```typescript
import { Analisis } from './modules/horizon/inmuebles/analisis/Analisis';

// El componente se integra automáticamente con:
// - Base de datos de inmuebles (IndexedDB)
// - Sistema de propiedades activas
// - Navegación de React Router
```

## Integración Futura

El módulo está preparado para:

1. **Plan Base**: Enviar decisiones de venta al módulo de planificación
2. **Copiloto**: Integrar recomendaciones en el asistente IA
3. **Alertas**: Notificar cuando ROI cae por debajo del umbral
4. **Histórico**: Guardar análisis para tracking temporal

## Notas de Implementación

- El semáforo refleja la **recomendación automática**, no la decisión del usuario
- Las acciones no tienen "guardar global", cada acción guarda su estado directamente
- La simulación permanece activa y editable con datos reales de la propiedad seleccionada
- Si faltan datos críticos (ingresos, gastos operativos, valoración, compra), se muestra alerta y se desactivan acciones
- Los intereses futuros evitados requieren datos de amortización del préstamo (actualmente simplificado)

## Mantenimiento

Para actualizar tipos impositivos o configuración:

1. Modificar `DEFAULT_ANALYSIS_CONFIG` en `src/types/propertyAnalysis.ts`
2. O permitir configuración por usuario/inmueble
3. Actualizar tests si cambian los umbrales de decisión

---

**Versión**: 1.0  
**Última actualización**: Implementación inicial completa  
**Autor**: Sistema de análisis fiscal de inmuebles

## Integración de gastos centralizada (OPEX/CAPEX)

Desde esta versión, `Analisis.tsx` consume exclusivamente el servicio `src/services/propertyExpenses.ts` para el cálculo de gastos operativos.

Flujo:
1. `getAnnualOpexForProperty(propertyId)` obtiene OPEX anual normalizado.
2. El valor se transforma a mensual para el cálculo del bloque operacional.
3. `getExpenseDiagnosticsForProperty(propertyId)` muestra alertas de:
   - ausencia de gastos,
   - uso de fallback legacy.

Ruta de retirada legacy:
- Mantener fallback sólo durante migración.
- Completar reglas `opexRules` en todos los inmuebles.
- Desactivar fallback en una siguiente versión cuando no haya inmuebles legacy.
