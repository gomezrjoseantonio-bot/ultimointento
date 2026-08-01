# STOP-REPORT · TESORERÍA V6 · verificaciones de la adenda 01

**Fecha:** 1 agosto 2026
**Adenda:** `docs/ADENDA-01-TESORERIA-respuestas-fase0.md`
**Estado:** 🟡 **parcial** · gate D3 entregado · **gates D1 e D6 paran y reportan**

La adenda abre tres verificaciones antes de tocar nada, dos de ellas con "para y reporta"
explícito. Las tres están hechas. **Una sale bien y dos disparan el stop.**

---

## Gate D3 · mapeo de catálogos · ✅ ENTREGADO

`src/services/catalogoPresentacionPersistencia.ts` + su candado en
`src/services/__tests__/catalogoPresentacionPersistencia.test.ts` (8 tests, en verde).

Cumple las cuatro condiciones no negociables:

1. **Un solo fichero**, declarado tabla de traducción, no tercer catálogo. Las cabeceras de los
   otros dos están corregidas: `categoryCatalog.ts` dice ser fuente única de **persistencia**
   (`categoryKey` · casilla AEAT · store), `tiposDeGastoInmueble.ts` y `tiposDeGastoPersonal.ts`
   dicen ser fuente única de **presentación** (familia → concepto).
2. **Nada adivinado.** 38 entradas: 32 conceptos de inmueble + 6 familias personales. **25
   traducidas, 13 marcadas `PENDIENTE-JOSE`** con el motivo escrito. Una entrada pendiente lleva
   `categoryKey: null` y el test impide que alguien le ponga una key sin resolver la duda.
3. **Financiación fuera** del selector de familia de §4.5, y Traspaso también: se resuelven con el
   tipo (`Transferencia`) y con selector de préstamo propio, no con categoría.
4. La unificación real queda para tarea aparte.

El test también cierra la puerta a la deriva: falla si alguien añade un concepto al catálogo de
presentación y no lo traduce, o si traduce a una `categoryKey`/`subtypeKey` que no existe.

### Los 13 `PENDIENTE-JOSE`

Ninguno tiene destino evidente y todos tocan casilla AEAT, así que ninguno se inventa.

| Concepto | La duda |
|---|---|
| `tributos:licencia_turistica` | No hay key propia. `otros_inmueble` no lleva casilla; IBI y basuras van a 0115. Si es tributo local deducible, 0115 — pero eso se decide, no se supone |
| `tributos:otros` | Cuelga de Tributos (apunta a 0115) pero su `categoria` de presentación es `inmueble.otros` (sin casilla) |
| `comunidad:derrama` | **La de más impacto.** Una derrama es gasto deducible (0109/0106) o **mejora capitalizable** (`mejora_inmueble`, que amortiza en vez de deducir) según su naturaleza. Puede que haya que preguntarlo por movimiento en lugar de fijarlo en la tabla |
| `suministros:telefonia` | `SUMINISTRO_SUBTYPES` solo tiene luz/agua/gas/internet. O se añade `telefonia`, o se colapsa en `internet` perdiendo el detalle |
| `suministros:alarma` | Mismo hueco, y además dudoso que sea suministro (0113) y no servicio contratado (0108) |
| `seguros:vida` | Suele ir vinculado a la hipoteca, no al arrendamiento. Meterlo en `seguro_inmueble` (0114) lo declara como gasto del alquiler, que puede no proceder |
| `gestion:comision_plataformas` | Comisión de Booking/Airbnb. ¿0108 o casilla de comercialización? En turístico puede diferir del residencial |
| `reparacion:limpieza` | Es servicio (0108), no reparación (0106), pero vive bajo la familia Reparación con `categoria: inmueble.opex` |
| `reparacion:limpieza_zonas_comunes` | Igual, y además podría ser gasto de comunidad (0109) si lo factura la comunidad |
| `reparacion:limpieza_por_estancia` | Igual · propio de turístico |
| `reparacion:ropa_cama_lavanderia` | Servicio (0108) o consumible; si se considera enseres iría a `mobiliario_inmueble` (0117, **amortizable**) — tratamiento distinto |
| `reparacion:consumibles_bienvenida` | Consumible de turístico · `servicio_inmueble` u `otros_inmueble` |
| `personal:suministros` | No existe `gasto_personal_suministros`. El label de `gasto_personal_vivienda` ya dice "…alquiler · suministros · IBI · seguros", así que el colapso parece la intención — pero presentación los separa. Confirmar que es querido y no una key que falta |

Hay un patrón detrás de siete de ellos: la familia **Reparación y conservación** del catálogo de
presentación mezcla reparaciones reales (0106) con servicios recurrentes de explotación turística
(limpieza, lavandería, consumibles). Si eso se separa en el catálogo de presentación, cinco
pendientes se resuelven solos. Lo dejo apuntado; no lo toco.

---

## Gate D1 · ignorar líneas de extracto · ⛔ PARA

**La respuesta a lo que pediste verificar es NO.** El mecanismo de hash que ya existe no sirve para
que una línea ignorada no reaparezca. Lo que hay, exactamente:

| Mecanismo | Dónde | Qué hace | ¿Sirve? |
|---|---|---|---|
| `hashMovement` | `bankStatementOrchestrator.ts:421` | `accountId\|date\|amount-cents\|description` contra los `movements` **ya persistidos**; si coincide, no reinserta | **No.** Compara contra movimientos *materializados* |
| `generateBatchHash` / `checkBatchHashExists` | `utils/batchHashUtils.ts` | SHA-256 del fichero entero → idempotencia a nivel de fichero | **No**, y además ver abajo |
| `generateMovementHash` / `detectDuplicates` | `utils/duplicateDetection.ts` | Hash por línea, pero solo detecta duplicados **dentro del mismo array parseado** | **No.** No persiste nada |

El motivo es estructural, no un descuido: por D4, una línea ignorada **no se materializa**. No hay
`Movement` que la represente, así que `hashMovement` no tiene contra qué comparar y la línea vuelve
a aparecer como nueva en la siguiente importación del mismo extracto.

**Además, dos cosas que conviene que sepas** (las encontré verificando, no las toco):

- **`hashLote` no se calcula.** `bankStatementOrchestrator.ts:321` escribe `hashLote: ''` con el
  comentario *"hashing of raw bytes is out of scope for T17; T18 will tighten this"*. La
  idempotencia por fichero **no está activa** en este camino: reimportar el mismo extracto no se
  bloquea, solo se salvan las líneas por `hashMovement`.
- **Hay dos caminos de importación.** `treasuryApiService.ts:563` sí llama a `generateBatchHash` +
  `checkBatchHashExists`; el orquestador no. Conviene decidir cuál sobrevive en V6 antes de
  construir el drawer de §4.7 sobre uno de los dos.

No invento nada ni meto el estado en `keyval`, como pediste. Las salidas que veo, sin recomendar
ninguna con fuerza porque todas tienen coste:

1. **Activar `hashLote`** (llamar a `generateBatchHash` y comprobarlo antes de importar). Resuelve
   el caso "reimporto el mismo fichero" sin campos nuevos, que es probablemente el 90% real. **No**
   resuelve que la misma línea llegue en un fichero distinto con periodo solapado.
2. **Persistir la línea ignorada como `Movement`** con marca de ignorada. Le da hash y la hace
   idempotente, pero contradice D4 ("lo que quedó sin resolver no se materializa") y ensucia la
   lista de la cuenta salvo que se filtre en todas partes.
3. **Campo en `ImportBatch`** (`lineasIgnoradas: string[]` con el hash de línea). Es donde
   conceptualmente vive —el ignorado es de la sesión de importación, como dijiste en D4— y no
   toca `movements`. Cuesta un bump (v85) o aprovechar el mismo de v84.

Mi lectura, si sirve: la 3 es la coherente con D4, y si va con el bump de v84 el coste marginal es
casi cero. Pero es campo nuevo y no lo añado sin que lo digas.

---

## Gate D6 · retirar `/conciliacion` · ⛔ PARA

Hecha la tabla. **Casi todo tiene destino, pero dos funciones no lo tienen**, y la regla que
escribiste es explícita: si alguna no tiene destino, para y reporta.

### Función → dónde queda en V6

| Función de `/conciliacion` | Destino en V6 |
|---|---|
| KPIs del mes (`KpiRow`) | §4.4 KPIs del drawer de cuenta · §4.1 hero |
| Filtros de 3 ejes + persistencia en `localStorage` (`FiltersBar`) | §4.4 pestaña "Todo {mes}": buscador + ejes Fecha/Inmueble/Qué es |
| Agrupación por día con subtotales (`DayGroup`/`DayHeader`) | §4.4 tarjetas por día con subtotal en cabecera |
| Fila de movimiento · confirmar / editar / borrar (`MovementRow`) | §4.4 círculo · lápiz · ✕ |
| Anidamiento piso → habitación (`ParentRentRow`) | §4.4 subcabecera de piso + habitación debajo |
| Alta de movimiento (`AddMovementModal`) | §4.5 ficha única |
| Edición (`EditMovementModal`) | §4.5 |
| Confirmación de borrado (`DeleteConfirmDialog`) | §4.5 pie · Eliminar |
| Check de conciliado (`CheckCircle`) | Ya compartido · canónico desde P5 (#1502) |
| **Adjuntar factura / justificante al movimiento** (`DocSlot`, `DocumentPickerPopover`, `DocIcon`) | **NINGUNO** |
| **Regenerar la previsión del mes** (`regenerateMonthForecast`) | **NINGUNO** |

### 1 · Documentación del movimiento · sin destino

`DocSlot` y `DocumentPickerPopover` son **los únicos escritores de UI** de
`attachDocumentToEvent` / `detachDocumentFromEvent` / `setDocumentNoAplica`, que persisten
`TreasuryEvent.facturaId` · `facturaNoAplica` · `justificanteId` · `justificanteNoAplica` (mismos
campos en `Movement`).

Y §4.5 dice, literal: *"**NO hay campo de documento.** La factura vive en el Archivo y se enlaza
desde allí."* Así que V6 no tiene dónde ponerlo — por diseño, no por olvido.

Lo que hace que no sea un "pues se quita y ya": **los campos siguen leyéndose**.
`services/lineasInmuebleService.ts:44-47,122-128` los propaga desde las líneas del inmueble hacia
eventos y movimientos, y `pages/GestionInmuebles/tabs/sections/EjecucionesRecurrentesSection.tsx`
los consume. O sea que retirar `/conciliacion` no deja el dato muerto, pero **sí elimina la única
forma de adjuntar un justificante desde el lado de tesorería**, dejando solo la del inmueble.

Tres salidas, ninguna obvia: (a) se acepta la pérdida y adjuntar pasa a ser cosa del Archivo y del
inmueble — coherente con §4.5, pero es una funcionalidad menos; (b) la ficha de §4.5 gana un
enlace al Archivo, que es media contradicción con "no hay campo de documento"; (c) se retrasa la
retirada de `/conciliacion` a una tarea posterior que resuelva primero el enlace desde el Archivo.

### 2 · Regenerar previsión del mes · sin destino

`ConciliacionPageV2:116` es **el único punto de la aplicación entera** que llama a
`regenerateMonthForecast()` (`treasuryForecastService`). Verificado: no hay otro llamador en UI.

Si `/conciliacion` se retira tal cual, esa capacidad **desaparece del producto**. Y aquí hay una
tensión con la propia tarea: §3 dice "no tocar el motor de previsiones", pero retirar su único
disparador de usuario es dejarlo sin manivela. En §4 no aparece ningún equivalente.

Hace falta decidir si V6 se lleva el botón (y a dónde: ¿cabecera del drawer de cuenta? ¿drawer de
calendario?) o si se acepta perderlo.

### Lo demás está listo

Verificado que **ningún** componente de `conciliacion/v2` se usa fuera del módulo, salvo
`AddMovementModal`, que importan `MovimientosTab` y `VistaCuentaPage` — y esos dos los sustituye
V6 de todas formas. Retirar el resto no rompe nada externo.

Hay además un acceso directo que hay que redirigir: **`modules/panel/components/AccionesRapidas.tsx:39`**,
botón "Conciliar banco · cuadra tus movimientos" del Panel, navega a `/conciliacion`. Con la
retirada pasa a `/tesoreria` (o al drawer de extracto, si prefieres que el atajo siga siendo
"conciliar" y no "abrir tesorería").

---

## Qué necesito

1. **D1** · ¿cuál de las tres salidas para la línea ignorada? (la 3, campo en `ImportBatch`, es la
   que encaja con D4 · y si va con el bump de v84 apenas cuesta)
2. **D1 bis** · ¿se activa `hashLote`? ¿y cuál de los dos caminos de importación sobrevive?
3. **D6a** · documentación del movimiento: ¿se acepta perderla, se enlaza al Archivo, o se retrasa
   la retirada?
4. **D6b** · regenerar previsión: ¿se lleva el botón a V6 (¿dónde?) o se acepta perderlo?
5. **D3** · los 13 `PENDIENTE-JOSE` de arriba, uno a uno.

Con 1–4 sigo con la implementación. El 5 no bloquea el resto de §4: la tabla ya impide guardar un
`categoryKey` inventado, así que se puede construir la ficha y resolver los pendientes después.
