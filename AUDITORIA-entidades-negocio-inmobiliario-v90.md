# AUDITORÍA · entidades de negocio inmobiliario (explotación / gestión / fianzas / venta)

**Commit auditado:** `adb4f8b0dbf2c8e0feedacf85f23c59943f39c33` (`adb4f8b`) · `DB_VERSION = 90`
**Alcance:** solo lectura. No se ha tocado una línea de código.
**Método:** cada afirmación marcada **[V]** está verificada leyendo la línea citada. Las marcadas **[D]** son deducciones (ausencia de consumidores, encadenamiento de llamadas) y se señalan como tales.

---

## RESUMEN EN UNA PÁGINA

El censo se quedó corto. `explotacionAlquiler` NO es el único candidato: **ya existe un modelo de gestión delegada bastante completo**, montado sobre `Contract` (no sobre la explotación), con agencia como `Proveedor`, renta garantizada, comisión y su propia tesorería. Lo que falta no es "modelar de cero", es que las piezas están **en dos sitios distintos y sin enlazar**.

Los cinco hechos que condicionan cualquier diseño posterior:

1. **La explotación existe como entidad propia y VIVA** (`explotacionAlquiler`, v90), pero con **solo 2 consumidores** — una pestaña de UI y un hook de wizard. Los comentarios del propio código prometen tres consumidores más ("semillado de OPEX", "validación de contratos") que **no existen**.
2. **Hay DOS fuentes de verdad simultáneas del modo de explotación**: la nueva `ExplotacionAlquiler.modo` y la legacy `Property.modoExplotacion`. Las tablas de contratos (Activos, Histórico) leen la **legacy**; la pestaña Disponibilidad lee la **nueva**. Nadie las sincroniza después de la migración.
3. **El modelo de gestión garantizada SÍ está modelado**, pero como un `Contract` padre (`Contract.gestion`) con subcontratos hijos (`gestionPadreId`), **no como atributo de la explotación**. Funciona de punta a punta hasta Tesorería.
4. **La fianza es un post-it, no dinero.** Existen los campos (`fianzaImporte`, `fianzaEstado`, `fianzaDevuelta`), se pintan en pantalla y se exportan — pero **no generan ni un solo apunte de tesorería**. No hay `sourceType: 'fianza'`. Un traspaso de fianza a la gestora hoy no se puede representar.
5. **La venta SÍ cierra los contratos** (`autoTerminateContracts`), lo cual contradice la sospecha del censo. Pero **no devuelve fianzas y no toca la explotación**: el piso vendido sigue marcado como alquilable para siempre.

---

## 1 · ¿EXISTE EL CONCEPTO DE "EXPLOTACIÓN / PUESTA EN ALQUILER"?

### 1.1 · Sí, existe, y está bien planteado conceptualmente · **[V]**

`ExplotacionAlquiler` es un store físico propio nacido en v90, con índice **único** por `inmuebleId`.

- Interface: `src/services/db/types-inmuebles.ts:254-265`
  ```
  id?, inmuebleId (FK único), modo, estado, habitaciones?[], cuentaCobroPorDefectoId?, createdAt, updatedAt
  ```
- Tipos auxiliares: `src/services/db/types-inmuebles.ts:235` (`ModoExplotacionAlquiler = 'completo' | 'habitaciones' | 'turistico'`), `:238` (`EstadoExplotacion = 'operativo' | 'vacante' | 'en_reforma'`), `:247-252` (`HabitacionAlquiler`).
- Store y su índice único: `src/services/db/upgrade-a.ts:181-183`.
- Declaración en el esquema: `src/services/db.ts:97`.
- La doctrina está escrita en el propio código: `src/services/db/types-inmuebles.ts:219-232` — *«"Poner un inmueble en alquiler" NO es un atributo del inmueble. Es una entidad PROPIA del dominio Alquileres que REFERENCIA al inmueble»*. Es exactamente el modelo que pides. Ya está decidido.

### 1.2 · Está VIVA, pero mucho más flaca de lo que su documentación afirma · **[V]**

Servicio completo: `src/services/explotacionAlquilerService.ts` — **13 funciones exportadas** (3 helpers puros: `siguienteIdHabitacion:30`, `habitacionesPorDefecto:40`, `explotacionDesdeLegacy:58`; y 10 async de lectura/escritura: `:112, :123, :133, :140, :160, :203, :220, :229, :247, :261`), más la interface `AltaExplotacion:146`.

**Consumidores reales del servicio, fuera de tests y de su propia migración — la lista entera:**

| Consumidor | Fichero:línea | Qué usa |
|---|---|---|
| Pestaña "Disponibilidad" | `src/modules/inmuebles/components/contratos/TabDisponibilidad.tsx:12-19, 95, 402, 421, 442, 484, 590` | Lee el mapa, marca, actualiza, desmarca, añade habitación |
| Hook de habitaciones del wizard de contrato | `src/modules/inmuebles/wizards/useHabitacionesContrato.ts:6, 26` | Lee la lista de habitaciones para el `<select>` |

Y nada más. Verificado con un grep de **las 13 funciones exportadas, una por una**, sobre todo `src/`.

Ese grep completo destapa además algo que refuerza el diagnóstico: **4 exportaciones no las consume nadie de fuera del servicio.**

| Exportación | Estado real |
|---|---|
| `getExplotaciones:112` | Solo uso interno (`:134`, desde `getExplotacionesPorInmueble`) |
| `siguienteIdHabitacion:30` | Solo uso interno (`:236`) — exportada para sus tests |
| `habitacionesPorDefecto:40` | Solo uso interno (`:105, :172`) — exportada para sus tests |
| **`estaAlquilable:140`** | **MUERTA del todo.** Cero llamadas en el repo entero: ni consumidores, ni uso interno, ni tests. Su definición es la **única** aparición del identificador en todo `src/` |

`estaAlquilable` merece un párrafo aparte, porque es la prueba más limpia de la tesis de este documento: es literalmente la función que responde *«¿está este inmueble en alquiler?»* — la pregunta central del modelo de explotación — y **en toda la aplicación nadie la hace ni una vez**. La entidad existe, el servicio la sabe responder, y ninguna pantalla ni ningún cálculo la consulta.

**La pestaña ES alcanzable** (no es código muerto): `src/modules/inmuebles/pages/ContratosListPage.tsx:26, 35, 38, 204, 317-318` la registra como primera pestaña por defecto; la página está enrutada en `src/App.tsx:105`.

### 1.3 · Tres promesas del comentario que el código NO cumple · **[V]**

`src/services/explotacionAlquilerService.ts:9-10` afirma: *«De aquí se nutren la disponibilidad, el semillado de OPEX (al pasar a `operativo`) y la validación de contratos»*. Repetido en `src/services/db/types-inmuebles.ts:226-228`.

- **Disponibilidad** → CIERTO (`TabDisponibilidad.tsx`).
- **Semillado de OPEX** → **FALSO**. Ningún servicio de OPEX / `compromisosRecurrentes` importa el servicio de explotación. El propio repo dice que ese semillado se retiró del runtime: `src/services/conceptos/__fixtures__/baselineInmuebleLegacy.ts:4`. No hay ningún disparador por cambio de `estado` a `operativo`.
- **Validación de contratos** → **FALSO** como validación. `useHabitacionesContrato.ts` solo **rellena un desplegable**; no valida nada, y cae al conteo legacy `bedrooms` si no hay explotación (`:9-14, 36`).

Esto es exactamente el caso que advertías: *un comentario en el código no es prueba de comportamiento.*

### 1.4 · Migración de siembra · **[V]**

`src/services/migrations/v90-explotacionAlquiler.ts`, disparada desde `src/services/db/post-open.ts:747-768` con flag `migration_v90_explotacion_alquiler_v1`. Es idempotente y deduplica por `inmuebleId`.

La regla de siembra está en `explotacionDesdeLegacy` (`src/services/explotacionAlquilerService.ts:56-104`):
- `usoTipo === 'vivienda_habitual'` → **nunca** se marca (`:62`).
- Señales que sí marcan (`:73-78`): uso de arrendamiento, habitaciones activas, `explotacion.estadoOperativo === 'operativo'`, o **tener ya algún contrato**.

⚠️ **El censo decía "0 registros" y es coherente con lo que se ve** [D]: la migración solo siembra a partir de campos legacy de `Property`. Si esos campos están vacíos en la base real, la tabla se queda a cero aunque haya contratos… **salvo** que el inmueble tenga contrato, en cuyo caso sí se siembra (`v90-explotacionAlquiler.ts:44-47`). Que esté a 0 sugiere que la migración post-open aún no ha corrido en esa copia, o que corrió antes de que hubiera contratos. **Esto conviene comprobarlo en la base real antes de dar la tabla por buena.**

### 1.5 · ¿Se puede representar que un piso NO está en alquiler, o que lo estuvo y dejó de estarlo?

- **"NO está en alquiler" → SÍ.** Que no exista su `ExplotacionAlquiler`. `desmarcarAlquilable` la **borra** (`explotacionAlquilerService.ts:216-220`). **[V]**
- **"Lo estuvo y dejó de estarlo" → NO.** El desmarcado es un `db.delete`: no queda rastro, ni fecha de baja, ni histórico. La explotación tiene `createdAt`/`updatedAt` pero **ninguna fecha de vigencia** (`types-inmuebles.ts:254-265`). **[V]**
- Estado intermedio: `estado: 'vacante'` permite decir "está en alquiler pero sin inquilino", que es distinto de "ya no se alquila". **[V]**

---

## 2 · ¿EXISTE EL MODELO DE GESTIÓN Y SUS TIPOS?

### 2.1 · Existe, pero repartido en DOS ejes que no se hablan

Hay dos conceptos distintos que el repo llama parecido:

**Eje A · el modo de explotación** (completo / habitaciones / turístico) → vive en `ExplotacionAlquiler.modo` (`types-inmuebles.ts:257`) **y también** en el legacy `Property.modoExplotacion` (`piso_completo | por_habitaciones | mixto`).

**Eje B · gestión directa vs. delegada a gestora** → vive en `Contract.gestion` (`types-contratos.ts:380`). **No existe en la explotación.**

Es decir: la pregunta *"¿este piso lo gestiono yo o una gestora?"* hoy **no se responde mirando el inmueble ni su explotación**, sino buscando si existe algún `Contract` con `gestion` para ese `inmuebleId`. **[V]**

### 2.2 · La distinción directo completo / directo por habitaciones / garantizado por gestora · **[V]**

Los tres casos SÍ son representables, pero con dos mecanismos distintos:

| Caso del modelo de negocio | Cómo se representa hoy | Dónde |
|---|---|---|
| Directo, piso completo | `ExplotacionAlquiler.modo = 'completo'` + 1 `Contract` `unidadTipo: 'vivienda'` | `types-inmuebles.ts:235`, `types-contratos.ts:192` |
| Directo, por habitaciones | `ExplotacionAlquiler.modo = 'habitaciones'` + N `Contract` `unidadTipo: 'habitacion'` con `habitacionId` | `types-inmuebles.ts:247-252`, `types-contratos.ts:193` |
| Garantizado por gestora | 1 `Contract` PADRE con `gestion: GestionDelegada` + N subcontratos con `gestionPadreId` | `types-contratos.ts:123-157, 380, 387` |

`GestionDelegada` (`types-contratos.ts:123-157`) es rica y está bien pensada:
- `agenciaNif` → FK al `Proveedor`.
- `modeloIngreso: 'garantizada' | 'traspaso'`.
- `rentaGarantizada?`.
- `honorarios: HonorarioAgencia[]` (`:104-114`), componible: comisión sobre renta, fee por habitación, fee fijo, captación.
- `liquidacion: 'agencia_neto' | 'propietario_bruto'` — el flujo de caja, ortogonal a la fórmula.
- `comisionTipo: 'garantizada' | 'porcentaje' | 'fees'` + `comisionPorcentaje`.

**Está VIVO de punta a punta** [V]:
- Wizard de alta: `src/modules/inmuebles/wizards/NuevoContratoGestionWizard.tsx`, payload en `gestionGarantizadaPayload.ts:112-141`.
- Panel en la ficha: `src/modules/inmuebles/components/contratos/PanelGestionDelegada.tsx`.
- Anexar subcontratos: `src/modules/inmuebles/wizards/anexarSubcontratoPayload.ts`.
- **Tesorería real**: `src/modules/horizon/tesoreria/services/gestionTesoreria.ts` (`planificarGestionMes`, `comisionMensual`), llamado desde `src/modules/horizon/tesoreria/services/treasurySyncService.ts:28, 346`, que emite eventos `sourceType: 'comision_gestion'` (`:457`). Ese `sourceType` existe en el enum (`src/services/db/types-movimientos.ts:261`) y lo consume el punteo (`src/services/punteo/punteoAdapter.ts:42`).
- Documentación de diseño: `docs/DISENO-gestion-delegada-agencias-V1.md`.

Es decir: **el caso Alisser (renta garantizada) ya se puede registrar hoy y ya mueve dinero correctamente en tesorería.** Esto es mucho más de lo que el censo sugería.

### 2.3 · Alquiler por habitaciones · **[V]**

Sí está modelado, en tres capas:
- Lista de habitaciones embebida en la explotación (`HabitacionAlquiler`, `types-inmuebles.ts:247-252`): `id`, `nombre`, `rentaObjetivo?`, `estado?`. Es lista ligera, **no store propio** — decisión explícita documentada en `:241-245`.
- El contrato apunta a la habitación: `Contract.habitacionId` (`types-contratos.ts:193`) contra ese `id`.
- Convención de ids `hab-N` preservada para no romper contratos antiguos: `siguienteIdHabitacion` en `explotacionAlquilerService.ts:31-39`.

**¿Soporta varios contratos activos por piso, uno por habitación?** SÍ técnicamente — `contracts` tiene índice `inmuebleId` y nada impide N contratos. Pero:

⚠️ **`validateOccupancy` está MUERTA.** Está definida en `src/services/contractService.ts:538-597` con lógica correcta (detecta conflicto de piso completo vs. habitación, y colisión de misma `habitacionId` con solape de fechas), pero **no la llama nadie**: la única aparición en todo `src/` es su propia definición. Y la validación normal la desactivó a conciencia: `src/services/contractService.ts:530-532` — *«NOTE: Ocupancy validation removed to allow historical onboarding… Overlap management will be handled in a future task.»* **[V]**

Consecuencia práctica **[D]**: hoy puedes crear dos contratos solapados sobre la misma habitación, o un contrato de piso completo sobre un piso que ya tiene sus habitaciones alquiladas, y ATLAS no dirá nada. De hecho el propio modelo de gestión delegada **depende** de que no valide: el padre es `unidadTipo: 'vivienda'` (`gestionGarantizadaPayload.ts:124`) y los hijos anexados son `'habitacion'` (`anexarSubcontratoPayload.ts:52`) — si `validateOccupancy` se activara tal cual, marcaría conflicto en todos los contratos de gestión delegada (`contractService.ts:565-568`).

### 2.4 · ¿Existe el CAMBIO de modelo de gestión con fecha? · **[V]**

**En la explotación: NO.** `ExplotacionAlquiler.modo` y `.estado` son valores **únicos, sin histórico y sin fechas de vigencia**. Cambiarlos es un `put` que pisa el anterior (`explotacionAlquilerService.ts:191-203`). No hay `historicoModos[]`, no hay `vigenteDesde`/`vigenteHasta`.

**En los contratos: SÍ, de rebote y por accidente.** El caso FA32 (habitaciones → garantizada con Alisser en una fecha) SÍ es representable hoy, porque el régimen de gestión vive en un `Contract`, y los contratos sí tienen `fechaInicio`/`fechaFin` (`types-contratos.ts:217-218`) y ciclo de vida (`finalizarContrato` en `src/services/contractLifecycleService.ts:36-57`). Se representaría como: finalizar los N contratos de habitación en la fecha X, y crear el contrato de gestión padre con `fechaInicio` = X.

Pero eso deja tres agujeros **[D]**:
- Nada **enlaza** el cese de unos con el alta del otro. No hay "sucesión de régimen". Son eventos sueltos que solo el ojo humano relaciona.
- La **explotación** del piso no cambia: sigue en `modo: 'habitaciones'` aunque la gestión ya sea garantizada. Nadie la actualiza al crear el contrato de gestión (verificado: `gestionGarantizadaPayload.ts` y `NuevoContratoGestionWizard.tsx` no importan el servicio de explotación).
- No hay forma de **preguntarle a un inmueble** "¿bajo qué régimen estabas en marzo de 2024?" sin reconstruirlo escaneando contratos.

### 2.5 · La doble fuente de verdad · **[V]** — el hallazgo más incómodo

La migración v90 **NO borra** los campos legacy: `v90-explotacionAlquiler.ts:20-21` — *«Los campos legacy de `Property` NO se borran (quedan de solo-lectura hasta que no queden lectores)»*. **Pero quedan lectores, y son de producción:**

| Lector | Fichero:línea | Lee |
|---|---|---|
| Tabla de contratos activos | `src/modules/inmuebles/components/contratos/TablaActivos.tsx:21-22` | `Property['modoExplotacion']` (legacy) |
| Pestaña Activos | `src/modules/inmuebles/components/contratos/TabActivos.tsx:19` | `Property['modoExplotacion']` (legacy) |
| Pestaña Histórico | `src/modules/inmuebles/components/contratos/historico/TabHistorico.tsx:13` | `Property['modoExplotacion']` (legacy) |
| Tabla ex-inquilinos | `src/modules/inmuebles/components/contratos/historico/TablaExInquilinos.tsx:61, 185` | `Property['modoExplotacion']` (legacy) |
| Ficha fiscal | `src/modules/fiscal/v2/FiscalInmueblePage.tsx:273` | `Property.alquilerPorHabitaciones` (legacy) |
| Pestaña Disponibilidad | `src/modules/inmuebles/components/contratos/TabDisponibilidad.tsx:277, 438` | `ExplotacionAlquiler.modo` (**nuevo**) |

Y el legacy además se sigue **auto-curando** en post-open: `src/services/db/post-open.ts:125-150` (self-heal V78.1 de `modoExplotacion`).

**Consecuencia [D]:** cambiar el modo desde Disponibilidad (que escribe `ExplotacionAlquiler.modo`) **no cambia** lo que muestran las tablas de Activos e Histórico (que leen `Property.modoExplotacion`). Divergen en silencio a partir del primer cambio. Esto no es teórico: `TabDisponibilidad.tsx:442` llama a `marcarAlquilable` y nada sincroniza `Property`.

---

## 3 · ¿EXISTE LA GESTORA COMO ENTIDAD?

### 3.1 · Sí, como `Proveedor` con un tipo, no como entidad propia · **[V]**

- `Proveedor` (`src/services/db/types-inmuebles.ts:588-600`): `nif` (keyPath), `nombre?`, `tipos: string[]`, `sinNombre?`.
- Al dar de alta un contrato de gestión, `guardarAgencia` **añade el tipo `'gestion'`** al proveedor, creándolo si no existe: `src/modules/inmuebles/wizards/agenciaGestionService.ts:13-34` (concretamente `:21` `tipos.add('gestion')`).
- Se llama desde el wizard: `src/modules/inmuebles/wizards/NuevoContratoGestionWizard.tsx:87`.
- El enlace desde el contrato es `GestionDelegada.agenciaNif` (`types-contratos.ts:125`), que llega hasta el apunte de comisión en tesorería (`gestionTesoreria.ts:61, 145`).
- Existe además `OperacionProveedor.tipo` con valor `'gestion'` (`types-inmuebles.ts:602-611`).

**Respuesta a tu pregunta concreta:** "Alisser Real Estate" (renta garantizada) y "Gestió i Administració de Finques" (honorarios) **se modelan igual** — ambos serían `Proveedor` con `tipos` incluyendo `'gestion'`. Lo que los distingue **no es la entidad, es el contrato**: Alisser tendría un `Contract` con `gestion.modeloIngreso = 'garantizada'` y `rentaGarantizada`; el administrador de fincas sería un `CompromisoRecurrente` de gasto o un `gestion.comisionTipo = 'fees'`. **[D]** sobre cómo se modelaría el segundo caso — no he encontrado un caso real de administrador de fincas modelado en el repo.

### 3.2 · Lo que NO existe · **[V]**

- **No es distinta de un inquilino donde importa.** El contrato de gestión guarda la agencia **como si fuera el inquilino**: `gestionGarantizadaPayload.ts:126` — `inquilino: { nombre: form.agenciaNombre, apellidos: '', dni: agenciaNif, ... }`. Y el panel lee el nombre de la agencia con `getInquilinoNombre(contrato)` (`PanelGestionDelegada.tsx:65`). Funciona, pero la agencia está **duplicada**: una vez en `proveedores` y otra dentro de `Contract.inquilino`. Nada las mantiene sincronizadas.
- **No hay tipo cerrado.** `Proveedor.tipos` es `string[]`, sin enum. `'gestion'` es una convención de un solo fichero.
- **No hay índice** por `tipos` en el store `proveedores`, así que "dame mis gestoras" es un escaneo completo. **[D]**
- **No hay entidad "administrador de fincas"** distinta de "gestora de alquiler". Ambas caerían en el mismo `'gestion'`.

---

## 4 · ¿EXISTEN LAS FIANZAS / DEPÓSITOS?

### 4.1 · Existen los CAMPOS · **[V]**

En `Contract` (`src/services/db/types-contratos.ts:259-266`):
```
fianzaMeses: number
fianzaImporte: number
fianzaEstado: 'retenida' | 'devuelta_parcial' | 'devuelta_total'
fechasFianza?: { cobro?: string; devolucion?: string }
```
Y en el bloque histórico T6 (`:367-368`): `fianzaDevuelta?: number`.
Más el legacy `deposit?: { months, amount }` y `additionalGuarantees?` (`:414-418`).

El vocabulario conceptual es **correcto**: distingue retenida / devuelta parcial / devuelta total, y tiene fecha de cobro y de devolución. Sobre el papel, el modelo de pasivo está insinuado.

### 4.2 · Pero NO son dinero. Son una anotación. · **[V]** — hallazgo crítico

**Quién ESCRIBE la fianza:**
- Wizard de contrato: `src/modules/inmuebles/wizards/contratoWizardPayload.ts:67-69, 108-110` → `fianzaImporte: Math.round(rentaMensual * fianzaMeses)`, `fianzaEstado: 'retenida'`.
- Wizard de gestión: `gestionGarantizadaPayload.ts:134-136`.
- Subcontrato anexado: `anexarSubcontratoPayload.ts:70-72` (siempre 0).
- Importador de contratos: `src/services/contractImportCreationService.ts:141-143, 193-194`.
- Fin de contrato: `src/services/contractLifecycleService.ts:27, 55` → `updates.fianzaDevuelta = options.fianzaDevuelta`.

**Quién LEE la fianza:**
- Drawer de ficha de contrato: `src/modules/inmuebles/components/contratos/DrawerFichaContrato.tsx:339-340, 544-545` (la pinta).
- Panel de gestión delegada: `PanelGestionDelegada.tsx:70-73` (la pinta).
- Texto del histórico: `src/modules/inmuebles/utils/historico/calculos.ts:87-94` (la formatea: "Retenida total", "X € de Y €").
- Exportador: `src/modules/horizon/herramientas/exporters/atlasExportService.ts:575`.

**Y ya está. Todos los lectores son de pantalla o de exportación.**

**Lo que NO existe · verificado por ausencia:**
- ❌ **No hay `sourceType: 'fianza'`** en `TreasuryEvent`. El enum completo está en `src/services/db/types-movimientos.ts:261` — 26 valores, incluyendo `'comision_gestion'`, y **ninguno de fianza**.
- ❌ **Cero apariciones de "fianza" en todo `src/services/` relacionadas con tesorería.** Las únicas coincidencias son fiscales autonómicas (`src/services/fiscal/tipos.ts:81-82` `fianzaDepositada?: boolean`, requisito de deducciones de Madrid y Galicia — `ccaaRules/madrid.ts:72`, `ccaaRules/galicia.ts:60`), que es otra cosa: es "¿la depositaste en el IVIMA?" para una deducción del **arrendatario**.
- ❌ **`treasurySyncService.ts` no menciona la fianza ni una vez.**
- ❌ `finalizarContrato` (`contractLifecycleService.ts:36-57`) apunta `fianzaDevuelta` en el contrato y **no genera ningún movimiento ni evento de tesorería**.

### 4.3 · Respuesta directa a tu pregunta

> *¿O las fianzas hoy se tratan como un ingreso/gasto normal (lo cual sería incorrecto)?*

**Ni siquiera eso.** No se tratan en absoluto en tesorería. Es más "invisible" que "incorrecto":

- El ingreso de la fianza del inquilino **no aparece** en tesorería como previsión. Cuando ese dinero entre de verdad por el banco, será una línea del extracto **sin contrapartida** que habrá que clasificar a mano — y lo más probable es que se clasifique como ingreso de alquiler, que **sí sería incorrecto** (inflaría el rendimiento y la base del IRPF). **[D]** — no he verificado el comportamiento del clasificador ante una línea de fianza.
- La **retención** como pasivo no existe. No hay ninguna cuenta ni saldo que diga "debo 2.400 € de fianzas".
- La **devolución** al inquilino no genera salida.
- El **traspaso de la fianza a la gestora** cuando asume la gestión — tu caso FA32 → Alisser — **no es representable de ninguna forma**. Ni hay campo, ni evento, ni relación fianza↔gestora.

---

## 5 · ¿ESTÁ CONECTADA LA VENTA CON LAS RENTAS?

### 5.1 · La venta SÍ cierra los contratos — el censo se equivocaba aquí · **[V]**

`confirmPropertySale` en `src/services/propertySaleService.ts`:

- Localiza los contratos activos del inmueble: `:743-748` (`esContratoDelInmueble` + `isActiveContract` a fecha de venta).
- **Bloquea la venta** si hay contratos activos y no se pidió el cierre automático: `:763-765` — *«Existen contratos activos. Ciérralos antes de vender o activa el cierre automático.»*
- Con `autoTerminateContracts`, los **rescinde de verdad** dentro de la misma transacción: `:774-793`
  ```
  fechaFin: input.saleDate,
  endDate: input.saleDate,
  estadoContrato: 'rescindido',
  rescision: { fecha: input.saleDate, motivo: 'Venta del inmueble' }
  ```
- El wizard de venta **lo activa siempre**: `src/pages/GestionInmuebles/VentaWizard.tsx:132` → `autoTerminateContracts: true`.
- Y es **reversible**: hay un diario de ejecución (`SaleExecutionJournal.autoTerminatedContracts`, `:54`) que guarda el contrato anterior completo y lo restaura al revertir (`:1198-1199`).

La venta además desactiva reglas de OPEX, ajusta préstamos vinculados y borra previsiones futuras (`SaleExecutionJournal`, `:50-63`). Es una operación seria y bien construida.

### 5.2 · Lo que la venta NO hace · **[V]**

- ❌ **No devuelve ni liquida fianzas.** Cero apariciones de "fianza" en `propertySaleService.ts` (verificado por grep sobre el fichero entero). Los contratos quedan `rescindido` con su `fianzaEstado: 'retenida'` congelado para siempre.
- ❌ **No toca la explotación.** `propertySaleService.ts` **no menciona `explotacionAlquiler` ni una vez**. Un piso vendido sigue teniendo su `ExplotacionAlquiler` viva, en `estado: 'operativo'`, apareciendo como alquilable en la pestaña Disponibilidad. **[D]** sobre el efecto visual — no he ejecutado la app; el hecho verificado es que nadie borra ni actualiza la explotación en la venta.
- ❌ **`inmuebleDeleteService.ts` tampoco la borra.** Verificado: no menciona `explotacionAlquiler` (sí conserva a propósito `property_sales`, `:5, 247-249`). Borrar un inmueble deja su explotación huérfana.
- ❌ **No cierra el contrato de gestión de forma especial.** Un contrato padre `gestion` se rescinde como cualquier otro; los subcontratos hijos se rescinden solo si son "activos" por su cuenta. **[D]** — no hay tratamiento explícito de la jerarquía padre/hijo en la venta.

### 5.3 · Quién lee `property_sales` · **[V]**

El censo mencionaba `gananciaPatrimonialService` y `documentMatchingService`. Corrección: **`gananciaPatrimonialService` no lee el store** — es al revés, `propertySaleService` lo importa a él para calcular el snapshot (`propertySaleService.ts:10-13`). Y `documentMatchingService` **no aparece**. Los lectores reales son:

| Lector | Fichero:línea | Para qué |
|---|---|---|
| Documentos del ejercicio fiscal | `src/modules/fiscal/v2/helpers/ejercicioDocumentosService.ts:79` | Ventas del ejercicio |
| Cálculo de venta (fiscal v2) | `src/modules/fiscal/v2/helpers/ventaCalculoService.ts:409` | `db.get` por id |
| Presupuesto anual | `src/modules/mi-plan/services/presupuestoAnualService.ts:289-293` | Marcar inmueble vendido/baja — con nota literal *«property_sales (hoy vacío)»* |
| Matcheo determinista de movimientos | `src/services/deterministas/matcheoDeterminista.ts:54` | `ventasQueCuadran()` — reconocer el ingreso de la venta en el banco |
| Ficha del inmueble | `src/pages/GestionInmuebles/tabs/FichaTab.tsx:63` | Mostrar la venta |
| Lista de cartera | `src/pages/GestionInmuebles/GestionInmueblesList.tsx:64` | Marcar vendidos |
| Borrado de inmueble | `src/services/inmuebleDeleteService.ts:138, 247-249` | **Conservar** (histórico fiscal) |

`property_sales` está **VIVO y bien conectado** al lado fiscal y de tesorería. El agujero no está en la venta: está en la fianza y en la explotación.

---

## 6 · MAPA DE RELACIONES

```
                          ┌──────────────────┐
                          │   properties     │  el activo puro
                          │   (Property)     │
                          └────────┬─────────┘
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        │ inmuebleId (único)       │ propertyId                │ ⚠️ modoExplotacion
        │ ✅ EXISTE                │ ✅ EXISTE                  │    (campo legacy
        ▼                          ▼                           │     que NO murió)
┌───────────────────┐     ┌──────────────────┐                 │
│ explotacionAlquiler│    │  property_sales  │                 │
│ modo · estado      │    │  saleDate·status │                 │
│ habitaciones[]     │    │  fiscalSnapshot  │                 │
└─────────┬─────────┘     └────────┬─────────┘                 │
          │                        │                           │
          │ ❌ FALTA               │ ✅ EXISTE                 │
          │ nadie enlaza           │ autoTerminateContracts    │
          │ explotación↔contrato   │ → estadoContrato:         │
          │                        │   'rescindido'            │
          │ habitacionId (string)  │                           │
          │ ⚠️ enlace DÉBIL:       ▼                           │
          │ solo puebla un      ┌──────────────────┐           │
          └──────────────────►  │    contracts     │ ◄─────────┘
                                │  (Contract)      │  las tablas de Activos/
                                └──┬────────┬──────┘  Histórico leen el LEGACY,
                                   │        │          no la explotación
              gestion (embebido)   │        │  gestionPadreId (self-FK)
              ✅ EXISTE            │        │  ✅ EXISTE
                                   ▼        ▼
                        ┌──────────────┐  ┌──────────────────┐
                        │GestionDelegada│  │ subcontratos     │
                        │ agenciaNif ───┼─►│ (inquilinos      │
                        │ rentaGarantiz.│  │  reales)         │
                        │ honorarios[]  │  └──────────────────┘
                        │ liquidacion   │
                        └───────┬───────┘
                                │ agenciaNif ✅ EXISTE
                                ▼
                        ┌──────────────┐
                        │  proveedores │  tipos: [...,'gestion']
                        │ (Proveedor)  │  ⚠️ duplicado en
                        └──────────────┘     Contract.inquilino
                                │
                                │ ✅ EXISTE (comision_gestion)
                                ▼
                        ┌──────────────────┐
                        │ treasuryEvents   │
                        └──────────────────┘
                                 ▲
                                 │ ❌❌ NO EXISTE NINGÚN ENLACE
                                 │
                   ┌─────────────┴──────────────┐
                   │ FIANZA                     │
                   │ (fianzaImporte,            │
                   │  fianzaEstado,             │
                   │  fianzaDevuelta)           │
                   │ campos sueltos en Contract │
                   │ → solo se PINTAN           │
                   └────────────────────────────┘
```

### 6.1 · Enlaces que EXISTEN · **[V]**

| Enlace | Mecanismo | Fichero:línea |
|---|---|---|
| `properties` → `explotacionAlquiler` | `inmuebleId`, índice único | `upgrade-a.ts:183` |
| `properties` → `contracts` | `Contract.inmuebleId` | `types-contratos.ts:191` |
| `properties` → `property_sales` | `PropertySale.propertyId` | `types-inmuebles.ts:269` |
| `explotacionAlquiler` → `contracts` (habitación) | `HabitacionAlquiler.id` ↔ `Contract.habitacionId` | `types-inmuebles.ts:245`, `types-contratos.ts:193` |
| `contracts` → `contracts` (gestión) | `gestionPadreId` | `types-contratos.ts:387` |
| `contracts` → `proveedores` (gestora) | `gestion.agenciaNif` | `types-contratos.ts:125` |
| `contracts` → `treasuryEvents` | `sourceType: 'contrato'`, `'comision_gestion'` | `types-movimientos.ts:261` |
| `property_sales` → `contracts` (cierre) | `autoTerminateContracts` | `propertySaleService.ts:774-793` |
| `property_sales` → `prestamos` / OPEX / previsiones | `SaleExecutionJournal` | `propertySaleService.ts:50-63` |

### 6.2 · Enlaces que FALTAN · **[V]** (por ausencia verificada)

| Enlace que falta | Por qué importa | Evidencia de la ausencia |
|---|---|---|
| `explotacionAlquiler` ← régimen de gestión | La gestión vive en `Contract`, no en la explotación. El piso no sabe bajo qué régimen está | `types-inmuebles.ts:254-265` no tiene campo de gestión |
| `explotacionAlquiler` ← histórico con fechas | No se puede decir "de enero a marzo por habitaciones, desde abril garantizada" | Sin campos de vigencia; `desmarcarAlquilable` hace `delete` (`explotacionAlquilerService.ts:216-220`) |
| `explotacionAlquiler` ↔ `Property.modoExplotacion` | Doble fuente de verdad divergente | 5 lectores del legacy vs 1 del nuevo (§2.5) |
| `explotacionAlquiler` ← venta / borrado | El piso vendido sigue "alquilable" | `propertySaleService.ts` y `inmuebleDeleteService.ts` no la mencionan |
| `explotacionAlquiler` → validación de contratos | La promesa del comentario no se cumple; `validateOccupancy` está muerta | `contractService.ts:530-532, 538` |
| `explotacionAlquiler` → semillado de OPEX | Promesa del comentario incumplida | Ningún servicio OPEX la importa |
| **fianza → `treasuryEvents`** | La fianza no es dinero en ATLAS | No hay `sourceType: 'fianza'` (`types-movimientos.ts:261`) |
| **fianza → pasivo / saldo retenido** | No se sabe cuánto se debe a inquilinos | No existe el concepto |
| **fianza → gestora (traspaso)** | El caso FA32→Alisser no es representable | Sin campo ni relación |
| **venta → fianza** | La venta no devuelve fianzas | Sin "fianza" en `propertySaleService.ts` |
| `proveedores` ↔ `Contract.inquilino` (agencia) | La agencia está duplicada sin sincronía | `gestionGarantizadaPayload.ts:126` |
| Sucesión de régimen (cese ↔ alta) | Nada dice que un régimen sustituyó a otro | Sin entidad ni campo |

---

## TABLA FINAL · entidad → ¿existe? → estado → qué le falta

| Entidad | ¿Existe? | Estado | Qué le falta para soportar explotación con cambios de régimen, fianzas y venta que cierra rentas |
|---|---|---|---|
| **`explotacionAlquiler`** (`ExplotacionAlquiler`)<br>`types-inmuebles.ts:254` | **SÍ** · store propio v90, índice único `inmuebleId` | **A MEDIAS.** Vivo pero con 2 consumidores (UI Disponibilidad + hook de habitaciones). Los otros 3 que su comentario promete no existen. De sus 13 exportaciones, 4 no las consume nadie de fuera — y `estaAlquilable:140` («¿está en alquiler?») está **muerta del todo**: cero llamadas en el repo | (a) **Histórico con fechas** — hoy `modo`/`estado` son valores únicos que se pisan; (b) **el régimen de gestión** (directo/garantizado), que hoy vive en `Contract`; (c) **cierre en la venta** — nadie la desmarca al vender ni al borrar el inmueble; (d) **retirar el legacy `Property.modoExplotacion`**, que sigue teniendo 5 lectores de producción; (e) cumplir de verdad las promesas de OPEX y validación, o borrar esos comentarios |
| **`Property.modoExplotacion` / `.alquilerPorHabitaciones` / `.explotacion` / `.usoTipo`**<br>legacy pre-v90 | **SÍ** | **VIVO Y COMPITIENDO.** Debía quedar "de solo-lectura hasta que no queden lectores" (`v90-explotacionAlquiler.ts:20-21`) — quedan 5, y además se auto-cura en post-open (`post-open.ts:125-150`) | **Retirarlo.** Migrar los 5 lectores a `ExplotacionAlquiler` y desactivar el self-heal. Mientras esté vivo, cualquier modelo nuevo se construye sobre arenas movedizas |
| **`HabitacionAlquiler`**<br>`types-inmuebles.ts:247` | **SÍ** · lista embebida (no store) | **A MEDIAS.** Ids estables `hab-N`, `Contract.habitacionId` apunta ahí. Pero solo puebla un `<select>` | (a) **Ocupación real por habitación** — `validateOccupancy` existe y está muerta; (b) fechas de disponibilidad por habitación; (c) enlazar `rentaObjetivo` con la renta real del contrato |
| **`GestionDelegada`** (embebida en `Contract.gestion`)<br>`types-contratos.ts:123` | **SÍ, y sorprendentemente completa** | **VIVA de punta a punta**: wizard → panel → tesorería (`comision_gestion`) → punteo | (a) **No cuelga de la explotación** — el piso no sabe que está gestionado; (b) **sin sucesión** — nada enlaza el régimen que cesa con el que empieza; (c) **sin traspaso de fianza** a la gestora; (d) la agencia va duplicada en `Contract.inquilino` |
| **Gestora** (`Proveedor` con `tipos:['gestion']`)<br>`types-inmuebles.ts:588` | **SÍ, como tipo de proveedor** | **VIVA** · `agenciaGestionService.ts:21` la crea/etiqueta | (a) **No es entidad propia** — sin índice por `tipos`, sin enum cerrado, sin distinguir gestora de alquiler de administrador de fincas; (b) **duplicada** dentro de `Contract.inquilino` sin sincronía; (c) sin relación directa gestora↔inmueble (solo vía contrato) |
| **`Contract`**<br>`types-contratos.ts:187` | **SÍ** | **VIVO** · es la entidad más rica del dominio (histórico de rentas, indexaciones, ciclo de vida, jerarquía padre/hijo) | (a) **N contratos activos por piso sin validación** — `validateOccupancy` muerta (`:538`, cero llamadas) y la validación normal desactivada a conciencia (`:530-532`); (b) soporta el cambio de régimen solo de rebote, por fechas |
| **FIANZA** (campos sueltos de `Contract`)<br>`types-contratos.ts:259-266, 367-368` | **Campos SÍ. Entidad NO.** | **A MEDIAS, y del lado malo.** Se escribe en 5 sitios, se lee en 4 — **todos de pantalla o exportación**. Cero tesorería | **Casi todo.** (a) **No es dinero**: sin `sourceType: 'fianza'` en `TreasuryEvent` (`types-movimientos.ts:261`); (b) **no es pasivo**: no hay saldo retenido; (c) **entrada** del inquilino no prevista → la línea del banco caerá sin contrapartida y probablemente se clasifique como renta (inflando IRPF); (d) **salida** (devolución) no genera nada — `finalizarContrato` solo anota un número (`contractLifecycleService.ts:55`); (e) **traspaso a la gestora imposible**; (f) la venta no la liquida |
| **`property_sales`** (`PropertySale`)<br>`types-inmuebles.ts:267` | **SÍ** | **VIVO y bien conectado** · 7 lectores reales · cierra contratos, desactiva OPEX, ajusta préstamos, borra previsiones, y es reversible vía `SaleExecutionJournal` | (a) **No devuelve fianzas**; (b) **no cierra la explotación** — el piso vendido sigue alquilable; (c) sin tratamiento especial de la jerarquía gestión padre/hijo. *Corrección al censo: `gananciaPatrimonialService` no lo lee (es al revés) y `documentMatchingService` no aparece* |
| **Cambio de régimen con fecha** (entidad) | **NO EXISTE** | — | **Todo.** Hoy el caso FA32 se reconstruye a ojo: finalizar N contratos + crear el padre de gestión. Nada enlaza el cese con el alta, la explotación no se entera, y no se puede preguntar "¿qué régimen tenía este piso en marzo?" |

---

## LO QUE DEDUZCO (no verificado línea a línea) · **[D]**

Marcado aparte para que no se confunda con lo anterior:

1. **La tabla `explotacionAlquiler` a 0 registros probablemente no significa "muerta".** La migración es idempotente y siembra desde campos legacy o desde "tiene contrato". Si la copia auditada tenía contratos, debería haber sembrado. **Merece una comprobación en la base real** antes de concluir nada.
2. **Divergencia silenciosa Disponibilidad vs. Activos.** No he ejecutado la app; la deducción sale de que los ficheros leen campos distintos y nadie los sincroniza.
3. **Una fianza que entre por el banco se clasificará como renta.** Es lo más probable dado que no hay previsión de fianza que la reclame, pero no he auditado el clasificador ante ese caso concreto.
4. **Activar `validateOccupancy` tal cual rompería la gestión delegada.** El padre es `'vivienda'` y los hijos `'habitacion'`, y la regla de `contractService.ts:565-568` marca conflicto siempre que uno de los dos sea `'vivienda'`. Deducido leyendo las tres piezas, no probado.
5. **La explotación huérfana tras vender/borrar.** Verificado que nadie la borra; el efecto concreto en pantalla es deducción.

---

## LA CONCLUSIÓN QUE IMPORTA PARA DISEÑAR ENCIMA

No hay que modelar la gestión desde cero: **ya está modelada, pero en el sitio equivocado del árbol.** Vive colgando de `Contract` cuando conceptualmente pertenece a la explotación. Eso es lo que impide que un piso sepa bajo qué régimen está, que se pueda fechar un cambio de régimen, y que la venta cierre la explotación.

Y hay **un agujero real, no de colocación**: la fianza. Ahí no hay nada que recolocar — hay que construirlo. Es el único de los cinco puntos donde el repo no tiene ni la mitad hecha.
