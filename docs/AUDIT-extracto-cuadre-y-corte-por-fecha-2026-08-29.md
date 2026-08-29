# AUDITORÍA (SOLO LECTURA) · Por qué el extracto no cuadra y por qué corta por fecha

**Fecha:** 2026-08-29 · **Rama:** `main` @ `4557e88` · **Alcance:** solo lectura, ningún cambio de código.

**Caso base:** `Movimientos_Cuenta_4437_01_01_2026_28_08_2026.xls` (Unicaja, `ES60 2103 7003 5200 3008 4437`, 140 movimientos, 01/01→28/08/2026).
**Lo que enseñó ATLAS:** 119 líneas · **6 cuadran** · 8 a resolver · 0 ignoradas · **88 de meses cerrados** · **17 de meses anteriores**.

Son **dos fallos distintos**, y el segundo es peor de lo que se ve en pantalla.

---

## 0. De dónde salen los números

| | |
|---|---|
| 140 movimientos en el fichero | los que trae el `.xls` |
| −21 | duplicados por hash de línea, ya estaban en la base (`insertMovements` → `duplicatesSkipped`, `bankStatementOrchestrator.ts:254-265`) |
| **119 líneas** | las que entran al drawer |
| 6 + 8 = **14** | las que sobreviven |
| 88 + 17 = **105** | las que se apartan **por fecha**, no por no cuadrar |

**105 de 119 (88 %) no se apartan porque el cuadre falle: se apartan antes de que se les mire.**

---

## FALLO 1 · El corte por fecha no aparta: **borra**

### Dónde está

`src/modules/tesoreria/v6/DrawerExtracto.tsx:167-172`

```ts
const setCerrados = new Set((mesesCerrados ?? []).map((c) => c.mes));
const mesActual = new Date().toISOString().slice(0, 7);   // '2026-08'
```

`src/modules/tesoreria/v6/extractoSesion.ts:206-215` — el veredicto:

```ts
: mesesCerrados.has(mesLinea)      ? 'mes_cerrado'
: mesActual && mesLinea < mesActual ? 'mes_anterior'
: 'resolver'
```

Como `mesActual` es `2026-08`, **toda línea de enero a julio que no cuadre sola cae en `mes_cerrado` o `mes_anterior`.** El fichero es de enero a agosto: por definición, siete de sus ocho meses están condenados.

### Lo que NO se ve en pantalla

La etiqueta dice *"no se cargan"*. Lo que ocurre al pulsar **Guardar** es otra cosa —
`extractoSesion.ts:381-402`:

```ts
// "resolver", "mes_cerrado" y "mes_anterior" comparten destino: NO se
// materializan. (...) su `Movement` se borra al consolidar
return lineas.filter((l) => {
  const v = veredictoEfectivo(l, decisiones);
  return v === 'resolver' || v === 'mes_cerrado' || v === 'mes_anterior';
})
```

y `DrawerExtracto.tsx:274` lo ejecuta: `await consolidarSesion(...)`.

**Subes ocho meses de extracto real, ATLAS se queda 14 líneas y tira 105 movimientos del banco a la basura.** No los aparta: los borra. La próxima vez que subas el mismo fichero, el hash de lote avisará de "ya importado" y el hash de línea de los 105 ya no existirá — volverán a entrar y volverán a borrarse. El bucle es estable y nunca converge.

### Y las 88 de meses cerrados no tienen vuelta atrás

`DrawerExtracto.tsx:707-714` — el grupo `mes_cerrado` se pinta **sin `accion`**. El grupo `ignoradas` (`:693-703`) y el grupo `mes_anterior` (`:719-737`) sí llevan botón `recuperar`. Los cerrados, no. La única salida que ofrece el texto es *"anótalo desde el punteo de su cuenta"* — es decir, teclear 88 movimientos a mano.

### La incoherencia con lo que acabamos de hacer

En #1818/#1819/#1820 se construyó justo lo contrario: el suelo de reconstrucción baja a `2026-01-01`, se puebla el pasado con los previstos de enero a agosto, y la tesorería te deja volver a esos meses **para que los liquides**. El extracto que trae la realidad de esos ocho meses aparta 105 de sus 119 líneas y las borra al guardar.

**Generamos el trabajo y bloqueamos la única herramienta que lo hace.** Eso es lo que se está viendo.

---

## FALLO 2 · El marcador es aritméticamente imposible para un recibo variable

`src/services/movementMatchingService.ts:172-275` · umbral **70** (`:44`, comparado en `:404` con `score < umbral → fuera`).

### Los puntos que puede sumar un recibo domiciliado en su propia cuenta

| concepto | línea | puntos |
|---|---|---|
| `cuenta_match` | `:208-211` | **+15** siempre |
| `recibo_recurrente_misma_cuenta` | `:258-263` | **+10** siempre (si es `gasto_recurrente`/`tarjeta_recibo`) |
| fecha | `:182-192` | +30 mismo día · +20 a 1 día · +10 a 2-3 días · **+0 a partir de 4** |
| importe exacto | `:200-202` **y** `:221-224` | +30 **y** +25 = **+55** |
| importe dentro del 1 % | `:203-205` | **+20** (y **no** cobra el +25) |
| importe fuera del 1 % | — | **+0** |
| proveedor | `:266-270` | +25 **solo si** `description.includes(providerName)` literal |

### La tabla que sale de ahí

| caso real | fecha | importe | nombre | total | ¿cuadra? |
|---|---|---|---|---|---|
| importe clavado, mismo día | 30 | 55 | 0 | **100** | ✅ |
| importe clavado, +9 días | 0 | 55 | 0 | **80** | ✅ |
| **1 céntimo de diferencia**, mismo día | 30 | 20 | 0 | **75** | ✅ |
| **1 céntimo de diferencia**, +2 días | 10 | 20 | 0 | **55** | ❌ |
| recibo variable (agua/luz), mismo día | 30 | 0 | 0 | **55** | ❌ |
| recibo variable, mismo día, nombre en el concepto | 30 | 0 | 25 | **80** | ✅ |
| recibo variable, **+2 días**, nombre en el concepto | 10 | 0 | 25 | **60** | ❌ |

**La regla efectiva es:** *o el importe está clavado al céntimo, o el cargo tiene que caer a ±1 día del previsto **y** el nombre del proveedor tiene que aparecer literalmente dentro del concepto del banco.* Cualquier otra combinación es matemáticamente incapaz de llegar a 70.

Un recibo de agua de FCC Aqualia que un mes es 50,73 y otro 47,12, cargado el día 12 cuando la previsión decía el 10, **no puede cuadrar nunca**: su techo son 55 puntos sin el nombre, 60 con él.

### Tres agravantes concretos

**(a) La ventana también se cierra.** `:151-157`: la ventana ancha de 35 días es **solo** para importe exacto; en cuanto el importe varía un céntimo, la ventana baja a ±5 días y fuera de ahí el previsto ni se puntúa. Es decir: el caso variable —el que más ayuda necesita— es el que menos margen recibe.

**(b) Un céntimo cuesta 35 puntos.** `importe_dentro_tolerancia` da +20, pero **no** concede el `+25` de `importe_exacto_misma_cuenta` (`:221-224` exige `diffAbs < 0.005`). Pasar de 0,00 € a 0,01 € de diferencia hace caer el marcador de 55 a 20 de golpe. No hay degradación suave: hay un acantilado.

**(c) El campo pensado para esto está tapado.** El compromiso guarda `counterparty: compromiso.conceptoBancario` (`compromisosRecurrentesService.ts:633`) — literalmente *el texto que manda el banco*, que es el que casaría. Pero el marcador lee `event.providerName ?? event.counterparty` (`:267`): en cuanto el compromiso tiene proveedor, `providerName` gana y **`conceptoBancario` no se consulta jamás**. El único campo diseñado para pegar con el extracto está inaccesible siempre que esté relleno el otro.

**(d) La comparación de nombre es un `includes` crudo.** `:266-270`: minúsculas y nada más. Sin quitar acentos, sin colapsar espacios, sin tocar `S.A.`/`SL`, sin partir en palabras. `providerName = "Aqualia"` contra `"RECIBO /FCC AQUALIA, S.A."` acierta por suerte; `"Comunidad de Propietarios"` contra `"CCPP EDIFICIO ..."` o `"CDAD PROP ..."` no acierta nunca.

### Un cuarto efecto, más silencioso

`resolveEventConflicts` (`:373-386`) reduce **cada previsto a un único movimiento** antes de aplicar el umbral, y `dedupePorSerie` (`:445-455`) colapsa la serie a un candidato. Con ventana de 35 días para importe exacto, un cargo de agosto puede consumir el previsto de **septiembre** (está a 35 días) y hacerlo callar; cuando llegue el cargo real de septiembre ya no tendrá con qué cuadrar. Y como la serie se colapsa a un solo candidato, eso se resuelve como cuadre automático, sin preguntar.

---

## FALLO 3 · ATLAS te pide cuatro datos para cuadrar y el conciliador no usa ninguno

Un gasto recurrente guarda esto (`src/types/compromisosRecurrentes.ts:229-257`):

```ts
cups?: string;
numeroContrato?: string;   // "Identificadores que permiten cuadrar la factura
                           //  aunque cambie la compañía"
margenGraciaDias?: number;  // "tolerancia al cuadrar el cargo real contra la
                           //  fecha prevista"
conceptoBancario: string;   // "texto que aparece en extracto" · OBLIGATORIO
```

Los cuatro campos están escritos, comentados y pedidos en el formulario
(`ListadoGastos/components/RowForm.tsx:176-177, 230, 386-387, 408`) con el
propósito explícito de cuadrar. El conciliador de extractos no lee ninguno.

| campo | quién lo usa | quién NO lo usa |
|---|---|---|
| `cups`, `numeroContrato` | `documentAutoClassifyService.ts:330-342`, para cuadrar **facturas** | `movementMatchingService` · ni siquiera se copian al `TreasuryEvent` (`compromisosRecurrentesService.ts:605-635`) |
| `margenGraciaDias` | solo contratos de alquiler (`estadoCobroContratoService.ts:97`) | el conciliador usa la constante fija `fechaWindowDays: 5` (`:43`) |
| `conceptoBancario` | viaja al evento como `counterparty` (`compromisosRecurrentesService.ts:633`) | el marcador lee `providerName ?? counterparty` (`:267`) — **con proveedor relleno, no se consulta jamás** |

El usuario rellena un margen de gracia por gasto que se tira a la basura, y el
único campo cuya definición es *"texto que aparece en extracto"* está tapado por
el nombre comercial del proveedor.

---

## FALLO 4 · El comparador de nombres bueno existe en el repo y está detrás de una puerta cerrada

`src/services/coincidenciaNombre.ts` hace exactamente lo que hace falta: quita
tildes, parte en palabras, descarta partículas (`de`, `la`, `del`), exige tres
letras por palabra y devuelve `fuerte` (dos palabras o más) o `parcial` (una).

Se llega a él por un solo camino, `puntosDeBizum` (`movementMatchingService.ts:315-345`):

```ts
const esBizum = movement.paymentMethod === 'Bizum' || pareceBizum(textoBanco);
if (!esBizum) return 0;
```

**Un recibo domiciliado nunca es un Bizum, así que nunca llega.** Para todos los
gastos recurrentes queda el `includes` crudo de `:266-270`. Por eso "Comunidad
de Propietarios" no pega con "CCPP" ni con "CDAD PROP": no hay abreviaturas, ni
siglas, ni comparación por palabras — hay una única comprobación de subcadena
literal en minúsculas.

Y la comparación disponible tampoco resolvería las siglas por sí sola: "CCPP" no
comparte ninguna palabra con "Comunidad de Propietarios". Hace falta además
apoyarse en `conceptoBancario` (fallo 3), que es donde el usuario ya ha escrito
el texto que manda el banco.

---

## CORRECCIÓN al fallo 2 · la aritmética no explica el caso de Jose

El fallo 2 explica por qué **un recibo de importe variable** no puede cuadrar. No
explica el caso que Jose señala: *la comunidad encaja de importe y tampoco
cuadra*. Según la tabla del fallo 2, importe clavado + misma cuenta = **80
puntos** aunque el día falle nueve días: tendría que cuadrar.

Que no cuadre significa que el previsto **no llega a puntuarse**. Solo hay cuatro
puertas antes del marcador (`movementMatchingService.ts:105-135, 151-157, 373-386`):

1. el previsto no está en `predicted` (`esConciliable`, `descarteDePrevision.ts:30-32`);
2. su `accountId` no es el de la cuenta importada — el candidato se busca por
   índice `accountId`, así que un previsto sin cuenta o con otra **no existe**
   para el conciliador;
3. no hay previsto de ese mes en la ventana;
4. `resolveEventConflicts` se lo dio a otro movimiento.

**Cuál de las cuatro está disparando no se sabe todavía, y es lo que falta.** La
sonda ampliada lo resuelve: lista los previstos de la cuenta con su estado y su
cuenta, y para cada línea que no cuadra teniendo importe clavado dice cuál de las
cuatro puertas la paró.

---

## Resumen

| # | Fallo | Dónde | Efecto medido |
|---|---|---|---|
| 1 | El corte por fecha borra movimientos reales del banco | `DrawerExtracto.tsx:167-172` + `extractoSesion.ts:381-402` | 105 de 119 líneas destruidas al Guardar |
| 2 | Las 88 de meses cerrados no tienen botón de recuperar | `DrawerExtracto.tsx:707-714` | sin salida salvo teclear a mano |
| 3 | Un recibo de importe variable no puede llegar a 70 | `movementMatchingService.ts:182-270` | techo 55-60 puntos; imposible por aritmética |
| 4 | La ventana ancha solo aplica al importe exacto | `:151-157` | el caso difícil recibe el margen más estrecho |
| 5 | Un céntimo de diferencia cuesta 35 puntos | `:200-205` + `:221-224` | acantilado, no degradación |
| 6 | `conceptoBancario` nunca se consulta si hay proveedor | `:267` vs `compromisosRecurrentesService.ts:633` | el campo hecho para casar está tapado |
| 7 | `includes` crudo sin normalizar | `:266-270` | "CCPP"/"CDAD PROP" no pegan con "Comunidad de Propietarios" |
| 8 | Un cargo puede consumir el previsto del mes siguiente | `:151-157` + `:373-386` + `:445-455` | deja huérfano al cargo real de ese mes |
| 9 | `cups`/`numeroContrato` no llegan al conciliador | `compromisosRecurrentesService.ts:605-635` | los identificadores que cuadran facturas no cuadran cargos |
| 10 | `margenGraciaDias` se ignora | `movementMatchingService.ts:43` | el margen que rellena el usuario no hace nada |
| 11 | `coincidenciaNombre` inalcanzable para gastos | `:315-319` | el comparador bueno solo funciona con Bizum |
| 12 | **Una línea con importe clavado que no cuadra no la explica la aritmética** | `:105-135` | hay una puerta anterior sin identificar · la sonda la señala |

**Y la incoherencia de fondo:** acabamos de poblar enero→agosto de previstos para que se puedan liquidar, y el extracto que trae la realidad de esos meses la tira.

---

## Lo que NO he hecho

Ningún cambio de código. Ningún PR. Esto es la foto, con líneas y aritmética.

## Lo que falta para tener el dato real

La tabla de arriba es aritmética del código, no medición sobre tu base. Para poner número exacto a cada una de tus 119 líneas está la sonda `sonda-extracto-atlas.js` (solo lectura): se pega en la consola **con el drawer abierto en el paso de revisar, antes de Guardar**, y saca por cada línea del banco cuál era su mejor previsión, cuántos puntos sacó, cuántos le faltaron y por qué concepto los perdió.

Con esa salida se sabe cuántos de los 8 fallos de arriba te están pegando de verdad y en qué proporción, y con eso se decide el orden del arreglo.
