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
| Bonificaciones | 1 (nómina) · rebaja **0,30 p.p.** · tope 1,00 p.p. |
| Comisión de amortización anticipada | 0,25 % |

**Cuota del tramo fijo: 454,66 €.** Es la del recibo del banco.

> **Cuidado con este número, que ya ha fallado dos veces.** ATLAS enseña
> **454,57 €**, y no es un redondeo: es que tiene guardada la base de cálculo
> como **30/360** cuando el banco liquida sobre **días reales (ACT/365)**.
> Comprobado contra el motor con los datos de arriba:
>
> | Base guardada | Cuota que sale |
> |---|---|
> | 30/360 | 454,57 € |
> | ACT/360 | 456,17 € |
> | **ACT/365** | **454,66 €** ← el recibo |
>
> El motor está bien; el dato de entrada está mal. Corregir
> `baseCalculoIntereses` de este préstamo arrastra todo el cuadro del tramo
> fijo.

---

## 2 · Qué es una revisión

**Una hipoteca se revisa una o dos veces al año**, según diga la escritura. Es
**un solo acto**, y en él el banco mira dos cosas:

- **el índice** — solo si el tramo en curso es variable. En un fijo no hay
  índice que revisar, y en el tramo fijo de una mixta tampoco;
- **las bonificaciones** — si cumples o no cumples, para aplicarte o quitarte la
  rebaja los doce meses siguientes.

### Y aquí NO hay regla general · lo dice cada escritura

Esta es la parte que me he inventado dos veces, así que va con las tres
escrituras reales delante:

| Banco | Forma | Qué pasa en el tramo fijo | Cómo se guarda |
|---|---|---|---|
| **ING** | 2,15 % fijo diez años, después euríbor | **Todos los años** revisa si cumples, y **eso mueve el tipo fijo**: de 2,15 % a **1,35 %** | `bonificacionesDesde: 'FIRMA'` |
| **Unicaja** | mixta · 36 meses al 2,60 % | **No revisa nada.** «Tramo fijo 2,60 y me olvido de ti y de las bonificaciones hasta dentro de tres años» | `bonificacionesDesde: 'TRAMO_VARIABLE'` |
| **Santander** | fijo | El **primer año** te las da por cumplidas —pagas como si las tuvieras todas, del 1,85 % al 0,85 %—; cumplido el año te mira y fija el tipo nuevo | `graciaMesesBonificaciones: 12` |

> **«Fijo» quiere decir «no depende de un índice», no «no se mueve».** El tipo
> fijo de ING cambia todos los años —ochenta céntimos de punto— según cumplas o
> no. Dar por hecho que un tramo fijo es inmune a las bonificaciones es el error
> que hay que no volver a cometer.

Lo que rebajan las bonificaciones tampoco es siempre lo mismo: en ING actúan
sobre el **tipo fijo**; en Unicaja, sobre el **diferencial** del tramo variable.

### La concesión inicial

Al firmar, el banco puede dar las bonificaciones **por cumplidas de entrada**
sin exigir nada todavía —el año de Santander—. Durante ese plazo la cuota
rebajada **no demuestra que cumplas**, y hay que decirlo: quien no lo sepa se
llevará el susto en la primera revisión de verdad.

Es un plazo del préstamo, no de cada bonificación, y **no es la periodicidad de
revisión**: un préstamo puede revisar cada 12 meses y tenerlas regaladas los 12
primeros.

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

Para la revisión del **25/08/2026** el tipo no lo marca el euríbor del día 25,
sino el publicado para **julio de 2026** (o junio, según la escritura). El día 25
el número **ya está decidido y publicado** — no hay nada que adivinar, solo hay
que ir a buscarlo.

**Consecuencia para ATLAS:** el índice de una revisión es un **hecho que se
apunta**, no algo que se calcula. Mientras nadie lo apunte, lo único honesto que
se puede decir es «con el euríbor de hoy quedaría en X», dicho con esas palabras.

---

## 4 · Qué ocurre el 26/08/2026

El 26 no ocurre nada. Lo que hay que contar es lo del día anterior; el 26 es el
primer día en que todo eso ya está en vigor.

### 25/08/2026 · por la mañana: último recibo del tramo fijo

Se carga la cuota nº 36: **454,66 €**, de los que **166,01 €** son intereses y
**288,65 €** capital.

Ese recibo paga el interés **devengado del 25/07 al 25/08**, y ese mes corrió
todavía al 2,600 %. **Es un recibo del tramo fijo aunque se cobre el día de la
revisión.** El recibo va siempre un mes por detrás de lo que devenga.

Capital vivo después del cargo: **74.890,22 €**. Cuotas pagadas: 36 de 240.

### 25/08/2026 · el mismo día: la revisión

Es **una sola revisión** y aquí, por primera vez en este préstamo, toca las dos
cosas — porque justo ese día se entra en el tramo variable:

**Bonificaciones.** El banco mira los doce meses anteriores y decide si mantiene
los 0,30 p.p. Esa decisión rige los doce meses siguientes. (Si la concesión
inicial iba «por todo el tramo fijo», este es el primer día en que de verdad se
las juega.)

**Euríbor.** Coge el publicado del mes que diga la escritura, le suma el
diferencial y le resta la bonificación si la mantiene.

Con el euríbor a **4,000 %** que ATLAS tiene apuntado en «Actualizar valores»:

```
  4,000  euríbor publicado
+ 1,750  diferencial
= 5,750  TIN teórico
− 0,300  bonificación de nómina (si el banco la mantiene)
= 5,450  TIN aplicable desde el 25/08/2026
```

**Recalcula la cuota:** anualidad francesa sobre el capital vivo (74.890,22 €),
al TIN nuevo, por **el plazo que queda: 204 meses** (240 − 36).

> **El plazo NO cambia en una revisión.** Cambia la cuota. El préstamo sigue
> venciendo el 25/08/2043.

Resultado: **564,01 €**.

Sin la bonificación (5,750 %) serían **576,30 €**: la nómina vale **12,29 € al
mes**.

### 26/08/2026 · la situación

- El TIN vigente es **5,450 %** y **está congelado hasta el 25/08/2027**.
- Que el euríbor suba o baje durante esos doce meses **no mueve ni un céntimo**.
  Lo que se mueva servirá para la revisión *siguiente*.
- La cuota pasa a ser **564,01 €**…
- …**pero el primer recibo a ese importe se carga el 25/09/2026**. El del 25 de
  agosto ya se cobró, y era del tramo fijo.

Entre el 25/08 y el 25/09 el préstamo tiene **un tipo nuevo y ningún recibo
todavía a ese tipo**. Es lo que más fácil se lee mal.

---

## 5 · Qué ocurrirá el 26/08/2027

Lo mismo, ya sin estreno de tramo.

### 25/08/2027

**Se cobra el recibo nº 48**: 564,01 €, todavía al 5,450 %, porque paga el
devengo del 25/07 al 25/08 de 2027.

Capital vivo después: **72.135,59 €**. Plazo restante: **192 meses**.

**Revisión anual**, otra vez las dos cosas: bonificaciones para los doce meses
siguientes, y euríbor publicado del mes que diga la escritura. Se rehace la
cuota **partiendo del capital vivo real de ese día** —no del original— y **del
plazo que queda** —no de 240—.

Como nadie sabe hoy dónde estará el euríbor en julio de 2027, lo que se puede
decir es cuánto se movería la cuota según dónde caiga (cifras del motor, con la
bonificación mantenida):

| Euríbor jul-2027 | TIN | Cuota desde 25/09/2027 |
|---|---|---|
| 2,000 % | 3,450 % | **489,53 €** |
| 3,000 % | 4,450 % | **526,01 €** |
| 4,000 % | 5,450 % | **564,01 €** |
| 5,000 % | 6,450 % | **603,49 €** |

### 26/08/2027

Nuevo TIN congelado hasta el 25/08/2028, y **el primer recibo al importe nuevo
se carga el 25/09/2027**.

---

## 6 · Las reglas que salen de todo esto

Son las que tienen que gobernar el código.

1. **La revisión es UNA**, una o dos veces al año. El euríbor se revisa solo si
   el tramo en curso es variable; las bonificaciones, cuando diga la escritura.

2. **Que un tramo sea fijo no lo hace inmune a las bonificaciones.** Si se
   revisan durante el tramo fijo, y si al revisarse mueven el tipo, **lo decide
   la escritura de cada préstamo** — ING sí, Unicaja no. No se deduce del tipo
   de préstamo, se lee de `bonificacionesDesde`.

3. **La concesión inicial tiene su propia duración** (`graciaMesesBonificaciones`)
   y no es la periodicidad de revisión. Durante ella la cuota rebajada no
   demuestra que cumplas.

4. **El índice de una revisión es un HECHO que se apunta, no un cálculo.** Lo
   publica el BOE y lo aplica el banco. Hasta que se apunta, lo que hay es una
   proyección y hay que decirlo con esas palabras.

5. **Lo confirmado corre hasta la revisión siguiente.** El euríbor de
   «Actualizar valores» no toca el cuadro vigente: solo sirve para enseñar por
   dónde iría la revisión que viene.

6. **La revisión cambia la cuota, no el plazo.** Anualidad francesa sobre el
   capital vivo del día de la revisión y el plazo restante.

7. **La fecha de la revisión y la del primer recibo nuevo se llevan un mes.** El
   recibo que se cobra el día de la revisión es todavía del periodo anterior,
   porque paga un devengo ya corrido.

8. **Amortizar anticipadamente no cambia el tipo.** Se aplica el capital y se
   rehace el cuadro **con la estructura de tipos vigente** —las revisiones
   confirmadas—, no con el euríbor de hoy *(Jose · 8 ago 2026: «confirmar una
   amortización no regenera con el de hoy, regenera con el que esté revisado
   anual»)*. Lo que haya más allá de la última revisión confirmada sigue siendo
   proyección, antes y después de amortizar.

9. **La base de cálculo decide la cuota.** No es un detalle de presentación:
   30/360 y ACT/365 dan cuotas distintas sobre los mismos datos, y la del banco
   es la que manda.

---

## 7 · Dónde ATLAS todavía no encaja con esto

Inventario, sin proponer solución — para decidir después.

**a) La base de cálculo de este préstamo está mal.** Guardada 30/360, el banco
liquida ACT/365. Es lo que hace que la ficha diga 454,57 € donde el recibo dice
454,66 €.

**b) Hay dos periodicidades de revisión donde solo hay una.**
`periodoRevisionMeses` y `periodoRevisionBonificacionMeses` son campos
independientes, y la revisión es un solo acto. Dos campos para una cosa acaban
divergiendo.

*(`bonificacionesDesde` y `graciaMesesBonificaciones` sí existen y modelan bien
los tres casos de arriba · el hueco no está ahí.)*

**c) `RevisionDelIndice` guarda demasiado poco.** *Medio hecho:* de qué mes
publicado sale el índice ya no hace falta guardarlo — se **deriva** del desfase
de la escritura, así que hay un solo sitio que lo dice y no puede
contradecirse. Lo que sigue sin guardarse es **qué bonificaciones concedió el
banco en esa misma revisión**, que es parte del mismo acto: hoy solo queda el
estado actual, que la revisión siguiente pisa. Sin ese histórico no se puede
mirar atrás y ver cuándo te quitaron una.

**d) La escritura no tiene dónde decir de qué euríbor habla.** *Medio hecho:*
ya está el **desfase** (`indiceDesfaseMeses`), que es lo que permite decir «el
euríbor publicado de julio de 2026» en vez de ofrecer el de hoy. Falta el
**redondeo** —hay escrituras que redondean a un octavo de punto—, que se deja
fuera a propósito: hoy no lo leería nadie, porque el índice se apunta ya
redondeado desde la carta. Entrará cuando haya quien lo use.

**e) La ficha llama a la revisión por el recibo, no por la fecha.** Dice
«próxima revisión 25 sep 2026» cuando el tipo cambia el **25 de agosto**. Son
las dos fechas de la regla 7, y la pantalla enseña una llamándola la otra.

**f) El mismo préstamo tenía dos cuadros.** *Resuelto, y al revés de lo que yo
proponía.* La ficha regeneraba con el euríbor de hoy y el modal leía el plan
guardado — y el que tenía razón era el modal:

> «La actualización del valor del euríbor durante ese tiempo sirve de guía
> prevista de la cuota **pero no debe cambiar ningún cuadro**, porque no va a
> cambiar nada realmente hasta la siguiente revisión» *(Jose · 8 ago 2026)*.

El cuadro se calcula con lo último **fijado** —el índice del alta hasta la
primera revisión, y el de cada revisión confirmada después— y no se mueve porque
el mercado se mueva. El euríbor de «Actualizar valores» entra por una sola
puerta, `simulacionRevision`, que dice por dónde irá lo que viene sin tocar lo
que se paga.

Queda del punto original: el modal sigue leyendo el plan **persistido** y la
ficha lo **regenera** del préstamo. Ahora coinciden porque parten del mismo
índice, pero siguen siendo dos caminos.

**g) El «Euríbor» del asistente no dice cuándo manda.** *Corregido el
diagnóstico y hecho:* el campo **no** está sin usarse —`conIndiceDeHoy` solo lo
sustituye cuando «Actualizar valores» tiene euríbor, así que es el respaldo—.
Lo que fallaba era la etiqueta: se llamaba «Euríbor» a secas y quien lo edita
cree que gobierna la cuota. Ahora es «Euríbor de arranque» y debajo se dice qué
manda de verdad: valoraciones para proyectar, y por encima de los dos las
revisiones apuntadas.

**h) La fila de la nómina dice «cumplido» y «no se cumple» a la vez.**
*Corregido el diagnóstico:* no es una contradicción de lógica sino de
presentación, y el caso de debajo es valioso. La marca dice que **el banco te la
aplica** —un hecho del contrato— y el aviso dice que **tus movimientos no lo
demuestran**. Cuando no coinciden es justo cuando hay que enterarse: significa
que la pierdes en la próxima revisión. Lo que faltaba era decir de quién es cada
voz y qué día se pierde.
