# Mapa origen → destino de datos IRPF (control de trazabilidad)

Objetivo: validar **campo a campo** que la declaración use los datos reales de la app, y que el **año en curso** se trate como previsión (budget) hasta su cierre.

| Dominio | Origen técnico (app) | Campo origen | Regla de transformación | Destino en declaración IRPF | Comprobación sugerida |
|---|---|---|---|---|---|
| Trabajo | `nominaService.getAllActiveNominas()` + `calculateSalary()` | `totalAnualBruto`, `totalAnualEspecie`, `distribucionMensual[].ssTotal`, `distribucionMensual[].irpfImporte`, `ppEmpleado` | Suma anual por nómina activa + límites PP legales (1.500/8.500/10.000) | `baseGeneral.rendimientosTrabajo.*` y `retenciones.trabajo` | Cruzar suma mensual vs total anual por pagador |
| Autónomo | IndexedDB `autonomos` (registro activo) | `fuentesIngreso[]`, `gastosRecurrentesActividad[]`, `cuotaAutonomos` | Anualización por meses + cálculo neto + M130 (20%) | `baseGeneral.rendimientosAutonomo.*` y `retenciones.autonomoM130` | Verificar meses imputados por fuente/gasto |
| Inmuebles (alquiler) | `properties` + `contracts` + `calculateFiscalSummary(propertyId, ejercicio)` | `rentaMensual`, boxes `0105/0106/0109/0112/0113/0114/0115/0117`, `annualDepreciation` | Días alquiler/vacío/obras + límite AEAT art. 23 (0105+0106 ≤ ingresos) + reducción habitual 60% | `baseGeneral.rendimientosInmuebles[]` | Revisar ratio días y prorrateo por inmueble |
| Inmuebles (imputación) | `properties.fiscalData.cadastralValue`, revisión catastral y días vacíos | `cadastralValue`, `catastro_revisado_post_1994` | Imputación 1,1% o 2% proporcional a días vacíos | `baseGeneral.imputacionRentas[]` | Confirmar porcentaje aplicado por inmueble |
| Arrastres inmuebles | `calculateCarryForwards(propertyId, ejercicio)` | `remainingAmount` por arrastre | Aplicación FIFO hasta límite de capacidad del ejercicio | `rendimientosInmuebles[].arrastresAplicados` | Auditoría de consumo de arrastres por año |
| Inversiones (RCM) | IndexedDB `inversiones` | `dividendos` (e intereses cuando aplique) | Retención estimada 19% sobre RCM | `baseAhorro.capitalMobiliario.*`, `retenciones.capitalMobiliario` | Cuadrar con extractos o certificados |
| Ganancias/pérdidas | `inversionesFiscalService` | `plusvalias`, `minusvalias`, pendientes | Compensación de pérdidas del ejercicio + pendientes (4 años) | `baseAhorro.gananciasYPerdidas.*` | Trazar compensaciones por ejercicio origen |
| Planes pensiones (individual) | `inversiones` tipo `plan_pensiones` | `total_aportado` | Límite combinado con PP de trabajo (máx. 10.000) | `reducciones.ppIndividual`, `reducciones.total` | Validar tope combinado trabajo+individual |
| Mínimos personales | `personalDataService.getPersonalData()` | `descendientes`, `ascendientes`, `discapacidad` | Cálculo mínimos legales por edad/situación familiar | `minimoPersonal.*` | Verificar edades y convivencia |
| Conciliación real/estimado | `conciliarEjercicioFiscal(ejercicio)` | `lineas[].real`, `lineas[].estimado` | Sustituye estimado por real cuando exista (nómina e ingresos alquiler) | `declaracion.conciliacion` y campos ajustados | Informe de diferencias por categoría |
| Ejercicio en curso | Selector de ejercicio en UI | Año actual | Se marca como previsión de budget hasta cierre fiscal | Contexto de cálculo para toda la declaración | Etiqueta visual + comparación con años cerrados |

## Criterio operativo recomendado

1. **Año cerrado**: priorizar real conciliado, bloquear edición de importes calculados si hay fuente real.
2. **Año en curso**: permitir forecast (budget) y mostrar desviación vs dato real conforme entra conciliación.
3. **Trazabilidad visible**: mantener esta matriz en la pestaña de declaración para control funcional y QA.
