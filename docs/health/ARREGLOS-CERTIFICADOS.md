# ARREGLOS CERTIFICADOS · ATLAS

> **Rango** · VINCULANTE (PROTOCOLO DE GARANTÍA §3)
> **Qué es** · el test de regresión del proyecto. Cada bug arreglado añade una
> fila con un **comando de verificación** y el **valor exacto** que debe
> devolver. `npm run health:regresion` re-ejecuta TODOS los comandos de golpe:
> si alguno deja de dar lo esperado, un arreglo antiguo se ha roto.
>
> **Un arreglo ya no es un recuerdo — es un comando que se puede volver a
> lanzar en cualquier momento, incluso dentro de un año.**

## Cómo añadir una fila

1. Arregla el bug en un PR.
2. Escribe un comando de terminal que DEMUESTRE el arreglo y que devuelva un
   valor estable y exacto (idealmente un número: `… | wc -l` → `0`).
3. Añade la fila abajo. El comando va entre `` ` `` y el esperado entre `` ` ``.
4. Verifica con `npm run health:regresion` que la fila pasa antes de mergear.

Reglas del formato (las parsea `scripts/health.mjs --regresion`):

- El comando debe imprimir EXACTAMENTE el texto esperado (sin líneas extra).
- Prefiere comandos deterministas y de una sola línea de salida.
- El esperado se compara tras `trim()` (se ignoran espacios al principio/fin).

## Hallazgos · falsos positivos de la auditoría

**Hallazgo nº 2 de `AUDIT-ESTADO-REAL-2026-07` (lecturas a stores inexistentes) ·
FALSO POSITIVO de grep.** La auditoría marcó `migracionGastosService.ts:29,142`
(`getAll('fiscalSummaries')` / `getAll('operacionesFiscales')`) como riesgo de
`NotFoundError`. En realidad **ambas lecturas ya estaban guardadas** con
`db.objectStoreNames.contains('<store>')` (líneas 28 y 141) **desde antes de
`f97122b`** — la auditoría grepó el literal `getAll` sin ver el guard de la línea
anterior. Un `getAll` guardado no puede lanzar `NotFoundError`.

**Los bloques NO deben borrarse.** El comentario *"store deleted in V4.2 — skip
if absent"* indica que estos stores pudieron existir físicamente en DBs
**antiguas**; en esas DBs `contains()` es `true` y la migración corre, llevando
datos legacy reales a `gastosInmueble`. Borrarlos = posible pérdida de datos de
migración. Cero cambios de código en el Arreglo 1.

Consecuencia: el indicador `lecturas_store_inexistente` se recalibró (2 → 0,
autorizado por Jose antes de la tarea, registrado en `recalibraciones` del JSON)
para NO contar lecturas guardadas por nombre de store. Las dos filas de abajo
protegen los guards: si alguien los borra, la regresión falla.

**Hallazgo · punto ciego del indicador `enlaces_rotos` (`onNavigate`).** El
regex del indicador casa `navigate(` pero NO `onNavigate(` (N mayúscula), ni
rutas guardadas en variables, ni ciertos template strings. Toda esa clase de
destinos de navegación es invisible a la métrica. Destinos rotos hallados vía
`onNavigate` (todos en componentes muertos): `IncomeExpensesBlock:72`,
`FlujosGrid:151`, `TresBolsillosGrid:79` (todos `/inmuebles/cartera` · mismo
destino confirmado · YA corregidos a `/inmuebles`) y `TaxBlock:53`
(`/fiscalidad/estado`, ruta inexistente · **PENDIENTE bloque 3**, junto con la
decisión de si el componente muerto sobrevive · destino desconocido, no se
inventa).

Plan (autorizado por Jose): NO ampliar la definición ahora. Tarea aparte
**antes del bloque 2** · auditar las 16 definiciones buscando puntos ciegos
equivalentes (rutas en variables, template strings, `Link to=`, `href`
dinámicos, cualquier patrón que el regex no vea). Al ampliar, si el número sube,
ese es el NUEVO BASELINE, no una regresión (regla asimétrica · ver GOBERNANZA en
`scripts/health.mjs`).

## Registro

| Fecha | Qué se arregló | Comando de verificación | Esperado |
|---|---|---|---|
| 2026-07-18 | Guard de existencia de `fiscalSummaries` en migracionGastosService (no borrar · migra DBs antiguas) | `grep -c "objectStoreNames.contains('fiscalSummaries')" src/services/migracionGastosService.ts` | `1` |
| 2026-07-18 | Guard de existencia de `operacionesFiscales` en migracionGastosService (no borrar · migra DBs antiguas) | `grep -c "objectStoreNames.contains('operacionesFiscales')" src/services/migracionGastosService.ts` | `1` |
| 2026-07-18 | Enlaces de navegación rotos corregidos (grep de aceptación · excluye tests · el residuo `1` es TaxBlock `/fiscalidad/estado`, muerto, pendiente bloque 3) | `grep -rnE "'/portfolio'\|'/treasury'\|'/settings'\|'/tax'\|'/fiscalidad/" src --include=*.ts --include=*.tsx \| grep -vE "\.test\.\|__tests__\|\.spec\." \| wc -l` | `1` |
