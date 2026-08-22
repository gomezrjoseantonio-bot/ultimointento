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

- **`porcentaje`** — el valor ya es una tasa (Euríbor, IRAV). Se usa tal cual.
- **`indice`** — es un número índice sobre una base (IPC). Lo que se aplica a una
  renta es la variación respecto al mismo mes del año anterior, que calcula
  `variacionInteranual`.

`porcentajeDeActualizacion` unifica las dos: quien llama no debería tener que
saber cuál es cuál.

## 6. ⚠️ Lo que falta comprobar antes de fiarse

**Los códigos de serie no están verificados contra las APIs reales.** El entorno
donde se programó esto no tenía salida a internet, así que ni el código del IPC
(`IPC251856`), ni el del IRAV (`IRAV001`), ni el CSV del BCE se han podido llamar
de verdad.

Cómo se comprueba, y hay que hacerlo antes de dar el dato por bueno:

1. Actions → «Actualizar índices oficiales» → **Run workflow** (a mano).
2. Leer el registro. Cada adaptador imprime el **nombre de la serie tal como lo
   devuelve el organismo** — ahí se ve si se está bajando lo que se cree.
3. Revisar el diff del commit automático: número de meses y último valor.

En local, sin escribir nada: `node scripts/indices/actualizar-indices.mjs --dry-run`

Si un código está mal, se cambia en `scripts/indices/fuentes.mjs` y se vuelve a
lanzar. La validación por rangos ya impide que una respuesta corrupta acabe en el
fichero, pero **no puede detectar que se ha bajado la serie equivocada**: eso solo
lo ve una persona leyendo el nombre.

**Sobre el Euríbor:** el valor que aplica a una hipoteca en España es el que
publica el Banco de España (y el BOE). Aquí se toma del portal de datos del BCE
porque es una API estable y sin clave, pero conviene contrastar un par de meses
contra la publicación del BdE antes de que este número toque nada contractual.
Además, la serie Euríbor la licencia EMMI y redistribuirla tiene condiciones.

**Sobre el IRAV:** desde 2025 es el índice que sustituye al IPC para actualizar
rentas de vivienda habitual. Conviene confirmar con asesor cuál aplica a cada
contrato según su fecha de firma.

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
