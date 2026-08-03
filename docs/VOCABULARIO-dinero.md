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
donde hay dinero: es una forma de gastar el de una cuenta. Ver §3. *(Decidido
aquí, hoy sigue siendo un tipo · §8.)*

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

Una tarjeta plantea **cuatro preguntas distintas** y mezclarlas es lo que
enreda el diseño. Van separadas a propósito:

| | Pregunta | Sección |
|---|---|---|
| **Qué es** | ¿Es una cuenta? ¿De quién cuelga? | §3.1 · §3.2 |
| **Cuándo mueve el dinero** | ¿Ahora o el día de cargo? | §3.3 · §3.4 |
| **Qué demuestra** | ¿Bonifica la hipoteca? | §3.6 |
| **Qué rinde** | ¿Cuánto me devuelve? | §3.7 |

Las tres últimas se apoyan en **un solo dato**, y por eso conviene verlo antes
de nada: **cuánto se ha gastado con ESA tarjeta en ESE periodo** (§3.5). Quien
tenga ese número tiene las tres respuestas; quien no lo tenga, ninguna.

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
ella salen las tres respuestas que siguen. No es un extra: sin ella, ni se puede
prever el cargo (§3.3), ni demostrar una bonificación (§3.6), ni saber lo que
rinde (§3.7).

Del periodo **en curso** es una cifra **viva**:

> El período abierto están todas las previsiones, pero si mañana gasto algo de
> la tarjeta tendré que hacer una anotación manual e irá creciendo.
>
> — Jose, 3 de agosto de 2026

### 3.6 · Qué demuestra · las bonificaciones

Los importes de tarjeta son la **prueba** de que se cumplen los requisitos que
bonifican una hipoteca o un préstamo (§6 ter).

- **Solo cuenta la tarjeta DEL BANCO que bonifica.** Las de fuera **nunca**
  bonifican: son externas justamente por eso. Sumarlas diría que cumples un
  requisito que no cumples, y eso se paga en el recibo.
- Importa **la tarjeta concreta**, no la cuenta.

### 3.7 · Qué rinde · el cashback

Algunas tarjetas devuelven un porcentaje del gasto. **Es un ingreso**, y sobre
todo es una **decisión**: por qué tarjeta canalizar el gasto.

> La tarjeta Carrefour la uso mucho porque da un 1 % de cashback cada 3 meses.
> Si gasto por esa tarjeta al máximo durante 12 meses son 564 € que puedo volver
> a usar como forma de pago sin que salga dinero de mi caja otra vez.
>
> — Jose, 3 de agosto de 2026

**Decisión · 3 de agosto de 2026:**

- **Se mide lo REALIZADO, no se prevé.** La cifra que decide es «esta tarjeta me
  devolvió X € sobre Y € canalizados»: eso compara tarjetas. Prever el cashback
  del trimestre que viene no cambia ninguna decisión y cuesta bastante más.
- **El límite de gasto se guarda**, no como alerta sino porque **acota el techo
  de la estrategia**: 4.700 €/mes al 1 % es lo máximo que ese camino puede
  rendir. Un número que responde «¿hasta dónde llega esto?» sí decide.
- El cashback que llega se concilia como cualquier otro ingreso.

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
contra la tesorería**, y hoy nadie las mira.

Lo que comparten, y por eso van juntas aquí: cada una necesita **agregar
movimientos de un tipo, en una ventana de tiempo, y compararlos con un
umbral**. Quien construya una debería dejar sitio para las demás.

*(Reconocido aquí; sin modelar · §8.)*

## 7 · Combinaciones imposibles

Ninguna de estas debe poder guardarse, y ninguna debe siquiera ofrecerse:

| Combinación | Por qué no |
|---|---|
| Método `efectivo` + cuenta bancaria | El efectivo no sale del banco (§4) |
| Método `bizum` + cuenta sin Bizum | Solo una cuenta lo tiene (§5) |
| Método `domiciliacion`/`transferencia` + cuenta `EFECTIVO` | El colchón no tiene IBAN (§1) |
| Tarjeta liquidando en `EFECTIVO` o en otra tarjeta | La liquidación es bancaria (§3.2) |
| Compra con crédito aplazado moviendo el saldo el día de la compra | Se cobra el día de cargo (§3.3) |
| Elegir la entidad emisora entre TUS cuentas | La emisora puede no ser un banco tuyo (§3.2) |
| Traspaso interno a la misma cuenta | No es un traspaso (§6) |
| Retirada de cajero registrada como gasto | Es un traspaso (§4) |
| Dos cuentas `EFECTIVO` | El dinero físico es uno (§1) |

---

## 8 · Qué falta por cumplir

Escrito para no perderlo, con la fecha en que se detectó.

### Pendiente

- **2026-08-03** · Los gastos personales (`PatronGastoPersonal`) que alimentan
  `treasurySyncService` salen de un **stub**: el store se eliminó en V62 y
  `getPatrones` devuelve siempre `[]`. Toda esa rama del motor —incluida su
  parte de tarjetas— corre sobre una lista vacía. O se conecta a
  `compromisosRecurrentes` o se retira; dejarla es un camino que parece vivo y
  no lo está.
- **2026-08-03** · No hay lectura de **gasto real agregado por tarjeta y
  periodo**. El cargo previsto ya se calcula así, pero lo gastado de verdad —lo
  que prueba bonificaciones y mide rendimiento— no se consulta en ningún sitio.
  §3.5.
- **2026-08-03** · El **cashback** se guarda como porcentaje pero no se mide
  como rendimiento realizado. §3.7.
- **2026-08-03** · Las **bonificaciones** de hipotecas y préstamos no se
  verifican contra los movimientos que las prueban. §6 ter.
- **2026-08-03** · `TARJETA_CREDITO` sigue existiendo como tipo de cuenta para
  las cuentas **históricas**. Ya no se crean —una tarjeta nueva nace como
  tarjeta— pero las que había siguen ahí, porque sus movimientos son compras
  de verdad y borrarlas sería perder dinero de la vista. Qué hacer con ese
  histórico es una decisión de Jose, no del código. §1, §3.

### Resuelto

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
