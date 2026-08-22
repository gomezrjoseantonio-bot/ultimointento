# Índices oficiales que se actualizan solos · v1

**Euríbor 12m · IPC · IRAV** · agosto de 2026

Qué se ha montado para que estos tres valores dejen de teclearse a mano, por qué
está montado así, y qué falta.

---

## 1. El problema no era descargar el dato

Antes de esto, `FinancialValuesSnapshot` guardaba **un solo valor vigente**:

```ts
ipcMonthlyPercent: number | null;
euriborPercent: number | null;
effectiveDate: string;
```

Un valor único no sirve para lo que ATLAS calcula. Una revisión de hipoteca de
agosto necesita el euríbor **de julio** (el que diga el desfase de la escritura),
y una renta que se actualiza en septiembre necesita el índice **de septiembre**.
Con un solo hueco, el dato correcto de hoy pisa el dato correcto de ayer y los
recálculos históricos dejan de ser reproducibles.

Por eso lo primero no fue la descarga, sino el modelo: **serie histórica, mapa
`'YYYY-MM' → valor`**.

El síntoma se veía en la pantalla de revisión de préstamos. `publicacionDelIndice`
ya sabía a QUÉ MES había que ir —lo dice la escritura— y así se lo decía al
usuario, pero no había dónde buscar ese mes: en «Actualizar valores» solo cabe el
euríbor de hoy. La pantalla nombraba el mes correcto y rellenaba la casilla con el
número equivocado.

## 2. Dos infraestructuras, porque son dos problemas

| | Dato público común | Dato de cada usuario |
|---|---|---|
| Qué | Euríbor, IPC, IRAV | cotización de SUS acciones |
| Dónde | fichero estático en el repo | función serverless con clave |
| Estado | **hecho** | pendiente |

Los índices son públicos e iguales para todo el mundo: no son datos del usuario y
no tienen por qué vivir en su IndexedDB. Viven en `public/data/indices/*.json`,
que Netlify sirve como un fichero más.

Esto da tres cosas que una base de datos no daba gratis: **coste cero**, **historial
auditable** —en el diff de cada mes se ve exactamente qué valor entró y cuándo— y
**funcionamiento sin conexión**, que es justo lo que necesita una aplicación cuyos
datos viven en el navegador.

Las cotizaciones no encajan aquí: dependen de qué tenga cada uno en cartera y
necesitan una clave de API. Esa parte queda para después.

## 3. Las piezas

```
scripts/indices/fuentes.mjs            un adaptador por organismo
scripts/indices/actualizar-indices.mjs descarga · valida · funde · escribe
.github/workflows/actualizar-indices.yml  los días 3, 16 y 25 de cada mes
public/data/indices/*.json             el dato servido
src/types/seriesIndices.ts             la forma
src/services/indices/seriesIndicesService.ts  la lectura
```

El ciclo completo: la tarea programada descarga, valida y commitea → Netlify
redespliega al ver el commit → la app lee el JSON nuevo. Nadie toca nada.

No se ha creado ningún store nuevo de IndexedDB, así que **no hay bump de
`DB_VERSION`**: la copia para trabajar sin conexión se guarda en `keyval`, bajo
`serieIndice:<id>`.

## 4. Las cuatro reglas

1. **No se rellenan huecos.** Si falta el mes que se pide, `valorEnMes` devuelve
   `null`. Servir «el del mes anterior, que se le parece» es fabricar el número
   del que cuelga una cuota.
2. **Lo automático no pisa lo manual.** El servicio no escribe en
   `financialValuesSnapshot`. Propone; decide quien teclea.
3. **Un dato viejo se señala, no se disfraza.** Si la descarga falla se usa la
   última copia buena, y `mesesDeRetraso` permite decirlo en pantalla.
4. **Ante la duda, no se escribe.** Si la validación falla, el fichero se queda
   como estaba y el trabajo termina en rojo. Quedarse con el dato del mes pasado
   es recuperable; publicar un índice equivocado, no.

## 5. Las dos formas de publicar

No controlamos el formato de cada organismo, así que cada serie declara su
`unidad` y el servicio se encarga:

- **`porcentaje`** — el valor ya es una tasa. Se usa tal cual.
- **`indice`** — es un número índice sobre una base. Lo que se aplica a una renta
  es la variación respecto al mismo mes del año anterior, que calcula
  `variacionInteranual`.

`porcentajeDeActualizacion` unifica las dos: quien llama no debería tener que
saber cuál es cuál.

Que ese campo existiera salvó la primera ejecución. Se dio por supuesto que el
IPC del INE vendría como número índice sobre base 2021, y llega ya como
**variación anual** — una tasa. Con la unidad declarada por serie, corregirlo fue
cambiar dos líneas en `fuentes.mjs`; sin ella habría habido que tocar el
servicio, sus tests y los llamadores. **Hoy las tres series son `porcentaje`**, y
`indice` se conserva porque el próximo organismo publicará de la otra forma.

## 6. Qué se comprobó en la primera ejecución

Ejecutada a mano el 22 de agosto de 2026
([run 32574078110](https://github.com/gomezrjoseantonio-bot/ultimointento/actions/runs/32574078110)).
El circuito completo funcionó: descarga → validación → commit automático en
`main` → redespliegue.

| Serie | Nombre según el organismo | Resultado |
|---|---|---|
| Euríbor 12m | «Euribor 1-year - Historical close» | 391 meses · 1994-01 → 2026-07 · último **2,855087** |
| IPC | «Nacional. Índice general. Variación anual» | **rechazado** · venía como tasa, no como índice |
| IRAV | «Total Nacional. Índice general. Variación anual» | 21 meses · 2024-11 → 2026-07 · último **2,49** |

**El IPC lo paró la validación**, no una persona: el rango 50–250 esperaba un
número índice y llegó un 13,9 de enero de 1976. Corregido a `porcentaje` con
rango −10 a 30, que es lo que la serie es de verdad. Que el fichero NO se
escribiera con la unidad equivocada es exactamente el comportamiento buscado.

**El IRAV quedó confirmado** por su fecha de arranque: una serie que empieza en
noviembre de 2024 solo puede ser el índice nuevo, no el IPC de siempre.

**Del euríbor queda un fleco.** El nombre corto dice «Historical close», y para
una hipoteca española lo que manda es la **media mensual**, no el cierre del
último día. El adaptador ahora imprime también `TITLE_COMPL`, que es donde el
BCE aclara si el valor mensual es la media de las observaciones del periodo. Hay
que leerlo en la siguiente ejecución y, si resulta ser un cierre, cambiar de
serie. Hasta entonces, **el euríbor descargado no debe darse por bueno para nada
contractual**, y conviene contrastar un par de meses contra la publicación del
Banco de España, que es la oficial en España. Además la serie Euríbor la licencia
EMMI y redistribuirla tiene condiciones.

**Sobre el IRAV:** desde 2025 es el índice que sustituye al IPC para actualizar
rentas de vivienda habitual. Conviene confirmar con asesor cuál aplica a cada
contrato según su fecha de firma.

### Segunda ejecución · 3/3 correctas, y un hallazgo

[Run 32574318499](https://github.com/gomezrjoseantonio-bot/ultimointento/actions/runs/32574318499),
con el IPC ya corregido a `porcentaje`:

| Serie | Último dato |
|---|---|
| Euríbor 12m | 2026-07 = 2,855087 |
| IPC | **2025-12 = 2,9** ⚠️ |
| IRAV | 2026-07 = 2,49 |

El IPC se para en diciembre de 2025 mientras las otras dos llegan a julio de
2026. Y 1976-01 → 2025-12 son **exactamente 600 meses**, que es justo lo que se
pedía con `nult=600`. Dos explicaciones posibles: la serie `IPC251856` dejó de
publicarse (el INE renumera al cambiar de base) o el organismo recortaba por
arriba.

Se han hecho dos cosas:

1. **`nult` baja a 240.** Si el corte era del organismo, ahora llega lo reciente;
   lo viejo no se pierde porque la fusión conserva lo ya descargado.
2. **Guarda de serie descatalogada.** Si el último dato queda más de
   `cadenciaMeses + 3` meses atrás, la serie se rechaza y el trabajo va en rojo.
   Esto es lo que ninguna validación de formato ni de rango podía detectar: los
   valores eran correctos, solo viejos, y sin este corte el fichero se habría
   quedado congelado con todo en verde mes tras mes.

**Si tras esto el IPC sigue parándose en 2025-12, la serie está descatalogada** y
hay que buscar el código vigente en el catálogo Tempus3 del INE y cambiarlo en
`fuentes.mjs`. Mientras tanto el trabajo saldrá en rojo, que es lo correcto: el
IPC no debe usarse hasta que llegue al mes corriente.

Cómo repetir la comprobación:

1. Actions → «Actualizar índices oficiales» → **Run workflow**.
2. Leer las líneas `serie en origen` del paso «Descargar y validar».
3. En local, sin escribir nada: `node scripts/indices/actualizar-indices.mjs --dry-run`

## 7. Lo siguiente

**Motor de rentas.** `rentasContratosEngine` ya distingue `'ipc' | 'irav' | 'otros'`,
pero los tres van hoy al mismo supuesto global `supuestos.subidaRentasPct`. Con la
serie disponible, lo natural es que un contrato indexado use el índice real de su
mes de actualización y deje el supuesto solo para lo que no tiene índice.

No se ha hecho aquí a propósito: el motor es **síncrono** y la carga de la serie
es asíncrona, así que enchufarlo obliga a tocar sus llamadores. Eso es un cambio
con riesgo de regresión en las proyecciones, y no debe viajar en el mismo commit
que la infraestructura que lo hace posible.

**Aviso de retraso en pantalla.** `mesesDeRetraso` existe y nadie lo usa todavía.

**Cotizaciones y valor de inmuebles.** Ver la conversación de diseño: las primeras
necesitan proveedor de pago; el segundo no es automatizable de verdad y solo
admite revalorización por índice o valor de referencia de Catastro, siempre
etiquetado como estimación.
