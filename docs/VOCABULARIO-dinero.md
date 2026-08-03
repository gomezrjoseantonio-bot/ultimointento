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

`Account.tipo` distingue cinco:

| Tipo | Qué es | Tiene IBAN | Tiene saldo propio |
|---|---|---|---|
| `CORRIENTE` | Cuenta bancaria de diario | Sí | Sí |
| `AHORRO` | Cuenta bancaria de ahorro | Sí | Sí |
| `OTRA` | Cuenta bancaria que no encaja arriba | Sí | Sí |
| `EFECTIVO` | El dinero físico · el colchón, la cartera | **No** | Sí |
| `TARJETA_CREDITO` | Una tarjeta de crédito | **No** | **No** · ver §3 |

Consecuencias que el código debe respetar:

- **`EFECTIVO` no tiene IBAN ni banco.** No se le importa un extracto, porque
  nadie emite un extracto del colchón. Su saldo sube y baja solo por lo que se
  anota o por traspasos.
- **Solo debe haber una cuenta de efectivo por usuario.** Dos colchones no se
  distinguen: el dinero físico es uno. *(Definido aquí, todavía no garantizado
  por el código · §8.)*
- **`TARJETA_CREDITO` no es un sitio donde hay dinero**, es una forma de
  aplazar el pago. Ver §3.

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

## 3 · Tarjeta

**Una tarjeta de crédito no tiene saldo: tiene una cuenta donde se liquida.**
Lo que compras con ella no sale de la tarjeta, sale de la cuenta bancaria que
paga su recibo, el día que lo paga (`cardConfig.settlementDay` y
`cardConfig.chargeAccountId`).

Consecuencias:

- La cuenta de liquidación es **una cuenta bancaria**, nunca la de efectivo ni
  otra tarjeta.
- Pagar con tarjeta **no** mueve el saldo el día de la compra.

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

## 7 · Combinaciones imposibles

Ninguna de estas debe poder guardarse, y ninguna debe siquiera ofrecerse:

| Combinación | Por qué no |
|---|---|
| Método `efectivo` + cuenta bancaria | El efectivo no sale del banco (§4) |
| Método `bizum` + cuenta sin Bizum | Solo una cuenta lo tiene (§5) |
| Método `domiciliacion`/`transferencia` + cuenta `EFECTIVO` | El colchón no tiene IBAN (§1) |
| Tarjeta liquidando en `EFECTIVO` o en otra tarjeta | La liquidación es bancaria (§3) |
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
