# ATLAS — Mapa completo de 54 stores IndexedDB
## Estado real al 9 abril 2026

Leyenda:
- **Fuente XML** = el parser/distribuidor debería colocar datos aquí desde el XML
- **UI** = tiene vista activa en la app
- **Estado**: ✅ funciona · ⚠ parcial · ❌ no recibe datos · 🗑 candidato a eliminar/fusionar

---

## BLOQUE 1 — Datos del inmueble y alquileres

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 1 | `properties` | Ficha inmueble: ref catastral, dirección, valores, fecha/precio adq. | ✅ | ✅ Inmuebles | ✅ |
| 2 | `contracts` | Contratos alquiler: inquilino, fechas, importe, `ejerciciosFiscales[año]`, `sin_identificar` | ✅ | ✅ Alquileres | ✅ |
| 3 | `rentaMensual` | Previsión mensual de renta por contrato activo. Solo presente/futuro. Años declarados = confirmado auto | No | ✅ Dashboard, Alquileres | ⚠ BUG-07 |
| 4 | `gastosInmueble` | Gastos deducibles por inmueble/año: 0105-0115, 0117 | ✅ | ✅ Inmuebles cashflow | ✅ |
| 5 | `mejorasInmueble` | CAPEX/mejoras con NIF proveedor | ✅ | ✅ Inmuebles presupuesto | ✅ |
| 6 | `mueblesInmueble` | Mobiliario y equipamiento amortizable | ✅ | ✅ Inmuebles presupuesto | ✅ |
| 7 | `opexRules` | Patrones de gastos recurrentes (IBI, comunidad, luz...) | No | ✅ Inmuebles presupuesto | ✅ Solo plantillas |
| 8 | `propertyDays` | Días de uso/arrendamiento por inmueble | ? | ? | ? Verificar |
| 9 | `property_sales` | Ventas de inmuebles | ❌ GAP-P1 | ✅ Inmuebles | ❌ XML no lo persiste |
| 10 | `vinculosAccesorio` | Parking/trastero vinculado a inmueble principal | ✅ | ❌ Sin vista | ✅ Datos guardados |
| 11 | `proveedores` | Proveedores con NIF (Anexo D del XML) | ✅ | ❌ Sin vista | ✅ Datos guardados |
| 12 | `operacionesProveedor` | Operaciones por proveedor e inmueble | ✅ | ❌ Sin vista | ✅ Datos guardados |

---

## BLOQUE 2 — Ingresos personales y actividad

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 13 | `nominas` | Patrón nómina actual para proyección futura. Pasado = `declaracionCompleta.trabajo` | No (solo wizard) | ✅ Personal | ✅ Solo futuro |
| 14 | `autonomos` | Patrón autónomo actual para proyección futura. Pasado = `declaracionCompleta.actividadEconomica` | No (solo wizard) | ✅ Personal | ✅ Solo futuro |
| 15 | `otrosIngresos` | Otros ingresos wizard (alquiler Madrid, etc.) | No (solo wizard) | ✅ Personal | ✅ |
| 16 | `patronGastosPersonales` | Estimación mensual gasto de vida | No (wizard) | ✅ Personal | ✅ |
| 17 | `gastosPersonalesReal` | Gastos personales reales | No | ❌ Sin fuente activa | 🗑 Sin fuente |

---

## BLOQUE 3 — Inversiones y patrimonio financiero

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 18 | `inversiones` | Posiciones: fondos, crypto, P2P, acciones | ❌ GAP-P1/P3/D1 | ✅ Inversiones | ❌ XML no persiste fondos/crypto/capital mobiliario |
| 19 | `planesPensionInversion` | Planes de pensiones | ❌ GAP-D1 | ❌ Sin vista activa | ❌ XML pasa `{} as any` |
| 20 | `pensiones` | ? Posible legacy de planes pensiones | ? | ❌ | ? Verificar solapamiento con 19 |
| 21 | `loan_settlements` | Liquidaciones/cancelaciones de préstamos | No | ✅ Financiación | ✅ |
| 22 | `patrimonioSnapshots` | Fotos periódicas del patrimonio total | No | ? | ? Verificar |
| 23 | `valoraciones_historicas` | Valor mercado inmuebles (manual) | No | ✅ Inmuebles | ✅ |
| 24 | `valoraciones_mensuales` | Valoraciones mensuales | No | ? | 🗑 Fusionar con 23 |

---

## BLOQUE 4 — Financiación

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 25 | `prestamos` | Préstamos: condiciones + cuadro amortización. XML crea solo esqueleto | ⚠ GAP-D2 | ✅ Financiación | ⚠ Esqueleto sin datos reales |
| 26 | `accounts` | Cuentas bancarias (IBAN) | ✅ | ✅ Tesorería | ✅ |

---

## BLOQUE 5 — Fiscal

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 27 | `ejerciciosFiscalesCoord` | Fuente verdad fiscal: declaracionCompleta, snapshot, resumen, arrastres | ✅ | ✅ Impuestos | ⚠ GAP-D6 cuota=0 |
| 28 | `ejerciciosFiscales` | Store antiguo — lifecycle del ejercicio | ⚠ BUG-08 | ✅ | 🗑 Fusionar con 27 |
| 29 | `aeatCarryForwards` | Arrastres importados AEAT | ✅? | ❌ | 🗑 Fusionar arrastres |
| 30 | `arrastresIRPF` | Arrastres calculados por ATLAS | No | ❌ | 🗑 Fusionar arrastres |
| 31 | `arrastresManual` | Arrastres entrada manual | No | ❌ | 🗑 Fusionar arrastres |
| 32 | `perdidasPatrimonialesAhorro` | Pérdidas patrimoniales pendientes | ❌ GAP-P6 | ❌ | ❌ |
| 33 | `configuracion_fiscal` | Config fiscal del usuario | No | ? | ? Verificar |
| 34 | `resultadosEjercicio` | Resultados calculados por motor IRPF | No | ❌ | ? Verificar |
| 35 | `snapshotsDeclaracion` | Snapshots para comparativa | No | ❌ | ? Verificar |
| 36 | `entidadesAtribucion` | CB y entidades en atribución de rentas | ❌ GAP-P2 | ❌ Sin vista | ❌ No existe función extracción |
| 37 | `documentosFiscales` | Documentos fiscales archivados | ? | ❌ | ? Verificar |

---

## BLOQUE 6 — Tesorería y movimientos

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 38 | `treasuryEvents` | Previsiones año en curso/futuro + gastos personales estimados pasado | No | ✅ Tesorería | ⚠ Replantear: no intermediar datos históricos |
| 39 | `movements` | Movimientos bancarios reales | No | ❌ No hace nada hoy | ⚠ Futuro: CSV import |
| 40 | `treasuryRecommendations` | Recomendaciones generadas | No | ❌ Sin vista | 🗑 |
| 41 | `reconciliationAuditLogs` | Logs de conciliación | No | ❌ | ? Verificar |
| 42 | `matchingConfiguration` | Config matching tesorería | No | ❌ | ? Verificar |
| 43 | `movementLearningRules` | Reglas aprendidas de categorización | No | ❌ | ? Verificar |

---

## BLOQUE 7 — Personal y configuración

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 44 | `personalData` | NIF, nombre, fecha nac., estado civil, CCAA | ✅ | ✅ Personal | ⚠ GAP-D1 campos parciales |
| 45 | `personalModuleConfig` | Config módulo personal | No | ? | ? Verificar |
| 46 | `documents` | Archivo documental (PDFs, facturas) | ✅ | ✅ Documentación | ✅ |

---

## BLOQUE 8 — Proyección y planificación

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 47 | `presupuestos` | Presupuestos/escenarios de proyección | No | ✅ Previsiones | ✅ |
| 48 | `presupuestoLineas` | Líneas de detalle de presupuestos | No | ✅ Previsiones | ✅ |
| 49 | `objetivos_financieros` | Objetivos de libertad financiera | No | ✅ Mi Plan | ✅ |

---

## BLOQUE 9 — Sistema e infraestructura

| # | Store | Qué guarda | Fuente XML | UI activa | Estado |
|---|-------|-----------|:---:|:---:|---|
| 50 | `keyval` | Key-value genérico (config, flags) | No | No | ✅ |
| 51 | `kpiConfigurations` | Config KPIs | No | ❌ | 🗑 → keyval |
| 52 | `importBatches` | Lotes de importación | No | ❌ | ? Verificar |
| 53 | `importLogs` | Logs de importación | No | ❌ | ? Verificar |
| 54 | `learningLogs` | Logs de aprendizaje IA | No | ❌ | ? Verificar |

---

## RESUMEN DE GAPS — Datos XML que no llegan a su store

| GAP | Dato XML | Store destino | Impacto |
|-----|---------|---------------|---------|
| GAP-D1 | Plan pensiones, trabajo, capital mob., ganancias | `planesPensionInversion`, `inversiones`, etc. | `ejecutarOnboardingPersonal` pasa `{} as any` |
| GAP-D6 | Cuota líquida estatal/autonómica | `ejerciciosFiscalesCoord` resumen | KPI siempre 0 |
| GAP-P1 | Ventas inmuebles/acciones, fondos, crypto | `property_sales`, `inversiones` | `otrasTransmisiones: []` hardcoded |
| GAP-P2 | Entidades atribución (CB) | `entidadesAtribucion` | No existe función de extracción |
| GAP-P3 | Capital mobiliario | `inversiones` / `otrosIngresos` | Bug guardia nodo |
| GAP-P6 | Pérdidas base general, arrastres | `ejerciciosFiscalesCoord` | Solo extrae tipo 'ahorro' |
| GAP-D2 | Préstamos detectados | `prestamos` | Solo esqueleto sin datos reales |

## CANDIDATOS A FUSIONAR (sesión arquitectura futura)

| Stores actuales | Store unificado | Motivo |
|----------------|----------------|--------|
| `ejerciciosFiscales` + `ejerciciosFiscalesCoord` | `ejerciciosFiscalesCoord` | BUG-08, duplicidad |
| `arrastresManual` + `arrastresIRPF` + `aeatCarryForwards` | `ejerciciosFiscalesCoord.arrastres` | 3 stores para lo mismo |
| `valoraciones_historicas` + `valoraciones_mensuales` | `valoraciones` | Redundante |
| `pensiones` + `planesPensionInversion` | `planesPensionInversion` | Verificar solapamiento |

## CANDIDATOS A ELIMINAR

| Store | Motivo |
|-------|--------|
| `gastosPersonalesReal` | Sin fuente activa |
| `treasuryRecommendations` | Sin UI |
| `kpiConfigurations` | → `keyval` |
