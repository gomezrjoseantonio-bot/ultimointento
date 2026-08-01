# DEUDA · recálculo en cascada de previsiones

**Abierta:** 1 agosto 2026 · Tesorería V6 · adenda 02 D6b, confirmada en adenda 03
**Estado:** no resuelta · **fuera del alcance de la V6, por decisión de Jose**
**Prioridad:** la siguiente después de la V6

---

## El hueco, dicho sin rodeos

**Hoy el producto no reacciona automáticamente a los cambios que afectan a sus previsiones.**

Si el usuario sube la renta de un contrato, amortiza un préstamo o cambia el importe de un gasto
recurrente, las previsiones ya generadas **se quedan como estaban**. Nadie las regenera.

Hasta ahora eso se tapaba con un botón manual —"regenerar" en `/conciliacion`— que trasladaba al
usuario una carga que es del sistema. La V6 retira `/conciliacion` y **no se lleva el botón**,
porque pedirle a alguien que pulse "regenerar" es admitir que la aplicación no se entera de sus
propios cambios. Retirarlo no crea el hueco: lo deja a la vista.

Es un problema de arquitectura, no de interfaz.

## Qué se verificó (adenda 02 · D6b)

| Pregunta | Respuesta |
|---|---|
| ¿Existe hoy alguna cascada, aunque sea parcial? | **No.** `regenerateMonthForecast()` tenía **un solo llamador en toda la aplicación**: `ConciliacionPageV2.tsx:116`, el botón. Ningún servicio la invocaba |
| ¿Pisa la función lo confirmado, conciliado o descartado? | **No, y por diseño.** Ver abajo |

`regenerateMonthForecast()` **no se ha borrado**. Se queda sin llamador de usuario, lista para que la
cascada la invoque cuando exista.

## Lo que ya está a favor

La función es **puramente aditiva**. `buildExistingIndex` (`treasuryForecastService.ts:458`) monta un
índice de lo que ya existe en el mes, y los tres `regenerate*Forecast` **solo crean lo que falta**:
el resultado son tres contadores `*Created` y no hay un solo `put` ni `delete` sobre eventos
existentes. Un confirmado, un conciliado o (desde v84) un descartado bloquean su propia clave y no
se recrean.

Es decir: la garantía innegociable de "solo toca `predicted`" **ya se cumple**, y se cumple por
construcción, no por una comprobación que alguien pueda olvidar.

## Lo que haría falta construir

### Disparadores

| Cambia | Se regenera |
|---|---|
| Contrato · alta, baja, renta, fechas, indexación | Previsiones de renta del periodo afectado |
| Préstamo · alta, amortización, cambio de cuota, liquidación | Previsiones de cuota |
| Gasto recurrente del inmueble · alta, baja, importe, periodicidad | Previsiones de ese gasto |
| Alta o baja de cuenta o de inmueble | Lo que cuelgue de ellos |

### Garantías innegociables

1. **Solo toca `predicted`.** Jamás confirmados, conciliados ni descartados. Lo que ya afirmó el
   usuario o el banco es intocable. Hoy se cumple por construcción; cualquier rediseño de la función
   tiene que conservarlo.
2. **Solo el periodo afectado**, nunca todo el histórico.
3. **Silencioso.** Sin modal ni toast celebratorio. Los números nuevos se ven en los KPIs y en
   "Cómo va {mes}", que ya se recalculan en vivo (§4.6).

### Una fisura que hay que arreglar antes

`regenerateMonthForecast` filtra los eventos del mes con `e.actualDate ?? e.predictedDate`
(`treasuryForecastService.ts:701`) pero construye el índice con `isInMonth(ev.predictedDate)`
(`:462`). Un evento **previsto en marzo y confirmado en abril** entra en el conjunto de abril pero
**no entra en el índice de abril**, así que su previsión de marzo podría recrearse: un duplicado de
algo que ya ocurrió.

Hoy no muerde porque solo lo dispara un botón que va a desaparecer. En cuanto la cascada lo llame
sola y a menudo, será lo primero que aparezca. **Arreglarlo es el paso cero de esa tarea**, no un
detalle posterior.

## Por qué no se hizo en la V6

Porque la adenda 02 lo dejó por escrito: *"Si la cascada no existe hoy —es decir, si el botón era de
verdad el único mecanismo— entonces esto no cabe en la V6: es una tarea propia de arquitectura
(disparadores + alcance de recálculo + garantías de no pisar lo confirmado). En ese caso: para y
reporta, y la V6 se entrega sin botón y sin cascada nueva, dejando la deuda escrita y aislada."*

Y porque la alternativa —colar un botón "regenerar" en la interfaz nueva— habría tapado el hueco
haciéndolo más difícil de ver, que es justo lo contrario de lo que hace falta.
