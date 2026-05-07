# T-NOMINAS-INVESTIGATE · Mini-auditoría legacy "Importar nóminas"

**Fecha**: 2026-05-07
**Tipo**: solo lectura · sin modificación de código
**Predecesor**: T-OPEX-RECONNECT mergeada
**DB_VERSION**: 69 · 40 stores
**Branch**: `claude/audit-payroll-import-MnoZk`

---

## Resumen ejecutivo

| Pieza | Estado real |
|---|---|
| Botón "Importar nóminas" | **ACTIVO** · ruta funcional, aislada del flujo moderno |
| `ImportarNominas` (página destino) | **ACTIVO** · usa `nominaService` moderno → store `ingresos` |
| `NominaManager.tsx` | **HUÉRFANO REAL** · 0 callers · dead code 100% |
| `nominaAportacionHook` | **MODERNO Y CRÍTICO** · usado por `treasuryConfirmationService` |
| Flujo moderno (Nueva nómina · Card Orange) | **ACTIVO** · NO depende de `NominaManager`. SÍ depende indirectamente de `nominaAportacionHook` (vía treasury) |

**Conclusión clave**: la afirmación de Jose ("NominaManager y nominaAportacionHook se están usando · versión antigua") debe matizarse:

- `nominaAportacionHook` **sí se está usando**, pero NO es legacy: forma parte del pipeline moderno de confirmación de eventos de tesorería (G-07 · pension contribution hook). Es código activo crítico. **NO eliminar**.
- `NominaManager.tsx` **no tiene ningún caller** en el código actual. Es huérfano real. La búsqueda exhaustiva (`grep -rn "NominaManager" src/`) sólo devuelve la propia definición y el `export default`. Eliminar es seguro.
- El botón "Importar nóminas" y su página `ImportarNominas` están **vivos y aislados**: usan `nominaService` (moderno), escriben en el store `ingresos`. No son legacy en el sentido funcional, sólo es un punto de entrada secundario al mismo store que el wizard.

---

## 1. Botón "Importar nóminas"

### Localización

| Elemento | Archivo:línea |
|---|---|
| Botón (label, icono) | `src/modules/personal/PersonalPage.tsx:108` |
| onClick handler | `src/modules/personal/PersonalPage.tsx:111` → `navigate('/personal/importar-nominas')` |
| Definición de ruta | `src/App.tsx:1072-1078` |
| Lazy import | `src/App.tsx:183` → `lazyWithPreload(() => import('./modules/personal/import/ImportarNominas'))` |
| Comentario de origen | `src/App.tsx:182` → "T20 Fase 3b · ImportarNominas re-ubicado per decisión D3 de Jose" |
| Página destino (componente) | `src/modules/personal/import/ImportarNominas.tsx:173-630` |
| Preload de navegación | `src/services/navigationPerformanceService.ts:140-141` |

### onClick → flujo desencadenado

1. `PersonalPage.tsx:111` ejecuta `navigate('/personal/importar-nominas')`.
2. La ruta `App.tsx:1072` renderiza `ImportarNominasPage` (Suspense + lazy import).
3. La página recibe `onComplete` y `onBack` (ambos hardcoded a no-op / history.back).

### Cadena completa de servicios y stores que se desencadenan al importar

`ImportarNominas.tsx` importa:

| Línea | Import |
|---|---|
| `ImportarNominas.tsx:4` | `nominaService` desde `../../../services/nominaService` |
| `ImportarNominas.tsx:11` | `initDB` desde `../../../services/db` |
| `ImportarNominas.tsx:12` | `getBaseMaxima, getSSDefaults` desde `../../../constants/cotizacionSS` |
| externas | `XLSX`, `react-hot-toast` |

Flujo de ejecución al subir un Excel:

1. `XLSX.utils.sheet_to_json()` parsea filas.
2. `normalizeHeader()` (línea 40) normaliza nombres de columna.
3. `buildNominaFromRow()` (líneas 73-171) convierte cada fila a un objeto `Nomina`.
4. `getSSDefaults(currentYear)` (línea 75) provee defaults SS por ejercicio.
5. `db.getAll('accounts')` (línea 315) resuelve la cuenta por defecto.
6. `nominaService.saveNomina(nomina)` (línea 323) persiste cada nómina.

**Store final**: `ingresos` (unificado, con `tipo='nomina'` como discriminador). NO escribe en `nominas` legacy.

### Veredicto

El botón "Importar nóminas" **NO es legacy en sentido estricto**. Su página destino usa el mismo servicio (`nominaService`) y el mismo store (`ingresos`) que el flujo moderno. Es simplemente una entrada alternativa para carga masiva por Excel. La etiqueta "legacy" sólo aplica si el negocio decide retirarla por UX.

---

## 2. NominaManager

### Definición

| Elemento | Archivo:línea |
|---|---|
| Definición del componente | `src/components/personal/nomina/NominaManager.tsx:10` (`const NominaManager: React.FC = () => {`) |
| Export | `src/components/personal/nomina/NominaManager.tsx:293` (`export default NominaManager;`) |

### Callers

`grep -rn "NominaManager" src/` (verificado dos veces) devuelve **únicamente** las dos líneas anteriores. **Cero importaciones, cero usos como JSX, cero rutas que lo carguen.**

```
src/components/personal/nomina/NominaManager.tsx:10:const NominaManager: React.FC = () => {
src/components/personal/nomina/NominaManager.tsx:293:export default NominaManager;
```

### Funcionalidad real (análisis del archivo)

- Líneas 16-38: carga datos vía `nominaService.getNominas()`.
- Líneas 28-30: calcula salario por nómina vía `nominaService.calculateSalary()`.
- Líneas 40-41: navegación a `/gestion/personal/nueva-nomina` (la **ruta moderna del wizard**).
- Líneas 43-53: borrado vía `nominaService.deleteNomina()`.
- UI: lista de nóminas con bruto, neto mensual, neto anual, retenciones.
- Stores: lee `ingresos` indirectamente vía `nominaService` (no toca DB directamente).

### Clasificación de callers

| Caller | Línea | Clasificación |
|---|---|---|
| (ninguno) | — | — |

### Veredicto

`NominaManager.tsx` es **dead code 100%**. Componente UI completo (293 líneas) que apunta a la ruta moderna (`/gestion/personal/nueva-nomina`), nunca instanciado en el árbol de la app. Reemplazado por `TabIngresos` + `IngresosPage` + `NominaWizard` y nunca eliminado.

**Eliminación segura**: SÍ.

---

## 3. nominaAportacionHook

### Definición

| Elemento | Archivo:línea |
|---|---|
| Archivo | `src/services/personal/nominaAportacionHook.ts` (líneas 1-181) |
| `onNominaConfirmada(evento, nomina)` | línea 45 |
| `procesarConfirmacionEvento(evento)` | línea 119 |
| `aportacionesAcumuladasEjercicio(productoId, ejercicio)` | línea 148 |

Cabecera (líneas 1-20): "G-07 · Pension contribution hook". Crea/incrementa `aportacionesPlan` cuando un evento `sourceType='nomina'` pasa a `confirmed`. Idempotente. Reduce base IRPF.

### Callers (verificados con grep cruzado)

| Caller | Archivo:línea | Clasificación |
|---|---|---|
| treasuryConfirmationService — import dinámico | `src/services/treasuryConfirmationService.ts:538` | **MODERNO · CRÍTICO** |
| treasuryConfirmationService — invocación | `src/services/treasuryConfirmationService.ts:539` | **MODERNO · CRÍTICO** |
| Barrel export (re-export) | `src/services/personal/index.ts:21` | **MODERNO · API pública** |
| Comentario referencial en barrel | `src/services/personal/index.ts:10` | comentario |
| Referencia documental en tipos | `src/types/personal.ts:208` | comentario |
| Test `uuid` (import dinámico) | `src/services/personal/__tests__/nominaAportacionHook.uuid.test.ts:38` | **TEST** |
| Test `uuid` (invocación) | `src/services/personal/__tests__/nominaAportacionHook.uuid.test.ts:63` | **TEST** |
| Test `uuid` (segundo escenario, import) | `src/services/personal/__tests__/nominaAportacionHook.uuid.test.ts:93` | **TEST** |
| Test `uuid` (idempotencia) | `src/services/personal/__tests__/nominaAportacionHook.uuid.test.ts:113-114` | **TEST** |

### Funcionalidad real

- Input: `TreasuryEvent` con `sourceType='nomina'` + `Nomina` correspondiente.
- Líneas 50-51: valida que la nómina tenga aportación a plan de pensiones.
- Líneas 66-86: resuelve `productoId` (soporta UUIDs string y IDs numéricos legacy).
- Líneas 88-97: idempotencia (no duplicar aportación de mismo mes/evento).
- Líneas 100-112: crea registro en `aportacionesPlan` con `importeTitular`, `importeEmpresa`, `origen: 'nomina_vinculada'`, `granularidad: 'mensual'`, `ingresoIdNomina` (link al evento).
- Stores leídos: `ingresos` (línea 125), `planesPensiones` (líneas 68, 153).
- Stores escritos: `aportacionesPlan` (línea 100).

### Veredicto

`nominaAportacionHook` está **vivo, activo y crítico**. T-AUDIT-9 lo marcó como huérfano por error: la importación es **dinámica** (`await import('./personal/nominaAportacionHook')`) en `treasuryConfirmationService.ts:538`, lo que un análisis estático de imports puede pasar por alto.

**Eliminación segura**: NO. Tocarlo rompe el cálculo automático de aportaciones a plan de pensiones cuando se confirma un evento de cobro de nómina.

---

## 4. Flujo MODERNO de nóminas (Nueva nómina · Card Orange)

### Pantalla y entrada

| Elemento | Archivo:línea |
|---|---|
| Página Personal · Ingresos | `src/modules/personal/pages/IngresosPage.tsx:23-374` |
| Botón "Nueva nómina" | `src/modules/personal/pages/IngresosPage.tsx:48-54` (onClick línea 50 → `/gestion/personal/nueva-nomina`) |
| Botón "Autónomo" | `src/modules/personal/pages/IngresosPage.tsx:56-63` → `/gestion/personal/nuevo-autonomo` |
| Botón "Otros" | `src/modules/personal/pages/IngresosPage.tsx:64-71` → `/gestion/personal/otros-ingresos` |
| Card Nóminas (CardV5 brand) | `src/modules/personal/pages/IngresosPage.tsx:74-151` |
| Card Autónomos (CardV5 gold) | `src/modules/personal/pages/IngresosPage.tsx:154-233` |
| Card Otros ingresos (CardV5 neutral) | `src/modules/personal/pages/IngresosPage.tsx:236-302` |

### Wizard moderno

| Elemento | Archivo:línea |
|---|---|
| Wizard `NominaWizard` | `src/pages/GestionPersonal/wizards/NominaWizard.tsx` |
| Lazy import | `src/App.tsx:193` |
| Ruta | `src/App.tsx:1118-1121` (`/gestion/personal/nueva-nomina`) |

### Imports del wizard moderno

| Línea | Import |
|---|---|
| `NominaWizard.tsx:4` | `nominaService` |
| `NominaWizard.tsx:5` | `personalDataService` |
| `NominaWizard.tsx:6` | `cuentasService` |
| `NominaWizard.tsx:7` | `planesPensionesService` |
| `NominaWizard.tsx:8` | `getBaseMaxima, getSSDefaults` |

### Display layer moderno

| Elemento | Archivo:línea |
|---|---|
| `GestionPersonalPage` | `src/pages/GestionPersonal/GestionPersonalPage.tsx:36-165` |
| `TabIngresos` | `src/pages/GestionPersonal/components/TabIngresos.tsx:77-476` |
| `TabIngresos` → `nominaService.deleteNomina(id)` | línea 107 |
| `TabIngresos` → `autonomoService.calculateEstimatedAnnual` | línea 165 |
| `TabIngresos` → `pensionService.calculatePension` | línea 192 |
| `TabIngresos` → `otrosIngresosService.calculateAnnualIncome` | línea 224 |

### CRITICAL DEPENDENCY CHECK

Búsqueda explícita: ¿el flujo moderno importa `NominaManager` o `nominaAportacionHook`?

| Archivo del flujo moderno | Importa `NominaManager`? | Importa `nominaAportacionHook`? |
|---|---|---|
| `IngresosPage.tsx` | NO | NO |
| `NominaWizard.tsx` | NO | NO |
| `TabIngresos.tsx` | NO | NO |
| `GestionPersonalPage.tsx` | NO | NO |

**Dependencia indirecta detectada**: cuando un evento de tesorería de tipo `nomina` (creado desde el flujo moderno) pasa a `confirmed`, `treasuryConfirmationService.ts:538-539` invoca dinámicamente `nominaAportacionHook.procesarConfirmacionEvento`. Es decir, **el flujo moderno SÍ depende funcionalmente de `nominaAportacionHook`**, aunque no haya un import estático directo desde ningún componente UI moderno.

→ **STOP-REPORT** sobre `nominaAportacionHook`: NO se puede eliminar.

---

## 5. Tabla de eliminación segura

| Pieza | Tipo | Callers legacy | Callers modernos | Acción sugerida |
|---|---|---|---|---|
| Botón "Importar nóminas" (`PersonalPage.tsx:108`) | UI · header | — | sí (header `PersonalPage`) | **Mantener** (decisión de producto, no técnica). No es legacy técnicamente. |
| Ruta `/personal/importar-nominas` (`App.tsx:1072`) | Routing | — | sí (lazy preload) | **Mantener** mientras el botón exista. |
| `ImportarNominas.tsx` (`src/modules/personal/import/`) | Página · componente | — | sí (ruta `/personal/importar-nominas`, preload `navigationPerformanceService.ts:141`) | **Mantener**. Usa `nominaService` y store `ingresos` modernos. |
| `NominaManager.tsx` (`src/components/personal/nomina/`) | UI · componente | — | — (0 callers) | **ELIMINAR** · dead code confirmado. |
| `nominaAportacionHook.ts` (`src/services/personal/`) | Servicio · hook G-07 | — | sí (`treasuryConfirmationService.ts:538-539` + barrel + tests) | **Mantener · CRÍTICO**. No tocar. |

---

## 6. Riesgos identificados

1. **`nominaAportacionHook` mal clasificado por T-AUDIT-9** · El audit lo marcó huérfano probablemente por usar import dinámico. Recomendación: el script de detección de huérfanos debería detectar también `await import('...')` y `import('...').then`.

2. **Confusión entre dos flujos de "alta" de nóminas vivos a la vez**:
   - Flujo moderno: botón "Nueva nómina" en `IngresosPage` → wizard `/gestion/personal/nueva-nomina`.
   - Flujo masivo: botón "Importar nóminas" en header `PersonalPage` → página `/personal/importar-nominas`.
   - Ambos escriben en el mismo store (`ingresos`) usando el mismo servicio (`nominaService`). No hay conflicto de datos, pero **la UX permite alta por dos vías sin que el usuario lo sepa**. Decisión de producto pendiente: ¿retirar el botón de importar?, ¿unificar dentro del wizard como "paso opcional"?

3. **`NominaManager.tsx` apunta a la ruta moderna** (`navigate('/gestion/personal/nueva-nomina')` en líneas 40-41) → es código que en algún momento fue puente entre el viejo listado y el nuevo wizard, y se quedó colgado. Su existencia genera ruido en el grep y en futuros audits.

4. **No hay tests sobre `ImportarNominas.tsx`** que validen el contrato de columnas Excel ni los SS defaults — eliminar el botón sin reemplazar funcionalidad rompería un flujo no cubierto por tests.

---

## 7. Plan de eliminación recomendado (T-NOMINAS-CLEANUP)

Sólo si Jose confirma que `NominaManager.tsx` no se está usando de ningún modo no detectado (p. ej. desde un módulo en quarantine, un storybook, o documentación).

### Paso A · Eliminar `NominaManager.tsx`

- Borrar `src/components/personal/nomina/NominaManager.tsx` (293 líneas).
- Verificar que la carpeta `src/components/personal/nomina/` no queda con archivos huérfanos; si sí, evaluar limpieza completa de la carpeta.
- Ejecutar `npm run build` y `npm run typecheck` para confirmar 0 referencias.
- Ejecutar `grep -rn "NominaManager" src/` post-eliminación → debe devolver vacío.

### Paso B · NO TOCAR

- `nominaAportacionHook.ts` · activo y crítico.
- `ImportarNominas.tsx` · activo, escribe en store moderno.
- Botón "Importar nóminas" en `PersonalPage.tsx:108` · decisión de producto, no técnica.

### Paso C (opcional, sólo con decisión de producto explícita)

Si Jose decide retirar la entrada masiva de Excel:
- Eliminar botón en `PersonalPage.tsx:107-112`.
- Eliminar lazy import `App.tsx:183`.
- Eliminar ruta `App.tsx:1072-1078`.
- Eliminar componente `src/modules/personal/import/ImportarNominas.tsx`.
- Eliminar preload en `navigationPerformanceService.ts:140-141`.
- Eliminar comentario `App.tsx:182` ("T20 Fase 3b · ImportarNominas re-ubicado per decisión D3 de Jose").

Esto NO afecta a `nominaService` ni al store `ingresos`.

---

## 8. Conclusión final

| Pregunta | Respuesta |
|---|---|
| ¿Se puede eliminar `NominaManager`? | **SÍ**, con seguridad. Dead code, 0 callers verificados. |
| ¿Se puede eliminar `nominaAportacionHook`? | **NO**. Es código moderno crítico (G-07 · pension contribution hook), invocado dinámicamente desde `treasuryConfirmationService.ts:538`. |
| ¿Se puede eliminar el botón "Importar nóminas"? | **DEPENDE** · técnicamente sí (no es legacy en código), pero es decisión de producto. La pieza usa servicios y stores modernos. |
| ¿El flujo moderno depende de "los servicios sospechosos"? | `NominaManager`: NO. `nominaAportacionHook`: SÍ (indirectamente vía treasuryConfirmation). NO eliminar `nominaAportacionHook`. |

---

**Autor**: Claude Code (auditoría automatizada)
**Branch**: `claude/audit-payroll-import-MnoZk`
**Próximo paso**: esperar autorización de Jose para T-NOMINAS-CLEANUP (Paso A únicamente).
