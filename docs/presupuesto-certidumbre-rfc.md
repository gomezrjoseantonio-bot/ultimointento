# RFC · Modelo de presupuesto orientado a certidumbre y proyección

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

---

## Principio clave de diseño
Separar explícitamente en el dato:
- **Plan** (intención presupuestaria),
- **Forecast** (mejor estimación actual),
- **Actual** (real observado/conciliado).

> Regla de oro: nunca sobrescribir “actual” con “forecast” ni “forecast” con “plan”; siempre versionar y reconciliar.

---

## Modelo de datos propuesto (target)

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

---

## Estados de certidumbre (vista cliente)
Cada importe mensual debe mostrarse con estado claro:
- **Estimado**: viene de regla/modelo, sin evidencia externa.
- **Previsto**: validado operativamente (hay evento esperado con fecha/cuenta).
- **Confirmado**: validado por usuario/operación (sin banco aún).
- **Real conciliado**: ya existe movimiento real enlazado.
- **Desviado**: real ≠ esperado (importe/fecha/cuenta fuera de tolerancia).

Esto permite un KPI clave: **% del mes en real conciliado vs previsto/estimado**.

---

## Métricas que dan certidumbre
1. **Confiabilidad del mes** = importe conciliado / importe forecast del mes.
2. **Error de forecast (MAPE)** por categoría y por inmueble.
3. **Tasa de partidas sin evidencia** (estimado sin expected).
4. **Desviación acumulada YTD** (actual vs forecast vs plan).
5. **Cobertura de proyección** (meses futuros con forecast no nulo y confianza alta).

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

---

## UX mínima recomendada
1. **Vista 3 columnas por mes**: Plan | Forecast | Actual.
2. **Badge de estado por celda**: estimado/previsto/confirmado/conciliado/desviado.
3. **Filtro “Solo incertidumbre”**: mostrar líneas no conciliadas o con baja confianza.
4. **Timeline por línea**: origen del importe + cambios + conciliaciones.
5. **Botón “Reforecast”**: recalcular solo meses futuros.

---

## Roadmap de implementación (sin ruptura)

### Fase 1 (rápida, alto impacto)
- Añadir `statusCertidumbre` y `sourceType/sourceRef` a líneas actuales.
- Guardar separación lógica de importes: `planAmountByMonth`, `forecastAmountByMonth`, `actualAmountByMonth`.
- Dashboard de certidumbre mensual.

### Fase 2
- Introducir tablas/eventos `expected` y `actual` + conciliación.
- Matching automático básico por fecha±X, importe±Y, cuenta y contraparte.

### Fase 3
- Escenarios múltiples + motor de confianza + aprendizaje de desvíos.
- Reforecast automatizado por categoría.

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
