# Auditoría profunda · 39 stores supervivientes V60

> Fecha: 2026-04-26
> DB_VERSION en momento de auditoría: 64
> Snapshot Jose: atlas-snapshot-20260426-10.json (DB v59, pre-cleanup)
> Branch: copilot/auditstores-39-survivors

---

## Resumen ejecutivo

- **Total stores auditados:** 39
- **MANTENER:** 33
  - accounts, aeatCarryForwards, arrastresIRPF, compromisosRecurrentes, contracts, documents, ejerciciosFiscalesCoord, entidadesAtribucion, escenarios, fondos_ahorro, gastosInmueble, importBatches, ingresos, inversiones, keyval, mejorasInmueble, movementLearningRules, movements, mueblesInmueble, objetivos, perdidasPatrimonialesAhorro, personalData, personalModuleConfig, prestamos, presupuestoLineas, presupuestos, properties, propertyDays, property_sales, proveedores, resultadosEjercicio, retos, snapshotsDeclaracion, treasuryEvents, valoraciones_historicas, vinculosAccesorio, viviendaHabitual
- **ELIMINAR:** 0
- **FUSIONAR:** 1
  - planesPensionInversion → inversiones (tipo='plan_pensiones')
- **RENOMBRAR:** 0
- **REFACTOR_USO:** 1
  - traspasosPlanes (debe referenciar ambos stores correctamente)

### Hallazgos críticos (top 10)

1. **planesPensionInversion vs inversiones (DUPLICACIÓN FUNCIONAL):** Ambos stores gestionan planes de pensiones. `planesPensionInversion` tiene 0 registros en producción mientras `inversiones` tiene 12 (incluyendo tipo='plan_pensiones'). Los planes de pensiones ya se escriben en `inversiones` con `tipo: 'plan_pensiones'`. **Recomendación: FUSIONAR planesPensionInversion → inversiones.**

2. **keyval contiene 14 registros de tipo `planpagos_*`:** En lugar de claves de configuración diversas (configFiscal, matchingConfig, kpiConfig_*, migration_*), el snapshot muestra 14 registros exclusivamente de planes de pago de préstamos. Esto sugiere que las configuraciones fiscales/matching ya migraron o nunca existieron en este perfil.

3. **movementLearningRules tiene 0 registros en producción:** El store está activo y es usado por `movementLearningService.ts`, pero no hay reglas aprendidas en el snapshot. El campo `history[]` está implementado (FIFO 50).

4. **ingresos no existe en snapshot v59:** El store fue creado en V61 como fusión de nominas/autonomos/pensiones/otrosIngresos. En producción actual (v64) ya contiene los datos migrados.

5. **escenarios tiene 0 registros en snapshot:** Singleton que debería tener id=1 con defaults del escenario libertad financiera. Posiblemente inicializado en upgrade V55+.

6. **ejerciciosFiscalesCoord tiene 5 registros:** Coordinador del ciclo fiscal con años 2020-2024 probablemente. Uso correcto.

7. **traspasosPlanes tiene 0 registros:** Store diseñado para traspasos N:N entre planes, pero sin uso en producción. Referencia tanto `planesPensionInversion` como `inversiones` para source/dest.

8. **viviendaHabitual tiene 0 registros:** Ficha de vivienda habitual del titular sin datos aún. Store reciente (V5.3).

9. **presupuestos y presupuestoLineas vacíos:** Sistema de presupuestos sin uso en producción actual.

10. **fondos_ahorro, objetivos, retos vacíos:** Módulo "Mi Plan v3" sin datos de usuario aún.

### Hallazgos menores

- **gastosInmueble (109 registros):** Más poblado que mejorasInmueble (4) y mueblesInmueble (5). Uso intensivo por importación AEAT.
- **valoraciones_historicas (180 registros):** Sistema de valoración mensual activo con registros de planes de pensiones históricos.
- **proveedores (11 registros):** Catálogo de proveedores con NIF. Absorbió operacionesProveedor en V62.
- **aeatCarryForwards (0):** Sin arrastres AEAT específicos en este perfil.
- **arrastresIRPF (0):** Sin arrastres IRPF unificados todavía.

---

## Análisis por store

---

## Store · accounts

### Ubicación
- File: src/services/db.ts:2407-2412
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `destination`, `bank`, `isActive`

### Registros en producción
- Count: 8
- Ejemplos:
  - `{id: 1, alias: 'Santander', iban: 'ES6100490052632210412715', bank: 'Banco Santander', destination: 'horizon'}`
  - `{id: 2, alias: 'ING', iban: 'ES7214650100991713720331', bank: 'Banco 1465', destination: 'horizon'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| cuentasService.ts:364 | createAccount | Alta | Crea cuenta + movimiento apertura |
| treasuryApiService.ts | importación | Media | Crea cuentas de importación |
| demoDataCleanupService.ts | cleanup | Baja | Elimina datos demo |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| treasuryOverviewService.ts | getOverview | Dashboard tesorería |
| treasurySyncService.ts | sync | Sincronización |
| accountBalanceService.ts | getBalance | Cálculo saldos |
| dashboardService.ts | getStats | Panel principal |
| navigationPerformanceService.ts | prefetch | Prefetch navegación |

### Propósito declarado vs uso real
- **Propósito documentado:** Cuentas bancarias · origen y destino de movimientos · saldos. Campo `balance` documentado como cache derivada.
- **Uso real detectado:** Store principal de cuentas bancarias. Usado extensivamente por tesorería. Campo `balance` efectivamente usado como cache.
- **Coincidencia:** COINCIDE
- **Justificación:** El uso real coincide exactamente con el propósito declarado.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de tesorería con uso extensivo y correcto.
- **Si requiere acción:** N/A

---

## Store · aeatCarryForwards

### Ubicación
- File: src/services/db.ts:2308-2313
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `propertyId`, `taxYear`, `expirationYear`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| fiscalSummaryService.ts:161-163 | saveCarryForward | Baja | Guarda arrastres AEAT |
| carryForwardService.ts:64-75 | put/add | Baja | CRUD arrastres |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalSummaryService.ts:158 | getAllFromIndex | Por propertyId |
| alertasFiscalesService.ts:62 | getAll | Para alertas |
| carryForwardService.ts:20,54 | query | Consultas generales |

### Propósito declarado vs uso real
- **Propósito documentado:** Arrastres específicos derivados de campos C_ARRn de casillas AEAT.
- **Uso real detectado:** Store para arrastres fiscales derivados de XML AEAT. Vacío en snapshot (usuario sin arrastres).
- **Coincidencia:** COINCIDE
- **Justificación:** El propósito coincide; vacío por falta de datos de entrada.

### Solapamientos
- ¿Solapa con otro store? Relación con `arrastresIRPF` - diferente granularidad. `aeatCarryForwards` es específico de casillas AEAT; `arrastresIRPF` es unificado.

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de arrastres específicos AEAT.
- **Si requiere acción:** N/A

---

## Store · arrastresIRPF

### Ubicación
- File: src/services/db.ts:2606-2614
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `ejercicioOrigen`, `tipo`, `estado`, `ejercicioCaducidad`, `inmuebleId`, `ejercicioOrigen-tipo`, `origen` (añadido V60)

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| arrastresFiscalesService.ts | CRUD | Media | Service principal |
| fiscalLifecycleService.ts:172 | gestión | Media | Ciclo fiscal |
| snapshotDeclaracionService.ts | snapshot | Baja | Snapshots |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| arrastresFiscalesService.ts | getAll/query | Consultas principales |
| fiscalLifecycleService.ts | getAllFromIndex | Por ejercicio origen |
| compensacionAhorroService.ts | compensación | Cálculos compensación |

### Propósito declarado vs uso real
- **Propósito documentado:** Arrastres unificados IRPF · pérdidas patrimoniales · gastos pendientes. Campo `origen: 'manual' | 'aeat' | 'calculado'`.
- **Uso real detectado:** Store unificado de arrastres IRPF. El índice `origen` fue añadido en V60 con backfill 'aeat'. Soporta discriminación por origen.
- **Coincidencia:** COINCIDE
- **Justificación:** Implementación correcta del propósito declarado.

### Solapamientos
- ¿Solapa con otro store? Complementario a `aeatCarryForwards`. Este es unificado, aquél es específico AEAT.

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental para gestión fiscal de arrastres con arquitectura correcta.
- **Si requiere acción:** N/A

---

## Store · compromisosRecurrentes

### Ubicación
- File: src/services/db.ts:2724-2737
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `ambito`, `personalDataId`, `inmuebleId`, `tipo`, `categoria`, `cuentaCargo`, `estado`, `fechaInicio`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío en snapshot v59, pero puede tener datos migrados de opexRules)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| compromisosRecurrentesService.ts | CRUD | Alta | Service principal |
| db.ts:2755-2848 | migración V5.3 | Una vez | opexRules → compromisos |
| db.ts:2859-2948 | migración V5.4 | Una vez | Cierre migración |
| propertySaleService.ts:908 | venta | Baja | Cancela compromisos en venta |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| compromisosRecurrentesService.ts | getAll | Service principal |
| propertyExpenses.ts:184 | getAllFromIndex | Por inmuebleId |
| opexService.ts:60 | getAllFromIndex | Gastos recurrentes |
| operacionFiscalService.ts:180 | getAllFromIndex | Operaciones fiscales |

### Propósito declarado vs uso real
- **Propósito documentado:** Plantillas de gastos recurrentes (genera treasuryEvents). Campo `ambito: 'inmueble' | 'personal'`.
- **Uso real detectado:** Store unificado de compromisos recurrentes con discriminador de ámbito. Migró de opexRules en V5.3/V5.4.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta con discriminador de ámbito.

### Solapamientos
- ¿Solapa con otro store? No (opexRules fue eliminado en V62).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store consolidado de compromisos recurrentes con arquitectura correcta.
- **Si requiere acción:** N/A

---

## Store · contracts

### Ubicación
- File: src/services/db.ts:2300-2303
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `propertyId`

### Registros en producción
- Count: 6
- Ejemplos:
  - `{inmuebleId: 1, modalidad: 'habitual', rentaMensual: 713, fechaInicio: '01/05/2023'}`
  - `{inmuebleId: 2, modalidad: 'habitual', rentaMensual: 330, fechaInicio: '01/01/2024'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| contractService.ts | CRUD | Media | Service principal |
| documentIngestionService.ts:334 | add | Baja | Desde documentos |
| declaracionDistributorService.ts:233 | distribución | Baja | Desde AEAT |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalSummaryService.ts:119 | getAll | Resumen fiscal |
| irpfCalculationService.ts:550 | getAll | Cálculo IRPF |
| treasuryOverviewService.ts:170 | getAll | Vista tesorería |
| propertyOccupancyService.ts:19 | getAllFromIndex | Ocupación |
| historicalCashflowCalculator.ts:121 | getAll | Cashflow |

### Propósito declarado vs uso real
- **Propósito documentado:** Contratos de alquiler. Campo `historicoRentas[]` añadido en sub-tarea 1.
- **Uso real detectado:** Store de contratos de alquiler vinculados a inmuebles. Uso extensivo en cálculos fiscales y tesorería.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto como fuente de verdad de contratos.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de gestión de contratos de alquiler.
- **Si requiere acción:** N/A

---

## Store · documents

### Ubicación
- File: src/services/db.ts:2292-2297
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `type`, `entityType` (metadata.entityType), `entityId` (metadata.entityId)

### Registros en producción
- Count: 1
- Ejemplos: (1 documento en snapshot)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| db.ts:3893-3896 | saveDocument | Media | CRUD documentos |
| emailIngestService.ts:243 | add | Media | Desde emails |
| declaracionDistributorService.ts:444 | put | Baja | Actualización |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalSummaryService.ts:222 | getAll | Resumen fiscal |
| fiscalResolverService.ts:314 | getAll | Resolución fiscal |
| fiscalHistoryService.ts:30,132 | getAll | Histórico fiscal |

### Propósito declarado vs uso real
- **Propósito documentado:** Documentos adjuntos (escrituras · contratos · facturas · XMLs). Campo `metadata.tipo: 'fiscal' | 'contrato' | 'bancario' | 'otro'`.
- **Uso real detectado:** Store de documentos con metadata enriquecida. Absorbe documentosFiscales desde V63.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta con discriminador metadata.tipo.

### Solapamientos
- ¿Solapa con otro store? No (documentosFiscales eliminado en V63).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store unificado de documentos con arquitectura correcta.
- **Si requiere acción:** N/A

---

## Store · ejerciciosFiscalesCoord

### Ubicación
- File: src/services/db.ts:2639-2642
- keyPath: `año`
- autoIncrement: `false`
- Indexes: `estado`

### Registros en producción
- Count: 5
- Ejemplos: Años fiscales 2020-2024 (inferido por cantidad)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| ejercicioResolverService.ts:82 | put | Media | Crea/actualiza ejercicio |
| ejercicioResolverService.ts:323,384 | put | Media | Gestión ciclo |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| ejercicioResolverService.ts:52,91,321,328,337,412 | get/getAll | Múltiples consultas |
| accountMigrationService.ts:90 | getAll | Migración cuentas |
| backfillImporteBruto0106.ts:38 | getAll | Migración |

### Propósito declarado vs uso real
- **Propósito documentado:** Coordinador del ciclo de vida del año fiscal · estados · arrastres · workflow.
- **Uso real detectado:** Coordinador de ejercicios fiscales con keyPath='año'. Gestiona estados del ciclo fiscal.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto como coordinador del ciclo fiscal.

### Solapamientos
- ¿Solapa con otro store? No (ejerciciosFiscales legacy eliminado en V62).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental para coordinación del ciclo fiscal.
- **Si requiere acción:** N/A

---

## Store · entidadesAtribucion

### Ubicación
- File: src/services/db.ts:2631-2635
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `nif`, `tipoRenta`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| entidadAtribucionService.ts:14 | add | Baja | Crea entidad |
| entidadAtribucionService.ts:42,62 | put | Baja | Actualiza |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| entidadAtribucionService.ts:20 | getAll | Lista completa |
| entidadAtribucionService.ts:26 | getAllFromIndex | Por NIF |
| entidadAtribucionService.ts:35 | get | Por ID |

### Propósito declarado vs uso real
- **Propósito documentado:** CB · herencias · sociedades civiles · entidades en régimen de atribución de rentas.
- **Uso real detectado:** Store para entidades de atribución de rentas. Vacío en perfil de prueba.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto aunque sin datos en este perfil.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de entidades de atribución.
- **Si requiere acción:** N/A

---

## Store · escenarios

### Ubicación
- File: src/services/db.ts:2959-2960
- keyPath: `id`
- autoIncrement: `false`
- Indexes: Ninguno

### Registros en producción
- Count: 0 (en snapshot v59, pero debería tener singleton id=1 tras upgrade V55+)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| escenariosService.ts:68,81 | put | Baja | Actualiza singleton |
| db.ts:3021,3028,3033 | migración V55 | Una vez | Crea defaults |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| escenariosService.ts:40 | get | Obtiene singleton |

### Propósito declarado vs uso real
- **Propósito documentado:** Singleton · escenario libertad financiera (modoVivienda · gastosVida · estrategia · hitos).
- **Uso real detectado:** Store singleton con id=1 conteniendo parámetros del escenario de libertad financiera.
- **Coincidencia:** COINCIDE
- **Justificación:** Singleton correctamente implementado.

### Solapamientos
- ¿Solapa con otro store? No (objetivos_financieros eliminado en V59).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store singleton necesario para Mi Plan v3.
- **Si requiere acción:** N/A

---

## Store · fondos_ahorro

### Ubicación
- File: src/services/db.ts:3058-3062
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `tipo`, `activo`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| fondosService.ts:97 | put | Baja | CRUD fondos |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fondosService.ts:39,105,115 | getAll/get | Consultas |
| objetivosService.ts:27 | get | Para vincular objetivos |

### Propósito declarado vs uso real
- **Propósito documentado:** Etiquetas de propósito sobre euros de tesorería · 6 tipos.
- **Uso real detectado:** Store de fondos de ahorro para Mi Plan v3. Sin uso en perfil de prueba.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, sin datos de usuario.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para Mi Plan v3.
- **Si requiere acción:** N/A

---

## Store · gastosInmueble

### Ubicación
- File: src/services/db.ts:2333-2349
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `casillaAEAT`, `origen`, `estado`, `origen-origenId`, `movimientoId`, `treasuryEventId`

### Registros en producción
- Count: 109
- Ejemplos:
  - `{inmuebleId: 1, ejercicio: 2024, concepto: 'Declaración AEAT 2024', categoria: 'intereses', casillaAEAT: '0105', importe: 1580.34, origen: 'xml_aeat'}`
  - `{inmuebleId: 1, ejercicio: 2024, categoria: 'reparacion', casillaAEAT: '0106', importe: 1789.67, origen: 'xml_aeat'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| gastosInmuebleService.ts:25-38 | upsert/add | Alta | CRUD principal |
| treasuryConfirmationService.ts:368 | confirmación | Media | Desde tesorería |
| aeatParserService.ts | importación | Alta | Desde XML AEAT |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| gastosInmuebleService.ts:54,59,64,69 | queries | Múltiples consultas |
| gananciaPatrimonialService.ts:55 | getAllFromIndex | Por inmueble |
| historicalTreasuryService.ts:260 | getAll | Histórico |
| treasuryOverviewService.ts:171 | getAll | Vista tesorería |

### Propósito declarado vs uso real
- **Propósito documentado:** Histórico fiscal DECLARADO de gastos por inmueble · fase final del ciclo de vida.
- **Uso real detectado:** Store principal de gastos por inmueble con origen trazable (xml_aeat, movimiento, etc). Muy usado.
- **Coincidencia:** COINCIDE
- **Justificación:** Store fundamental con uso intensivo y arquitectura correcta.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de gastos de inmuebles con uso intensivo.
- **Si requiere acción:** N/A

---

## Store · importBatches

### Ubicación
- File: src/services/db.ts:2426-2430
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `accountId`, `createdAt`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| treasuryApiService.ts:753 | add | Media | Registra importación |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| batchHashUtils.ts:56 | getAll | Para deduplicación |

### Propósito declarado vs uso real
- **Propósito documentado:** Trazabilidad de importaciones (XML AEAT · CSB43 bancos · manual).
- **Uso real detectado:** Registro de lotes de importación. Vacío en este perfil (sin importaciones bancarias externas).
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para trazabilidad de importaciones.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para trazabilidad de importaciones.
- **Si requiere acción:** N/A

---

## Store · ingresos

### Ubicación
- File: src/services/db.ts:2524-2529
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `personalDataId`, `tipo`, `fechaActualizacion`

### Registros en producción
- Count: NOT IN SNAPSHOT (post-v59)
- Nota: Store creado en V61. En snapshot v59 no existe; los datos estaban en nominas (1 registro), autonomos (0), pensiones (0), otrosIngresos (0).

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| treasuryCreationService.ts:78,123,229 | add | Alta | Crea ingresos |
| enhancedTreasuryCreationService.ts:276 | add | Alta | Versión enhanced |
| db.ts:3324-3426 | migración V63 | Una vez | Fusión desde stores legacy |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalSummaryService.ts:260 | getAll | Resumen fiscal |
| irpfCalculationService.ts:422 | getAllFromIndex | Por tipo='autonomo' |
| personalResumenService.ts:26-27 | transaction | Resumen personal |
| fiscalConciliationService.ts:387,447 | getAll/getAllFromIndex | Conciliación |

### Propósito declarado vs uso real
- **Propósito documentado:** TODOS los ingresos personales (nómina · autónomo · desempleo · pensión · otro). Discriminado por `tipo`.
- **Uso real detectado:** Store unificado creado en V61 que fusiona nominas/autonomos/pensiones/otrosIngresos. Discriminador `tipo`.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta con unión discriminada.

### Solapamientos
- ¿Solapa con otro store? No (stores legacy eliminados en V63).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store unificado de ingresos con arquitectura correcta.
- **Si requiere acción:** N/A

---

## Store · inversiones

### Ubicación
- File: src/services/db.ts:2554-2559
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `tipo`, `activo`, `entidad`

### Registros en producción
- Count: 12
- Ejemplos:
  - `{nombre: 'USDT (2024)', tipo: 'crypto', entidad: 'AEAT XML', valor_actual: 3060.13}`
  - `{nombre: 'Fondo A86436011 (2023)', tipo: 'fondo_inversion', entidad: 'A86436011', isin: 'A86436011'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| inversionesService.ts | CRUD | Media | Service principal |
| indexaCapitalImportService.ts:333,365 | importación | Baja | Indexa Capital |
| declaracionDistributorService.ts | distribución | Baja | Desde AEAT |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| valoracionesService.ts:287 | getAll | Valoraciones |
| inversionesService.ts:242,266 | getAll | Consultas |
| treasuryOverviewService.ts | getAll | Vista tesorería |
| dashboardService.ts | getCachedStoreRecords | Dashboard |

### Propósito declarado vs uso real
- **Propósito documentado:** Activos financieros NO inmobiliarios · acciones · fondos · crypto · crowdfunding · P2P.
- **Uso real detectado:** Store de inversiones con múltiples tipos. Incluye crypto, fondos de inversión. **También planes de pensiones con tipo='plan_pensiones'** (verificado en valoraciones_historicas).
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para activos financieros diversos.

### Solapamientos
- ¿Solapa con otro store? **SÍ - con planesPensionInversion** para planes de pensiones. Ver análisis deep-dive.

### Recomendación
- **Acción:** MANTENER (y absorber planesPensionInversion)
- **Justificación:** Store principal de inversiones. Los planes de pensiones ya usan este store.
- **Si requiere acción:** Fusionar planesPensionInversion → inversiones

---

## Store · keyval

### Ubicación
- File: src/services/db.ts:2564-2566
- keyPath: out-of-line (clave explícita)
- autoIncrement: `false`
- Indexes: Ninguno

### Registros en producción
- Count: 14
- Ejemplos: Todos son `planpagos_prestamo_*` (planes de pago de préstamos)

### Deep-dive: Clasificación de claves en snapshot

| Tipo de clave | Cantidad | Patrón |
|---------------|----------|--------|
| planpagos_* | 14 | `planpagos_prestamo_XXXX_YYYYYYY` |
| configFiscal | 0 | No presente en snapshot |
| matchingConfig | 0 | No presente (migrado o no usado) |
| kpiConfig_* | 0 | No presente |
| migration_* | 0 | Flags de migración completados se eliminan |

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| prestamosService.ts:631 | put planpagos | Alta | Planes de pago |
| propertySaleService.ts:1198,1292 | put | Baja | Gestión venta |
| loanSettlementService.ts:623,649 | put | Baja | Liquidación préstamos |
| budgetMatchingService.ts:75,97 | put matchingConfig | Baja | Config matching |
| proyeccionService.ts:113,212 | put | Baja | Proyecciones |
| dashboardService.ts:393 | put kpiConfig | Baja | Config KPIs |
| migrationService.ts:92 | put migration flag | Una vez | Flags migración |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| prestamosService.ts:507 | get planpagos | Por préstamo |
| propertySaleService.ts:390,626,881,1286 | get planpagos | Ventas |
| historicalCashflowCalculator.ts:66 | get planpagos | Cashflow |
| budgetMatchingService.ts:62 | get matchingConfig | Config |
| transferDetectionService.ts:147,342 | get matchingConfig | Detección transferencias |
| dashboardService.ts:356 | get kpiConfig | Dashboard |

### Propósito declarado vs uso real
- **Propósito documentado:** Key-value para configuraciones singleton (configFiscal · matchingConfig · kpiConfig_*).
- **Uso real detectado:** Store key-value genérico usado principalmente para:
  1. **planpagos_*:** Planes de pago de préstamos (14 registros en prod)
  2. **matchingConfig:** Configuración de matching (migrado de matchingConfiguration)
  3. **kpiConfig_*:** Configuración de KPIs del dashboard
  4. **migration_*:** Flags de migración (temporales)
  5. **Proyecciones:** Datos de proyección
- **Coincidencia:** DESVIACIÓN_LEVE
- **Justificación:** El uso va más allá de "configuraciones singleton". Se usa intensivamente para planes de pago de préstamos. Funcionalmente correcto pero el propósito declarado es incompleto.

### Solapamientos
- ¿Solapa con otro store? No (matchingConfiguration eliminado en V63).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store genérico key-value con uso correcto. Actualizar documentación de propósito.
- **Si requiere acción:** Documentar que también almacena planpagos_* y datos de proyección.

---

## Store · mejorasInmueble

### Ubicación
- File: src/services/db.ts:2352-2363
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `movimientoId`, `treasuryEventId`

### Registros en producción
- Count: 4
- Ejemplos:
  - `{inmuebleId: 4, ejercicio: 2024, tipo: 'mejora', importe: 3545.3, descripcion: 'Mejora declarada IRPF 2024', proveedorNIF: '10521540Y'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| mejorasInmuebleService.ts:12 | add | Baja | Crea mejora |
| mejorasInmuebleService.ts:18 | updateLineaInmueble | Baja | Actualiza |
| treasuryConfirmationService.ts | confirmación | Baja | Desde tesorería |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| mejorasInmuebleService.ts:27,33 | getAllFromIndex | Por inmueble/ejercicio |
| treasuryOverviewService.ts:174 | getAll | Vista tesorería |
| navigationPerformanceService.ts:46 | prefetch | Prefetch |

### Propósito declarado vs uso real
- **Propósito documentado:** CAPEX amortizable · obras que aumentan valor inmueble · 3% anual durante 33+ años.
- **Uso real detectado:** Store de mejoras de inmuebles con amortización fiscal. Usado correctamente.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para CAPEX amortizable.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de mejoras.
- **Si requiere acción:** N/A

---

## Store · movementLearningRules

### Ubicación
- File: src/services/db.ts:2496-2503
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `learnKey` (unique), `categoria`, `ambito`, `createdAt`, `appliedCount`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío en snapshot)

### Deep-dive: Schema exacto

```typescript
interface MovementLearningRule {
  id?: number;                    // autoIncrement
  learnKey: string;               // Hash v1|signo|ngramA|ngramB|ngramC
  counterpartyPattern: string;    // Contraparte normalizada
  descriptionPattern: string;     // Descripción sin tokens volátiles
  amountSign: 'positive' | 'negative';
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  source: 'IMPLICIT' | 'EXPLICIT';
  createdAt: string;
  updatedAt: string;
  appliedCount: number;
  lastAppliedAt?: string;
  history?: HistoryEntry[];       // V60: FIFO max 50 entradas
}

interface HistoryEntry {
  action: 'CREATE_RULE' | 'APPLY_RULE' | 'UPDATE_RULE';
  movimientoId: number;
  ts: string;
}
```

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| movementLearningService.ts:144-179 | createLearningRule | Media | Crea/actualiza regla |
| movementLearningService.ts:205-234 | createOrUpdateRule | Media | Por learnKey |
| movementLearningService.ts:327,397 | put | Media | Actualiza appliedCount |
| db.ts:3599-3637 | migración V64 | Una vez | learningLogs → history[] |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| movementLearningService.ts:260 | getAllFromIndex | Por learnKey |
| movementLearningService.ts:348,536,575 | getAll | Lista completa |

### Trigger conditions
- **Creación de regla:** Cuando usuario reconcilia manualmente un movimiento con categoría + ámbito
- **Aplicación automática:** Cuando llega movimiento nuevo con learnKey coincidente
- **Actualización:** Cada aplicación incrementa appliedCount y añade HistoryEntry

### Campo history[]
- **Implementado:** SÍ (V60, con FIFO cap de 50 entradas)
- **Escrito:** La función `appendHistory()` en línea 5-9 de movementLearningService.ts lo implementa
- **Migración V64:** learningLogs se migró a history[] (db.ts:3599-3637)

### Propósito declarado vs uso real
- **Propósito documentado:** Reglas de auto-clasificación de movimientos bancarios. Campo `history[]` añadido en sub-tarea 1.
- **Uso real detectado:** Sistema de aprendizaje de clasificación de movimientos. Schema completo con history[] implementado.
- **Coincidencia:** COINCIDE
- **Justificación:** Implementación correcta del sistema de learning rules.

### Solapamientos
- ¿Solapa con otro store? No (learningLogs eliminado en V64, migrado a history[]).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para el sistema de aprendizaje automático.
- **Si requiere acción:** N/A

---

## Store · movements

### Ubicación
- File: src/services/db.ts:2415-2423
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `accountId`, `date`, `status`, `importBatch`, `duplicate-key` (compuesto)

### Registros en producción
- Count: 6
- Ejemplos:
  - `{accountId: 3, date: '2026-04-08', amount: 2755.73, description: 'Saldo inicial de apertura', status: 'conciliado'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| bankStatementImportService.ts:311 | add | Alta | Importación CSB43 |
| enhancedBankStatementImportService.ts:320 | add | Alta | Enhanced import |
| cuentasService.ts:364 | add | Baja | Apertura cuenta |
| movementLearningService.ts:310,463 | put | Media | Actualiza clasificación |
| budgetReclassificationService.ts:192 | put | Baja | Reclasificación |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| bankStatementImportService.ts:205 | getAll | Deduplicación |
| treasuryEventsService.ts:64 | getAll | Eventos |
| movementLearningService.ts:268,446 | getAll/get | Learning |
| enhancedDeduplicationService.ts:100,268,322 | getAll | Deduplicación |

### Propósito declarado vs uso real
- **Propósito documentado:** Movimientos bancarios reales (importados de extractos CSB43).
- **Uso real detectado:** Store de movimientos bancarios. Fuente de verdad de transacciones reales.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto como store de movimientos bancarios.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de tesorería.
- **Si requiere acción:** N/A

---

## Store · mueblesInmueble

### Ubicación
- File: src/services/db.ts:2366-2377
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `movimientoId`, `treasuryEventId`

### Registros en producción
- Count: 5
- Ejemplos:
  - `{inmuebleId: 1, ejercicio: 2024, descripcion: 'Mobiliario detectado IRPF 2024', importe: 16996.6, vidaUtil: 10, activo: true}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| mueblesInmuebleService.ts:14 | add | Baja | Crea mueble |
| mueblesInmuebleService.ts:20 | updateLineaInmueble | Baja | Actualiza |
| treasuryConfirmationService.ts | confirmación | Baja | Desde tesorería |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| mueblesInmuebleService.ts:29,35 | getAllFromIndex | Por inmueble/ejercicio |
| navigationPerformanceService.ts:46 | prefetch | Prefetch |

### Propósito declarado vs uso real
- **Propósito documentado:** Mobiliario amortizable al 10% anual · casilla AEAT 0117.
- **Uso real detectado:** Store de mobiliario amortizable de inmuebles. Casilla 0117 AEAT.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para mobiliario fiscal.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de mobiliario.
- **Si requiere acción:** N/A

---

## Store · objetivos

### Ubicación
- File: src/services/db.ts:3043-3049
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `tipo`, `estado`, `fondoId`, `prestamoId`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| objetivosService.ts:102 | put | Baja | Crea/actualiza |
| objetivosService.ts:148,169 | put/delete | Baja | CRUD |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| objetivosService.ts:110,120,137 | get/getAll | Consultas |
| objetivosService.ts:177,180,192 | getAllFromIndex | Por fondo/préstamo |

### Propósito declarado vs uso real
- **Propósito documentado:** Metas con fecha · 4 tipos (acumular · amortizar · comprar · reducir).
- **Uso real detectado:** Store de objetivos de Mi Plan v3 con 4 tipos. Sin uso en perfil de prueba.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, sin datos de usuario.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para Mi Plan v3.
- **Si requiere acción:** N/A

---

## Store · perdidasPatrimonialesAhorro

### Ubicación
- File: src/services/db.ts:2616-2621
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `ejercicioOrigen`, `estado`, `ejercicioCaducidad`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| fiscalLifecycleService.ts:204 | add | Baja | Crea pérdida |
| compensacionAhorroService.ts:268,278,291 | add/put | Baja | Gestión compensación |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| compensacionAhorroService.ts:97 | getAll | Lista completa |

### Propósito declarado vs uso real
- **Propósito documentado:** Pérdidas patrimoniales de la base ahorro · ventas con minusvalía · arrastrables 4 años.
- **Uso real detectado:** Store de pérdidas patrimoniales del ahorro para compensación fiscal.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para gestión de pérdidas compensables.

### Solapamientos
- ¿Solapa con otro store? Relacionado con arrastresIRPF (pérdidas van a arrastres cuando no se compensan).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de pérdidas.
- **Si requiere acción:** N/A

---

## Store · personalData

### Ubicación
- File: src/services/db.ts:2508-2512
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `dni` (unique), `fechaActualizacion`

### Registros en producción
- Count: 1
- Ejemplos:
  - `{id: 1, nombre: 'JOSE ANTONIO', apellidos: 'GOMEZ RAMIREZ', dni: '53069494F', situacionLaboral: ['asalariado', 'autonomo']}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| personalOnboardingService.ts:209 | add | Baja | Crea perfil |
| personalOnboardingService.ts:244 | put | Baja | Actualiza |
| personalDataService.ts:42 | transaction | Baja | CRUD |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| personalDataService.ts:25-26 | transaction | Consulta principal |
| personalOnboardingService.ts:307 | getAll | Lista perfiles |
| declaracionOnboardingService.ts:1387 | getAll | Onboarding |
| declaracionDistributorService.ts:1004 | getAll | Distribución |

### Propósito declarado vs uso real
- **Propósito documentado:** Datos del titular (singleton) · CCAA · tributación · descendientes · ascendientes.
- **Uso real detectado:** Singleton con datos del titular principal. Un registro por perfil de usuario.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto como store de datos personales.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de datos personales.
- **Si requiere acción:** N/A

---

## Store · personalModuleConfig

### Ubicación
- File: src/services/db.ts:2514-2517
- keyPath: `personalDataId`
- autoIncrement: `false`
- Indexes: `fechaActualizacion`

### Registros en producción
- Count: 1
- Ejemplos:
  - `{personalDataId: 1, seccionesActivas: {nomina: true, autonomo: true, pensionesInversiones: true}, integracionTesoreria: true}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| personalDataService.ts:89-90 | transaction | Baja | CRUD |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| personalDataService.ts:73-74 | transaction | Consulta |

### Propósito declarado vs uso real
- **Propósito documentado:** Configuración del módulo Personal · qué pestañas mostrar.
- **Uso real detectado:** Configuración de secciones activas del módulo Personal. Vinculado a personalDataId.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para configuración de UI del módulo.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para configuración de UI.
- **Si requiere acción:** N/A

---

## Store · planesPensionInversion

### Ubicación
- File: src/services/db.ts:2533-2540
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `personalDataId`, `tipo`, `titularidad`, `esHistorico`, `fechaActualizacion`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Deep-dive: planesPensionInversion vs inversiones

**Análisis de escritores:**

| Service | Store usado | Método |
|---------|-------------|--------|
| planesInversionService.ts | planesPensionInversion | getAll, put, add, delete |
| valoracionesService.ts | planesPensionInversion + inversiones | getAll ambos, put |
| traspasosPlanesService.ts | planesPensionInversion + inversiones | get, put |
| indexaCapitalImportService.ts | planesPensionInversion + inversiones | put |
| declaracionDistributorService.ts | planesPensionInversion | add, put |
| nominaAportacionHook.ts | planesPensionInversion | referencia |

**Evidencia en snapshot:**
- `planesPensionInversion`: 0 registros
- `inversiones`: 12 registros
- `valoraciones_historicas`: 180 registros con `tipo_activo: 'plan_pensiones'`

**Análisis de valoraciones_historicas:**
```
tipo_activo: 'plan_pensiones', activo_id: 9, activo_nombre: 'ORANGE ESPAGNE SA (BBVA)'
```

Esto indica que los planes de pensiones ya se gestionan en `inversiones` con tipo apropiado, y las valoraciones referencian `activo_id` que puede ser de cualquiera de los dos stores.

**Conclusión:** Existe duplicación funcional. `planesPensionInversion` fue diseñado para planes de pensiones pero `inversiones` también los soporta con `tipo: 'plan_pensiones'`. El código de valoraciones y traspasos referencia ambos stores.

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| planesInversionService.ts:52-53,80-81,110-111 | transaction | Baja | CRUD dedicado |
| valoracionesService.ts:217,219 | put | Baja | Actualiza valoración |
| declaracionDistributorService.ts:1060,1064 | put/add | Baja | Desde AEAT |
| db.ts:3750,3810,3814 | migración | Una vez | Consolidación planes |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| planesInversionService.ts:23,35-36 | getAll/transaction | Consultas |
| valoracionesService.ts:70,287 | getAll | Valoraciones |
| traspasosPlanesService.ts:86-87,131-132 | get | Traspasos |
| inversionesService.ts:266 | getAll | Lista conjunta |
| declaracionDistributorService.ts:1014 | getAll | Distribución |

### Propósito declarado vs uso real
- **Propósito documentado:** Planes de pensiones como ACTIVO FINANCIERO. Distinto de `ingresos.tipo='pension'` (cobro de pensión).
- **Uso real detectado:** Store dedicado de planes de pensiones, pero con 0 registros. Los planes están en `inversiones` en producción.
- **Coincidencia:** DESVIACIÓN_GRAVE
- **Justificación:** El store existe pero no se usa en producción. Los planes van a `inversiones`.

### Solapamientos
- ¿Solapa con otro store? **SÍ - DUPLICACIÓN con inversiones (tipo='plan_pensiones')**

### Recomendación
- **Acción:** FUSIONAR_EN_inversiones
- **Justificación:** Duplicación funcional. Los planes ya están en `inversiones` con tipo apropiado. `planesPensionInversion` tiene 0 registros.
- **Si requiere acción para TAREA 7-ter:**
  1. Migrar cualquier dato existente de planesPensionInversion → inversiones con tipo='plan_pensiones'
  2. Actualizar planesInversionService.ts para usar inversiones
  3. Actualizar traspasosPlanesService.ts para referenciar solo inversiones
  4. Eliminar store planesPensionInversion en siguiente versión DB

---

## Store · prestamos

### Ubicación
- File: src/services/db.ts:2569-2574
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `inmuebleId`, `tipo`, `createdAt`

### Registros en producción
- Count: 13
- Ejemplos:
  - `{id: 'prestamo_1776634761004_02rolmo0s', ambito: 'INMUEBLE', nombre: 'Fuertes Acevedo 32 1 2 Dr Oviedo', principalInicial: 52500}`
  - `{id: 'prestamo_1776634761030_pm3drkxtw', ambito: 'INMUEBLE', nombre: 'Tenderina 48 1 5 Dr Oviedo', principalInicial: 97300}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| prestamosService.ts | CRUD | Alta | Service principal |
| loanSettlementService.ts | liquidación | Baja | Cierre préstamos |
| propertySaleService.ts | venta | Baja | Actualiza en venta |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| prestamosService.ts | getAll/get | Consultas |
| historicalCashflowCalculator.ts:133 | getAll | Cashflow |
| reconciliacionService.ts:643 | getAll | Reconciliación |
| objetivosService.ts:41 | get | Vincular objetivos |

### Propósito declarado vs uso real
- **Propósito documentado:** Toda la deuda · hipotecas · préstamos personales · pólizas. Campo `liquidacion` añadido en sub-tarea 1.
- **Uso real detectado:** Store de préstamos/hipotecas con planes de pago en keyval. Campo liquidacion disponible.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para gestión de deuda.

### Solapamientos
- ¿Solapa con otro store? No (loan_settlements eliminado en V63, migrado a prestamos.liquidacion).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de financiación.
- **Si requiere acción:** N/A

---

## Store · presupuestoLineas

### Ubicación
- File: src/services/db.ts:2473-2484
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `presupuestoId`, `inmuebleId`, `tipo`, `categoria`, `frecuencia`, `origen`, `cuentaId`, `contratoId`, `prestamoId`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| presupuestoService.ts | CRUD | Baja | Service principal |
| budgetService.ts | gestión | Baja | Líneas de presupuesto |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| presupuestoService.ts | queries | Por presupuestoId |
| budgetService.ts | getAll | Lista |

### Propósito declarado vs uso real
- **Propósito documentado:** Líneas individuales de presupuesto · cardinalidad alta.
- **Uso real detectado:** Store de líneas de presupuesto. Sin uso en producción actual.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, funcionalidad no usada aún.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para sistema de presupuestos.
- **Si requiere acción:** N/A

---

## Store · presupuestos

### Ubicación
- File: src/services/db.ts:2466-2470
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `year`, `estado`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| presupuestoService.ts:43,50,59 | add/put | Baja | CRUD |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| presupuestoService.ts:16,25,73,109,136,390 | get/transaction | Múltiples |
| budgetMatchingService.ts:117 | getAll | Matching |

### Propósito declarado vs uso real
- **Propósito documentado:** Presupuestos personales · plan de gasto mensual o anual.
- **Uso real detectado:** Store de presupuestos. Sin uso en producción actual.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, funcionalidad no usada aún.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para sistema de presupuestos.
- **Si requiere acción:** N/A

---

## Store · properties

### Ubicación
- File: src/services/db.ts:2271-2275
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `alias`, `address`

### Registros en producción
- Count: 8
- Ejemplos:
  - `{alias: 'Fuertes Acevedo 32 1 2 Dr Oviedo', ccaa: 'Asturias', purchaseDate: '2022-09-26', cadastralReference: '7949807TP6074N0006YM'}`
  - `{alias: 'Carles Buigas 15 A 0 2 Sant Fruitos De Bage', ccaa: 'Cataluña', purchaseDate: '2005-10-26'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| inmuebleService.ts | CRUD | Alta | Service principal |
| declaracionOnboardingService.ts | onboarding | Baja | Desde AEAT |
| propertySaleService.ts | venta | Baja | Actualiza estado |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| Múltiples servicios | getAll | Uso extensivo |
| dashboardService.ts | getStats | Dashboard |
| fiscalSummaryService.ts | resumen | Resumen fiscal |
| treasuryOverviewService.ts | overview | Tesorería |

### Propósito declarado vs uso real
- **Propósito documentado:** Entidad central · cada inmueble con datos catastrales · fiscales · vinculaciones.
- **Uso real detectado:** Store central de inmuebles. Uso extensivo en toda la aplicación.
- **Coincidencia:** COINCIDE
- **Justificación:** Store fundamental con uso correcto.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de inmuebles.
- **Si requiere acción:** N/A

---

## Store · propertyDays

### Ubicación
- File: src/services/db.ts:2316-2321
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `propertyId`, `taxYear`, `property-year` (unique compuesto)

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| propertyOccupancyService.ts:34 | add | Baja | Crea registro |
| propertyOccupancyService.ts:64 | put | Baja | Actualiza |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| propertyOccupancyService.ts:10 | getAllFromIndex | Por property-year |
| irpfCalculationService.ts:602 | getAllFromIndex | Cálculo IRPF |
| aeatAmortizationService.ts:298 | getAllFromIndex | Amortización |

### Propósito declarado vs uso real
- **Propósito documentado:** Días fiscales por inmueble por año (alquilado · vacante · obras · disposición propietario).
- **Uso real detectado:** Store de días fiscales. Vacío (usuario no ha registrado días manualmente).
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, sin datos manuales.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para cálculos fiscales de ocupación.
- **Si requiere acción:** N/A

---

## Store · property_sales

### Ubicación
- File: src/services/db.ts:2277-2283
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `propertyId`, `saleDate`, `status`, `property-status` (compuesto)

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| propertySaleService.ts:831 | add | Baja | Registra venta |
| propertySaleService.ts:1024,1320 | put | Baja | Actualiza estado |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| propertySaleService.ts:1052 | getAllFromIndex | Por property-status |
| treasuryOverviewService.ts:173 | getAll | Vista tesorería |

### Propósito declarado vs uso real
- **Propósito documentado:** Ventas de inmuebles · plusvalía · gastos venta · cancelación hipoteca.
- **Uso real detectado:** Store de ventas de inmuebles. Sin ventas registradas en este perfil.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, sin ventas.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión de ventas.
- **Si requiere acción:** N/A

---

## Store · proveedores

### Ubicación
- File: src/services/db.ts:2326-2327
- keyPath: `nif`
- autoIncrement: `false`
- Indexes: Ninguno

### Registros en producción
- Count: 11
- Ejemplos: (11 proveedores con NIF único)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| declaracionDistributorService.ts:1538-1546 | put/add | Baja | Desde AEAT |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| declaracionDistributorService.ts:1538 | get | Verificar existencia |

### Propósito declarado vs uso real
- **Propósito documentado:** Catálogo de proveedores con NIF · tipos de servicio. Absorbió operacionesProveedor.
- **Uso real detectado:** Catálogo de proveedores con NIF como clave primaria. operacionesProveedor eliminado en V62.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto como catálogo de proveedores.

### Solapamientos
- ¿Solapa con otro store? No (operacionesProveedor eliminado en V62).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para catálogo de proveedores.
- **Si requiere acción:** N/A

---

## Store · resultadosEjercicio

### Ubicación
- File: src/services/db.ts:2597-2603
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `ejercicio`, `estadoEjercicio`, `origen`, `ejercicio-estado` (compuesto)

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| fiscalLifecycleService.ts:19 | RESULTADOS_STORE | Baja | Referencia constante |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalHistoryService.ts:119,129 | get/delete | Gestión histórico |

### Propósito declarado vs uso real
- **Propósito documentado:** Resumen vigente calculado del año (mutable · se actualiza tras paralelas).
- **Uso real detectado:** Store de resultados de ejercicio fiscal. Sin datos (no hay ciclos cerrados).
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, sin ciclos fiscales cerrados.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para ciclo fiscal.
- **Si requiere acción:** N/A

---

## Store · retos

### Ubicación
- File: src/services/db.ts:3071-3077
- keyPath: `id`
- autoIncrement: `false`
- Indexes: `mes` (unique), `estado`, `tipo`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| retosService.ts:68 | put | Baja | Crea/actualiza |
| retosService.ts:154,178 | put/delete | Baja | CRUD |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| retosService.ts:89,100,102,116,139,174 | get/getFromIndex/getAll | Múltiples |

### Propósito declarado vs uso real
- **Propósito documentado:** 1 reto activo por mes · 4 tipos (ahorro · ejecución · disciplina · revisión).
- **Uso real detectado:** Store de retos mensuales con índice mes único. Sin uso en producción.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta para Mi Plan v3.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para Mi Plan v3.
- **Si requiere acción:** N/A

---

## Store · snapshotsDeclaracion

### Ubicación
- File: src/services/db.ts:2624-2629
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `ejercicio` (no-unique), `origen`, `fechaSnapshot`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| snapshotDeclaracionService.ts:27 | STORE_NAME | Media | Service principal |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| fiscalResolverService.ts:342 | getAllFromIndex | Por ejercicio |
| fiscalHistoryService.ts:115 | delete | Limpieza |
| snapshotDeclaracionService.ts | get/put | Service principal |

### Propósito declarado vs uso real
- **Propósito documentado:** Foto inmutable del XML AEAT cuando se importó.
- **Uso real detectado:** Store de snapshots de declaraciones AEAT. Permite múltiples por ejercicio desde V2.8.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para inmutabilidad de importaciones AEAT.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para trazabilidad de importaciones AEAT.
- **Si requiere acción:** N/A

---

## Store · traspasosPlanes

### Ubicación
- File: src/services/db.ts:2543-2549
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `personalDataId`, `planOrigenId`, `planDestinoId`, `fecha`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| traspasosPlanesService.ts:356 | add | Baja | Crea traspaso |
| traspasosPlanesService.ts:419 | delete | Baja | Elimina |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| traspasosPlanesService.ts:374,388 | transaction/getAll | Consultas |
| traspasosPlanesService.ts:405 | get | Por ID |

### Propósito declarado vs uso real
- **Propósito documentado:** Evento N:N entre planes de pensiones · operación fiscalmente neutra.
- **Uso real detectado:** Store de traspasos entre planes. Referencia ambos stores (planesPensionInversion e inversiones) via `planOrigenStore`/`planDestinoStore`.
- **Coincidencia:** DESVIACIÓN_LEVE
- **Justificación:** La referencia dual a dos stores es problemática dado que planesPensionInversion debería fusionarse en inversiones.

### Solapamientos
- ¿Solapa con otro store? Depende de planesPensionInversion e inversiones.

### Recomendación
- **Acción:** REFACTOR_USO
- **Justificación:** Tras fusionar planesPensionInversion → inversiones, actualizar para que solo referencie inversiones.
- **Si requiere acción para TAREA 7-ter:**
  1. Tras fusionar planesPensionInversion → inversiones
  2. Actualizar `planOrigenStore`/`planDestinoStore` para que default sea 'inversiones'
  3. Migrar cualquier referencia existente a planesPensionInversion

---

## Store · treasuryEvents

### Ubicación
- File: src/services/db.ts:2433-2457
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `type`, `predictedDate`, `accountId`, `status`, `sourceType`, `sourceId`, `año`, `generadoPor`, `certeza`, `ambito`, `inmuebleId`

### Registros en producción
- Count: 13
- Ejemplos:
  - `{type: 'financing', amount: 252.53, predictedDate: '2026-04-28', description: 'Cuota 43 · Fuertes Acevedo', status: 'predicted', ambito: 'PERSONAL'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| treasuryEventsService.ts | CRUD | Alta | Service principal |
| treasuryCreationService.ts | creación | Alta | Genera eventos |
| enhancedTreasuryCreationService.ts | enhanced | Alta | Versión mejorada |
| compromisosRecurrentesService.ts | recurrentes | Media | Desde compromisos |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| treasuryEventsService.ts:64 | getAll | Lista completa |
| treasuryOverviewService.ts | vista | Dashboard |
| historicalTreasuryService.ts | histórico | Análisis |
| treasuryForecastService.ts | forecast | Proyección |

### Propósito declarado vs uso real
- **Propósito documentado:** Eventos previstos/confirmados de tesorería · fuente de verdad presente y futuro.
- **Uso real detectado:** Store central de eventos de tesorería con múltiples índices para consultas eficientes.
- **Coincidencia:** COINCIDE
- **Justificación:** Store fundamental con arquitectura robusta.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental de tesorería.
- **Si requiere acción:** N/A

---

## Store · valoraciones_historicas

### Ubicación
- File: src/services/db.ts:2577-2583
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `tipo_activo`, `activo_id`, `fecha_valoracion`, `tipo-activo-fecha` (compuesto)

### Registros en producción
- Count: 180
- Ejemplos:
  - `{tipo_activo: 'plan_pensiones', activo_id: 9, activo_nombre: 'ORANGE ESPAGNE SA (BBVA)', fecha_valoracion: '2016-08', valor: 223}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| valoracionesService.ts:141,186,207,209 | transaction/put/add | Alta | CRUD principal |
| valoracionesService.ts:342,362,364 | put/add | Media | Importación |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| valoracionesService.ts:94,108,120 | getAll | Consultas |
| inversionesService.ts:242 | getAll | Para limpieza |
| informesDataService.ts:494 | getAll | Informes |
| dashboardService.ts:565 | getCachedStoreRecords | Dashboard |
| proyeccionMensualService.ts:861 | getAll | Proyección |

### Propósito declarado vs uso real
- **Propósito documentado:** Histórico de valoraciones de activos (inmuebles · inversiones · cuentas · planes).
- **Uso real detectado:** Store de valoraciones históricas mensuales. Muy usado (180 registros) para tracking de patrimonio.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto y extensivo.

### Solapamientos
- ¿Solapa con otro store? No (valoraciones_mensuales eliminado en V62 - este lo sustituye).

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store fundamental para histórico de valoraciones.
- **Si requiere acción:** N/A

---

## Store · vinculosAccesorio

### Ubicación
- File: src/services/db.ts:2645-2650
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `inmueblePrincipalId`, `inmuebleAccesorioId`, `principal-accesorio-ejercicio` (unique compuesto)

### Registros en producción
- Count: 4
- Ejemplos:
  - `{inmueblePrincipalId: 4, inmuebleAccesorioId: 7, ejercicio: 2024, fechaInicio: '2024-01-01', estado: 'activo', origenCreacion: 'XML'}`

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| vinculacionFiscalService.ts | CRUD | Baja | Gestión vínculos |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| vinculacionFiscalService.ts | getAll/getAllFromIndex | Consultas |
| irpfCalculationService.ts | cálculos | Cálculo IRPF |

### Propósito declarado vs uso real
- **Propósito documentado:** Vínculo TEMPORAL año-a-año entre piso y trastero/parking con RC propia.
- **Uso real detectado:** Store de vínculos entre inmueble principal y accesorio por ejercicio fiscal.
- **Coincidencia:** COINCIDE
- **Justificación:** Uso correcto para vinculación fiscal de accesorios.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión fiscal de accesorios.
- **Si requiere acción:** N/A

---

## Store · viviendaHabitual

### Ubicación
- File: src/services/db.ts:2739-2747
- keyPath: `id`
- autoIncrement: `true`
- Indexes: `personalDataId`, `activa`, `vigenciaDesde`

### Registros en producción
- Count: 0
- Ejemplos: N/A (store vacío)

### Escritores detectados
| File:Line | Función | Frecuencia | Notas |
|-----------|---------|------------|-------|
| viviendaHabitualService.ts:28 | STORE_VIVIENDA | Baja | Service principal |
| compromisosRecurrentesService.ts:31 | STORE_VIVIENDA | Baja | Para compromisos |

### Lectores detectados
| File:Line | Componente/Función | Notas |
|-----------|-------------------|-------|
| viviendaHabitualService.ts | getAll/get | Consultas |
| compromisosRecurrentesService.ts:173,186,199,208,217 | redirigirA | Redirección gastos |

### Propósito declarado vs uso real
- **Propósito documentado:** Vivienda habitual del titular · datos fiscales propios.
- **Uso real detectado:** Store de vivienda habitual (V5.3). Sin datos en perfil de prueba.
- **Coincidencia:** COINCIDE
- **Justificación:** Arquitectura correcta, store reciente sin uso.

### Solapamientos
- ¿Solapa con otro store? No

### Recomendación
- **Acción:** MANTENER
- **Justificación:** Store necesario para gestión de vivienda habitual.
- **Si requiere acción:** N/A

---

## Solapamientos detectados (resumen)

| Store A | Store B | Tipo dato solapado | Recomendación |
|---------|---------|-------------------|---------------|
| planesPensionInversion | inversiones | Planes de pensiones | FUSIONAR planesPensionInversion → inversiones |
| aeatCarryForwards | arrastresIRPF | Arrastres fiscales | MANTENER ambos (granularidad diferente) |

---

## Stores zombie

| Store | Registros producción | Conclusión |
|-------|---------------------|------------|
| planesPensionInversion | 0 | ZOMBIE FUNCIONAL - datos en inversiones |
| traspasosPlanes | 0 | VÁLIDO - funcionalidad disponible sin uso |
| viviendaHabitual | 0 | VÁLIDO - store reciente sin uso |
| escenarios | 0 en v59 | VÁLIDO - singleton creado en upgrade |
| fondos_ahorro | 0 | VÁLIDO - Mi Plan v3 sin uso |
| objetivos | 0 | VÁLIDO - Mi Plan v3 sin uso |
| retos | 0 | VÁLIDO - Mi Plan v3 sin uso |
| presupuestos | 0 | VÁLIDO - funcionalidad sin uso |
| presupuestoLineas | 0 | VÁLIDO - funcionalidad sin uso |
| movementLearningRules | 0 | VÁLIDO - learning system sin reglas aún |
| aeatCarryForwards | 0 | VÁLIDO - sin arrastres AEAT en perfil |
| arrastresIRPF | 0 | VÁLIDO - sin arrastres en perfil |
| entidadesAtribucion | 0 | VÁLIDO - sin entidades en perfil |
| propertyDays | 0 | VÁLIDO - días no registrados manualmente |
| property_sales | 0 | VÁLIDO - sin ventas |
| resultadosEjercicio | 0 | VÁLIDO - sin ciclos cerrados |
| snapshotsDeclaracion | 0 | VÁLIDO - sin snapshots guardados |
| importBatches | 0 | VÁLIDO - sin importaciones externas |
| perdidasPatrimonialesAhorro | 0 | VÁLIDO - sin pérdidas |
| compromisosRecurrentes | 0 | VÁLIDO - migración desde opexRules puede no haber corrido |

**Nota:** La mayoría de stores con 0 registros son VÁLIDOS - representan funcionalidad disponible sin datos de usuario o funcionalidad reciente. Solo `planesPensionInversion` es un ZOMBIE FUNCIONAL porque sus datos están en otro store.

---

## Acciones propuestas para TAREA 7-ter

### Acción 1: Fusionar planesPensionInversion → inversiones

**Prioridad:** Alta  
**Impacto:** Eliminación de duplicación funcional

**Pasos:**
1. Crear migración V65 que:
   - Copie todos los registros de `planesPensionInversion` a `inversiones` con `tipo: 'plan_pensiones'`
   - Actualice referencias en `valoraciones_historicas` si necesario
   - Actualice `traspasosPlanes` para que `planOrigenStore`/`planDestinoStore` default sea 'inversiones'
2. Actualizar `planesInversionService.ts` para usar `inversiones` con filtro `tipo='plan_pensiones'`
3. Actualizar `traspasosPlanesService.ts` para solo referenciar `inversiones`
4. Actualizar `valoracionesService.ts` para el matcheo de planes
5. En V66: Eliminar store `planesPensionInversion`

### Acción 2: Documentar propósito extendido de keyval

**Prioridad:** Baja  
**Impacto:** Claridad de documentación

**Pasos:**
1. Actualizar documentación para incluir:
   - `planpagos_*` - Planes de pago de préstamos
   - `projection_*` - Datos de proyección
   - `migration_*` - Flags de migración (temporales)

### Acción 3: Refactorizar traspasosPlanes tras fusión

**Prioridad:** Media (depende de Acción 1)  
**Impacto:** Consistencia de referencias

**Pasos:**
1. Actualizar campos `planOrigenStore`/`planDestinoStore` para default 'inversiones'
2. Eliminar soporte para 'planesPensionInversion' tras migración
3. Migrar registros existentes (si los hay tras V65)

---

## Apéndice: Resumen de counts en snapshot v59

| Store | Count | Estado |
|-------|-------|--------|
| accounts | 8 | ✓ Con datos |
| aeatCarryForwards | 0 | Vacío |
| arrastresIRPF | 0 | Vacío |
| compromisosRecurrentes | 0 | Vacío |
| contracts | 6 | ✓ Con datos |
| documents | 1 | ✓ Con datos |
| ejerciciosFiscalesCoord | 5 | ✓ Con datos |
| entidadesAtribucion | 0 | Vacío |
| escenarios | 0 | Vacío (singleton post-V55) |
| fondos_ahorro | 0 | Vacío |
| gastosInmueble | 109 | ✓ Con datos (intensivo) |
| importBatches | 0 | Vacío |
| ingresos | N/A | No existe en v59 |
| inversiones | 12 | ✓ Con datos |
| keyval | 14 | ✓ Con datos (planpagos) |
| mejorasInmueble | 4 | ✓ Con datos |
| movementLearningRules | 0 | Vacío |
| movements | 6 | ✓ Con datos |
| mueblesInmueble | 5 | ✓ Con datos |
| objetivos | 0 | Vacío |
| perdidasPatrimonialesAhorro | 0 | Vacío |
| personalData | 1 | ✓ Con datos (singleton) |
| personalModuleConfig | 1 | ✓ Con datos |
| planesPensionInversion | 0 | Vacío (ZOMBIE) |
| prestamos | 13 | ✓ Con datos |
| presupuestoLineas | 0 | Vacío |
| presupuestos | 0 | Vacío |
| properties | 8 | ✓ Con datos |
| propertyDays | 0 | Vacío |
| property_sales | 0 | Vacío |
| proveedores | 11 | ✓ Con datos |
| resultadosEjercicio | 0 | Vacío |
| retos | 0 | Vacío |
| snapshotsDeclaracion | 0 | Vacío |
| traspasosPlanes | 0 | Vacío |
| treasuryEvents | 13 | ✓ Con datos |
| valoraciones_historicas | 180 | ✓ Con datos (intensivo) |
| vinculosAccesorio | 4 | ✓ Con datos |
| viviendaHabitual | 0 | Vacío |

**Stores con datos:** 17 de 39 (44%)  
**Stores vacíos:** 22 de 39 (56%)  
**Store no en snapshot (post-v59):** 1 (ingresos)
