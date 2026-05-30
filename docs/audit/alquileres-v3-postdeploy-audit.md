# Auditoría post-deploy · modelo alquileres v3 · diagnóstico Commit 1

> Fecha · 30 may 2026 · rama `claude/relaxed-wozniak-5h9hK` · sobre `main` con PR #1400 ya mergeado.
> Tarea · FIX modelo alquileres v3 post-deploy · 6 bloques. **Commit 1 · solo auditoría · sin tocar código.**

## Tabla de verificación (§0.3)

| # | Verificación | Resultado | Acción |
|---|---|---|---|
| 1 | `Property.modoExplotacion` declarado en interface | **SÍ** · `db.ts:166` (`'piso_completo' \| 'por_habitaciones' \| 'mixto'`) | OK |
| 2 | Migración `alquilerPorHabitaciones.activo → modoExplotacion` existe | **SÍ** · `db.ts:4873-4887` (Paso B del hook post-upgrade v78) | OK en código · ver diagnóstico H1 |
| 3 | Flag idempotente de esa migración | Flag es **`migration_v78_alquileres`** (`db.ts:4869`), **NO** `_modoExplotacionMigratedFromBoolean` como asumía la spec · es un único flag para Pasos B+C+D | Ver diagnóstico |
| 4 | DB_VERSION subió tras spec v3 | **SÍ** · `78` (actual = esperado) | **NO hace falta bump nuevo** |
| 5 | `derivarModoExplotacionDelXml` existe | **NO EXISTE** · el ruteo usa `decidirRutaArrendamiento(property.modoExplotacion, nifs.length)` (`declaracionDistributorService.ts:149,188`) con default `piso_completo` y decide **por bloque** | **Causa de H1** · implementar en Commit 2 |
| 6 | `crearOActualizarBote` persiste `nifsDetectados` | **SÍ** · `boteAnualService.ts:113,126`; el orquestador además agrega los NIFs por bote (`declaracionDistributorService.ts:209`) | **H2 NO es bug de servicio** (ver discrepancia) |
| 7 | Pestaña "Sin identificar" existe | **NO** · `ContratosListPage.tsx:37` → `VALID_TABS = ['disponibilidad','tablero','activos','historico']` | Crear en Commit 5 |
| 8 | `crearOActualizarContrato` divide renta entre nº NIFs | **NO** · `declaracionOnboardingService.ts:1002` → `Math.round(ingresosAnuales / 12)` sin dividir | **H4 NO es bug de división** (ver discrepancia) |
| 9 | Parser XML extrae `fechaContrato` | **SÍ** · `irpfXmlParserService.ts:507` (`TAFECHACONTRATO`), `:535` (`C_FECHACONTRATO1`), `aeatParserService.ts:1056` (`0093`) | OK para Extra 1 |
| 10 | Servicio import Rentila existe | **SÍ** · `contractsImportService.ts:103` (`importContractsFromRentilaRows`) → `saveContract` sin hook post-create | Añadir hook en Commit 6 |

---

## Diagnóstico prioritario · H1 (CRÍTICO)

**Síntoma** · FA32 (id=4, `alquilerPorHabitaciones.activo:true`, SIN `modoExplotacion`) creó el Contract "Fuertes Acevedo" en vez de ir todo al bote.

### Causa raíz · doble fallo

**(A) El ruteo depende EXCLUSIVAMENTE del campo persistido `modoExplotacion`, sin fallback.**
`decidirRutaArrendamiento(modo, nifs)` hace `const modo = modoExplotacion ?? 'piso_completo'`. Si la property NO tiene `modoExplotacion` poblado:
- ignora el legacy `alquilerPorHabitaciones.activo` (que SÍ está en `true` para FA32),
- y trata el inmueble como `piso_completo`.

Como además **rutea bloque a bloque**, FA32 2024 se parte:
- TAR1 (2 NIFs LAU) → `piso_completo` + NIF → **Camino 1** → crea "Fuertes Acevedo" ❌
- TAR2 (0 NIFs turístico) → **Camino 2** → bote.

`derivarModoExplotacionDelXml` (que la spec asume existente para detectar `mixto` mirando el conjunto de bloques) **no se implementó** en el PR #1400.

**(B) Nada fuera de la migración one-shot puebla `modoExplotacion`.**
El campo solo se setea en el Paso B de la migración v78, que corre **una vez** (flag `migration_v78_alquileres='completed'`). El flujo de import/prefill del wizard sí escribe `alquilerPorHabitaciones.activo` (`declaracionDistributorService.ts:583`) pero **nunca** deriva `modoExplotacion`. Los `db.put('properties', …)` del import preservan el campo (usan `{ ...property }`, líneas 574 y 862), así que **no lo borran**; el problema es que **nunca se crea** si:
  - la property se creó/editó (activó "por habitaciones" en el prefill) **después** de que la migración ya marcara el flag, o
  - la property no existía cuando corrió la migración (creada por el propio import), o
  - el Paso B abortó antes de llegar a FA32 (toda la iteración va en un único `try/catch`; si un `store.put` falla, el resto no migra pero el flag igualmente se marca `completed` → no reintenta).

**Conclusión** · re-correr la migración corrige el *snapshot* (FA32 pasaría a `por_habitaciones`), pero **no cierra la brecha**: cualquier inmueble que active "por habitaciones" en un import futuro volverá a mis-rutearse. El fix robusto (Commit 2) debe:
1. Re-correr la migración (resetear flag y reintentar, con `try/catch` por property).
2. Hacer que el ruteo **no dependa solo del campo persistido**: derivar en tiempo de import desde (a) el legacy `alquilerPorHabitaciones.activo` y (b) la estructura de bloques del XML (`mixto`) → implementar `derivarModoExplotacionDelXml` + fallback al boolean.
3. Que el prefill que activa "por habitaciones" también setee `modoExplotacion` (cerrar la brecha de origen).

---

## ⚠️ Discrepancias con la spec (§11 · reportar, no inventar)

### H2 · `nifsDetectados: []` — NO es un bug de servicio
`crearOActualizarBote` **sí** persiste `nifsDetectados` y el orquestador **sí** agrega los NIFs por bote. Los arrays vacíos son **consecuencia de H1** + de que la mayoría de bloques no traen NIF:
- FA32 2024: los 2 NIFs estaban en TAR1, que se mis-ruteó a Camino 1 → el bote solo recibió TAR2 (sin NIF) → `[]`.
- T48 y otros: el XML no trae NIF en esos bloques → `[]` es correcto.

→ Una vez arreglado H1 (FA32 entero al bote), el bote 2024 recibirá los 2 NIFs de TAR1 automáticamente. **No hay que “arreglar” el servicio**; sí conviene (Commit 3) un test defensivo + repoblar los botes ya creados (data migration). El `importeDeclarado / nifs.length / 12` que la spec §4.1 menciona **no existe en el código**.

### H4 · renta 713 € — NO es división entre NIFs
El cálculo es `Math.round(ingresosAnuales / 12)` sin dividir (`declaracionOnboardingService.ts:1002`). El `713 €` = `round(8550 / 12)` = renta del bloque **TAR1 2024 (8.550 €)** mis-ruteado a Camino 1. Es decir, **H4 también es consecuencia de H1**, no un bug de cálculo. Al eliminar "Fuertes Acevedo" (mal ruteado), el problema desaparece. Los Contracts Camino 1 legítimos (CB CONCEPCIÓN, IVAN) ya calculan `ingresos/12` correctamente.

---

## Resumen para autorización

- **H1** · bug real y crítico → fix en Commit 2 (re-migración + derivación robusta XML/boolean + limpieza de "Fuertes Acevedo").
- **H2** · servicio correcto; arrays vacíos = consecuencia de H1. Commit 3 = test defensivo + repoblar botes existentes.
- **H3** · pestaña "Sin identificar" no existe → Commit 5.
- **H4** · cálculo correcto; el 713 € = consecuencia de H1, no división. Commit 4 mantiene `ingresos/12` + añade Extra 1 (LAU 5 años).
- **Extra 1** · `fechaContrato` disponible en el parser → factible.
- **Extra 2** · servicio Rentila existe sin hook → Commit 6.
- **DB** · no requiere bump nuevo; sí re-correr la migración v78.

**Punto a decidir con Jose (afecta a Commit 2):** ¿FA32 debe quedar en `por_habitaciones` (derivado del boolean, ya va a bote) o auto-corregir a `mixto` al detectar bloques con y sin NIF en 2024? La spec §1.3 propone NO auto-sobreescribir y emitir aviso en el paso 10. Lo confirmo antes de implementar.
