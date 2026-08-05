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

Lo que queda por hacer con esto: **confirmar o rectificar** en la fecha —en los
dos sentidos— y propagar el cambio al cuadro de amortización y a las previsiones
de tesorería. §8.

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

- **2026-08-04** · El cashback **realmente ingresado** sigue sin casarse con la
  tarjeta que lo generó. Un movimiento ya puede decir **con qué tarjeta**, pero
  eso no basta: un ingreso atribuido a una tarjeta puede ser el cashback o una
  **devolución de una compra**, y no hay forma de distinguirlos. Haría falta
  poder decir que ESE ingreso es cashback — una categoría que hoy no existe.
  Lo que se mide sigue siendo lo que le CORRESPONDE al gasto cerrado según su
  porcentaje, no el apunte visto en el banco. §3.7.
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
- **2026-08-04** · Llegada la fecha de revisión, falta **confirmar o
  rectificar**: el veredicto ya se enseña con su fecha, pero el estado guardado
  lo sigue moviendo alguien a mano. Y tiene que poder ir en los **dos
  sentidos** —empezar a cumplir una que no tenías cuenta igual que perderla—, y
  al confirmarlo **corregir el cuadro de amortización y las previsiones de
  tesorería**, que es donde se nota. *(Jose · 4 ago 2026.)* §6 ter · ter.

### Resuelto

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
- **2026-08-03** · El **cashback se mide como rendimiento**: «te ha devuelto X
  sobre Y canalizados», solo con periodos **cerrados** —lo abierto aún puede
  crecer o quedarse corto—, y con el **techo anual** que marca el límite. Los
  4.700 €/mes al 1 % de la Carrefour salen como **564 €/año**, que es la cifra
  que decide por qué tarjeta canalizar el gasto. Las tarjetas sin cashback no
  aparecen: enseñar «0 €» invita a compararlas y no compiten. §3.7.
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
