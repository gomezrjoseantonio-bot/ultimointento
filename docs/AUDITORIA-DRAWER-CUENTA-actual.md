# AUDITORÍA · Drawer lateral de cuenta (Tesorería) · estado actual

> **Tipo** · Solo lectura · cero cambios de código · cero cambios de `DB_VERSION`
> **Repo** · gomezrjoseantonio-bot/ultimointento · rama de auditoría `claude/auditoria-drawer-cuenta-1s7ewn`
> **Commit auditado** · `d3daaae` — "feat(tesoreria): rediseño V9 de la pantalla /tesoreria (6 fases) (#1755)" (HEAD de `main` al abrir la rama)
> **DB** · `DB_VERSION = 89` confirmado en `src/services/db.ts:56` (la memoria decía v89 · correcto) · `DB_NAME = 'AtlasHorizonDB'` (`src/services/db.ts:55`)
> **Fecha** · 2026-08-19

Objetivo: fotografiar el drawer que se abre al entrar en una cuenta desde Tesorería (el del punteo), para convertir su **contenedor** de panel lateral derecho a desplegable horizontal bajo la fila de la cuenta, **sin tocar contenido ni lógica**.

---

## 1 · Identidad y apertura

### 1.1 Componente

- **`DrawerCuenta`** · `src/modules/tesoreria/v6/DrawerCuenta.tsx:83` (declaración) · export default en `:449`. Props en la interfaz `DrawerCuentaProps` (`DrawerCuenta.tsx:42-79`).
- Se instancia **dos veces** desde la página, siempre montado (se auto-oculta con `cuenta: null`):
  - Escritorio: `src/modules/tesoreria/v6/TesoreriaV6Page.tsx:921-940`.
  - Móvil (≤760px · `useEsMovil.ts:12` `ANCHO_MOVIL = 760`): `TesoreriaV6Page.tsx:811-831` — **el mismo componente compartido**, sobre `TesoreriaMovil`.

### 1.2 Cómo se abre

- Clic en la **fila** de la tabla "Mis cuentas": `<tr onClick={() => onAbrir(f.cuenta)}>` en `src/modules/tesoreria/v6/TablaCuentas.tsx:162-172` (con soporte de teclado Enter/espacio en `:167-172`). También desde el menú "⋯" de la fila, opción "Confirmar movimientos" (`TablaCuentas.tsx:224`).
- La página cablea `onAbrir={(c) => abrirCuenta(c.id!)}` (`TesoreriaV6Page.tsx:884`).
- **El estado abierto/cerrado vive en la URL, no en un `useState`**: `abrirCuenta` hace `navigate('/tesoreria/cuenta/${id}')` (`TesoreriaV6Page.tsx:133`); `cuentaAbierta` se deriva del param de ruta (`TesoreriaV6Page.tsx:107, 129-132`); `cerrarCuenta` navega a `/tesoreria` con `replace: true` para que el botón atrás no reabra (`TesoreriaV6Page.tsx:135-141`). La ruta es `tesoreria/cuenta/:accountId` en `src/App.tsx:944-948`. Comportamiento fijado por tests: `src/modules/tesoreria/v6/__tests__/TesoreriaV6Page.test.tsx:315-349`.
- Dentro del drawer, `abierto = cuenta != null` (`DrawerCuenta.tsx:110`) y si `cuenta == null` devuelve `null` (`DrawerCuenta.tsx:218`).

### 1.3 Props que recibe (cableado en `TesoreriaV6Page.tsx:921-940`)

| Prop | Valor que le pasa la página | Evidencia |
|---|---|---|
| `cuenta` | `cuentasVivas.find(c => c.id === cuentaAbierta) ?? null` | `TesoreriaV6Page.tsx:922` |
| `saldoHoy` | `saldoPorCuenta.get(cuentaAbierta) ?? 0` | `TesoreriaV6Page.tsx:923` |
| `eventos` / `movimientos` | Los **de esa cuenta** (reparto previo `porCuenta`) | `TesoreriaV6Page.tsx:924-925` (mapa en `:311-326`) |
| `year` / `month0` / `hoy` | Mes en curso y hoy en fecha local | `TesoreriaV6Page.tsx:926-928` (origen `:174-177`, `hoyISO` `:89`) |
| Callbacks de motor | `onConfirmar/onDescartar/onDespuntear/onGuardarFicha/onEliminar` | `TesoreriaV6Page.tsx:930-934` |
| Contexto para la ficha | `cuentas`, `inmuebles`, `tarjetas` (elegibles), `aliasInmueble` | `TesoreriaV6Page.tsx:935-938` |
| `onSubirExtracto` | `(c) => setExtracto({ cuenta: c })` | `TesoreriaV6Page.tsx:939` |
| `onAbrirDocumento` | Solo en la rama móvil se pasa hoy: `navigate('/archivo?doc=${id}')` (`TesoreriaV6Page.tsx:825`); en la rama escritorio **no se pasa** (el prop es opcional, `DrawerCuenta.tsx:53`) | — |

### 1.4 Cómo se renderiza como panel lateral (lo único que se va a cambiar)

- **Sin portal**: JSX inline en el árbol de la página — un fragmento con backdrop + `<aside>` (`DrawerCuenta.tsx:224-235`).
- **Backdrop**: `<div className={styles.back}>` con clic-para-cerrar (`DrawerCuenta.tsx:225-229`); CSS `.back` `position: fixed; inset: 0; z-index: 80` con fundido de opacidad (`src/modules/tesoreria/v6/DrawerV6.module.css:6-18`).
- **Panel**: `<aside className={styles.drw}>` con `role="dialog"` y `aria-modal="true"` (`DrawerCuenta.tsx:230-235`); CSS `.drw` `position: fixed; top: 0; right: 0; height: 100vh; width: 580px; max-width: 100vw; z-index: 81; transform: translateX(100%)` y `.drwOpen { transform: translateX(0) }` con transición de 0.24s (`DrawerV6.module.css:20-35`). Sombra `--atlas-v5-shadow-drawer` (`DrawerV6.module.css:33`).
- Layout interno: columna flex a 100vh — cabecera `.hd` y fila de controles `.controles` con `flex-shrink: 0` (`DrawerV6.module.css:39-44, 127-135`) y cuerpo `.body` con `flex: 1; overflow-y: auto` (**scroll propio**, `DrawerV6.module.css:179-183`).
- ⚠️ El CSS `DrawerV6.module.css` es un **chasis compartido**: lo importan también `DrawerTarjeta.tsx:27`, `DrawerExtracto.tsx:50` y `DrawerCalendario.tsx:34` (los dos últimos con el alias `chasis`). Ver §7.

---

## 2 · Cabecera (4 KPIs)

Render en `DrawerCuenta.tsx:248-253` con el subcomponente `Ak` (`DrawerCuenta.tsx:442-447`); estilos `.kpis/.ak/.akl/.akv/.akvGold` en `DrawerV6.module.css:89-123`.

| KPI (rótulo literal) | Fuente | Evidencia |
|---|---|---|
| **"Saldo hoy"** | Prop `saldoHoy` — saldo vivo de la cuenta: `calculateAccountBalanceAtDate` con corte `corteParaSaldoVivo(hoy)` e `incluirRealesFuturos: true`, calculado en la página | rótulo `DrawerCuenta.tsx:249` · cálculo `TesoreriaV6Page.tsx:328-347` · servicio `src/services/accountBalanceService.ts` (import `TesoreriaV6Page.tsx:19`) |
| **"Queda entrar"** | `cierrePorCuenta(...).entra` — suma de pendientes vivos positivos del mes | `DrawerCuenta.tsx:118-121, 250` · `src/services/tesoreriaV6Metrics.ts:331-354` |
| **"Queda salir"** | `cierrePorCuenta(...).sale` — suma de pendientes vivos negativos del mes | `DrawerCuenta.tsx:251` · `tesoreriaV6Metrics.ts:340-347` |
| **"Saldo final"** | `cierrePorCuenta(...).cierre = saldoHoy + entra + sale` — pintado en oro (`gold`) | `DrawerCuenta.tsx:252` · `tesoreriaV6Metrics.ts:352` |

- **Término real confirmado**: el rótulo en pantalla es **"Saldo final"** (`DrawerCuenta.tsx:252`). El campo canónico del servicio se llama `cierre` (`CierreProyectado.cierre`, `tesoreriaV6Metrics.ts:311-318`) y la variable local del drawer `kpis.final` (`DrawerCuenta.tsx:120`). "Cierre" es vocabulario interno/de otras vistas (tabla, hero); la cabecera del drawer dice "Saldo final".
- Definición de "pendiente que cuenta": `pendienteDelMes` = `esPendiente(e)` (no descartado, no pieza `gasto_tarjeta`, status `predicted|confirmed`) + no traspaso interno + `predictedDate` dentro del mes (`tesoreriaV6Metrics.ts:64-72, 86-87`). Es **la misma función** que usa el hero y la tabla, por lo que el "Saldo final" del drawer cuadra con el "Cierre" de la fila por construcción (comentario en `tesoreriaV6Metrics.ts:320-330` y `DrawerCuenta.tsx:113-121`).
- Los KPIs se recalculan en vivo con `useMemo` sobre `eventos/saldoHoy/year/month0` (`DrawerCuenta.tsx:118-121`); tras cada acción la página recarga estado (`trasEscribir`, `TesoreriaV6Page.tsx:425-428`).

---

## 3 · Pestañas

Estado local `pestana: 'pendientes' | 'confirmados' | 'todo'` (`DrawerCuenta.tsx:81, 104`); botones en una sola fila de controles junto a las acciones (`DrawerCuenta.tsx:257-301`); estilos `.tab/.tabOn` (`DrawerV6.module.css:137-152`). Las tres renderizan el **mismo componente compartido** `PunteoList` (`src/modules/shared/components/Punteo/PunteoList.tsx`) con props distintas — el modelo de estados es único (`src/services/punteo/punteoModel.ts`).

### 3.1 "Por confirmar" (`pestana === 'pendientes'`)

- Datos: `itemsPendientes` (`DrawerCuenta.tsx:151-166`) — **solo `treasuryEvents`** con `esPendiente(e) && e.status === 'predicted'` y **`predictedDate <= hoy`** (vencidos; sin tope de mes — un recibo de hace dos meses sin confirmar sigue saliendo), con guarda contra fecha vacía (`:159-162`). Orden fecha descendente (`:164`).
- Render: `PunteoList` con `rowVariant="tesoreria"` (acciones en fila), `sinOrigen`, `ocultarCuenta`, sin chips (`DrawerCuenta.tsx:315-329`). Estado vacío "Nada por confirmar · esta cuenta está al día" (`DrawerCuenta.tsx:305-313`).
- Es la única pestaña con los botones "+ Anotar" y "Subir extracto" (`DrawerCuenta.tsx:286-300`).

### 3.2 "Confirmados" (`pestana === 'confirmados'`)

- Datos: `itemsConfirmados` (`DrawerCuenta.tsx:181-198`) — mezcla del **mes**:
  - eventos `!e.descartado && e.status === 'confirmed'` (decididos, esperando al banco) (`:183-187`), y
  - movimientos del mes (sin `isOpeningBalance`, sin `gastoTarjetaCredito`) cuyo estado derivado es `'confirmado'` — es decir, `source !== 'import'` (`:188-196`; derivación `estadoDeMovimiento`, `punteoModel.ts:60-62`).
- Función: poder **despuntear** — `onDespuntear` solo se pasa aquí (`DrawerCuenta.tsx:360`). Vacío explicativo en `:333-341`.

### 3.3 "Movimientos" (`pestana === 'todo'`)

- Datos: `itemsTodo` (`DrawerCuenta.tsx:201-216`) — previsión + realidad del mes: eventos `!descartado && status !== 'executed'` (los `executed` viven ya como Movement, contarlos duplicaría) + movimientos del mes (mismos filtros de opening/tarjeta crédito).
- Render: **solo lectura** (`soloLectura`), con leyenda de estados (`conLeyenda`), buscador, selector de eje y grupos plegables con subtotal (`DrawerCuenta.tsx:371-399`).

Los movimientos con `gastoTarjetaCredito` se excluyen en Confirmados y Movimientos (viven en el cajón de la tarjeta, `DrawerCuenta.tsx:191-193, 211-212`).

---

## 4 · Pestaña Movimientos · buscador, agrupación y estados

### 4.1 Buscador

- Estado `busqueda` en el drawer (`DrawerCuenta.tsx:107`) pasado a `PunteoList` (`DrawerCuenta.tsx:394-395`); input en `PunteoList.tsx:623-631`.
- Campos sobre los que busca — `filtrarPorBusqueda` (`src/modules/shared/components/Punteo/punteoAgrupacion.ts:268-277`):
  1. `concepto` (título de la fila),
  2. `activo.alias` (nombre del inmueble),
  3. `origen` (la etiqueta de tipo: "Suministro", "Financiación"…),
  4. **importe** (`matchesAmountQuery`), con normalización de acentos/mayúsculas (`normalizeSearchText`) — ambos de `src/utils/tesoreriaSearch`.
- Al buscar, los grupos plegados se abren (`PunteoList.tsx:525`).

### 4.2 Los tres ejes de agrupación "Fecha · Ámbito · Tipo"

- Selector: `EJES = ['fecha', 'inmueble', 'que-es']` (`PunteoList.tsx:47`), pintado solo si llega `onEjeChange` (`PunteoList.tsx:633-648`). El drawer guarda el eje en `useState<EjeAgrupacion>('fecha')` (`DrawerCuenta.tsx:108`).
- **Rótulos**: `EJE_LABEL` (`punteoAgrupacion.ts:38-43`) — la clave interna `inmueble` se rotula **"Ámbito"** y `que-es` se rotula **"Tipo"** (razonado en `:27-37`). Existe un cuarto eje `cuenta` que usa el drawer del día, no este (`punteoAgrupacion.ts:182-229`).
- Agrupación — `agruparPorEje` (`punteoAgrupacion.ts:150-262`):
  - **Fecha**: agrupa por `it.fecha` (día), grupos descendentes, orden interno canónico del día `compararEnDia` (ingresos→gastos, |importe| desc, `punteoModel.ts:210-217`) (`punteoAgrupacion.ts:155-166`).
  - **Ámbito** (`inmueble`): clave `it.activo.inmuebleId` con título el alias del inmueble (o "Sin nombre"); los ítems sin inmueble caen en el grupo **"Personal"** (`punteoAgrupacion.ts:231-241`). Grupos alfabéticos, dentro fecha descendente (`:251-261`).
  - **Tipo** (`que-es`): clave/título `it.origen` (`punteoAgrupacion.ts:241`), que se deriva en el adaptador:
    - Eventos — `origenDeEvento` (`src/services/punteo/punteoAdapter.ts:25-66`): `Financiación` (prestamo/hipoteca), `Ingreso` (nomina/otros_ingresos), `Alquiler` (contrato), `Comisión`, `Suministro`/`Recibo` (gasto recurrente, según categoryKey), `Autónomo`, `Inversión`, y por defecto `Ingreso`/`Gasto` según `type`.
    - Movimientos — `origenDeMovimiento` (`punteoAdapter.ts:80-89`): `Transferencia`, o el label del catálogo (`categoryKey`), o `Ingreso`/`Gasto`.
- Subtotal por grupo: `construirGrupo` calcula `totalIngresos`, `totalGastos` y `subtotal` con signo (`punteoAgrupacion.ts:79-96`); en Movimientos (`gruposPlegables`) la cabecera pinta el **subtotal único** (`PunteoList.tsx:568-572`).

### 4.3 Los tres estados "Por confirmar / Confirmado / Conciliado"

Definición exacta (modelo canónico, `src/services/punteo/punteoModel.ts`):

- `EstadoPunteo = 'previsto' | 'confirmado' | 'conciliado'` (`punteoModel.ts:29`).
- **Por confirmar** = clave interna `previsto` = `TreasuryEvent.status === 'predicted'` (`estadoDeEvento`, `punteoModel.ts:51-53`). El rótulo de pantalla "Por confirmar" viene de `ESTADO_LABEL` (`punteoModel.ts:44-48`).
- **Confirmado** = realidad **sin** evidencia de extracto: evento `status === 'confirmed'` o `Movement` con `source !== 'import'` (punteo manual, alta a mano, inbox) — "tu palabra" (`punteoModel.ts:51-62` y cabecera `:9-18`).
- **Conciliado** = realidad **con** evidencia de extracto: `Movement.source === 'import'` — "la palabra del banco" (`estadoDeMovimiento`, `punteoModel.ts:60-62`).

Cómo se combinan como filtro en ESTE drawer — matiz importante:

- El sistema de chips-filtro por estado existe en el modelo (`ChipEstado`, `filtrarPorChip`, `chipsVisibles` — `punteoModel.ts:269-296`) y en `PunteoList` (`PunteoList.tsx:654-681`), **pero está desactivado en las tres pestañas del drawer**: se pasa `chip="todos"` y `mostrarChips={false}` en las tres llamadas (`DrawerCuenta.tsx:317-319, 345-347, 387-389`).
- En "Movimientos" los tres estados se muestran como **leyenda** una vez para toda la lista (`conLeyenda`, `DrawerCuenta.tsx:377`; `LeyendaEstados`, `src/modules/shared/components/Punteo/PunteoPiezas.tsx:185-205`) y por el **color del círculo** de cada fila (previsto = hueco discontinuo oro, confirmado = navy, conciliado = verde — clases `.tickPrevisto/.tickConfirmado/.tickConciliado`, `PunteoPiezas.tsx:48-53`; chip textual `EstadoChip` solo donde se pide, `PunteoPiezas.tsx:30-38`). No son botones de filtro en esta vista.

---

## 5 · Fila de movimiento y acciones

### 5.1 Anatomía de la fila

Render `renderFila` (`PunteoList.tsx:286-420`); rejilla CSS en `src/modules/shared/components/Punteo/Punteo.module.css:121-155` — en el drawer (con `sinOrigen` + `ocultarCuenta`) aplica `.rowMinima`: `22px (círculo) | 1fr (concepto) | 110px (importe) | auto (acciones)` (`Punteo.module.css:144-149`; selección de clase en `PunteoList.tsx:253-272`).

1. **"Checkbox" de confirmar** — en realidad un **círculo-interruptor a la izquierda**, `PunteoCheck` (`PunteoPiezas.tsx:40-102`): en `previsto` puntea (`onPuntear`), en `confirmado` despuntea (`onDespuntear`, solo si la fila tiene `previsionId` — `PunteoList.tsx:310-318`), en `conciliado` es marca sin acción (lo afirma el banco).
2. **Concepto** — línea 1 (`PunteoList.tsx:319-340`): quién cobra/paga, derivado en el adaptador (`piezasDeFila`/`piezasDeMovimiento`, `punteoAdapter.ts:253-318, 452-515`).
3. **Subtítulo** — `Contexto` (`PunteoPiezas.tsx:134-174`): `detalle` (traducción ATLAS: "seguro hogar"…), inmueble con icono, y aviso de saldo si lo hay.
4. **Importe** — `renderImporte` (`PunteoList.tsx:274-284`): con signo, badge Δ de discrepancia y "previsto X" en gris si el real difiere.
5. **Editar (✏️) y descartar (✕)** — `rowActions`, solo en `rowVariant="tesoreria"` y no en solo-lectura (`PunteoList.tsx:366-403`): el lápiz solo si `it.editable` (`:376`), la ✕ solo si `estado === 'previsto'` (`:389`). Visibles al hover con puntero fino; siempre visibles en táctil (`Punteo.module.css:593-608`).

`editable` lo decide el adaptador: una previsión siempre; un movimiento solo si `esMovimientoEditable` (manual, sin `reference`, no pata de transferencia — `src/services/altaMovimientoService.ts:283-291`) o si es traspaso (`punteoAdapter.ts:537`).

### 5.2 Confirmar

- Cadena: círculo → `onConfirmar` → `confirmarItem` (`TesoreriaV6Page.tsx:508-514`, solo `kind === 'evento'`) → **`confirmTreasuryEvent(eventId)`** (`src/services/treasuryConfirmationService.ts:313`).
- Qué hace el motor: en una transacción sobre `treasuryEvents` + `movements` (+ store de línea de inmueble si aplica) **crea el `Movement`** con `reference: 'treasury_event:{id}'` y `source: 'manual'` (`treasuryConfirmationService.ts:283-286`), crea/reutiliza la línea en `gastosInmueble`/`mejorasInmueble`/`mueblesInmueble` (`:369-495`), y deja el evento en `status: 'executed'` con `executedMovementId`, `actualDate` y `actualAmount` (`:497-513`). Caso especial: amortización parcial de préstamo descuenta `principalVivo` (`:518-536`).

### 5.3 Despuntear (solo pestaña Confirmados)

- Cadena: círculo navy → `onDespuntear` → `despuntearItem` (`TesoreriaV6Page.tsx:530-545`; guarda: solo `kind === 'movimiento'` con `previsionId != null`) → **`revertTreasuryConfirmation(movementId)`** (`treasuryConfirmationService.ts:603`): borra el movimiento y devuelve el evento a `predicted` localizándolo por la huella `treasury_event:{id}` del `reference` (`:616-618`); las líneas de inmueble vinculadas se conservan marcadas como pendientes (`:629+`).

### 5.4 Editar (✏️) — y la fecha

- El lápiz abre **`FichaMovimiento`** (`setFicha({ item })`, `DrawerCuenta.tsx:328, 367`; render `:405-437`), un modal centrado **independiente del panel** (`FichaMovimiento.tsx:399-405`; CSS `.sheet` `position: fixed` centrado, 440px, `z-index: 91`, sobre overlay propio `z-index: 90` — `FichaMovimiento.module.css:8-35`; por encima del drawer, que va en z 80/81).
- La ficha **tiene campo Fecha** (`FichaMovimiento.tsx:513-518`, estado `:167`) y devuelve `GuardadoFicha` con `fecha` (`FichaMovimiento.tsx:47-82`).
- Guardar → `guardarFicha` (`TesoreriaV6Page.tsx:614-723`), que bifurca:
  - **Traspaso interno** → `editarTraspasoInterno` (las dos patas a la vez) (`TesoreriaV6Page.tsx:627-637`; servicio `src/services/traspasoInterno.ts`).
  - **Movimiento manual** → `editarMovimiento(id, {...fecha...})` (`TesoreriaV6Page.tsx:643-661`; `altaMovimientoService.ts:317`) — **sí permite cambiar la fecha**, y al recargar la fila se mueve a su nuevo día (la agrupación por día se deriva de `it.fecha` en cada render).
  - **Alta ("Anotar") o derrama-mejora** → `altaMovimiento` (`TesoreriaV6Page.tsx:662-698`; `altaMovimientoService.ts:98`), descartando antes la previsión origen si la mejora nació de un previsto (`:666-668`).
  - **Previsto (evento)** → `updateTreasuryEventFields` **solo con la clasificación** (`categoryKey`/`subtypeKey`/`inmuebleId`, `TesoreriaV6Page.tsx:706-710`) y a continuación **`confirmTreasuryEvent` con overrides** `{ amount, date: v.fecha, accountId, description }` (`TesoreriaV6Page.tsx:711-716`). Es decir: **editar un previsto desde este drawer lo CONFIRMA con la fecha real elegida** — el movimiento resultante nace en el nuevo día. No hay camino de UI en el drawer que cambie `predictedDate` sin confirmar, aunque el patch del servicio lo soporta (`TreasuryEventPatch.predictedDate`, `treasuryConfirmationService.ts:1287-1303`; guarda contra `executed` en `:1320-1322`).
- En edición la ficha muestra "Eliminar" (prop `onEliminar`, `DrawerCuenta.tsx:429-436`), cableado a `descartarItem` (`TesoreriaV6Page.tsx:934`).

### 5.5 Descartar (✕)

- Cadena: ✕ → `onNoPaso`/`onDescartar` → `descartarItem` (`TesoreriaV6Page.tsx:547-572`), que bifurca:
  - Pata de traspaso → `eliminarTraspasoInterno` (las dos patas) (`:552-556`).
  - Movimiento anotado a mano → `eliminarMovimiento` (**borrado real**, `altaMovimientoService.ts:357-361`) (`:560-564`).
  - Previsto → **`descartarPrevisto`** (`:565`; `src/services/treasuryDiscardService.ts:20-43`).
- **Sí, `descartado` existe ya**: `descartarPrevisto` marca `descartado: true` + `descartadoAt` (+ `motivoDescarte` opcional) sin borrar (`treasuryDiscardService.ts:36-42`). El campo está en el schema desde V84: `TreasuryEvent.descartado?: boolean` (`src/services/db/types-movimientos.ts:287-300`; historia en `src/services/db.ts:56`). Un descartado no aparece en pendientes ni en KPIs ni en el cierre (`tesoreriaV6Metrics.ts:64-66`). Es reversible por `recuperarPrevisto` (`treasuryDiscardService.ts:46-62`), aunque este drawer no cablea el deshacer.
- **No existe** ningún estado `cancelled`: `TreasuryEvent.status` es `'predicted' | 'confirmed' | 'executed'` (`types-movimientos.ts:286`). Grep de comprobación: `grep -rn "cancelled" src/services/db/ src/services/db.ts` → **0 resultados**.

### 5.6 Agrupación por día y subtotal

- Grupos por día: eje `fecha` (`punteoAgrupacion.ts:155-166`); cabecera del día con `fmtDia` — `toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })` capitalizado (`PunteoList.tsx:68-72`), y el aspecto "SÁBADO, 1 DE AGOSTO" lo pone el CSS `text-transform: uppercase` de `.dayName` (`Punteo.module.css:96-108`).
- Cada día es una **tarjeta** en el drawer (`enTarjetas`, `PunteoList.tsx:251-252`; `.diaCard`, `Punteo.module.css:70-88`).
- Subtotal del grupo: calculado en `construirGrupo` (`punteoAgrupacion.ts:85-95`, redondeo a 2 decimales). En cabecera (`PunteoList.tsx:568-579`): con `gruposPlegables` (pestaña Movimientos) un único subtotal con signo; sin plegar (Por confirmar) ingresos y gastos por separado (`totalIngresos`/`totalGastos`).

### 5.7 Botones "+ Anotar" y "Subir extracto"

- Viven en la fila de controles y **solo en la pestaña "Por confirmar"** (`DrawerCuenta.tsx:286-300`).
- **+ Anotar** → `setFicha({ item: null })` (`DrawerCuenta.tsx:289`): abre `FichaMovimiento` en modo alta con la cuenta del drawer prefijada (`DrawerCuenta.tsx:411-415`) → al guardar, `guardarFicha(null, v)` → `altaMovimiento` (`TesoreriaV6Page.tsx:682-695`).
- **Subir extracto** → `onSubirExtracto?.(cuenta)` (`DrawerCuenta.tsx:292-298`) → la página abre `DrawerExtracto` con la cuenta ya fijada: `setExtracto({ cuenta: c })` (`TesoreriaV6Page.tsx:939`, render `:1052-1062`). El extracto es otro drawer lateral independiente (mismo chasis CSS).

---

## 6 · Datos que le entran (resumen para el cambio de contenedor)

**Todo lo que el drawer sabe entra por props; no consulta ningún servicio de datos por dentro.**

- **Entrada** (`DrawerCuentaProps`, `DrawerCuenta.tsx:42-79`): `cuenta`, `saldoHoy` (ya calculado), `eventos` y `movimientos` **ya filtrados por cuenta**, `year/month0/hoy`, `aliasInmueble`, listas para la ficha (`cuentas/inmuebles/tarjetas`) y los callbacks de acción (`onConfirmar/onDescartar/onDespuntear/onGuardarFicha/onEliminar/onSubirExtracto/onAbrirDocumento/onCerrar`).
- **Dentro** el drawer solo importa **funciones puras**: `cierrePorCuenta`, `esPendiente`, `rangoDelMes` (`DrawerCuenta.tsx:35`; `tesoreriaV6Metrics.ts` es derivación pura sin IndexedDB, ver su cabecera `:5-7`) y los adaptadores `eventoAItem`/`movimientoAItem` (`DrawerCuenta.tsx:32`; `punteoAdapter.ts:6` "Derivación pura · sin tocar los stores"). Ni `initDB` ni ningún `db.get` aparecen en `DrawerCuenta.tsx` (verificable: `grep -n "initDB\|db\." src/modules/tesoreria/v6/DrawerCuenta.tsx` → sin accesos a IndexedDB).
- **Las escrituras** las hace la página: cada callback llama al servicio de motor y después `trasEscribir` → `invalidateCachedStores(['treasuryEvents','movements','accounts'])` + `recargar()` (`TesoreriaV6Page.tsx:425-428`), que relee todo de una vez (`recargar`, `TesoreriaV6Page.tsx:181-227`: `db.getAll` de `accounts`, `treasuryEvents`, `movements`, `properties`, + orden guardado + borradores de extracto que se filtran con `sinBorradores` en `:207`).
- Conclusión para la migración: **el contrato de datos es estable respecto al contenedor** — pasar el cuerpo a un desplegable bajo la fila no cambia ni una prop ni un servicio; solo cambia dónde se monta y su CSS.

---

## 7 · Reutilización / dependencias de presentación

### 7.1 ¿Cuerpo separado del contenedor?

**No como componente aparte, pero casi en la práctica.** La cabecera, la fila de pestañas+acciones y el cuerpo viven dentro del mismo `DrawerCuenta.tsx` y del mismo `<aside>` (`DrawerCuenta.tsx:230-402`); no existe un `<CuerpoCuenta>` extraíble. Ahora bien:

- El contenido "pesado" ya es compartido: las listas son `PunteoList`, que renderizan otras 3 vistas (`PunteoList.tsx:4-6`), y no sabe nada del panel.
- `FichaMovimiento` es un modal `position: fixed` centrado con overlay propio por **encima** del drawer (z 90/91 vs 80/81) (`FichaMovimiento.module.css:8-35`): funciona igual desde cualquier contenedor.
- El propio componente ya se renderiza en dos contextos (escritorio y móvil, `TesoreriaV6Page.tsx:811-831, 921-940`) sin cambiar nada.

### 7.2 Puntos donde la presentación lateral está acoplada al contenido (lo que habrá que tocar)

1. **Backdrop modal** — `<div styles.back>` con clic-cierra (`DrawerCuenta.tsx:225-229`) y CSS `position: fixed; inset: 0; z-index: 80` (`DrawerV6.module.css:6-18`).
2. **El `<aside>` lateral** — `styles.drw`/`drwOpen` (`DrawerCuenta.tsx:230-235`) y CSS `position: fixed; right: 0; height: 100vh; width: 580px; transform: translateX(...)` (`DrawerV6.module.css:20-35`).
3. **Semántica de diálogo modal** — `role="dialog"` + `aria-modal="true"` (`DrawerCuenta.tsx:232-233`): en un desplegable inline bajo la fila esa semántica deja de ser correcta (pasaría a ser una región expandida de la tabla).
4. **Scroll propio del cuerpo** — `.body { flex: 1; overflow-y: auto }` dentro de una columna a 100vh (`DrawerV6.module.css:179-183` con `.hd`/`.controles` en `flex-shrink: 0`, `:39-44, 127-135`): en horizontal, el alto ya no es la ventana y el scroll natural sería el de la página (o un max-height propio — decisión de diseño).
5. **Animación** — entrada por `translateX(100%)` + fundido del backdrop (`DrawerV6.module.css:29-35, 11-18`): pensada para panel lateral; un desplegable animaría altura/opacity.
6. **Botón cerrar (X) y apertura por URL** — `hdClose` (`DrawerCuenta.tsx:243-245`) y el patrón navegación = estado (`TesoreriaV6Page.tsx:129-141`, ruta `App.tsx:944`, tests `TesoreriaV6Page.test.tsx:315-349`): el deep-link `/tesoreria/cuenta/:id` y el comportamiento del botón atrás están pensados para "un panel abierto sobre la pantalla"; al pasar a fila desplegada hay que decidir si se conservan (nada lo impide, pero es un punto de contacto).
7. **Chasis CSS compartido** — `DrawerV6.module.css` lo consumen también `DrawerTarjeta.tsx:27`, `DrawerExtracto.tsx:50` y `DrawerCalendario.tsx:34`. `DrawerCuenta` usa exactamente las mismas clases (`.back/.drw/.hd/.kpis/.controles/.tab/.btnCmp/.body/.vacio`): **no se pueden editar esas clases sin mover a la vez los otros tres drawers**; el contenedor horizontal necesitará clases/módulo nuevos, dejando el chasis intacto para los demás.
8. **La rama móvil comparte este mismo drawer** (`TesoreriaV6Page.tsx:808-831`, comentario "§4.11 · los drawers de extracto y cuenta se comparten"): cambiar el contenedor en escritorio obliga a decidir qué se monta en móvil (donde el panel casi-pantalla-completa hoy funciona bien a propósito).
9. **Ancho fijo 580px** — la rejilla de fila `.rowMinima` (`Punteo.module.css:144-149`) está dimensionada para ese ancho; a ancho de tabla completa sigue funcionando (columnas fijas + `1fr`), pero es el único supuesto dimensional que el contenido hereda del contenedor.

### 7.3 Guía de diseño y design system

- La guía vinculante existe: `docs/audit-inputs/GUIA-DISENO-V5-atlas.md` (`:1` "GUÍA DE DISEÑO ATLAS · V5 … es de aplicación obligatoria").
- El drawer usa el design system **parcialmente**: importa `Icons` de `src/design-system/v5` (`DrawerCuenta.tsx:29`; también `PunteoList.tsx:20`, `PunteoPiezas.tsx:17`) y todo su CSS consume tokens `--atlas-v5-*` (p. ej. `--atlas-v5-brand`, `--atlas-v5-gold`, `--atlas-v5-overlay`, `--atlas-v5-shadow-drawer` — `DrawerV6.module.css:9, 27, 33, 40-41, 123, 169-171`). No usa componentes contenedores del DS (`CardV5` se usa en la página, `TesoreriaV6Page.tsx:911`, pero no dentro del drawer): el chasis es CSS module propio.
- Referencia de mockup citada en código: `docs/mockups/atlas-tesoreria-v6-escritorio.html` (`TesoreriaV6Page.tsx:5`).
- Tests que fijan el comportamiento actual del drawer: `src/modules/tesoreria/v6/__tests__/DrawerCuenta.test.tsx` y `TesoreriaV6Page.test.tsx:315-380`.

---

## Qué habría que tocar para pasarlo de vertical a horizontal desplegable bajo la fila

Solo diagnóstico (sin propuesta de implementación). Los puntos de presentación acoplados son exactamente estos:

1. **El par backdrop + `<aside>` fijo a la derecha** — `DrawerCuenta.tsx:224-235` y `DrawerV6.module.css:6-35`. Es el contenedor propiamente dicho: posición fija, ancho 580px, altura 100vh, z-index 80/81, animación `translateX`. Todo lo demás del componente (cabecera navy, KPIs, pestañas, listas, ficha) cuelga dentro sin más supuesto que "vivo en una columna con alto acotado".
2. **La semántica modal** — `role="dialog"`/`aria-modal` (`DrawerCuenta.tsx:232-233`) y el cierre por clic en backdrop (`:227`) y por X (`:243-245`).
3. **El scroll propio del cuerpo** — `.body` con `overflow-y: auto` y los `flex-shrink: 0` de cabecera/controles (`DrawerV6.module.css:39-44, 127-135, 179-183`), que presuponen alto = viewport.
4. **El punto de montaje** — hoy el drawer se monta como hermano de `TablaCuentas` al final de la página (`TesoreriaV6Page.tsx:921-940`); bajo la fila tendría que montarse dentro/junto a la fila de `TablaCuentas.tsx` (filas en `:161-172`), lo que mueve la relación página↔tabla↔drawer pero **no** las props ni los callbacks (§6).
5. **El contrato URL↔abierto** (`TesoreriaV6Page.tsx:129-141` + `App.tsx:944`) — compatible con un desplegable, pero es la pieza que decide "qué cuenta está expandida" y hay que reconectarla al nuevo contenedor (incluido el scroll hasta la fila en deep-link).
6. **CSS nuevo, no editado** — `DrawerV6.module.css` es chasis compartido de otros tres drawers (§7.2.7): el contenedor horizontal necesita módulo/clases propias; las clases internas de contenido (`.hd`, `.kpis`, `.controles`, `.tab`, `.btnCmp`, `.body`, `.vacio`) hoy viven en ese mismo fichero, así que habrá que decidir por cada una si se referencia igual o se duplica en el módulo nuevo.
7. **La rama móvil** (`TesoreriaV6Page.tsx:808-831`) — comparte el componente; hay que decidir si móvil conserva el panel actual o adopta el desplegable.

**Lo que NO hay que tocar** (y esta auditoría deja acreditado): datos de entrada y servicios (§6), KPIs y su cálculo (§2), pestañas y sus filtros (§3), buscador/ejes/estados (§4), anatomía de fila y acciones contra el motor (§5), `FichaMovimiento` (overlay independiente) y `PunteoList` (compartido por 4 vistas).

---

*Auditoría de solo lectura · ningún componente, servicio, store ni CSS modificado · `DB_VERSION = 89` sin cambios.*
