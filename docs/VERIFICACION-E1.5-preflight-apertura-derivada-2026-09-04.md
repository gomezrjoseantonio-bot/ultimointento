# PREFLIGHT · §31 · la apertura derivada (no inventada)

**Fecha:** 4 sep 2026 · **Base:** `65df6c2` (`main`) · **Método:** lectura del código. `npx tsc --noEmit` pasa limpio en la base.

Convención: **[V]** verificado leyendo la línea citada · **[D]** deducido de dos o más hechos verificados.

Las decisiones de producto del encabezado de la tarea (§31, decidido por Jose) **no se re-preguntan**: esto verifica *dónde* y *cómo* aplicarlas. Las referencias `§9`/`§20`/`§30`/`§31` son del documento de modelo de Jose, que no está en el repo.

---

## 1 · Cómo se define HOY la apertura y quién la usa

1. **[V] Dos campos en `accounts`:** `openingBalance` (número) y `openingBalanceDate` (ISO). `cuentasService.ts:54-55`, `:451-453`. Al crear, la fecha cae a `new Date().toISOString()` si no se manda (`:453`).
2. **[V] El único cálculo del saldo es `calculateAccountBalanceAtDate`** (`accountBalanceService.ts:169-181`): el saldo de apertura **solo aplica si su fecha es ≤ el corte** (`:170-171`) y **todo lo anterior a esa fecha NO suma** (`isAfterOpening`, `:179-181`). Es decir: la fecha de apertura es una **frontera**, y mover la apertura hacia delante **tira** todo lo que quede detrás.
3. **[V] Si la apertura no es 0, `cuentasService.create` escribe además un movimiento sintético** `isOpeningBalance` (`:478-503`), que el hub excluye del sumatorio para no contarlo dos veces.
4. **[D] De ahí el fallo del modelo anterior:** preguntar «saldo de apertura» → el usuario pone 0 → el hub arranca en 0 y suma solo lo posterior. Con el extracto real de Santander de la raíz del repo, ATLAS calcula **−3.434,31 €** donde el banco dice **53.512,05 €** (test `aperturaDerivada.ficheroReal.test.ts`).

## 2 · El flujo de CREAR cuenta

5. **[V] Un único formulario:** `CuentaWizard.tsx`, bloque «B4 · Saldo inicial» (importe + «A fecha»), que viaja a `openingBalance` / `openingBalanceDate` tanto en create como en update (`:576-577`, `:589-590`). La fecha **ya defaulteaba a hoy** (`buildInitialForm`, `:217`), pero se pedía como dato editable con el rótulo de «apertura», que es justo lo que invita a inventarse un día antiguo con saldo 0.
6. **[V] `ImportarCuentas.tsx`** (alta masiva por plantilla) también escribe `openingBalanceDate`. Queda **fuera** de esta tarea: ahí el usuario declara una fecha por fila a conciencia.

## 3 · El parser expone lo que hace falta para derivar

7. **[V] `saldo` por línea:** `bankParser` detecta la columna SALDO (`:43-45`) y la lee como número (`:721`, `:731` → `ParsedMovement.balance`); `lineasExtractoService.ts:63` la persiste como `LineaExtractoPersistida.saldo`. Depende del fix del parser (#1851), ya mergeado.
8. **[V] `importe` y `fechaOperacion` por línea:** `bankStatementOrchestrator.insertLineas` (`:565-583`) los resuelve con `isoDate` y los persiste. **Hay, por tanto, los tres datos que §31 necesita.**
9. **[V] El orden dentro de un mismo día se conserva** (`filaOriginal`, `bankParser.ts:650` → `lineasExtractoService.ts:67`), que es lo que permite saber cuál es la **primera** operación del día más antiguo (Santander lista de nuevo a viejo).

## 4 · Dónde más se usa `openingBalanceDate` · efecto de moverla HACIA ATRÁS

La tarea pide reportar si la fecha de apertura se usa en sitios no previstos. Se usa en seis, y **retroceder** (nunca adelantar) es seguro o mejora en todos:

| sitio | qué hace con la fecha | al retroceder |
|---|---|---|
| `accountBalanceService.ts:169-181` | frontera del saldo | **[D]** cuenta MÁS historial · es el objetivo |
| `presupuestoAnualService.ts:543-554` | `MÁX(openingBalanceDate)` como ancla del presupuesto | **[V]** el ancla se fija **una vez** y se congela en `keyval` (`:526-531`, `:556-574`): una apertura que retrocede después **no la mueve** |
| `compromisosRecurrentesService.ts:607-610` | no emite previsiones antes de la apertura | **[V]** toma `MAX(apertura, arranque de la proyección)`: retroceder por debajo del arranque es **no-op** |
| `migrations/limpiarPrevistosAntesDeLaApertura.ts` | borra previsiones anteriores a la apertura | **[D]** retroceder hace que borre **menos** · nunca más |
| `propertySaleService.ts:941-943` | una venta anterior a la apertura es «prehistoria» (no genera tesorería) | **[D]** una venta que caiga **después** de la nueva apertura pasaría a generar movimiento. Solo afecta a ventas registradas **tras** el cambio; las ya guardadas no se recalculan |
| `atlasExportService.ts:509` | columna `fecha_saldo_inicial` del export | **[D]** exporta la fecha nueva · correcto |

**[D] Ningún uso fiscal.** `grep openingBalanceDate` no aparece en ningún servicio de IRPF/AEAT. La proyección sí la usa, pero a través del hub (`proyeccionMensualService.ts:996` → `calculateTotalInitialCash`), así que hereda el saldo correcto sin lógica propia.

## 5 · El cambio que se implementa

10. **Crear cuenta** → «Saldo de hoy · ¿Cuánto tienes hoy?»; la fecha es **hoy** y no se pregunta (al editar sí se ve y se puede corregir).
11. **Al importar** → `aperturaDerivada.ts` (sustituye a `anclajeSaldoExtracto.ts`) mira los **dos extremos** del fichero:
    - línea más antigua **anterior** a la apertura → `retroceso`: apertura = `saldo − importe` de esa línea, en su fecha;
    - fichero dentro de lo ya cubierto → `ajuste`: la **fecha no se mueve** (moverla adelante tiraría historia) y se corrige el importe con el descuadre.
12. **El aviso de descuadre (§20) se mantiene** y se calcula, como antes, sobre la línea **más reciente**. Nada se escribe sin que el usuario marque la casilla (§9): `aplicarApertura` solo se llama al Guardar y solo si está marcada.
