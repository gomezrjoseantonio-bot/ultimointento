# Modelo operativo de tesorería · el ciclo del apunte de extremo a extremo

**Estado: BORRADOR v1 · para cerrar entre Jose y Claude. NO se toca código hasta
que esté acordado.**

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

La secuencia canónica es **previsto → confirmado → conciliado**. No hay saltos
raros: un confirmado puede subir a conciliado, y ambos se pueden deshacer.

| Estado | Qué significa | Evidencia | ¿Cuenta al saldo? | ¿Reversible? |
|---|---|---|---|---|
| **Previsto** | Lo espero, aún no ha pasado | Una regla/contrato | No | — (es solo previsión) |
| **Confirmado** | Lo he visto yo · "mis ojos" | Tu palabra (anotado a mano, o un previsto que punteas) | **Sí** | Sí → vuelve a previsto |
| **Conciliado** | Lo dice el extracto · más fuerte que confirmado | El fichero del banco | **Sí** | Sí → vuelve a confirmado |

**Transiciones válidas:**

- `previsto → confirmado`: punteas la previsión (la das por ocurrida). Se crea
  el apunte con TU clasificación.
- `previsto → conciliado`: la línea del extracto cuadra con la previsión al
  subir el fichero.
- `confirmado → conciliado`: subes el extracto y la línea cuadra con algo que ya
  habías anotado a mano. **El confirmado NO se duplica**: sube a conciliado
  heredando tu clasificación, y la línea del banco es la que sobrevive (su texto
  y fecha permiten reconocerla en un reimport).
- Deshacer: conciliado → confirmado → previsto, sin perder la clasificación.

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
   como gasto ni como ingreso. En el patrimonio total **netea a cero**.
3. En el **saldo por cuenta**: la salida resta en origen, la entrada suma en
   destino. Correcto y esperado. Lo que NO puede pasar es que la salida cuente y
   la entrada no exista → la cuenta origen se hunde (el −16.241 € que viste).
4. **Al anotar un movimiento de tipo "Transferencia" debe poder elegirse una
   cuenta PROPIA como destino** (hoy solo ofrece "Externa · fuera de mis
   cuentas", y por eso Jose tuvo que ignorar todos los traspasos). Elegir cuenta
   propia lo convierte en traspaso (dos patas); elegir "Externa" lo deja como
   transferencia externa (una pata, sale de verdad).
5. **Al subir el extracto**, una línea que es un traspaso a otra cuenta tuya debe
   poder emparejarse con la pata de la otra cuenta (o marcarse como traspaso),
   no clasificarse como gasto.

**Problemas actuales (§12):** P1, P2, P3.

---

## 5 · El saldo · qué cuenta y qué NO

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

Compara lo real contra lo previsto del mes. Definición estricta:

- **Ingresos (real)** = Σ apuntes reales de entrada del mes, **excluyendo**:
  traspasos internos, aportaciones entre cuentas propias.
- **Gastos (real)** = Σ apuntes reales de salida del mes, **excluyendo**:
  traspasos internos, tarjeta de crédito del día de compra, líneas ignoradas.
- **Neto** = Ingresos − Gastos (reales, ya sin traspasos).

**Regla dura:** un traspaso NUNCA suma a "Gastos" ni a "Ingresos". Si el gráfico
dice "Gastos 29.364 € · 387% de lo previsto" es porque está metiendo los
traspasos y transferencias internas como gasto — **eso es el bug P4**.

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

---

## 10 · Tarjeta de crédito (ref. `VOCABULARIO-dinero.md` §3)

- Una compra con tarjeta de crédito **no mueve la cuenta el día de compra**.
- Las compras del periodo se acumulan en **piezas** y forman el **recibo**, que
  se cobra entero el día de cargo en el **banco de liquidación** (Carrefour →
  Bankinter). El recibo se nutre de datos **confirmados**, no solo de previsión.
- La tarjeta tiene su propio cajón con Por confirmar / Confirmados / Movimientos,
  y su extracto (PDF/xls) se sube por el mismo sitio (§7) y concilia sus gastos.

---

## 11 · Anexo de facturas (por definir con Jose)

Objetivo: vincular una factura (PDF/imagen) a su apunte, para el fiscal y el
cotejo. Preguntas abiertas en §13.

Idea base: la factura se cruza con el apunte por **importe + fecha/proveedor +
inmueble**, y una vez vinculada, el apunte muestra que tiene "papel" (documento)
y la factura hereda la clasificación del apunte (o al revés). **Falta cerrarlo.**

---

## 12 · Problemas detectados (el modelo actual los incumple)

| # | Problema | Estado |
|---|---|---|
| **P1** | No se puede elegir una **cuenta propia** como destino de una transferencia → no se pueden marcar traspasos | ABIERTO · prioridad 1 |
| **P2** | El **saldo** baja con lo que no debería (previsiones/ignoradas) y los traspasos no netean → cuenta en −16.241 € | ABIERTO · prioridad 1 |
| **P3** | El **traspaso** entre cuentas propias no se modela con dos patas enlazadas | ABIERTO · prioridad 1 |
| **P4** | El **gráfico** cuenta traspasos/transferencias internas como **gasto** | ABIERTO · prioridad 1 |
| **P5** | El **nombre del pagador** no desempata importes iguales (no está en el campo del emparejador) | ABIERTO · prioridad 2 |
| **P6** | La **familia** que clasificas no se muestra en la fila (Bizum/pagador la ocultan) | ABIERTO · prioridad 2 |
| P7 | Los apuntes **ya conciliados** antes de la herencia no muestran su categoría (no se reclasifican solos) | ABIERTO · prioridad 3 |
| ✔ | Dos cargos idénticos del mismo extracto se colapsaban en uno | RESUELTO (PR #1752) |
| ✔ | Al cuadrar con un previsto no se heredaba la clasificación | RESUELTO (PR #1751) |
| ✔ | Importes iguales con nombre → "ganador claro" en vez de elegir entre seis | RESUELTO (PR #1751) |
| ✔ | Un previsto punteado se duplicaba al subir el extracto | RESUELTO (PR #1747) |
| ✔ | Conciliación de tarjeta cotejable línea a línea | RESUELTO (PR #1746) |
| ✔ | Un solo sitio para subir extractos (xls/csv/pdf) + PDF de banco por IA | RESUELTO (PR #1745, #1750) |

---

## 13 · Decisiones abiertas (para cerrar entre Jose y Claude)

1. **Traspaso al anotar:** ¿el selector "Cuenta destino" lista todas tus cuentas
   (menos la de origen) + "Externa"? ¿Al elegir cuenta propia se crea
   automáticamente la pata de entrada en la otra cuenta?
2. **Traspaso al importar:** cuando subes el extracto de la cuenta origen y hay
   una salida que es un traspaso, ¿se empareja con la entrada ya importada en la
   otra cuenta, o se marca "es traspaso a [cuenta]" y se crea la pata que falte?
3. **Saldo vivo:** ¿confirmamos que el SALDO HOY = solo confirmado/conciliado, y
   que ni una sola previsión ni línea ignorada lo tocan?
4. **Gráfico:** ¿"Ingresos/Gastos del mes" excluyen traspasos, aportaciones entre
   cuentas propias, tarjeta de crédito y líneas ignoradas? ¿Algo más?
5. **Título vs familia:** confirmado que el título es el texto del banco y el
   subtítulo tu familia — ¿siempre, en todos los métodos de pago?
6. **Facturas:** ¿cómo se vincula una factura a un apunte? ¿por importe+fecha,
   manual, o las dos? ¿la factura manda la clasificación o el apunte?
7. **Reclasificar lo ya conciliado (P7):** ¿quieres una pasada única que repase
   los apuntes conciliados antes de la herencia y les ponga la categoría del
   previsto con el que casaron?
8. **Aportaciones propias:** los "GOMEZ RAMIREZ JOSE ANTONIO +2.500" que entran
   en Nómina, ¿son traspasos desde otra cuenta tuya, ingresos de verdad, o
   aportaciones de capital? Define cómo tratarlos en saldo y gráfico.

---

*Cuando cerremos §13, este documento pasa a v2 "acordado" y de él salen las
tareas de código, una por problema, en orden de prioridad.*
