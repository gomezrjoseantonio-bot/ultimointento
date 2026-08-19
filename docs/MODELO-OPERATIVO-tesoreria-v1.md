# Modelo operativo de tesorería · el ciclo del apunte de extremo a extremo

**Estado: BORRADOR v7 · ejes ortogonales ACORDADOS (§9 ter) y catálogo de
NATURALEZA acordado (§9 quater). Ejes: naturaleza (catálogo universal Tipo→Subtipo)
· origen (apunte real vs derivado: intereses/amortización) · recurrencia
(atributo de la previsión). Intereses de hipoteca fuera del catálogo (derivado).
Ámbito = Personal · Inmueble (sin "Actividad": eso es autónomo). Fiscalidad
SIEMPRE prorrateada por días, nunca en bloque. **CATÁLOGO (naturaleza + ámbito)
ACORDADO por Jose (19 ago).** Falta la capa fiscal (casilla + prorrateo por
días/modalidad), la presentación (recurrente/puntual, por inmueble) y validar
§13.9 y §13.10. NO se toca código hasta que esté acordado.**

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

### 9 bis · Diagnóstico · por qué la clasificación es una mierda HOY

> Jose: «familia Salud › Médicos me dice 0… lo importante es el subtipo… y
> quiero que sea editable. Busquemos un modelo decente y escalable.»

No es una opinión, es estructural. Hoy conviven **CUATRO catálogos** para lo
mismo, y no comparten espina dorsal:

1. `categoryCatalog.ts` — las **keys + casilla AEAT** que se guardan (~18 gordas).
2. `conceptos/` — el árbol de **13 familias → 60 conceptos** que eliges (el bueno).
3. Árboles **legacy** por pestaña (`tiposDeGastoInmueble`, …), aún vivos.
4. Una **tabla de traducción** entre 1 y 2 (que en su cabecera jura "no soy un
   tercer catálogo" — señal de que lo es).

Consecuencias que sufres:

- **El concepto real NO se guarda en el movimiento.** Un apunte guarda la
  categoría gorda (`categoryKey`) y a veces un `subtypeKey` (solo suministros).
  El concepto fino (limpieza vs gestoría vs alarma; médico vs farmacia) solo vive
  en los **compromisos recurrentes**, no en el movimiento. Por eso una fila ya
  conciliada no sabe qué es de verdad.
- **Personal es brocha gorda:** 13 familias colapsan a **5 cajones** sin casilla.
- **Doble identidad heredada** (`categoryLabel` texto libre vs `categoryKey`) con
  heurísticos de `includes('reparacion')→0106` en tres sitios que deben coincidir.
- **La familia es lo que MENOS aporta** y es justo lo que se enseña.

**Lo que YA es editable** (Ajustes → Conceptos): renombrar, ocultar y crear
conceptos propios. Lo que NO: su casilla fiscal (la hereda de la familia, para no
cambiar la Renta sin querer). Es decir: la pieza editable existe, pero cuelga de
un modelo roto.

### 9 ter · Modelo acordado (Jose) · EJES ORTOGONALES que no hay que mezclar

El colapso viene de meter en la misma bolsa cosas que son ejes distintos.
**Acordado con Jose (19 ago):** se separan en ejes independientes, y el
**catálogo de naturaleza es universal** — no lo define la pantalla ni el uso.

**Eje 1 · NATURALEZA (el catálogo universal).** Qué es el gasto, y ya. Es lo
único que fijamos ahora (§9 quater). Estructura **Tipo → Subtipo**, donde el
**subtipo es el concepto** (la unidad con la que se puntea y se guarda) y el
**Tipo es solo una carpeta visual** para plegar. Si un Tipo no tiene subtipo, el
**Tipo es el concepto** (Alarma, Supermercado, Ocio…). Universal y **editable**:
se pueden añadir subtipos en cualquier Tipo. No cambia por dónde se use ni cómo
se pague.

**Eje 2 · ORIGEN del importe.** De dónde sale la cifra:
- **(a) Apunte real** — hay movimiento: lo creas (recurrente o puntual), lo
  anotas a mano, o lo sube el banco y se concilia.
- **(b) Derivado / calculado** — **NO hay apunte: no lo creas, no lo concilias,
  el banco no lo apunta por separado.** Lo calcula un motor. Aquí van los
  **intereses de hipoteca** (del cuadro de amortización del préstamo), la
  **amortización del inmueble** (3 % construcción) y la **del mobiliario** (10 %).
  → Por eso **"Intereses de hipoteca" NO está en el catálogo de gastos.** El
  apunte real es la **cuota de la hipoteca** (naturaleza *Hipoteca · cuota*); el
  motor la parte en **capital** (baja de deuda, ni gasto ni CAPEX) e **interés**
  (gasto derivado, deducible solo si el inmueble está alquilado). Tú no tecleas
  el interés nunca.

**Eje 3 · RECURRENCIA.** **Atributo de la PREVISIÓN, no de la naturaleza.**
- **Recurrente** = compromiso con periodicidad (comunidad mensual, seguro anual);
  genera previsiones futuras.
- **Puntual** = una vez (una reparación, un mueble, una comida); no genera futuras.

El mismo concepto puede ser las dos cosas (una *Gestoría* puntual, o una iguala
mensual). El catálogo solo lleva un **default sugerido** que pre-rellena, no
obliga.

**Ejes 4 y 5 · IMPUTACIÓN y FISCALIDAD — son CAPA DE ENCIMA (siguiente paso).**

- **Imputación (ámbito).** Solo dos valores: **Personal** · **Inmueble : ‹cuál›**.
  NO existe "Actividad/General": si hay actividad económica es un **autónomo**
  (otro régimen en Hacienda), fuera de esta app.
  - **Personal** = tu vida **+ el sitio donde vives** (tu hogar, de alquiler o en
    propiedad). No deducible → tu presupuesto. La luz/gas/agua/internet **de tu
    vivienda** son Personal, con el Alquiler que pagas.
  - **Inmueble** = un inmueble **de inversión** tuyo (que alquilas o para alquilar).
  - Muchos conceptos "de vivienda" son **Ambos** y **lo decide el apunte**: la
    misma *luz* es Personal si es la de tu casa, Inmueble si es la de un piso que
    alquilas. Solo son Inmueble-puro los que únicamente tiene un arrendador
    (licencia turística, seguro de impagos, agencia, comisión de plataformas,
    consumibles de bienvenida).
- **Fiscalidad derivada — SIEMPRE por TIEMPO, nunca en bloque (Jose, 19 ago).**
  Un gasto de inmueble es **continuo**: la luz de un inmueble existe los 365 días
  del año. Lo deducible/asumido se **prorratea por DÍAS** según el estado del
  inmueble en cada tramo. Ejemplo: luz 30 €/mes = 360 €/año; si el inmueble está
  alquilado (completo) **1 día**, ese día lo asume el **inquilino** y los otros
  **364 días** (vacío) los asume el **propietario**. NO es "la luz es del
  inquilino": es 1 día suyo y 364 tuyos.
  - La **modalidad** solo decide **quién asume los suministros durante los días
    alquilados**: completo → inquilino; habitaciones/turístico → propietario. El
    resto del año (vacío) siempre lo asume el propietario.
  - La **naturaleza** fija la **casilla**; el **tiempo + modalidad + estado** del
    inmueble fijan **cuánto**. El concepto NO lleva un "deducible sí/no".

Estas dos capas **consumen** el catálogo, no lo definen. Se diseñan DESPUÉS.

**Regla que ordena el ruido:** la **amortización NO es un gasto** (es derivado,
eje 2b). **Mejora y mobiliario** sí son apuntes reales, pero su naturaleza es
**INVERSIÓN (CAPEX)**, no gasto: se **amortizan**. Están fuera del catálogo de
gastos.

**Y lo más importante:** el **catálogo (naturaleza) ≠ la presentación**. Cómo se
muestra (plegar por Tipo, separar recurrentes de puntuales, ver por inmueble, el
alta de un puntual vs la pantalla de recurrentes) es una capa de encima. Ahí
nacían los problemas: se dejaba que la pantalla decidiera la naturaleza.

### 9 quater · CATÁLOGO DE NATURALEZA acordado (Jose, 19 ago)

Solo **naturaleza** (eje 1). NO lleva todavía casilla, imputación ni semilla —
eso es capa de encima y se hace en el siguiente paso. Estructura **Tipo →
Subtipo**; el **subtipo es el concepto**; si el Tipo no tiene subtipo, el **Tipo
es el concepto**. Todo **editable** (se pueden añadir subtipos en cualquier Tipo).

| Tipo (carpeta) | Subtipos (el concepto) |
|---|---|
| Comunidad | Cuota · Derrama |
| Impuestos | IBI · Basuras · Licencia turística · Circulación |
| Seguro | Hogar · Vida · Impagos · Decesos · Vehículo · Médico |
| Reparación | Vehículo · Caldera · Electrodomésticos · *(editable)* |
| Mantenimiento | Caldera · Vehículo · ITV · *(editable)* |
| Suministro | Luz · Agua · Gas · Internet · Móvil |
| Alarma | *(sin subtipo — el Tipo es el concepto)* |
| Gestión | Agencia alquiler · Gestoría · Asesoría · Comisión de plataformas · Consumibles de bienvenida |
| Limpieza | Zonas comunes · Integral · Lavandería |
| Supermercado | *(sin subtipo)* |
| Transporte | Combustible |
| Farmacia | *(sin subtipo)* |
| Suscripciones | Gimnasio · Educación · ONG · Streaming · Cloud |
| Ocio | *(sin subtipo)* |
| Viaje | *(sin subtipo)* |
| Restaurante | *(sin subtipo)* |
| Alquiler | Vivienda · Vehículo *(personal — renting de coche incluido)* |
| Hipoteca / préstamo | Cuota *(el interés es DERIVADO, no un subtipo)* |
| Otros | *(editable y trazable)* |

**FUERA del catálogo de gastos (a propósito):**

- **Derivados (eje 2b · no son apuntes, los calcula un motor):** Intereses de
  hipoteca (del cuadro del préstamo) · Amortización del inmueble (3 %) ·
  Amortización del mobiliario (10 %).
- **Inversión / CAPEX (apunte real, pero naturaleza *inversión*, no gasto):**
  Mejora / ampliación · Mobiliario. Se amortizan; viven en el módulo del inmueble.

**Ingreso** (no es gasto): la **renta** se siembra desde el **contrato** (por
piso o habitación). Aparte, un **traspaso** puede contar como "ingreso
recurrente" para la bonificación de Unicaja (§4 bis) sin ser ingreso patrimonial.

> **Siguiente paso (capa de encima, NO ahora):** a cada concepto se le cuelga
> dónde aplica (personal / inmueble) y — solo si se imputa a inmueble alquilado —
> su **casilla** de la Renta y la **deducción prorrateada** por días y tipo
> (larga → reducción 60 %; temporada → sin reducción; turístico con servicios →
> posible actividad económica). El presupuesto personal 50/30/20 es otra vista
> más sobre los conceptos personales.

### 9 quinquies · Semillado al poner un inmueble en alquiler (Jose)

Cuando un inmueble pasa a alquilarse, sus gastos típicos deberían **sembrarse**
solos (sugeridos), en vez de tener que crearlos uno a uno. Buena noticia: **el
modelo de datos ya existe**, solo hay que fijar el flujo.

**Lo que YA hay:**

- El inmueble guarda **`usoTipo`** (`vivienda_habitual` · `larga` · `temporada` ·
  `turistico` · …), **`modoExplotacion`** (`piso_completo` · `por_habitaciones` ·
  `mixto`) y **`estadoOperativo`** (`operativo` · `vacante` · `en_reforma` ·
  `uso_propio`). El contrato lleva su **modalidad**.
- Ya existe **`catalogoModalidadInmueble`**: por modalidad
  (`viviendaCompleta` / `habitaciones` / `turistico`) da una lista de conceptos
  **precargados** (marcados) y **disponibles** (a un clic). Y ya avisa de algo
  clave: **NO crea registros** — sugiere; tú rellenas importe/calendario/cuenta y
  guardas.

**Lo que falta ajustar (decisión §13.10) — dónde y cuándo:**

1. **Dónde se marca que un inmueble está en alquiler y de qué tipo.** Propuesta:
   un único sitio (la ficha del inmueble / el alta de contrato) donde se fija
   `usoTipo` + `modoExplotacion`. Hoy el dato existe pero está repartido; hay que
   decidir **la fuente única de verdad** (¿el contrato manda y el inmueble lo
   deriva, o al revés?).
2. **Cuándo se dispara el semillado.** Propuesta: al **dar de alta/activar el
   contrato** (o al marcar el inmueble como alquilado), se abre la lista de
   conceptos sugeridos según el tipo (§9 quater · tabla C), tú marcas los que
   aplican, pones importe/periodicidad/cuenta, y de ahí nacen las **previsiones**
   (recurrentes) de ese inmueble.
3. **Qué se siembra por tipo:** completo → comunidad, IBI, seguros, reparación
   (+ suministros si los pagas tú); habitaciones → lo anterior + suministros +
   limpieza zonas + internet; turístico → + licencia, comisión plataformas,
   limpieza por estancia, y aviso del posible régimen de actividad económica.
4. **Ingresos:** el alquiler previsto (renta por contrato/habitación) también se
   siembra desde el contrato (esto ya funciona vía contratos).

**Regla:** sembrar = **sugerir**, nunca crear a ciegas. Cada previsión nace
completa (importe, periodicidad, cuenta) tras tu confirmación.

**Decisión abierta (§13.5):** ¿te vale esta semilla como arranque? ¿Qué conceptos
de inmueble te faltan o sobran? ¿Y en personal, con este nivel te basta o quieres
más/menos cajas? Con tu OK, F1 es cerrar esta tabla.

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
| **P9** | El **semillado** al poner un inmueble en alquiler no tiene flujo fijado (dónde se marca el tipo, cuándo se dispara) | ABIERTO · prioridad 2 (va con P8) |
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

5. **La taxonomía (P8).** Mapeado el desastre actual (§9 bis). **ACORDADO** el
   modelo de **ejes ortogonales** (§9 ter: naturaleza / origen / recurrencia;
   imputación y fiscalidad como capa de encima) y el **catálogo de naturaleza**
   (§9 quater, Tipo→Subtipo, editable; intereses de hipoteca fuera por ser
   derivado). Lo que queda para cerrar F1 (la **capa de encima**, siguiente paso):
   - **Imputación + fiscalidad:** colgar a cada concepto dónde aplica (personal /
     inmueble) y la casilla + deducción prorrateada cuando es inmueble alquilado.
   - **Presentación:** cómo se muestra (plegar por Tipo, recurrentes vs puntuales,
     por inmueble, alta de puntual vs pantalla de recurrentes).
   - **Motor de derivados:** cuadro de amortización del préstamo (parte capital /
     interés de la cuota) y amortizaciones del inmueble y del mobiliario.

9. **Bonificación (§4 bis):** ¿cómo se marca que un traspaso cuenta para una
   bonificación? ¿automático (todo abono ≥ umbral en esa cuenta) o manual?

10. **Semillado al alquilar (§9 quinquies, P9):** ¿cuál es la **fuente única de
    verdad** del tipo de alquiler — manda el **contrato** y el inmueble lo deriva,
    o al revés? ¿El semillado se dispara al **activar el contrato** o al marcar el
    inmueble como alquilado? ¿La columna **Alq.** de §9 quater refleja bien qué
    conceptos van en completo / habitaciones / turístico?

---

*En cuanto cierres §13.5 (la taxonomía), §13.9 y §13.10, este documento pasa a
**v2 "acordado"** y de él salen las tareas de código, una por problema:
**P1–P4 (traspasos y saldo) primero**, luego P8 → P5/P6/P7.*
