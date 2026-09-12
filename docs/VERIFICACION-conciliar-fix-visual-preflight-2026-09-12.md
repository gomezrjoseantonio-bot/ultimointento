# FIX de la pantalla de Conciliación · lo VISUAL/UX · PREFLIGHT

Sobre lo mergeado en #1872. **No toca la clasificación** (CARREFOUR, WIZINK, CANCELAC… es otro fix). Estado: para el OK de Jose · sin código.

## Los 6 problemas · dónde están y qué se hace

### 1 · La banda ámbar de saldo/apertura
- **Dónde**: `PanelConciliar.tsx:157-159` monta `CuadreConElBanco` en el flujo, debajo del hero. `CuadreConElBanco.tsx:80-131` pinta el bloque entero (cuadre + casilla de apertura + dos notas) con `CuadreBanco.module.css:22-25` `.bancoAviso` = `--atlas-v5-warn-wash` (fondo ámbar) y `:17-20` `.bancoOk` = `--atlas-v5-pos-wash` (fondo verde). Es la banda dominante que la guía prohíbe.
- **Qué se hace**: el bloque pasa a un `<details>` **plegado** debajo del hero, con una sola línea de resumen («Cuadre con el banco · el banco dice X a fecha · ATLAS calcula Y» o «· cuadra»), en `card-alt` gris, sin ámbar ni verde de fondo. Dentro, lo de siempre (la casilla «fijar la apertura · se aplica al guardar» y las notas). Nada bloquea. **El cálculo no se toca** (`aperturaDerivada.ts` intacto). El hero sigue enseñando el saldo que haya.

### 2 · Un botón por cada piso
- **Dónde**: `TarjetaAccion.tsx:63` `PISOS_A_LA_VISTA = 3` y `:135-155` pintan un botón por inmueble + «Otro piso…» + «Es personal». Con 10 pisos / 50 habitaciones es una fila ingobernable.
- **Qué hay para reusar**: la ficha elige piso con un `<select>` nativo (`FichaMovimiento.tsx:601-611` y `:627-636`: «Sin inmueble · personal» + un `<option>` por alias). No existe en la app un combobox de piso con búsqueda; `TipoGastoSelector` (`modules/shared/components/TipoGastoSelector`) es un combobox pero atado al catálogo de tipos de gasto, sin campo de búsqueda.
- **Qué se hace**: un **selector de destino** (`<select>` nativo, el mismo patrón que la ficha) con «Sin inmueble · personal», los pisos/habitaciones, y las cuentas propias como «Es un traspaso a …» cuando la entidad son cargos. Con más de 8 opciones, un campo de texto encima que filtra las opciones (búsqueda). Un botón principal «Clasificar como…» (oro) + el selector + «Ignorar» (fantasma pequeño). Acceso rápido: **como mucho uno**, el piso que el motor ya supone (`clasificacion.inmuebleId`), y solo si lo hay. Elegir un piso en el selector hace lo mismo que hoy el botón (abre la ficha prerrellenada con ese piso · P1).

### 3 · «cuadra con un previsto» miente
- **Dónde**: `LineaExtractoItem.tsx:145-154`. Con veredicto `cuadra` escribe «cuadra con {previsto ?? confirmado ?? **'un previsto'**}». El veredicto `cuadra` lo da `veredictoEfectivo` (`extractoSesion.ts:299-307`) también cuando el usuario ya ha **creado** la línea desde la ficha, la ha **asignado**, o la ha marcado efectivo/traspaso: ahí no hay previsto y sale el texto inventado.
- **Qué se hace**: `grep "un previsto" → 0`. Con previsto o confirmado de verdad, se dice cuál (como hoy). Sin ellos: si la línea está creada desde la ficha / clasificada, se dice **su clasificación real** (`etiquetaDeClasificacion` · «Gasto · Suministro · Luz»); si no hay nada real que decir, **no se pone nada**.

### 4 · Textos que sobran
- **Dónde**: `PanelConciliar.tsx:80-83` `SIN_PROPUESTA` («No sé qué es · dímelo tú una vez» + «si subes la factura, la leo…»); `propuestaDeLinea.ts:113,127,157,160` las mismas frases; `TarjetaAccion.tsx:115` «· lo aplico a los N» en cada tarjeta; `:157-176` el desplegable «Son traspaso a · elige la cuenta…» siempre visible.
- **Qué se hace**: la banda de propuesta solo cuando ATLAS **dice algo real** (propone/confirma con motivo, «se recordará», o el aviso del IVA); la pregunta abierta se queda en el chip «¿Qué es?» y nada más. La ayuda («sube la factura…», el porqué) pasa a un icono ⓘ con el texto en `title`, no un párrafo. Fuera «lo aplico a los N» (el contador de la cabecera ya lo dice). «Es un traspaso a …» pasa a ser una opción del selector de destino (punto 2), no un bloque.

### 5 · Colores contra la guía §2.2.1
- **Dónde**: los importes de la cabecera de entidad van en tinta (`.entMonto` `--atlas-v5-ink` · `MoneyValue tone="ink"`), pero **dentro** del desplegable de Zona 3 `.dentroN` (`PanelConciliar.module.css`) es `--atlas-v5-ink-3` (apagado) y en las filas plegadas `.filaN` también `ink-3`. El contador «12 recibos» `.entCount` es `ink-4` sobre `card-alt` (más apagado que el `Pill gris` del DS). El chip «¿Qué es?» ya es `Pill gold asTag` (`gold-wash` / `gold-ink`).
- **Qué se hace**: `.dentroN` y `.filaN` → `--atlas-v5-ink`. El contador → `Pill variant="gris"` del DS (`ink-3` sobre `card-alt`, borde `line-2`). Se repasa que en `conciliar/` no quede ningún `--atlas-v5-pos/neg` en importes (hoy solo en estado: icono de bloque, pie «No cuadra», aviso de error) y ningún fondo `warn-wash` salvo el aviso de error. Se quita el `.bancoOk` verde y el `.bancoAviso` ámbar (punto 1).

### 6 · El header por familias miente
- **Dónde**: `agruparPorEntidad.ts` `resumenDelFlujo` saca las 3 familias gordas de lo que tenga familia, aunque sea el 5 % del dinero; `HeroConciliar.tsx` pinta «nada todavía» cuando no hay familias. Con una clasificación floja sale «Supermercado −19.048» como lo gordo.
- **Qué se hace**: el desglose por familias solo se enseña cuando es **fiable**: al menos el 80 % del dinero de ese lado tiene familia. Si no, solo **Entró total / Salió total**. Fuera «nada todavía»: un lado sin movimientos enseña 0 €.

## Fuera de alcance
La clasificación de fondo (por qué CARREFOUR va a «¿qué piso?», WIZINK, CANCELAC…) · el cálculo del saldo/apertura · agrupar la TGSS en una entidad.

## Verificación prevista
Sin banda ámbar de saldo (grep `warn-wash` en `CuadreBanco.module.css` → 0) · destino de piso = selector, no N botones (grep de los botones por piso → 0) · `grep "un previsto"` → 0 · textos de ayuda mínimos · importes en tinta (`grep ink-3` en `.dentroN/.filaN` → 0) · sin verde/rojo en importes · tsc, build, trinquete igual que `main`, suite sin rojas nuevas · tests de `CuadreConElBanco`, `PanelConciliar` y `corregirYEnBloque` adaptados.
