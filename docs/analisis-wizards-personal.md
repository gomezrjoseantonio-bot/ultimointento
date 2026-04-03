# Análisis Detallado de Wizards/Formularios del Módulo Personal

**Fecha:** 2026-04-03

## Componentes Analizados

| Componente | Líneas | UI Pattern | Store | Estado |
|------------|--------|------------|-------|--------|
| NominaForm | 1227 | Wizard 3 pasos (full-screen) | nominas | Funcional |
| AutonomoManager+Form | 558+405 | Page + Modal (AtlasModal) | autonomos | Funcional |
| PensionManager+Form | 273+281 | List + Modal (AtlasModal) | pensiones | Funcional |
| OtrosIngresosManager | 441 | List + Inline form | otrosIngresos | Funcional |
| GastosManager+Form | 306+213 | Cards + Drawer lateral | personalExpenses | Funcional |
| IngresosUnifiedManager | 431 | Hub + KPIs + List → detail | todos | Funcional |

## Gaps en UI

1. PersonalExpenseForm no expone meses_especificos, asymmetricPayments, ni estacionalidad
2. AutonomoManager no calcula M.130 trimestral ni IVA
3. Estilos heterogéneos entre componentes
4. productoDestinoId en PlanPensionesNomina sin UI
