# VERIFICACIÓN · la clave de aprendizaje era un cajón común

**Fecha:** 2026-09-08 · **Reportado por Jose:** «cuando haces la búsqueda por un concepto y los parametrizas diciendo que todos son iguales, no solo clasifica los mismos sino que usa la misma clasificación para todos los pendientes» · **Regla A:** sin migración · **DB_VERSION:** 94, sin tocar.

## Qué pasaba

Al clasificar una línea del extracto, el motor busca sus «hermanas» comparando una huella del concepto (`buildLearnKey`). Esa huella se calcula quitando del texto lo volátil, y una de las reglas de limpieza borraba **cualquier palabra de ocho letras o más**:

```
.replace(/\b[a-z0-9]{8,}\b/g, '') // Long alphanumeric codes
```

La intención era quitar códigos tipo `a1b2c3d4`. Pero `normalizeText` ya ha pasado el texto a minúsculas y ha quitado los signos, así que ese patrón se comía las **palabras normales del castellano bancario**: «mercadona», «iberdrola», «comunidad», «propietarios», «transferencia», «electricidad». Sin dos palabras que juntar no quedaba ningún n-gram, la clave se reducía a `v1|signo` y ese cajón era el más poblado del sistema.

Medido contra el código, antes del arreglo:

```
6b85dc96  MERCADONA OVIEDO
6b85dc96  IBERDROLA COMERCIALIZACION
6b85dc96  RECIBO COMUNIDAD PROPIETARIOS
6b85dc96  BIZUM
6b85dc96  TRANSFERENCIA
```

Solo se salvaban los conceptos con dos palabras de tres a siete letras («BAR PEPE», «TAXI GIJON»).

**El daño iba por dos sitios, no por uno.**

- **En el lote abierto.** `hermanasDeAprendizaje` agrupa por clave y signo, así que una línea arrastraba a todas las pendientes del mismo signo. Es lo que vio Jose.
- **En las reglas guardadas, que es peor.** La regla nace con esa clave y `movementSuggestionService` la busca **solo por la clave**: el texto que la regla guardó (`descriptionPattern`) nunca se vuelve a mirar. A las tres aplicaciones la regla se aplica sola (`APLICACIONES_PARA_RESOLVER_SOLA`), sin preguntar, en las importaciones siguientes.

Esto no lo introdujo E2.4.2. La huella viene de E2.1 y E2.2; E2.4.2 lo hizo visible al aplicarlo dentro del mismo lote. De hecho el fallo estaba **documentado como pendiente** en `movementLearningService.test.ts`: «HALLAZGO (preexistente · v1 · NO se toca en E2.3) … Arreglarlo cambia la v1 de todas las reglas · otra tarea». Esta es esa otra tarea.

## Qué se ha hecho

**1 · La limpieza solo borra lo que parece un código.** Ahora exige que el token mezcle letras y números:

```
.replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{8,}\b/g, '')
```

Los números largos sueltos ya los quitaba la regla de arriba, así que aquí solo hacía falta lo mixto. «Mercadona» e «Iberdrola» vuelven a distinguirse; `a1b2c3d4e5` y un CUPS se siguen yendo.

**2 · Sin nada que agrupar no hay clave.** `buildLearnKey` y `buildLearnKeyV1` devuelven `null` cuando del concepto no queda ni un n-gram, es decir menos de dos palabras significativas. Una palabra sola no identifica a nadie: «BIZUM», «TRANSFERENCIA» o «RECIBO» a secas son cualquiera. El tipo lo dice (`string | null`), así que el compilador obligó a atender los cinco sitios que la usan:

| Dónde | Qué hace ahora con `null` |
|---|---|
| `clasificacion/aprendizajeEnLote.ts` | ninguna hermana |
| `aplicarSugerencia.ts` `feedLearningRule` | no se guarda regla |
| `movementSuggestionService.ts` | ni se carga ni se busca regla |
| `movementLearningService.ts` (aplicación en bloque) | no se hereda clasificación |
| `onboardingDetectionService.ts` | cae a su respaldo por concepto, que ya tenía |

**3 · Con identificador, todas las palabras entran en la clave.** Al recuperar las palabras largas apareció un efecto de rebote: «electricidad iberdrola comercializacion … gas» y la misma línea acabada en «luz» comparten los tres primeros n-gram, así que el gas y la luz del mismo acreedor se fundían en una regla. Cuando hay un NIF o un CUPS el acreedor ya está fijado y lo que quede del texto solo afina qué le compras, así que ahí entran todas las palabras (de letras, sin repetir, en orden alfabético). **Sin** identificador la clave sigue siendo solo los n-gram, a propósito: el principio del concepto dice quién cobra y la cola suele ser texto libre, y meter todas las palabras partiría «Bizum a favor de Víctor Concepto Cena» y «… Concepto Regalo» en dos reglas, que es justo lo que E2.4.2 vino a evitar.

## Sobre las reglas que ya estaban guardadas mal

**No hace falta borrar nada ni migrar (Regla A).** Con los arreglos 1 y 2 dejan de ser alcanzables: las claves nuevas no coinciden con las viejas, y la clave del cajón ya no se busca. Se quedan en la base sin efecto y se pueden borrar desde la pantalla de reglas.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx react-scripts build` (CI=true) | limpio |
| Suite completa | **24 suites / 100 tests en rojo · exactamente los mismos que main** |
| Trinquete | ✓ ningún indicador empeoró |
| `DB_VERSION` | 94 · sin bump, sin migración |

Tests nuevos en `__tests__/claveDeAprendizaje.test.ts` (13 casos): comercios distintos con claves distintas, el mismo comercio agrupando, la cola de texto libre sin partir la regla, gas y luz separados con identificador, el código volátil fuera, el signo separando, y las hermanas del lote — incluida la que fija que sin clave **no hay ninguna** hermana.

Tres tests existentes cambian, y conviene mirarlos porque son el antes y el después:

- `movementLearningService.test.ts` · el test del HALLAZGO afirmaba que el nº de factura cambiaba la clave. Ahora afirma que **no** la cambia, que es lo que su propio comentario pedía.
- `bankStatementOrchestrator.test.ts` · dos líneas del fixture pasan de «RENTA 1» a «RENTA INQUILINO 1». Con una sola palabra ya no se aprende, y ese es el precio explícito del arreglo.
- El mock de `buildLearnKey` en ese mismo fichero pasa de `jest.fn` a función plana. El `resetMocks` de Create React App borra la implementación de un `jest.fn` antes de cada test, así que devolvía `undefined`; daba igual mientras nadie mirase la clave. Es la convención que el propio fichero ya documenta para `bankProfilesService`.

## El precio, dicho

Un concepto de **una sola palabra** ya no aprende regla ni arrastra hermanas. Es deliberado y es el lado seguro: sobre-agrupar clasifica mal en silencio, y sobre-separar solo cuesta clasificar alguna línea más a mano. Si aparece un banco que escribe conceptos de una palabra de verdad, se revisa entonces.

## Segunda parte · el bloque no respetaba la selección

Jose, al leer el arreglo de arriba: «yo buscaba por ejemplo gas y marcaba todas las que quería clasificar, y me clasificaba esa y todas las demás».

Ese es OTRO camino, y tiene un fallo propio que sobrevive al de la clave. En la pantalla de conciliar hay buscador y selección múltiple: filtras por «gas», marcas las que quieres y pulsas «Clasificar las N como…». El manejador (`DrawerExtracto.clasificarVarias`) llamaba, por cada línea elegida, a la misma función que clasifica una línea suelta, y esa función termina arrastrando a las **hermanas del lote**. Eso es lo que E2.4.2 vino a hacer y está bien cuando clasificas UNA. En bloque no: el usuario ya ha ido marcando una por una cuáles quiere, y eso **es** la respuesta a «cuáles». Si de ocho recibos de gas marcaba cinco y dejaba tres fuera a propósito, los tres se clasificaban igual.

Con la clave rota, además, «las hermanas» eran todo lo pendiente del mismo signo. Por eso se veía tan grande.

**Arreglo.** La regla se muda al módulo que se llama `clasificarEnBloque`, que es de quien es, y ahí sí se puede probar: `clasificarLasElegidas` recorre exactamente las elegidas y llama a clasificar **sin arrastre**. El drawer se queda con dos líneas y baja de 799 a 794. Cinco tests nuevos fijan que hay una llamada por línea elegida, que nunca se arrastra, que las dejadas fuera se quedan fuera, que cada una conserva su importe y su fecha, y que sin selección no pasa nada.

**Los dos arreglos hacen falta.** La clave, para que «las hermanas» de una línea suelta sean de verdad las suyas. El bloque, para que una selección hecha a mano se respete aunque la clave sea perfecta.

## Lo que NO se ha hecho

- **Verificar el texto de la regla al aplicarla.** `movementLearningRules` guarda `descriptionPattern` y `counterpartyPattern` y la búsqueda no los mira: va por clave y punto. Comprobarlos sería un tercer candado que dejaría inofensivo cualquier choque futuro de huellas. No hace falta para este fallo y toca cómo se aplican todas las reglas, así que queda propuesto.
- **Un tope en el automático del lote.** Hoy una línea puede resolver las que hagan falta sin pedir confirmación. Pedirla a partir de un número es una decisión de producto de Jose.
