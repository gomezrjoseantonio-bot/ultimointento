# ADENDA 02 · TESORERÍA V6 · respuestas al stop-report de la adenda 01

**Fecha:** 1 agosto 2026
**Complementa a:** `TAREA-CC-TESORERIA-V5.md` (renombrada V6) + `ADENDA-01`
**El resto sigue vigente.**

> Informe aceptado. Los dos "para y reporta" estaban bien disparados, y los dos hallazgos
> colaterales (`hashLote` vacío y `regenerateMonthForecast` sin otro llamador) son de los que
> revientan en producción tres meses después. Bien visto.

---

## D1 · Línea ignorada → **campo en `ImportBatch`** · va con el bump v84

Aprobada la salida que encaja con D4: **el ignorado es de la sesión de importación, no del
movimiento**. Como la línea no se materializa, no hay `Movement` contra el que deduplicar, así que
el registro tiene que vivir donde vive el fichero.

En el mismo bump **v84**, junto a los campos de `TreasuryEvent`:

```ts
// ImportBatch
lineasIgnoradas?: Array<{
  hashLinea: string;      // hash de la línea del extracto (fecha+importe+concepto normalizado)
  ignoradaAt: string;     // ISO
}>;
```

**Reglas:**
- Al reimportar un extracto, las líneas cuyo `hashLinea` figure como ignorada **no vuelven a
  aparecer** como "a resolver". Se muestran agrupadas y plegadas como "N ignoradas", con
  "recuperar" por línea.
- Recuperar borra la entrada; la línea vuelve a "a resolver".
- El hash de línea se calcula con la **misma función de normalización** que use el emparejamiento,
  para que no haya dos criterios de identidad de línea. Si no existe una única, **reporta**.

## D1 bis · `hashLote` **SE ACTIVA** · el orquestador es el camino que sobrevive

Esto no es opcional: sin idempotencia por fichero, subir dos veces el mismo extracto duplica
movimientos y falsea todos los saldos. Es justo lo que la V6 promete que no pasa.

1. **Activar `hashLote`** en `bankStatementOrchestrator.ts:321` (hoy se escribe vacío, "out of scope
   for T17"). Reutiliza `generateBatchHash`, que ya existe y usa el otro camino — **no escribas una
   segunda implementación**.
2. Al subir un extracto cuyo `hashLote` ya conste: avisar **antes de procesar** ("este extracto ya se
   importó el {fecha}") y permitir continuar solo con confirmación explícita.
3. **Camino que sobrevive: el orquestador** (`bankStatementOrchestrator` + `universalBankImporter`),
   que es sobre el que se monta §4.7. Antes de dar por muerto el de `treasuryApiService.ts:563`,
   **verifica quién lo llama**; si tiene llamadores vivos fuera de tesorería, **para y reporta** — su
   retirada iría en tarea aparte, no aquí.

## D6a · Documentación del movimiento → **se conserva la capacidad, enlazando al Archivo**

No se acepta perderla. §4.5 dice que no hay **campo de documento** en la ficha, y eso se mantiene:
confirmar tiene que ser rápido y la ficha no es un gestor documental. Pero eliminar la única forma de
adjuntar sería cambiar una regla de diseño por una pérdida de función, que no es lo mismo.

**Solución:** en la ficha de §4.5, un **enlace discreto** (no dropzone, no zona punteada, no campo de
formulario) que reutiliza `DocumentPickerPopover` para elegir un documento **ya existente en el
Archivo** y vincularlo (`facturaId` / `justificanteId` / `*NoAplica`).

- Si el movimiento ya tiene documento → el enlace lo muestra y permite abrirlo.
- Si no → "vincular documento del Archivo".
- **Subir un fichero nuevo sigue siendo cosa del Archivo**, no de Tesorería.
- Los campos `facturaId`/`justificanteId`/`*NoAplica` se siguen escribiendo igual que hoy; no cambia
  el modelo ni se quedan huérfanos los lectores (`lineasInmuebleService`, `EjecucionesRecurrentesSection`).

Esto es una **desviación consciente de §4.5** y queda escrita aquí como tal.

## D6b · Regenerar previsión → **NO se lleva a V6. La cascada es automática**

**Decisión de Jose, y corrige mi respuesta anterior.** El botón no viaja a la V6 porque **no debería
existir**: si el usuario cambia algo que afecta a lo previsto, ATLAS tiene que enterarse solo. Pedirle
que pulse "regenerar" es admitir que el sistema no reacciona a sus propios cambios y pasarle a él esa
carga. Contradice el principio del producto.

**Modelo correcto · recálculo en cascada:**

Cuando cambia cualquiera de estas fuentes, las previsiones del periodo afectado se regeneran
automáticamente, sin intervención:

| Cambia | Efecto |
|---|---|
| Contrato (alta, baja, renta, fechas, indexación) | Previsiones de renta del periodo afectado |
| Préstamo (alta, amortización, cambio de cuota, liquidación) | Previsiones de cuota |
| Gasto recurrente del inmueble (alta, baja, importe, periodicidad) | Previsiones de ese gasto |
| Alta/baja de cuenta o de inmueble | Lo que cuelgue de ellos |

**Reglas no negociables del recálculo:**
1. **Solo toca `predicted`.** Jamás confirmados, conciliados ni descartados. Lo que ya afirmó el
   usuario o el banco es intocable.
2. **Solo el periodo afectado**, no todo el histórico.
3. **Silencioso.** Sin modal, sin toast celebratorio. Como mucho, la pantalla refleja los números
   nuevos. Si el recálculo cambia algo relevante del mes en curso, se ve en los KPIs y en "Cómo va
   {mes}", que ya se recalculan en vivo (§4.6).

**Qué hacer con `regenerateMonthForecast()`:**
- **No se cablea ningún botón de usuario.**
- Se conserva como función invocada por los disparadores de arriba (`treasurySyncService` /
  `treasuryForecastService`).
- **Verifica y reporta ANTES de tocarlo:** ¿existe hoy esa cascada, aunque sea parcial, o el único
  camino era el botón manual? Y ¿garantiza la función que no pisa confirmados/conciliados/descartados?

**Atajo del Panel:** `modules/panel/components/AccionesRapidas.tsx:39` ("Conciliar banco") →
apunta a `/tesoreria` **abriendo directamente el drawer de extracto** (§4.7, modo global con
detección por IBAN). No dejarlo apuntando a una ruta muerta.

**Si la cascada no existe hoy** — es decir, si el botón era de verdad el único mecanismo — entonces
esto **no cabe en la V6**: es una tarea propia de arquitectura (disparadores + alcance de recálculo +
garantías de no pisar lo confirmado). En ese caso: **para y reporta**, y la V6 se entrega sin botón
y sin cascada nueva, dejando la deuda escrita y aislada. Lo que **no** se hace es colar un botón
"regenerar" en la interfaz nueva para tapar el hueco.

## D2 bis · `PunteoList` · las 5 fricciones · **aprobadas 1–5**

Adelante con las cinco, con dos condiciones:

- **`punteoModel.ts` no se toca.** Nada de esto es modelo, es presentación.
- Los puntos 1–4 (eje de agrupación, pestañas, buscador, grupos plegables con subtotal) entran como
  **props/estado opcionales con valor por defecto igual al comportamiento actual**, para que las
  otras tres vistas que cuelgan de `PunteoList` no cambien ni un píxel.
- El punto 5 (anatomía de fila: círculo · concepto · estado · importe · lápiz · ✕ al hover) entra
  como **variante de fila explícita** (p. ej. `rowVariant: 'tesoreria'`), no como cambio del render
  por defecto. El descartar sale del editor inline y va a la fila **solo en esa variante**.
- Si al implementarlo ves que la variante descoloca alguna de las otras tres vistas, **para y
  reporta** antes de seguir.

## Rama

Renombra a **`feat/tesoreria-v6`**.

---

## D3 · Los 13 `PENDIENTE-JOSE`

Diagnóstico aceptado: siete comparten causa. **La familia "Reparación y conservación" mezcla dos
cosas fiscalmente distintas** — reparación/conservación del inmueble y servicios de explotación
turística. Eso se arregla en presentación y arrastra cinco pendientes.

### Cambio estructural previo (resuelve 5 de los 13)

En `TIPOS_GASTO_INMUEBLE_V2`, **nueva familia de presentación: "Servicios y explotación"**, con los
conceptos que hoy cuelgan mal de Reparación:

| Se mueve a Servicios y explotación | Queda en Reparación y conservación |
|---|---|
| Limpieza · Limpieza de zonas comunes · Limpieza por estancia · Consumibles de bienvenida | Mantenimiento de la caldera · Mantenimiento integral · Otros |

Y **`ropa_cama_lavanderia` se desdobla** en dos conceptos, porque son dos cosas:
- **Lavandería** (servicio recurrente) → Servicios y explotación
- **Ropa de cama y enseres** (bien duradero) → familia **Mobiliario**, que es **amortizable**, no gasto

### Resolución propuesta · a validar por Jose una a una

| # | Concepto | Destino propuesto | Criterio |
|---|---|---|---|
| 1 | `tributos:licencia_turistica` | `tributo_inmueble` · 0115 | Tasa municipal no estatal, mismo trato que IBI y basuras |
| 2 | `tributos:otros` | `tributo_inmueble` · 0115 | Si cuelga de Tributos, tributa como tributo. Corregir la `categoria` inconsistente |
| 3 | `comunidad:derrama` | **Se pregunta por movimiento** | Ver nota abajo |
| 4 | `suministros:telefonia` | **Nuevo sub-tipo** `telefonia` en `SUMINISTRO_SUBTYPES` · 0113 | No colapsar en internet: se contratan y facturan por separado |
| 5 | `suministros:alarma` | `servicio_inmueble` · 0108 | Es un servicio de vigilancia contratado, no un suministro |
| 6 | `seguros:vida` | **Fuera del inmueble** → gasto personal | Va ligado a la hipoteca, no al arrendamiento. Deducirlo como gasto del alquiler es incorrecto y es de los que levantan una paralela |
| 7 | `gestion:comision_plataformas` | `servicio_inmueble` · 0108 | Comercialización (Booking/Airbnb): servicio de terceros |
| 8 | `reparacion:limpieza` | `servicio_inmueble` · 0108 | Pasa a Servicios y explotación |
| 9 | `reparacion:limpieza_zonas_comunes` | `servicio_inmueble` · 0108 | Salvo que la facture la comunidad, y entonces es una cuota de comunidad (0109) — se distingue por quién emite la factura, no por el concepto |
| 10 | `reparacion:limpieza_por_estancia` | `servicio_inmueble` · 0108 | Pasa a Servicios y explotación |
| 11 | `reparacion:ropa_cama_lavanderia` | **Se desdobla** · Lavandería → 0108 · Ropa y enseres → `mobiliario_inmueble` 0117 (amortizable) | Son dos naturalezas distintas bajo un nombre |
| 12 | `reparacion:consumibles_bienvenida` | `servicio_inmueble` · 0108 | Consumible de explotación, no reparación |
| 13 | `personal:suministros` | Colapsa en `gasto_personal_vivienda` | En personal no hay casilla que ganar con la granularidad; presentación los sigue mostrando separados |

**Nota sobre la derrama (#3) — la de más impacto y la única que no se resuelve con una tabla:**
una derrama puede ser **conservación** (deducible en el ejercicio) o **mejora** (capitalizable, se
amortiza). Depende de la obra, no del concepto. Por tanto:

- `comunidad:derrama` **no se traduce a una `categoryKey` fija**.
- Al confirmar un movimiento de derrama, la ficha pregunta: **"¿conservación o mejora?"**
  - Conservación → gasto deducible del ejercicio (0109/0106 según proceda).
  - Mejora → **no es gasto**: alta en `mejorasInmueble`, se incorpora al valor amortizable.
- Es la única pregunta fiscal que se le hace al usuario en toda la ficha, y está justificada:
  ATLAS no puede saberlo y equivocarse cuesta caro en las dos direcciones.
- Si esto no cabe en el alcance de la V6, **para y reporta**: se saca a tarea propia, pero
  `comunidad:derrama` se queda con `categoryKey: null` hasta entonces (que es lo que ya hiciste bien).

> Estas 13 son **propuesta razonada**, no orden ejecutada. Jose valida o corrige antes de que se
> escriban en la tabla de mapeo. El candado del test se mantiene mientras tanto.

---

## Arranque

Con D1, D1 bis, D6a, D6b y D2 bis respondidas, sigue con §4. El D3 no bloquea: el test ya impide
guardar una `categoryKey` inventada.

**Sigue vigente: cualquier contradicción nueva → para y reporta.**
