# RFC · Modelo de presupuesto orientado a certidumbre y proyección

## Nota de validación empresarial
Esta RFC cubre correctamente la separación de datos (Plan/Forecast/Actual), pero **por sí sola no es suficiente** para operar como una empresa mediana/grande.

Una organización corporativa necesita además:
- gobierno del proceso (roles, aprobaciones, calendario),
- jerarquía de planificación (estratégico 5/10 años + presupuesto anual + forecast continuo),
- integración financiera completa (P&L, Balance y Cash Flow),
- y disciplina de performance (KPIs, variaciones, decisiones de corrección).

Este documento incorpora a continuación ese marco operativo para que el modelo sea realmente utilizable en contexto empresarial.

## Contexto del problema
Hoy el presupuesto mezcla en las mismas líneas:
- importes estimados (semilla automática),
- importes “esperados” pero no confirmados,
- importes realmente ocurridos (o que deberían ocurrir pero no aparecen).

Esto provoca tres problemas de negocio:
1. **No hay trazabilidad de confianza** por importe.
2. **No se distingue plan vs ejecución** de forma operativa.
3. **El cliente no sabe qué cifra es sólida** y cuál es una hipótesis.

## Objetivo
Diseñar un modelo que permita, al mismo tiempo:
- dar **certidumbre operativa** (qué está confirmado / conciliado),
- mantener **capacidad de proyección futura**,
- explicar de forma transparente de dónde sale cada número.

Además, habilitar:
- **planificación estratégica 5/10 años** (largo plazo),
- **presupuesto anual aprobado** (compromiso de gestión),
- **rolling forecast** mensual/trimestral (adaptación táctica sin romper baseline).

---

## Principio clave de diseño
Separar explícitamente en el dato:
- **Plan** (intención presupuestaria),
- **Forecast** (mejor estimación actual),
- **Actual** (real observado/conciliado).

> Regla de oro: nunca sobrescribir “actual” con “forecast” ni “forecast” con “plan”; siempre versionar y reconciliar.

> Regla corporativa adicional: nunca sobrescribir el **Budget Baseline aprobado**; las revisiones se registran como `Forecast vN` o `Reforecast`, manteniendo comparabilidad histórica.

---

## Marco empresarial recomendado (cómo sí funcionaría en una empresa)

## 1) Capa estratégica (5/10 años)
Objetivo: definir dirección de negocio y creación de valor.

Artefactos:
- hipótesis macro (inflación, tipos, crecimiento, coste de capital),
- palancas estratégicas (expansión, pricing, CAPEX, productividad),
- objetivos de largo plazo (ingresos, margen EBITDA, caja, deuda),
- escenarios (`Base`, `Upside`, `Downside`).

Salida:
- **Long Range Plan (LRP)** anualizado a 5/10 años.

## 2) Capa presupuestaria (anual)
Objetivo: convertir la estrategia en compromisos ejecutables por áreas.

Artefactos:
- presupuesto por centros de coste/beneficio,
- P&L presupuestada,
- Balance presupuestado,
- Cash Flow presupuestado,
- plan de CAPEX/OPEX y financiación.

Salida:
- **Budget Baseline** aprobado por dirección/comité.

## 3) Capa táctica (rolling forecast)
Objetivo: actualizar expectativa de cierre con información nueva sin alterar baseline.

Cadencia típica:
- mensual (empresas dinámicas) o trimestral (más estables).

Salida:
- `Forecast M+1`, `Forecast Q+1`, etc., comparables contra baseline y real.

---

## Modelo de datos propuesto (target)

Extensión corporativa recomendada:
- añadir `planning_layer` con valores: `LRP`, `BUDGET_BASELINE`, `FORECAST`, `ACTUAL`.
- añadir `org_unit_id`, `cost_center_id`, `business_unit_id` para responsabilidad organizativa.
- añadir `approval_state` (`draft`, `submitted`, `approved`, `rejected`) en entidades planificables.

## 1) `budget_line_template` (plantilla/base)
Define la partida estructural, no el hecho económico mensual.

Campos sugeridos:
- `id`
- `scope` (`PERSONAL` | `INMUEBLES`)
- `property_id` (nullable)
- `counterparty_id` (nullable)
- `category`, `subcategory`, `label`
- `nature` (`INGRESO` | `COSTE`)
- `default_distribution_rule` (mensual, anual, split, etc.)
- `source_type` (`contract`, `manual`, `historical_model`, `loan_schedule`, ...)
- `source_ref`
- `active`, `valid_from`, `valid_to`

Uso: representa el “molde” de cada línea.

## 2) `budget_scenario`
Versiona escenarios presupuestarios.

Campos sugeridos:
- `id`
- `year`
- `name` (ej. “Base 2026”, “Stress -10%”) 
- `status` (`draft`, `published`, `archived`)
- `created_at`, `published_at`

Uso: permite comparar escenarios sin romper histórico.

Campos corporativos adicionales sugeridos:
- `planning_layer` (`LRP` | `BUDGET_BASELINE` | `FORECAST`)
- `horizon_years` (1 para anual, 5/10 para estratégico)
- `owner_org_unit_id`
- `approval_state`
- `approved_by`, `approved_at`

## 3) `budget_projection_month`
Valor mensual proyectado por línea y escenario (PLAN/FORECAST).

Campos sugeridos:
- `id`
- `scenario_id`
- `template_id`
- `year_month` (YYYY-MM)
- `plan_amount`
- `forecast_amount`
- `confidence` (`alta`, `media`, `baja`) o score 0–1
- `assumption_note`
- `last_recomputed_at`

Uso: aquí vive la proyección editable.

Campos corporativos adicionales sugeridos:
- `kpi_driver` (ocupación, tarifa media, coste energético, etc.)
- `driver_value`
- `org_unit_id`, `cost_center_id`

## 4) `cash_event_expected`
Evento esperado operativo (lo que debería suceder en tesorería).

Campos sugeridos:
- `id`
- `template_id`
- `year_month`, `due_date`
- `expected_amount`
- `expected_account_id`
- `status` (`pendiente`, `confirmado_operativamente`, `cancelado`)
- `origin` (`contract`, `manual`, `projection_engine`)

Uso: puente entre presupuesto y tesorería.

## 5) `cash_event_actual`
Movimiento real observado (importado banco/manual).

Campos sugeridos:
- `id`
- `booking_date`, `value_date`
- `amount`, `account_id`
- `counterparty`, `concept`
- `external_ref` (id banco)
- `source` (`bank_import`, `manual`, ...)

Uso: fuente de verdad de ejecución.

## 6) `reconciliation_link`
Relaciona esperado vs real (1:1, 1:N o N:1).

Campos sugeridos:
- `id`
- `expected_event_id`
- `actual_event_id`
- `matched_amount`
- `match_type` (`auto`, `manual`)
- `match_confidence`
- `matched_by`, `matched_at`

Uso: evidencia de conciliación y auditoría.

## 7) `planning_cycle`
Define ventanas de planificación y governance del proceso.

Campos sugeridos:
- `id`
- `name` (ej. "Budget 2027", "LRP 2027-2031")
- `planning_layer`
- `start_date`, `end_date`
- `status` (`open`, `closed`)
- `calendar_template` (hitos y deadlines)

## 8) `approval_workflow_event`
Bitácora de decisiones de aprobación.

Campos sugeridos:
- `id`
- `entity_type`, `entity_id`
- `from_state`, `to_state`
- `actor_user_id`, `actor_role`
- `comment`
- `created_at`

---

## Estados de certidumbre (vista cliente)
Cada importe mensual debe mostrarse con estado claro:
- **Estimado**: viene de regla/modelo, sin evidencia externa.
- **Previsto**: validado operativamente (hay evento esperado con fecha/cuenta).
- **Confirmado**: validado por usuario/operación (sin banco aún).
- **Real conciliado**: ya existe movimiento real enlazado.
- **Desviado**: real ≠ esperado (importe/fecha/cuenta fuera de tolerancia).

Esto permite un KPI clave: **% del mes en real conciliado vs previsto/estimado**.

Para empresa, añadir dos ejes más en reporting:
- **Estado de aprobación** (borrador/en revisión/aprobado),
- **Capa de planificación** (LRP/Budget/Forecast/Actual).

---

## Métricas que dan certidumbre
1. **Confiabilidad del mes** = importe conciliado / importe forecast del mes.
2. **Error de forecast (MAPE)** por categoría y por inmueble.
3. **Tasa de partidas sin evidencia** (estimado sin expected).
4. **Desviación acumulada YTD** (actual vs forecast vs plan).
5. **Cobertura de proyección** (meses futuros con forecast no nulo y confianza alta).

Métricas corporativas adicionales:
6. **Variance vs Budget Baseline** (mensual, YTD, FY).
7. **Variance vs Prior Forecast** (calidad de reforecast).
8. **Bridge de variaciones** por driver (precio, volumen, mix, coste unitario).
9. **Cash conversion** y desviación de working capital.
10. **CAPEX execution** vs plan estratégico.

---

## Flujo operativo propuesto

## A) Generación
- Motor crea `budget_projection_month` desde contratos, préstamos, históricos y reglas.
- Cada valor nace con `confidence` y `source_type`.

## B) Operación mensual
- Se materializan `cash_event_expected` del mes.
- Usuario confirma/ajusta fechas, cuentas e importes esperados.

## C) Ejecución real
- Se importan `cash_event_actual` del banco.
- Motor de matching propone enlaces; usuario valida excepciones.

## D) Cierre
- Se calcula desvío y aprendizaje para forecast futuro.
- No se reescribe histórico; se recalcula forecast de meses futuros.

## E) Governance mensual
- reunión de performance (Finance + Negocio),
- revisión de desvíos materiales,
- decisión de acciones correctoras,
- publicación de forecast versionado.

---

## Reglas de negocio críticas
1. **Inmutabilidad de real**: `cash_event_actual` nunca se “edita” para cuadrar presupuesto.
2. **Forecast revisionable**: cambios generan `recomputed_at` y rastro de autor.
3. **Separación temporal**:
   - pasado: manda `actual`,
   - mes en curso: conviven expected + actual parcial,
   - futuro: manda `forecast`.
4. **Tolerancias de conciliación** configurables por categoría (p.ej. suministros ±15%).
5. **Escenarios comparables** siempre sobre mismas plantillas base.
6. **Baseline protegido**: presupuesto anual aprobado no se modifica, solo se compara.
7. **Segregación de funciones**: quien carga datos no es quien aprueba cierre/forecast final.
8. **Materialidad**: variaciones sobre umbral requieren comentario y owner.

---

## UX mínima recomendada
1. **Vista 3 columnas por mes**: Plan | Forecast | Actual.
2. **Badge de estado por celda**: estimado/previsto/confirmado/conciliado/desviado.
3. **Filtro “Solo incertidumbre”**: mostrar líneas no conciliadas o con baja confianza.
4. **Timeline por línea**: origen del importe + cambios + conciliaciones.
5. **Botón “Reforecast”**: recalcular solo meses futuros.

Complementos empresariales UX:
6. Panel de aprobación (pendientes por área/responsable).
7. Vista de variaciones (Actual vs Budget vs Forecast) con waterfall por drivers.
8. Modo comité (resumen ejecutivo + riesgos + acciones).

---

## Roadmap de implementación (sin ruptura)

### Fase 1 (rápida, alto impacto)
- Añadir `statusCertidumbre` y `sourceType/sourceRef` a líneas actuales.
- Guardar separación lógica de importes: `planAmountByMonth`, `forecastAmountByMonth`, `actualAmountByMonth`.
- Dashboard de certidumbre mensual.
- Introducir `planning_layer` y `approval_state` en modelo actual.

### Fase 2
- Introducir tablas/eventos `expected` y `actual` + conciliación.
- Matching automático básico por fecha±X, importe±Y, cuenta y contraparte.
- Añadir `planning_cycle` y workflow mínimo de aprobación.

### Fase 3
- Escenarios múltiples + motor de confianza + aprendizaje de desvíos.
- Reforecast automatizado por categoría.
- Integración completa P&L + Balance + Cash Flow y puente de variaciones por drivers.

### Fase 4 (enterprise ready)
- consolidación multi-entidad / multi-sociedad,
- seguridad por rol y unidad organizativa,
- auditoría completa y trazabilidad para compliance.

---

## Migración desde el estado actual
1. Mapear `amountByMonth` actual a:
   - `forecastAmountByMonth` por defecto.
2. Si existe movimiento bancario enlazable, poblar `actualAmountByMonth`.
3. Mantener semilla actual como `sourceType=manual/contract/template` según caso.
4. Marcar todas las líneas heredadas con certidumbre inicial `estimado` salvo evidencia.

---

## Resultado esperado para cliente
Con este modelo, el cliente verá claramente:
- qué ya pasó de verdad,
- qué está confirmado operativamente,
- qué es estimación,
- y cuánto puede confiar en su proyección futura.

Eso convierte el presupuesto en una herramienta de decisión, no solo en una tabla de importes.

En contexto empresarial, además permite:
- gestionar el año con un baseline claro,
- ejecutar con disciplina de seguimiento,
- y conectar el corto plazo con la estrategia 5/10 años.
