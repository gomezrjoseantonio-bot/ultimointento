# ATLAS — Mapa de datos por fuente y disponibilidad temporal

## Leyenda
- ✅ Importable ese año
- ⚠️ Parcial o con limitaciones
- ❌ No importable / no existe en esa fuente
- 🔴 Bug conocido
- — No aplica

---

## Datos importables vía XML/PDF AEAT

| Concepto | Store destino | Vista que lo consume | Para qué sirve | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| NIF, nombre, fecha nacimiento, estado civil, CCAA | `personalData` | Supervisión Personal, cabecera global | Identidad del usuario | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| IBAN cuenta bancaria | `accounts` | Tesorería | Cuenta cobro/pago por defecto | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ingresos brutos trabajo, retenciones, SS | `ejerciciosFiscalesCoord` | Supervisión Personal histórica, Fiscal | Historial laboral, motor IRPF | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Plan de pensiones empleado + NIF empleador | `ejerciciosFiscalesCoord` | Módulo Fiscal | Reducción base imponible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Autónomo: facturación, retención, gastos, rendimiento neto, IAE | `ejerciciosFiscalesCoord` | Fiscal, Supervisión Personal | Rendimiento actividad económica | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: ref. catastral, dirección, valor catastral, % construcción | `properties` | Inmuebles — ficha, cartera | Bootstrap inmueble, base amortización | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: fecha adquisición, precio compra, gastos adquisición | `properties` | Inmuebles — ficha | Coste de adquisición, plusvalía futura | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: ingresos arrendamiento CON NIF inquilino | `contracts` | Inmuebles — cashflow histórico, proyección | Ingreso histórico declarado | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: ingresos arrendamiento SIN NIF (vacacional, corta estancia) | **ningún store** | — | **Se pierde — bug conocido** 🔴 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: intereses financiación (0105) | `gastosInmueble` xml_aeat | Inmuebles — cashflow histórico | Gasto deducible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: reparación/conservación (0106) | `gastosInmueble` xml_aeat | Inmuebles — cashflow histórico | Gasto deducible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: comunidad, IBI, seguros, suministros, gestión (0109-0115) | `gastosInmueble` xml_aeat | Inmuebles — cashflow histórico | Gastos deducibles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: amortización mobiliario (0117) | `gastosInmueble` + `mueblesInmueble` | Inmuebles — amortización | Gasto deducible mobiliario | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: mejoras del ejercicio con NIF proveedor | `mejorasInmueble` | Inmuebles — CAPEX histórico | Incrementa valor del activo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: mejoras anteriores acumuladas | `mejorasInmueble` ejercicio-1 | Inmuebles — CAPEX histórico | Reconstruye historial CAPEX previo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inmueble: intereses → préstamo detectado | `prestamos` pendiente_completar | Financiación | Crea préstamo incompleto para completar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Proveedores con NIF e importe | `proveedores` + `operacionesProveedor` | Pendiente de vista propia | Trazabilidad fiscal proveedores | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Vínculos accesorio (parking/trastero vinculado) | `vinculosAccesorio` | Inmuebles — amortización accesorio | Amortización proporcional | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Arrastres gastos pendientes (0105/0106 exceso) | `ejerciciosFiscalesCoord` arrastresOut/In | Módulo Fiscal | Límite deducción futura 4 años | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Pérdidas patrimoniales pendientes | `ejerciciosFiscalesCoord` arrastresOut/In | Módulo Fiscal | Compensación años futuros | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Resultado declaración, cuota íntegra, retenciones, bases | `ejerciciosFiscalesCoord` aeat.resumen | Fiscal — Mi IRPF, historial | Foto fiscal anual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Crypto, capital mobiliario (dividendos, intereses) | `ejerciciosFiscalesCoord` snapshot | Fiscal, Inversiones | Rendimientos del ahorro | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Datos que NUNCA son importables — solo entrada manual o wizard

| Concepto | Store destino | Vista que lo consume | Para qué sirve | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Desglose mensual de ingresos de alquiler | — | — | No existe en ninguna fuente externa | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Desglose mensual de gastos del inmueble | — | — | Solo totales anuales en AEAT | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Metros cuadrados, habitaciones, baños del inmueble | `properties` (wizard) | Inmuebles — ficha | Caracterización del activo | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Foto/descripción del inmueble | `properties` (manual) | Inmuebles — ficha | Identificación visual | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | manual |
| Condiciones detalladas del préstamo (capital, plazo, tipo) | `prestamos` (wizard) | Financiación — cuadro amortización | Proyección cuotas futuras | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Historial de cuotas pagadas del préstamo | `prestamos` | Financiación | Saldo vivo real | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Tesorería |
| Fianzas depositadas por inquilino | — | Alquileres — contratos | Control de fianzas | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Historial de cobros mensuales reales de alquiler | `movements` | Tesorería, Inmuebles | Confirmación ingreso real | ❌ | ❌ | ❌ | ❌ | ❌ | CSV | CSV |
| Gastos personales reales (alquiler Madrid, suministros) | `gastosPersonalesReal` | Supervisión Personal | Ahorro real mensual | ❌ | ❌ | ❌ | ❌ | ❌ | CSV | CSV |
| Patrón de gastos personales (estimado) | `patronGastosPersonales` | Supervisión Personal, Proyección | Estimación gasto de vida | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Nómina actual (parámetros, empresa, tramos) | `nominas` | Supervisión Personal, Proyección | Base proyección ingresos laborales | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Actividad autónoma actual (clientes, facturación esperada) | `autonomos` | Supervisión Personal, Proyección | Base proyección ingresos autónomos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Contratos de alquiler actuales (inquilino, importe, duración) | `contracts` | Alquileres, Proyección | Proyección ingresos futuros | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Incidencias, impagos, avisos de inquilinos | — | Alquileres | Gestión operativa | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | manual |
| Valoración actual del inmueble (precio mercado) | `valoraciones_historicas` | Inmuebles — patrimonio | Patrimonio neto real | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | manual |
| Inversiones financieras (fondos, acciones, crypto actuales) | `inversiones` | Inversiones, Proyección | Proyección rendimientos financieros | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Objetivos de libertad financiera (renta objetivo, fecha) | `objetivos_financieros` | Mi Plan | Motor de proyección de libertad financiera | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | wizard |
| Facturas individuales de proveedores | `documents` | Archivo documental | Respaldo documental ante inspección | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | manual/OCR |
| Gastos de CAPEX no declarados en AEAT (mejoras en curso) | `mejorasInmueble` | Inmuebles — CAPEX | Valor real del activo | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | manual |
