# STOP-REPORT · TESORERÍA V6 · verificaciones de la adenda 02

**Fecha:** 1 agosto 2026
**Adenda:** `docs/ADENDA-02-TESORERIA-V6.md`
**Estado:** 🟡 **parcial** · D1 bis implementado · **D1 (hash de línea) y D6b paran y reportan**

La adenda 02 responde las cinco decisiones y abre **tres verificaciones nuevas**. Las tres están
hechas. Una sale limpia y se ha implementado; **dos disparan el stop que la propia adenda pide**.

---

## Gate D1 bis · idempotencia por fichero · ✅ IMPLEMENTADO

**Verificación pedida:** quién llama al camino de `treasuryApiService.ts:563` antes de darlo por
muerto; si tiene llamadores vivos fuera de tesorería, parar.

**Resultado: no tiene ningún llamador.** `TreasuryImportAPI` se exporta dentro de `treasuryAPI`,
pero el único consumidor de ese objeto (`modules/inmuebles/wizards/NuevoContratoWizard.tsx:157`)
usa **solo `treasuryAPI.accounts.getAccounts()`**. Búsqueda de `treasuryAPI.import` y
`TreasuryImportAPI.` fuera del propio fichero: cero resultados. **No hay stop**, y no hace falta
retirarlo aquí: basta con no construir sobre él. Su limpieza puede ir en la tarea de higiene.

**Implementado**, que la adenda marca como no opcional:

- `bankStatementOrchestrator.ts` calcula `hashLote` con `generateBatchHash` (import diferido) y lo
  persiste. Se acabó el `hashLote: ''` con el *"out of scope for T17"*. **Una sola
  implementación**: se reutiliza la que ya existía, no se ha escrito otra.
- Si el hash ya consta, `processFile` lanza `StatementAlreadyImportedError` **antes de parsear e
  insertar nada**, con fecha y nombre del import previo para que la UI pueda avisar. Continuar
  exige `allowReimport: true`, que es la confirmación explícita del usuario, y deja un warning en
  el resultado.
- Cubierto por tests: el segundo intento se planta sin tocar `movements` ni dejar un `importBatch`
  huérfano; con `allowReimport` pasa y la dedup por línea sigue absorbiendo las 14 repetidas.

### Un arreglo colateral necesario

`generateFallbackHash` (la rama sin `crypto.subtle`) llamaba a `file.text()` a pelo. Donde no
existe —jsdom, y navegadores en contexto no seguro— **lanzaba**, así que la ruta de respaldo no
respaldaba nada. Ahora lee por `text()` o `arrayBuffer()` y, si no hay forma de leer los bytes,
**devuelve `''` en vez de inventar un hash con nombre+tamaño**.

Es deliberado: aquí un hash malo es peor que ninguno. Dos extractos distintos del mismo banco y mes
pueden compartir nombre y tamaño, y un falso positivo **bloquearía una importación legítima**. Con
`''` se degrada al comportamiento anterior (sin idempotencia por fichero) en lugar de rechazar un
extracto bueno. `findBatchByHash` ignora el hash vacío, así que los batches pre-V6 —todos con
`hashLote: ''`— tampoco pueden dar falso positivo.

---

## Gate D1 · hash de línea · ⛔ PARA

**Verificación pedida:** que el hash de línea use *"la misma función de normalización que use el
emparejamiento, para que no haya dos criterios de identidad de línea. Si no existe una única,
reporta."*

**No existe una única. Existen cuatro, y ninguna dos coinciden:**

| Dónde | Qué hace | Resultado sobre `"Recibo LUZ 03/2026 - Iberdrola"` |
|---|---|---|
| `bankStatementOrchestrator.ts:421` `hashMovement` | solo `.trim()` | `Recibo LUZ 03/2026 - Iberdrola` |
| `utils/duplicateDetection.ts` `normalizeDescription` (privada) | minúsculas · NFD · sin acentos · puntuación→espacio | `recibo luz 03 2026 iberdrola` |
| `services/compromisoDetectionService.ts:162` `normalizeDescription` (exportada) | MAYÚSCULAS · quita dígitos y todo lo no-letra · solo palabras ≥3 · **corta a 3 palabras** | `RECIBO LUZ IBERDROLA` |
| `services/movementMatchingService.ts:170` (el emparejamiento) | `.toLowerCase()` a secas | `recibo luz 03/2026 - iberdrola` |

(Y hay una quinta para búsqueda de UI, `utils/tesoreriaSearch.ts` `normalizeSearchText`, que no
compite pero confirma el patrón.)

Lo relevante es que **el emparejamiento —el criterio que la adenda manda reutilizar— es el más
pobre de los cuatro**: un `toLowerCase()` suelto, sin quitar acentos ni normalizar espacios. Si
`hashLinea` se calcula con eso, dos líneas idénticas salvo un acento o un espacio doble producen
hashes distintos y la línea ignorada reaparece igualmente. Sería cumplir la letra de D1 y perder su
propósito.

**No elijo por mi cuenta.** Las opciones, con su coste:

1. **Extraer una `normalizarConceptoBancario()` única** y usarla en el emparejamiento *y* en el
   hash de línea. Es lo correcto, y es lo que pide el espíritu de D1. Pero **cambia el
   emparejamiento**, que hoy casa movimientos con previstos en producción: normalizar mejor cambia
   qué casa y qué no. Eso necesita su propia validación, y §3 dice no tocar lo que ya funciona sin
   pedirlo.
2. **Reutilizar tal cual el `toLowerCase()` del emparejamiento.** Cumple D1 al pie de la letra, no
   toca nada, y deja el ignorado frágil ante acentos y espacios.
3. **Usar `duplicateDetection.normalizeDescription`** (la más razonable de las que ya existen:
   minúsculas, sin acentos, puntuación colapsada) solo para `hashLinea`, y dejar el emparejamiento
   como está. Rompe la regla de "una sola identidad de línea", pero de forma acotada y sin tocar
   producción.

Mi lectura: la 1 es la buena a medio plazo pero **no cabe en la V6 sin una tarea de validación del
emparejamiento**; la 3 es la entrega pragmática. La 2 la desaconsejo — es cumplir el trámite.

**Mientras tanto:** el campo `ImportBatch.lineasIgnoradas` **ya está declarado** en el bump v84 con
la forma exacta que fijó la adenda, así que la decisión no obliga a un segundo bump. Lo que falta
es el escritor, que es justo lo que depende de esta elección.

---

## Gate D6b · cascada de recálculo · ⛔ PARA · **la cascada NO existe**

**Verificación pedida:** *"¿existe hoy esa cascada, aunque sea parcial, o el único camino era el
botón manual? Y ¿garantiza la función que no pisa confirmados/conciliados/descartados?"*

### 1 · ¿Existe la cascada? **No. Ni parcial.**

`regenerateMonthForecast()` tiene **exactamente un llamador en toda la aplicación**:
`ConciliacionPageV2.tsx:116`, el botón manual. Ningún servicio la invoca. Ninguno de los
disparadores de la tabla de la adenda —contrato, préstamo, gasto recurrente, alta/baja de cuenta o
inmueble— la llama al cambiar.

Así que se aplica literalmente lo que escribiste: *"Si la cascada no existe hoy… esto no cabe en la
V6: es una tarea propia de arquitectura. En ese caso: para y reporta, y la V6 se entrega sin botón
y sin cascada nueva, dejando la deuda escrita y aislada."*

**Eso es lo que haré**, salvo que digas otra cosa: V6 sin botón, sin cascada, y la deuda anotada
aquí. Lo que **no** se hace es colar un "regenerar" en la interfaz nueva para tapar el hueco.

### 2 · ¿Pisa lo confirmado? **No, y por diseño.**

Buena noticia para el día que se construya la cascada: la función es **puramente aditiva**.
`buildExistingIndex` (`treasuryForecastService.ts:458`) monta un índice de lo que ya existe en el
mes y los tres `regenerate*Forecast` **solo crean lo que falta** — el resultado son tres contadores
`*Created`, no hay ni un `put` ni un `delete` sobre eventos existentes. Un confirmado, un conciliado
o (con v84) un descartado bloquean su propia clave y no se recrean.

**Con una fisura**, que dejo señalada porque será la primera piedra cuando se aborde la cascada:
el filtro del mes usa `e.actualDate ?? e.predictedDate` (`:701`) pero el índice se construye con
`isInMonth(ev.predictedDate)` (`:462`). Un evento previsto para marzo y confirmado en abril entra
en el conjunto de abril pero **no entra en el índice de abril**, así que su previsión de marzo
podría recrearse. No lo toco: hoy solo lo dispara un botón que va a desaparecer, y arreglarlo sin
cascada es tocar el motor de previsiones sin necesidad.

---

## Lo que va en este PR

- **Bump a v84** con los campos aprobados, sin stores ni índices nuevos y sin migración de datos
  (opcionales · no-op en upgrade · sin post-open), igual que V79 y V83:
  - `TreasuryEvent.descartado` · `descartadoAt` · `motivoDescarte`
  - `ImportBatch.lineasIgnoradas[]` (`hashLinea` + `ignoradaAt`)
- **`hashLote` activo** + `StatementAlreadyImportedError` + `allowReimport`, con tests.
- **`generateFallbackHash` endurecido** (degradación segura a "sin hash").
- Adenda 02 archivada y este informe.

## Lo que NO va, y por qué

- **El escritor de `lineasIgnoradas`** · depende de la decisión de normalización (gate D1).
- **Cualquier cascada de recálculo** · no existe hoy, y la adenda la saca de la V6 en ese caso.
- **El atajo del Panel** (`AccionesRapidas.tsx:39` → drawer de extracto) · necesita que el drawer de
  §4.7 exista; va con él.
- **Las 5 fricciones de `PunteoList`** (D2 bis, aprobadas) y el resto de §4 · siguientes, en cuanto
  D1 esté resuelto, para no rehacer la ficha dos veces.
- **Las 13 traducciones de D3** · siguen `PENDIENTE-JOSE`; son propuesta razonada tuya, pendiente de
  validación una a una, y el candado del test las mantiene sin `categoryKey`.

## Nota aparte · un test rojo que ya venía roto

`src/tests/fixExtractosIntegration.test.ts` no arranca: `TypeError: Cannot redefine property:
crypto` (línea 48, hace `Object.defineProperty(global, 'crypto', …)` sobre una propiedad no
configurable en el jsdom actual). **Verificado que falla igual en `main` sin mis cambios**, así que
ya está en el baseline del trinquete y no es regresión de este PR. No lo arreglo aquí porque toca
entorno de test y no tesorería, pero conviene saber que la cobertura de `batchHashUtils` que ese
fichero pretendía dar **no se está ejecutando** — justo el módulo que D1 bis acaba de poner en la
ruta crítica.

## Qué necesito

1. **D1** · ¿opción 1 (normalización única, con validación del emparejamiento en tarea aparte),
   2 (reutilizar el `toLowerCase()` tal cual) o 3 (usar `duplicateDetection` solo para el hash de
   línea)?
2. **D6b** · confirmar que V6 se entrega sin botón y sin cascada, con la deuda escrita.
3. **D3** · validar o corregir las 13 traducciones propuestas.

Con la 1 cierro el ignorado y sigo con §4 y las fricciones de `PunteoList`.
