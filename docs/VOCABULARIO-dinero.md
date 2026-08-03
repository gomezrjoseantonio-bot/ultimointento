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
como una corriente, y "otra" no dice nada. *(Decidido aquí, el tipo todavía las
admite · §8.)*

**`TARJETA_CREDITO` deja de ser un tipo de cuenta.** Una tarjeta no es un sitio
donde hay dinero: es una forma de gastar el de una cuenta. Ver §3. *(Decidido
aquí, hoy sigue siendo un tipo · §8.)*

**Solo debe haber una cuenta de efectivo por usuario.** Dos colchones no se
distinguen: el dinero físico es uno. *(Definido aquí, todavía no garantizado
por el código · §8.)*

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

No coinciden ni en los valores (`TPV` / `tarjeta`) ni en la forma. **Deuda
conocida**: cualquier código que traduzca entre las dos tiene que hacerlo en un
solo sitio, no a mano en cada pantalla.

---

## 3 · Tarjetas

**Una tarjeta no tiene saldo: tiene una cuenta donde se liquida.** No es un
sitio donde hay dinero, es una forma de gastar el de una cuenta. Una cuenta
bancaria puede tener **una o varias** tarjetas asociadas.

Lo que decide cuándo se mueve el saldo es la **modalidad**, no la tarjeta:

### 3.1 · Débito · el dinero sale YA

Compras y se descuenta **en el momento**, igual que una transferencia. Sacar
dinero del cajero con ella descuenta también al instante.

- No genera previsión propia: el cargo es el movimiento, y ocurre el mismo día.
- **Una retirada de cajero con tarjeta de débito es un traspaso interno a la
  cuenta de efectivo** (§4), no un gasto. Da igual que se haya hecho con
  plástico: el dinero sigue siendo tuyo, ha cambiado de sitio.

### 3.2 · Crédito aplazado · el dinero sale un día concreto

Compras durante el periodo y **todo se cobra junto** el día de liquidación —fin
de mes, a X días, a X semanas—. **No genera intereses.**

- Las compras del periodo **no mueven el saldo el día de la compra**.
- Lo que mueve el saldo es **un solo cargo** en la cuenta de liquidación, el día
  de liquidación, por la suma del periodo. Eso es lo que hay que **prever**
  (§3.4).

### 3.3 · Crédito fraccionado · FUERA DE ESTA VERSIÓN

Pagar a plazos con intereses. **Decisión · 3 de agosto de 2026 (Jose):** no se
modela todavía. No se ofrece, y si aparece en un extracto se trata como un
cargo cualquiera hasta que se diseñe.

### 3.4 · Quién emite y quién paga son cosas distintas

Aquí está la trampa que hace falta escribir:

> Hay tarjetas de fuera del banco donde tienes la cuenta —Carrefour, Bankinter
> Card, Cetelem—. La diferencia es que **la entidad emisora no es donde se
> domicilia el pago**. Las formas de pago son las mismas: aplazado o
> fraccionado. Las de Carrefour y las del Sabadell generan cashback, por eso
> las uso.
>
> — Jose, 3 de agosto de 2026

Por tanto una tarjeta tiene **dos** referencias a entidad, y confundirlas es
atribuir el gasto al banco equivocado:

| Dato | Qué es | Puede no existir en ATLAS |
|---|---|---|
| **Emisora** | Quién da la tarjeta · Carrefour, Cetelem, Bankinter Card | **Sí** · puede no ser una cuenta tuya |
| **Cuenta de liquidación** | De qué cuenta TUYA sale el recibo | No · es siempre una `CORRIENTE` |

- La cuenta de liquidación es **siempre una cuenta bancaria propia**, nunca la
  de efectivo ni otra tarjeta.
- La emisora **no tiene por qué ser un banco tuyo**, y no debe forzarse a
  elegirla entre tus cuentas.

### 3.4 ter · Dos maneras de nacer, y no son intercambiables

**Una cuenta bancaria tiene normalmente DOS tarjetas** —una de débito y otra de
crédito— y puede tener más. Nada del modelo puede asumir «la tarjeta» de una
cuenta.

Pero la diferencia importante no es cuántas, sino **de quién es la tarjeta**:

| | Tarjeta **del banco** | Tarjeta **de fuera** |
|---|---|---|
| Ejemplos | La de débito y la de crédito de tu Santander | Carrefour · Cetelem · Bankintercard |
| Cómo nace | **Con la cuenta** · al dar de alta el banco | **Por su cuenta** · no cuelga del alta de ningún banco |
| Su cuenta | Es la del banco que la emite · intrínseca | Es **dónde la tienes domiciliada hoy** |
| ¿Se puede cambiar de cuenta? | No tiene sentido | **Sí, y pasa a menudo** |

> Las de fuera del banco no deberían nacer de la misma forma, ya que son muy
> susceptibles a que cambiemos la domiciliación del pago. Por lo que no puede
> estar anclada de manera sostenida en una cuenta bancaria.
>
> — Jose, 3 de agosto de 2026

Consecuencias para el modelo:

- Una tarjeta de fuera **no se crea desde el alta de una cuenta**: se crea sola,
  y elegir dónde se domicilia es un dato suyo, no su origen.
- **Cambiar la domiciliación tiene que ser una operación normal**, no rehacer la
  tarjeta. Si rehacerla fuese la única vía, se perdería su historial de gasto —
  que es justo lo que prueba las bonificaciones (§6 ter).
- **Cambiar la domiciliación NO reescribe el pasado.** Los cargos que ya se
  cobraron en la cuenta anterior se quedan donde se cobraron: son realidad, como
  todo lo demás que ya pasó.

### 3.4 bis · El ciclo · CORTE y CARGO son dos fechas distintas

Lo que hoy se guarda es un único `settlementDay`, y no llega. Una tarjeta tiene
**un periodo** (desde cuándo hasta cuándo se acumulan las compras) y **un día de
cargo** (cuándo se cobra en el banco), y el segundo puede caer **fuera** del
primero:

> Normalmente van del 25 al 24 de cada mes y se emite el cargo en el banco el
> 31. Otras van de 1 a 31 y se emite el cargo el 5. Y otras, por ejemplo
> Unicaja, van con corte semanal y se paga el lunes de la semana siguiente,
> aunque también puede ser mensual.
>
> — Jose, 3 de agosto de 2026

De ahí salen tres datos, no uno:

| Dato | Ejemplos |
|---|---|
| **Periodicidad** | Mensual · **semanal** |
| **Corte** | Día 24 · día 31 (último del mes) · domingo |
| **Día de cargo** | 31 del mismo mes · 5 del siguiente · lunes siguiente |

Reglas que se derivan y que el código tendrá que respetar:

- **Una compra pertenece al periodo por su fecha**, no por el mes natural. Una
  compra del 26 de enero, con corte el 24, va al periodo que se cobra en
  febrero.
- **El día de cargo puede estar en otro mes que el corte** (corte 24 de enero →
  cargo el 5 de febrero). La previsión se coloca en el día de CARGO, que es
  cuando el dinero sale de la cuenta.
- **Con corte semanal hay varios cargos al mes**, no uno. Un modelo que asuma
  "un recibo mensual por tarjeta" no sirve para Unicaja.
- **Día 31 significa "el último del mes"**, no se salta febrero.

### 3.5 · Cashback

Algunas tarjetas devuelven un porcentaje. **Es un ingreso**, no un gasto
negativo: entra en la cuenta y suma. *(Reconocido aquí; sin modelar todavía ·
§8.)*

---

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

### Lo que aún no está diseñado

**Crédito aplazado.** Hoy no existe el acumulador que junta las compras de un
periodo en un solo cargo previsto. Es el trabajo que queda, y toca el motor de
previsiones. Con el ciclo de §3.4 bis, lo que hay que construir es:

- Colocar cada compra en **su** periodo según la fecha de corte.
- Emitir **un cargo previsto por periodo** en el día de cargo — que con corte
  semanal son varios al mes.

**Decisión · 3 de agosto de 2026 (Jose):** mientras el periodo está **abierto**,
el cargo previsto **va creciendo**.

> El período abierto están todas las previsiones, pero si mañana gasto algo de
> la tarjeta tendré que hacer una anotación manual e irá creciendo.
>
> — Jose

Es decir: el cargo del periodo en curso es una previsión **viva**, que se
recalcula cada vez que se anota o se importa una compra de esa tarjeta. No es
una cifra fija que aparece el día del corte.

---

## 6 ter · Para qué sirve además el gasto con tarjeta

No es solo tesorería. **Los importes y movimientos de tarjeta son la prueba de
que se cumplen las bonificaciones de una hipoteca o un préstamo:**

> Estos movimientos e importes también son importantes para controlar si se
> cumplen los requerimientos de bonificaciones de las hipotecas o préstamos que
> lo piden para bonificar.
>
> — Jose, 3 de agosto de 2026

Consecuencias para el modelo:

- El gasto con tarjeta tiene que ser **agregable por periodo y por tarjeta**, no
  solo visible como un cargo mensual en la cuenta. Un requisito típico es
  "gastar N € al año con la tarjeta del banco": con solo el recibo agregado no
  se puede comprobar.
- **Solo cuenta el gasto con la tarjeta DEL BANCO que bonifica.** Las tarjetas
  de fuera (§3.4 ter) no bonifican ninguna hipoteca: son externas justamente por
  eso. Sumarlas al cómputo diría que cumples un requisito que no cumples, y eso
  se paga en el recibo.
- La **tarjeta concreta** importa, no solo la cuenta: la bonificación la pide el
  banco de SU tarjeta. Otra razón para que la tarjeta sea una entidad propia
  (§3) y no un tipo de cuenta.
- Lo mismo vale para otros requisitos que se miden sobre movimientos —nómina
  domiciliada, recibos domiciliados, seguros—: son **condiciones que se
  verifican contra la tesorería**, y hoy nadie las mira.

*(Reconocido aquí; sin modelar · §8.)*

---

## 7 · Combinaciones imposibles

Ninguna de estas debe poder guardarse, y ninguna debe siquiera ofrecerse:

| Combinación | Por qué no |
|---|---|
| Método `efectivo` + cuenta bancaria | El efectivo no sale del banco (§4) |
| Método `bizum` + cuenta sin Bizum | Solo una cuenta lo tiene (§5) |
| Método `domiciliacion`/`transferencia` + cuenta `EFECTIVO` | El colchón no tiene IBAN (§1) |
| Tarjeta liquidando en `EFECTIVO` o en otra tarjeta | La liquidación es bancaria (§3.4) |
| Compra con crédito aplazado moviendo el saldo el día de la compra | Se cobra el día de liquidación (§3.2) |
| Elegir la entidad emisora entre TUS cuentas | La emisora puede no ser un banco tuyo (§3.4) |
| Traspaso interno a la misma cuenta | No es un traspaso (§6) |
| Retirada de cajero registrada como gasto | Es un traspaso (§4) |
| Dos cuentas `EFECTIVO` | El dinero físico es uno (§1) |

---

## 8 · Qué falta por cumplir

Escrito para no perderlo, con la fecha en que se detectó:

- **2026-08-03** · El alta de gasto recurrente ofrece cuenta de cargo con
  método `efectivo`, y todas las cuentas con método `bizum`. §2, §4, §5.
- **2026-08-03** · Un recurrente en efectivo se proyecta sobre su cuenta de
  cargo bancaria en vez de sobre la cuenta `EFECTIVO`. §4.
- **2026-08-03** · Los dos vocabularios de método de pago (§2) no se traducen
  en un único sitio.
- **2026-08-03** · Nada impide crear dos cuentas `EFECTIVO`. §1.
- **2026-08-03** · `Account.tipo` todavía admite `AHORRO` y `OTRA`, retiradas
  por decisión. Retirarlas pide migrar las que existan a `CORRIENTE`. §1.
- **2026-08-03** · `TARJETA_CREDITO` sigue siendo un tipo de cuenta en vez de
  una tarjeta asociada a una. §1, §3.
- **2026-08-03** · No se distingue **débito** de **crédito aplazado**: hoy solo
  hay `cardConfig`, que asume liquidación diferida. §3.1, §3.2.
- **2026-08-03** · No existe la **entidad emisora** separada de la cuenta de
  liquidación. §3.4.
- **2026-08-03** · Una cuenta no puede tener **varias** tarjetas: `cardConfig`
  es un único objeto. Lo normal son dos. §3.4 ter.
- **2026-08-03** · No se distingue la tarjeta **del banco** de la de **fuera**,
  ni se puede cambiar la domiciliación sin rehacerla. §3.4 ter.
- **2026-08-03** · No hay acumulador de periodo para el crédito aplazado: las
  compras no se juntan en un cargo previsto. §6 bis.
- **2026-08-03** · El **cashback** no se modela. §3.5.
- **2026-08-03** · La tarjeta guarda un único `settlementDay`: no distingue
  CORTE de CARGO, ni admite ciclo **semanal**. §3.4 bis.
- **2026-08-03** · Las **bonificaciones** de hipotecas y préstamos no se
  verifican contra los movimientos que las prueban. §6 ter.
