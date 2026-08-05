# Vocabulario del dinero · ATLAS

**Este documento se consulta ANTES de tocar cuentas, métodos de pago, gastos
recurrentes o el alta de movimientos.** No es documentación de lo que se hizo:
es la definición a la que el código tiene que obedecer. Si el código y esto no
coinciden, lo que está mal es el código — o esto, y entonces se corrige aquí
primero y se arrastra después.

Nace de una observación de Jose que era exacta: la aplicación ofrecía combinar
«método de pago: efectivo» con «cuenta de cargo: Santander», y luego preguntaba
al usuario qué significaba eso. Ofrecer una contradicción y pedir que la
resuelva quien la sufre no es una decisión de producto pendiente, es un fallo.

---

## 1 · Cuenta

**Una cuenta es un sitio donde hay dinero y del que se puede saber el saldo a
una fecha.** Nada más. Todas se leen igual, todas tienen movimientos y todas
suman al patrimonio.

**Hay DOS clases de cuenta, y una tarjeta no es ninguna de las dos.**

| Tipo | Qué es | Tiene IBAN |
|---|---|---|
| `CORRIENTE` | Cuenta bancaria | Sí |
| `EFECTIVO` | El dinero físico · el colchón, la cartera | **No** |

**El efectivo es una cuenta como cualquier otra.** Tiene saldo, tiene
movimientos, suma al patrimonio y se lee igual que un banco. Si fuera un caso
raro con reglas propias no tendría sentido: lo que lo distingue es que nadie
emite un extracto del colchón, no que el dinero valga menos.

Su única singularidad real: **no tiene IBAN ni banco**, así que no se le
importa un extracto y su saldo se mueve solo por lo que se anota o por
traspasos (§4).

**Decisión · 3 de agosto de 2026 (Jose):** `AHORRO` y `OTRA` se retiran.
Complican sin distinguir nada — una cuenta de ahorro se comporta exactamente
como una corriente, y "otra" no dice nada. *(Hecho · V86: el tipo ya no las
admite y las que existieran pasaron a `CORRIENTE` sin perder nada.)*

**`TARJETA_CREDITO` deja de ser un tipo de cuenta.** Una tarjeta no es un sitio
donde hay dinero: es una forma de gastar el de una cuenta. Ver §3. *(Hecho ·
V88: el tipo ya no existe y las cuentas que lo eran se borraron con sus
movimientos —decisión de Jose, 4 ago 2026—, porque ese gasto ya lo contaba el
recibo que el banco cobra en la cuenta corriente.)*

**Solo puede haber una cuenta de efectivo por usuario.** Dos colchones no se
distinguen: el dinero físico es uno. Y hay un motivo más concreto: el método
«efectivo» paga desde la primera que encuentra, así que la segunda quedaría
muerta — recibiría traspasos de cajero y no pagaría nada, con el dinero
atrapado dentro. *(Garantizado al crear y al cambiar el tipo.)*

---

## 2 · Método de pago

**El método de pago dice CÓMO sale el dinero de la cuenta, no de dónde.** De
dónde lo dice la cuenta. Son dos datos distintos y ninguno sustituye al otro.

| Método | De qué cuenta puede salir | Singularidad |
|---|---|---|
| Domiciliación | Cualquiera con IBAN | El cobrador tira del recibo |
| Transferencia | Cualquiera con IBAN | La ordena el titular |
| Tarjeta | La cuenta de liquidación de la tarjeta | Ver §3 |
| **Efectivo** | **Solo la cuenta `EFECTIVO`** | §4 |
| **Bizum** | **Solo la cuenta que tiene el Bizum activado** | §5 |

**La regla que se incumplía:** el método de pago **restringe** qué cuentas se
pueden elegir. Un formulario que ofrece las diez cuentas cuando el método es
Bizum, o que pide cuenta de cargo cuando el método es Efectivo, está ofreciendo
estados imposibles — y alguien acabará guardándolos.

### Dos vocabularios, y hay que saberlo

Hoy conviven dos enumeraciones para lo mismo:

- `MetodoDePago` (movimientos): `Domiciliado | Transferencia | TPV | Efectivo | Bizum`
- `MetodoPagoCompromiso` (recurrentes): `domiciliacion | transferencia | tarjeta | efectivo | bizum`

No coinciden ni en los valores (`TPV` / `tarjeta`) ni en la forma. Mientras
sigan siendo dos, **la traducción vive en `metodoDePago.ts` y en ningún otro
sitio** — con tablas exhaustivas, no con un `switch`: añadir un método al tipo
tiene que romper la compilación, no devolver `undefined` en silencio. Fue
exactamente eso lo que dejó `bizum` sin traducir durante meses.

De ahí sale también **el nombre que ve el usuario**, para que dos pantallas no
llamen distinto a lo mismo.

---

## 3 · Tarjetas

Una tarjeta plantea **tres preguntas distintas** y mezclarlas es lo que enreda
el diseño. Van separadas a propósito:

| | Pregunta | Sección |
|---|---|---|
| **Qué es** | ¿Es una cuenta? ¿De quién cuelga? | §3.1 · §3.2 |
| **Cuándo mueve el dinero** | ¿Ahora o el día de cargo? | §3.3 · §3.4 |
| **Qué demuestra** | ¿Bonifica la hipoteca? | §3.6 |

Las dos últimas se apoyan en **un solo dato**, y por eso conviene verlo antes
de nada: **cuánto se ha gastado con ESA tarjeta en ESE periodo** (§3.5). Quien
tenga ese número tiene las dos respuestas; quien no lo tenga, ninguna.

Hubo una cuarta —**qué rinde**, el cashback— y se retiró. Por qué, en §3.7.

### 3.1 · Qué es · un método de pago, no una cuenta

**Una tarjeta no tiene saldo: tiene una cuenta donde se liquida.** No es un
sitio donde hay dinero, es una forma de gastar el de una cuenta.

**Una cuenta tiene normalmente DOS tarjetas** —débito y crédito— y puede tener
más. Nada del modelo puede asumir «la tarjeta» de una cuenta.

### 3.2 · De quién cuelga · del banco o de fuera

| | Tarjeta **del banco** | Tarjeta **de fuera** |
|---|---|---|
| Ejemplos | La de débito y la de crédito de tu Santander | Carrefour · Cetelem · Bankintercard |
| Cómo nace | **Con la cuenta** · al dar de alta el banco | **Por su cuenta** · no cuelga del alta de ningún banco |
| Su cuenta | La del banco que la emite · **intrínseca** | Donde la tienes domiciliada **hoy** |
| ¿Cambia de cuenta? | No tiene sentido | **Sí, y pasa a menudo** |
| ¿Bonifica? | Puede (§3.6) | **Nunca** (§3.6) |

> Las de fuera del banco no deberían nacer de la misma forma, ya que son muy
> susceptibles a que cambiemos la domiciliación del pago. Por lo que no puede
> estar anclada de manera sostenida en una cuenta bancaria.
>
> — Jose, 3 de agosto de 2026

Reglas que se derivan:

- Una tarjeta de fuera **no se crea desde el alta de una cuenta**. Elegir dónde
  se domicilia es un dato suyo, no su origen.
- **Cambiar la domiciliación es una operación normal**, no rehacer la tarjeta.
  Rehacerla perdería su historial de gasto, que es lo que sostiene §3.5.
- **Cambiar la domiciliación NO reescribe el pasado.** Los cargos ya cobrados se
  quedan en la cuenta donde se cobraron: ya ocurrieron.
- La **emisora** (Carrefour, Cetelem) es una etiqueta y **puede no ser un banco
  tuyo**: no se elige entre tus cuentas. La **cuenta de liquidación** sí es
  siempre una cuenta propia, y nunca la de efectivo ni otra tarjeta.

### 3.3 · Cuándo mueve el dinero · la modalidad

Lo que decide cuándo se mueve el saldo es la modalidad, no la tarjeta.

**Débito · el dinero sale YA.** Compras y se descuenta en el momento. No genera
previsión propia: el cargo es el movimiento. Sacar del cajero con ella es un
**traspaso interno a la cuenta de efectivo** (§4), no un gasto — da igual que
sea con plástico, el dinero sigue siendo tuyo.

**Crédito aplazado · el dinero sale un día concreto.** Las compras del periodo
**no mueven el saldo el día de la compra**; todo se cobra junto el día de cargo,
**sin intereses**. Lo que hay que prever es **un solo cargo** por periodo en la
cuenta de liquidación.

**Crédito fraccionado · FUERA DE ESTA VERSIÓN.** *(Decisión · Jose · 3 ago
2026.)* No se ofrece; si aparece en un extracto se trata como un cargo
cualquiera.

### 3.4 · Cuándo exactamente · CORTE y CARGO son dos fechas

Lo que hoy se guarda es un único `settlementDay` y no llega:

> Normalmente van del 25 al 24 de cada mes y se emite el cargo en el banco el
> 31. Otras van de 1 a 31 y se emite el cargo el 5. Y otras, por ejemplo
> Unicaja, van con corte semanal y se paga el lunes de la semana siguiente,
> aunque también puede ser mensual.
>
> — Jose, 3 de agosto de 2026

Son **tres** datos: **periodicidad** (mensual · semanal), **corte** (día 24 ·
último del mes · domingo) y **día de cargo** (31 del mismo mes · 5 del siguiente
· lunes siguiente).

- Una compra pertenece a su periodo **por su fecha**: una del 26, con corte el
  24, se cobra en el periodo siguiente.
- La previsión se coloca en el día de **CARGO**, que es cuando sale el dinero, y
  puede caer en otro mes que el corte.
- **Con corte semanal hay varios cargos al mes.** Un modelo de «un recibo
  mensual por tarjeta» no sirve para Unicaja.
- «Día 31» significa **el último del mes**; febrero no se salta.

### 3.5 · El dato que lo sostiene todo · gasto por tarjeta y periodo

**Cuánto se ha gastado con esa tarjeta en ese periodo.** Es una sola cifra y de
ella salen las dos respuestas que siguen. No es un extra: sin ella, ni se puede
prever el cargo (§3.3) ni demostrar una bonificación (§3.6).

Y ya existe, sin guardar nada nuevo: **para una tarjeta de crédito, el gasto de
un periodo ES su recibo.** El banco carga exactamente eso, así que la cifra no
hay que reconstruirla — está en el cargo.

Cada periodo dice además **cómo de firme es**: `cerrado` cuando el cargo ya se
cobró y cuadró contra el extracto, `abierto` mientras sigue siendo previsión.
La distinción no es cosmética: una bonificación se demuestra con lo cobrado, no
con lo que esperas gastar.

Del periodo **en curso** es una cifra **viva**:

> El período abierto están todas las previsiones, pero si mañana gasto algo de
> la tarjeta tendré que hacer una anotación manual e irá creciendo.
>
> — Jose, 3 de agosto de 2026

**Decisión · 4 de agosto de 2026 · el débito lo dice el movimiento.**

Del **crédito**, el gasto de un periodo ES su recibo. Del **débito** no hay
recibo del que deducirlo, así que sale de los movimientos que el usuario
atribuye a una tarjeta: el extracto no la trae, y el método de pago como mucho
dice que fue con tarjeta, no **cuál**.

- **Solo el débito entra por ahí.** Un movimiento marcado con una tarjeta de
  crédito es su recibo, y ese gasto ya viene por el recibo: contarlo dos veces
  inflaría una cifra que se presume ante un banco.
- **Cada movimiento es su propio periodo**, y no es un apaño: el débito cobra al
  momento, así que su periodo dura un instante. Inventarle cortes mensuales
  sería fabricar un ciclo que esa tarjeta no tiene (§3.3).
- Y **ya ocurrió**: un movimiento del extracto no es una previsión que pueda
  crecer, así que nace cerrado.

### 3.6 · Qué demuestra · las bonificaciones

Los importes de tarjeta son la **prueba** de que se cumplen los requisitos que
bonifican una hipoteca o un préstamo (§6 ter).

- **Solo cuenta la tarjeta DEL BANCO que bonifica.** Las de fuera **nunca**
  bonifican: son externas justamente por eso. Sumarlas diría que cumples un
  requisito que no cumples, y eso se paga en el recibo.
- Importa **la tarjeta concreta**, no la cuenta. De una misma cuenta cuelgan
  dos y el banco bonifica por una, así que la bonificación dice **cuál**; y
  donde se elige solo se ofrecen las del banco, porque ofrecer una de fuera
  sería ofrecer una respuesta falsa (§7).
- Elegir una de fuera **no** es «no se puede comprobar»: es que **no**. Y no se
  arregla gastando más.

### 3.7 · Qué rinde · el cashback · RETIRADO

**ATLAS no modela el cashback.** Se probó —se medía «te ha devuelto X € de Y €
canalizados», con su techo anual— y se quitó el 5 de agosto de 2026. Queda
escrito por qué, porque la idea vuelve sola.

Lo que la tumbó es que **«cashback» no es una cosa, son dos**, y son distintas
justo en lo único que aquí importa: si el dinero llega o no llega a una cuenta.

> El que yo tengo de Carrefour es que te dan un dinero en su tarjeta y que
> puedes usar para pagar compras del Carrefour … y luego existirán otras como
> el Sabadell, que el dinero sí que entra en cuenta como un ingreso y que es
> usable para cualquier cosa. En el caso de Carrefour se acumula trimestral y
> se usa durante un periodo; el caso del Sabadell es mensual y no caduca.
>
> — Jose, 5 de agosto de 2026

- El del **Sabadell** es dinero de verdad: entra en una cuenta y se concilia
  como cualquier otro ingreso. No hace falta un concepto para eso.
- El del **Carrefour** no es dinero en una cuenta tuya, es **saldo dentro de la
  tienda**, y **ya se refleja solo**: si pagas 50 € con 20 € de ese saldo, el
  extracto dice 30 €, que es exactamente lo que sale de tu patrimonio.
  Modelarlo sería construir un monedero aparte —saldo, corte trimestral,
  ventana de uso, caducidad, avisos— que no mueve ni un euro de tesorería.

Y el coste no era solo de código:

> Nos obligaría de cualquier forma a que uno sea informativo y el otro real, y
> hay que explicitarlo en la creación de las tarjetas y hacer pensar al cliente
> de qué forma es uno y otro.
>
> — Jose, 5 de agosto de 2026

Ésa es la razón de fondo. Distinguirlos obliga a **preguntar en cada alta de
tarjeta de qué tipo es su cashback** — una pregunta que solo existe porque
nosotros no sabemos modelar el segundo caso, y que el usuario tiene que
contestar bien para que la cifra no mienta. Se paga con carga mental del
cliente y se cobra en un número que no decide ningún pago.

Con ella se fueron `cashbackPorcentaje` y **`limite`**: el límite del periodo
solo se guardaba para calcular el techo del cashback, así que sin él era un
campo que se rellena y nadie lee. Si algún día vuelve, que vuelva porque
responde a una pregunta de dinero, no para enseñar un porcentaje.

## 4 · Efectivo

**El efectivo es una cuenta más, y por eso el dinero tiene que llegar a ella
antes de gastarse.** Ésta es la definición que da coherencia a todo:

> Un cliente cobra la nómina en Santander y quiere pagarlo todo en efectivo. En
> la vida real saca el dinero del cajero y lo guarda en un colchón; después
> paga los recibos con esos billetes. En ATLAS es exactamente eso: un traspaso
> interno de Santander a Efectivo, y luego los pagos salen de Efectivo.
>
> — Jose, 3 de agosto de 2026

Por tanto:

- **Un gasto pagado en efectivo descuenta de la cuenta `EFECTIVO`.** No de una
  cuenta bancaria, y no «de ninguna».
- Un recurrente con método `efectivo` **no tiene cuenta de cargo elegible**: su
  cuenta es la de efectivo, y punto. El campo no debe pedirse.
- Si no existe cuenta de efectivo, el método no se puede ofrecer. Antes eso que
  guardar un gasto en efectivo colgado de una cuenta bancaria.

### Retirada de cajero

**Una retirada de cajero NO es un gasto: es un traspaso interno** de la cuenta
bancaria a la cuenta de efectivo. El dinero no sale del patrimonio, cambia de
sitio.

Se escribe como los dos apuntes espejo de §6 y por eso no cuenta ni como gasto
ni como ingreso en «cómo va el mes».

---

## 5 · Bizum

**Bizum es una forma de pago de una cuenta bancaria**, como la domiciliación o
la transferencia: el dinero sale de la cuenta, no de ningún sitio aparte.

Su singularidad es legal, no técnica: **el Bizum va atado a un teléfono y un
teléfono a una cuenta, así que solo UNA cuenta puede tenerlo activado**
(`Account.bizum`, con exclusividad garantizada en `cuentasService`).

Consecuencia directa: **donde se elija método Bizum, la cuenta no se elige —
es la que lo tiene.** Ofrecer las demás es ofrecer un estado imposible.

---

## 6 · Traspaso interno vs. transferencia externa

Se escriben parecido y no significan lo mismo, y confundirlos hace aparecer o
desaparecer dinero:

| | Traspaso **interno** | Transferencia **externa** |
|---|---|---|
| A dónde va | A otra cuenta **tuya** | A un tercero |
| Apuntes | **Dos**, espejo: salida y entrada | Uno |
| ¿Es gasto? | **No** · el dinero no sale del patrimonio | Sí |
| Cómo se corrige | Las dos patas a la vez (`traspasoInterno.ts`) | Como cualquier movimiento |

El interno guarda `categoryKey` `traspaso_salida` / `traspaso_entrada` y las dos
patas se apuntan por `transferMetadata.pairEventId`. `transferMetadata.targetAccountId`
guarda **«la otra cuenta»**: el destino en la salida y el **origen** en la
entrada. Quien lo lea sin saber esto invierte el traspaso.

---

## 6 bis · Previsiones · quién genera cargo y cuándo

Todo lo anterior existe para responder una sola pregunta: **qué dinero va a
salir de qué cuenta y qué día.** Aquí está la traducción, que es donde se
rompía.

| Origen | Cuenta que se mueve | Cuándo | Cuántos apuntes |
|---|---|---|---|
| Recurrente domiciliado / transferencia | La de cargo | El día del cargo | 1 |
| Recurrente en **efectivo** | La cuenta `EFECTIVO` (§4) | El día del cargo | 1 |
| Recurrente por **Bizum** | La que tiene el Bizum (§5) | El día del cargo | 1 |
| Compra con **débito** | La cuenta de la tarjeta | **El mismo día** | 1 |
| Compra con **crédito aplazado** | La cuenta de liquidación | **El día de liquidación**, sumada con las demás del periodo | 1 por periodo, no 1 por compra |
| **Retirada de cajero** | Banco → `EFECTIVO` | El día | **2**, espejo (§6) |
| **Traspaso interno** | Origen → destino | El día | **2**, espejo (§6) |

Tres reglas que se incumplían y por eso están escritas:

1. **La cuenta de la previsión la decide el método, no un desplegable libre.**
   Un recurrente en efectivo que proyecta sobre una cuenta bancaria hace que el
   banco parezca más pobre y el colchón no baje nunca.
2. **Una previsión del mes en curso cuyo día ya pasó SIGUE siendo una
   previsión.** No se puede dar por confirmada por haber llegado tarde: si el
   cargo real existe, tiene que tener con qué casarse.
3. **Un traspaso interno no es gasto ni ingreso**, aunque tenga dos apuntes con
   signo. Contarlo hincha las dos columnas a la vez.

### El crédito aplazado · cómo se calcula

Ya está construido. Con el ciclo de §3.4, el motor hace dos cosas:

- Coloca cada compra en **su** periodo según la fecha de corte
  (`corteQueLeToca`) — no por mes natural, que era el fallo: una compra del 26
  con corte el 24 se cobraba un mes antes de lo que toca.
- Emite **un cargo previsto por periodo** en el día de cargo (`cuandoSeCobra`),
  que con corte semanal son varios al mes.

El cargo se apunta en la **cuenta de liquidación**, no en la tarjeta, y se
identifica por **(tarjeta · fecha de corte)**. No lleva el mes en que se
calcula: el cargo puede caer en otro mes que las compras —corte el 24 de enero,
cargo el 5 de febrero— y si la identidad dependiera del mes en curso, cada
pasada del motor crearía otro cargo para el mismo recibo.

Un gasto dice con qué tarjeta se paga (`tarjetaId`). Si no lo dice, sale de su
cuenta el día del cargo, como siempre. Si apunta a una tarjeta que ya no existe
—o a una de débito, que cobra al momento—, **vuelve a su cuenta**: mejor una
previsión donde estaba que un gasto que desaparece de la vista.

**Decisión · 3 de agosto de 2026 (Jose):** mientras el periodo está **abierto**,
el cargo previsto **va creciendo**.

> El período abierto están todas las previsiones, pero si mañana gasto algo de
> la tarjeta tendré que hacer una anotación manual e irá creciendo.
>
> — Jose

Es decir: el cargo del periodo en curso es una previsión **viva**, que se
recalcula cada vez que se anota o se importa una compra de esa tarjeta. No es
una cifra fija que aparece el día del corte.

### 6 bis · bis · El cuadro del préstamo · UN SOLO MOTOR

> El tema de financiación lo tenemos que retocar bastante … debemos hacer un
> repaso importante de los conceptos que afectan a un préstamo, porque es clave
> para los cálculos: es la madre del cordero.
>
> — Jose, 5 de agosto de 2026

Del cuadro de amortización sale casi todo lo demás: las previsiones de
tesorería, los intereses del ejercicio, la fiscalidad del alquiler y la cuota
que se enseña. Si el cuadro está mal, todo eso está mal.

**Había dos motores**, y el cuadro que acababas teniendo dependía de **por qué
puerta habías entrado**: el asistente de préstamos calculaba el suyo y pisaba
el que el servicio acababa de guardar… salvo si el préstamo era anterior al
asistente, o venía de una importación, o de la venta de un inmueble, o de una
edición hecha desde otra pantalla. Los dos escribían en el mismo sitio y no
decían lo mismo. Había un **tercero** escondido: las previsiones de tesorería
se generaban aparte, con su propio cuadro.

**Decisión · 5 de agosto de 2026: un solo motor** (`services/prestamos/cuadro`).

- **Una sola puerta.** El cuadro se genera en un único sitio, y la vista previa
  del asistente enseña **el mismo** que se va a guardar.
- **El tipo sale de la regla única** (§6 ter), con su tope. El asistente sumaba
  los puntos por su cuenta y sin tope, así que podía enseñar una cuota más baja
  que la que después se guardaba.
- **El cuadro no mira el reloj.** Antes el tipo se resolvía con la fecha de hoy:
  el mismo préstamo daba un cuadro distinto según el día en que lo generaras.
- **La carencia técnica se lee, no se deduce.** Es un cargo aparte —los días
  sueltos entre la firma y el primer mes de cobro— y solo existe si el préstamo
  la trae guardada: deducirla se la inventaría en los préstamos antiguos.
- **Regenerar no borra el punteo.** El enlace de una cuota con el movimiento del
  banco es trabajo del usuario, no un dato calculado. Se conservaba solo cuando
  editabas desde el asistente; ahora, siempre.

#### El tipo no es uno para toda la vida · los tramos

El cuadro se generaba entero a un solo tipo. Una **mixta 3+27** al 2,0 % fijo y
Euríbor+1 después decía que ibas a pagar el 2,0 % durante treinta años; una
**variable** de 2021 se generaba entera al Euríbor de hoy, así que sus cuotas
pasadas salían con el tipo de ahora — y de ahí salen los intereses de cada
ejercicio.

**Decisión · 5 de agosto de 2026: el cuadro se parte en tramos**
(`tramosDeTipo`), con una regla por encima de todas:

> **El Euríbor de mañana no se sabe, y no se inventa.**

Es la misma regla que la fecha de revisión (§6 ter): un número inventado se lee
igual que uno real, y sobre él se hacen cuentas.

| | De dónde sale el tipo | ¿Estimación? |
|---|---|---|
| **Fijo** | El de la escritura | No |
| **Mixto · tramo fijo** | El de la escritura | No |
| **Mixto · tramo variable** | Índice de hoy + diferencial, desde la fecha que dice la escritura | **Sí** |
| **Variable · antes de la 1.ª revisión apuntada** | Índice de hoy + diferencial | **Sí** |
| **Variable · cada revisión apuntada** | El índice de la carta del banco + diferencial | No |
| **Variable · después de la última apuntada** | Se sigue con ese mismo tipo | **Sí** |

Tres cosas que se derivan y por eso están escritas:

1. **Un mixto SÍ se parte, aunque el tipo de después sea una estimación.** La
   fecha del cambio está en la escritura: no partirlo es esconder un dato que sí
   se sabe. Decir «desde marzo de 2029, en torno al 3,1 %» se acerca mucho más
   que decir «el 2,0 % hasta 2054».
2. **Después de la última revisión conocida no se proyecta ninguna más.** Se
   sabe *cuándo* revisa el banco, no *a cuánto*: partir el cuadro por una fecha
   futura para volver a poner el mismo tipo no cambia nada y finge una precisión
   que no hay.
3. **Cada tramo se aplica con `recalcularDesde`**, que es lo que hace el banco:
   lo pagado se queda como está y la cuota nueva sale del **capital vivo de ese
   día**, al tipo nuevo, en los meses que falten. Regenerar desde el origen
   reescribiría intereses ya devengados.

#### La base de cálculo · cómo cuenta los días el banco

La cuota de un préstamo francés sale siempre del tipo entre doce. Pero **el
interés que el banco liquida cada mes no sale de ahí**: sale de contar días.

> interés = capital × TIN × **días ÷ base**

Y la base es una **cláusula de la escritura**, no una constante:

| Base | Qué hace | |
|---|---|---|
| **365/360** | Días reales sobre un año de 360 | La clásica española · **un 1,39 % más cara** |
| **365/365** | Días reales sobre 365 | Lo que muchos bancos usan hoy |
| **30/360** | Todos los meses valen 30 | El mes comercial · equivale a dividir entre doce |

Mientras la base no se pregunte, **el desglose interés/capital de cada recibo no
puede cuadrar con el del banco**, aunque la cuota coincida al céntimo. Era la
última pieza de «que el cuadro cuadre con el banco».

**Decisión · 5 de agosto de 2026: se pregunta, y ausente = 30/360.** No se
presume la clásica 365/360 aunque sea la más habitual: eso movería el cuadro de
todos los préstamos ya guardados sin que nadie lo haya pedido, y presumir una
cláusula que nadie ha leído es inventarse un dato — la misma regla que la fecha
de revisión y el valor del índice.

Dos matices:

- **La base no cambia la cuota**, solo el reparto. Lo que sube con 365/360 es la
  parte de interés de cada recibo, así que se amortiza algo menos cada mes y la
  última cuota es mayor. Es exactamente lo que pasa en la vida real.
- **Los tramos sueltos de días se cuentan siempre por días**, aunque la base sea
  el mes comercial: la prorrata del primer periodo y la liquidación entre la
  firma y el primer cobro no son un mes, y llamarlos mes cobraría de más o de
  menos según cuántos días tengan. Con 30/360 se cuentan sobre 365 — que es lo
  que dice la carta del Santander: 78.500 € al 4,99 % por 20 días, 214,64 €.

Y **las revisiones ya aplicadas se apuntan** en el alta y la edición del
préstamo: la fecha desde la que rigen y el valor del índice, tal como vienen en
la carta. Se guarda el **índice**, no el tipo final, porque el diferencial es
del contrato: guardar la suma obligaría a rehacerla si alguien corrige el
diferencial, y las dos cifras acabarían contradiciéndose.

### 6 bis · ter · La carencia · qué es y qué le hace a tu deuda

**Una carencia es un periodo inicial en el que no se amortiza capital.** Hay
dos, y no se parecen en lo único que importa: qué le pasa a lo que debes.

| | Qué pagas | Qué pasa con la deuda |
|---|---|---|
| **De capital** *(«solo intereses»)* | Los intereses del mes | Se queda **quieta** · al acabar debes lo mismo que el primer día |
| **Total** | **Nada** | **CRECE** · los intereses se capitalizan y al acabar debes **más de lo que pediste** |

La segunda es la que sorprende, y es la que el asistente ya prometía por
escrito —«Total · sin pagos durante N meses · los intereses se capitalizan»—.
Lo decía desde el principio; lo que no hacía era cumplirlo.

Dos reglas más:

- **El plazo INCLUYE la carencia.** Una hipoteca a 360 meses con 24 de carencia
  son 24 sin amortizar y 336 amortizando, no 384 en total.
- **Al acabar, la cuota se recalcula** sobre lo que se deba **ese día** y en los
  meses que queden. Con carencia total eso es más capital que el inicial, así
  que la cuota sube por partida doble: menos meses y más deuda.

#### La carencia NO es la carencia técnica

Comparten la palabra y no comparten nada más:

- La **carencia** (ésta) es un pacto: N meses sin amortizar, y se cuenta en
  meses.
- La **carencia técnica** son los **días sueltos** entre la firma y el primer
  mes de cobro, que el banco liquida en un cargo aparte (§6 bis · bis, línea 0
  del cuadro). No la eliges: sale de las fechas.

**Decisión · 5 de agosto de 2026: una sola forma de decir carencia.**

Había **cuatro**, y las dos que importaban no se hablaban entre sí:

1. `carencia` + `carenciaMeses` · se preguntaba en el alta, se guardaba, se
   importaba y se exportaba. **Ningún cálculo la leía.**
2. `mesesSoloIntereses` · el motor la aplicaba, y hacía exactamente una
   carencia de capital. **Nadie la escribía.**
3. `esquemaPrimerRecibo: 'SOLO_INTERESES'` · un tercer nombre, y solo para un
   mes. Lo escribía la importación desde plantilla.
4. `carenciaTecnica` · ni siquiera es esto.

> Quien pedía doce meses de carencia veía un cuadro sin carencia, porque la
> mitad que se rellenaba y la mitad que se aplicaba eran campos distintos.

Ahora manda `carencia` + `carenciaMeses` —la que ya se rellenaba—, el motor la
lee, `mesesSoloIntereses` se retira y el esquema de la importación se **traduce**
a un mes de carencia de capital en vez de mantener un camino aparte.

Lo que este motor **todavía no hace** está en §8, empezando por la TAE.

---

### 6 bis · quater · Lo que cuesta adelantar dinero

Amortizar antes de tiempo puede llevar comisión, y **la escritura manda**.

**La unidad son PUNTOS PORCENTUALES**: `0,25` es un 0,25 %, como se teclea y
como lo dice el papel del banco. Había **cuatro** sitios leyéndola de cuatro
maneras —dos multiplicando en crudo, o sea como fracción, y dos adivinando por
el tamaño—, así que un 0,25 % pactado salía como un **25 %**: en una
amortización de 30.000 €, **7.500 € en vez de 75 €**.

Y adivinar era imposible además de feo: la heurística «≤ 1 es una fracción»
fallaba **justo en las cifras que la ley prescribe** —0,25 %, 0,15 %, 0,5 %,
1 %— y acertaba solo en las del tipo fijo.

#### Parcial y total son DOS comisiones

> Yo por ejemplo tenía que si cancelaba totalmente la hipoteca era un 0,25 %
> pero parcial era un 0… el propio banco me dijo: cancelas parcialmente todo
> menos una cuota y listo.
>
> — Jose, 5 de agosto de 2026

Legalmente las dos son «reembolso anticipado» y comparten tope, pero **el tope
es un máximo**: nada obliga a que se pacten iguales, y lo normal es que no lo
sean. Tratarlas como un solo concepto no podría ni representar esa hipoteca, y
borraría justo el dato del que sale la decisión.

#### Una comisión es un CALENDARIO, no un número

Lo normal es que cambie con el tiempo: «2 % los diez primeros años y 1,50 %
después», «0,25 % los tres primeros y nada más». Por eso se guarda como
**tramos**, y un porcentaje suelto —lo que guardaban los préstamos de antes— se
lee como un calendario de un solo tramo.

**Pasado el último tramo con porcentaje, la comisión es cero**, y eso cambia el
resultado de cada simulación. Y «no hay comisión» y «la había pero se agotó» se
distinguen, para que la pantalla pueda decir por qué no se paga nada.

#### El tope legal se PROPONE al dar de alta

> Sí que debería prerrellenar con el % máximo cuando se crea, de tal forma que
> si es distinto se cambie y si no, al menos guarde un dato.
>
> — Jose, 5 de agosto de 2026

Tiene razón, y corrige la lectura fácil de «no inventar»: **dejarlo en cero
tampoco es neutral**, porque cero afirma «no hay comisión», que es una
afirmación fuerte y además optimista. Un tope legal propuesto es mejor dato.

Lo que lo hace honesto es guardar **de dónde sale la cifra**:

| `origen` | Qué significa |
|---|---|
| `ESCRITURA` | Lo puso el usuario · en cuanto toca el campo, pasa a ser esto |
| `TOPE_LEGAL` | Lo propuso ATLAS · la pantalla lo marca y pide contrastarlo |

Y solo se propone **donde se puede saber**:

| Préstamo | Qué se propone |
|---|---|
| Hipoteca desde el 16-jun-2019 · **variable** | **Las dos opciones** de la Ley 5/2019 — 0,25 % / 3 años o 0,15 % / 5 años — porque la ley dice que se pacta **una**, y cuál no se deduce |
| La misma · **fijo** | 2 % los 10 primeros años, 1,50 % después |
| Hipoteca del 09-dic-2007 al 15-jun-2019 | 0,50 % los 5 primeros años, 0,25 % después *(Ley 41/2007)* |
| **Mixta** | **Nada** · el tope depende del tipo vigente el día que amortices |
| **Personal o al consumo** | **Nada** · su tope depende del plazo que QUEDA, no del tiempo desde la firma |
| Hipoteca anterior a 2007 | **Nada** · el régimen era contractual |

Una lista vacía no es un fallo: es que ATLAS no lo sabe, y entonces se calla.

#### La ley acota, pero ATLAS no la aplica

Los topes existen —Ley 5/2019 para hipotecas, Ley 16/2011 para crédito al
consumo— pero **dependen de qué préstamo sea**: si es vivienda, si el
prestatario es consumidor, la fecha de firma, cuál de las dos opciones del
variable se pactó, y de que exista pérdida financiera para el banco. ATLAS no
sabe casi nada de eso.

**Así que no recorta nada en silencio.** Guarda lo pactado y calcula con ello.
Avisar de que una cifra parece pasarse del tope es otra conversación, y está
en §8: una vez abierta esa puerta hay que mantenerla al día.

---

## 6 ter · Condiciones que se verifican contra la tesorería

Las bonificaciones de una hipoteca o un préstamo no se cumplen por declararlas:
se cumplen porque **los movimientos lo demuestran**.

> Estos movimientos e importes también son importantes para controlar si se
> cumplen los requerimientos de bonificaciones de las hipotecas o préstamos que
> lo piden para bonificar.
>
> — Jose, 3 de agosto de 2026

El caso de la tarjeta está en §3.6, con su regla de que **solo cuenta la del
banco que bonifica**. Pero no es el único: nómina domiciliada, recibos
domiciliados, seguros contratados… **todos son condiciones que se verifican
contra la tesorería**.

Lo que comparten, y por eso van juntas aquí: cada una necesita **agregar
movimientos de un tipo, en una ventana de tiempo, y compararlos con un
umbral**. Esa forma está escrita una vez y no sabe qué es una tarjeta; cada
fuente aporta solo el agregado.

**Decisión · 3 de agosto de 2026:**

- **Tres respuestas, no dos.** `cumple`, `no_cumple` y **`no_verificable`**. La
  tercera no es un «no» cobarde: es la diferencia entre «los movimientos dicen
  que te quedas corto» y «nada en la tesorería puede probar esto». Enseñar la
  segunda como la primera manda a gastar más para arreglar algo que no se
  arregla gastando.
- **Lo que todavía no se puede mirar se dice, no se da por bueno.** Una lista
  donde solo aparecen las verificables se leería como que las demás están bien.
- **La ventana acaba HOY**, no en el cierre de un periodo: la pregunta que se
  responde es «¿la tengo ahora?».
- **Una bonificación tiene que poder decirse de forma verificable.** Guardarlas
  todas como «otra» dejaba la condición en una frase, y una frase no se puede
  comparar con nada. Cada una lleva **qué** hay que demostrar, **en cuántos
  meses** y —la de tarjeta— **con qué tarjeta**.

De la de tarjeta se sabe el total del periodo, que es su recibo (§3.5); **no las
compras una a una**. Una condición del tipo «6 operaciones al mes» no se puede
contar hoy, y así se dice.

**Decisión · 4 de agosto de 2026 · no todas se miden igual.**

La tarjeta se mide por un **total** en la ventana. La nómina, **mes a mes**: un
semestre con 7.200 € no cumple «1.200 € al mes» si un mes vino vacío y otro
doble. Así que **basta un mes por debajo para perderla**, y lo que decide —y lo
que se enseña— es **el mes más flojo**, no la suma.

Lo que el banco mira de la nómina es **lo que le entra a él**: domiciliada en su
cuenta. Domiciliarla en otro banco no es «no se puede comprobar», es que **no**.
Distinto de que ATLAS no sepa de ninguna nómina, que sí es no poder comprobarlo.

**Decisión · 4 de agosto de 2026 · los recibos se cuentan, no se suman.**

«Tener domiciliados al menos tres recibos» son **tres servicios distintos**, no
el de la luz tres meses seguidos. Así que se cuentan **orígenes** —el recurrente
que los emite— y no cargos. Y se miden mes a mes, como la nómina: el mes con
menos recibos es el que decide.

Por eso una condición dice también **en qué se mide**. Casi todas van en euros y
ese es el supuesto por defecto; los recibos no. Enseñar «3 €» donde el banco
pide tres recibos no es un detalle de formato, es otra cosa.

Y aquí el silencio **sí** es un «no», al revés que en la nómina: no hace falta
dar de alta nada para que ATLAS vea un recibo domiciliado —sale de los gastos
recurrentes, que es de donde sale toda la tesorería—. Cero recibos cargados en
esa cuenta significa cero recibos domiciliados en ella.

**Decisión · 4 de agosto de 2026 · un mes que aún no cuenta no es un mes sin nada.**

Lo que se mide es lo cobrado, así que un mes que todavía no consta no demuestra
nada. Pero **tampoco desmiente**: con nada cerrado, decir «no ha entrado ninguna
nómina» sería acusar de incumplir a quien solo tiene el cobro por constar. Eso
es `no_verificable`, no `no_cumple` — la misma tercera respuesta de siempre.

Y **no se afirma por qué** no consta. Que un mes esté abierto puede significar
que el cargo está por conciliar **o que sencillamente aún no ha pasado**, y
desde aquí no se distingue: decir «sin conciliar» sería elegir una de las dos.
Lo cierto en los dos casos es que **todavía no cuenta**.

Esos meses **se dicen**. Callarlos deja un «4 de 4 meses» donde en realidad
faltaban dos por mirar, que es una tranquilidad prestada.

**Y quien resolverá la duda es el CIERRE DE MES, no un plazo.** *(Jose · 4 ago
2026.)* Habrá un momento en que se trabaje para cerrar el mes, y lo que quede
abierto entonces será que **no se ha producido**, con las consecuencias en
cascada que eso tenga. Hasta que ese momento exista, aquí no se decide por
adelantado: un «lleva diez días de retraso» pondría un umbral que nadie ha
elegido, y encima casi siempre significaría que falta importar un extracto.

### 6 ter · ter · Cuándo lo mira el banco

Una bonificación **no se pierde el día que dejas de cumplirla: se pierde el día
que el banco lo mira.** Hasta entonces sigues pagando la cuota rebajada aunque
lleves tres meses sin gastar con la tarjeta — y al revés, empezar a cumplir hoy
no baja el recibo de este mes.

Por eso el veredicto no puede decir «pasarías al 2,70 %» a secas. Sin fecha es
una hipótesis que nadie puede agendar; con fecha es una cita, y **da tiempo a
corregir**, que es para lo que sirve saberlo.

**Decisión · 4 de agosto de 2026 (Jose).** Tres datos, todos del PRÉSTAMO:

| Dato | Qué es | Lo normal |
|---|---|---|
| `proximaRevisionBonificaciones` | La próxima revisión **tal como la da el banco** · `YYYY-MM` | Lo que ponga tu banco |
| `periodoRevisionBonificacionMeses` | Cada cuánto mira, para deducirla cuando no la tienes | 6 o 12 meses |
| `graciaMesesBonificaciones` | Periodo inicial en que se dan por cumplidas | Ninguno, 6 meses o el primer año |

**El dato del banco manda sobre la deducción.** La carta anual del Santander lo
dice con todas las letras: «REVISIÓN ANUAL DE CUMPLIMIENTO DE CONDICIONES», y
el tipo se aplica «desde el 31/03/2026 hasta el 30/03/2027». O sea que la
revisión sí es regular —una vez al año, misma fecha—, pero **esa fecha es la
suya, no el aniversario de tu firma**: nada obliga a que coincidan, y deducirla
de la firma acierta solo si lo hacen.

Así que la fecha del banco no es un parche para bancos raros: es **el dato
exacto**, y lo tienes en la carta y en la app. La deducción es el respaldo para
cuando no la tengas. Una fecha equivocada es peor que ninguna, porque se lee
igual que la buena.

*(Corrige una lectura anterior: las dos capturas de la app que sugerían un
intervalo de dieciocho meses eran de **dos hipotecas distintas**.)*

Y va en **mes y año**, que es como lo da el banco. Ponerle un día sería prometer
una precisión que nadie ha dado; por eso el texto dice «en la revisión de agosto
de 2027» y solo dice el día cuando la fecha viene de la periodicidad.

> **De la misma pantalla del Santander sale la confirmación del par de cifras
> de §6 ter · bis:** enseña «Bonificación actual 1,00 %» junto a «Simulación
> próxima revisión 0,95 %». Son exactamente `tinHoy` y `tinSiRevisaran`.

La gracia es **del préstamo, no de cada bonificación**: el banco concede un
plazo común, y preguntarlo una vez por bonificación era una pregunta repetida
cuya respuesta podía además contradecirse consigo misma.

Reglas que se derivan:

- **Se cuenta desde la firma.** Las revisiones caen cada N meses desde ahí, y
  cada una sale de la anterior — no de multiplicar, porque una firma el 31
  recortada una vez a febrero no debe volver al 31 en el mes siguiente.
- **Una revisión dentro del periodo inicial no decide nada**, así que no se
  anuncia: lo que se enseña es **la primera que puede mover la cuota**.
  Anunciar una que no cambia nada es una alarma falsa.
- **El periodo inicial se dice en pantalla**, cumplas o no. Durante ese plazo la
  cuota rebajada NO demuestra que cumplas, y quien no lo sepa creerá que va
  bien hasta la primera revisión que cuenta.
- **Lo que no dice la escritura no se inventa.** Sin periodicidad ni fecha del
  banco no hay cita, y se sigue diciendo «si la revisión fuera hoy». Suponer un
  año pondría una fecha que se lee igual que una real, y esa manda a alguien a
  gastar antes de un día que nadie le ha puesto.
- **El periodo inicial vale por sí solo.** Quien no sabe cada cuánto revisan su
  hipoteca —lo más habitual— puede saber perfectamente que tiene el primer año
  regalado. Callarlo por no tener fecha sería callar en el caso más probable.
- **Se puede ir a mejor.** Empezar a cumplir una que no tenías baja la cuota en
  la próxima revisión, y eso es tan accionable como perderla: se dice «X €
  menos al mes», no se calla por ser buena noticia.

### Y cuando la fecha llega · confirmar o rectificar

**ATLAS no ve la carta del banco.** Puede decir qué demuestran tus movimientos,
pero no si te dejaron la bonificación: los bancos perdonan, aplican criterios
propios y a veces dan una que no esperabas. Por eso una revisión que ya pasó
**no cambia nada sola** — queda esperando a que digas qué pasó.

**Y va en los dos sentidos** *(Jose · 4 ago 2026)*. Empezar a cumplir una que no
tenías baja la cuota igual que perderla la sube, y las dos se confirman igual.

Al confirmar se propaga hasta donde se nota:

- Los estados pasan a ser lo que el banco decidió. Lo que **no** se diga de una
  bonificación la deja como estaba: no decir nada no es decir que se perdió.
- **El cuadro se recalcula DESDE la revisión, no desde el origen.** Las cuotas
  ya pagadas se quedan como están y la nueva sale del capital que queda vivo ese
  día — que es literalmente lo que hace el banco: «la cuota que abonará será de
  252,62 € calculada sobre el capital pendiente de amortizar de 47.394,19 € a
  fecha 31 de 03 de 2026». Recalcular desde el origen reescribiría intereses ya
  cobrados y partiría de un capital que no es el tuyo.
- **Las previsiones de tesorería salen del cuadro**, así que se corrigen solas.
- Si el tipo no se mueve —perder una con el tope ya alcanzado por otras—, no se
  toca el cuadro. No ha cambiado nada que rehacer.

La revisión que espera se distingue de las ya atendidas por
`ultimaRevisionBonificacionesConfirmada`. Una que caiga dentro del periodo
inicial no reclama nada: no podía cambiar la cuota.

**Y la carta trae DOS cosas, no una** *(Jose · 5 ago 2026)*: qué pasó con las
bonificaciones **y a cuánto salió el índice**. Aquí solo entraba lo primero, y
el Euríbor de esa misma carta había que apuntarlo aparte, a mano, en el
asistente. Dos puertas para un solo papel — y mientras no se pasara por la
segunda, el cuadro seguía proyectando con `valorIndiceActual`, que es el índice
de **hoy**: para una revisión de hace meses, una presunción.

Ahora el índice entra por la misma puerta y queda apuntado como **hecho** en
`revisionesDeTipo`. Reglas:

- **Se pide el índice a secas, no el tipo.** El diferencial lo sabe ATLAS, y
  sumarlo dos veces es el error caro. La pantalla enseña delante lo que se le va
  a sumar.
- **Solo se pregunta donde lo pone el índice.** En un préstamo a tipo fijo —o
  durante el tramo fijo de un mixto— guardarlo sería dejar un dato que no lee
  nadie.
- **En blanco es una respuesta legítima.** Hay cartas que no lo dicen, y hay
  revisiones que solo miran las bonificaciones. Entonces se sigue proyectando
  con el último tipo conocido, marcado como estimación (§6 bis · bis).
- **Lo que no sea un número no cuenta.** Un dedazo se guardaría como «el Euríbor
  de esa revisión fue del 0 %», y de esa cifra salen la cuota, las previsiones y
  los intereses del ejercicio.
- **Dos revisiones el mismo día son la misma revisión rectificada**, así que la
  nueva sustituye a la vieja. Dejar las dos haría que el cuadro dependiera del
  orden en que se guardaron.
- **Apuntar el índice obliga a rehacer el cuadro DESDE la revisión aunque el
  tipo salga igual.** El guardado regenera cuando cambian las revisiones, y lo
  hace desde el origen — reescribiría intereses ya cobrados.

En un **mixto** la primera revisión trae las dos cosas a la vez: el índice
estrena el tramo variable y las bonificaciones empiezan a rebajar (§6 ter ·
quater). En la Unicaja de Jose las dos caen el 25 de agosto de 2026.

### Y el aviso dice qué toca en cada caso

El aviso era siempre la misma frase — «en la revisión de agosto pasarías al
X %, Y € más al mes» — y esa frase **solo habla de bonificaciones**. Es la
respuesta entera en un préstamo a tipo fijo y **media** en todos los demás:

| | Qué trae su revisión | Qué decía ATLAS |
|---|---|---|
| **Fijo** | solo las bonificaciones | correcto |
| **Variable** | el índice **y** las bonificaciones | solo la mitad, y la pequeña |
| **Mixto, la primera** | el índice, el cambio de tramo **y** el estreno de las bonificaciones | ninguna de las tres |

Así que ahora va una segunda línea, y va **aparte** porque no es lo mismo: la
primera son euros que dependen de lo que haga el usuario, y esta es lo que va a
pasar haga lo que haga.

- **Variable** · «esa revisión mueve también el Euríbor, y eso pesa más que las
  bonificaciones. Cuánto valdrá no se sabe hoy: la cifra de arriba solo cuenta
  lo que decidas tú».
- **Mixto, antes del cambio** · «el 25 de agosto de 2026 se acaba tu tramo fijo
  al 2,60 %: pasas al Euríbor + 1,75 %, y es ahí donde tus bonificaciones
  empiezan a rebajar».
- **Fijo** · nada. Rellenar con una frase genérica enseñaría un aviso donde no
  hay ninguno.

Dos cosas que no se pueden confundir:

- **La fecha del cambio de tramo no es la de la revisión.** La primera la fija
  la escritura (`firma + tramoFijoMeses`) y la segunda la fija el banco. En la
  Unicaja caen el mismo día, pero nada obliga a ello, y darlas por la misma
  escondería la que no coincidiera.
- **Un cambio de tramo que ya pasó no es un aviso, es historia**, y solo se
  anuncia el estreno de lo que hoy **no** se aplica: en un mixto que ya bonifica
  desde la firma, anunciarlo sería anunciar algo que ya se está pagando
  rebajado.

### 6 ter · bis · Lo que la bonificación hace con la cuota

**Decisión · 4 de agosto de 2026:**

- **«Aplicada» y «cumplida» son preguntas distintas.** Lo que decide el recibo
  de este mes es si **el banco te la está aplicando**, no si la estás
  cumpliendo. Una bonificación contratada se aplica desde la firma y sigue
  aplicada **hasta que una revisión te la retire**. Lo que cumplas ahora decide
  la revisión que viene.
- Por eso solo dos estados no rebajan el tipo: **la que nunca contrataste** y
  **la que el banco ya te quitó**. Estar «en riesgo» todavía es estar aplicada.
- **Cuánto rebajan se escribe una vez.** Estaba en cuatro sitios y daban tres
  respuestas: la pantalla multiplicaba los puntos por cien, el asistente los
  restaba tal cual, el cuadro de amortización no restaba nada y las alertas
  tenían su propia lista de estados. La consecuencia era visible: **la cuota
  prevista en tesorería y la enseñada en financiación no coincidían**.
- **Los puntos se guardan en puntos.** `0.30` es «−0,30 p.p.». Los dos topes
  (`maximoBonificacionPorcentaje` en fracción, `topeBonificacionesTotal` ya en
  puntos) se leen **cada uno en su unidad**.
- **Manda el estado, y solo el estado.** Había una segunda llave —un
  `seleccionado` aparte— que podía contradecirlo y aplicar una bonificación
  marcada como inactiva. Dos llaves para la misma puerta son dos respuestas.
- **A qué cuota vas se dice con la condición delante**: «si la revisión fuera
  hoy». Enseñarlo como la cuota actual sería enseñar una que nadie te cobra.
  Y lo que **no se puede comprobar no se da por perdido** — es la misma tercera
  respuesta de arriba, y aquí se traduciría en un sobrecoste inventado.
- **Ese tipo se recalcula entero, no se suman los puntos perdidos al de hoy.**
  Con tope, el de hoy ya viene acotado: perder una bonificación puede no subir
  el tipo nada porque las que quedan siguen llegando al tope.
- Un estado que **no esté en la tabla** se lee como *no aplicada*. Las dos
  direcciones se equivocan, pero darla por aplicada enseña una cuota **más baja
  de la que se paga**, y sobre esa cifra se hacen cuentas.

*(Resuelta la de tarjeta · las demás esperan su fuente · §8.)*

### 6 ter · quater · Desde cuándo rebajan

**Decisión · 5 de agosto de 2026 (Jose), con la escritura delante.**

Una bonificación no rebaja necesariamente todo el préstamo. Dos hipotecas
**mixtas** reales, y dicen lo contrario:

| | Unicaja · 25-08-2023 | ING |
|---|---|---|
| Tramo fijo | 36 meses al **2,600 %** | 10 años al **2,15 %** |
| Con bonificaciones | **nada · sigue al 2,600 %** | baja al **1,35 %** desde el día uno |
| Después | Euríbor 12m **+ 1,750**, revisión anual | Euríbor + diferencial |

La escritura de Unicaja lo dice en una frase que hay que saber leer:

> «No obstante, **en el segundo y en los sucesivos períodos de interés**, en
> atención a la fidelidad de la PARTE PRESTATARIA…, esta última aplicará
> bonificaciones al tipo de interés»

El **primer periodo de interés son los 36 meses fijos**. Durante ellos se paga
el 2,600 % entero, con el seguro contratado y la nómina domiciliada. La
bonificación —hasta **1,000 punto**— empieza el 25 de agosto de 2026, el mismo
día que entra el Euríbor.

ATLAS las aplicaba desde el primer recibo. **Un punto entero sobre 85.000 € a
240 meses, durante tres años.**

Reglas:

- **Es del préstamo (`bonificacionesDesde`), no de cada bonificación.** La
  escritura lo dice una vez, para el anexo entero — el mismo motivo que la
  gracia de §6 ter.
- **Solo se pregunta en un mixto.** Un fijo y un variable tienen una sola fase.
  Un préstamo que deja de ser mixto deja de leer el dato: uno que perdió su
  sentido no puede seguir decidiendo el tipo.
- **Ausente = desde la firma**, que es lo que ATLAS venía haciendo. Cambiar el
  valor por defecto habría movido la cuota de todos los mixtos ya guardados.
- **El campo que había no servía.** `Bonificacion.aplicaEn` existía con los
  cuatro valores exactos que hacían falta, el asistente lo escribía con la
  constante `'FIJO'` en todos los préstamos y no lo leía nadie. Leerlo como un
  hecho habría dejado sin bonificar el tramo fijo de **todos** los mixtos.
- **En un tramo que todavía no bonifica, «si la revisión fuera hoy» no mueve el
  tipo.** Durante esos 36 meses da igual lo que demuestren los movimientos. Lo
  que se juega ahí se cobra en la primera revisión.
- **El TIN que se enseña es el del tramo de hoy.** Se leía siempre del campo del
  arranque, así que una mixta 3+17 seguía anunciando su tipo de teaser en el año
  veinte — y un variable ignoraba las revisiones apuntadas de sus cartas.

**Y la primera revisión de un mixto trae las dos cosas a la vez**: el índice
nuevo y las bonificaciones que hasta entonces no rebajaban. Preguntando el antes
y el después al mismo tramo, esa revisión no movía nada.

## 7 · Combinaciones imposibles

Ninguna de estas debe poder guardarse, y ninguna debe siquiera ofrecerse:

| Combinación | Por qué no |
|---|---|
| Método `efectivo` + cuenta bancaria | El efectivo no sale del banco (§4) |
| Método `bizum` + cuenta sin Bizum | Solo una cuenta lo tiene (§5) |
| Método `domiciliacion`/`transferencia` + cuenta `EFECTIVO` | El colchón no tiene IBAN (§1) |
| Tarjeta liquidando en `EFECTIVO` o en otra tarjeta | La liquidación es bancaria (§3.2) |
| Bonificación de hipoteca apuntando a una tarjeta **externa** | Las de fuera nunca bonifican (§3.6) |
| Compra con crédito aplazado moviendo el saldo el día de la compra | Se cobra el día de cargo (§3.3) |
| Elegir la entidad emisora entre TUS cuentas | La emisora puede no ser un banco tuyo (§3.2) |
| Traspaso interno a la misma cuenta | No es un traspaso (§6) |
| Retirada de cajero registrada como gasto | Es un traspaso (§4) |
| Dos cuentas `EFECTIVO` | El dinero físico es uno (§1) |

---

## 8 · Qué falta por cumplir

Escrito para no perderlo, con la fecha en que se detectó.

### Pendiente

- **2026-08-05** · ~~Cada banco redondea la cuota a su manera.~~ **Cerrado sin
  hacer** *(Jose · 5 ago 2026: «no vamos a liarnos por un céntimo»)*.

  El Sabadell redondea la cuota **al alza** —la francesa exacta de 24.500 € al
  4,49 % a 96 meses son 304,2539 € y cobra 304,26— y el Santander al más
  cercano —993,4300 → 993,43, donde el alza daría 993,44—. ATLAS redondea al
  más cercano, así que falla **un céntimo** en uno de los seis préstamos.

  No se añade una regla de redondeo por banco. De seis cuadros solo uno
  distingue las dos convenciones, y no hay más papeles del Sabadell que puedan
  confirmarlo: serían sus dos únicos préstamos. Una regla inventada sobre un
  solo dato cuesta más de lo que arregla, y lo que arregla es un céntimo.
  §6 bis · bis.
- **2026-08-05** · **El tramo suelto de ING no cuadra por 13 céntimos.** Cobra
  218,37 € donde 97.500 € al 2,15 % por 38 días sobre 365 dan 218,24. El tipo
  que explicaría su cifra es el 2,15128 %, y su propio cuadro liquida los meses
  al 2,1500 %. La amortización y el capital vivo sí salen exactos, que es lo que
  arrastra el resto. Falta el dato que lo explique. §6 bis · bis.
- **2026-08-05** · **La TAE es una suma, no una TIR.** Se calcula sumando la
  capitalización del TIN, la comisión de apertura repartida por años y la
  carencia técnica. La TAE es por definición el tipo que iguala los flujos.

  *(Esta entrada decía además que faltaba meter «notaría, registro, gestoría,
  tasación y AJD, que es donde está el grueso del coste real». **Es falso desde
  2019**, y lo corrigió Jose. En una hipoteca sujeta a la Ley 5/2019 —vivienda
  residencial, persona física— el artículo 14.1.e) pone notaría, gestoría y
  registro **a cargo del prestamista**, y el AJD también desde el RDL 17/2018.
  La escritura de Unicaja lo dice con esas palabras en su cláusula SÉPTIMA: el
  banco paga comprobación registral, aranceles notariales, gestoría y aranceles
  registrales; el prestatario paga **la tasación** y las copias que pida. Así
  que de los cinco solo la tasación es del cliente.*

  *Lo que sí falta en la TAE y sí es del cliente: la **tasación** y los
  **seguros vinculados** —la propia escritura mete los 59,98 € del seguro de
  daños en su TAE—. Y ojo: esto vale para hipotecas de la Ley 5/2019; en un
  préstamo personal o un local los gastos siguen siendo otra historia.)*
  §6 bis · bis.
- **2026-08-05** · **ATLAS no avisa de los topes legales de las comisiones.**
  Guarda y calcula lo pactado, que es lo correcto, pero podría decir «0,50 %
  parece pasarse del tope de la Ley 5/2019 para variable, revísalo». No se hizo
  porque el tope depende de datos que ATLAS no tiene —si es vivienda, si eres
  consumidor, la fecha de firma, cuál de las dos opciones se pactó— y porque
  una vez abierta esa puerta hay que mantenerla al día. §6 bis · quater.
- **2026-08-05** · **Campos del préstamo que no lee nadie**: `tinMin`,
  `diferencialMin`, `fechaProximaRevision`, `comisionAmortizacionAnticipada`
  —solo se usa `...Parcial`—, y `fechaFinPeriodo` / `fechaEvaluacion` /
  `offsetEvaluacionDias`, que alimentan unas alertas T-45/T-21/T-7/T-2 sin
  llamador. `cobroMesVencido` sí se leía, pero sus dos ramas calculaban lo
  mismo. Y `DestinoCapital` y `Garantia` están declaradas **dos veces en el
  mismo fichero**. §6 bis · bis.
- **2026-08-05** · **Conceptos del préstamo que no están**: cláusula suelo y
  techo, redondeo del índice, gastos de constitución, novación y subrogación.
  §6 bis · bis.

  *(Esta entrada decía además que la amortización anticipada «solo se simula».
  Era falso: `loanSettlementService` la ejecuta —movimiento, evento de
  tesorería, previsiones futuras borradas y préstamo actualizado— desde el
  detalle del préstamo. Lo que estaba mal era el cuadro que dejaba, y eso se
  arregló el mismo día.)*

- **2026-08-05** · **Los puntos de cada bonificación no se pueden cambiar.**
  `ppDescuento` sale del catálogo y solo se PINTA: no hay ningún campo que lo
  modifique, y hasta la bonificación «Personalizada» nace con 0,10 pp fijos. Los
  de la carta del Santander son 0,50 · 0,05 · «0,10 por cada 100 € de prima», y
  no tienen por qué coincidir con los del catálogo de nadie. *(Jose · 5 ago
  2026: «clava los puntos, no hay opción de modificarlo».)* §6 ter.
- **2026-08-05** · **Financiación se retoca entero en otro momento**, y con él
  la forma de las bonificaciones. De la carta del Santander salen tres cosas que
  el modelo de hoy no sabe decir:
  - **Grupos de alternativas** · el punto 1 es UNA bonificación de 0,50 pp que
    se cumple con nómina ≥ 600 €/mes **o** pensión ≥ 300 **o** autónomos ≥ 175
    **o** ayudas PAC. Y «solo se computarán los ingresos de UNO de los
    prestatarios; nunca se sumarán los de todos». Hoy cada bonificación es
    independiente y se suman: eso contaría dos veces lo que el banco cuenta una.
  - **Condiciones proporcionales** · «por cada 100,00 € de prima anual de cada
    póliza, 0,10 puntos». Hoy un seguro es un booleano.
  - **Un tope con excepción por fuera** · el máximo de los puntos 1 a 3 es 1,00
    punto, pero el certificado de eficiencia energética añade 0,10 pp por
    encima, hasta 1,10. Hoy el tope es único y se lo tragaría.

  *(Jose · 5 ago 2026: «no podemos tener en cuenta todas las bonificaciones que
  los bancos inventan, pero sí la mayoría».)* §6 ter.

- **2026-08-04** · El gasto con débito se atribuye **si el usuario lo dice**. El
  extracto no trae la tarjeta y `paymentMethod` como mucho dice que fue con
  una, no cuál — así que lo que no se marque a mano no cuenta. §3.5.
- **2026-08-04** · Lo que queda de §6 ter **no sale de los movimientos**: los
  **seguros** y la **alarma** se prueban con su póliza o su contrato, y el
  **plan de pensiones** con su aportación, que hoy no se sigue en tesorería.
  Puede que no lleguen nunca por esta vía. §6 ter.
- **2026-08-04** · Un mes **abierto** no dice si el cobro está por llegar o si
  ya debería haber llegado. Los dos salen como «todavía no cuenta».

  *(Esta entrada decía antes que un mes sin nómina era invisible. Era falso, y
  lo corrigió Jose: la nómina se da de alta con su importe y su cuenta, la
  tesorería prevé el cobro de CADA mes, y al puntearlo se rectifica el importe
  si vino otro —`cobrosDeNomina` mide `actualAmount ?? amount`—. Así que el mes
  vacío no es invisible: es su previsión, sin conciliar.)*

  **Y no se arregla con un umbral de días.** Lo resuelve el **cierre de mes**,
  que todavía no existe: habrá un momento en que se trabaje para cerrar el mes,
  y **lo que quede abierto entonces será que no se ha producido**, con las
  consecuencias en cascada que eso tenga —una bonificación entre ellas—.
  Inventar aquí un «lleva diez días de retraso» sería adelantar esa decisión con
  un número que nadie ha elegido. *(Decisión de Jose · 4 ago 2026.)* §6 ter.

### Resuelto

- **2026-08-05** · **Vender el activo cancela el préstamo, con la misma cuenta
  que cancelarlo a mano.** `propertySaleService` tenía el QUINTO constructor de
  cuadros y la TERCERA copia de los intereses corridos —`vivo × tipo × días ÷
  365` fijo, con un tipo sin base, sin bonificaciones y sin tramo—, así que
  vender y cancelar daban cifras distintas para lo mismo. Y su línea de cierre
  iba a `interes: 0` aunque la venta sí los liquida. Ahora los dos caminos salen
  de `cancelarAnticipado` e `interesesCorridos`. *(Decisión de Jose · 5 ago
  2026: vender el activo que aguanta el préstamo lo **cancela**; la subrogación
  del comprador no se contempla.)* §6 bis · quater.

- **2026-08-05** · **Adelantar capital lo hace el motor único.** El cuadro que
  quedaba tras amortizar lo construía `loanSettlementService` con un bucle
  propio —el cuarto motor de la casa— que liquidaba **siempre sobre el mes
  comercial**, ignorando la base del préstamo, y con un tipo de
  `calculateBaseRate`, o sea **sin bonificaciones y sin tramos**: adelantar
  capital en la mixta de Unicaja rehacía el cuadro al 2,600 % hasta 2043 y
  borraba el paso a Euríbor del 25-08-2026. Y la cancelación total ponía
  `interes: 0` en la línea de cierre aunque el movimiento sí cobra los
  intereses corridos, así que el total del préstamo salía corto — y de ahí sale
  la deducción fiscal. Ahora los dos salen de `amortizarAnticipado`, con
  `tinDelTramo`, la base del préstamo y `recalcularDesde` para los tramos
  posteriores. **La cuota que se enseña en la simulación es la del cuadro que se
  guarda**: eran dos cuentas y decían 620,27 € y 620,09 €. §6 bis · quater.

- **2026-08-05** · **El arranque de un préstamo, contra seis cuadros reales.**
  Cuatro bancos con el papel delante. La fecha del primer cargo **deja de
  preguntarse**: «el primer cargo» eran dos fechas —el recibo de los días
  sueltos y la primera cuota entera—, ATLAS aceptaba las dos y una daba un
  cuadro imposible en silencio. Las dos salen de la disposición y del día de
  cobro. Lo que sí se pregunta es lo que ATLAS no puede saber: **qué hace tu
  banco con esos días** —los cobra aparte (Santander ×3, Sabadell ×2) o los mete
  dentro de la primera cuota saltándose un recibo (ING)— y **cómo los cuenta**
  —días reales sobre 365, o 30/360 como el Sabadell, donde el 31 vale 30—. Cinco
  de los seis cuadran al céntimo; los dos restos son de redondeo del banco y
  quedan anotados arriba. §6 bis · bis.
- **2026-08-05** · **Los días sueltos del arranque se liquidan en la primera
  fecha de cobro que llega**, no en la del mes siguiente. Tres cuadros del
  Santander dicen lo mismo: 12-05-2026 con cobro el día 1 → 01-06 (20 días),
  03-07-2025 con cobro fin de mes → 31-07 (28 días), 16-10-2023 igual → 31-10
  (15 días). ATLAS saltaba siempre al mes siguiente, lo cual solo acierta si el
  cobro de este mes ya pasó al firmar: el de octubre de 2023 salía a **45 días y
  87,16 €** en vez de 15 y 29,05, con la fecha del primer recibo de verdad —dos
  cargos el mismo día—. *(Jose · 5 ago 2026: «se dice que la primera cuota son
  45 días».)* §6 bis · bis.
- **2026-08-05** · **El tipo nuevo entra por el DEVENGO, no por la fecha de
  cargo.** Un recibo cobra el mes que acaba de terminar, así que el que se gira
  el mismo día en que entra el tipo nuevo va todavía al viejo. ATLAS cortaba por
  la fecha de cargo y le cambiaba la cuota a la **36** de la mixta de Unicaja
  —la del 25-08-2026, que paga del 25-07 al 25-08, entero dentro de los 36 meses
  al 2,600 %— cuando la que cambia es la **37**. *(Jose · 5 ago 2026, con la
  escritura y el cuadro del banco delante.)* §6 ter · ter.
- **2026-08-05** · **El aviso de revisión dice qué toca en cada caso.** Era
  siempre la misma frase, y esa frase solo habla de bonificaciones: respuesta
  entera en un fijo, media en un variable —donde el índice pesa mucho más— y
  ninguna de las tres cosas en el mixto que está a punto de cambiar de tramo.
  Ahora va una segunda línea con lo que va a pasar haga lo que haga el usuario,
  y no se rellena cuando no hay nada que decir. §6 ter · ter.
- **2026-08-05** · **La revisión recoge también el índice.** La carta del banco
  trae dos cosas —qué pasó con las bonificaciones y a cuánto salió el Euríbor— y
  ATLAS solo dejaba entrar la primera: la otra había que apuntarla aparte, en el
  asistente, y mientras tanto el cuadro proyectaba con el índice de hoy. Ahora
  entra por la misma puerta y queda apuntado como hecho en `revisionesDeTipo`.
  Solo se pregunta donde lo pone el índice, en blanco no inventa nada y un
  dedazo no se guarda como «el Euríbor fue del 0 %». §6 ter · ter.
- **2026-08-05** · **Una bonificación rebaja el tramo que le toca, no todos.**
  El motor las aplicaba de la firma al último recibo, y la escritura de Unicaja
  dice lo contrario: «en el segundo y en los sucesivos períodos de interés», o
  sea nunca durante sus 36 meses fijos. Un punto entero sobre 85.000 € durante
  tres años. Ahora lo dice el préstamo (`bonificacionesDesde`) y lo aplica un
  solo sitio (`tinDelTramo`), del que beben el cuadro, el listado, el panel, el
  simulador y la confirmación de una revisión. De paso, el TIN que se enseña ya
  es el del **tramo de hoy**: una mixta 3+17 anunciaba su tipo de teaser en el
  año veinte. Retirado `Bonificacion.aplicaEn`, que tenía los cuatro valores
  que hacían falta, lo escribía el asistente con la constante `'FIJO'` y no lo
  leía nadie. §6 ter · quater.
- **2026-08-05** · **Las comisiones de adelantar dinero se calculan bien.** La
  unidad son puntos porcentuales y la cuenta vive en un sitio: había cuatro
  leyéndola de cuatro maneras, y un 0,25 % pactado salía como un 25 %. Además
  el simulador leía `comisionAmortizacionParcial`, un campo que **nadie
  escribía**, así que la comisión de una amortización parcial salía siempre
  cero. Parcial y total siguen siendo dos comisiones distintas —los topes
  legales son máximos y no obligan a que se pacten iguales—, y ahora se puede
  decir cuántos meses se cobra cada una. §6 bis · quater.

- **2026-08-05** · **La base de cálculo se pregunta.** El interés que el banco
  liquida cada mes sale de contar días —`capital × TIN × días ÷ base`— y la base
  es una cláusula de la escritura: 365/360, la clásica española y un 1,39 % más
  cara, 365/365 o el mes comercial. Estaba clavada al mes comercial, así que el
  desglose interés/capital no podía cuadrar con el recibo aunque la cuota
  coincidiera al céntimo. Ausente sigue siendo 30/360, para no mover lo ya
  guardado. §6 bis · bis.

- **2026-08-05** · **La carencia se aplica, y hay una sola forma de decirla.**
  Había cuatro campos para lo mismo y las dos mitades no se tocaban: la que se
  rellenaba en el alta no la leía nadie, y la que el motor aplicaba no la
  escribía nadie. Ahora la de capital deja el capital quieto y la **total** no
  cobra nada y **capitaliza los intereses**, que es lo que el asistente ya
  prometía por escrito. `mesesSoloIntereses` se retira. §6 bis · ter.

- **2026-08-05** · **El cuadro se parte en tramos.** Un mixto cambia de tipo
  cuando acaba su tramo fijo —la fecha está en la escritura— y un variable
  cambia en cada revisión apuntada, que ahora se pueden registrar con el valor
  del índice que puso el banco en su carta. Antes una mixta 3+27 decía que
  pagarías el tipo fijo treinta años, y una variable de 2021 salía entera al
  Euríbor de hoy. Lo que no se sabe sigue sin inventarse: después de la última
  revisión conocida se sigue con ese tipo, marcado como estimación en pantalla.
  §6 bis · bis.

- **2026-08-05** · **Un solo motor para el cuadro.** Había dos, y el cuadro que
  acababas teniendo dependía de por qué puerta entrabas: el asistente calculaba
  el suyo y pisaba el que el servicio acababa de guardar, salvo para los
  préstamos antiguos, los importados, los que venían de la venta de un inmueble
  o los editados desde otra pantalla. Un tercero, escondido, generaba las
  previsiones de tesorería. Ahora se genera en un sitio, la vista previa enseña
  el que se va a guardar, el tipo sale de la regla única con su tope, el cuadro
  no depende del día en que se genere y regenerar ya no borra el punteo hecho
  contra el banco. El caso del Santander sigue cuadrando al céntimo.
  §6 bis · bis.


- **2026-08-05** · **El cashback se retira entero.** No porque costara mucho,
  sino porque «cashback» son dos cosas distintas —dinero que entra en cuenta y
  saldo dentro de una tienda— y distinguirlas obliga a preguntar en cada alta
  de tarjeta de cuál se trata. Eso es carga mental del cliente a cambio de un
  número que no decide ningún pago: el del Sabadell ya se concilia como
  cualquier ingreso, y el del Carrefour ya está descontado en lo que paga el
  extracto. Se van `cashbackPorcentaje`, `limite` —que solo servía para el
  techo— y la línea de la ficha. §3.7.

- **2026-08-05** · **Confirmar o rectificar una revisión** ya existe, en los dos
  sentidos, y propaga: estados, cuadro recalculado DESDE la revisión —sin tocar
  lo pagado— y previsiones de tesorería, que salen del cuadro. Por el camino se
  arregló algo que estaba mal desde antes: el cuadro se regeneraba entero al
  tipo nuevo, así que cualquier cambio de bonificación reescribía los intereses
  de las cuotas ya cobradas. §6 ter · ter.

- **2026-08-04** · **Cuándo revisa el banco** ya se pregunta en el alta y la
  edición del préstamo: cada cuánto mira y cuántos meses iniciales se dan por
  cumplidas, los dos del préstamo y contados desde la firma. Con eso, «si la
  revisión fuera hoy» pasa a ser «en la revisión del 10 de marzo», y el periodo
  inicial se dice en vez de disimularse. Los campos existían en el modelo desde
  antes —junto a un generador de alertas a T-45, T-21, T-7 y T-2 días— pero
  nadie los rellenaba, así que nada de eso llegaba a ejecutarse. §6 ter · ter.

- **2026-08-04** · El **stub** de los gastos personales se ha retirado, y con él
  las dos ramas muertas del sincronizador de tesorería: la de gastos de inmueble
  —que empezaba con una lista vacía escrita a mano— y la de gastos personales
  —que se los pedía a un servicio que fingía guardarlos—. Ninguna podía recibir
  un dato desde V62, porque la pantalla que da de alta un gasto recurrente
  escribe en `compromisosRecurrentes`.
  **Lo importante es lo que NO había que hacer:** conectarlas habría previsto
  cada gasto dos veces, porque quien los cubre de verdad ya existe
  —`compromisosRecurrentesService` los personales, incluido el recibo de la
  tarjeta con la que se paguen, y `treasuryForecastService` los de inmueble—.
  No se pierde ninguna previsión: se quita lo que parecía hacer algo. §3.4.

- **2026-08-04** · `TARJETA_CREDITO` **ya no existe** como tipo de cuenta, y las
  que lo eran se han **borrado con sus movimientos**. Decisión de Jose: ese
  gasto ya estaba contado por el otro lado —lo que sale del patrimonio no es
  cada compra con la tarjeta, es el recibo que el banco cobra en la corriente—,
  así que tenerlo por los dos lados contaba el mismo dinero dos veces. No se
  borra la cuenta de la que algo vivo siga cobrando, y lo que apuntara a un
  movimiento borrado se suelta: un evento con el id de un apunte que ya no
  existe se lee como «esto ya se cobró». Queda recibo de lo que se fue, porque
  borrar no se deshace. §1, §3.

- **2026-08-04** · Los **recibos domiciliados** se miran contra los movimientos:
  cuántos DISTINTOS se cargan en esa cuenta, mes a mes. Tercera y última fuente
  que sale de la tesorería — y la primera que no se mide en euros. `RECIBOS`
  faltaba además como regla, así que una bonificación de ese tipo no tenía
  forma de decir cuántos. §6 ter.
- **2026-08-04** · La **nómina domiciliada** se mira contra los movimientos: lo
  cobrado en **esa** cuenta, **mes a mes**, contra el mínimo. Es la segunda
  fuente de §6 ter, y la primera que no se mide por un total. §6 ter.
- **2026-08-04** · Una bonificación **rebaja de verdad el tipo**, y la rebaja
  está escrita **una sola vez**. Antes había cuatro versiones: la pantalla
  multiplicaba los puntos por cien y descartaba las recién contratadas —así que
  no rebajaba nunca—, el cuadro de amortización no rebajaba nada, y el asistente
  sí. Resultado: **la cuota prevista en tesorería no coincidía con la enseñada
  en financiación**. §6 ter · bis.
- **2026-08-04** · El veredicto tiene consecuencia en euros: **a qué cuota vas**
  si la revisión fuera hoy, y cuánto subiría al mes. §6 ter · bis.
- **2026-08-03** · Las **bonificaciones** se miran contra los movimientos que
  las prueban, con la forma común de §6 ter —agregar, en una ventana, contra un
  umbral— y tres respuestas, la tercera «no se puede comprobar». La de tarjeta
  ya tiene fuente: gasto **cerrado** de **esa** tarjeta, y solo si es del banco.
  Se lee en el detalle del préstamo. §6 ter, §3.6.
- **2026-08-03** · Una bonificación se puede **decir** de forma verificable: el
  asistente guarda qué hay que demostrar y en cuántos meses, y para la de
  tarjeta pregunta **cuál** —solo ofrece las del banco— y **cuánto**. Antes las
  guardaba todas como «otra», así que ninguna se podía comparar con nada. §6 ter.
- **2026-08-03** · Editar un préstamo ya no **aplana** sus bonificaciones: la
  regla, la ventana y el estado sobreviven. Leía solo nombre y puntos, así que
  cambiar el plazo borraba la condición. El estado se conserva por lo mismo,
  aunque hoy nadie escriba otro: en cuanto el veredicto lo mueva, una edición
  habría degradado una bonificación ya cumplida. §6 ter.
- **2026-08-03** · La tarjeta es una entidad propia (store `tarjetas`, V87) con
  su ficha de alta y edición, y ya no se da de alta como si fuese una cuenta.
  §3.1.
- **2026-08-03** · Una cuenta puede tener **varias** tarjetas. Lo normal son
  dos. §3.1.
- **2026-08-03** · Se distingue **débito** de **crédito** (`modalidad`), y la
  **entidad emisora** es un dato aparte de la cuenta de liquidación. §3.2, §3.3.
- **2026-08-03** · Se distingue la tarjeta **del banco** de la de **fuera**, y
  re-domiciliar una externa es una edición normal que **conserva su historial**.
  §3.2.
- **2026-08-03** · El ciclo distingue **CORTE** de **CARGO** y admite
  periodicidad **semanal**. §3.4.
- **2026-08-03** · El acumulador de periodo existe: un cargo previsto por
  periodo, en la cuenta de liquidación y el día de cargo. §6 bis.
- **2026-08-03** · Se guarda el **límite** que acota el rendimiento. §3.7.
- **2026-08-03** · Los dos vocabularios de método de pago se traducen en **un
  solo sitio** (`metodoDePago.ts`), con tablas exhaustivas: añadir un método al
  tipo rompe la compilación en vez de devolver `undefined` en silencio. Era lo
  que dejaba `bizum` sin traducir — un recurrente por Bizum llegaba a la
  previsión **sin método de pago** y luego no había con qué reconocerlo en el
  extracto. El nombre que ve el usuario también sale de ahí. §2.
- **2026-08-03** · **Solo puede haber una cuenta de efectivo.** Se comprueba al
  crear y al cambiar el tipo —la puerta de atrás—, y el wizard deja de ofrecer
  el tipo cuando ya hay una. §1.
- **2026-08-03** · **Ninguna pantalla ofrece ya una cuenta que el medio no
  pueda usar.** El alta y la importación nacen domiciliadas y eligen una cuenta
  que pueda domiciliar —no la primera de la lista, que podía ser el colchón—, y
  el desplegable de la fila filtra por el medio del gasto. §2.
- **2026-08-03** · Existe el **gasto por (tarjeta · periodo)**, que es el dato
  del que salen las otras tres respuestas. No hizo falta guardar nada nuevo:
  para una tarjeta de crédito el gasto de un periodo **ES su recibo** — el banco
  carga exactamente eso. Cada periodo dice si está **cerrado** (cobrado y
  cuadrado contra el extracto, cifra real) o **abierto** (previsión viva, crece
  con cada compra). Un recibo **descartado** no cuenta. §3.5.
- **2026-08-03** · Un recurrente en **efectivo** se proyecta sobre la cuenta
  `EFECTIVO`, y uno por **Bizum** sobre la que lo tiene: la cuenta se vuelve a
  decidir AL PROYECTAR, con la misma regla del formulario, en vez de confiar en
  la copia que se guardó. Los gastos creados antes de que existiera esa regla
  llevan pegada una cuenta bancaria, y esa copia hacía que el banco pareciera
  más pobre y que el colchón no bajara nunca. Con domiciliación y transferencia
  se respeta lo guardado — ahí el usuario **sí** elige. §2, §4, §5.
- **2026-08-03** · Un gasto recurrente pagado con **crédito aplazado** ya no
  emite su cargo el día de la compra: se acumula en un **recibo por (tarjeta ·
  corte)**, en la cuenta de liquidación y el día de cargo. El recibo **cruza
  varios gastos** — el banco no carga la compra, la gasolina y la farmacia por
  separado. El débito sigue siendo un cargo en su fecha. §3.4, §6 bis.

  **Corrección de un diagnóstico anterior.** Se había escrito que el obstáculo
  era la clave `origen|id|año-mes|cuenta`, por no admitir varias previsiones de
  un mismo gasto en un mes. Era falso: ningún patrón de compromiso se repite
  dentro de un mes, así que esa clave nunca colisionaba. El obstáculo real era
  otro y más de fondo — **un recibo no pertenece a un gasto, pertenece a la
  tarjeta**, y por eso no podía identificarse con la clave de un compromiso.
- **2026-08-03** · Un gasto recurrente dice **con qué tarjeta** se paga, y su
  cargo va a la **cuenta de liquidación** de esa tarjeta en vez de a la que
  estuviera elegida a mano. El medio «Tarjeta» no se ofrece si no hay ninguna
  dada de alta, igual que «Efectivo» sin colchón. §2, §3.2.
