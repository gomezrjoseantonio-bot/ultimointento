# CIERRE-CORRECCIONES-PRE-SNAPSHOT

> Cierre de los 3 hallazgos detectados verificando producción tras el merge de TAREA 2 (deudas pre-reset) + TAREA 4 (Mi Plan v3 stores).
>
> Rama: `claude/fix-post-deploy-bugs-oVhHT` · DB_VERSION final: **59** (V5.9).
> Estado al cierre: TAREA 3 (snapshot DB) desbloqueada · Fase 4 reset desbloqueada.

---

## 1 · Resumen ejecutivo

| Hallazgo | Antes | Después |
|---|---|---|
| A · `objetivos_financieros` no eliminado | Store seguía vivo en producción tras V5.5 | V5.9 hace merge defensivo + delete determinista |
| B · Stores reales (60) ≠ esperados (59) | +1 store extra (`objetivos_financieros`) | 59 stores · diferencia identificada y corregida |
| C · `window.atlasDB.exportSnapshot` no expuesto | `Cannot read properties of undefined` | `window.atlasDB` expuesto al importar `db.ts` |

DB_VERSION antes → después: **58 → 59**.

---

## 2 · Hallazgo A · Migración `objetivos_financieros` cerrada en V5.9

### Diagnóstico

La migración V5.5 (`fix-deudas-bloqueantes-pre-reset`) intentó eliminar el store viejo dentro de `rawGetReq.onsuccess`:

```ts
rawGetReq.onsuccess = () => {
  // ... merge ...
  (transaction as IDBTransaction).objectStore('escenarios').put(nuevo);
  (db as IDBDatabase).deleteObjectStore('objetivos_financieros');
};
```

El problema: la versionchange transaction puede cerrarse antes de que el `onsuccess` del callback anidado dispare el `deleteObjectStore`. La biblioteca `idb` no rastrea esta cadena (no hay `await` que la enganche al ciclo de vida del upgrade), así que el delete queda en una zona gris según navegador. Los usuarios actualizando desde una DB con `objetivos_financieros` poblado quedaron con **el store viejo intacto**.

### Solución V5.9

Estrategia de tres pasos para evitar la dependencia frágil de los `onsuccess` anidados de la versionchange transaction:

1. **Pre-upgrade**: `stashOldObjetivosFinancieros()` en `db.ts`.
   - Antes de invocar `openDB(..., 59, ...)` se abre la DB sin versión (transacción readonly normal) y, si existe `objetivos_financieros` en una versión < 59, se lee `id=1` y se guarda en el módulo (`v59MergePayload`).
   - Si la DB no existe (deploy nuevo) o el store ya fue eliminado, no hace nada.

2. **Upgrade V59 (sync)**: dentro del `upgrade` callback.
   - `if (oldVersion < 59 && db.objectStoreNames.contains('objetivos_financieros')) db.deleteObjectStore('objetivos_financieros')`.
   - `deleteObjectStore` es síncrono y se ejecuta **dentro del cuerpo del upgrade callback** — no hay `onsuccess` anidados. Determinista.

3. **Post-upgrade**: la promesa `dbPromise` se encadena con un `then` que, si hay payload stash, abre una transacción readwrite normal sobre `escenarios` y mergea los KPI macro:
   - Si `escenarios.id=1` ya tiene un campo macro definido, se preserva.
   - Si no, se hereda del payload stashado.
   - Defaults para los 4 campos nuevos (`modoVivienda`, `gastosVidaLibertadMensual`, `estrategia`, `hitos`).

Idempotente: si no hay payload stashado, el post-upgrade es no-op. Si la DB está limpia, el upgrade simplemente sube a 59 sin tocar nada.

### Cero pérdida de datos

El merge solo añade campos al escenario activo cuando faltan; nunca pisa valores existentes. Los KPI macro previos del usuario (Jose tiene datos productivos) se preservan tanto si vinieron del store viejo como del nuevo.

---

## 3 · Hallazgo B · Inventario completo de los 59 stores

Tras V5.9, la cuenta canónica queda en **59 stores**. La auditoría base (`ATLAS-mapa-stores-VIGENTE.md`, V53) listaba 56; V5.5-V5.8 añaden 4 (`escenarios`, `objetivos`, `fondos_ahorro`, `retos`), V5.9 elimina 1 (`objetivos_financieros`). 56 + 4 - 1 = **59**.

El "+2 stores no documentados" reportado en la spec resulta ser **+1 real**: el store que V5.5 no consiguió eliminar. No hay stores no documentados.

Inventario completo agrupado por bloque temático con trazabilidad de migración: ver `docs/ATLAS-stores-V59.md`.

---

## 4 · Hallazgo C · `window.atlasDB` expuesto

### Diagnóstico

`exportSnapshot` y `importSnapshot` ya estaban implementados en `db.ts` y conectados a la pestaña `Datos & Snapshots` de `/configuracion/preferencias-datos`. La UI funciona. Lo que faltaba era la exposición programática para que Jose pudiera ejecutar:

```js
await window.atlasDB.exportSnapshot();
```

desde DevTools sin pasar por la UI.

### Solución

`db.ts` líneas finales: helper `exposeAtlasDBHandle()` que asigna a `window.atlasDB`:

| Método | Qué hace |
|---|---|
| `exportSnapshot()` | ZIP con todos los stores + blobs (formato existente, V2) |
| `exportSnapshotJSON()` | Snapshot JSON ligero, blobs strippeados, iteración dinámica sobre `db.objectStoreNames` |
| `importSnapshot(file, mode)` | Importa ZIP en modo `replace` o `merge` |
| `resetAllData()` | Borra todos los datos preservando schema |
| `getDBVersion()` | Devuelve el `version` real de la DB en runtime |
| `listStores()` | Devuelve `Array.from(db.objectStoreNames)` |

La asignación se ejecuta automáticamente al importar `db.ts` (módulo cargado al boot de la app).

### Cobertura dinámica

`exportSnapshot` (ZIP) ya iteraba dinámicamente con `Array.from(db.objectStoreNames)` desde antes — no estaba hardcodeado. `exportSnapshotJSON` mantiene la misma estrategia. Ambos cubren los 59 stores reales tras V5.9.

---

## 5 · Tests añadidos

`src/services/__tests__/db.migration.v59.test.ts` valida:

1. Subida desde V58 con `objetivos_financieros` poblado: el store desaparece, los KPI macro se mergean en `escenarios`.
2. Subida desde V58 sin datos en el store viejo: el store se elimina igualmente, sin romper la migración.
3. Idempotencia: re-abrir la DB en V59 no relanza la migración ni recrea el store viejo.
4. `exportSnapshotJSON()` reporta `metadata.storeCount = 59` y NO incluye `objetivos_financieros` en `metadata.stores`.

---

## 6 · Verificación manual recomendada (Jose)

1. Refrescar `ultimointentohoy.netlify.app`. Esperar a que la subida automática llegue a `DB_VERSION 59`.
2. DevTools → Application → IndexedDB → AtlasHorizonDB:
   - **Versión:** 59.
   - **Almacenamiento de objetos:** 59 (sin `objetivos_financieros`).
3. DevTools → Console:
   ```js
   await window.atlasDB.getDBVersion();   // → 59
   (await window.atlasDB.listStores()).length;  // → 59
   ```
4. Ir a Configuración → Preferencias & Datos → "Exportar datos (.zip)" — descarga ZIP completo.
5. Inspeccionar `atlas-data.json` dentro del ZIP — `metadata.stores` debe listar los 59 nombres.

---

## 7 · Reglas operativas respetadas

- ✅ Cero modificaciones fuera de los 3 hallazgos (no se ha tocado nada del módulo Personal, Inmuebles, Tesorería, Fiscal, etc.).
- ✅ Cero pérdida de datos: merge defensivo preserva KPI macro existentes.
- ✅ Cada fix con test que valida la condición.
- ✅ Reversibilidad: V5.9 es idempotente; si fallara la lectura del store viejo, el delete se hace igualmente vía `onerror` y los defaults aplican.
- ✅ `opexRules` legacy NO eliminado en este PR (decisión Jose pendiente).
- ✅ `ejerciciosFiscales` legacy NO tocado (sustitución gradual ya documentada).

---

## 8 · Próximo paso

Cuando Jose verifique el deploy:

1. Refrescar producción → DB sube a V59 automáticamente.
2. Desde Ajustes o consola, ejecutar `exportSnapshot()` y guardar el ZIP.
3. Compartir el ZIP para arrancar TAREA 3 (snapshot DB) con datos reales y proceder al reset Fase 4.
