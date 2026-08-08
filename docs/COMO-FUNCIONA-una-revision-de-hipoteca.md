# Cómo funciona una revisión de hipoteca

> Escrito antes de tocar el código, sobre un préstamo real, a petición de Jose
> *(8 ago 2026)*: «antes de tocar debes escribir y grabar cómo funciona una
> revisión de hipoteca».
>
> El caso es la **Hipoteca Unicaja**, y las dos fechas que se piden son el
> **26/08/2026** y el **26/08/2027**.

---

## 1 · El préstamo, tal como está dado de alta

| | |
|---|---|
| Capital inicial | 85.000,00 € |
| Plazo | 240 meses · sistema francés |
| Firma | 25/08/2023 |
| 1.ª cuota | 25/09/2023 · día de cargo **25** |
| Vencimiento | 25/08/2043 |
| Tipo | **Mixto** |
| Tramo fijo | 36 meses al **2,600 %** |
| Tramo variable | **Euríbor + 1,750** |
| Revisión | **Anual** |
| Base de cálculo | **30/360** |
| Bonificaciones | 1 (nómina) · independientes · tope 1,00 p.p. · rebaja **0,30 p.p.** |
| Comisión de amortización anticipada | 0,25 % |

Cuota del tramo fijo: **454,57 €**. Sale de la anualidad francesa sobre 85.000 €
a 240 meses al 2,600 % — con base 30/360 el interés mensual es exactamente
`TIN ÷ 12`, y por eso la cuota no baila de un mes a otro.

---

## 2 · Lo primero: son DOS revisiones distintas

Se llaman igual y aquí caen el mismo día, pero no son lo mismo y confundirlas es
el origen de casi todo lo que se lee raro en pantalla.

### a) La revisión del ÍNDICE

Cambia el **tipo de interés**. Solo existe mientras el préstamo está en tramo
variable. En este préstamo la primera es el **25/08/2026**, cuando acaba el
tramo fijo, y después cada 25 de agosto.

### b) La revisión de las BONIFICACIONES

El banco mira si has cumplido las condiciones (nómina, seguros, plan…) durante
los doce meses anteriores, y decide si te mantiene o te quita la rebaja de
0,30 p.p. **durante los doce siguientes**. Es independiente del tramo: en este
préstamo lleva revisándose desde el **25/08/2024**, cuando el tipo todavía era
fijo y la rebaja no cambiaba nada del recibo.

> Una bonificación no se pierde el día que dejas de cumplirla: se pierde **el día
> que el banco lo mira**. Hasta entonces sigues pagando la cuota rebajada aunque
> lleves tres meses sin domiciliar la nómina — y al revés, empezar a cumplir hoy
> no baja el recibo de este mes.

Las dos se juntan en el mismo número —el TIN que se paga— pero se deciden por
separado, con datos distintos, y ATLAS las guarda en campos distintos
(`periodoRevisionMeses` y `periodoRevisionBonificacionMeses`).

---

## 3 · De dónde sale el índice · lo que ATLAS NO sabe

Esta es la parte que hay que dejar clavada, porque es donde se ha estado
inventando.

**El índice de una revisión no es «el euríbor de hoy».** Es un valor
*publicado*, y la escritura dice exactamente cuál:

1. **Qué índice** · Euríbor a 12 meses (en préstamos viejos, IRPH).
2. **Qué publicación** · el tipo medio mensual publicado en el BOE.
3. **Qué mes** · con desfase. Lo normal es «el del mes anterior» o «el del
   segundo mes anterior» a la fecha de revisión. No es lo mismo: entre dos meses
   consecutivos puede haber décimas.
4. **Qué redondeo** · muchas escrituras redondean a un octavo de punto (0,125) o
   a tres decimales.

O sea: para la revisión del **25/08/2026** el tipo no lo marca el euríbor del día
25, sino el publicado para **julio de 2026** (o junio, según la escritura). El
día 25 el número **ya está decidido y publicado** — no hay nada que adivinar,
solo hay que ir a buscarlo.

**Consecuencia para ATLAS:** el índice de una revisión es un **hecho que se
apunta**, no algo que se calcula. Y mientras nadie lo apunte, lo único honesto
que se puede decir es «con el euríbor de hoy quedaría en X», dicho con esas
palabras.

---

## 4 · Qué ocurre el 26/08/2026

El 26 no ocurre nada. Lo que hay que contar es lo que pasó **el día anterior**,
y el 26 es el primer día en que todo eso ya está en vigor.

### 25/08/2026 · por la mañana: se cobra el último recibo del tramo fijo

Se carga la cuota nº 36: **454,57 €**, de los que **162,89 €** son intereses y
**291,68 €** capital.

Ese recibo paga el interés **devengado del 25/07 al 25/08**, y ese mes corrió
todavía al 2,600 %. **Es un recibo del tramo fijo aunque se cobre el día de la
revisión.** Esto importa: el recibo va siempre un mes por detrás de lo que
devenga.

Capital vivo después del cargo: **≈ 74.887 €**. Cuotas pagadas: 36 de 240.

### 25/08/2026 · el mismo día: acaban las dos cosas a la vez

**El tramo fijo se acaba.** Desde ese día el interés se devenga a
`Euríbor + 1,750`.

**El banco revisa las bonificaciones.** Mira los doce meses anteriores y decide
si mantiene los 0,30 p.p. Esa decisión rige los doce meses siguientes.

**El banco fija el índice.** Coge el euríbor publicado del mes que diga la
escritura, le suma el diferencial de 1,750 y le resta la bonificación si la
mantiene.

Con el euríbor a **4,000 %** que ATLAS tiene apuntado en «Actualizar valores»:

```
  4,000  euríbor publicado
+ 1,750  diferencial
= 5,750  TIN teórico
− 0,300  bonificación de nómina (si el banco la mantiene)
= 5,450  TIN aplicable desde el 25/08/2026
```

**El banco recalcula la cuota.** Anualidad francesa sobre el capital vivo
(74.887 €), al TIN nuevo (5,450 %), por **el plazo que queda: 204 meses**
(240 − 36).

> **El plazo NO cambia en una revisión.** Cambia la cuota. El préstamo sigue
> venciendo el 25/08/2043.

Resultado: **563,83 €** ≈ 564 €.

Si el banco le quitara la bonificación, el TIN sería 5,750 % y la cuota
**576,14 €** — la nómina vale unos **12 € al mes**.

### 26/08/2026 · la situación

- El TIN vigente es **5,450 %** y **está congelado hasta el 25/08/2027**.
- Que el euríbor suba o baje durante esos doce meses **no mueve ni un céntimo**.
  Lo que se mueva servirá para la revisión *siguiente*, no para esta.
- La cuota que se va a pagar es **563,83 €**…
- …**pero el primer recibo a ese importe se carga el 25/09/2026**, no el 25/08.
  El del 25 de agosto ya se cobró, y era del tramo fijo.

Este último punto es el que se lee mal con más facilidad: entre el 25/08 y el
25/09 el préstamo tiene **un tipo nuevo y ningún recibo todavía a ese tipo**.

---

## 5 · Qué ocurrirá el 26/08/2027

Exactamente lo mismo, sin la parte de «acaba el tramo fijo».

### 25/08/2027

**Se cobra el recibo nº 48**: 563,83 €, todavía al 5,450 %, porque paga el
devengo del 25/07 al 25/08 de 2027.

Capital vivo después: **≈ 72.135 €**. Plazo restante: **192 meses**.

**Segunda revisión del índice.** Se coge el euríbor publicado del mes que diga
la escritura y se rehace la cuenta. **Se parte del capital vivo real de ese día**
—no del original— y **del plazo que queda** —no de 240—.

**Segunda revisión de bonificaciones**, otra vez para los doce meses siguientes.

Como nadie sabe hoy dónde estará el euríbor en julio de 2027, lo único que se
puede decir es cuánto se movería la cuota según dónde caiga:

| Euríbor jul-2027 | TIN (con bonificación) | Cuota desde 25/09/2027 |
|---|---|---|
| 2,000 % | 3,450 % | ≈ 489 € |
| 3,000 % | 4,450 % | ≈ 526 € |
| 4,000 % | 5,450 % | ≈ 564 € |
| 5,000 % | 6,450 % | ≈ 603 € |

(Sobre 72.135 € y 192 meses. Si el banco retirase la bonificación, súmese
0,300 p.p.: al 4,000 % de euríbor la cuota sería ≈ 575 € en vez de 564 €.)

### 26/08/2027

Nuevo TIN congelado hasta el 25/08/2028, y **el primer recibo al importe nuevo
se carga el 25/09/2027**.

---

## 6 · Las reglas que salen de todo esto

Son las que tienen que gobernar el código.

1. **Una revisión es un HECHO que se apunta, no un cálculo.** El índice lo
   publica el BOE y lo aplica el banco; ATLAS no lo deduce. Hasta que se apunta,
   lo que hay es una proyección y hay que decirlo con esas palabras.

2. **Lo confirmado corre doce meses.** Entre dos revisiones el tipo está
   congelado. El euríbor de «Actualizar valores» no toca el cuadro vigente: solo
   sirve para enseñar por dónde iría la revisión que viene.

3. **La revisión cambia la cuota, no el plazo.** Se recalcula la anualidad
   francesa sobre el capital vivo del día de la revisión y el plazo restante.

4. **La fecha de la revisión y la del primer recibo nuevo son distintas**, y se
   llevan un mes. El recibo que se cobra el día de la revisión es todavía del
   periodo anterior, porque paga un devengo ya corrido.

5. **Índice y bonificaciones son dos revisiones**, aunque caigan el mismo día.
   Una puede estar confirmada y la otra pendiente.

6. **Amortizar anticipadamente no cambia el tipo.** Se aplica el capital y se
   rehace el cuadro **con la estructura de tipos vigente** —las revisiones
   confirmadas—, no con el euríbor de hoy *(corrección de Jose · 8 ago 2026:
   «confirmar una amortización no regenera con el de hoy, regenera con el que
   esté revisado anual»)*. La proyección más allá de la última revisión
   confirmada sigue siendo proyección, antes y después de amortizar.

---

## 7 · Dónde ATLAS todavía no encaja con esto

Sin proponer solución todavía — solo el inventario, para decidir después.

**a) `RevisionDelIndice` guarda demasiado poco.** Hoy es `{desde, valorIndice}`.
No guarda de qué mes publicado sale ese índice, ni si hubo redondeo, ni qué
bonificaciones concedió el banco en esa misma revisión. Sin eso, una revisión
apuntada no se puede auditar contra la carta.

**b) La escritura no tiene dónde decir de qué euríbor habla.** No hay campo para
el desfase (mes anterior / segundo mes anterior) ni para el redondeo. Se está
suponiendo, y suponer aquí mueve décimas.

**c) La ficha llama a la revisión por el recibo, no por la fecha.** Dice
«próxima revisión 25 sep 2026» cuando el tipo cambia el **25 de agosto** y el 25
de septiembre es solo el primer recibo afectado. Son las dos fechas de la regla
4 y la pantalla enseña una llamándola la otra.

**d) El mismo préstamo tiene dos cuadros.** La ficha regenera con el motor nuevo
y el euríbor de hoy; el modal de amortizar lee el plan guardado, hecho con el
motor viejo y el euríbor del alta. De ahí que uno diga 564 € y el otro 518 €.

**e) `valorIndiceActual` sigue siendo editable en la ficha de edición** y ya no
manda en nada de lo que se ve. Un campo que se puede escribir y no se usa es un
cebo.

**f) La fila de la nómina dice «cumplido» y «no se cumple» a la vez.** Son dos
evaluaciones distintas pintadas en la misma línea: lo que el banco aplica (un
hecho del contrato) y lo que demuestran los movimientos. Son preguntas
diferentes y las dos son útiles, pero no pueden compartir una fila sin decir
cuál es cuál.
