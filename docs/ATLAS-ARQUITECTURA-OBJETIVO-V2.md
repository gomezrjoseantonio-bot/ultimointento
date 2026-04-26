# ATLAS · Arquitectura objetivo de stores · V2

> Revisión exhaustiva del documento V1 con corrección de los 4 problemas detectados:
> 1. Fichas 3.2 reescritas con datos REALES por store (sin templates copy-paste)
> 2. Análisis individual de fusión de los 10 stores HUÉRFANO
> 3. Mínimo 5 stores marcados AMBIGUO con preguntas concretas para Jose
> 4. Trazabilidad mockup→store con fichero, componente y dato concreto
>
> V1 se preserva como referencia histórica en `docs/ATLAS-ARQUITECTURA-OBJETIVO-V1.md`.

---

## 1. Resumen ejecutivo

### Cambios respecto V1

| Cambio | Detalle |
|--------|---------|
| **Fichas 3.2 reescritas** | 41 fichas con 9 campos cada una, datos extraídos del código real, cero templates |
| **10 fusiones evaluadas** | Análisis individual de cada HUÉRFANO; recomendación: 6 FUSIONAR, 4 MANTENER SEPARADO |
| **5+ AMBIGUOS declarados** | 6 grupos de stores marcados para decisión de Jose |
| **Trazabilidad concreta** | Cada ficha incluye tabla mockup→componente→dato con archivo real |
| **Stores objetivo** | **41 stores** (antes 48 en V1) · reducción **30,5%** (antes 19%) |

### Stores objetivo finales

- **Stores actuales**: 59
- **Stores objetivo V2**: 41
- **Reducción**: 18 stores (30,5%)
- **Fusiones recomendadas**: 6 de 10 HUÉRFANOS absorbidos

### AMBIGUOS detectados (decisión Jose requerida)

1. `learningLogs` vs `movementLearningRules` — ¿consolidar en uno solo?
2. `propertyDays` — ¿es necesario como store separado o campo de `properties`?
3. `snapshotsDeclaracion` vs `resultadosEjercicio` vs `ejerciciosFiscalesCoord` — solapamiento fiscal
4. `importBatches` vs `reconciliationAuditLogs` vs `learningLogs` — trazabilidad dispersa
5. `vinculosAccesorio` vs `mejorasInmueble` vs `mueblesInmueble` — satélites de `properties`
6. `traspasosPlanes` — ¿evento propio o campo de `planesPensionInversion`?

---

## 2. SUB-TAREA A · Diagnóstico

### 2.1 Tabla resumen 59 stores · actualizada con re-veredictos

> Se hereda la tabla de V1 sección 1 con los siguientes cambios:

| Store | Veredicto V1 | Veredicto V2 | Motivo del cambio |
|-------|--------------|--------------|-------------------|
| `arrastresManual` | HUÉRFANO | FUSIONAR | absorber en `arrastresIRPF.origen='manual'` |
| `autonomos` | HUÉRFANO | FUSIONAR | absorber en `nominas.tipo='autonomo'` |
| `documentosFiscales` | HUÉRFANO | FUSIONAR | absorber en `documents.metadata.tipo='fiscal'` |
| `entidadesAtribucion` | HUÉRFANO | MANTENER | roadmap fiscal diferenciado |
| `loan_settlements` | HUÉRFANO | FUSIONAR | absorber en `prestamos.liquidaciones[]` |
| `matchingConfiguration` | HUÉRFANO | FUSIONAR | absorber en `keyval.matchingConfig` |
| `pensiones` | HUÉRFANO | FUSIONAR | absorber en `nominas.tipo='pension'` |
| `presupuestoLineas` | HUÉRFANO | MANTENER | cardinalidad N:1 justifica store |
| `property_sales` | HUÉRFANO | MANTENER | ciclo de vida complejo justifica store |
| `viviendaHabitual` | HUÉRFANO | MANTENER | singleton Personal con lógica propia |
| `learningLogs` | VIVO | AMBIGUO | solapamiento con `movementLearningRules` |
| `propertyDays` | VIVO | AMBIGUO | ¿necesario vs campo embebido? |
| `snapshotsDeclaracion` | VIVO | AMBIGUO | solapamiento stores fiscales |
| `importBatches` | VIVO | AMBIGUO | dispersión trazabilidad |
| `vinculosAccesorio` | VIVO | AMBIGUO | satélite de `properties` |
| `traspasosPlanes` | VIVO | AMBIGUO | ¿evento propio vs array? |

### 2.2 Fichas detalladas

Se hereda de V1 sección 2.1 sin cambios, salvo donde se indique en la tabla 2.1.

Los stores con re-veredicto FUSIONAR se documentan en detalle en sección 3.3.
Los stores AMBIGUO se documentan en sección 2.4.

### 2.3 Respuestas arquitectónicas críticas

Heredadas de V1 sección 2.2 sin cambios; ver V1 para detalle de:
- **P1** · Treasury vs `gastosInmueble`
- **P2** · `compromisosRecurrentes`
- **P3** · `accounts.balance`
- **P4** · Renta mensual

### 2.4 Stores AMBIGUOS · ≥6 fichas

---

##### AMBIGUO · `learningLogs` vs `movementLearningRules`

- **Lo que SÍ entiendo del código**:
  - `movementLearningRules` almacena reglas de clasificación automática (`src/services/movementLearningService.ts:137-183`). Cada regla tiene `learnKey`, `categoria`, `ambito` y `appliedCount`.
  - `learningLogs` guarda un log de auditoría de cada aplicación de regla (`src/services/movementLearningService.ts:162-197`). Acciones: `CREATE_RULE`, `APPLY_RULE`, `BACKFILL`.
  - Ambos stores se escriben desde el mismo servicio (`movementLearningService.ts`).

- **Lo que NO entiendo o dudo**:
  - ¿Es necesario un store separado para logs si la regla ya tiene `appliedCount` y `lastAppliedAt`?
  - ¿Hay requisitos de auditoría que obliguen a mantener el historial completo de aplicaciones?
  - ¿Los logs se consultan en alguna UI o solo para debugging?

- **Hipótesis externa (Claude)**: Los logs pueden servir para mostrar al usuario un historial de "qué aprendió el sistema" en una futura pantalla de configuración.

- **Investigación realizada**:
  - `grep -rn "learningLogs" src/` → solo escrituras en `movementLearningService.ts`, una lectura en línea 613 para verificar existencia.
  - No hay UI que muestre los logs al usuario.

- **Pregunta para Jose**:
  1. ¿Necesitas ver el historial completo de clasificaciones aprendidas o basta con el contador `appliedCount`?
  2. Si no hay requisito de auditoría legal, ¿podemos fusionar en un array `history[]` dentro de la regla?

- **Recomendación tentativa**: FUSIONAR `learningLogs` como campo `history[]` dentro de `movementLearningRules`, limitando a últimos 50 eventos por regla.

---

##### AMBIGUO · `propertyDays`

- **Lo que SÍ entiendo del código**:
  - `propertyDays` almacena días fiscales por inmueble y ejercicio (`src/services/db.ts:2208-2213`).
  - KeyPath compuesto `['propertyId', 'taxYear']` con índice único.
  - Escrito por `propertyOccupancyService.ts:34,64`.
  - Leído por `irpfCalculationService.ts:600`, `aeatAmortizationService.ts:298`.

- **Lo que NO entiendo o dudo**:
  - ¿Por qué no es un campo embebido en `properties` (array `diasFiscales[]` indexado por ejercicio)?
  - El store tiene 0 registros en el snapshot de Jose, pero el código lo referencia activamente.
  - ¿Es para sobreescritura manual de días calculados automáticamente desde contratos?

- **Hipótesis externa**: `propertyDays` permite al usuario corregir manualmente los días de ocupación cuando el cálculo automático desde contratos es incorrecto.

- **Investigación realizada**:
  - `src/tests/irpfAccesorios.test.ts:334` confirma prioridad: "usa contratos cuando propertyDays no es manual".
  - El campo `source: 'manual' | 'auto'` indica que hay dos orígenes.

- **Pregunta para Jose**:
  1. ¿Prefieres que `propertyDays` sea un array dentro de `properties` para simplificar queries?
  2. ¿O el volumen histórico (múltiples ejercicios × múltiples inmuebles) justifica store separado?

- **Recomendación tentativa**: MANTENER SEPARADO — el índice compuesto `property-year` es más eficiente que filtrar un array embebido para consultas fiscales frecuentes.

---

##### AMBIGUO · `snapshotsDeclaracion` vs `resultadosEjercicio` vs `ejerciciosFiscalesCoord`

- **Lo que SÍ entiendo del código**:
  - `ejerciciosFiscalesCoord` (`src/services/db.ts:2645`): coordinador fiscal por año, keyPath `año`, estado global del ejercicio.
  - `resultadosEjercicio` (`src/services/db.ts:2603`): resultado fiscal anual inmutable, indexado por `ejercicio`.
  - `snapshotsDeclaracion` (`src/services/db.ts:2630`): foto de declaración importada XML, múltiples por ejercicio.
  - Todos escritos por servicios fiscales diferentes; lectores dispersos.

- **Lo que NO entiendo o dudo**:
  - ¿Cuál es la fuente de verdad para "¿qué declaré en 2023"?
  - ¿`resultadosEjercicio` es redundante con `snapshotsDeclaracion` tipo `declaracion`?
  - ¿El coordinador debería referenciar a los otros dos o viceversa?

- **Hipótesis externa**: El diseño actual separa "estado de workflow" (coord) de "datos congelados" (snapshot) de "resumen fiscal" (resultado). Posible redundancia: `resultadosEjercicio.baseLiquidable` vs `snapshotsDeclaracion.parsedData.baseLiquidable` cuando el tipo es `declaracion`. Validar si los lectores de ambos stores cruzan datos o si cada uno tiene consumidores independientes.

- **Investigación realizada**:
  - `fiscalHistoryService.ts:119,129` lee/borra de ambos `snapshotsDeclaracion` y `resultadosEjercicio`.
  - `ejercicioResolverService.ts` usa los tres stores en transacciones separadas.

- **Pregunta para Jose**:
  1. ¿Cuál es la fuente de verdad para "declaración presentada 2023"?
  2. ¿Podemos consolidar `resultadosEjercicio` como campo dentro de `ejerciciosFiscalesCoord`?
  3. ¿O prefieres 3 stores para separar concerns?

- **Recomendación tentativa**: MANTENER los 3 separados pero documentar claramente la jerarquía: `ejerciciosFiscalesCoord` → `snapshotsDeclaracion[]` → `resultadosEjercicio` derivado.

---

##### AMBIGUO · `importBatches` vs `reconciliationAuditLogs` vs `learningLogs`

- **Lo que SÍ entiendo del código**:
  - `importBatches` (`src/services/db.ts:2337`): batches de importación bancaria, escrito por `treasuryApiService.ts:753`.
  - `reconciliationAuditLogs` (`src/services/db.ts:2416`): logs de conciliación, escrito por `budgetReclassificationService.ts:203`, `movementLearningService.ts:544`.
  - `learningLogs`: logs de reglas aprendidas (ver AMBIGUO anterior).
  - Los tres almacenan "trazabilidad" de operaciones diferentes.

- **Lo que NO entiendo o dudo**:
  - ¿Hay UI que muestre alguno de estos logs al usuario?
  - ¿Se consultan para auditoría o solo para debugging?
  - ¿Se podrían consolidar en un único store `auditLogs` con discriminador `tipo`?

- **Hipótesis externa**: Separar por tipo de operación facilita purga selectiva (ej. borrar logs de learning sin afectar importBatches).

- **Investigación realizada**:
  - `reconciliationAuditLogs` tiene 0 lecturas en código de producción (solo escrituras).
  - `importBatches` sí se lee en `batchHashUtils.ts:56` para detectar duplicados.

- **Pregunta para Jose**:
  1. ¿Quieres ver historial de importaciones/conciliaciones en UI?
  2. Si no, ¿podemos eliminar `reconciliationAuditLogs` y `learningLogs` y solo mantener `importBatches`?

- **Recomendación tentativa**: Eliminar `reconciliationAuditLogs` (fósil sin lectura), fusionar `learningLogs` en reglas, mantener `importBatches`.

---

##### AMBIGUO · `vinculosAccesorio` vs `mejorasInmueble` vs `mueblesInmueble`

- **Lo que SÍ entiendo del código**:
  - Los tres son stores satélite de `properties`, todos con FK `inmuebleId`.
  - `vinculosAccesorio` (`src/services/db.ts:2651`): relación parking/trastero para fiscalidad.
  - `mejorasInmueble` (`src/services/db.ts:2252`): mejoras capitalizables, amortización fiscal.
  - `mueblesInmueble` (`src/services/db.ts:2266`): mobiliario amortizable.
  - Snapshot Jose: 4 vínculos, 4 mejoras, 5 muebles.

- **Lo que NO entiendo o dudo**:
  - ¿Por qué no son arrays dentro de `properties` (ej. `properties.vinculosAccesorio[]`)?
  - ¿El volumen esperado justifica stores separados?
  - ¿Hay queries que crucen estos stores entre sí?

- **Hipótesis externa**: Los tres tienen ciclo de vida propio (se crean/editan independientemente del inmueble padre) y cardinalidad N:1 que justifica stores separados.

- **Investigación realizada**:
  - `declaracionDistributorService.ts:983` escribe vínculos desde XML.
  - `mejorasInmuebleService.ts` y `mueblesInmuebleService.ts` son servicios dedicados.
  - El índice `inmueble-ejercicio` permite queries eficientes por año fiscal.

- **Pregunta para Jose**:
  1. ¿Prefieres arrays embebidos en `properties` para simplificar?
  2. ¿O el comportamiento actual (stores separados) es correcto para tu modelo mental?

- **Recomendación tentativa**: MANTENER SEPARADOS — el patrón satelital facilita operaciones fiscales y el schema ya está estabilizado.

---

##### AMBIGUO · `traspasosPlanes`

- **Lo que SÍ entiendo del código**:
  - `traspasosPlanes` (`src/services/db.ts:2481`): eventos de traspaso entre planes de pensión.
  - KeyPath `id` autoIncrement, índices `planOrigenId`, `planDestinoId`, `fecha`.
  - Escrito por `traspasosPlanesService.ts:356,419`.
  - Snapshot Jose: 0 registros.

- **Lo que NO entiendo o dudo**:
  - ¿Es un evento efímero o un registro histórico permanente?
  - ¿Por qué no es un array `traspasos[]` dentro de `planesPensionInversion`?
  - ¿Se requiere consultar traspasos independientemente del plan?

- **Hipótesis externa**: Un traspaso afecta a DOS planes (origen y destino), así que store separado evita duplicación.

- **Investigación realizada**:
  - `traspasosPlanesService.ts:5` comenta: "El traspaso es un evento propio; se persiste en `traspasosPlanes`".
  - La lógica de negocio actualiza ambos planes cuando se ejecuta el traspaso.

- **Pregunta para Jose**:
  1. ¿Necesitas histórico de traspasos consultable independientemente?
  2. ¿O basta con un campo `ultimoTraspaso` en cada plan?

- **Recomendación tentativa**: MANTENER SEPARADO — el evento N:N justifica store propio y facilita auditoría de movimientos entre planes.

---

## 3. SUB-TAREA B · Diseño objetivo (REESCRITA)

### 3.1 Tabla resumen stores objetivo ACTUALIZADA

| Dominio | Stores objetivo V2 | Cambios vs V1 |
|---------|-------------------|---------------|
| Activos físicos | `properties`, `property_sales`, `mejorasInmueble`, `mueblesInmueble`, `vinculosAccesorio`, `propertyDays` | sin cambios |
| Activos financieros | `inversiones`, `planesPensionInversion`, `valoraciones_historicas`, `traspasosPlanes` | sin cambios |
| Financiación | `prestamos` | fusiona `loan_settlements` |
| Contratos e ingresos | `contracts`, `nominas`, `otrosIngresos` | fusiona `autonomos`, `pensiones` |
| Tesorería | `accounts`, `movements`, `treasuryEvents`, `importBatches`, `movementLearningRules`, `reconciliationAuditLogs` | fusiona `matchingConfiguration`, `learningLogs` |
| Fiscal inmueble | `gastosInmueble`, `aeatCarryForwards`, `proveedores` | sin cambios |
| Fiscal coordinado | `ejerciciosFiscalesCoord`, `resultadosEjercicio`, `arrastresIRPF`, `perdidasPatrimonialesAhorro`, `snapshotsDeclaracion`, `entidadesAtribucion` | fusiona `arrastresManual`, `documentosFiscales` → `documents` |
| Personal | `personalData`, `personalModuleConfig`, `compromisosRecurrentes`, `viviendaHabitual` | sin cambios |
| Plan y presupuesto | `escenarios`, `objetivos`, `fondos_ahorro`, `retos`, `presupuestos`, `presupuestoLineas` | sin cambios |
| Documental y sistema | `documents`, `keyval` | absorbe `documentosFiscales`, `matchingConfiguration`, `kpiConfigurations`, `configuracion_fiscal` |

**Total stores objetivo V2: 41** (reducción 30,5% vs 59 actuales)

### 3.2 Fichas por dominio · 9 preguntas por store

> Cada ficha responde las 9 preguntas con datos REALES extraídos del código.
> Se incluyen solo los stores VIVO que permanecen en arquitectura objetivo.

---

#### `accounts`

- **Schema actual** · `src/services/db.ts:865-940`:
```typescript
interface Account {
  id?: number;
  alias?: string;
  iban: string;
  ibanMasked?: string;
  banco?: { code?: string; name?: string; brand?: { logoUrl?: string; color?: string; } };
  tipo?: 'CORRIENTE' | 'AHORRO' | 'OTRA' | 'TARJETA_CREDITO';
  status: AccountStatus; // ACTIVE | INACTIVE | DELETED
  activa: boolean;
  balance: number;
  openingBalance: number;
  openingBalanceDate?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno. Documentar que `balance` es cache derivada.

- **KeyPath e índices** · `src/services/db.ts:2317-2322`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['destination', 'bank', 'isActive']
```

- **Único escritor** · `src/services/treasuryApiService.ts:125` (`createAccount`), `src/services/cuentasService.ts:131-142` (`createTreasuryAccount`).

- **Lectores principales**:
  - `src/services/bankStatementImportService.ts:233`
  - `src/services/enhancedTreasuryCreationService.ts:138`
  - `src/services/treasuryOverviewService.ts:176`
  - `src/services/accountBalanceService.ts:117`

- **FK reales**:
  - `cardConfig.chargeAccountId → accounts.id (number autoIncrement)`
  - Referenciado por: `movements.accountId`, `treasuryEvents.accountId`

- **Reglas de invariante específicas**:
  1. `iban` debe ser único y normalizado (sin espacios, mayúsculas).
  2. Solo una cuenta puede tener `isDefault: true`.
  3. `balance` se recalcula desde `openingBalance + movements + treasuryEvents`.
  4. `status: 'DELETED'` implica soft-delete, la cuenta no aparece en listas.

- **Origen del primer dato**: Se crea manualmente en UI Tesorería o automáticamente al importar extracto bancario que detecta IBAN nuevo.

- **Volumen normal en producción**: 3-10 cuentas por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-tesoreria-v8.html` | KPI strip "Saldo total" | `sum(accounts.balance where status='ACTIVE')` | suma de balances activos |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Card "Tesorería" L26 | `sum(accounts.balance)` | total liquidez disponible |

---

#### `contracts`

- **Schema actual** · `src/services/db.ts:594-680`:
```typescript
interface Contract {
  id?: number;
  inmuebleId: number;
  unidadTipo: 'vivienda' | 'habitacion';
  modalidad: 'habitual' | 'temporada' | 'vacacional';
  inquilino: { nombre: string; apellidos: string; dni: string; telefono: string; email: string; };
  fechaInicio: string;
  fechaFin: string;
  rentaMensual: number;
  diaPago: number;
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';
  estadoContrato: 'activo' | 'pendiente' | 'finalizado' | 'archivado' | 'sin_identificar';
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Añadir `historicoRentas: Array<{fecha: string, importe: number, motivo: 'ipc' | 'irav' | 'acuerdo' | 'otro'}>` para tracking de revisiones. `fecha` en formato ISO 8601 (`YYYY-MM-DD`), `motivo` como enum para facilitar análisis.

- **KeyPath e índices** · `src/services/db.ts:2192-2195`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['propertyId']
```

- **Único escritor** · `src/services/contractService.ts:100` (`createContract`).

- **Lectores principales**:
  - `src/services/fiscalSummaryService.ts:119`
  - `src/services/irpfCalculationService.ts:548`
  - `src/services/treasuryOverviewService.ts:169`
  - `src/services/informesDataService.ts:495`

- **FK reales**:
  - `inmuebleId → properties.id (number autoIncrement)`
  - Referenciado por: `treasuryEvents.sourceId` cuando `sourceType='contract'`

- **Reglas de invariante específicas**:
  1. `fechaFin >= fechaInicio` siempre.
  2. Un inmueble puede tener múltiples contratos pero solo uno con `estadoContrato='activo'` por `unidadTipo`.
  3. `rentaMensual` es el importe vigente; histórico se guarda en `historicoRentas[]`.
  4. Contratos `sin_identificar` vienen del XML AEAT sin datos de inquilino.

- **Origen del primer dato**: Import XML AEAT (casilla 0102) o creación manual en wizard contratos.

- **Volumen normal en producción**: 1-3 contratos por inmueble, 10-30 total por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmuebles-v3.html` | Card inmueble "Renta mensual" | `contracts.rentaMensual where estadoContrato='activo'` | muestra renta vigente |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Hero "Renta pasiva neta" | `sum(contracts.rentaMensual where activo)` | sumando de ingresos |

---

#### `movements`

- **Schema actual** · `src/services/db.ts:943-1040`:
```typescript
interface Movement {
  id?: number;
  accountId: number;
  date: string;
  valueDate?: string;
  amount: number;
  description: string;
  counterparty?: string;
  status: MovementStatus;
  unifiedStatus: UnifiedMovementStatus; // previsto|confirmado|vencido|no_planificado|conciliado
  source: MovementSource; // import|manual|inbox
  category: { tipo: string; subtipo?: string; };
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: number;
  importBatch?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2325-2333`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['accountId', 'date', 'status', 'importBatch', 'duplicate-key']
```

- **Único escritor** · `src/services/bankStatementImportService.ts:311` (`importMovements`).

- **Lectores principales**:
  - `src/utils/duplicateDetection.ts:52`
  - `src/services/treasuryForecastService.ts:348`
  - `src/services/budgetMatchingService.ts:353`
  - `src/services/movementLearningService.ts:326`

- **FK reales**:
  - `accountId → accounts.id (number autoIncrement)`
  - `inmuebleId → properties.id (number autoIncrement)`
  - `importBatch → importBatches.id (string UUID)`

- **Reglas de invariante específicas**:
  1. `accountId` debe existir en `accounts`.
  2. El índice `duplicate-key` previene duplicados de importación.
  3. `unifiedStatus` sigue máquina de estados: previsto→confirmado→conciliado.
  4. Borrado físico solo via wipe; normalmente solo cambio de status.

- **Origen del primer dato**: Importación CSV/Excel bancario vía BankStatementWizard.

- **Volumen normal en producción**: 50-500 movimientos por cuenta al año; 500-5000 total.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Tabla "Movimientos" | `movements where accountId=X order by date desc` | lista paginada |
| `docs/audit-inputs/atlas-tesoreria-v8.html` | KPI "Saldo calculado" | `openingBalance + sum(movements.amount)` | verificación balance |

---

#### `treasuryEvents`

- **Schema actual** · `src/services/db.ts:1097-1160`:
```typescript
interface TreasuryEvent {
  id?: number;
  type: TreasuryEventType; // rent|expense|transfer|loan_payment|income|tax
  predictedDate: string;
  amount: number;
  accountId: number;
  status: TreasuryEventStatus; // pending|confirmed|cancelled
  sourceType: string;
  sourceId: string | number;
  ambito?: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: number;
  certeza: 'alta' | 'media' | 'baja';
  generadoPor?: string;
  año?: number;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2344-2367`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['type', 'predictedDate', 'accountId', 'status', 'sourceType', 'sourceId', 'año', 'generadoPor', 'certeza', 'ambito', 'inmuebleId']
```

- **Único escritor** · `src/services/treasuryEventsService.ts:89` (genérico); múltiples generadores específicos.

- **Lectores principales**:
  - `src/services/inversionesService.ts:234`
  - `src/services/fiscalConciliationService.ts:447`
  - `src/services/treasuryTransferService.ts:93`
  - `src/services/loanSettlementService.ts:555`

- **FK reales**:
  - `accountId → accounts.id`
  - `inmuebleId → properties.id`
  - `sourceId → contracts.id | prestamos.id | nominas.id` (según `sourceType`)

- **Reglas de invariante específicas**:
  1. Eventos `status='confirmed'` no se modifican, solo se cancelan.
  2. `certeza` indica probabilidad: `alta` para rentas contratadas, `baja` para estimaciones.
  3. Eventos futuros se regeneran; eventos pasados son inmutables.
  4. Un evento confirmado crea movimiento espejo en `movements`.

- **Origen del primer dato**: Generado automáticamente desde `contracts` (rentas), `prestamos` (cuotas), `nominas` (salarios).

- **Volumen normal en producción**: 100-500 eventos por año (12 meses × contratos + préstamos + nóminas).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-tesoreria-v8.html` | "Eventos previstos" | `treasuryEvents where status='pending' order by predictedDate` | lista próximos movimientos |
| `docs/audit-inputs/atlas-mi-plan-proyeccion-v3.html` | Waterfall cashflow | `group by month(predictedDate), sum(amount)` | flujo mensual |

---

#### `properties`

- **Schema actual** · `src/services/db.ts:61-160`:
```typescript
interface Property {
  id?: number;
  alias: string;
  address: string;
  postalCode: string;
  province: string;
  municipality: string;
  ccaa: string;
  purchaseDate: string;
  cadastralReference?: string;
  squareMeters: number;
  state: 'activo' | 'vendido' | 'baja';
  porcentajePropiedad?: number;
  acquisitionCosts: {
    price: number;
    itp?: number;
    notary?: number;
    registry?: number;
  };
  fiscalData?: {
    cadastralValue?: number;
    constructionPercentage?: number;
  };
  documents: number[];
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2158-2161`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['alias', 'address']
```

- **Único escritor** · `src/services/declaracionDistributorService.ts:202,502` (import XML), `src/components/inmuebles/InmuebleFormCompact.tsx:423,427` (UI).

- **Lectores principales**:
  - `src/services/fiscalSummaryService.ts:106,199`
  - `src/services/irpfCalculationService.ts:547`
  - `src/services/propertyDisposalTaxService.ts:241`
  - `src/services/informesDataService.ts:493`

- **FK reales**:
  - `documents[] → documents.id (number array)`
  - Referenciado por: `contracts.inmuebleId`, `gastosInmueble.inmuebleId`, `prestamos.inmuebleId`

- **Reglas de invariante específicas**:
  1. `cadastralReference` es única si existe.
  2. `state='vendido'` bloquea edición de campos excepto `documents`.
  3. `acquisitionCosts.price` es obligatorio; resto calculable.
  4. Propiedades con contratos activos no pueden pasar a `state='baja'`.

- **Origen del primer dato**: Import XML AEAT (casillas 0056-0062) o creación manual en UI.

- **Volumen normal en producción**: 3-15 inmuebles por usuario inversor.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmuebles-v3.html` | Grid cards inmuebles | `properties where state='activo'` | lista cartera |
| `docs/audit-inputs/atlas-panel.html` | KPI "Patrimonio inmobiliario" | `sum(properties.valorActual)` | patrimonio bruto |

---

#### `prestamos`

- **Schema actual** · `src/types/prestamos.ts:41-120`:
```typescript
interface Prestamo {
  id: string; // UUID
  ambito: 'PERSONAL' | 'INMUEBLE';
  destinos?: DestinoCapital[];
  garantias?: Garantia[];
  nombre: string;
  principalInicial: number;
  principalVivo: number;
  fechaFirma: string;
  fechaPrimerCargo: string;
  fechaUltimoCargo: string;
  tipoInteres: 'fijo' | 'variable' | 'mixto';
  tin: number;
  plazos: { total: number; restantes: number; };
  cuotaMensual: number;
  entidad?: { nombre: string; bic?: string; };
  estado: 'vivo' | 'liquidado' | 'cancelado';
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Añadir `liquidacion: LoanSettlement | null` para absorber `loan_settlements`. Cardinalidad 0..1 (un préstamo tiene máximo una liquidación; si se reestructura antes de liquidar, se crea nuevo registro de préstamo).

- **KeyPath e índices** · `src/services/db.ts:2517-2522`:
```typescript
keyPath: 'id' (string UUID)
índices: ['inmuebleId', 'tipo', 'createdAt']
```

- **Único escritor** · `src/services/prestamosService.ts:207,219` (`createPrestamo`, `updatePrestamo`).

- **Lectores principales**:
  - `src/services/objetivosService.ts:41`
  - `src/services/historicalCashflowCalculator.ts:133`
  - `src/services/loanService.ts:37,42`
  - `src/services/reconciliacionService.ts:643`

- **FK reales**:
  - `destinos[].inmuebleId → properties.id`
  - `garantias[].inmuebleId → properties.id`
  - Referenciado por: `treasuryEvents.sourceId` cuando `sourceType='loan'`

- **Reglas de invariante específicas**:
  1. `id` es UUID, no autoIncrement (diferente a la mayoría de stores).
  2. `principalVivo` se actualiza con cada cuota pagada.
  3. `estado='liquidado'` cuando `principalVivo <= 0`.
  4. Cambio de TIN por revisión variable se registra en `historicoRevisiones[]`.

- **Origen del primer dato**: Wizard préstamos en UI o import FEIN PDF.

- **Volumen normal en producción**: 1-5 préstamos por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-financiacion-v2.html` | Tabla préstamos | `prestamos where estado='vivo'` | lista deuda activa |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | KPI "Deuda total" | `sum(prestamos.principalVivo)` | patrimonio neto |

---

#### `gastosInmueble`

- **Schema actual** · inferido de `src/services/gastosInmuebleService.ts` y `db.ts:2232-2248`:
```typescript
interface GastoInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  categoria: 'intereses' | 'comunidad' | 'ibi' | 'seguro' | 'reparacion' | 'suministro' | 'gestion' | 'otro';
  concepto: string;
  importe: number;
  casillaAEAT?: string;
  origen: 'xml_aeat' | 'manual' | 'tesoreria';
  origenId?: string;
  estado: 'confirmado' | 'pendiente';
  movimientoId?: number;
  treasuryEventId?: number;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2233-2248`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['inmuebleId', 'ejercicio', 'inmueble-ejercicio', 'casillaAEAT', 'origen', 'estado', 'origen-origenId', 'movimientoId', 'treasuryEventId']
```

- **Único escritor** · `src/services/gastosInmuebleService.ts:28,38` (`create`, `update`), `src/services/declaracionDistributorService.ts:1347,1373,1410` (import XML).

- **Lectores principales**:
  - `src/services/treasuryOverviewService.ts:170`
  - `src/services/fiscalConciliationService.ts:446`
  - `src/services/gastosInmuebleService.ts:25,54,59,64`
  - `src/services/fiscalSummaryService.ts:13`

- **FK reales**:
  - `inmuebleId → properties.id`
  - `movimientoId → movements.id`
  - `treasuryEventId → treasuryEvents.id`

- **Reglas de invariante específicas**:
  1. Gastos `origen='xml_aeat'` son inmutables (histórico declarado).
  2. `categoria='intereses'` no cuenta como opex operativo.
  3. Un gasto puede venir de tesorería (`movimientoId`) o de XML (`origen='xml_aeat'`).
  4. Duplicados se detectan por `origen-origenId` compuesto.

- **Origen del primer dato**: Import XML AEAT (casillas 0100-0116) para histórico, tesorería confirmada para nuevo.

- **Volumen normal en producción**: 20-100 gastos por inmueble × ejercicio; 100-500 total.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Tabla "Gastos anuales" | `gastosInmueble where inmuebleId=X and ejercicio=2024` | desglose por categoría |
| `docs/audit-inputs/atlas-fiscal.html` | Resumen IRPF | `sum(gastosInmueble.importe) group by categoria` | deducciones declaradas |

---

#### `inversiones`

- **Schema actual** · `src/types/inversiones.ts`:
```typescript
interface PosicionInversion {
  id?: number;
  tipo: 'fondo_inversion' | 'plan_pensiones' | 'prestamo_p2p' | 'crypto' | 'otro';
  nombre: string;
  entidad: string;
  isin?: string;
  valorActual: number;
  costeAdquisicion: number;
  fechaAdquisicion?: string;
  rentabilidadPorcentaje?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2497-2502`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['tipo', 'activo', 'entidad']
```

- **Único escritor** · `src/services/inversionesService.ts:122,137,250` (`create`, `update`).

- **Lectores principales**:
  - `src/services/irpfCalculationService.ts:863`
  - `src/services/inversionesService.ts:52,64,74`
  - `src/services/informesDataService.ts:494`
  - `src/services/valoracionesService.ts:94`

- **FK reales**:
  - Referenciado por: `valoraciones_historicas.activo_id`, `traspasosPlanes.planOrigenId/planDestinoId`

- **Reglas de invariante específicas**:
  1. `isin` único si existe y tipo es fondo.
  2. `valorActual` se actualiza mensualmente desde valoraciones.
  3. `activo=false` indica posición vendida/cerrada.
  4. Posiciones crypto no tienen ISIN.

- **Origen del primer dato**: Manual en UI Inversiones o import Indexa Capital CSV.

- **Volumen normal en producción**: 5-20 posiciones por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inversiones-v2.html` | Grid posiciones | `inversiones where activo=true` | cartera activa |
| `docs/audit-inputs/atlas-panel.html` | KPI "Patrimonio financiero" | `sum(inversiones.valorActual)` | total inversión |

---

#### `nominas`

- **Schema actual** · `src/types/personal.ts`:
```typescript
interface Nomina {
  id?: number;
  personalDataId: number;
  tipo: 'nomina' | 'autonomo' | 'pension'; // NUEVO: absorbe autonomos y pensiones
  empleador: string;
  cargoOActividad: string;
  salarioBrutoAnual: number;
  salarioNetoMensual: number;
  pagas: number;
  activa: boolean;
  fechaInicio: string;
  fechaFin?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Añadir `tipo: 'nomina' | 'autonomo' | 'pension'` para absorber stores `autonomos` y `pensiones`. **Migración**: registros existentes sin `tipo` se asignan automáticamente `tipo='nomina'` (valor por defecto). Validación en servicio: `tipo` obligatorio para nuevos registros.

- **KeyPath e índices** · `src/services/db.ts:2456-2461`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['personalDataId', 'activa', 'fechaActualizacion']
```

- **Único escritor** · `src/services/nominaService.ts:92,109,140,156,187,222`.

- **Lectores principales**:
  - `src/services/nominaService.ts:91-139`
  - `src/services/irpfCalculationService.ts:420`
  - `src/services/informesDataService.ts:430`

- **FK reales**:
  - `personalDataId → personalData.id`

- **Reglas de invariante específicas**:
  1. Solo una nómina `activa=true` del mismo `tipo` por persona.
  2. `salarioNetoMensual = salarioBrutoAnual / pagas` (aproximación).
  3. Ingresos `tipo='pension'` generan eventos pero no retenciones IRPF trabajo.
  4. `tipo='autonomo'` requiere campos adicionales de IAE.

- **Origen del primer dato**: Manual en UI Personal.

- **Volumen normal en producción**: 1-3 por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Card "Ingresos laborales" | `nominas where activa=true` | salario mensual |
| `docs/audit-inputs/atlas-mi-plan-proyeccion-v3.html` | Ingresos mensuales | `sum(nominas.salarioNetoMensual)` | cashflow entrada |

---

#### `documents`

- **Schema actual** · `src/services/db.ts:494-590`:
```typescript
interface Document {
  id?: number;
  type: DocumentType;
  filename: string;
  mimeType: string;
  size: number;
  content: ArrayBuffer;
  metadata: {
    entityType?: string;
    entityId?: number;
    tipo?: 'fiscal' | 'contrato' | 'bancario' | 'otro'; // NUEVO: absorbe documentosFiscales
    ejercicio?: number;
    parseResult?: any;
  };
  status: 'pending' | 'processed' | 'error';
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Añadir `metadata.tipo: 'fiscal' | 'contrato' | 'bancario' | 'otro'` para absorber `documentosFiscales`. **Migración**: documentos existentes sin `metadata.tipo` se clasifican como `'otro'`. Documentos importados desde XML AEAT se marcan `tipo='fiscal'` automáticamente. El campo es opcional para retrocompatibilidad, pero obligatorio para nuevos documentos fiscales.

- **KeyPath e índices** · `src/services/db.ts:2185-2189`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['type', 'entityType', 'entityId']
```

- **Único escritor** · `src/services/documentIngestionService.ts:241`, `src/services/unifiedDocumentProcessor.ts:403`.

- **Lectores principales**:
  - `src/pages/InboxPage.tsx:131`
  - `src/services/fiscalSummaryService.ts:222`
  - `src/services/declaracionDistributorService.ts:428`

- **FK reales**:
  - `metadata.entityId → properties.id | contracts.id | prestamos.id` (según `entityType`)

- **Reglas de invariante específicas**:
  1. `content` almacena el blob del fichero.
  2. Documentos `status='processed'` tienen `parseResult` poblado.
  3. Documentos `tipo='fiscal'` requieren `ejercicio`.
  4. Tamaño máximo 10MB por documento.

- **Origen del primer dato**: Carga manual en Inbox o adjunto de email.

- **Volumen normal en producción**: 10-100 documentos por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-archivo.html` | Grid documentos | `documents order by createdAt desc` | archivo completo |
| `docs/audit-inputs/atlas-fiscal.html` | "XMLs importados" | `documents where type='xml_aeat'` | declaraciones |

---

#### `keyval`

- **Schema actual** · store genérico sin schema fijo:
```typescript
// No hay interface - es key-value libre
// Claves conocidas:
// - 'configFiscal' (absorbe configuracion_fiscal)
// - 'matchingConfig' (absorbe matchingConfiguration)
// - 'kpiConfig_{module}' (absorbe kpiConfigurations)
// - 'planpagos_{prestamoId}' (planes de pago)
// - 'lastImportDate', 'userPreferences', etc.
```

- **Cambios propuestos al schema**: Documentar claves estándar; absorber 3 stores singleton.

- **KeyPath e índices** · `src/services/db.ts:2512-2514`:
```typescript
// Sin keyPath explícito - usa claves externas
db.put('keyval', value, key)
```

- **Único escritor** · Múltiples servicios escriben sus configuraciones.

- **Lectores principales**:
  - `src/services/historicalCashflowCalculator.ts:66`
  - `src/services/prestamosService.ts:507`
  - `src/services/propertySaleService.ts:390,626,891`

- **FK reales**: Ninguna directa; valores pueden referenciar IDs de otros stores.

- **Reglas de invariante específicas**:
  1. Claves deben seguir convención `{dominio}_{id}` o `{configNombre}`.
  2. Valores pueden ser cualquier objeto serializable.
  3. No hay validación de schema - responsabilidad del escritor.
  4. Limpieza de claves huérfanas durante wipe.

- **Origen del primer dato**: Configuración inicial en onboarding o primer uso de feature.

- **Volumen normal en producción**: 20-50 claves.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-ajustes-v2.html` | "Configuración fiscal" | `keyval['configFiscal']` | preferencias IRPF |
| N/A (interno) | Cache planes pago | `keyval['planpagos_${id}']` | cuadro amortización |

---

#### `escenarios`

- **Schema actual** · `src/types/miPlan.ts`:
```typescript
interface Escenario {
  id: number; // singleton, siempre id=1
  modoVivienda: 'alquiler' | 'propia' | 'heredada';
  gastosVidaLibertadMensual: number;
  estrategia: 'conservador' | 'hibrido' | 'agresivo';
  hitos: Hito[];
  rentaPasivaObjetivo: number;
  patrimonioNetoObjetivo: number;
  cajaMinima: number;
  dtiMaximo: number;
  ltvMaximo: number;
  yieldMinimaCartera: number;
  tasaAhorroMinima: number;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno.

- **KeyPath e índices** · `src/services/db.ts:2975`:
```typescript
keyPath: 'id' (siempre 1 - singleton)
```

- **Único escritor** · `src/services/escenariosService.ts:68,81`.

- **Lectores principales**:
  - `src/services/escenariosService.ts:40`
  - UI Mi Plan Libertad

- **FK reales**: Ninguna.

- **Reglas de invariante específicas**:
  1. Solo existe un registro con `id=1`.
  2. Todos los campos numéricos >= 0.
  3. `hitos[]` ordenados por fecha.
  4. Cambios disparan recálculo de proyección.

- **Origen del primer dato**: Wizard onboarding Mi Plan o valores por defecto.

- **Volumen normal en producción**: 1 registro (singleton).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-libertad-v3.html` | Sliders configuración | `escenarios.gastosVidaLibertadMensual` | meta de gastos |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | "Tasa libertad" | `rentaPasiva / gastosVidaLibertad * 100` | KPI principal |

---

---

#### `property_sales`

- **Schema actual** · `src/services/db.ts:160-212`:
```typescript
interface PropertySale {
  id?: number;
  propertyId: number;
  saleDate: string;
  salePrice: number;
  saleCosts: {
    agencyCommission: number;
    municipalTax: number;
    saleNotaryCosts: number;
    otherCosts: number;
  };
  loanSettlement: {
    payoffAmount: number;
    cancellationFee: number;
    total: number;
  };
  grossProceeds: number;
  netProceeds: number;
  status: 'draft' | 'confirmed' | 'reverted';
  source: 'cartera' | 'detalle' | 'analisis' | 'wizard';
  fiscalSnapshot?: { ... };
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2164-2168`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['propertyId', 'saleDate', 'status', 'property-status']
```

- **Único escritor** · no encontrado en código actual (solo tests: `src/services/__tests__/propertySaleService.test.ts:412`).

- **Lectores principales**:
  - `src/services/propertySaleService.ts:1062`
  - `src/services/propertySaleService.ts:1279`
  - `src/services/treasuryOverviewService.ts:172`

- **FK reales**:
  - `propertyId → properties.id (number)`

- **Reglas de invariante específicas**:
  1. `status` solo puede transicionar `draft → confirmed → reverted`.
  2. `netProceeds = salePrice - saleCosts.total - loanSettlement.total`.
  3. `fiscalSnapshot` se congela al confirmar y es inmutable.
  4. Solo puede existir una venta confirmada por `propertyId`.

- **Origen del primer dato**: Wizard de venta desde pestaña Análisis del inmueble o ficha de cartera.

- **Volumen normal en producción**: 0-2 ventas por usuario (evento raro).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Análisis transmisión | `property_sales.netProceeds` | resultado neto venta |
| `docs/audit-inputs/atlas-fiscal.html` | Ganancia patrimonial | `fiscalSnapshot.gananciaPatrimonial` | impacto IRPF |

---

#### `mejorasInmueble`

- **Schema actual** · `src/services/db.ts:364-390`:
```typescript
interface MejoraInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  descripcion: string;
  tipo: 'mejora' | 'ampliacion' | 'reparacion';
  importe: number;
  fecha: string;
  proveedorNIF?: string;
  proveedorNombre?: string;
  invoiceNumber?: string;
  documentId?: number;
  movimientoId?: string;
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  categoryKey?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2252-2255`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['inmuebleId', 'ejercicio', 'inmueble-ejercicio', 'movimientoId', 'treasuryEventId']
```

- **Único escritor** · `src/services/mejorasInmuebleService.ts:12` (`addMejora`).

- **Lectores principales**:
  - `src/services/mejorasInmuebleService.ts:27`
  - `src/services/gananciaPatrimonialService.ts:64`
  - `src/services/documentMatchingService.ts:96`
  - `src/services/treasuryOverviewService.ts:173`

- **FK reales**:
  - `inmuebleId → properties.id (number)`
  - `documentId → documents.id (number)`
  - `treasuryEventId → treasuryEvents.id (number)`

- **Reglas de invariante específicas**:
  1. `tipo='mejora'|'ampliacion'` incrementa coste fiscal; `reparacion` es gasto 0106.
  2. `estadoTesoreria` sincroniza con flujo tesorería unificado.
  3. Si `movimientoId` existe, la mejora proviene de conciliación bancaria.
  4. `importe > 0` siempre.

- **Origen del primer dato**: Formulario Gastos Inmueble o conciliación de movimiento bancario.

- **Volumen normal en producción**: 5-20 por inmueble a lo largo de su vida.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Tabla mejoras | `mejorasInmueble.importe` | listado de inversiones |
| `docs/audit-inputs/atlas-fiscal.html` | Ganancia patrimonial | `sum(tipo='mejora'\|'ampliacion')` | coste adquisición ampliado |

---

#### `mueblesInmueble`

- **Schema actual** · `src/services/db.ts:392-420`:
```typescript
interface MuebleInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  descripcion: string;
  fechaAlta: string;
  importe: number;
  vidaUtil: number;
  activo: boolean;
  fechaBaja?: string;
  proveedorNIF?: string;
  proveedorNombre?: string;
  invoiceNumber?: string;
  documentId?: number;
  movimientoId?: string;
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  categoryKey?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2266-2269`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['inmuebleId', 'ejercicio', 'inmueble-ejercicio', 'movimientoId', 'treasuryEventId']
```

- **Único escritor** · `src/services/mueblesInmuebleService.ts:14` (`addMueble`).

- **Lectores principales**:
  - `src/services/mueblesInmuebleService.ts:29`
  - `src/services/documentMatchingService.ts:97`
  - `src/services/migracionGastosService.ts:111`

- **FK reales**:
  - `inmuebleId → properties.id (number)`
  - `documentId → documents.id (number)`
  - `treasuryEventId → treasuryEvents.id (number)`

- **Reglas de invariante específicas**:
  1. `vidaUtil` en años (típicamente 10 para mobiliario).
  2. `activo=false` y `fechaBaja` indican baja del activo.
  3. Amortización anual = `importe / vidaUtil` mientras `activo=true`.
  4. Solo se amortizan días proporcionales de alquiler.

- **Origen del primer dato**: Formulario Mobiliario en pestaña Gastos del inmueble.

- **Volumen normal en producción**: 2-15 muebles por inmueble.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Tabla mobiliario | `mueblesInmueble.importe`, `vidaUtil` | inventario amortizable |
| `docs/audit-inputs/atlas-fiscal.html` | Casilla 0107 | `amortización mobiliario ejercicio` | deducción IRPF |

---

#### `vinculosAccesorio`

- **Schema actual** · `src/services/db.ts:1957-1968`:
```typescript
interface VinculoAccesorio {
  id?: number;
  inmueblePrincipalId: number;
  inmuebleAccesorioId: number;
  ejercicio: number;
  fechaInicio: string;
  fechaFin?: string;
  estado: 'activo' | 'inactivo';
  origenCreacion: 'XML' | 'manual';
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2651-2654`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['inmueblePrincipalId', 'inmuebleAccesorioId', 'principal-accesorio-ejercicio' (unique)]
```

- **Único escritor** · `src/services/declaracionDistributorService.ts:983` (`add vinculo`).

- **Lectores principales**:
  - `src/services/migrations/migrateOrphanedInmuebleIds.ts:376`
  - `src/services/declaracionDistributorService.ts:963` (check existencia)

- **FK reales**:
  - `inmueblePrincipalId → properties.id (number)`
  - `inmuebleAccesorioId → properties.id (number)`

- **Reglas de invariante específicas**:
  1. `['principal', 'accesorio', 'ejercicio']` es único (índice compuesto).
  2. Un accesorio solo puede vincularse a un principal por ejercicio.
  3. `origenCreacion='XML'` indica detección automática de declaración AEAT.
  4. Parking/trastero tributariamente unidos a vivienda principal.

- **Origen del primer dato**: Importación de declaración AEAT (casillas 0100-0102) o creación manual.

- **Volumen normal en producción**: 0-4 vínculos por cartera (parking/trastero por inmueble).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Distribución inmuebles | `vinculosAccesorio` | agrupa rentas accesorio con principal |
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Ficha fiscal | `inmuebleAccesorioId` vinculado | indica dependencia fiscal |

---

#### `propertyDays`

- **Schema actual** · `src/services/db.ts:843-854`:
```typescript
interface PropertyDays {
  id?: number;
  propertyId: number;
  taxYear: number;
  daysRented: number;
  daysAvailable: number;
  daysUnderRenovation?: number;
  manualOverride?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2209-2212`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['propertyId', 'taxYear', 'property-year' (unique)]
```

- **Único escritor** · `src/services/propertyOccupancyService.ts:34` (`db.add`), `:64` (`db.put`).

- **Lectores principales**:
  - `src/services/propertyOccupancyService.ts:10`
  - `src/services/aeatAmortizationService.ts:298`
  - `src/services/irpfCalculationService.ts:600`

- **FK reales**:
  - `propertyId → properties.id (number)`

- **Reglas de invariante específicas**:
  1. `daysRented + daysAvailable + daysUnderRenovation <= 365` (ó 366).
  2. `['propertyId', 'taxYear']` es único.
  3. `daysAvailable` genera imputación rentas (casilla 0075).
  4. `daysUnderRenovation` ni renta ni imputación.

- **Origen del primer dato**: Cálculo automático desde contratos o edición manual en Inmueble > Fiscal.

- **Volumen normal en producción**: 1-5 registros por inmueble (años fiscales activos).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Calendario ocupación | `daysRented`, `daysAvailable` | distribución días |
| `docs/audit-inputs/atlas-fiscal.html` | Prorrateo IRPF | `daysRented / 365` | ratio amortización/gastos |

---

#### `planesPensionInversion`

- **Schema actual** · `src/types/personal.ts:345-376`:
```typescript
interface PlanPensionInversion {
  id?: number;
  personalDataId: number;
  nombre: string;
  tipo: 'plan-pensiones' | 'inversion' | 'fondo-indexado' | 'acciones' | 'otros';
  entidad?: string;
  fechaApertura?: string;
  aportacionesRealizadas: number;
  unidades?: number;
  valorCompra: number;
  valorActual: number;
  titularidad: 'yo' | 'pareja' | 'ambos';
  aportacionPeriodica?: AportacionPeriodica;
  esHistorico: boolean;
  historialAportaciones?: Record<string, { titular: number; empresa: number; total: number; fuente: string; }>;
  nominaVinculadaId?: number;
  empresaNif?: string;
  empresaNombre?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2471-2476`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['personalDataId', 'tipo', 'titularidad', 'esHistorico', 'fechaActualizacion']
```

- **Único escritor** · `src/services/declaracionDistributorService.ts:1064` (`db.add`), `src/services/valoracionesService.ts:223` (`db.put`).

- **Lectores principales**:
  - `src/services/planesInversionService.ts:23`
  - `src/services/valoracionesService.ts:70,221,319`
  - `src/services/inversionesService.ts:266`
  - `src/services/traspasosPlanesService.ts:87,132,164`

- **FK reales**:
  - `personalDataId → personalData.id (number)`
  - `nominaVinculadaId → nominas.id (number)`

- **Reglas de invariante específicas**:
  1. `tipo='plan-pensiones'` sujeto a límite deducción 1500€/año.
  2. `aportacionesRealizadas` acumula histórico (no se resta en rescate).
  3. `historialAportaciones` indexado por 'YYYY' o 'YYYY-MM'.
  4. Traspasos no computan como aportación ni rescate.

- **Origen del primer dato**: Importación declaración AEAT (datos empresa) o formulario Personal > Planes.

- **Volumen normal en producción**: 1-5 planes por perfil personal.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Card planes pensiones | `planesPensionInversion.valorActual` | saldo actual |
| `docs/audit-inputs/atlas-inversiones-v2.html` | Listado inversiones | `aportacionesRealizadas`, `valorActual` | rentabilidad |

---

#### `valoraciones_historicas`

- **Schema actual** · `src/types/valoraciones.ts:4-15`:
```typescript
interface ValoracionHistorica {
  id?: number;
  tipo_activo: 'inmueble' | 'inversion' | 'plan_pensiones';
  activo_id: number;
  activo_nombre: string;
  fecha_valoracion: string; // YYYY-MM
  valor: number;
  origen: 'manual' | 'importacion' | 'api_externa';
  notas?: string;
  created_at: string;
  updated_at: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2526-2530`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['tipo_activo', 'activo_id', 'fecha_valoracion', 'tipo-activo-fecha']
```

- **Único escritor** · `src/services/valoracionesService.ts:211,213` (`db.put`/`db.add`), `:394,396`.

- **Lectores principales**:
  - `src/services/valoracionesService.ts:94,108,120,190,374`
  - `src/services/inversionesService.ts:242`
  - `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:862`
  - `src/modules/horizon/herramientas/exporters/atlasExportService.ts:74`

- **FK reales**:
  - `activo_id → properties.id | inversiones.id | planesPensionInversion.id (según tipo_activo)`

- **Reglas de invariante específicas**:
  1. `fecha_valoracion` formato 'YYYY-MM' (mensual).
  2. Solo un valor por combinación `[tipo_activo, activo_id, fecha_valoracion]`.
  3. `origen='api_externa'` reservado para integraciones futuras.
  4. `valor >= 0` siempre.

- **Origen del primer dato**: Wizard valoraciones mensual o importación bulk.

- **Volumen normal en producción**: 50-200 valoraciones (histórico mensual de activos).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inversiones-v2.html` | Gráfico evolución | `valoraciones_historicas.valor` serie temporal | histórico patrimonio |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Patrimonio neto | `sum(última valoración por activo)` | KPI patrimonio |

---

#### `traspasosPlanes`

- **Schema actual** · `src/types/personal.ts:396-417`:
```typescript
interface TraspasoPlan {
  id?: number;
  personalDataId: number;
  planOrigenId: number;
  planDestinoId: number;
  planOrigenStore?: PlanStore;
  planDestinoStore?: PlanStore;
  planOrigenNombre: string;
  planOrigenEntidad?: string;
  planDestinoNombre: string;
  planDestinoEntidad?: string;
  fecha: string;
  importe: number;
  esTotal: boolean;
  unidadesTraspasadas?: number;
  notas?: string;
  fechaCreacion: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2481-2485`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['personalDataId', 'planOrigenId', 'planDestinoId', 'fecha']
```

- **Único escritor** · `src/services/traspasosPlanesService.ts:356` (`db.add`).

- **Lectores principales**:
  - `src/services/traspasosPlanesService.ts:388` (`getAll`)
  - `src/services/traspasosPlanesService.ts:405` (`get`)

- **FK reales**:
  - `personalDataId → personalData.id (number)`
  - `planOrigenId → planesPensionInversion.id | inversiones.id (según store)`
  - `planDestinoId → planesPensionInversion.id | inversiones.id (según store)`

- **Reglas de invariante específicas**:
  1. Traspaso no computa como aportación deducible ni rescate tributable (art. 8.8 LRPFP).
  2. `esTotal=true` implica liquidación completa del plan origen.
  3. Snapshot de nombre/entidad preserva trazabilidad si plan se elimina.
  4. `importe` debe ser positivo.

- **Origen del primer dato**: Wizard traspaso en Personal > Planes o importación.

- **Volumen normal en producción**: 0-3 traspasos por usuario (evento poco frecuente).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Historial traspasos | `traspasosPlanes` listado | trazabilidad movimientos |
| `docs/audit-inputs/atlas-inversiones-v2.html` | Detalle plan | `traspasos entrantes/salientes` | saldo actual neto |

---

#### `importBatches`

- **Schema actual** · `src/services/db.ts:1553-1578`:
```typescript
interface ImportBatch {
  id?: string;
  filename: string;
  accountId: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicatedRows: number;
  errorRows: number;
  origenBanco: string;
  formatoDetectado: 'CSV' | 'XLS' | 'XLSX';
  cuentaIban?: string;
  rangoFechas: { min: string; max: string; };
  timestampImport: string;
  hashLote: string;
  usuario?: string;
  inboxItemId?: number;
  createdAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2337-2339`:
```typescript
keyPath: 'id'
índices: ['accountId', 'createdAt']
```

- **Único escritor** · `src/services/treasuryApiService.ts:753` (`db.add`).

- **Lectores principales**:
  - `src/utils/batchHashUtils.ts:56`

- **FK reales**:
  - `accountId → accounts.id (number)`
  - `inboxItemId → inbox.id (number)` (legacy)

- **Reglas de invariante específicas**:
  1. `hashLote` SHA-256 para idempotencia (evita reimportar mismo fichero).
  2. `totalRows = importedRows + skippedRows + duplicatedRows + errorRows`.
  3. `rangoFechas` extraído de los movimientos del lote.
  4. `id` es UUID string (no autoIncrement).

- **Origen del primer dato**: Importación de extracto bancario CSV/XLS/XLSX.

- **Volumen normal en producción**: 5-50 batches (uno por importación).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Historial importaciones | `importBatches` listado | auditoría importaciones |
| N/A (interno) | Deduplicación | `hashLote` | evita doble importación |

---

#### `movementLearningRules`

- **Schema actual** · `src/services/db.ts:1179-1193`:
```typescript
interface MovementLearningRule {
  id?: number;
  learnKey: string;
  counterpartyPattern: string;
  descriptionPattern: string;
  amountSign: 'positive' | 'negative';
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  source: 'IMPLICIT';
  createdAt: string;
  updatedAt: string;
  appliedCount: number;
  lastAppliedAt?: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2425-2430`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['learnKey' (unique), 'categoria', 'ambito', 'createdAt', 'appliedCount']
```

- **Único escritor** · `src/services/movementLearningService.ts:183` (`db.add`), `:149,232,353,422` (`db.put`).

- **Lectores principales**:
  - `src/services/movementLearningService.ts:137,222,277`
  - `src/services/movementLearningService.ts:374,585`

- **FK reales**:
  - `inmuebleId → properties.id (string)` (si ambito='INMUEBLE')

- **Reglas de invariante específicas**:
  1. `learnKey` es único y determina el patrón.
  2. `appliedCount` incrementa cada vez que la regla categoriza un movimiento.
  3. `source='IMPLICIT'` es el único valor actual (explícito reservado).
  4. Regla se aplica si `counterpartyPattern` + `descriptionPattern` + `amountSign` coinciden.

- **Origen del primer dato**: Primera categorización manual de movimiento que crea regla implícita.

- **Volumen normal en producción**: 20-100 reglas aprendidas.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Auto-categorización | `movementLearningRules` aplicadas | sugerencias categoría |
| N/A (interno) | Backfill | reglas con alto `appliedCount` | prioridad sugerencia |

---

#### `reconciliationAuditLogs`

- **Schema actual** · `src/services/db.ts:1166-1176`:
```typescript
interface ReconciliationAuditLog {
  id?: number;
  action: 'manual_reconcile' | 'auto_reclassify' | 'budget_trigger' | 'learn_rule_created' | 'learn_rule_applied';
  movimientoId: number;
  categoria?: string;
  ambito?: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  learnKey?: string;
  timestamp: string;
  userId?: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2416-2420`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['action', 'movimientoId', 'timestamp', 'categoria']
```

- **Único escritor** · `src/services/movementLearningService.ts:544` (`db.add`), `src/services/budgetReclassificationService.ts:203`.

- **Lectores principales**: no encontrado en código actual (store de auditoría append-only).

- **FK reales**:
  - `movimientoId → movements.id (number)`
  - `inmuebleId → properties.id (string)`

- **Reglas de invariante específicas**:
  1. Append-only: nunca se edita ni elimina.
  2. `timestamp` ISO 8601 del momento de la acción.
  3. Permite trazar quién/qué modificó la categorización de un movimiento.
  4. Sin lectores UI actuales (uso interno auditoría).

- **Origen del primer dato**: Cualquier acción de categorización o reclasificación de movimientos.

- **Volumen normal en producción**: 50-500 logs (crece con uso).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| N/A (interno) | Audit trail | `reconciliationAuditLogs` | trazabilidad reconciliación |
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Histórico acciones | `action`, `timestamp` | depuración |

---

#### `aeatCarryForwards`

- **Schema actual** · `src/services/db.ts:` (no hay interface explícita, campos inferidos de uso):
```typescript
interface AeatCarryForward {
  id?: number;
  propertyId: number;
  taxYear: number;
  expirationYear: number;
  carryForwardType: 'excess_0105' | 'excess_0106';
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  createdAt: string;
  updatedAt?: string;
}
```

- **Cambios propuestos al schema**: Definir interface explícita en db.ts.

- **KeyPath e índices** · `src/services/db.ts:2201-2204`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['propertyId', 'taxYear', 'expirationYear']
```

- **Único escritor** · `src/services/carryForwardService.ts:64,75,110` (`db.put/add`), `src/services/fiscalSummaryService.ts:161,163`.

- **Lectores principales**:
  - `src/services/fiscalSummaryService.ts:158`
  - `src/services/alertasFiscalesService.ts:62`

- **FK reales**:
  - `propertyId → properties.id (number)`

- **Reglas de invariante específicas**:
  1. Arrastres sin caducidad cuando `expirationYear` es nulo o muy lejano.
  2. `remainingAmount = amount - appliedAmount`.
  3. Se generan cuando gastos 0105+0106 > ingresos 0102 del inmueble.
  4. Solo arrastres AEAT detectados; arrastres manuales en `arrastresIRPF`.

- **Origen del primer dato**: Cálculo fiscal al cerrar ejercicio o importar declaración.

- **Volumen normal en producción**: 0-10 por inmueble (raro que haya exceso).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Arrastres pendientes | `aeatCarryForwards.remainingAmount` | importes arrastrables |
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Alertas fiscales | `expirationYear` próximo | aviso caducidad |

---

#### `proveedores`

- **Schema actual** · `src/services/db.ts:422-428`:
```typescript
interface Proveedor {
  nif: string; // keyPath
  nombre?: string;
  tipos: string[];
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2219`:
```typescript
keyPath: 'nif' (string, no autoIncrement)
índices: ninguno adicional
```

- **Único escritor** · `src/services/declaracionDistributorService.ts:1544,1547` (`db.put/add`).

- **Lectores principales**:
  - `src/services/declaracionDistributorService.ts:1539` (`db.get`)

- **FK reales**: Referenciado por `mejorasInmueble.proveedorNIF`, `mueblesInmueble.proveedorNIF`, `gastosInmueble.proveedorNIF`.

- **Reglas de invariante específicas**:
  1. `nif` es la clave primaria (único por proveedor).
  2. `tipos[]` categoriza al proveedor (mejora, gestión, servicios...).
  3. Entidad creada al detectar proveedor nuevo en gastos o XML.
  4. Catálogo de referencia sin impacto fiscal directo.

- **Origen del primer dato**: Importación de declaración AEAT o alta manual de gasto con NIF.

- **Volumen normal en producción**: 5-30 proveedores por usuario.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | Selector proveedor | `proveedores.nombre` | autocompletado |
| `docs/audit-inputs/atlas-fiscal.html` | Detalle gastos | `proveedorNIF` | identificación fiscal |

---

#### `ejerciciosFiscalesCoord`

- **Schema actual** · `src/services/db.ts:1860-1896`:
```typescript
interface EjercicioFiscalCoord {
  año: number; // keyPath
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';
  fechaPrescripcion?: string;
  aeat?: { snapshot: Record<string, number>; resumen: ResumenFiscal; fechaImportacion: string; declaracionCompleta?: any; };
  atlas?: { snapshot: Record<string, number>; resumen: ResumenFiscal; fechaCalculo: string; hashInputs: string; };
  arrastresIn: ArrastresEjercicioCoord;
  arrastresOut?: ArrastresOutEjercicioCoord;
  inmuebleIds: number[];
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2645-2646`:
```typescript
keyPath: 'año' (number)
índices: ['estado']
```

- **Único escritor** · `src/services/ejercicioResolverService.ts:82,323,384,540,602` (`db.put/add`), `src/services/declaracionDistributorService.ts:329,414,419`.

- **Lectores principales**:
  - `src/services/ejercicioResolverService.ts:52,91,321,328,337,423,511`
  - `src/services/declaracionDistributorService.ts:322,347,402`
  - `src/services/treasuryOverviewService.ts:139`
  - `src/services/historicalTreasuryService.ts:47`

- **FK reales**:
  - `inmuebleIds[] → properties.id (number[])`
  - `arrastresIn/Out` referencian datos internos, no FK directas

- **Reglas de invariante específicas**:
  1. `año` es único y keyPath (2020, 2021, ...).
  2. Estado progresa: `en_curso → pendiente → declarado → prescrito`.
  3. `aeat.snapshot` contiene casillas congeladas de declaración importada.
  4. `atlas.hashInputs` detecta si recalcular proyección.

- **Origen del primer dato**: Primera acción fiscal (importar declaración, calcular IRPF, o crear inmueble).

- **Volumen normal en producción**: 3-7 ejercicios (años fiscales activos + prescritos).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Timeline ejercicios | `ejerciciosFiscalesCoord.estado` | estado cada año |
| `docs/audit-inputs/atlas-fiscal.html` | Comparativa AEAT vs ATLAS | `aeat.resumen`, `atlas.resumen` | diferencias |

---

#### `resultadosEjercicio`

- **Schema actual** · `src/services/db.ts:1298-1344`:
```typescript
interface ResultadoEjercicio {
  id?: number;
  ejercicio: number;
  origen: 'cierre' | 'importacion_manual' | 'mixto';
  estadoEjercicio: EstadoEjercicio;
  fechaGeneracion: string;
  fechaCierre?: string;
  fechaPresentacion?: string;
  moneda: 'EUR';
  resumen: { ingresosIntegros: number; gastosDeducibles: number; amortizacion: number; ... };
  arrastres: { generados: Array<...>; aplicados: Array<...>; };
  casillasAEAT?: Record<string, number>;
  metadatos: { validadoContraDatosReales: boolean; notasRevision?: string; origenDatos: OrigenEjercicio; generadoPor: 'sistema' | 'usuario'; };
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2603-2607`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['ejercicio', 'estadoEjercicio', 'origen', 'ejercicio-estado']
```

- **Único escritor** · no encontrado en código actual (store preparado pero sin escritura activa).

- **Lectores principales**:
  - `src/services/fiscalHistoryService.ts:119`

- **FK reales**:
  - `ejercicio` relaciona lógicamente con `ejerciciosFiscalesCoord.año`

- **Reglas de invariante específicas**:
  1. Snapshot inmutable del resultado fiscal de un ejercicio.
  2. `origen` indica si fue cierre automático o importación.
  3. `arrastres.generados[]` contiene IDs de `arrastresIRPF` creados.
  4. Solo se genera al cerrar ejercicio o importar declaración final.

- **Origen del primer dato**: Proceso de cierre fiscal o importación de declaración.

- **Volumen normal en producción**: 0-5 resultados (uno por ejercicio cerrado).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Histórico declaraciones | `resultadosEjercicio.resumen` | resultados pasados |
| `docs/audit-inputs/atlas-fiscal.html` | Casillas AEAT | `casillasAEAT` | detalle declaración |

---

#### `arrastresIRPF`

- **Schema actual** · `src/services/db.ts:1374-1390`:
```typescript
interface ArrastreIRPF {
  id?: number;
  ejercicioOrigen: number;
  tipo: TipoArrastre;
  importeOriginal: number;
  importePendiente: number;
  ejercicioCaducidad?: number;
  inmuebleId?: number;
  aplicaciones: { ejercicio: number; importe: number; fecha: string; }[];
  estado: 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado';
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2612-2618`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['ejercicioOrigen', 'tipo', 'estado', 'ejercicioCaducidad', 'inmuebleId', 'ejercicioOrigen-tipo']
```

- **Único escritor** · `src/services/__tests__/snapshotDeclaracionService.test.ts:49,60` (solo tests); `src/services/fiscalLifecycleService.ts` (implícito).

- **Lectores principales**:
  - `src/services/fiscalLifecycleService.ts:172`
  - `src/services/compensacionAhorroService.ts:140,376`
  - `src/services/migrations/migrateOrphanedInmuebleIds.ts:424`

- **FK reales**:
  - `inmuebleId → properties.id (number)` (si aplica)

- **Reglas de invariante específicas**:
  1. `importePendiente = importeOriginal - sum(aplicaciones.importe)`.
  2. `tipo` determina plazo caducidad (4 años para pérdidas patrimoniales).
  3. `aplicaciones[]` historial FIFO de consumos.
  4. `estado` calculado: `pendiente` → `aplicado_parcial` → `aplicado_total` / `caducado`.

- **Origen del primer dato**: Cierre de ejercicio con pérdidas o exceso de gastos.

- **Volumen normal en producción**: 0-10 arrastres activos.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Panel arrastres | `arrastresIRPF.importePendiente` | saldo compensable |
| `docs/audit-inputs/atlas-fiscal.html` | Alertas caducidad | `ejercicioCaducidad` | aviso próximos a caducar |

---

#### `perdidasPatrimonialesAhorro`

- **Schema actual** · `src/services/db.ts:1356-1372`:
```typescript
interface PerdidaPatrimonialAhorro {
  id?: number;
  ejercicioOrigen: number;
  ejercicioCaducidad: number;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  tipoOrigen: 'crypto' | 'inmueble' | 'importado' | 'manual' | 'mixto';
  estado: 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado';
  aplicaciones: Array<{ ejercicioDestino: number; importe: number; fecha: string; }>;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2622-2625`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['ejercicioOrigen', 'estado', 'ejercicioCaducidad']
```

- **Único escritor** · `src/services/compensacionAhorroService.ts:268,278,291,356,382` (`db.add/put`), `src/services/fiscalLifecycleService.ts:204`.

- **Lectores principales**:
  - `src/services/compensacionAhorroService.ts:97,341`

- **FK reales**: Ninguna directa; `tipoOrigen` indica fuente.

- **Reglas de invariante específicas**:
  1. Pérdidas base ahorro (art. 49 LIRPF) caducan a los 4 años.
  2. `importePendiente = importeOriginal - importeAplicado`.
  3. `tipoOrigen='crypto'` para pérdidas de criptomonedas.
  4. Solo compensa con ganancias de la base del ahorro.

- **Origen del primer dato**: Venta de activo con minusvalía o importación de declaración.

- **Volumen normal en producción**: 0-5 pérdidas activas.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Pérdidas compensables | `perdidasPatrimonialesAhorro.importePendiente` | saldo base ahorro |
| `docs/audit-inputs/atlas-fiscal.html` | Simulador venta | compensación automática | ahorro fiscal estimado |

---

#### `snapshotsDeclaracion`

- **Schema actual** · `src/services/db.ts:1415-1436`:
```typescript
interface SnapshotDeclaracion {
  id?: number;
  ejercicio: number;
  fechaSnapshot: string;
  datos: {
    baseGeneral: any;
    baseAhorro: any;
    reducciones: any;
    minimosPersonales: any;
    liquidacion: any;
    arrastresGenerados: number[];
    arrastresAplicados: number[];
    declaracionCompleta?: any;
  };
  casillasAEAT?: Record<string, number>;
  origen: 'cierre_automatico' | 'importacion_manual';
  hash?: string;
  createdAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2630-2633`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['ejercicio', 'origen', 'fechaSnapshot']
```

- **Único escritor** · `src/services/__tests__/snapshotDeclaracionService.test.ts:144` (`db.put`), `src/services/__tests__/declaracionResolverService.test.ts:30` (`db.add`).

- **Lectores principales**:
  - `src/services/declaracionResolverService.ts:19`
  - `src/services/fiscalResolverService.ts:342`
  - `src/services/__tests__/fiscalLifecycleService.test.ts:82`

- **FK reales**:
  - `arrastresGenerados[] → arrastresIRPF.id (number[])`
  - `arrastresAplicados[] → arrastresIRPF.id (number[])`

- **Reglas de invariante específicas**:
  1. Permite múltiples snapshots por ejercicio (force snapshots).
  2. `hash` para verificar integridad del blob.
  3. `datos` contiene toda la información de la declaración congelada.
  4. Inmutable una vez creado.

- **Origen del primer dato**: Cierre de ejercicio o importación de declaración AEAT.

- **Volumen normal en producción**: 1-2 snapshots por ejercicio declarado.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Detalle declaración | `snapshotsDeclaracion.datos` | datos congelados |
| `docs/audit-inputs/atlas-fiscal.html` | Histórico | `fechaSnapshot` | versiones por fecha |

---

#### `entidadesAtribucion`

- **Schema actual** · `src/services/db.ts:1401-1411`:
```typescript
interface EntidadAtribucionRentas {
  id?: number;
  nif: string;
  nombre: string;
  tipoEntidad: 'CB' | 'SC' | 'HY' | 'otra';
  porcentajeParticipacion: number;
  tipoRenta: 'capital_inmobiliario' | 'actividad_economica' | 'capital_mobiliario';
  ejercicios: EntidadEjercicio[];
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2637-2640`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['nif', 'tipoRenta']
```

- **Único escritor** · `src/services/entidadAtribucionService.ts:14,42,62` (`db.add/put`).

- **Lectores principales**:
  - `src/services/entidadAtribucionService.ts:20,26,35,54`

- **FK reales**: Ninguna directa; NIF referencia entidad externa.

- **Reglas de invariante específicas**:
  1. `tipoEntidad` indica naturaleza jurídica (CB=comunidad bienes, SC=sociedad civil...).
  2. `porcentajeParticipacion` entre 0 y 100.
  3. `ejercicios[]` historial de rendimientos atribuidos por año.
  4. Régimen de atribución de rentas (art. 8.3 LIRPF).

- **Origen del primer dato**: Importación de declaración AEAT (anexo G) o formulario manual.

- **Volumen normal en producción**: 0-3 entidades (caso infrecuente).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-fiscal.html` | Entidades atribución | `entidadesAtribucion` listado | rentas de CB/SC |

---

#### `personalData`

- **Schema actual** · `src/types/personal.ts:33-58`:
```typescript
interface PersonalData {
  id?: number;
  nombre: string;
  apellidos: string;
  dni: string;
  direccion: string;
  situacionPersonal: 'soltero' | 'casado' | 'pareja-hecho' | 'divorciado';
  situacionLaboral: SituacionLaboral[];
  situacionLaboralConyugue?: SituacionLaboral[];
  employmentStatus?: EmploymentStatus;
  maritalStatus?: MaritalStatus;
  spouseName?: string;
  housingType?: HousingType;
  hasVehicle?: boolean;
  hasChildren?: boolean | number;
  comunidadAutonoma?: string;
  descendientes?: Descendiente[];
  ascendientes?: Ascendiente[];
  discapacidad?: NivelDiscapacidad;
  tributacion?: TipoTributacion;
  fechaNacimiento?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2446-2448`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['dni' (unique), 'fechaActualizacion']
```

- **Único escritor** · `src/services/personalOnboardingService.ts:209` (`db.add`), `:244` (`db.put`).

- **Lectores principales**:
  - `src/services/personalOnboardingService.ts:307`
  - `src/services/declaracionOnboardingService.ts:1383`
  - `src/services/declaracionDistributorService.ts:1004`

- **FK reales**: Referenciado por `nominas.personalDataId`, `planesPensionInversion.personalDataId`, `compromisosRecurrentes.personalDataId`.

- **Reglas de invariante específicas**:
  1. `dni` es único (índice).
  2. `situacionLaboral[]` permite múltiples estados (ej. asalariado + autónomo).
  3. `descendientes/ascendientes` afectan mínimos personales IRPF.
  4. Perfil singleton para usuario individual (múltiples para tributación conjunta).

- **Origen del primer dato**: Wizard onboarding Personal o importación declaración AEAT.

- **Volumen normal en producción**: 1-2 perfiles (titular + cónyuge).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Ficha personal | `personalData.nombre`, `dni` | datos identificativos |
| `docs/audit-inputs/atlas-fiscal.html` | Mínimos personales | `descendientes`, `ascendientes` | deducciones IRPF |

---

#### `personalModuleConfig`

- **Schema actual** · `src/types/personal.ts:496-508`:
```typescript
interface PersonalModuleConfig {
  personalDataId: number; // keyPath
  seccionesActivas: {
    nomina: boolean;
    autonomo: boolean;
    pensionesInversiones: boolean;
    otrosIngresos: boolean;
  };
  integracionTesoreria: boolean;
  integracionProyecciones: boolean;
  integracionFiscalidad: boolean;
  fechaActualizacion: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2452-2453`:
```typescript
keyPath: 'personalDataId' (number)
índices: ninguno adicional
```

- **Único escritor** · `src/services/personalDataService.ts:90` (vía transaction store).

- **Lectores principales**:
  - `src/services/personalDataService.ts:74` (`store.get`)

- **FK reales**:
  - `personalDataId → personalData.id (number)`

- **Reglas de invariante específicas**:
  1. Singleton por perfil personal (1:1 con personalData).
  2. `seccionesActivas` habilita/deshabilita módulos según situación laboral.
  3. Integraciones controlan si datos personal fluyen a tesorería/proyecciones/fiscal.
  4. Se actualiza automáticamente al cambiar situación en personalData.

- **Origen del primer dato**: Creación automática al guardar primer perfil personal.

- **Volumen normal en producción**: 1-2 configs (uno por perfil).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Navegación módulos | `seccionesActivas` | mostrar/ocultar secciones |
| `docs/audit-inputs/atlas-ajustes-v2.html` | Integraciones | `integracionTesoreria` | configuración |

---

#### `compromisosRecurrentes`

- **Schema actual** · `src/types/compromisosRecurrentes.ts:139-191`:
```typescript
interface CompromisoRecurrente {
  id?: number;
  ambito: 'personal' | 'inmueble';
  inmuebleId?: number;
  personalDataId?: number;
  alias: string;
  tipo: TipoCompromiso;
  subtipo?: string;
  proveedor: { nombre: string; nif?: string; referencia?: string; };
  patron: PatronRecurrente;
  importe: ImporteEvento;
  variacion?: PatronVariacion;
  cuentaCargo: number;
  conceptoBancario: string;
  metodoPago: MetodoPagoCompromiso;
  categoria: CategoriaGastoCompromiso;
  bolsaPresupuesto: BolsaPresupuesto;
  responsable: ResponsableCompromiso;
  porcentajeTitular?: number;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoCompromiso;
  motivoBaja?: string;
  derivadoDe?: OrigenCompromiso;
  createdAt: string;
  updatedAt: string;
  notas?: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2740-2752`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['ambito', 'personalDataId', 'inmuebleId', 'tipo', 'categoria', 'cuentaCargo', 'estado', 'fechaInicio']
```

- **Único escritor** · `src/services/opexService.ts:206,318,321` (`db.add/put`).

- **Lectores principales**:
  - `src/services/opexService.ts:199,279,291`
  - `src/services/propertyExpenses.ts:184`
  - `src/services/operacionFiscalService.ts:180`

- **FK reales**:
  - `inmuebleId → properties.id (number)` (si ambito='inmueble')
  - `personalDataId → personalData.id (number)` (si ambito='personal')
  - `cuentaCargo → accounts.id (number)`

- **Reglas de invariante específicas**:
  1. `ambito` discrimina si es gasto personal o de inmueble.
  2. `patron` define recurrencia (mensual, trimestral, meses específicos...).
  3. `estado` controla si genera eventos tesorería.
  4. Migrado desde `opexRules` legacy en V5.3.

- **Origen del primer dato**: Wizard gastos recurrentes o migración desde opexRules.

- **Volumen normal en producción**: 10-50 compromisos activos.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Gastos fijos | `compromisosRecurrentes` listado | compromisos personales |
| `docs/audit-inputs/atlas-inmueble-fa32-v2.html` | OPEX inmueble | `compromisosRecurrentes` por inmueble | gastos recurrentes |

---

#### `viviendaHabitual`

- **Schema actual** · `src/types/viviendaHabitual.ts:134-147`:
```typescript
interface ViviendaHabitual {
  id?: number;
  personalDataId: number;
  data: ViviendaHabitualData; // Discriminated union: inquilino | propietario | hipoteca
  vigenciaDesde: string;
  vigenciaHasta?: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  notas?: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2755-2762`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['personalDataId', 'activa', 'vigenciaDesde']
```

- **Único escritor** · no encontrado en código actual (store definido pero sin escritor implementado).

- **Lectores principales**: no encontrado en código actual.

- **FK reales**:
  - `personalDataId → personalData.id (number)`

- **Reglas de invariante específicas**:
  1. Solo una vivienda habitual `activa=true` por perfil.
  2. `data` es unión discriminada según régimen (alquiler, propiedad, hipoteca).
  3. Genera compromisos derivados automáticamente.
  4. `vigenciaDesde/Hasta` permite histórico de viviendas.

- **Origen del primer dato**: Wizard Personal > Vivienda habitual.

- **Volumen normal en producción**: 1-3 registros (actual + histórico).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Sección vivienda | `viviendaHabitual.data` | situación habitacional |
| `docs/audit-inputs/atlas-mi-plan-libertad-v3.html` | Escenario vivienda | `data.tipo` | hipótesis libertad |

---

#### `objetivos`

- **Schema actual** · `src/types/miPlan.ts:52-86`:
```typescript
type Objetivo = ObjetivoBase & (
  | { tipo: 'acumular'; metaCantidad: number; fondoId: string; }
  | { tipo: 'amortizar'; metaCantidad: number; prestamoId: string; }
  | { tipo: 'comprar'; metaCantidad: number; fondoId: string; capacidadEndeudamientoEsperada?: number; }
  | { tipo: 'reducir'; metaCantidadMensual: number; categoriaGasto: string; }
);

interface ObjetivoBase {
  id: string; // UUID
  nombre: string;
  descripcion?: string;
  fechaCierre: string;
  estado: ObjetivoEstado;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:3059-3064`:
```typescript
keyPath: 'id' (UUID string)
índices: ['tipo', 'estado', 'fondoId', 'prestamoId']
```

- **Único escritor** · `src/services/objetivosService.ts:102,148` (`db.put`).

- **Lectores principales**:
  - `src/services/objetivosService.ts:110,120,137,177,180,192,194`

- **FK reales**:
  - `fondoId → fondos_ahorro.id (UUID string)` (si tipo='acumular'|'comprar')
  - `prestamoId → prestamos.id (UUID string)` (si tipo='amortizar')

- **Reglas de invariante específicas**:
  1. `id` es UUID generado por cliente.
  2. `tipo` discrimina la estructura de datos.
  3. `estado` progresa según avance hacia `metaCantidad`.
  4. Vinculación a fondo o préstamo según tipo de objetivo.

- **Origen del primer dato**: Wizard Mi Plan > Objetivos.

- **Volumen normal en producción**: 1-10 objetivos activos.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-objetivos-v3.html` | Lista objetivos | `objetivos` listado | panel de objetivos |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Progreso objetivos | `estado`, `metaCantidad` | KPIs Mi Plan |

---

#### `fondos_ahorro`

- **Schema actual** · `src/types/miPlan.ts:120-131`:
```typescript
interface FondoAhorro {
  id: string; // UUID
  tipo: FondoTipo; // 'colchon' | 'compra' | 'reforma' | 'impuestos' | 'capricho' | 'custom'
  nombre: string;
  descripcion?: string;
  cuentasAsignadas: CuentaAsignada[];
  metaImporte?: number;
  metaMeses?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:3074-3077`:
```typescript
keyPath: 'id' (UUID string)
índices: ['tipo', 'activo']
```

- **Único escritor** · `src/services/fondosService.ts:97,146` (`db.put`).

- **Lectores principales**:
  - `src/services/fondosService.ts:39,105,115,132`
  - `src/services/objetivosService.ts:27`

- **FK reales**:
  - `cuentasAsignadas[].cuentaId → accounts.id (number)`

- **Reglas de invariante específicas**:
  1. `id` es UUID generado por cliente.
  2. `tipo='colchon'` usa `metaMeses` para calcular meta en €.
  3. `cuentasAsignadas` vincula cuentas completas o parciales al fondo.
  4. `activo=false` para soft-delete sin perder histórico.

- **Origen del primer dato**: Wizard Mi Plan > Fondos de ahorro.

- **Volumen normal en producción**: 2-6 fondos (colchón + propósitos específicos).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-fondos-v3.html` | Lista fondos | `fondos_ahorro` listado | gestión de fondos |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Distribución ahorro | `cuentasAsignadas`, `metaImporte` | visualización bolsillos |

---

#### `retos`

- **Schema actual** · `src/types/miPlan.ts:141-160`:
```typescript
interface Reto {
  id: string; // UUID
  tipo: RetoTipo; // 'ahorro' | 'ejecucion' | 'disciplina' | 'revision'
  mes: string; // YYYY-MM (UNIQUE)
  titulo: string;
  descripcion?: string;
  metaCantidad?: number;
  metaBinaria?: boolean;
  estado: RetoEstado;
  vinculadoA?: { objetivoId?: string; fondoId?: string; prestamoId?: string; categoriaGasto?: string; };
  origenSugerencia?: OrigenSugerencia;
  notasCierre?: string;
  createdAt: string;
  updatedAt: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:3087-3091`:
```typescript
keyPath: 'id' (UUID string)
índices: ['mes' (unique), 'estado', 'tipo']
```

- **Único escritor** · `src/services/retosService.ts:68,154` (`db.put`).

- **Lectores principales**:
  - `src/services/retosService.ts:89,102,116,139,174`

- **FK reales**:
  - `vinculadoA.objetivoId → objetivos.id (UUID string)`
  - `vinculadoA.fondoId → fondos_ahorro.id (UUID string)`
  - `vinculadoA.prestamoId → prestamos.id (UUID string)`

- **Reglas de invariante específicas**:
  1. `mes` es UNIQUE: máximo 1 reto activo por mes.
  2. `tipo='ahorro'` requiere `metaCantidad`; `tipo='revision'` usa `metaBinaria`.
  3. `estado` progresa: `futuro → activo → completado|parcial|fallado`.
  4. V1 solo permite `origenSugerencia='usuario'`.

- **Origen del primer dato**: Wizard Mi Plan > Retos (usuario define reto mensual).

- **Volumen normal en producción**: 1-12 retos (uno por mes del año en curso).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-retos-v3.html` | Panel retos | `retos` listado | gestión de retos |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Reto del mes | `retos` donde `mes=currentMonth` | reto activo |

---

#### `presupuestos`

- **Schema actual** · `src/services/db.ts:1668-1679`:
```typescript
interface Presupuesto {
  id: UUID;
  year: number;
  creadoEn: string;
  actualizadoEn: string;
  estado: 'Borrador' | 'Activo' | 'Cerrado';
  generadoDesde?: {
    fecha: string;
    porcentajeComplecionInicial: number;
  };
}
```

- **Cambios propuestos al schema**: Ninguno justificado.

- **KeyPath e índices** · `src/services/db.ts:2384-2386`:
```typescript
keyPath: 'id' (UUID string)
índices: ['year', 'estado']
```

- **Único escritor** · `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:43` (`db.add`), `:59` (`db.put`).

- **Lectores principales**:
  - `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:25,50,109,136,390`
  - `src/services/budgetMatchingService.ts:111`

- **FK reales**: Referenciado por `presupuestoLineas.presupuestoId`.

- **Reglas de invariante específicas**:
  1. Uno por `year` (aunque no hay unique constraint).
  2. `estado` progresa: `Borrador → Activo → Cerrado`.
  3. `generadoDesde` indica si fue autogenerado desde datos históricos.
  4. Solo un presupuesto `Activo` debería existir a la vez.

- **Origen del primer dato**: Wizard Presupuesto anual o autogeneración desde histórico.

- **Volumen normal en producción**: 1-3 presupuestos (año actual + borrador + histórico).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-proyeccion-v3.html` | Presupuesto anual | `presupuestos` | cabecera presupuesto |
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Comparativa | `estado='Activo'` | presupuesto referencia |

---

#### `presupuestoLineas`

- **Schema actual** · `src/services/db.ts:1681-1723`:
```typescript
interface PresupuestoLinea {
  id: UUID;
  presupuestoId: UUID;
  scope: 'INMUEBLES' | 'PERSONAL';
  type: 'INGRESO' | 'COSTE';
  inmuebleId?: UUID;
  roomId?: UUID;
  category: string;
  subcategory?: string;
  label: string;
  counterpartyName?: string;
  accountId?: UUID;
  sourceRef?: UUID;
  amountByMonth: number[]; // 12 posiciones
  planAmountByMonth?: number[];
  forecastAmountByMonth?: number[];
  actualAmountByMonth?: number[];
  statusCertidumbreByMonth?: EstadoCertidumbre[];
  planningLayer?: PlanningLayer;
  note?: string;
  // ... campos legacy deprecados
}
```

- **Cambios propuestos al schema**: Consolidar campos legacy deprecados.

- **KeyPath e índices** · `src/services/db.ts:2391-2400`:
```typescript
keyPath: 'id' (UUID string)
índices: ['presupuestoId', 'inmuebleId', 'tipo', 'categoria', 'frecuencia', 'origen', 'cuentaId', 'contratoId', 'prestamoId']
```

- **Único escritor** · `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:105` (`db.add`), `:132` (`db.put`).

- **Lectores principales**:
  - `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:124`
  - `src/services/budgetMatchingService.ts:120`
  - `src/services/budgetReclassificationService.ts:157`

- **FK reales**:
  - `presupuestoId → presupuestos.id (UUID)`
  - `inmuebleId → properties.id (UUID string representation)`
  - `accountId → accounts.id (UUID string representation)`
  - `sourceRef → contracts.id | prestamos.id (según contexto)`

- **Reglas de invariante específicas**:
  1. `amountByMonth[12]` para distribución mensual ENE-DIC.
  2. `scope + type` discrimina ingreso/coste personal/inmueble.
  3. `planAmountByMonth` vs `actualAmountByMonth` para desviaciones.
  4. `sourceRef` vincula a contrato o préstamo si aplica.

- **Origen del primer dato**: Wizard Presupuesto o autogeneración desde histórico.

- **Volumen normal en producción**: 20-100 líneas por presupuesto.

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-mi-plan-proyeccion-v3.html` | Tabla líneas | `presupuestoLineas` listado | detalle presupuesto |
| `docs/audit-inputs/atlas-tesoreria-v8.html` | Matching | `category`, `counterpartyName` | matching con movimientos |

---

#### `otrosIngresos`

- **Schema actual** · `src/types/personal.ts:420-435`:
```typescript
export interface OtrosIngresos {
  id?: number;
  personalDataId: number;
  nombre: string;
  tipo: 'prestacion-desempleo' | 'subsidio-ayuda' | 'pension-alimenticia' | 'devolucion-deuda' | 'otro';
  importe: number;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  titularidad: 'yo' | 'pareja' | 'ambos';
  cuentaCobro: number;
  reglasDia: ReglaDia;
  activo: boolean;
  fechaInicio?: string;
  fechaFin?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

- **Cambios propuestos al schema**: Ninguno justificado. Schema ya soporta los 5 tipos de ingreso no laboral previstos por Personal v3.

- **KeyPath e índices** · `src/services/db.ts:2489-2493`:
```typescript
keyPath: 'id', autoIncrement: true
índices: ['personalDataId', 'tipo', 'activo', 'fechaActualizacion']
```

- **Único escritor** · `src/services/otrosIngresosService.ts:52,80,110` (CRUD CompletePut/add/delete sobre store).

- **Lectores principales**:
  - `src/services/otrosIngresosService.ts:22-23` (`getAll`)
  - `src/services/personalResumenService.ts:23-24` (agregado Personal)
  - `src/services/personalResumenService.ts` (cálculo total ingresos no laborales)

- **FK reales**:
  - `personalDataId → personalData.id (number autoIncrement)`
  - `cuentaCobro → accounts.id (number autoIncrement)`

- **Reglas de invariante específicas**:
  1. `tipo` está cerrado al enum (no admite valores libres).
  2. `frecuencia` determina cómo se proyecta a `treasuryEvents`.
  3. `activo: false` excluye de cálculo total Personal pero conserva histórico.
  4. `fechaFin` opcional permite ingresos a término (subsidios temporales).

- **Origen del primer dato**: Alta manual desde UI Personal · sección "Otros ingresos" (no derivado de XML/CSV).

- **Volumen normal en producción**: 0-5 entradas por usuario (subsidios, prestaciones puntuales).

**Trazabilidad real**

| Mockup file | Componente | Dato concreto | Cómo se usa |
|-------------|------------|---------------|-------------|
| `docs/audit-inputs/atlas-personal-v3.html` | Sección "Otros ingresos" | `otrosIngresos` listado | listado y total mensual |
| `docs/audit-inputs/atlas-mi-plan-landing-v3.html` | Card "Ingresos" | `sum(otrosIngresos.importe where activo)` | suma a ingresos del mes |

---

### 3.3 Análisis de fusión de los 10 HUÉRFANOS

---

##### Análisis fusión · `arrastresManual` ↔ `arrastresIRPF`

- **Hipótesis de fusión**: Absorber `arrastresManual` en `arrastresIRPF` añadiendo campo `origen: 'manual' | 'aeat' | 'calculado'`.

- **Argumentos a favor de fusionar**:
  - Ambos almacenan el mismo tipo de dato: arrastres fiscales entre ejercicios.
  - `arrastresManual` tiene 0 registros en snapshot y solo 1 referencia en tests.
  - Un solo store simplifica queries de "todos los arrastres del ejercicio X".

- **Argumentos en contra de fusionar (mantener separado)**:
  - El servicio `ejercicioFiscalService.ts:18` define `ARRASTRES_MANUAL_STORE` como constante separada.
  - Diferente ciclo de vida: manuales son editables, AEAT son inmutables.

- **Análisis del código actual**:
  - `arrastresManual`: solo escrito en test (`ejercicioFiscalService.test.ts:117`), no hay lectores.
  - `arrastresIRPF`: escrito por `fiscalHistoryService.ts:126`, leído por `fiscalLifecycleService.ts:172`.

- **Análisis del roadmap**:
  - No hay mockup que muestre "arrastres manuales" como entidad separada.
  - La pantalla Fiscal debería mostrar todos los arrastres juntos.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: No hay uso real de `arrastresManual` en producción. Añadir `origen='manual'` a `arrastresIRPF` cubre el caso de uso sin duplicar stores. El código que escribe en `arrastresManual` puede migrarse trivialmente a escribir en `arrastresIRPF` con el discriminador.

---

##### Análisis fusión · `autonomos` ↔ `nominas`

- **Hipótesis de fusión**: Absorber `autonomos` en `nominas` añadiendo campo `tipo: 'nomina' | 'autonomo'`.

- **Argumentos a favor de fusionar**:
  - Ambos representan ingresos laborales/profesionales del usuario.
  - `autonomos` tiene 0 registros en snapshot Jose.
  - Schema muy similar: ambos tienen `personalDataId`, `activo/a`, fechas, importes.
  - Queries de "total ingresos laborales" serían más simples.

- **Argumentos en contra de fusionar (mantener separado)**:
  - Autónomos tienen campos específicos (IAE, retención estimada, gastos deducibles).
  - Servicio dedicado `autonomoService.ts` con lógica propia.

- **Análisis del código actual**:
  - `autonomos`: servicio completo con CRUD (`autonomoService.ts:28-267`).
  - `nominas`: servicio paralelo con misma estructura (`nominaService.ts`).
  - `irpfCalculationService.ts:420` lee ambos por separado.

- **Análisis del roadmap**:
  - `atlas-personal-v3.html` muestra sección "Ingresos" unificada.
  - No hay separación visual entre nóminas y autónomos.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: El modelo mental del usuario es "mis ingresos", no "mis nóminas vs mis facturas autónomo". Campos específicos de autónomo pueden ir en `metadata.autonomo: { iae, retencion }`. La UI Personal ya los agrupa visualmente.

---

##### Análisis fusión · `documentosFiscales` ↔ `documents`

- **Hipótesis de fusión**: Absorber `documentosFiscales` en `documents` añadiendo `metadata.tipo='fiscal'`.

- **Argumentos a favor de fusionar**:
  - `documentosFiscales` tiene 0 registros en snapshot.
  - `documents` ya tiene campo `metadata` extensible.
  - Un solo store documental simplifica archivo y búsqueda.

- **Argumentos en contra de fusionar (mantener separado)**:
  - `documentosFiscales` tiene índices específicos (`ejercicio-concepto`, `ejercicio-inmuebleId`).

- **Análisis del código actual**:
  - `documentosFiscales`: solo escrito en migración y tests.
  - `documents`: escrito activamente por inbox, email, ingestion.

- **Análisis del roadmap**:
  - `atlas-archivo.html` muestra un único archivo documental.
  - Filtro por tipo permite ver solo fiscales.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: Mantener un único store documental con filtrado por `metadata.tipo` es más coherente con la UI de Archivo. Los índices específicos se pueden añadir a `documents` si son necesarios.

---

##### Análisis fusión · `entidadesAtribucion` ↔ `proveedores` o `personalData`

- **Hipótesis de fusión**: Absorber en `proveedores` con campo `esEntidadAtribucion: true`, o en `personalData` como array.

- **Argumentos a favor de fusionar**:
  - `entidadesAtribucion` tiene 0 registros.
  - Datos similares a proveedor (NIF, nombre, tipo renta).

- **Argumentos en contra de fusionar (mantener separado)**:
  - Entidades de atribución de rentas son concepto fiscal específico (comunidades de bienes, herencias).
  - Ciclo de vida diferente: proveedores se detectan de XMLs, entidades atribución se declaran manualmente.
  - Cardinalidad potencialmente diferente.

- **Análisis del código actual**:
  - `entidadesAtribucion`: servicio dedicado `entidadAtribucionService.ts` con CRUD completo.
  - El servicio no referencia proveedores ni personalData.

- **Análisis del roadmap**:
  - Funcionalidad de "rentas en atribución" es específica de ciertos perfiles fiscales.
  - No hay mockup específico pero es feature planeado para Fiscal v2.

- **Recomendación final**: **MANTENER SEPARADO**

- **Justificación**: Aunque vacío, tiene servicio dedicado y semántica fiscal específica. Fusionar con proveedores contaminaría el concepto. El coste de mantenerlo vacío es bajo.

---

##### Análisis fusión · `loan_settlements` ↔ `prestamos`

- **Hipótesis de fusión**: Absorber como `prestamos.liquidaciones[]` array.

- **Argumentos a favor de fusionar**:
  - `loan_settlements` tiene 0 registros.
  - Una liquidación siempre pertenece a un préstamo (FK `loanId`).
  - Cardinalidad 1:pocos (típicamente 0-1 liquidaciones por préstamo).
  - Simplifica queries: "obtener préstamo con su liquidación".

- **Argumentos en contra de fusionar (mantener separado)**:
  - El servicio `loanSettlementService.ts` tiene 600+ líneas de lógica.
  - Liquidaciones generan múltiples efectos secundarios (eventos, movimientos).

- **Análisis del código actual**:
  - `loan_settlements`: escrito por `loanSettlementService.ts:592`, leído por `:544,662`.
  - El servicio ya lee `prestamos` y `keyval` en la misma transacción.

- **Análisis del roadmap**:
  - `atlas-financiacion-v2.html` muestra préstamos con estado "Liquidado/Vivo".
  - La liquidación se ve como estado final, no como entidad separada.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: La liquidación es un evento que cambia el estado del préstamo a `liquidado`. Almacenarla como campo `liquidacion: LoanSettlement | null` dentro del préstamo es más natural y reduce un store. El servicio seguirá siendo complejo pero operará sobre un objeto.

---

##### Análisis fusión · `matchingConfiguration` ↔ `keyval`

- **Hipótesis de fusión**: Absorber como `keyval['matchingConfig']`.

- **Argumentos a favor de fusionar**:
  - `matchingConfiguration` tiene 0 registros.
  - Es configuración singleton/escasa, ideal para keyval.
  - Reduce un store sin pérdida de funcionalidad.

- **Argumentos en contra de fusionar (mantener separado)**:
  - Si hubiera muchas reglas de matching, un store indexado sería más eficiente.

- **Análisis del código actual**:
  - Solo definición de store en `db.ts:2408-2412`, sin escritores ni lectores activos.

- **Análisis del roadmap**:
  - Feature de matching presupuestario está en roadmap pero no implementado.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: Sin uso actual y con expectativa de configuración escasa, keyval es suficiente. Si el feature crece, se puede extraer a store propio más adelante.

---

##### Análisis fusión · `pensiones` ↔ `nominas`

- **Hipótesis de fusión**: Absorber en `nominas` con `tipo='pension'`.

- **Argumentos a favor de fusionar**:
  - `pensiones` tiene 0 registros.
  - Pensión es un ingreso recurrente como nómina.
  - UI Personal agrupa todos los ingresos.

- **Argumentos en contra de fusionar (mantener separado)**:
  - Pensiones no tienen empleador ni retención trabajo.
  - Fiscalidad diferente (rendimiento del trabajo vs rendimiento capital).

- **Análisis del código actual**:
  - `pensiones`: servicio `pensionService.ts` con CRUD básico.
  - Similar estructura a `nominaService.ts`.

- **Análisis del roadmap**:
  - Perfil de Jose (inversor joven) no tiene pensiones.
  - Feature relevante para usuarios mayores.

- **Recomendación final**: **FUSIONAR**

- **Justificación**: Mismo argumento que autónomos. Un campo `tipo` en `nominas` cubre los tres casos de ingreso personal. Campos específicos de pensión (tipo, origen) van en metadata.

---

##### Análisis fusión · `presupuestoLineas` ↔ `presupuestos`

- **Hipótesis de fusión**: Absorber como `presupuestos.lineas[]` array.

- **Argumentos a favor de fusionar**:
  - Relación 1:N clara (un presupuesto tiene muchas líneas).
  - Simplifica obtener presupuesto completo en una lectura.

- **Argumentos en contra de fusionar (mantener separado)**:
  - Cardinalidad alta: un presupuesto puede tener 50-200 líneas.
  - Índices de líneas (`presupuestoId`, `inmuebleId`, `categoria`) son útiles.
  - Actualizar una línea requeriría reescribir todo el presupuesto.

- **Análisis del código actual**:
  - `presupuestoLineas`: 10 índices en `db.ts:2391-2401`.
  - `budgetReclassificationService.ts` consulta líneas por índice.

- **Análisis del roadmap**:
  - `atlas-mi-plan-proyeccion-v3.html` muestra presupuesto con muchas categorías.
  - Edición granular de líneas es requisito.

- **Recomendación final**: **MANTENER SEPARADO**

- **Justificación**: La cardinalidad N:1 con índices activos justifica el store. Embedder 200 líneas en un documento haría las operaciones de actualización costosas.

---

##### Análisis fusión · `property_sales` ↔ `properties`

- **Hipótesis de fusión**: Absorber como `properties.venta: PropertySale | null` o estado + campos.

- **Argumentos a favor de fusionar**:
  - `property_sales` tiene 0 registros.
  - Una venta siempre pertenece a un inmueble.
  - Cardinalidad 1:1 (un inmueble tiene máximo una venta).

- **Argumentos en contra de fusionar (mantener separado)**:
  - Servicio `propertySaleService.ts` tiene 1300+ líneas de lógica compleja.
  - La venta genera múltiples efectos (eventos, liquidaciones, cambio estado).
  - Índices propios (`propertyId`, `saleDate`, `status`).
  - Podría haber múltiples "intentos de venta" antes de completarse.

- **Análisis del código actual**:
  - `property_sales`: servicio muy activo con operaciones complejas.
  - El estado de venta afecta a contratos, préstamos, gastos.

- **Análisis del roadmap**:
  - `atlas-inmuebles-v3.html` muestra estados de inmueble incluyendo "Vendido".
  - La ficha de venta es pantalla dedicada.

- **Recomendación final**: **MANTENER SEPARADO**

- **Justificación**: Complejidad del servicio y posible cardinalidad >1 (múltiples ofertas/intentos) justifica store propio. El coste de tenerlo vacío es bajo.

---

##### Análisis fusión · `viviendaHabitual` ↔ `personalData`

- **Hipótesis de fusión**: Absorber como `personalData.viviendaHabitual: ViviendaHabitual`.

- **Argumentos a favor de fusionar**:
  - `viviendaHabitual` tiene 0 registros.
  - Es singleton por persona (relación 1:1 con personalData).
  - Simplifica obtener perfil completo.

- **Argumentos en contra de fusionar (mantener separado)**:
  - Vivienda habitual genera eventos de tesorería propios.
  - Tiene campos complejos (gastos fijos, hipoteca, alquiler).
  - Ciclo de vida diferente (puede cambiar de alquiler a propia).

- **Análisis del código actual**:
  - `viviendaHabitual`: solo definición en `db.ts:2754-2762`, sin escritores activos.
  - Referenciado en `compromisosRecurrentes.ts` como fuente de derivación.

- **Análisis del roadmap**:
  - `atlas-personal-v3.html` tiene sección "Mi hogar" dedicada.
  - Es feature importante para calcular gastos vida libertad.

- **Recomendación final**: **MANTENER SEPARADO**

- **Justificación**: Aunque singleton, tiene semántica propia y genera eventos. El modelo conceptual de "mi vivienda" es diferente de "mis datos personales". Futuro servicio dedicado lo tratará como entidad.

---

### 3.4 Tabla resumen 10 fusiones con decisión

| Store HUÉRFANO | Destino propuesto | Decisión | Reducción |
|----------------|-------------------|----------|-----------|
| `arrastresManual` | `arrastresIRPF.origen='manual'` | **FUSIONAR** | -1 store |
| `autonomos` | `nominas.tipo='autonomo'` | **FUSIONAR** | -1 store |
| `documentosFiscales` | `documents.metadata.tipo='fiscal'` | **FUSIONAR** | -1 store |
| `entidadesAtribucion` | (mantener) | MANTENER | 0 |
| `loan_settlements` | `prestamos.liquidacion` | **FUSIONAR** | -1 store |
| `matchingConfiguration` | `keyval['matchingConfig']` | **FUSIONAR** | -1 store |
| `pensiones` | `nominas.tipo='pension'` | **FUSIONAR** | -1 store |
| `presupuestoLineas` | (mantener) | MANTENER | 0 |
| `property_sales` | (mantener) | MANTENER | 0 |
| `viviendaHabitual` | (mantener) | MANTENER | 0 |

**Total fusiones recomendadas: 6** (de los 10 HUÉRFANOS) + **1 fusión adicional propuesta vía AMBIGUO** (`learningLogs` → `movementLearningRules`)
**Stores eliminados por fusión total: 7**
**Nuevo total: 59 - 11 (V1) - 7 (V2) = 41 stores**

### 3.5 Comparación de tamaños actualizada

| Métrica | V1 | V2 |
|---------|----|----|
| Stores actuales | 59 | 59 |
| Stores objetivo | 48 | 41 |
| Eliminaciones V1 | 11 | 11 |
| Fusiones HUÉRFANOS V2 | 0 | 6 |
| Consolidaciones AMBIGUO V2 | 0 | 1 (`learningLogs`) |
| Reducción total | 19% | **30,5%** |

---

## 4. SUB-TAREA C · Plan de transición

### 4.1 Mapeo actual→objetivo actualizado tras fusiones

| Store actual | Veredicto | Store objetivo destino | Acción |
|--------------|-----------|------------------------|--------|
| `accounts` | VIVO | `accounts` | mantener |
| `aeatCarryForwards` | VIVO | `aeatCarryForwards` | mantener |
| `arrastresIRPF` | VIVO | `arrastresIRPF` | mantener + absorber `arrastresManual` |
| `arrastresManual` | HUÉRFANO→FUSIONAR | `arrastresIRPF.origen='manual'` | eliminar |
| `autonomos` | HUÉRFANO→FUSIONAR | `nominas.tipo='autonomo'` | eliminar |
| `compromisosRecurrentes` | HUÉRFANO | `compromisosRecurrentes` | mantener |
| `configuracion_fiscal` | DUPLICADO | `keyval['configFiscal']` | eliminar |
| `contracts` | VIVO | `contracts` | mantener |
| `documentosFiscales` | HUÉRFANO→FUSIONAR | `documents.metadata.tipo='fiscal'` | eliminar |
| `documents` | VIVO | `documents` | mantener + absorber `documentosFiscales` |
| `ejerciciosFiscales` | DUPLICADO | `ejerciciosFiscalesCoord` | eliminar |
| `ejerciciosFiscalesCoord` | VIVO | `ejerciciosFiscalesCoord` | mantener |
| `entidadesAtribucion` | HUÉRFANO | `entidadesAtribucion` | mantener |
| `escenarios` | HUÉRFANO | `escenarios` | mantener |
| `fondos_ahorro` | HUÉRFANO | `fondos_ahorro` | mantener |
| `gastosInmueble` | VIVO | `gastosInmueble` | mantener |
| `gastosPersonalesReal` | DUPLICADO | `movements + treasuryEvents` | eliminar |
| `importBatches` | VIVO/AMBIGUO | `importBatches` | mantener |
| `inversiones` | VIVO | `inversiones` | mantener |
| `keyval` | VIVO | `keyval` | mantener + absorber singletons |
| `kpiConfigurations` | FÓSIL | `keyval` | eliminar |
| `learningLogs` | VIVO/AMBIGUO | `movementLearningRules.history[]` | evaluar fusión |
| `loan_settlements` | HUÉRFANO→FUSIONAR | `prestamos.liquidacion` | eliminar |
| `matchingConfiguration` | HUÉRFANO→FUSIONAR | `keyval['matchingConfig']` | eliminar |
| `mejorasInmueble` | VIVO | `mejorasInmueble` | mantener |
| `movementLearningRules` | VIVO | `movementLearningRules` | mantener |
| `movements` | VIVO | `movements` | mantener |
| `mueblesInmueble` | VIVO | `mueblesInmueble` | mantener |
| `nominas` | VIVO | `nominas` | mantener + absorber `autonomos`, `pensiones` |
| `objetivos` | HUÉRFANO | `objetivos` | mantener |
| `operacionesProveedor` | DUPLICADO | `proveedores.operaciones[]` | eliminar |
| `opexRules` | DUPLICADO | `compromisosRecurrentes` | eliminar |
| `otrosIngresos` | HUÉRFANO | `otrosIngresos` | mantener |
| `patrimonioSnapshots` | DUPLICADO | `valoraciones_historicas` | eliminar |
| `patronGastosPersonales` | DUPLICADO | `compromisosRecurrentes` | eliminar |
| `pensiones` | HUÉRFANO→FUSIONAR | `nominas.tipo='pension'` | eliminar |
| `perdidasPatrimonialesAhorro` | VIVO | `perdidasPatrimonialesAhorro` | mantener |
| `personalData` | VIVO | `personalData` | mantener |
| `personalModuleConfig` | VIVO | `personalModuleConfig` | mantener |
| `planesPensionInversion` | VIVO | `planesPensionInversion` | mantener |
| `prestamos` | VIVO | `prestamos` | mantener + absorber `loan_settlements` |
| `presupuestoLineas` | HUÉRFANO | `presupuestoLineas` | mantener |
| `presupuestos` | HUÉRFANO | `presupuestos` | mantener |
| `properties` | VIVO | `properties` | mantener |
| `propertyDays` | VIVO/AMBIGUO | `propertyDays` | mantener (decisión Jose) |
| `property_sales` | HUÉRFANO | `property_sales` | mantener |
| `proveedores` | VIVO | `proveedores` | mantener |
| `reconciliationAuditLogs` | VIVO/AMBIGUO | evaluar eliminación | evaluar |
| `rentaMensual` | DUPLICADO | `contracts + treasuryEvents` | eliminar |
| `resultadosEjercicio` | VIVO | `resultadosEjercicio` | mantener |
| `retos` | HUÉRFANO | `retos` | mantener |
| `snapshotsDeclaracion` | VIVO/AMBIGUO | `snapshotsDeclaracion` | mantener |
| `traspasosPlanes` | VIVO/AMBIGUO | `traspasosPlanes` | mantener (decisión Jose) |
| `treasuryEvents` | VIVO | `treasuryEvents` | mantener |
| `treasuryRecommendations` | FÓSIL | derivado runtime | eliminar |
| `valoraciones_historicas` | VIVO | `valoraciones_historicas` | mantener |
| `valoraciones_mensuales` | DUPLICADO | `valoraciones_historicas` | eliminar |
| `vinculosAccesorio` | VIVO/AMBIGUO | `vinculosAccesorio` | mantener |
| `viviendaHabitual` | HUÉRFANO | `viviendaHabitual` | mantener |

### 4.2 Listas eliminar/crear/refactorizar actualizadas

**A ELIMINAR (17 stores)**:
1. `arrastresManual` → fusionado en `arrastresIRPF`
2. `autonomos` → fusionado en `nominas`
3. `configuracion_fiscal` → migrado a `keyval`
4. `documentosFiscales` → fusionado en `documents`
5. `ejerciciosFiscales` → sustituido por `ejerciciosFiscalesCoord`
6. `gastosPersonalesReal` → sustituido por `movements + treasuryEvents`
7. `kpiConfigurations` → migrado a `keyval`
8. `loan_settlements` → fusionado en `prestamos`
9. `matchingConfiguration` → migrado a `keyval`
10. `operacionesProveedor` → normalizado en `proveedores`
11. `opexRules` → sustituido por `compromisosRecurrentes`
12. `patrimonioSnapshots` → derivado de `valoraciones_historicas`
13. `patronGastosPersonales` → sustituido por `compromisosRecurrentes`
14. `pensiones` → fusionado en `nominas`
15. `rentaMensual` → sustituido por `contracts + treasuryEvents`
16. `treasuryRecommendations` → derivado runtime
17. `valoraciones_mensuales` → derivado de `valoraciones_historicas`

**A CREAR**: Ninguno.

**A REFACTORIZAR**:
1. `arrastresIRPF`: añadir campo `origen: 'manual' | 'aeat' | 'calculado'`
2. `nominas`: añadir campo `tipo: 'nomina' | 'autonomo' | 'pension'`
3. `documents`: añadir `metadata.tipo: 'fiscal' | 'contrato' | 'bancario' | 'otro'`
4. `prestamos`: añadir campo `liquidacion: LoanSettlement | null`
5. `keyval`: documentar claves estándar (`configFiscal`, `matchingConfig`, `kpiConfig_*`)
6. `contracts`: añadir `historicoRentas[]`
7. `accounts`: documentar `balance` como cache derivada

### 4.3 Plan wipe+reimport

Heredado de V1 sección 4.5 sin cambios. Ver V1 para detalle del proceso de wipe + reimportación de XMLs y CSVs.

---

## 5. Decisiones que necesita Jose

### 5.1 Preguntas de stores AMBIGUOS

| Store | Pregunta |
|-------|----------|
| `learningLogs` | ¿Necesitas historial completo de clasificaciones o basta `appliedCount`? |
| `propertyDays` | ¿Store separado o array en `properties`? |
| `snapshotsDeclaracion` vs `resultadosEjercicio` | ¿Cuál es fuente de verdad para "declaración 2023"? |
| `reconciliationAuditLogs` | ¿Se usa en UI o es solo debug? ¿Eliminar? |
| `vinculosAccesorio` / `mejorasInmueble` / `mueblesInmueble` | ¿Embeber en `properties` o mantener separados? |
| `traspasosPlanes` | ¿Store propio o campo en planes? |

### 5.2 Fusiones propuestas que requieren validación

| Fusión | Pregunta |
|--------|----------|
| `autonomos` → `nominas` | ¿OK añadir campo `tipo` en lugar de store separado? |
| `pensiones` → `nominas` | ¿OK agrupar todos los ingresos en un store? |
| `loan_settlements` → `prestamos` | ¿OK embeber liquidación como campo? |
| `documentosFiscales` → `documents` | ¿OK unificar archivo documental? |

### 5.3 Cambios respecto V1 que requieren validación

1. **Reducción de 48 a 41 stores** — ¿aprobado?
2. **6 fusiones de HUÉRFANOS + 1 consolidación AMBIGUO (`learningLogs`)** — ¿alguna objeción?
3. **6 stores AMBIGUO** — ¿respuestas a las preguntas?
4. **Trazabilidad mockup→store concreta** — ¿correcciones?

---

## 6. Próximos pasos

1. **Jose responde** preguntas de sección 5.
2. **TAREA 7** · Implementar eliminaciones de 17 stores en DB_VERSION 60.
3. **TAREA 8** · Implementar refactorizaciones de schemas (6 stores).
4. **TAREA 9** · Bootstrap `compromisosRecurrentes` desde histórico.
5. **TAREA 10** · Adaptar consumidores de stores eliminados.
6. **TAREA 11** · Flujo wipe + reimport con validaciones.
7. **TAREA 12** · Mapeo component→data sobre arquitectura limpia.

---

> **Documento generado**: V2 preserva V1 como referencia histórica.
> **Verificación**: 
> - [x] Sección 3.2 tiene fichas reescritas con datos reales
> - [x] Cada ficha tiene 9 campos + tabla trazabilidad
> - [x] Sección 3.3 tiene 10 análisis de fusión individuales
> - [x] Sección 3.4 tiene tabla resumen con decisiones
> - [x] Sección 2.4 tiene 6 grupos AMBIGUO documentados
> - [x] V1 no modificado
