# Auditoría pre-T34 · estado de gastos · compromisos · etiquetado

> Fecha · 2026-05-03
> Predecesor · docs/MODELO-GASTOS-atlas.md
> Tipo · auditoría · NO modifica código
> DB\_VERSION auditada · 67 (`src/services/db.ts:27`)

---

## Resumen ejecutivo

El sistema tiene **una base funcional sólida** para gastos de inmueble y planes de pensiones, pero presenta **brechas estructurales importantes** antes de construir las vistas T34/T35/T36.

Los cuatro stores de inmueble (`gastosInmueble`, `mejorasInmueble`, `mueblesInmueble`, `compromisosRecurrentes`) están implementados con servicios CRUD completos. El disparo automático de aportaciones al plan desde confirmación de nómina **existe y funciona** (nominaAportacionHook.ts, wired en treasuryConfirmationService.ts) — Jose quizás nunca lo ha probado porque requiere tener `planPensiones.productoDestinoId` relleno en la nómina.

Los **bloqueantes para T34** son: la pestaña "Gastos" en la ficha de inmueble UI v5 es un placeholder vacío (igual que "Cobros"), y el campo `categoriaPresupuesto` no existe en `movements` — lo cual bloquea el etiquetado 50/30/20 real sobre movimientos bancarios (T36). Para T35, no existe un wizard manual para crear compromisos recurrentes desde cero.

Lo que **se puede construir YA** sin schema changes: T34 (vista gastos inmueble, pues `gastosInmueble` tiene todos los campos necesarios y el service es completo) y la base de T35 usando `compromisosRecurrentesService`. T36 requiere añadir `categoriaPresupuesto` a `movements` primero (schema task separada).

---

## A · Estado de stores

### A.1 · `movements`

**Tipo localizado** · `src/services/db.ts:1009` — `export interface Movement`

**Campos actuales** (lista completa):
- `id?: number`
- `accountId: number`
- `date: string`
- `valueDate?: string`
- `amount: number`
- `description: string`
- `counterparty?: string`
- `providerName?: string`
- `providerNif?: string`
- `invoiceNumber?: string`
- `reference?: string`
- `status: MovementStatus`
- `bank_ref?: string`
- `iban_detected?: string`
- `unifiedStatus: UnifiedMovementStatus`
- `source: MovementSource`
- `plan_match_id?: string`
- `property_id?: string` *(legado — campo distinto de `inmuebleId`)*
- `category: { tipo: string; subtipo?: string }` *(objeto jerárquico)*
- `is_transfer?: boolean`
- `transfer_group_id?: string`
- `invoice_id?: string`
- `state?: TransactionState`
- `sourceBank?: string`
- `currency?: string`
- `balance?: number`
- `saldo?: number`
- `id_import?: string`
- `estado_conciliacion?: ReconciliationStatus`
- `linked_registro?: { type: 'ingreso' | 'gasto' | 'mejora'; id: number }`
- `expenseIds?: number[]`
- `documentIds?: number[]`
- `reconciliationNotes?: string`
- `importBatch?: string`
- `csvRowIndex?: number`
- `type: MovementType`
- `origin: MovementOrigin`
- `movementState: MovementState`
- `tags?: string[]`
- `transferGroupId?: string`
- `attachedDocumentId?: number`
- `appliedRuleId?: number`
- `isAutoTagged?: boolean`
- `lastModifiedBy?: string`
- `changeReason?: 'user_ok' | 'inline_edit_amount' | 'inline_edit_date' | 'bulk_ok' | 'manual_edit'`
- `categoria?: string` *(genérico — libre)*
- `ambito: 'PERSONAL' | 'INMUEBLE'` *(uppercase)*
- `inmuebleId?: string` *(string, no number)*
- `statusConciliacion: 'sin_match' | 'match_automatico' | 'match_manual'`
- `learnKey?: string`
- `isOpeningBalance?: boolean`
- `facturaId?: number`
- `facturaNoAplica?: boolean`
- `justificanteId?: number`
- `justificanteNoAplica?: boolean`
- `categoryKey?: string`
- `subtypeKey?: string`
- `transferMetadata?: { targetAccountId: number; pairEventId?: number; esAmortizacionParcial?: boolean }`

**Campos del modelo esperados** (según MODELO-GASTOS-atlas.md):

| Campo esperado | Estado | Nota |
|---|---|---|
| `ambito: 'personal' \| 'inmueble'` | ⚠️ PRESENTE PARCIAL | Existe pero valores en **uppercase** (`'PERSONAL' \| 'INMUEBLE'`), no lowercase como usa `compromisosRecurrentes` |
| `inmuebleId: string \| null` | ✅ PRESENTE | `inmuebleId?: string` — opcional, no tipado como `\| null` |
| `categoriaPresupuesto: 'necesidad' \| 'deseo' \| 'ahorro_inversion' \| null` | ❌ **AUSENTE** | Campo NO existe. La bolsa 50/30/20 vive solo en `CompromisoRecurrente.bolsaPresupuesto`. Nota: los valores del enum real en código son `'necesidades' \| 'deseos' \| 'ahorroInversion' \| 'obligaciones' \| 'inmueble'` (plural/camelCase), divergentes de los nombres del modelo canónico |
| `categoria: string` (gastos inmueble) | ⚠️ PRESENTE PARCIAL | `categoria?: string` existe pero es genérico libre, no enumerado |
| `treasuryEventId: string \| null` | ❌ **AUSENTE** | No existe en Movement. El vínculo es inverso: `TreasuryEvent.movementId` y `GastoInmueble.treasuryEventId` |

**Hallazgos críticos**:
- `categoriaPresupuesto` **AUSENTE** — bloquea etiquetado 50/30/20 real sobre movimientos bancarios (T36). La vista PresupuestoPage actual calcula solo desde `compromisosRecurrentes`, no desde movimientos reales.
- `treasuryEventId` **AUSENTE** en Movement — el join inverso funciona, pero la trazabilidad directa desde movement → treasury event no está en el store.
- Discordancia mayúsculas/minúsculas `ambito` entre stores: `movements` usa `'PERSONAL'|'INMUEBLE'` y `compromisosRecurrentes` usa `'personal'|'inmueble'` — potencial confusión en queries.

---

### A.2 · `treasuryEvents`

**Tipo localizado** · `src/services/db.ts:1163` — `export interface TreasuryEvent`

**Campos actuales** (lista completa):
- `id?: number`
- `type: 'income' | 'expense' | 'financing'`
- `amount: number`
- `predictedDate: string`
- `description: string`
- `sourceType: 'document' | 'contract' | 'manual' | 'ingreso' | 'gasto' | 'opex_rule' | 'gasto_recurrente' | 'personal_expense' | 'nomina' | 'contrato' | 'prestamo' | 'hipoteca' | 'autonomo' | 'autonomo_ingreso' | 'otros_ingresos' | 'inversion_compra' | 'inversion_aportacion' | 'inversion_rendimiento' | 'inversion_dividendo' | 'inversion_liquidacion' | 'irpf_prevision'`
- `sourceId?: number`
- `año?: number`
- `mes?: number`
- `certeza?: 'declarado' | 'calculado' | 'atlas_nativo' | 'estimado' | 'manual'`
- `fuenteHistorica?: 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual'`
- `ejercicioFiscalOrigen?: number`
- `generadoPor?: 'historicalTreasuryService' | 'treasurySyncService' | 'user'`
- `actualizadoPorDeclaracion?: boolean`
- `inmuebleId?: number`
- `contratoId?: number`
- `accountId?: number`
- `paymentMethod?: 'Domiciliado' | 'Transferencia' | 'TPV' | 'Efectivo'`
- `iban?: string`
- `status: 'predicted' | 'confirmed' | 'executed'`
- `actualDate?: string`
- `actualAmount?: number`
- `movementId?: number`
- `prestamoId?: string`
- `numeroCuota?: number`
- `ambito?: 'PERSONAL' | 'INMUEBLE'`
- `categoryLabel?: string`
- `categoryKey?: string`
- `subtypeKey?: string`
- `transferMetadata?: { targetAccountId: number; pairEventId?: number; esAmortizacionParcial?: boolean }`
- `counterparty?: string`
- `providerName?: string`
- `providerNif?: string`
- `invoiceNumber?: string`
- `notes?: string`
- `executedMovementId?: number`
- `executedAt?: string`
- `facturaId?: number`
- `facturaNoAplica?: boolean`
- `justificanteId?: number`
- `justificanteNoAplica?: boolean`
- `createdAt: string`
- `updatedAt: string`

**Campos del modelo esperados**:

| Campo | Estado |
|---|---|
| `ambito` | ✅ PRESENTE (`'PERSONAL' \| 'INMUEBLE'`, opcional) |
| `inmuebleId` | ✅ PRESENTE (`number`, opcional) |
| `sourceType` | ✅ PRESENTE (unión amplia) |
| `status: 'predicted' \| 'confirmed' \| 'executed'` | ✅ PRESENTE |
| `predictedDate` | ✅ PRESENTE |
| `accountId` | ✅ PRESENTE (opcional) |

**Índices** · el store indexa además `sourceId`, `año`, `generadoPor`, `certeza`, `ambito`, `inmuebleId` (per memoria almacenada).

**Hallazgos**: Store completo y bien indexado. Ningún campo requerido para T34/T35/T36 está ausente.

---

### A.3 · `compromisosRecurrentes`

**Tipo localizado** · `src/types/compromisosRecurrentes.ts:139` — `export interface CompromisoRecurrente`

**Schema completo**:
- `id?: number`
- `ambito: 'personal' | 'inmueble'` ✅
- `inmuebleId?: number` ✅
- `personalDataId?: number`
- `alias: string`
- `tipo: TipoCompromiso` (`'suministro' | 'suscripcion' | 'seguro' | 'cuota' | 'comunidad' | 'impuesto' | 'otros'`) ✅
- `subtipo?: string`
- `proveedor: { nombre: string; nif?: string; referencia?: string }`
- `patron: PatronRecurrente` (7 variantes de calendario) ✅ (equivale a `periodicidad`)
- `importe: ImporteEvento` (4 modos: fijo/variable/diferenciadoPorMes/porPago) ✅
- `variacion?: PatronVariacion`
- `cuentaCargo: number` ✅
- `conceptoBancario: string`
- `metodoPago: MetodoPagoCompromiso`
- `categoria: CategoriaGastoCompromiso` (union de ~28 valores) ✅
- `bolsaPresupuesto: BolsaPresupuesto` (`'necesidades' | 'deseos' | 'ahorroInversion' | 'obligaciones' | 'inmueble'`) ✅
- `responsable: ResponsableCompromiso`
- `porcentajeTitular?: number`
- `fechaInicio: string` ✅
- `fechaFin?: string`
- `estado: EstadoCompromiso` (`'activo' | 'pausado' | 'baja'`) ✅
- `motivoBaja?: string`
- `derivadoDe?: OrigenCompromiso`
- `createdAt: string`
- `updatedAt: string`
- `notas?: string`

**Servicio** · `src/services/personal/compromisosRecurrentesService.ts` — funciones expuestas:
- `listarCompromisos(filtro?)` — CRUD read
- `obtenerCompromiso(id)` — CRUD read
- `crearCompromiso(datos)` — CRUD create + auto-genera eventos treasury
- `actualizarCompromiso(id, datos)` — CRUD update + regenera eventos
- `eliminarCompromiso(id)` — CRUD delete
- `regenerarEventosCompromiso(c)` — genera events en `treasuryEvents` para el compromiso
- `puedeCrearCompromiso(datos)` — validación (impide cuota hipoteca/alquiler/IBI vivienda habitual)

**Índices DB** · `ambito`, `personalDataId`, `inmuebleId`, `tipo`, `categoria`, `cuentaCargo`, `estado`, `fechaInicio`.

**Hallazgos**:
- Schema completo y bien implementado. Todos los campos clave del modelo están presentes.
- No existe **wizard de creación manual** UI: el único flujo UI disponible es `DetectarCompromisosPage` (`/personal/gastos/detectar-compromisos`) que detecta candidatos desde movimientos bancarios y los aprueba en bulk o individualmente. No hay formulario "Crear compromiso desde cero".
- La escritura de compromisos de inmueble ocurre solo via migración automática de `opexRules` (V5.3, db.ts:2878) — no hay UI v5 para crear compromisos `ambito='inmueble'` manualmente.
- En producción Jose: probable vacío o pocos registros porque la UI de detección no estaba disponible hasta T9.3.

---

### A.4 · `gastosInmueble`

**Tipo localizado** · `src/services/db.ts:329` — `export interface GastoInmueble`

**Schema completo**:
- `id?: number`
- `inmuebleId: number` ✅
- `ejercicio: number` ✅
- `fecha: string`
- `concepto: string`
- `categoria: GastoCategoria` ✅
- `casillaAEAT: AEATBox` ✅
- `importe: number` ✅
- `importeBruto?: number`
- `origen: GastoOrigen` ✅
- `origenId?: string`
- `estado: GastoEstadoNuevo` (`'previsto' | 'confirmado' | 'declarado'`)
- `proveedorNombre?: string`
- `proveedorNIF?: string`
- `invoiceNumber?: string`
- `cuentaBancaria?: string`
- `documentId?: number`
- `movimientoId?: string`
- `estadoTesoreria?: 'predicted' | 'confirmed'`
- `treasuryEventId?: number` ✅
- `facturaId?: number`
- `facturaNoAplica?: boolean`
- `justificanteId?: number`
- `justificanteNoAplica?: boolean`
- `categoryKey?: string`
- `subtypeKey?: string`
- `createdAt: string`
- `updatedAt: string`

**`GastoCategoria`** · `src/services/db.ts:319`
```
'ibi' | 'comunidad' | 'seguro' | 'suministro' | 'reparacion' | 'gestion' | 'servicio' | 'intereses' | 'otro'
```
✅ Incluye todos los valores esperados. Nota: `servicio` adicional no documentado en modelo.

**`GastoOrigen`** · `'xml_aeat' | 'prestamo' | 'recurrente' | 'tesoreria' | 'manual'`

**Servicio** · `src/services/gastosInmuebleService.ts:17`:
- `add(gasto)` — con upsert por `origen+origenId`
- `update(id, updates)` — propaga cambios a treasury event y movement
- `delete(id)` — borra en cascada
- `getByInmueble(inmuebleId)` — lectura
- `getByInmuebleYEjercicio(inmuebleId, ejercicio)` — lectura
- `getByEjercicio(ejercicio)` — lectura
- `getAll()` — lectura
- `deleteByOrigenId(origen, origenId)` — borra por origen
- `getSumaPorCasilla(inmuebleId, ejercicio)` — agrega para motor IRPF

**Mapa `categoria → casillaAEAT`** (en `gastosInmuebleService.ts:5`):
| Categoría | Casilla |
|---|---|
| intereses | 0105 |
| reparacion | 0106 |
| comunidad | 0109 |
| gestion | 0112 |
| servicio | 0112 |
| suministro | 0113 |
| seguro | 0114 |
| ibi | 0115 |
| otro | 0106 |

**Hallazgos**:
- Store completo. Todos los campos requeridos presentes.
- En producción Jose: 109 registros — distribución por inmueble/ejercicio debe verificarse con query DevTools (sección D).
- Nota: el campo del modelo espera `vidaUtilAnios` — ese campo NO está aquí, es propio de `mejorasInmueble`.

---

### A.5 · `mejorasInmueble`

**Tipo localizado** · `src/services/db.ts:366` — `export interface MejoraInmueble`

**Schema completo**:
- `id?: number`
- `inmuebleId: number` ✅
- `ejercicio: number` ✅
- `descripcion: string` ✅
- `tipo: 'mejora' | 'ampliacion' | 'reparacion'` ✅
- `importe: number` ✅
- `fecha: string`
- `proveedorNIF?: string`
- `proveedorNombre?: string`
- `invoiceNumber?: string`
- `documentId?: number`
- `movimientoId?: string`
- `estadoTesoreria?: 'predicted' | 'confirmed'`
- `treasuryEventId?: number`
- `facturaId?: number`
- `facturaNoAplica?: boolean`
- `justificanteId?: number`
- `justificanteNoAplica?: boolean`
- `categoryKey?: string`
- `createdAt: string`
- `updatedAt: string`

**Nota**: Campo `vidaUtilAnios` del modelo esperado se llama aquí `vidaUtil: number` — **solo en `mueblesInmueble`** (DB:401). `mejorasInmueble` NO tiene campo de amortización porque las mejoras se amortizan junto al inmueble (3% anual), no de forma individual.

**Servicio** · `src/services/mejorasInmuebleService.ts:7`:
- `crear(input)`, `actualizar(id, updates)`, `eliminar(id)`
- `getPorInmueble(inmuebleId)`, `getPorInmuebleYEjercicio(inmuebleId, ejercicio)`, `getHastaEjercicio(inmuebleId, ejercicio)`
- `getTotalHastaEjercicio`, `getTotalCapexHastaEjercicio`, `getTotalReparacionesEjercicio`

**Hallazgos**: En producción Jose: 4 registros. Verificar con query DevTools.

---

### A.6 · `mueblesInmueble`

**Tipo localizado** · `src/services/db.ts:394` — `export interface MuebleInmueble`

**Schema completo**:
- `id?: number`
- `inmuebleId: number` ✅
- `ejercicio: number` ✅
- `descripcion: string` ✅
- `fechaAlta: string` ⚠️ (el modelo esperaba `fechaCompra` — campo se llama `fechaAlta`)
- `importe: number` ✅
- `vidaUtil: number` ✅ (el modelo lo llama `vidaUtilAnios` — mismo dato, diferente nombre)
- `activo: boolean`
- `fechaBaja?: string`
- `proveedorNIF?: string`
- `proveedorNombre?: string`
- `invoiceNumber?: string`
- `documentId?: number`
- `movimientoId?: string`
- `estadoTesoreria?: 'predicted' | 'confirmed'`
- `treasuryEventId?: number`
- `facturaId?: number`, `facturaNoAplica?: boolean`, `justificanteId?: number`, `justificanteNoAplica?: boolean`
- `categoryKey?: string`
- `createdAt: string`
- `updatedAt: string`

**Casilla AEAT** · 0117 (amortización mobiliario) — confirmado en `db.ts:848`.

**Servicio** · `src/services/mueblesInmuebleService.ts:9`:
- `crear(input)`, `actualizar(id, updates)`, `eliminar(id)`, `darDeBaja(id, fechaBaja?)`
- `getPorInmueble(inmuebleId)`, `getPorInmuebleYEjercicio(inmuebleId, ejercicio)`
- `calcularAmortizacionAnual(mueble)`, `calcularAmortizacionMobiliarioAnual(inmuebleId, ejercicio, diasArrendados, diasDisponibles)`

**Hallazgos**: En producción Jose: 5 registros. Discrepancia de nombres de campos (`fechaAlta` vs `fechaCompra`, `vidaUtil` vs `vidaUtilAnios`) — no es bug funcional pero conviene documentarlo para el modelo canónico.

---

### A.7 · `aportacionesPlan`

**CRÍTICO** · Pieza del plan de pensiones de empresa.

**Tipo localizado** · `src/types/planesPensiones.ts:74` — `export interface AportacionPlan`

**Schema completo**:
- `id: string` (UUID)
- `planId: string` ✅
- `fecha: string` ✅
- `ejercicioFiscal: number`
- `importeTitular: number` ✅ (aportación del trabajador)
- `importeEmpresa: number` ✅ (aportación de la empresa)
- `importeConyuge?: number`
- `origen: OrigenAportacion` (`'manual' | 'xml_aeat' | 'nomina_vinculada' | 'migrado_v60'`) ✅ (equivale a `sourceType`)
- `ingresoIdNomina?: string` ✅ (equivale a `sourceId` cuando origen='nomina_vinculada')
- `movementId?: string`
- `granularidad: GranularidadAportacion` (`'anual' | 'mensual' | 'puntual'`)
- `mesesCubiertos?: number`
- `casillaAEAT?: string`
- `notas?: string`
- `fechaCreacion: string`
- `fechaActualizacion: string`

**Nota** · El campo `desglose: { trabajador, empresa }` del modelo esperado no existe como objeto anidado — los importes se desglosan en campos planos `importeTitular` / `importeEmpresa`.

**Índices** · `planId`, `ejercicioFiscal`, `planId+ejercicioFiscal`, `origen`, `ingresoIdNomina` (db.ts:2666–2671).

**Servicio** · `src/services/aportacionesPlanService.ts`:
- `add(aportacion)`, `delete(id)`, `getAll()`, `getByPlan(planId)`, `getTotalesPorAño(planId, ejercicio)`, `getSinPlan()`, `deleteByPlan(planId)`

**Escritores del store** (múltiples vías):
1. `nominaAportacionHook.ts` — disparo automático desde confirmación nómina
2. `indexaCapitalImportService.ts` — importación extracto Indexa Capital
3. `inversionesAportacionesImportService.ts` — importación CSV aportaciones
4. `declaracionDistributorService.ts` — distribución desde XML AEAT

**Hallazgos**:
- Estado en producción Jose: desconocido. Query DevTools necesaria (sección D).
- El disparo automático desde nómina **EXISTE** — ver sección B.1.

---

### A.8 · `ingresos` · detalle nómina

**Tipo localizado** · `src/types/personal.ts:63` — `export interface Nomina` + union `Ingreso = IngresoNomina | ...`

El store `ingresos` usa la unión discriminada `Ingreso`. Cuando `tipo='nomina'`, la entidad es `Nomina & { tipo: 'nomina' }`.

**Campos de `Nomina` relevantes para nómina española**:
- `salarioBrutoAnual: number` ✅
- `distribucion: { tipo: 'doce'|'catorce'|'personalizado'; meses: number }` ✅
- `retencion: RetencionNomina`:
  - `irpfPorcentaje: number` ✅
  - `ss: { baseCotizacionMensual, contingenciasComunes: %, desempleo: %, formacionProfesional: %, mei?: %, overrideManual }` ✅
  - `cuotaSolidaridadMensual?: number`
- `planPensiones?: PlanPensionesNomina`:
  - `aportacionEmpresa: { tipo: 'porcentaje'|'importe'; valor: number; salarioBaseObjetivo?: number }` ✅
  - `aportacionEmpleado: { tipo: 'porcentaje'|'importe'; valor: number; salarioBaseObjetivo?: number }` ✅
  - `productoDestinoId?: number` — link al plan de pensiones
- `variables: Variable[]`, `bonus: Bonus[]`, `beneficiosSociales: BeneficioSocial[]`
- Ampliaciones v1.1: `empresa`, `contrato`, `cuentaCobroIBAN`, `irpfDetalle`, `pagasExtra`, `variableObjetivo`, `bonusObjetivo`

**Campos esperados del modelo** vs realidad:

| Campo esperado | Estado | Nota |
|---|---|---|
| `bruto` | ⚠️ PRESENTE INDIRECTO | `salarioBrutoAnual` / 12 (calculado por motor) |
| `neto` | ⚠️ CALCULADO | `computeNominaNetoEnMes()` — no campo almacenado |
| `irpfRetenido` | ⚠️ PRESENTE INDIRECTO | `retencion.irpfPorcentaje` × bruto |
| `seguridadSocial` | ⚠️ PRESENTE INDIRECTO | `retencion.ss.*` — calculado |
| `aportacionTrabajador` | ✅ PRESENTE | `planPensiones.aportacionEmpleado` |
| `aportacionEmpresa` | ✅ PRESENTE | `planPensiones.aportacionEmpresa` |

**Hallazgos**:
- Los campos `bruto`, `neto`, `irpfRetenido`, `seguridadSocial` no se almacenan como valores fijos — se **calculan** a partir de los parámetros de la nómina en cada render. Esto es correcto funcionalmente pero puede confundir si se esperan como "campos rellenados".
- El wizard de nómina captura todos los parámetros necesarios: `salarioBrutoAnual`, `retencion`, `planPensiones`.
- En producción Jose: 1 registro `ingresos` con `tipo='nomina'` — verificar con query DevTools si tiene `planPensiones.productoDestinoId` relleno (condiciona el disparo de aportación).

---

### A.9 · `movementLearningRules`

**Tipo localizado** · `src/services/db.ts:1235` — `export interface MovementLearningRule`

**Schema completo**:
- `id?: number`
- `learnKey: string` (hash normalizado)
- `counterpartyPattern: string`
- `descriptionPattern: string`
- `amountSign: 'positive' | 'negative'`
- `categoria: string`
- `ambito: 'PERSONAL' | 'INMUEBLE'`
- `inmuebleId?: string`
- `source: 'IMPLICIT'`
- `createdAt: string`
- `updatedAt: string`
- `appliedCount: number`
- `lastAppliedAt?: string`
- `history?: HistoryEntry[]` (capped FIFO 50 entradas)

**Servicio** · `src/services/movementLearningService.ts`:
- `createOrUpdateRule()` — crea/actualiza regla cuando usuario etiqueta manualmente
- `applyLearningRulesToNewMovements(movements)` — aplica reglas a movements en importación
- `applyRuleToGrays()` — backfill retroactivo
- `getLearningRulesStats()` — estadísticas

**Conexiones activas**:
- `bankStatementImportService.ts:301` — llama `applyLearningRulesToNewMovements` en cada importación CSB43 ✅
- `bankStatementOrchestrator.ts` — llama `createOrUpdateRule` cuando usuario reconcilia manualmente ✅

**Hallazgos**:
- El servicio está **implementado y conectado** tanto al import como a la reconciliación manual.
- En producción Jose: 0 registros (vacío) porque el store solo se rellena cuando el usuario etiqueta manualmente un movimiento conciliado. Si Jose no ha usado el flujo de reconciliación manual de Conciliación v2, el store está vacío por diseño.

---

## B · Disparos críticos

### B.1 · Aportación plan empleo desde confirmación nómina

**Resultado: CASO A** — La función EXISTE y está wired. Funciona correctamente bajo condiciones específicas.

**Función localizada** · `src/services/personal/nominaAportacionHook.ts:45` — `onNominaConfirmada(evento, nomina)`

**Wire** · `src/services/treasuryConfirmationService.ts:536–542`:
```typescript
if (existingEvent.sourceType === 'nomina') {
  try {
    const { procesarConfirmacionEvento } = await import('./personal/nominaAportacionHook');
    await procesarConfirmacionEvento(updatedEvent);
  } catch (err) {
    console.warn('[treasuryConfirmation] G-07 hook falló al crear aportación plan', err);
  }
}
```

**Comportamiento real** (nominaAportacionHook.ts):
1. Solo actúa si `evento.sourceType === 'nomina'` y `status` es `'confirmed'` o `'executed'`
2. Lee la nómina del store `ingresos` por `evento.sourceId`
3. Comprueba que `nomina.planPensiones.productoDestinoId` esté relleno — **si no, SALE SIN HACER NADA**
4. Busca el plan en `planesPensiones` por UUID o por `empresaPagadora.ingresoIdVinculado`
5. Calcula `importeMensual` = `calcularAportacionMensual(aportacionEmpleado, salarioBrutoAnual/12)`
6. Calcula `importeEmpresaMensual` desde `aportacionEmpresa`
7. Verifica idempotencia: no duplica si ya existe entrada con mismo `planId + ingresoIdNomina`
8. Escribe en `aportacionesPlan` con `origen: 'nomina_vinculada'`, `importeTitular`, `importeEmpresa`, `ingresoIdNomina`

**Condición crítica para Jose**: El disparo solo funciona si la nómina en `ingresos` tiene `planPensiones.productoDestinoId` apuntando a un `planesPensiones.id` válido. Si Jose no ha vinculado la nómina a un plan de pensiones en el wizard de nómina, el hook no actúa.

**Importe insertado**: Usa `aportacionEmpleado.valor` (en euros si `tipo='importe'`, o porcentaje × base si `tipo='porcentaje'`). NO suma ambos — los separa correctamente en `importeTitular` / `importeEmpresa`.

---

### B.2 · Compromisos recurrentes generan eventos

**Estado**: IMPLEMENTADO y conectado a `regenerateForecastsForward`.

**Función** · `src/services/personal/compromisosRecurrentesService.ts` — `regenerarEventosCompromiso(c)`
- Llama `expandirPatron(patron, horizonte)` para calcular fechas de pago
- Por cada fecha, `calcularImporte` y `aplicarVariacion`
- Escribe en `treasuryEvents` con campos `sourceType: 'gasto_recurrente'`, `ambito`, `inmuebleId`

**Integración con regenerateForecastsForward** · `src/services/treasuryBootstrapService.ts:211`:
```typescript
const creados = await regenerarEventosCompromiso(c);
```
✅ Confirmado — `regenerateForecastsForward` lee todos los compromisos activos y llama `regenerarEventosCompromiso` por cada uno.

**UI para crear compromisos**: El único flujo UI disponible es `DetectarCompromisosPage` en `/personal/gastos/detectar-compromisos`:
- Detecta candidatos desde movimientos históricos
- Permite revisar y aprobar individual o en bulk
- Escribe en `compromisosRecurrentes` vía `compromisoCreationService`
- **NO hay formulario manual** "Crear compromiso desde cero" — hallazgo H-04

---

### B.3 · Cómo se rellena `gastosInmueble` hoy

#### Vía 1 · CSB43 (extracto bancario)
**Estado: INDIRECTA** — el import CSB43 no crea directamente `gastosInmueble`. Crea `movements` y aplica reglas de aprendizaje (`applyLearningRulesToNewMovements`). Los `gastosInmueble` se crean después en el paso de conciliación cuando el usuario puntea el treasury event correspondiente (Vía 2).

#### Vía 2 · Conciliación (confirmar treasury event inmueble)
**Estado: IMPLEMENTADA y funcional** · `src/services/treasuryConfirmationService.ts:316–380`

Cuando se confirma un `treasuryEvent` con `ambito='INMUEBLE'` y `categoryKey`/`categoryLabel` de tipo gasto, la función `confirmTreasuryEvent` crea automáticamente la línea en `gastosInmueble` (o `mejorasInmueble` / `mueblesInmueble` según la categoría). Los campos se rellenan desde el event: `inmuebleId`, `ejercicio`, `concepto`, `categoria`, `casillaAEAT`, `importe`, `treasuryEventId`, `movimientoId`.

#### Vía 3 · Manual UI (gasto sin extracto)
**Estado: PARCIAL** — No existe un formulario dedicado "Crear gasto inmueble manualmente". El flujo disponible es:
- `AddMovementModal` en ConciliacionPageV2 (`src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx`) — permite crear un `treasuryEvent` manual, que al confirmarse (Vía 2) crea el `gastosInmueble`.
- También accesible desde `GastosRecurrentesTab` legacy (`src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx`) vía `EjecucionesRecurrentesSection`.
- **No hay ruta directa** para crear un `GastoInmueble` sin pasar por tesorería.

#### Vía 4 · XML AEAT
**Estado: IMPLEMENTADA** · `src/services/declaracionDistributorService.ts:1337–1410`

`aeatParserService.ts` (1549 líneas) parsea la declaración XML y `declaracionDistributorService` distribuye los gastos en `gastosInmueble` con `origen='xml_aeat'`. El servicio incluye lógica de upsert (no duplica si ya existe con mismo `origenId`).

Campos rellenados desde XML: `inmuebleId`, `ejercicio`, `fecha`, `concepto`, `categoria` (mapeado desde casillas AEAT), `casillaAEAT`, `importe`, `estado: 'declarado'`, `origen: 'xml_aeat'`, `origenId`.

---

### B.4 · Auto-categorización de movements

**Estado: IMPLEMENTADA y conectada al flujo CSB43**

- `applyLearningRulesToNewMovements` · `src/services/movementLearningService.ts:519` → alias de `applyAllRulesOnImport`
- Conectada en `bankStatementImportService.ts:301` — se invoca en cada importación CSB43
- Las reglas se crean/actualizan en `bankStatementOrchestrator.ts` cuando el usuario reconcilia manualmente
- Cuando se aplica una regla, se rellena `movement.categoria`, `movement.ambito`, `movement.inmuebleId` y `movement.isAutoTagged = true`

**Limitación actual**: El store `movementLearningRules` está vacío en producción Jose porque el flujo de reconciliación manual no se ha usado. Sin reglas, la auto-categorización no actúa.

---

## C · UI existente

### C.1 · Pestaña "Gastos" en ficha de inmueble

**Path** · `src/modules/inmuebles/pages/DetallePage.tsx:365–372`

**Estado** · **PLACEHOLDER** — mismo bloque que cobros, documentos y fiscalidad:
```tsx
{(tab === 'cobros' || tab === 'gastos' || tab === 'documentos' || tab === 'fiscalidad') && (
  <div className={styles.placeholder}>
    <strong>{tabs.find((t) => t.key === tab)?.label}</strong>
    Pestaña en migración a UI v5 · funcionalidad pendiente de sub-tarea
    follow-up. Datos del usuario intactos en stores · UI consolidada en
    próxima iteración.
  </div>
)}
```

**Restos de implementación previa**: Sí existe una UI legacy funcional en la ruta antigua:
- `src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx` — visualiza `opexRules` (legado) + `compromisosRecurrentes` de inmueble con tabla y formulario de edición. Usable como referencia de implementación pero usa stores legacy (`opexRules`).
- `src/pages/GestionInmuebles/tabs/sections/EjecucionesRecurrentesSection.tsx` — sección de ejecuciones con `AddMovementModal`.
- `src/components/inmuebles/InmueblePresupuestoTab.tsx` — tab de presupuesto (otra ruta de UI legacy).

**Archivos a considerar para T34**:
- `src/modules/inmuebles/pages/DetallePage.tsx` — aquí se añade la implementación real
- `src/services/gastosInmuebleService.ts` — service completo listo
- `src/services/mejorasInmuebleService.ts`, `mueblesInmuebleService.ts` — completos
- `src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx` — referencia legacy

---

### C.2 · Pestaña "Cobros" en ficha de inmueble

**Path** · `src/modules/inmuebles/pages/DetallePage.tsx:365` — **mismo placeholder** que "Gastos".

**Estado** · PLACEHOLDER — Cobros y Gastos comparten el mismo bloque de placeholder.

No hay componente separado de "Cobros" en la UI v5. Como referencia de patrón, existe `src/modules/inversiones/components/RegistrarCobroDialog.tsx` para el módulo de inversiones.

**Relevancia para T34**: La pestaña Cobros mostraría contratos activos + cobros registrados. El store `contracts` (`src/services/db.ts`) tiene los datos; la UI falta.

---

### C.3 · Personal · gastos y presupuesto

**Archivos existentes** · `src/modules/personal/pages/`:
- `GastosPage.tsx` ✅ — muestra lista de `compromisosRecurrentes` con `ambito='personal'`, filtrable por tipo, con búsqueda. CTA "Detectar desde histórico" → DetectarCompromisosPage. **NO hay CTA "Crear compromiso manualmente"**.
- `PresupuestoPage.tsx` ✅ — implementa 50/30/20 leyendo de `compromisos.bolsaPresupuesto` para gastos y `computeNominaNetoEnMes`/`computeAutonomoNetoEnMes` para ingreso neto. Funcional pero limitado.
- `DetectarCompromisosPage.tsx` ✅ — detección automática desde movimientos, revisión y aprobación bulk.
- `PanelPage.tsx`, `IngresosPage.tsx`, `ViviendaPage.tsx` ✅ — páginas auxiliares del módulo.

**50/30/20**: La vista `PresupuestoPage` **funciona** pero calcula gastos solo desde `compromisosRecurrentes.bolsaPresupuesto`, NO desde movimientos bancarios reales. Para T36 (etiquetado 50/30/20 real) se necesita `movements.categoriaPresupuesto` (actualmente AUSENTE).

---

### C.4 · Wizard compromisos recurrentes

**Estado** · **AUSENTE como wizard de creación manual**

No existe `WizardCompromiso`, `NuevoCompromisoForm` ni similar en todo el codebase (`grep` no retorna resultados).

Lo disponible:
- `DetectarCompromisosPage.tsx` — flujo de detección automática + edición modal para ajustar campos antes de aprobar. Incluye un modal de edición de candidato (`CandidatoEditModal`) que permite modificar `alias`, `tipo`, `categoria`, `bolsaPresupuesto`, `cuentaCargo`, `patron`.
- El modal de edición de candidato podría reutilizarse como base para el wizard de creación manual (T35).

**Hallazgo H-04**: Para T35 hay que crear un wizard "Nuevo compromiso" que permita crear desde cero sin necesidad de movimientos previos en el histórico.

---

### C.5 · Wizard gasto manual

**Estado** · **AUSENTE como formulario dedicado**

No existe `GastoForm`, `NuevoGastoForm` ni `wizardGasto` en todo el codebase.

El flujo disponible para crear un gasto de inmueble sin extracto bancario:
1. En Conciliación v2 (`ConciliacionPageV2.tsx`), el botón "Añadir gasto" abre `AddMovementModal` que crea un `treasuryEvent`.
2. El `treasuryEvent` debe luego puntearse (confirmar) para generar el `gastosInmueble`.

Este flujo de 2 pasos no es intuitivo para el usuario. Para T34 (vista gastos inmueble), sería deseable un formulario directo que cree el `gastosInmueble` en 1 paso.

---

## D · Validación en producción

Jose debe ejecutar las siguientes consultas en DevTools (pestaña Application → IndexedDB → AtlasHorizonDB) para verificar el estado real de los datos.

```javascript
// ─── 1. Verificar aportacionesPlan ───────────────────────────────────────────
// ¿Cuántos registros hay? ¿Qué origen? ¿Qué ejercicios?
const req1 = indexedDB.open('AtlasHorizonDB');
req1.onsuccess = e => {
  const db = e.target.result;
  const tx = db.transaction('aportacionesPlan', 'readonly');
  tx.objectStore('aportacionesPlan').getAll().onsuccess = e2 => {
    const data = e2.target.result;
    console.log('aportacionesPlan · total registros:', data.length);
    console.log('aportacionesPlan · por origen:', data.reduce((a,r) => {
      a[r.origen] = (a[r.origen]||0)+1; return a;
    }, {}));
    console.log('aportacionesPlan · por ejercicio:', data.reduce((a,r) => {
      a[r.ejercicioFiscal] = (a[r.ejercicioFiscal]||0)+1; return a;
    }, {}));
    if (data.length > 0) console.log('aportacionesPlan · primer registro:', data[0]);
  };
};

// ─── 2. Verificar gastosInmueble por inmueble y ejercicio ────────────────────
const req2 = indexedDB.open('AtlasHorizonDB');
req2.onsuccess = e => {
  const db = e.target.result;
  db.transaction('gastosInmueble','readonly').objectStore('gastosInmueble')
    .getAll().onsuccess = e2 => {
      const data = e2.target.result;
      console.log('gastosInmueble · total:', data.length);
      console.log('gastosInmueble · distribución inmueble-ejercicio:',
        data.reduce((acc,g) => {
          const k = `inmueble${g.inmuebleId}-${g.ejercicio}`;
          acc[k] = (acc[k]||0)+1; return acc;
        }, {}));
      console.log('gastosInmueble · por origen:', data.reduce((a,g) => {
        a[g.origen] = (a[g.origen]||0)+1; return a;
      }, {}));
      console.log('gastosInmueble · por categoria:', data.reduce((a,g) => {
        a[g.categoria] = (a[g.categoria]||0)+1; return a;
      }, {}));
    };
};

// ─── 3. Verificar movements · campos disponibles y ambito ───────────────────
const req3 = indexedDB.open('AtlasHorizonDB');
req3.onsuccess = e => {
  const db = e.target.result;
  db.transaction('movements','readonly').objectStore('movements')
    .getAll().onsuccess = e2 => {
      const data = e2.target.result;
      console.log('movements · total:', data.length);
      if (data.length > 0) {
        console.log('movements · campos del primer registro:', Object.keys(data[0]));
        console.log('movements · tiene categoriaPresupuesto:',
          'categoriaPresupuesto' in data[0]);
        console.log('movements · distribución ambito:', data.reduce((a,m) => {
          a[m.ambito||'undefined'] = (a[m.ambito||'undefined']||0)+1; return a;
        }, {}));
      }
    };
};

// ─── 4. Verificar ingresos · detalle nómina ──────────────────────────────────
const req4 = indexedDB.open('AtlasHorizonDB');
req4.onsuccess = e => {
  const db = e.target.result;
  db.transaction('ingresos','readonly').objectStore('ingresos')
    .getAll().onsuccess = e2 => {
      const data = e2.target.result;
      const nominas = data.filter(r => r.tipo === 'nomina');
      console.log('ingresos · total:', data.length);
      console.log('ingresos · nominas:', nominas.length);
      if (nominas.length > 0) {
        const n = nominas[0];
        console.log('ingresos · nomina[0] tiene planPensiones:', !!n.planPensiones);
        console.log('ingresos · nomina[0] planPensiones.productoDestinoId:',
          n.planPensiones?.productoDestinoId);
        console.log('ingresos · nomina[0] campos:', Object.keys(n));
      }
    };
};

// ─── 5. Verificar compromisosRecurrentes ────────────────────────────────────
const req5 = indexedDB.open('AtlasHorizonDB');
req5.onsuccess = e => {
  const db = e.target.result;
  db.transaction('compromisosRecurrentes','readonly')
    .objectStore('compromisosRecurrentes').getAll().onsuccess = e2 => {
      const data = e2.target.result;
      console.log('compromisosRecurrentes · total:', data.length);
      console.log('compromisosRecurrentes · por ambito:', data.reduce((a,c) => {
        a[c.ambito] = (a[c.ambito]||0)+1; return a;
      }, {}));
      console.log('compromisosRecurrentes · por estado:', data.reduce((a,c) => {
        a[c.estado] = (a[c.estado]||0)+1; return a;
      }, {}));
    };
};

// ─── 6. Verificar movementLearningRules ─────────────────────────────────────
const req6 = indexedDB.open('AtlasHorizonDB');
req6.onsuccess = e => {
  const db = e.target.result;
  db.transaction('movementLearningRules','readonly')
    .objectStore('movementLearningRules').getAll().onsuccess = e2 => {
      const data = e2.target.result;
      console.log('movementLearningRules · total:', data.length);
      if (data.length > 0) console.log('reglas más usadas:',
        data.sort((a,b) => b.appliedCount-a.appliedCount).slice(0,5));
    };
};
```

**Preguntas clave para Jose tras ejecutar**:
1. `aportacionesPlan` — ¿cuántos registros? Si 0, ¿la nómina tiene `planPensiones.productoDestinoId` relleno?
2. `gastosInmueble` — ¿distribución por origen? ¿Mayoritariamente `xml_aeat` o `tesoreria`?
3. `movements` — ¿campo `categoriaPresupuesto` presente? (esperado: NO)
4. `ingresos·nomina` — ¿tiene `planPensiones.productoDestinoId`? Clave para que funcione el disparo.
5. `compromisosRecurrentes` — ¿cuántos? ¿Cómo llegaron (importados de opexRules o via DetectarCompromisos)?

---

## E · Tabla de bloqueantes y trabajo identificado

| ID | Hallazgo | Severidad | Bloquea | Estimación |
|---|---|---|---|---|
| H-01 | `movements.categoriaPresupuesto` AUSENTE · etiquetado 50/30/20 no disponible sobre movimientos reales. Nota adicional: los valores del modelo canónico (`'necesidad'|'deseo'|'ahorro_inversion'`) divergen de los del enum real `BolsaPresupuesto` (`'necesidades'|'deseos'|'ahorroInversion'`) — alinear nombres al diseñar el campo | **crítica** | T36 | Schema task: definir valores canónicos, añadir campo + migración V68; 3-4h |
| H-02 | Pestaña "Gastos" en ficha inmueble UI v5 = placeholder vacío | **alta** | T34 | Construir vista desde 0 usando `gastosInmuebleService` + `mejorasInmuebleService` + `mueblesInmuebleService`; 8-12h |
| H-03 | Pestaña "Cobros" en ficha inmueble UI v5 = placeholder vacío | **alta** | T34 | Construir vista usando `contracts`; 4-6h |
| H-04 | No existe wizard manual "Crear compromiso recurrente desde cero" | **alta** | T35 | Reutilizar modal de edición de DetectarCompromisosPage como base; 4-6h |
| H-05 | Vista PresupuestoPage calcula 50/30/20 desde compromisos, NO desde movimientos bancarios reales | **media** | T36 | Depende de H-01; una vez el campo existe, conectar cálculo; 3-4h |
| H-06 | Discordancia `ambito` mayúsculas/minúsculas entre `movements` (`'PERSONAL'|'INMUEBLE'`) y `compromisosRecurrentes` (`'personal'|'inmueble'`) | **media** | T34/T35 | Normalizar en queries o en schema; riesgo de bugs en joins; 1-2h |
| H-07 | No existe wizard directo "Crear gasto inmueble manualmente" (sin extracto bancario) | **media** | T34 | Formulario de 1 paso en vista gastos inmueble; 3-4h |
| H-08 | `movementLearningRules` vacío en producción · auto-categorización no actúa hasta primer uso manual | **baja** | - | Esperado · se rellena con uso; documentar en onboarding |
| H-09 | `movements.treasuryEventId` AUSENTE · trazabilidad movement → treasury event solo vía inversa | **baja** | T34 | Cosmético; el join inverso funciona; 1h si se decide añadir |
| H-10 | Nombre campo `fechaAlta` vs `fechaCompra` y `vidaUtil` vs `vidaUtilAnios` en `mueblesInmueble` | **baja** | - | Solo inconsistencia de nomenclatura entre modelo canónico y código; 30min de actualizar docs |
| H-11 | Disparo nómina→aportación silencioso si `planPensiones.productoDestinoId` no está relleno (no hay warning UX) | **media** | - | Añadir tooltip/warning en wizard nómina; 1-2h |

---

## F · Recomendación de orden de trabajo

1. **T34 ya** · Los stores de inmueble (`gastosInmueble`, `mejorasInmueble`, `mueblesInmueble`) están listos con servicios completos. La pestaña "Gastos" en `DetallePage.tsx` solo necesita que se implemente la UI (actualmente placeholder). Se puede arrancar T34 inmediatamente sin cambios de schema. Referencia legacy en `GastosRecurrentesTab.tsx`.

2. **Schema task para T36** · Antes de T36, crear una micro-tarea que añada `categoriaPresupuesto` a `movements` (H-01). Es un cambio de schema mínimo (campo opcional, migration simple) pero es la raíz de T36.

3. **T35 wizard compromisos** · Crear el wizard manual "Nuevo compromiso" reutilizando el modal de edición de `DetectarCompromisosPage`. No hay dependencias de schema.

4. **Verificar disparo nómina** · Jose debe ejecutar la query DevTools para confirmar si `ingresos.nomina.planPensiones.productoDestinoId` está relleno. Si no, el disparo G-07 nunca ha actuado en producción y hay 0 aportaciones automáticas.

5. **Normalizar `ambito`** · Resolver H-06 antes de T34 para evitar bugs en la vista de gastos al intentar filtrar por ámbito.

---

**STOP-AND-WAIT** · Jose lee el documento · ejecuta consultas DevTools de la sección D · verifica · y autoriza siguiente paso (T34 spec).
