# Modelo operativo de tesorería · el ciclo del apunte de extremo a extremo

**Estado: BORRADOR v2 · Jose respondió §13 (19 ago 2026); incorporado. Falta
cerrar SOLO la taxonomía (§13.5) y el marcado de bonificación (§13.9). NO se toca
código hasta que eso esté acordado.**

Este documento fija QUÉ pasa con el dinero desde que se prevé hasta que se
concilia: previsión → confirmación → conciliación, la subida de ficheros, el
emparejamiento, los métodos de pago, el saldo, el gráfico del mes, el anexo de
facturas y el cierre. El **vocabulario** (qué es una cuenta, un método de pago,
una tarjeta, un traspaso) ya está fijado en [`VOCABULARIO-dinero.md`](./VOCABULARIO-dinero.md)
y **manda**: aquí no se redefine, se referencia. Si algo choca, se corrige aquí
o allí ANTES de tocar el código.

Nace de una sesión de pruebas de Jose (18–19 ago 2026) en la que el modelo real
incumplía cosas básicas: el gráfico contaba los traspasos como gasto, el saldo
de una cuenta salía en −16.241 €, no se podía marcar una transferencia a una
cuenta propia, y la clasificación que el usuario ponía no se veía. Este
documento existe para que eso deje de pasar por diseño, no por parches.

---

## 0 · Principios (de aquí cuelga todo lo demás)

1. **Un evento económico = una sola fila.** Si el mismo cobro/pago aparece dos
   veces (la previsión y la línea del banco, o dos líneas del import), está mal.
2. **Previsión ≠ realidad.** Lo previsto orienta; el **saldo real** solo cuenta
   lo que ha ocurrido de verdad. Una previsión NUNCA mueve el saldo de hoy.
3. **Tu clasificación manda; el texto del banco es la prueba.** Lo que tú
   defines (familia, ámbito, inmueble) es el dato con el que se cuadra y se
   cruza con la factura. El concepto literal del banco se conserva como
   evidencia, no como verdad.
4. **Un traspaso no es ni gasto ni ingreso.** Mover dinero entre TUS cuentas no
   cambia tu patrimonio: no puede contar como gasto en ningún gráfico ni hundir
   el saldo de una cuenta.
5. **Nada se pierde al conciliar.** Conciliar es reconocer que una previsión y
   una línea del banco son lo mismo, no crear una segunda cosa.

---

## 1 · Las dos entidades y su relación

| | **Previsión** (`treasuryEvent`) | **Apunte** (`movement`) |
|---|---|---|
| Qué es | Lo que ESPERAS que pase | Lo que HA pasado |
| Cuándo nace | De un contrato, recurrente, cuota, etc. | Al anotarlo a mano o al subir el extracto |
| Estado | `predicted` (previsto) · `confirmed` (confirmado) · `executed` (materializado) | `source: manual` → confirmado · `source: import` → conciliado |
| Cuenta al saldo | **No** (es futuro) | **Sí** (es real) |

**La relación es de materialización.** Cuando una previsión se cumple, se
enlaza con su apunte (`movementId` / `executedMovementId`) y pasa a `executed`.
A partir de ahí **manda el apunte**: la previsión se oculta y no vuelve a contar.
La regla de oro: *una previsión materializada y su apunte son la misma fila; el
saldo y las listas cuentan una, no dos.*

---

## 2 · Los tres estados del apunte y sus transiciones

**Corregido en v2 (Jose):** confirmado NO es un paso obligatorio antes de
conciliado. Hay **tres perfiles de persona** y los tres son válidos:

| Perfil | Cómo trabaja | Camino |
|---|---|---|
| **A · a mano** | Solo confirma a mano lo que ve | `previsto → confirmado` |
| **B · por fichero** | Solo sube extractos | `previsto → conciliado` (directo) |
| **C · las dos cosas** | Anota a mano Y sube el fichero | `previsto → confirmado → conciliado` |

O sea: **conciliado puede venir directo de previsto** (perfil B), sin pasar por
confirmado. Confirmado es un estado intermedio opcional para quien anota a mano.

| Estado | Qué significa | Evidencia | ¿Cuenta al saldo? | ¿Reversible? |
|---|---|---|---|---|
| **Previsto** | Lo espero, aún no ha pasado | Una regla/contrato | No | — (es solo previsión) |
| **Confirmado** | Lo he visto yo · "mis ojos" | Tu palabra (anotado a mano, o un previsto que punteas) | **Sí** | Sí → vuelve a previsto |
| **Conciliado** | Lo dice el extracto · más fuerte que confirmado | El fichero del banco | **Sí** | Sí → vuelve a confirmado o a previsto |

**Transiciones válidas:**

- `previsto → confirmado` (perfil A/C): punteas la previsión. Se crea el apunte
  con TU clasificación.
- `previsto → conciliado` (perfil B): subes el fichero y la línea cuadra con la
  previsión, sin haberla confirmado antes.
- `confirmado → conciliado` (perfil C): subes el extracto y la línea cuadra con
  algo que ya habías anotado a mano. **NO se duplica**: sube a conciliado
  heredando tu clasificación, y la línea del banco es la que sobrevive (su texto
  y fecha permiten reconocerla en un reimport).
- Deshacer: conciliado → (confirmado o previsto), sin perder la clasificación.

**Regla dura:** el **SALDO HOY** solo suma **confirmado + conciliado**. Un
previsto jamás resta del saldo de hoy (sí del saldo proyectado a fin de mes).

---

## 3 · Métodos de pago (ref. `VOCABULARIO-dinero.md` §2–§6)

Cada apunte tiene un método de pago, y de él dependen su signo y a qué cuenta
afecta. El vocabulario ya define cada uno; aquí lo que importa para el ciclo:

| Método | Mueve dinero | Signo | Nota operativa |
|---|---|---|---|
| Transferencia externa | Sí, sale/entra de fuera | − sale · + entra | Ref. §6 |
| **Traspaso interno** | **No cambia patrimonio** | **dos patas** | **§4 de este doc** |
| Recibo domiciliado | Sí, sale | − | Se carga en SU cuenta, fecha ±1-2 días |
| Bizum | Sí | − sale · + entra | Arriba QUIÉN, abajo qué es |
| Efectivo | Sí | − sale · + entra | Cuenta `EFECTIVO`, sin extracto |
| Tarjeta **débito** | Sí, en el momento | − | Sale de la cuenta al instante |
| Tarjeta **crédito** | **No el día de compra** | − en el recibo | Sale entero el día de cargo (§10) |

---

## 4 · Traspaso entre cuentas propias (el fallo más grave detectado)

Un traspaso mueve dinero de **una cuenta tuya a otra tuya**. Ejemplo real de
Jose: Santander Alquileres → Santander Nómina.

**Cómo TIENE que funcionar:**

1. Un traspaso tiene **dos patas**: una **salida** en la cuenta origen (−X) y una
   **entrada** en la cuenta destino (+X), por la MISMA cantidad, enlazadas entre
   sí (son el mismo traspaso).
2. **No es gasto ni ingreso.** En el gráfico "cómo va el mes" **no aparece** ni
   como gasto ni como ingreso. En el patrimonio total **netea a cero**. (Matiz
   importante en §4 bis: un traspaso PUEDE contar como "ingreso recurrente" para
   una bonificación de hipoteca sin ser por ello un ingreso de verdad.)
3. En el **saldo por cuenta**: la salida resta en origen, la entrada suma en
   destino. Correcto y esperado. Lo que NO puede pasar es que la salida cuente y
   la entrada no exista → la cuenta origen se hunde (el −16.241 € que viste).

**Al ANOTAR a mano · YA FUNCIONA (Jose lo confirma):** el selector "Cuenta
destino" lista tus cuentas (menos la de origen) + "Externa", y al elegir cuenta
propia se crean automáticamente las dos patas. Aquí no hay que tocar nada.

**Al IMPORTAR · AQUÍ ESTÁ EL PROBLEMA (P1/P3):** cuando subes el extracto y hay
una línea que es un traspaso, el import la mete como "TRANSFERENCIA" y **no la
puedes emparejar con el traspaso que ya habías anotado**. Reglas acordadas:

4. **Cada extracto empareja SU pata.** Al subir el extracto de la cuenta origen,
   la línea de salida cuadra con la **pata de salida** del traspaso ya anotado;
   al subir el de la cuenta destino, la de entrada cuadra con la **pata de
   entrada**. Cada lado concilia lo suyo (no se busca la pata de la otra cuenta).
5. **Si el traspaso NO existía** (no lo habías anotado), al reconocer la línea
   como traspaso a `[cuenta]` **se crean las dos patas** (la de este extracto,
   ya conciliada, y la de la otra cuenta, que quedará por conciliar hasta que
   subas su extracto).

**Problemas actuales (§12):** P1, P3 (el import no empareja traspasos).

---

## 4 bis · Un traspaso que además cuenta como "ingreso recurrente" (Jose, v2)

Segunda contradicción resuelta. Algunos bancos —**Unicaja** es el caso de
Jose— **exigen un traspaso** (te ingresas dinero desde otra cuenta tuya) y lo
**contabilizan como "ingreso recurrente"** para cumplir la condición de una
**bonificación de hipoteca**.

Esto NO rompe el modelo: son **dos lecturas del mismo apunte**.

- **Para el dinero** (saldo, patrimonio, gráfico): sigue siendo un **traspaso**.
  Netea a cero, no es ingreso, no cuenta como ingreso en la gráfica del mes.
- **Para la bonificación** (condiciones que se verifican contra la tesorería,
  ver `VOCABULARIO-dinero.md` §6 ter): ese mismo traspaso **SÍ satisface** el
  requisito de "ingreso recurrente mensual de ≥ X €" que pide el banco.

Es decir: un traspaso puede llevar una **etiqueta de "cuenta para la bonificación
Y"** sin dejar de ser un traspaso. Lo que verifica la bonificación no es "¿es un
ingreso?", es "¿ha entrado en esta cuenta un abono ≥ X este mes?", y un traspaso
entrante lo cumple.

**Decisión abierta (§13.9):** ¿cómo se marca que un traspaso concreto cuenta para
una bonificación? ¿automático (todo abono ≥ umbral en esa cuenta) o manual?

**SALDO HOY de una cuenta** = saldo inicial (a su fecha de apertura)
　＋ Σ apuntes **reales** (confirmado/conciliado) con fecha ≤ hoy
　＋ Σ apuntes reales con fecha valor futura pero que YA han ocurrido (saldo vivo)
　－ nada más.

**NO entran en el saldo de hoy, bajo ningún concepto:**

- Previsiones (`predicted`) — son futuro.
- Líneas **ignoradas** en un extracto — el usuario dijo que no cuentan.
- Compras con **tarjeta de crédito** el día de compra — salen en el recibo (§10).
- Piezas de tarjeta (`gasto_tarjeta`) — no salen de ninguna cuenta.

**Traspasos:** cada pata afecta a SU cuenta (−X en origen, +X en destino). En el
**total de patrimonio** se compensan.

**SALDO FINAL (proyectado a fin de mes)** = saldo hoy ＋ Σ previsiones pendientes
del mes (lo que aún queda por entrar y por salir). Este SÍ usa previsiones; el
saldo de hoy, no.

**Problema actual (§12):** P2 — hoy el saldo baja con cosas que no debería.

---

## 6 · El gráfico "Cómo va el mes"

El gráfico compara **lo real contra lo previsto**. **Aclaración de Jose (v2):**
las exclusiones de abajo son para el lado **REAL** (lo que llevas ejecutado del
mes), que es donde está el bug — NO redefinen la parte prevista.

- **Ingresos (real)** = Σ apuntes **reales** de entrada del mes, **excluyendo**:
  traspasos internos y aportaciones entre cuentas propias.
- **Gastos (real)** = Σ apuntes **reales** de salida del mes, **excluyendo**:
  traspasos internos, tarjeta de crédito del día de compra, líneas ignoradas.
- **Neto (real)** = Ingresos − Gastos reales, ya sin traspasos.
- **Previsto** = la línea base de lo que se esperaba (no se toca aquí; por
  coherencia tampoco debería contar traspasos como gasto/ingreso previsto, pero
  el foco del arreglo es el lado real).

**Regla dura:** un traspaso NUNCA suma a "Gastos" ni a "Ingresos" reales. Si el
gráfico dice "Gastos 29.364 € · 387% de lo previsto" es porque está metiendo los
traspasos y transferencias internas como gasto real — **eso es el bug P4**.

---

## 7 · Subida de ficheros de movimientos (un solo sitio)

1. **Un único punto de subida** (el botón "Subir extracto" del hero).
2. **Formatos:** xls, csv, Norma 43 (SheetJS) y **PDF** (lo lee la IA vía
   `functions/chat.js`). Da igual banco o tarjeta, da igual el emisor.
3. **Destino:** se detecta la cuenta por IBAN; si no, se elige **cuenta o
   tarjeta**. Una cuenta bancaria sigue el flujo bancario; una tarjeta, el suyo
   (§10).
4. **Idempotencia por fichero** (hash del lote): subir dos veces el mismo
   fichero avisa y no duplica.
5. **Dedup por línea SOLO contra otros lotes**, nunca contra las otras líneas del
   mismo fichero: si el banco lista dos cargos idénticos (dos comunidades de
   −38 €, Nº mov distinto), son dos movimientos reales y **entran los dos**.
6. **Flujo:** leer → emparejar → **cotejar línea a línea (Paso 2)** → Guardar.
   Nada se escribe de forma definitiva hasta que pulsas Guardar.

---

## 8 · Conciliación · cómo se empareja una línea

Al subir el extracto, cada línea se intenta cuadrar, por este orden:

1. **Contra una previsión** (`predicted`) de la misma cuenta: por **importe**
   (exacto o dentro de tolerancia), **fecha cercana** (±5 días), y **nombre**
   (quien paga/cobra). El nombre es lo que desempata.
2. **Contra un confirmado** que ya tenías anotado a mano: misma cuenta, mismo
   importe con signo, fecha cercana → sube a conciliado sin duplicar (§2).

**Reglas de desempate:**

- **Importes iguales** (p.ej. 6 habitaciones de 395 €): manda el **nombre del
  inquilino**. Si una previsión lo casa y las demás no, cuadra sola con esa
  ("ganador claro"). Si **ninguna** desempata, se ofrece **elegir**; nunca se
  adivina a ciegas.
- Para que el nombre desempate, **tiene que estar en el campo que mira el
  emparejador** (contraparte/proveedor de la previsión), no solo en la etiqueta
  que se pinta. **Problema P5.**

**Herencia de clasificación (crítico):** cuando una línea cuadra con una
previsión, el apunte **HEREDA** de ella la **categoría, familia, subtipo, ámbito
e inmueble**. El texto del banco se conserva como **concepto** (título), pero la
clasificación es la tuya — es lo que permite cuadrar gastos y cruzar con la
factura.

---

## 9 · Clasificación y cómo se ve la fila

**Dónde se guarda:** en el propio apunte (`categoryKey`, `subtypeKey`, `ambito`,
`inmuebleId`). No se pierde al conciliar.

**Cómo se ve (decisión de Jose, 19 ago 2026):**

- **Título de la fila** = el **texto literal del banco** (la prueba).
- **Subtítulo** = **tu familia/categoría** + inmueble, **SIEMPRE que la hayas
  definido** — también en Bizums, transferencias o líneas con nombre de pagador.

**Problema P6:** hoy el subtítulo con tu familia **se oculta** cuando el apunte
trae nombre de pagador o es un Bizum, y por eso "defines y no lo ves".

### 9 bis · La TAXONOMÍA de familias está mal (Jose: "de lo peor que tenemos")

> «la familia es parcial… familia Salud, ¿qué es? no aporta una mierda.»

El problema no es solo que la familia no se vea (P6). Es que **la lista de
familias en sí no sirve**: etiquetas de "categoría de vida" (Salud, Ocio…) no
dicen lo único que a ti te importa de un apunte. **Rediseño pendiente (P8), y es
prioritario.** Para hacerlo bien hay que responder PARA QUÉ clasificas:

1. **Fiscal** — que cada gasto de inmueble caiga en su **casilla de la Renta**
   (IBI, comunidad, seguro, suministros, intereses, reparación vs mejora…). Esto
   sí "aporta": es deducible o no, y en qué casilla.
2. **Por inmueble** — cuánto cuesta y renta CADA piso/habitación (P&L por activo).
3. **Personal** — lo tuyo que no es de inmuebles, con un nivel de detalle que a
   ti te valga para tu presupuesto (no una etiqueta genérica que no usas).

**Propuesta de dirección (a validar contigo):** la clasificación de un apunte se
compone de piezas que SÍ aportan, no de una "familia" vaga:

- **Ámbito**: `INMUEBLE` (¿cuál?) · `PERSONAL` · `ACTIVIDAD` (si aplica).
- **Concepto/tipo**: el que tiene sentido fiscal y operativo (comunidad, IBI,
  suministro-luz, suministro-agua, seguro, reparación, mejora, intereses…),
  no "Salud" a secas.
- **Deducibilidad / casilla** cuando es de inmueble.

**Decisión abierta (§13.5):** define la lista de conceptos que SÍ usas y qué debe
verse en la fila. Hasta cerrarlo, no tocamos ni el subtítulo (P6) ni la pasada
retroactiva (P7): sería pintar bien una taxonomía que vamos a cambiar.

---

## 10 · Tarjeta de crédito (ref. `VOCABULARIO-dinero.md` §3)

- Una compra con tarjeta de crédito **no mueve la cuenta el día de compra**.
- Las compras del periodo se acumulan en **piezas** y forman el **recibo**, que
  se cobra entero el día de cargo en el **banco de liquidación** (Carrefour →
  Bankinter). El recibo se nutre de datos **confirmados**, no solo de previsión.
- La tarjeta tiene su propio cajón con Por confirmar / Confirmados / Movimientos,
  y su extracto (PDF/xls) se sube por el mismo sitio (§7) y concilia sus gastos.

---

## 11 · Anexo de facturas (Jose, v2)

**Regla fijada:** una factura **se vincula a un apunte REAL** —confirmado o
conciliado—, **nunca a una previsión**. Tiene sentido: la factura es el papel de
algo que ya ocurrió; una previsión aún no ha pasado.

- Al vincularla, el apunte muestra que tiene "papel" (documento) y sirve para el
  cotejo y el fiscal.
- El cruce se propone por **importe + fecha/proveedor + inmueble**, y se
  confirma a mano (no se vincula a ciegas).

**Decisión abierta (§13.6):** ¿la clasificación la manda el apunte o la factura?
(Por ahora: el apunte ya trae su clasificación del previsto; la factura la
respalda y puede completar datos fiscales —nº factura, base, IVA—.)

---

## 12 · Problemas detectados (el modelo actual los incumple)

| # | Problema | Estado |
|---|---|---|
| **P1** | Al **importar**, un traspaso entra como "TRANSFERENCIA" y no se puede emparejar con el traspaso anotado (anotar a mano ya funciona) | ABIERTO · prioridad 1 |
| **P2** | El **saldo** baja con lo que no debería (previsiones/ignoradas) y los traspasos no netean → cuenta en −16.241 € | ABIERTO · prioridad 1 |
| **P3** | El **traspaso** en el import no se cierra con sus dos patas (cada extracto debe conciliar su pata; crear la que falte) | ABIERTO · prioridad 1 |
| **P4** | El **gráfico** cuenta traspasos/transferencias internas como **gasto real** | ABIERTO · prioridad 1 |
| **P8** | La **taxonomía de familias** no sirve ("familia Salud no aporta"); rediseñar qué se clasifica y para qué (fiscal/inmueble/personal) | ABIERTO · prioridad 1 (bloquea P6/P7) |
| **P5** | El **nombre del pagador** no desempata importes iguales (no está en el campo del emparejador) | ABIERTO · prioridad 2 |
| **P6** | La **familia** que clasificas no se muestra en la fila (Bizum/pagador la ocultan) | ABIERTO · prioridad 2 (tras P8) |
| P7 | Los apuntes **ya conciliados** antes de la herencia no muestran su categoría (pasada retroactiva) | ABIERTO · prioridad 3 (tras P8) |
| ✔ | Dos cargos idénticos del mismo extracto se colapsaban en uno | RESUELTO (PR #1752) |
| ✔ | Al cuadrar con un previsto no se heredaba la clasificación | RESUELTO (PR #1751) |
| ✔ | Importes iguales con nombre → "ganador claro" en vez de elegir entre seis | RESUELTO (PR #1751) |
| ✔ | Un previsto punteado se duplicaba al subir el extracto | RESUELTO (PR #1747) |
| ✔ | Conciliación de tarjeta cotejable línea a línea | RESUELTO (PR #1746) |
| ✔ | Un solo sitio para subir extractos (xls/csv/pdf) + PDF de banco por IA | RESUELTO (PR #1745, #1750) |

---

## 13 · Decisiones · RESPONDIDAS por Jose (19 ago 2026) y lo que queda

**Respondidas (ya incorporadas arriba):**

1. ✅ **Traspaso al anotar** — YA funciona (destino lista tus cuentas + "Externa",
   se crean las dos patas). El problema es al **importar** (§4, P1/P3).
2. ✅ **Traspaso al importar** — **cada extracto empareja SU pata**; si no existía
   el traspaso, se crean las dos patas (§4.4–4.5).
3. ✅ **Saldo vivo** — SÍ: SALDO HOY = solo confirmado/conciliado; ni previsión ni
   ignorada lo tocan (§5).
4. ✅ **Gráfico** — las exclusiones (traspasos, aportaciones propias, tarjeta
   crédito, ignoradas) son para el lado **REAL**, no para el previsto (§6).
6. ✅ **Facturas** — se vinculan a un apunte **confirmado/conciliado**, nunca a un
   previsto (§11).
8. ✅ **Aportaciones "+2.500"** — son **traspasos entre cuentas**. Y ojo: un banco
   (Unicaja) puede exigir ese traspaso y contarlo como **ingreso recurrente** para
   la bonificación de la hipoteca (§4 bis).

**Contradicciones que planteaste, resueltas:**

- **C1 · confirmado no es obligatorio antes de conciliado** — hay 3 perfiles
  (a mano / por fichero / las dos cosas). Corregido en §2.
- **C2 · un traspaso no es ingreso, pero cuenta como "ingreso recurrente" para la
  bonificación** — son dos lecturas del mismo apunte. Resuelto en §4 bis.

**Lo que queda por cerrar (esto es lo gordo, §13.5):**

5. **La taxonomía (P8).** Dijiste que la familia "no aporta una mierda". Antes de
   tocar cómo se ve la fila (P6) o reclasificar lo viejo (P7), necesito que
   definas la **clasificación que SÍ usas**. Para arrancar, dime:
   - ¿La clasificación es sobre todo **fiscal** (que cada gasto de inmueble caiga
     en su casilla de la Renta) o también quieres **presupuesto personal**?
   - Dame la **lista de conceptos** de inmueble que usas de verdad (p.ej.
     comunidad, IBI, seguro, suministro luz/agua/gas, reparación, mejora,
     intereses, seguro de vida/hogar ligado a hipoteca…).
   - En **personal**, ¿qué nivel quieres? ¿pocas cajas útiles o detalle?
   - En la **fila**, ¿qué subtítulo te sirve? ¿"IBI · Tenderina 64 4DR"?
     ¿"Comunidad · deducible"? Dime el formato que a ti te dice algo.

9. **Bonificación (§4 bis):** ¿cómo se marca que un traspaso cuenta para una
   bonificación? ¿automático (todo abono ≥ umbral en esa cuenta) o manual?

---

*En cuanto cierres §13.5 (la taxonomía) y §13.9, este documento pasa a
**v2 "acordado"** y de él salen las tareas de código, una por problema:
**P1–P4 (traspasos y saldo) primero**, luego P8 → P5/P6/P7.*
