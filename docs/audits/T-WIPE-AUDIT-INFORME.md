# T-WIPE-AUDIT · pre-flight TAREA 11 contra DB v70

> **Tipo** · auditoría · CERO código modificado
>
> **Fecha** · 2026-05-09
>
> **Branch** · `claude/audit-db-compatibility-MBi4Q`
>
> **Objetivo** · validar que el spec `TAREA-CC-11-flujo-wipe-reimport.md` (redactado en abril 2026 contra **DB v65 · 40 stores**) sigue siendo aplicable contra el estado actual **DB v70 · 40 stores**.
>
> **Veredicto** · **OPCIÓN 2** · spec adaptable con cambios concretos · ver §E.

---

## §0 · Resumen ejecutivo (5 líneas)

1. **DB v70 · 40 stores activos** · idéntico inventario que V65 (los 5 bumps V66-V70 fueron sin cambios estructurales · solo limpieza keyval · backfills idempotentes · índices).
2. La lista preserve del spec (`personalData` · `viviendaHabitual` · `personalModuleConfig`) sigue **existiendo tal cual** · pero está **incompleta** · al menos 8 stores adicionales contienen datos del usuario NO reimportables desde XML AEAT/CSV.
3. **Ya existe en producción** una UI completa de wipe + export/import en `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` (botones `Restablecer Datos` · `Reset Atlas` · `Exportar/Importar snapshot ZIP`) · el spec abril no la contemplaba.
4. La estrategia técnica del spec (`indexedDB.deleteDatabase` + `localStorage.clear` + `location.reload`) **funciona y ya está implementada y testada** (`src/__tests__/resetAtlas.test.ts`) · pero falta limpiar el **service worker** (`public/sw.js` activo en `src/index.tsx:24`).
5. Migración pendiente · `keyval` contiene flags `migration_*` (D1 idempotentes · seguro re-ejecutar) y configuración del usuario (`dashboardConfiguration` · `base-assumptions` · `matchingConfig`) · si el wipe selectivo borra `keyval`, el usuario pierde su panel y assumptions de proyección.

---

## §1 · Pre-flight · output literal

### 1.1 · `grep createObjectStore` · `src/services/db.ts` (47 hits totales)

```
2436:          const propertyStore = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
2442:          const propertySalesStore = db.createObjectStore('property_sales', { keyPath: 'id', autoIncrement: true });
2452:          db.createObjectStore('objetivos_financieros', { keyPath: 'id' });
2457:          const documentStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
2465:          const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
2473:          const carryForwardStore = db.createObjectStore('aeatCarryForwards', { keyPath: 'id', autoIncrement: true });
2481:          const propertyDaysStore = db.createObjectStore('propertyDays', { keyPath: 'id', autoIncrement: true });
2491:          db.createObjectStore('proveedores', { keyPath: 'nif' });
2498:          const gastosStore = db.createObjectStore('gastosInmueble', { keyPath: 'id', autoIncrement: true });
2517:          const mejorasStore = db.createObjectStore('mejorasInmueble', { keyPath: 'id', autoIncrement: true });
2531:          const mueblesStore = db.createObjectStore('mueblesInmueble', { keyPath: 'id', autoIncrement: true });
2572:          const accountsStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
2580:          const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
2591:          const importBatchesStore = db.createObjectStore('importBatches', { keyPath: 'id' });
2598:          const treasuryEventsStore = db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
2631:          const presupuestosStore = db.createObjectStore('presupuestos', { keyPath: 'id' });
2638:          const presupuestoLineasStore = db.createObjectStore('presupuestoLineas', { keyPath: 'id' });
2661:          const learningRulesStore = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
2673:          const personalDataStore = db.createObjectStore('personalData', { keyPath: 'id', autoIncrement: true });
2679:          const configStore = db.createObjectStore('personalModuleConfig', { keyPath: 'personalDataId' });
2689:          const ingresosStore = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
2701:            const planesLegacyStore = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
2711:            const traspasosLegacyStore = db.createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true });
2724:          const planesStore = db.createObjectStore('planesPensiones', { keyPath: 'id' });
2732:          const aportacionesStore = db.createObjectStore('aportacionesPlan', { keyPath: 'id' });
2741:          const traspasosNuevoStore = db.createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true });
2750:          const inversionesStore = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
2760:          db.createObjectStore('keyval');
2765:          const prestamosStore = db.createObjectStore('prestamos', { keyPath: 'id' });
2773:          const valoracionesStore = db.createObjectStore('valoraciones_historicas', { keyPath: 'id', autoIncrement: true });
2799:          const resultadosStore = db.createObjectStore('resultadosEjercicio', { keyPath: 'id', autoIncrement: true });
2808:          const arrastresStore = db.createObjectStore('arrastresIRPF', { keyPath: 'id', autoIncrement: true });
2818:          const perdidasStore = db.createObjectStore('perdidasPatrimonialesAhorro', { keyPath: 'id', autoIncrement: true });
2826:          const snapshotsStore = db.createObjectStore('snapshotsDeclaracion', { keyPath: 'id', autoIncrement: true });
2833:          const entidadesStore = db.createObjectStore('entidadesAtribucion', { keyPath: 'id', autoIncrement: true });
2841:          const coordStore = db.createObjectStore('ejerciciosFiscalesCoord', { keyPath: 'año' });
2847:          const vinculosStore = db.createObjectStore('vinculosAccesorio', { keyPath: 'id', autoIncrement: true });
2924:          const compromisosStore = db.createObjectStore('compromisosRecurrentes', { ... });
2939:          const viviendaStore = db.createObjectStore('viviendaHabitual', { ... });
3159:            db.createObjectStore('escenarios', { keyPath: 'id' });
3243:            const objetivosStore = db.createObjectStore('objetivos', { keyPath: 'id' });
3258:            const fondosStore = db.createObjectStore('fondos_ahorro', { keyPath: 'id' });
3271:            const retosStore = db.createObjectStore('retos', { keyPath: 'id' });
3310:            db.createObjectStore('escenarios', { keyPath: 'id' });           # rama legacy V5.4
3850:            const planesStore = db.createObjectStore('planesPensiones', { keyPath: 'id' });        # rama V65 retro
3857:            const aportacionesStore = db.createObjectStore('aportacionesPlan', { keyPath: 'id' });
3865:            const traspasosNuevoStore = db.createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true });
```

> Notas · `objetivos_financieros` · `planesPensionInversion` · `traspasosPlanes` se crean en ramas legacy y se eliminan vía `deleteObjectStore` antes de la cabecera V70 (líneas 3222 · 3326 · 4024-4027). Las creaciones repetidas en líneas 3310/3850-3865 son para DBs antiguas que saltan migraciones — el efecto neto en la cabecera V70 son los **40 stores canónicos** documentados en `docs/STORES-V60-ACTIVOS.md`.

### 1.2 · DB_VERSION · DB_NAME

```
src/services/db.ts:27:const DB_NAME = 'AtlasHorizonDB';
src/services/db.ts:28:const DB_VERSION = 70; // V70 (PR-C4 · sistémico patrón vs real): añade `historial?: NominaHistorialEntry[]` al patrón Nomina ... 40 stores (sin cambio en número).
```

### 1.3 · Migrations en `src/services/migrations/`

```
backfillImporteBruto0106.ts
cleanStaleCPAndInferITP.ts
cleanupCategoriasT34T35fix2.ts
cleanupConfigFiscalKeyval.ts
fixReparacionesDuplicadas.ts
limpiarGastosReparacionCasilla0106.ts
migrateFinanciacionV2.ts
migrateInversiones.ts
migrateKeyvalPlanpagosToPrestamos.ts
migrateOrphanedInmuebleIds.ts
migratePrestamos.ts
v68-tipoFamilia.ts
v70-nomina-historial.ts
```

> Cada migración usa una clave en `keyval` (`migration_*_v1`) o `localStorage` (`atlas_migration_*`) como flag de idempotencia. Detalle en §D.

### 1.4 · Stores preserve · spec abril (`personalData` · `viviendaHabitual` · `personalModuleConfig`)

```
2672:        if (!db.objectStoreNames.contains('personalData')) {
2673:          const personalDataStore = db.createObjectStore('personalData', { keyPath: 'id', autoIncrement: true });
2678:        if (!db.objectStoreNames.contains('personalModuleConfig')) {
2679:          const configStore = db.createObjectStore('personalModuleConfig', { keyPath: 'personalDataId' });
2938:        if (!db.objectStoreNames.contains('viviendaHabitual')) {
2939:          const viviendaStore = db.createObjectStore('viviendaHabitual', { ... });
```

→ los 3 stores existen tal cual hoy · **OK para spec**.

### 1.5 · Wipe runtime · `db.close` · `deleteDatabase` · `caches`

```
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:116:        const deleteRequest = indexedDB.deleteDatabase('AtlasHorizonDB');
src/services/db.ts:2386 · 2399 · 2403 · 2407 · 2411: db.close();   (lifecycle interno)
src/services/db.ts:4604:        const cacheNames = await caches.keys();
src/services/db.ts:4609:        await Promise.all(atlasCaches.map(name => caches.delete(name)));
src/index.tsx:24: if ('serviceWorker' in navigator) {
src/index.tsx:26:    navigator.serviceWorker.register('/sw.js')
public/sw.js:46:    caches.keys().then((cacheNames) => { ... cacheNames.map((cacheName) => caches.delete(cacheName)) ... })
```

→ el wipe completo del spec (`indexedDB.deleteDatabase`) ya **se implementa y testa**. Falta cobertura del **service worker** (`/sw.js`) y de la cache del navegador `caches API`.

### 1.6 · Botones existentes (Restablecer · Reset · Eliminar · Wipe · reimport)

```
src/modules/ajustes/pages/SeguridadPage.tsx:203:          label="Eliminar cuenta"
src/modules/ajustes/pages/SeguridadPage.tsx:213:              Eliminar cuenta              # MOCKUP · solo showToastV5
src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx:433:                title="Eliminar cuentas y movimientos de demostración"
src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx:485:                title="Eliminar cuenta"          # cuenta bancaria · NO de usuario
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:278:            <h2 ...>Restablecer Datos</h2>
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:290:                Restablecer Datos        # REAL · llama resetAllData() de db.ts
src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:309:                {showSecondConfirm ? 'Confirmar Restablecimiento' : 'Sí, Restablecer'}
src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx:452:                Eliminar cuenta definitivamente   # cuenta bancaria
src/components/treasury/TesoreriaV4.tsx:1360:              ...Eliminar cuenta definitivamente   # cuenta bancaria
src/services/db.ts:3448:        //   ⚠ DESTRUCTIVO: estrategia wipe + reimport · datos NO productivos.
```

→ existe **UI real** de wipe en `/horizon/configuracion/preferencias-datos` con tres bloques: snapshot export/import · `Restablecer Datos` · `Reset Atlas (limpieza local)`. El "Eliminar cuenta" de `Ajustes/Seguridad` es **mockup**.

### 1.7 · Migration flags

```
src/services/db.ts:2203:   *   `'migration_orphaned_inmueble_ids_v1'` (D1 · KEEP)
src/services/db.ts:2212:   *   `'migration_keyval_planpagos_to_prestamos_v1'` (D1 · KEEP)
src/services/db.ts:2267:   *     - `atlas_account_migration_version`            # localStorage
src/services/db.ts:2269:   *     - `atlas_migration_gastos_v1`                  # localStorage
src/services/db.ts:2270:   *     - `migration_backfill_importeBruto_0106_v1`    # localStorage
src/services/db.ts:2271:   *     - `migration_clean_stale_cp_and_infer_itp_v1` # localStorage
src/services/db.ts:2272:   *     - `migration_fix_reparaciones_duplicadas_v1`  # localStorage
src/services/db.ts:2273:   *     - `migration_limpiar_gastos_reparacion_0106_v1` # localStorage
src/services/migrations/v68-tipoFamilia.ts:20:const MIGRATION_KEY = 'migration_v68_tipoFamilia_v1';                # keyval
src/services/migrations/v70-nomina-historial.ts:21:const MIGRATION_KEY = 'migration_v70_nomina_historial_v1';        # keyval
```

→ flags partidas entre `keyval` (D1 idempotentes) y `localStorage` (`atlas_*` · `migration_*`). Implicación · si wipe selectivo borra `keyval` pero no `localStorage`, las migraciones D1 re-ejecutan (idempotentes · seguro) pero las cleanup keyval ya consumidas también re-corren (también idempotentes).

---

## §A · Inventario stores DB v70 actual (40 stores)

> Fuente · `docs/STORES-V60-ACTIVOS.md` (V69 · 40 stores) · `src/services/db.ts:28` confirma "V70 · 40 stores (sin cambio en número)" · refrescada con verificación literal `createObjectStore` · `deleteObjectStore`.
>
> Veredicto **wipe selectivo**: SI = preservar (datos del usuario no reimportables) · NO = borrar (datos derivados de XML/CSV reimportables) · DEPENDE = revisar caso a caso (configuración mixta · flags · derivable parcialmente).

| # | Store | Contenido (1 línea) | Wipe selectivo · preservar |
|---:|---|---|:---:|
| 1 | `accounts` | Tesorería · cuentas bancarias del usuario | DEPENDE (1) |
| 2 | `aeatCarryForwards` | Arrastres legacy AEAT (sustituido por `arrastresIRPF`) | NO (derivado XML) |
| 3 | `aportacionesPlan` | Aportaciones a planes de pensiones (V65) | SI (datos usuario) |
| 4 | `arrastresIRPF` | Arrastres IRPF cross-year derivados de XML AEAT | NO (derivado XML) |
| 5 | `compromisosRecurrentes` | Compromisos recurrentes catálogo universal (V5.3 · G-01) | **SI (datos usuario)** |
| 6 | `contracts` | Contratos de arrendamiento (subidos por el usuario) | SI (datos usuario) |
| 7 | `documents` | Documental · PDFs · ZIPs subidos por el usuario | SI (blobs originales) |
| 8 | `ejerciciosFiscalesCoord` | Coordinador anual fiscal (4 regímenes) | DEPENDE (estado workflow) |
| 9 | `entidadesAtribucion` | Entidades en atribución de rentas | SI (datos usuario) |
| 10 | `escenarios` | Mi Plan v3 · escenario libertad activo (V5.4) | **SI (datos usuario)** |
| 11 | `fondos_ahorro` | Mi Plan v3 · fondos de ahorro con etiquetas (V5.6) | **SI (datos usuario)** |
| 12 | `gastosInmueble` | Gastos del inmueble (proveedores · facturas) | SI (datos usuario · adjuntos) |
| 13 | `importBatches` | Trazabilidad de imports CSV | NO (derivado · trazabilidad) |
| 14 | `ingresos` | Ingresos personales unificados (Nomina + autonomo + pension + otro) · V70 con historial | **SI (datos usuario · campos editables a mano)** |
| 15 | `inversiones` | Posiciones de inversión | SI (datos usuario) |
| 16 | `keyval` | Config (`dashboardConfiguration` · `base-assumptions` · `matchingConfig`) + flags D1 migración | **DEPENDE** (ver §D · clave) |
| 17 | `mejorasInmueble` | Mejoras del inmueble (CAPEX) | SI (datos usuario · adjuntos) |
| 18 | `movementLearningRules` | Reglas de clasificación auto (V1.1 + history) | SI (entrenamiento del usuario) |
| 19 | `movements` | Movimientos bancarios importados desde CSV | NO (reimportable de CSV) |
| 20 | `mueblesInmueble` | Mobiliario del inmueble | SI (datos usuario) |
| 21 | `objetivos` | Mi Plan v3 · objetivos (acumular/amortizar/comprar/reducir · V5.5) | **SI (datos usuario)** |
| 22 | `perdidasPatrimonialesAhorro` | Pérdidas ahorro IRPF (V3.4) | NO (derivado XML) |
| 23 | `personalData` | Perfil fiscal NÚCLEO singleton · DNI · CCAA · descendientes etc. | **SI (spec abril · OK)** |
| 24 | `personalModuleConfig` | Flags UI/integración derivados de personalData | **SI (spec abril · OK)** |
| 25 | `planesPensiones` | Entidad estable plan (V65) | SI (datos usuario) |
| 26 | `prestamos` | Préstamos · plan de pagos · liquidaciones | SI (datos usuario) |
| 27 | `presupuestoLineas` | Líneas del presupuesto del usuario | SI (datos usuario) |
| 28 | `presupuestos` | Presupuesto del usuario | SI (datos usuario) |
| 29 | `properties` | Inmuebles del usuario · ficha completa | SI (datos usuario) |
| 30 | `propertyDays` | Días fiscales por inmueble (alquiler/disponibilidad) | DEPENDE (mixto) |
| 31 | `property_sales` | Ventas de inmuebles | SI (datos usuario) |
| 32 | `proveedores` | Proveedores por NIF (V3.8) | SI (datos usuario) |
| 33 | `resultadosEjercicio` | Snapshots inmutables anuales fiscales | NO (derivado · reproducible) |
| 34 | `retos` | Mi Plan v3 · retos mensuales (V5.7) | **SI (datos usuario)** |
| 35 | `snapshotsDeclaracion` | Snapshots congelados de declaración | NO (derivado · reproducible) |
| 36 | `traspasosPlanPensiones` | Eventos traspaso fiscal neutro (V65) | SI (datos usuario) |
| 37 | `treasuryEvents` | Eventos previstos de tesorería (forecasting) | NO (derivado · regenerable) |
| 38 | `valoraciones_historicas` | Valoraciones mensuales por activo | SI (datos usuario) |
| 39 | `vinculosAccesorio` | Vínculos parking/trastero por ejercicio (V3.9) | SI (datos usuario) |
| 40 | `viviendaHabitual` | Ficha vivienda habitual (V5.3) · catastro · IBI · hipoteca | **SI (spec abril · OK)** |

(1) `accounts` · si se pierde, hay que reintroducir IBANs · pero el usuario tiene los CSVs · tratar como SI conservador o NO permisivo según política.

> **Notas · stores phantom** (mencionados en interfaces TS pero NO existen en runtime V70 · `deleteObjectStore` previo) · `objetivos_financieros` (V5.9) · `planesPensionInversion` (V65) · `traspasosPlanes` (V65) · `propertyImprovements` · `fiscalSummaries` · `operacionesFiscales` · `gastos` (todos V60). Si el spec menciona alguno, eliminarlo.

---

## §B · Comparación spec abril (DB v65) vs realidad hoy (DB v70)

| Categoría | Lista | Acción |
|---|---|---|
| Stores que el spec marcaba "preservar" y existen tal cual | `personalData` · `viviendaHabitual` · `personalModuleConfig` | **OK** · sin cambios |
| Stores que el spec marcaba "preservar" y NO existen / renombrados | (ninguno) | — |
| Stores **nuevos post-V65 que el spec no contempla** | (ninguno · 40 stores idénticos en V65 y V70 a nivel de schema · cambios V66-V70 son solo limpieza keyval · backfills · campos opcionales) | **OK estructura** |
| Stores **eliminados post-V65 mencionados en el spec** | (ninguno relevante · spec menciona solo los 3 preserve más "los demás 37" sin nombrarlos) | — |
| **Stores con datos del usuario NO reimportables que el spec NO incluye en preserve** | `ingresos` (Nomina hand-edited · V70 con historial) · `compromisosRecurrentes` (V5.3) · `escenarios` · `objetivos` · `fondos_ahorro` · `retos` (Mi Plan v3 V5.4-V5.7) · `presupuestos` · `presupuestoLineas` · `keyval` (`dashboardConfiguration` · `base-assumptions`) · `movementLearningRules` (entrenamiento usuario) | **DECIDIR · ampliar preserve list** |
| **Cambios internos a stores existentes post-V65** | • `viviendaHabitual` · índice `vigenciaDesde` (V?) · campo `vigenciaDesde` (PR `viviendaHabitual.ts:76,140`) · ya en preserve ✓ · • `compromisosRecurrentes` · campo `tipoFamilia` (V68) · • `ingresos` · array `historial[]` en patrón Nomina (V70) · • `movements.metadata.isEsporadico` (`db.ts:1223`) | sin impacto en wipe (campos opcionales · idempotentes) |

> **Conclusión §B** · el spec abril NO necesita cambios de schema · pero la **lista preserve está incompleta**. Hay 9 stores adicionales con datos del usuario que el spec abril daba por "reimportables" y no lo son.

---

## §C · Estado UI Ajustes hoy

### C.1 · ¿Existe ya pantalla con botón "Restablecer datos" o "Reiniciar app"?

**SÍ.** Ruta · `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx`

Tres bloques activos en la pestaña `Datos & Snapshots` (`#datos`):

1. **Gestión de Snapshots** (líneas 200-260) · llama `exportSnapshot()` · `importSnapshot(file, mode)` de `src/services/db.ts:4293,4382` · ZIP con CSVs + blobs originales · modo `replace`/`merge`.
2. **Restablecer Datos** (líneas 278-330) · llama `resetAllData()` de `src/services/db.ts:4535` · clear de todos los stores en batches de 8 · luego limpia 9 keys conocidas + scan dinámico de localStorage (`atlas|horizon|treasury|demo`) · luego cleanup de cache API. Doble confirmación. **NO preserva nada**. Equivale al "wipe completo" del spec abril, **NO al wipe selectivo**.
3. **Reset Atlas (limpieza local)** (líneas 333-385) · `localStorage.clear()` + `indexedDB.deleteDatabase('AtlasHorizonDB')` + `setTimeout(window.location.reload, 2000)` · confirmación con texto literal `"ELIMINAR DATOS LOCALES"`. **Equivale exactamente** a la estrategia técnica del spec del wipe completo. Test · `src/__tests__/resetAtlas.test.ts`.

### C.2 · ¿Existe solo botón "Eliminar cuenta"? ¿qué hace?

**Sí, en `src/modules/ajustes/pages/SeguridadPage.tsx:203-214`** · pero es **MOCKUP**. El handler es:

```tsx
onClick={() => showToastV5('Iniciar proceso eliminación · email de confirmación', 'warn')}
```

No llama a IndexedDB · no llama al backend · no recarga · solo muestra un toast. La página completa de Seguridad (acceso · 2FA · sesiones · exportar · auditoría · cifrado · compartir pareja · eliminar cuenta) es enteramente decorativa · todos los handlers son `showToastV5` o `useState` sin persistencia.

> Otros "Eliminar cuenta" en el repo (`BancosManagement.tsx:485,696` · `AtlasBancosManagement.tsx:452` · `TesoreriaV4.tsx:1360`) refieren a **cuentas bancarias** · no a la cuenta del usuario · fuera de scope.

### C.3 · ¿Hay otra UI relacionada (export · backup · download data) que el spec no contempla?

**Sí, mucho** · y conviene integrarla en TAREA 11:

- `exportSnapshot` / `importSnapshot` ZIP (replace/merge) · `PreferenciasDatos.tsx`. Permite al usuario hacer **backup antes del wipe** · debe ser parte del flujo recomendado.
- `exportSnapshotJSON` (`src/services/db.ts:4633`) · variante JSON para inspección manual y `window.atlasDB.*` (DevTools).
- `Ajustes › Seguridad › Exportar datos` mockup (`SeguridadPage.tsx:144-156`) · solo toast · pero la promesa al usuario está hecha en la UI de Ajustes y el spec abril no la cumple.

> **Implicación** · el spec abril asume que el wipe es la primera UI · la realidad es que ya hay tres botones de wipe · uno real (`Restablecer Datos`) · uno equivalente al spec (`Reset Atlas`) · y un export ZIP funcional. **TAREA 11 debería decidir entre · (a) reescribir esa página · (b) añadir el wipe SELECTIVO como cuarto botón · (c) mover todo a Ajustes › Seguridad y deprecar la página antigua**.

---

## §D · Viabilidad técnica del wipe

### D.1 · ¿Funciona `db.close() → indexedDB.deleteDatabase() → location.reload()` con DB v70?

**SÍ · ya está implementado y testado**.

- Implementación · `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx:106-138`.
- Flujo real · `localStorage.clear()` → `indexedDB.deleteDatabase('AtlasHorizonDB')` → `await Promise(resolve, reject)` sobre `onsuccess`/`onerror` → toast de éxito → `setTimeout(window.location.reload, 2000)`.
- **Falta** un `db.close()` explícito antes del `deleteDatabase`. En la práctica funciona porque cualquier conexión abierta dispara `onversionchange`/`onblocked` y la implementación actual NO maneja `onblocked` · si hay otras pestañas abiertas, el delete se quedará pendiente. Riesgo bajo (uso típico una pestaña) pero **el spec debería exigir manejar `onblocked`** · cerrar `dbPromise` antes (hay 5 `db.close()` en el lifecycle interno de `db.ts` · ninguno expuesto a wipe runtime).
- Test · `src/__tests__/resetAtlas.test.ts` valida `localStorage.clear` + `indexedDB.deleteDatabase('AtlasHorizonDB')` + texto exacto `"ELIMINAR DATOS LOCALES"`.

### D.2 · ¿Hay service worker en `public/` que también debería limpiarse?

**SÍ.** `public/sw.js` existe y se registra en `src/index.tsx:24-46`. El SW cachea `index.html` + estáticos en `STATIC_CACHE` (`public/sw.js:19,46-52,85,91,114-120,132`). Tras un wipe + reload, el SW podría servir contenido cacheado de antes y desincronizar la UI.

**El spec abril no contempla esto.** Acciones recomendadas para wipe completo:

1. `await navigator.serviceWorker.getRegistrations()` → unregister cada uno.
2. `await caches.keys()` → `caches.delete(name)` para todos (no solo los `atlas|horizon` que filtra `resetAllData` actualmente).
3. Recargar **forzando bypass de cache** · `location.reload(true)` está deprecated · alternativa moderna · `caches.delete` previo.

### D.3 · ¿Migraciones flag pueden romper algo si wipe selectivo conserva `keyval` o lo borra?

Análisis caso a caso:

| Flag | Tipo | Sitio | Si wipe borra | Si wipe preserva |
|---|---|---|---|---|
| `migration_orphaned_inmueble_ids_v1` | D1 KEEP | keyval | Re-ejecuta · idempotente · re-escanea huérfanos (lento pero seguro) | OK |
| `migration_keyval_planpagos_to_prestamos_v1` | D1 KEEP | keyval | Re-ejecuta · idempotente | OK |
| `cleanup_T15_v1` · `cleanup_T14_v1` · `cleanup_T34_T35_fix2_categorias` | D1 KEEP | keyval | Re-ejecuta · idempotente · sin efecto si las claves limpiadas no existen tras wipe | OK |
| `migration_v68_tipoFamilia_v1` · `migration_v70_nomina_historial_v1` | D1 KEEP | keyval | Re-ejecuta · idempotente · backfill sobre `compromisosRecurrentes` y `ingresos` (que están vacíos tras wipe completo · o que conservan datos del usuario en wipe selectivo) · OK | OK |
| `atlas_account_migration_version` · `atlas_migration_gastos_v1` · `migration_backfill_importeBruto_0106_v1` · `migration_clean_stale_cp_and_infer_itp_v1` · `migration_fix_reparaciones_duplicadas_v1` · `migration_limpiar_gastos_reparacion_0106_v1` | varias | **localStorage** | Si wipe selectivo NO toca localStorage · permanecen y NO re-ejecutan · OK · si toca localStorage · re-ejecutan idempotentes · OK | — |
| `dashboardConfiguration` · `base-assumptions` · `matchingConfig` | **config usuario** | keyval | **PÉRDIDA DE DATOS DEL USUARIO** | OK |

**Conclusión §D.3** · borrar `keyval` en wipe selectivo es destructivo (pierde dashboard del usuario · assumptions de proyección · config de matching de presupuesto). **El spec abril debería preservar `keyval`** · o al menos las 3 claves de configuración (cat A) extrayendo y reescribiendo selectivamente.

---

## §E · Veredicto final

### **OPCIÓN 2 · spec adaptable con N cambios concretos** (~30-45 min Claude)

El spec abril sigue siendo **estructuralmente válido** (lista preserve no contradice ningún store eliminado · no hay stores nuevos post-V65 que rompan la lista) pero es **incompleto** en tres dimensiones distintas. Cambios requeridos:

**Cambio 1 · Actualizar referencias DB v65 → v70** (5 min · trivial)

**Cambio 2 · Ampliar la lista preserve del wipe selectivo** (15 min)

Spec abril preserva 3 stores. La realidad V70 sugiere preservar al menos:

- `personalData` · `personalModuleConfig` · `viviendaHabitual` (spec abril · mantener)
- `ingresos` (Nomina hand-edited con historial)
- `compromisosRecurrentes`
- `escenarios` · `objetivos` · `fondos_ahorro` · `retos` (Mi Plan v3 · 4 stores)
- `presupuestos` · `presupuestoLineas`
- `keyval` (claves cat A) · o estrategia "preserve y reescribir"
- `movementLearningRules`

(opcional · revisar `proveedores` · `inversiones` · `planesPensiones` · `aportacionesPlan` según política · están entre "datos usuario" y "regenerable")

**Cambio 3 · Reconocer la UI existente y decidir destino** (10 min)

`PreferenciasDatos.tsx` ya implementa wipe completo + export/import. El spec abril o (a) reemplaza esa página con flujo nuevo · o (b) añade el wipe selectivo como cuarto botón · o (c) mueve todo el bloque a Ajustes › Seguridad y deprecia la página vieja. **Decisión Jose**.

**Cambio 4 · Añadir tratamiento del service worker en wipe completo** (10 min)

El spec abril cubre IndexedDB + localStorage. Hay que añadir:

- `navigator.serviceWorker.getRegistrations()` + unregister.
- `caches.keys()` + `caches.delete` (sin filtrar solo por nombre `atlas|horizon` como hace `resetAllData` hoy · borrar TODAS).
- Manejo de `onblocked` en `deleteDatabase` para escenario multi-pestaña.

### Por qué no OPCIÓN 1 (lanzable tal cual)

Lanzar tal cual borra datos del usuario que el spec abril no contemplaba (Mi Plan v3 · ingresos hand-edited · keyval config). Riesgo alto de queja de usuario y rollback.

### Por qué no OPCIÓN 3 (rehacer)

No hay contradicción estructural ni impedimento técnico nuevo. La estrategia técnica funciona · los 3 stores preserve existen · los 40 stores son los mismos. Es un retoque de listas + reconocer UI existente · no un rediseño.

---

## §F · Próximos pasos recomendados

1. **Mergear este audit** → cerrar la regla §1-bis del HANDOFF-V11.
2. **Jose decide** sobre Cambio 3 (UI existente · merge vs replace vs mover) · Cambio 2 (alcance final de la lista preserve).
3. **Claude reescribe** las secciones afectadas del spec TAREA-CC-11 con los cambios 1-4 · 30-45 min.
4. **Jose lanza TAREA 11** actualizada · 2-3h CC.

---

**Fin del informe.**
