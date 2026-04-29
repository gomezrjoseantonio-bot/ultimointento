# TAREA CC · TAREA 15 · Saneamiento `keyval` · v1

> **Tipo** · saneamiento técnico · auditoría + clasificación + posibles migraciones internas
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama** · crear `chore/keyval-saneamiento` desde `main`
>
> **Alcance** · auditar TODAS las claves activas en el store `keyval` · clasificar por categoría · borrar las muertas · migrar las que vivan a stores correctos donde aplique · documentar la API canónica del store
>
> **Tiempo estimado** · 4-6h Copilot · 2-3h revisión Jose
>
> **Prioridad** · MEDIA · primero del bloque saneamiento técnico (T15 → T14 → T9 → T8 → T10)
>
> **Predecesores cerrados** · T17 · T20
>
> **Tareas congeladas que se descongelan tras este bloque** · ninguna · todas las congeladas SON del bloque
>
> **DB** · puede subir DB_VERSION 65 → 66 si la limpieza requiere eliminar claves vía migración formal · si solo limpia con `db.delete()` runtime · no toca DB_VERSION · CC decide al cerrar §3
>
> **Stores tocados** · `keyval` (auditoría + limpieza) · posiblemente otros stores destino si alguna clave debe migrarse (decisión por categoría en §3)

---

## 1 · Contexto

### 1.1 · Por qué T15

El store `keyval` actúa hoy como cajón de configuraciones · hereda claves añadidas durante T7 (limpieza V60) cuando se eliminaron 4 stores (`configuracion_fiscal` · `matchingConfiguration` · `kpiConfigurations` · etc.) y sus contenidos se redirigieron aquí. Es el destino documentado en JSDoc de `db.ts:2110-2125`. Pero a lo largo de los meses se han añadido más claves de naturaleza muy distinta · flags de migración · planes de pago · proyecciones cacheadas · configuración fiscal · etc. T7-bis lo flageó como deuda técnica.

`STORES-V60-ACTIVOS.md` lo confirma · "uso amplio más allá de configs (TAREA 15)" · "TAREA 15 auditará todas las claves activas y decidirá destino por grupo. `keyval` debe quedar reservado a configuraciones reales documentadas".

### 1.2 · Inventario real auditado en este repo

Búsqueda en `src/` (excluyendo tests) revela las siguientes invocaciones a `db.get/put/delete('keyval', ...)` con sus claves concretas:

| Clave | Tipo | Origen / Servicio | Naturaleza | Observación inicial |
|---|---|---|---|---|
| `'matchingConfig'` | configuración | `budgetMatchingService.ts:56` constante `MATCHING_CONFIG_KEY` · también lectura en `transferDetectionService.ts:147,342` | configuración real | ✅ destino canónico documentado V63 · KEEP |
| `'dashboardConfiguration'` | configuración | `dashboardService.ts:308` constante `indexedDbKey` | configuración real | ✅ KEEP · auditar formato |
| `'base-assumptions'` | configuración | `proyeccionService.ts:51` constante `ASSUMPTIONS_KEY` | configuración real (proyección) | ⚠ vive en `src/modules/horizon/proyeccion/...` · módulo legacy NO migrado en T20 · KEEP por ahora · puede mover en T21 cuando proyección migre |
| `'base-projection'` | datos cacheados | `proyeccionService.ts:52` constante `PROJECTION_KEY` | proyección cacheada | ⚠ NO es configuración · es CACHE recalculable · candidato a borrar y recalcular al vuelo |
| `'configFiscal'` | configuración | documentado en `db.ts:2115` JSDoc | configuración fiscal | ❓ verificar si hay registro real · si sí · candidato a mover en T14 (configuración fiscal sitio único) |
| `'kpiConfig_horizon'`, `'kpiConfig_pulse'`, `'kpiConfig_*'` | configuración | `db.ts:2119-2122` JSDoc · `kpiService.ts` · `KPIsBlock.tsx:108` | configuración real | ✅ KEEP · destino oficial V62 |
| `'planpagos_${prestamoId}'` (N claves · 1 por préstamo) | datos del usuario | `prestamosService.ts:507,631` · `loanSettlementService.ts:623,649` · `propertySaleService.ts:390,626` · `historicalCashflowCalculator.ts:66` · `InmueblesAnalisis.tsx:1233` | datos · NO configuración | 🔴 candidato a MOVER · debería vivir en `prestamos.planPagos` campo o store nuevo |
| `'proveedor-contraparte-migration'` | flag migración | `migrationService.ts:31,92` valor `'completed'` | flag de migración consumida | 🟡 candidato a borrar tras verificar que migración terminó hace tiempo |
| `'atlas_account_migration_version'` | flag migración | `accountMigrationService.ts:12` constante `MIGRATION_KEY` | flag versión migración | 🟢 KEEP si la migración aún se ejecuta cada arranque · auditar |
| `'atlas_migration_gastos_v1'` | flag migración | `migracionGastosService.ts:4` constante `MIGRATION_KEY` | flag migración consumida | 🟡 candidato a borrar si migración terminó |
| `'migration_backfill_importeBruto_0106_v1'` | flag migración | `migrations/backfillImporteBruto0106.ts:12` | flag migración | 🟡 candidato a borrar si migración terminó |
| `'migration_clean_stale_cp_and_infer_itp_v1'` | flag migración | `migrations/cleanStaleCPAndInferITP.ts:21` | flag migración | 🟡 candidato a borrar si migración terminó |
| `'migration_fix_reparaciones_duplicadas_v1'` | flag migración | `migrations/fixReparacionesDuplicadas.ts:8` | flag migración | 🟡 candidato a borrar si migración terminó |
| `'migration_limpiar_gastos_reparacion_0106_v1'` | flag migración | `migrations/limpiarGastosReparacionCasilla0106.ts:9` | flag migración | 🟡 candidato a borrar si migración terminó |
| `'migration_orphaned_inmueble_ids_v1'` | flag migración | `migrations/migrateOrphanedInmuebleIds.ts:23` | flag migración | 🟡 candidato a borrar si migración terminó |

**Total identificado · 12 claves fijas + N claves dinámicas `planpagos_*` (al menos 8 en producción Jose · 1 por préstamo activo).**

⚠ **Posible que existan más claves** · CC debe ejecutar auditoría runtime sobre la DB del usuario en producción (vía DevTools instructions) para listar TODAS las claves vivas · puede haber claves históricas no documentadas en el código actual.

### 1.3 · Categorías de claves · marco de decisión

Cada clave debe clasificarse en una de estas 4 categorías y procesarse según la política correspondiente:

| Categoría | Política | Ejemplos |
|---|---|---|
| **A · Configuración real** | KEEP en keyval · documentar formato + dueño + invariantes | matchingConfig · dashboardConfiguration · kpiConfig_* |
| **B · Cache recalculable** | BORRAR · recalcular al vuelo · documentar TODO si requiere reescribir consumidor | base-projection · cualquier proyección/agregado cacheado |
| **C · Datos del usuario disfrazados de config** | MOVER al store correcto · NO pertenecen a keyval · campo o store nuevo | planpagos_* → store `prestamos.planPagos` o store nuevo |
| **D · Flag de migración** | (D1) MANTENER si la migración se ejecuta cada arranque y necesita recordar estado · (D2) BORRAR si migración ya consumida y nunca volverá a correr | migration_*_v1 son D2 si CC verifica que el código que las creó es one-shot |

### 1.4 · Decisiones consolidadas previas

1. **`keyval` no se elimina** · el store sigue siendo válido para categorías A y D1
2. **Configuración fiscal (`configFiscal`)** · si tiene registro real · queda fuera de scope T15 · se aborda en T14 (configuración fiscal sitio único) · T15 solo audita · NO toca
3. **Claves de proyección (`base-assumptions`, `base-projection`)** · viven en módulo legacy `horizon/proyeccion/` · T20 no migró ese módulo · NO mover ahora · auditar y dejar TODO documentado para cuando proyección migre
4. **NO subir DB_VERSION salvo necesario** · si todas las acciones son `db.delete()` y `db.put()` runtime (sin cambios de schema) · DB_VERSION sigue en 65
5. **Tarea idempotente** · si CC ejecuta el saneamiento 2 veces · resultado igual · no rompe nada

---

## 2 · Sub-tareas · 4 commits secuenciales · stop-and-wait

PR único contra `main` · título · `chore(keyval): T15 · saneamiento · auditoría + clasificación + limpieza`

**REGLA · STOP-AND-WAIT** · CC implementa una sub-tarea · publica commit · DETIENE EJECUCIÓN · espera revisión Jose antes de la siguiente. Ya validado en T17/T20.

### Sub-tarea 15.1 · Auditoría runtime + documento clasificación

**Commit 1** · `chore(keyval): audit · catálogo completo de claves activas`

Acciones:

1. **Crear documento `docs/AUDIT-T15-keyval.md`** con estructura:
   - Sección "Claves identificadas en código" · tabla con las 12+ claves de §1.2 confirmadas + cualquier otra que CC encuentre haciendo grep exhaustivo
   - Sección "Claves planpagos_* dinámicas" · explicar el patrón · enumerar cuántas hay típicamente · mostrar formato del valor
   - Sección "Auditoría runtime" · procedimiento para ejecutar en DevTools de Jose · listar TODAS las claves vivas en producción · output esperado: tabla `clave → tipo de valor → tamaño bytes`
   - Sección "Clasificación propuesta" · cada clave con su categoría A/B/C/D + acción recomendada (KEEP · BORRAR · MOVER · TODO-T14 · TODO-Proyección)
   - Sección "Decisiones que requieren input Jose" · si hay claves dudosas · listarlas con propuesta + alternativa

2. **Crear utilidad `src/services/__keyvalAudit.ts`** (nombre con `__` prefix para indicar herramienta interna · NO importar desde código de producción) que expone función `auditKeyval()` async devolviendo:
```typescript
type KeyvalAuditEntry = {
  key: string;
  category: 'A' | 'B' | 'C' | 'D' | 'unknown';
  valueType: 'string' | 'number' | 'object' | 'array' | 'boolean';
  byteSize: number;
  recommendation: 'KEEP' | 'DELETE' | 'MOVE' | 'TODO_T14' | 'TODO_PROYECCION' | 'TODO_REVIEW';
  reason: string;
};
type KeyvalAuditReport = {
  totalKeys: number;
  byCategory: Record<string, number>;
  entries: KeyvalAuditEntry[];
  unknownKeys: string[];  // claves no clasificables · requieren decisión Jose
};
async function auditKeyval(): Promise<KeyvalAuditReport>;
```

3. **Añadir página `/dev/keyval-audit`** (DEV only · igual que `/dev/components` de T20.0) que invoca `auditKeyval()` y muestra el report en formato tabla legible · cada fila clave + categoría + tamaño + recomendación + botón "Mostrar valor" para inspección.

**Verificación 15.1** · Jose ejecuta `/dev/keyval-audit` en deploy preview · revisa output · valida clasificaciones · marca claves desconocidas si las hay.

**STOP-AND-WAIT** · publicar commit · esperar feedback Jose con la lista de decisiones definitivas para 15.2.

### Sub-tarea 15.2 · Limpieza · borrar claves categoría B + D2 confirmadas

**Commit 2** · `chore(keyval): cleanup · purge dead caches and consumed migration flags`

Acciones (solo claves que Jose haya confirmado en feedback de 15.1 como BORRAR):

1. **Crear servicio `src/services/keyvalCleanupService.ts`** con función `runKeyvalCleanup()` async que:
   - Recibe lista hardcodeada de claves a borrar (las confirmadas en 15.1)
   - Para cada clave · verifica que existe (`db.get` no null) · si sí · `db.delete('keyval', clave)` · log resultado
   - Idempotente · si ya no existe · skip silencioso
   - Devuelve `{ deletedCount, skippedCount, errors[] }`

2. **Invocar desde arranque de la app** · igual que las otras migraciones one-shot · en `App.tsx` después de `initDB()`. Para que sea one-shot, escribe flag `'cleanup_T15_v1'` en keyval cuando termina · próxima vez verifica el flag · skip si está completed.

3. **Para flags de migración consumidas (D2)** · CC verifica una a una en código que la migración correspondiente ya no se invoca de manera que necesite el flag · si lo necesita · NO borrar (es D1) · si no · borrar.

4. **Tests** · `src/services/__tests__/keyvalCleanupService.test.ts` con escenarios:
   - DB con claves a borrar · tras run · claves no existen · `deletedCount > 0`
   - Run idempotente · segunda ejecución · `deletedCount = 0` · `skippedCount = N`
   - Si `db.delete` falla en una clave · sigue con resto · reporta en `errors[]`
   - Flag `cleanup_T15_v1` se escribe correctamente y previene re-ejecución

**Verificación 15.2** · `tsc --noEmit` pasa · tests pasan · arranque de app NO genera errores · DevTools muestra que las claves borradas ya no están.

**STOP-AND-WAIT** · publicar commit · esperar revisión.

### Sub-tarea 15.3 · Mover claves categoría C · `planpagos_*` a campo en `prestamos`

**Commit 3** · `refactor(prestamos): move planpagos_* from keyval to prestamos.planPagos field`

Solo si Jose confirma en 15.1 que esta migración entra en alcance. Si Jose prefiere dejarla para tarea futura · saltar esta sub-tarea y documentar TODO.

Acciones (si confirmado):

1. **Auditar schema actual de `prestamos`** · verificar si ya tiene campo `planPagos` o equivalente · si no · añadirlo a la interfaz TypeScript (NO requiere DB_VERSION bump · IndexedDB es schemaless por registro)

2. **Crear migración runtime** `src/services/migrations/migrateKeyvalPlanpagosToPrestamos.ts` con flag `'migration_keyval_planpagos_to_prestamos_v1'`:
   - Para cada `prestamo` en store `prestamos` · leer `keyval['planpagos_${prestamo.id}']` · si existe · escribir en `prestamo.planPagos` · `db.put('prestamos', prestamo)` · `db.delete('keyval', 'planpagos_${prestamo.id}')`
   - Idempotente · si `prestamo.planPagos` ya tiene valor y keyval no · skip
   - Si keyval tiene valor pero `prestamo.planPagos` también · WARNING · no sobrescribir · log conflict

3. **Adaptar consumidores** · 6 sitios identificados:
   - `prestamosService.ts:507,631`
   - `loanSettlementService.ts:623,649`
   - `propertySaleService.ts:390,626`
   - `historicalCashflowCalculator.ts:66`
   - `InmueblesAnalisis.tsx:1233`
   
   Cada uno · sustituir `db.get('keyval', 'planpagos_${id}')` por leer `prestamo.planPagos` directamente. Tests existentes deben seguir pasando.

4. **Invocar migración desde arranque** · igual patrón que 15.2 · one-shot con flag.

5. **Tests** · `src/services/migrations/__tests__/migrateKeyvalPlanpagosToPrestamos.test.ts`:
   - Pre · 3 préstamos · cada uno con keyval `planpagos_${id}` · prestamos sin campo `planPagos`
   - Run migración · post · 3 préstamos con `planPagos` populated · 3 entradas keyval borradas
   - Idempotente · segunda corrida · skip silencioso
   - Conflicto · keyval con valor + prestamo.planPagos con valor distinto · no sobrescribir · log

**Verificación 15.3** · tests pasan · arranque app NO rompe consumidores · cálculos de cuota préstamo · proyección cashflow · análisis inmuebles · todos siguen mostrando datos correctos.

**STOP-AND-WAIT** · publicar commit · esperar revisión Jose en deploy preview con datos reales.

### Sub-tarea 15.4 · Documentación canónica + cierre

**Commit 4** · `docs(keyval): canonical API documentation + close T15`

Acciones:

1. **Actualizar JSDoc en `db.ts:2110-2126`** · `keyval` API documentation con:
   - Lista exhaustiva de claves canónicas vivas tras T15 (categoría A + D1 sobrevivientes)
   - Para cada clave · formato de valor + dueño (servicio responsable) + invariantes
   - Sección "Claves prohibidas" · planpagos_* (movido a `prestamos.planPagos`) · base-projection (cache · no persistir)
   - Sección "Cómo añadir una clave nueva" · checklist (¿es configuración real? ¿hay alternativa más natural? ¿cuál es el formato? ¿quién es el dueño?)

2. **Actualizar `docs/STORES-V60-ACTIVOS.md`** · sección keyval · sustituir "TAREA 15 auditará todas las claves activas..." por estado post-T15 · referenciar `AUDIT-T15-keyval.md`

3. **Cerrar TODO en `docs/TAREA-20-pendientes.md`** si T15 se mencionaba allí (verificar)

4. **Crear `docs/T15-cierre.md`** · resumen ejecutivo · qué hacía cada categoría · cuántas claves eliminadas/movidas/conservadas · diff bytes en keyval antes/después.

**Verificación 15.4** · documentación coherente · grep de `planpagos_` solo en archivos histórico-arqueológicos (audit · cierre) · ninguna referencia activa en código de producción.

**Mergear PR completo tras esta sub-tarea.**

---

## 3 · Criterios de aceptación globales

- [ ] PR contra `main` · 4 commits separados · stop-and-wait respetado
- [ ] DB_VERSION sigue en 65 (no se toca schema · solo limpieza runtime)
- [ ] 40 stores activos · sin cambios estructurales
- [ ] `tsc --noEmit` pasa
- [ ] Build pasa con `CI=true`
- [ ] App arranca sin errores · DevTools consola limpia
- [ ] 15.1 · audit document publicado · página `/dev/keyval-audit` funciona
- [ ] 15.2 · claves categoría B y D2 confirmadas eliminadas · idempotente · tests verdes
- [ ] 15.3 (si confirmada) · `planpagos_*` migrado a `prestamos.planPagos` · 6 consumidores adaptados · tests verdes · datos del usuario intactos
- [ ] 15.4 · JSDoc canónico actualizado · STORES-V60-ACTIVOS actualizado · documento cierre creado
- [ ] Datos del usuario intactos · planes de pago siguen funcionando · proyección/análisis inmuebles muestran datos correctos
- [ ] No quedan claves "huérfanas" sin clasificar (todas o están en doc canónico o están borradas/movidas)

---

## 4 · Reglas operativas

- **STOP-AND-WAIT** entre sub-tareas (idéntica regla T17/T20)
- **Si CC encuentra ambigüedad** · PARAR · comentar PR · esperar input Jose · NO inventar
- **NO modificar `configFiscal`** · pertenece a T14 · solo auditar · NO tocar
- **NO modificar claves de `proyeccion/`** · módulo legacy · solo auditar · TODO-T21
- **NO arreglar bugs encontrados fuera de scope keyval** · documentar TODO · seguir
- **Idempotencia obligatoria** · cualquier limpieza/migración runtime debe ser ejecutable N veces sin efecto secundario
- **Datos del usuario intactos** · si en algún punto un dato real desaparece · es BUG · revertir
- **NO eliminar el store keyval** · queda vivo para categorías A y D1

---

## 5 · Lo que esta tarea NO hace

- ❌ NO consolida configuración fiscal · es **T14**
- ❌ NO migra claves del módulo legacy `proyeccion/` · esperan a que proyección migre a v5 (T21)
- ❌ NO sube DB_VERSION (salvo necesidad imprevista que Jose autorice)
- ❌ NO toca lógica de negocio · solo limpieza/movimiento de datos
- ❌ NO modifica el store keyval en sí (sigue existiendo)
- ❌ NO afecta a T17 importación bancaria · `learnKey` y `movementLearningRules` no usan keyval

---

## 6 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main` (post-T20 cerrada)
- DB_VERSION 65 · 40 stores
- 12+ claves keyval identificadas en §1.2
- Datos reales del usuario · Jose tiene 8+ préstamos activos · cada uno con `planpagos_*` en keyval
- Documentación previa · `STORES-V60-ACTIVOS.md` · `AUDIT-39-stores-V60.md` · JSDoc en `db.ts:2110-2126`

---

## 7 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Borrar clave que era usada en algún punto no auditado | Baja | 15.1 audit runtime expone TODAS las claves vivas · NO solo las del código · Jose confirma una a una antes de borrar en 15.2 |
| Migración planpagos pierde datos | Media | Idempotente · conflicto detectado y NO sobrescribe · validación post-deploy con `prestamosService` recalculando cuotas y comparándolas con valor anterior |
| Consumidor no adaptado lee keyval vacío y rompe | Baja | 6 consumidores identificados explícitamente · todos adaptados en 15.3 · tests existentes deben seguir pasando |
| Flag de migración borrado vuelve a ejecutar migración legacy | Media | Solo D2 confirmadas (migración one-shot histórica) · NO borrar D1 (las que se ejecutan cada arranque) · CC verifica una a una |
| Run idempotente falla · re-ejecutar borra cosas que volvieron a existir legítimamente | Baja | Flag `cleanup_T15_v1` previene re-ejecución · si Jose quiere re-ejecutar tras añadir nuevas claves · borrar el flag manualmente |

---

## 8 · Después de T15

1. Descongelar **T14** · configuración fiscal sitio único · ahora con keyval limpio T14 sabe qué hay en cada sitio
2. Cuando T14 cierre · descongelar **T9** · bootstrap compromisosRecurrentes
3. Cuando T9 cierre · descongelar **T8** y **T10**
4. Tras los 5 saneamientos cerrados · ATLAS técnicamente consolidado · valorar si abrir T21 (Phase 4 parte 2 de purga horizon) o nuevo bloque de features

---

**Fin de la spec T15 v1 · 4 sub-tareas con stop-and-wait estricto · cada una autocontenida.**
