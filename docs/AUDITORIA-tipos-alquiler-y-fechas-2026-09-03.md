# AUDITORÍA · alineamiento de (1) tipos de alquiler y (2) fechas de movimiento

**Fecha:** 2026-09-03 · **Alcance:** solo lectura, no se ha tocado código · **Rama auditada:** `claude/new-session-nt48c0` (HEAD limpio).

Convención: **[V]** = VERIFICADO leyendo el código citado (o ejecutándolo). **[D]** = DEDUCIDO a partir de ese código. Los comentarios del código se citan como intención, nunca como prueba. Todas las rutas son relativas a `src/` salvo que se indique otra cosa.

---

## RESUMEN EJECUTIVO

| # | Bloque | Estado | Qué pasa |
|---|---|---|---|
| 1 | Tipos · taxonomía | ✅ alineado | Tres subtipos cerrados (`larga_estancia`, `media_estancia`, `corta_estancia`). Solo `larga_estancia` reduce. Temporada y turístico resuelven al mismo 0 %. No existe `actividad_economica` para el alquiler (queda fuera de la app, como se decidió). |
| 1 | Tipos · umbral 31 días | ✅ alineado | El corte 31/32 días solo PROPONE el subtipo en el selector. Ningún cálculo fiscal depende de él. |
| 1 | Tipos · reducción | ✅ alineado (con 3 fugas) | Por CONTRATO, 50/60/70/90 con los gates de la Ley 12/2023. Fugas: un 60 % fijo al importar declaraciones, un fallback por INMUEBLE del 60 % y un mapeo Rentila `otro → larga_estancia`. |
| 1 | Estado temporal · imputación | ⚠️ **NO alineado** | Hay 3 formas distintas de contar días arrendados. La casilla 0089 de la ficha del inmueble se calcula con un servicio que **ignora los contratos** y lee un store (`propertyDays`) que **nadie escribe**: imputa el año entero a un piso alquilado. |
| 2 | Fechas · regla | ✅ alineado en el núcleo | `Movement.date` (fecha de cargo) manda en importador, matcheo, saldo, calendario y asignación de ejercicio. `valueDate` se conserva aparte. |
| 2 | Fechas · importador Sabadell | ⚠️ **NO alineado** | La cabecera real `F. Operativa` no está en ningún alias. El parser cae en `date := fecha valor`. **Probado con el fichero real del repo.** En frontera 31/12 mete el recibo en el ejercicio equivocado. |
| 2 | Fechas · saldo persistido | ⚠️ inconsistencia | `recalculateAccountBalance` ordena y corta por `valueDate || date`; el resto de la app usa `date`. |

---

# BLOQUE 1 · TIPOS DE ALQUILER

## 1.1 Qué tipos define el código hoy

### El vocabulario único **[V]**

`services/db/types-alquiler.ts:45`
```ts
export type SubtipoAlquiler = 'larga_estancia' | 'media_estancia' | 'corta_estancia';
```
Los dos predicados que gobiernan todo lo fiscal, `types-alquiler.ts:67-69` y `:77-79`:
```ts
export function reduceElSubtipo(subtipo) { return subtipo === 'larga_estancia'; }
export function esCortaEstancia(subtipo) {
  return normalizarSubtipo(subtipo) === 'media_estancia' || normalizarSubtipo(subtipo) === 'corta_estancia';
}
```
Normalizador de literales viejos (`habitual`, `temporada`, `turistico`, `vacacional`), `types-alquiler.ts:170-180`. Los literales viejos ya no existen en ningún tipo; solo se reconocen en lectura.

### Dónde vive el tipo **[V]**

| Entidad | Campo | Fichero:línea | Valores |
|---|---|---|---|
| Contrato | `modalidad` | `services/db/types-contratos.ts:197` | `SubtipoAlquiler` (obligatorio) |
| Contrato | `unidadTipo` | `types-contratos.ts:192` | `'vivienda' \| 'habitacion'` (forma, no fiscal) |
| Inmueble | `usoTipo` | `services/db/types-inmuebles.ts:144` | `SubtipoAlquiler \| 'mixto' \| 'vivienda_habitual' \| 'disponible'` |
| Inmueble | `modoExplotacion` | `types-inmuebles.ts:170` | `'piso_completo' \| 'por_habitaciones' \| 'mixto'` |
| Inmueble | `explotacion.estadoOperativo` | `types-inmuebles.ts:159` | `'operativo' \| 'en_reforma' \| 'vacante' \| 'uso_propio'` |
| Activo | `tipoActivo` | `types/tipoActivo.ts:12` | `'piso' \| 'parking' \| 'trastero' \| 'local' \| 'otro'` |

Ojo con `usoTipo === 'vivienda_habitual'`: significa **el titular vive ahí** (exento), no «vivienda habitual del inquilino». El que reduce es `larga_estancia` (`types-alquiler.ts:27-31`, comentario; efecto verificado en §1.5).

### Lo que ve el usuario **[V]** · `modules/inmuebles/wizards/SelectorTipoAlquiler.tsx:49-68`

| clave | nombre | nombreFiscal | ayuda |
|---|---|---|---|
| `larga_estancia` | Larga duración | vivienda habitual | Residencia permanente del inquilino |
| `media_estancia` | Media estancia | temporada | 32 días a 11 meses |
| `corta_estancia` | Corta estancia | turístico | 1 a 31 días · licencia + registro de viajeros |

Chip fiscal: `SelectorTipoAlquiler.tsx:127-129` → `reduceElSubtipo(o.clave) ? 'Reduce IRPF' : '0%'`.

## 1.2 Mapa tipo → dos ejes AEAT

| Tipo en código | Eje 1 · naturaleza | Eje 2 · tipo AEAT | ¿Reduce? | Dónde se decide |
|---|---|---|---|---|
| `larga_estancia` | capital_inmobiliario | vivienda_habitual (del inquilino) | **SÍ** 50/60/70/90 | `services/reduccionAlquiler.ts:131-187` |
| `media_estancia` (temporada) | capital_inmobiliario | otros_arrendamientos | **NO** (0 %) | `reduccionAlquiler.ts:109-118` |
| `corta_estancia` (turístico sin servicios) | capital_inmobiliario | otros_arrendamientos | **NO** (0 %) | `reduccionAlquiler.ts:120-129` |
| turístico CON servicios / negocio | actividad_economica | — | fuera de la app | **no existe** (§1.4) |
| `usoTipo = 'vivienda_habitual'` (titular) | exento | — | no imputa | `services/irpfCalculationService.ts:1249-1268` |
| `usoTipo = 'disponible'` / sin contrato | imputación art. 85 | — | imputa | `irpfCalculationService.ts:966-990` |
| `tipoActivo = 'local'` | capital_inmobiliario | otros (el comentario dice «NO reducción») | **[V] no hay rama que lo mire**; depende solo de `modalidad` | `types/tipoActivo.ts:9-12` |

**[V]** Ni `tipoActivo`, ni `unidadTipo`, ni `modoExplotacion` entran en `calcularPorcentajeReduccionContrato`. Solo `modalidad` (`reduccionAlquiler.ts:251-253`). **[D]** Un local dado de alta con `modalidad = 'larga_estancia'` reclamaría el 50 %. El wizard de contrato ofrece una plantilla «Local comercial» (`modules/inmuebles/wizards/NuevoContratoWizard.tsx:573-577`) que hoy solo lanza un toast, sin persistencia.

## 1.3 Check 3 · ¿Funde `actividad_economica` con `otros_arrendamientos`?

**[V] No la funde porque no la modela.** No hay literal `actividad_economica` en ningún tipo de alquiler. El comentario de `types-alquiler.ts:41-42` lo declara («el hospedaje con servicios es otro negocio y no se modela»), y el código lo cumple: el turístico cae en la rama del 0 % y se declara como capital inmobiliario con las mismas casillas que un alquiler ordinario (`fiscalSummaryService.ts:197` → 0102 sin bifurcar por tipo; etiqueta modo V en `modules/fiscal/v2/helpers/inmuebleCasillasService.ts:402-407`: «Se grava como rendimiento de capital inmobiliario»).

Donde SÍ aparece «actividad económica» es OTRA cosa: el autónomo del declarante importado del Modelo 100 (`types/declaracionCompleta.ts:22`, sección D en `modules/fiscal/v2/helpers/ejercicioCasillasService.ts:257-310`) y las rentas atribuidas por entidades (`types/declaracionCompleta.ts:48`).

**[D]** Único rastro de la frontera «con/sin servicios de hospedaje»: la cadena `baseLegal: 'Rendimiento de capital o actividad económica'` en `reduccionAlquiler.ts:126`. No hay campo, ni aviso, ni bloqueo. Alineado con la decisión («va fuera de esta app»), pero sin ninguna señal al usuario de que ese caso no cabe aquí.

## 1.4 Check 4 · ¿Distingue temporada de turístico con consecuencia fiscal?

**[V] No.** Ambos devuelven `porcentaje: 0, motivo: 'sin_reduccion'` (`reduccionAlquiler.ts:109-129`); solo difieren `explicacion` y `baseLegal` (texto). Todo el resto pregunta por el concepto agregado `esCortaEstancia`: modo de declaración (`fiscalSummaryService.ts:566-577`), chip de la tabla (`modules/inmuebles/utils/mapearTipoContrato.ts:13-18`), catálogo de gastos (`modules/inmuebles/wizards/utils/catalogoModalidadInmueble.ts:99-106`).

### El umbral de 31 días **[V]** · `types-alquiler.ts:131-144`
```ts
if (dias <= 31) return 'corta_estancia';
if (dias < 365) return 'media_estancia';
return 'larga_estancia';
```
Único consumidor: `SelectorTipoAlquiler.tsx:81` (preselección + badge). **[V]** Ninguna casilla ni reducción depende de `dias <= 31`; lo persistido es siempre lo que el usuario confirma en `Contract.modalidad`. Correcto: el corte no cambia la fiscalidad.

Dos efectos por duración que NO son fiscales pero conviene conocer:
- `services/contractService.ts:505-512`: un `corta_estancia` de más de 180 días produce un error de validación («no debería exceder los 6 meses»). **[D]** Es una regla de negocio propia, no de Hacienda.
- `modules/inmuebles/wizards/contratoWizardPayload.ts:42-44`: `larga_estancia` autocalcula fecha de fin (+5 años). **[D]** Efecto fiscal INDIRECTO: la fecha de fin alimenta los días arrendados → días vacíos → imputación (§1.6).

### Importación del Modelo 100 **[V]**
El XML solo distingue TAR1 (vivienda) / TAR2 (no vivienda): `services/irpfXmlParserService.ts:575-580` y `:649`. `subtipoDeclarado` (`types-alquiler.ts:160-167`) mapea `vivienda → larga_estancia` y todo lo demás → `media_estancia`. **[D]** TAR2 mezcla temporada, turístico y local; ATLAS elige temporada para todos. Fiscalmente indiferente (0 % en ambos).

## 1.5 Check 6 · La reducción: por contrato y con 50/60/70/90

### Motor único **[V]** · `services/reduccionAlquiler.ts`

| Línea | Rama | % | Condición codificada |
|---|---|---|---|
| 109-118 | `media_estancia` | 0 | — |
| 120-129 | `corta_estancia` | 0 | — |
| 131-141 | firma `< '2023-05-26'` (`VIGENCIA_LEY_VIVIENDA`, `:35`) | **60** | contrato previo a la Ley 12/2023 |
| 145-154 | `zonaTensionada && !primeraVez && rebajaMas5` | **90** | zona tensionada + había contrato anterior + rebaja >5 % |
| 156-168 | `zonaTensionada && primeraVez && joven18a35` | **70** | zona tensionada + primera vez + inquilino 18-35 |
| 170-178 | `rehabilitada2a` | **60** | rehabilitada en los 2 años previos |
| 180-187 | resto de `larga_estancia` | **50** | régimen general |

Entrada por CONTRATO, `reduccionAlquiler.ts:217-248` (`calcularPorcentajeReduccionContrato`): si el contrato tiene `reduccion.activa && porcentaje > 0`, ese % manda (`:222-224`); si no, se propone con `modalidad`, `fechaFirmaContrato ?? firma.fechaFirma ?? fechaInicio`, `primeraVez`, `zonaTensionada`, `inquilinoJoven`, `rebajaRenta5pct`, `rehabilitacion` (`:231-247`). Campos persistidos en `types-contratos.ts:325-350`.

Consumo:
- Motor IRPF, por contrato: `irpfCalculationService.ts:770-786` (`for (const contract of propContracts) … calcularPorcentajeReduccionContrato(contract)`), luego reparto por ingresos en `services/desgloseReduccion.ts:290-296` y aplicación en `irpfCalculationService.ts:909-918`.
- Ficha del inmueble (0149/0150/0154): `fiscalSummaryService.ts:714-716`.
- UI del alta: `modules/inmuebles/wizards/BloqueFiscalContrato.tsx:38-66` (condiciones) y `:185-197` (si el tipo deja de reducir se borra la reducción confirmada).

**Veredicto [V]:** por contrato, no por inmueble; 50/60/70/90 con los cuatro gates de la Ley 12/2023 y el 60 % para contratos previos. Alineado.

### Lo que el manual pide y el código NO comprueba (para saberlo, no es desalineación de regla decidida)
- **NIF del inquilino** (Manual §7.3.1.4): `inquilino.dni` existe (`types-contratos.ts:203`) pero la reducción no lo exige. **[V]** No hay gate por NIF.
- **Joven 18-35**: es un toggle manual (`BloqueFiscalContrato.tsx:145-162`, `alternar()` solo invierte el booleano) aunque la UI dice «De la edad en la ficha del inquilino» (`:52-54`). **[V]**
- Tope de renta art. 17.6 LAU, vigencia de la zona tensionada, prorrateo entre inquilinos: solo como `avisos` de texto (`reduccionAlquiler.ts:88-92`, `:163-166`). **[V]**

### Tres fugas que rompen «por contrato / según reglas» **[V]**
1. **60 % fijo al importar declaraciones** · `services/declaracionOnboardingService.ts:1030`
   ```ts
   reduccion: tieneReduccion ? { activa: true, porcentaje: 60, motivo: 'general_post_2023' as const } : undefined,
   ```
   Escribe 60 con el motivo que en el motor vale 50, y ese 60 queda blindado por `reduccionAlquiler.ts:222` (lo confirmado manda). **[D]** Un contrato importado post-2023 sin condiciones especiales queda al 60 % en vez del 50 %.
2. **Fallback por INMUEBLE del 60 %** · `irpfCalculationService.ts:789-804` lee `fiscalData.porcentaje_reduccion` del inmueble o `CONSTANTES_IRPF.reduccionViviendaHabitual = 0.60` (`:87`). **[D]** Solo se alcanza si todos los contratos `larga_estancia` dieron 0, es decir con datos legacy irreconocibles, pero es el único punto de reducción por propiedad que sobrevive.
3. **Rentila `otro → larga_estancia`** · `services/contractDraftService.ts:90-96` y fallback `return 'larga_estancia'` en `:132`. **[D]** Un contrato etiquetado «otro» reclama reducción por defecto.

## 1.6 Check 5 · Estado temporal · `no_arrendado` e imputación de renta

### Estados que el cálculo entiende **[V]**
- **Arrendado**: días de contratos que solapan el ejercicio (`irpfCalculationService.ts:712-716`).
- **No arrendado (vacío entre inquilinos)**: `diasVacio = diasTotal − diasAlquilado − diasEnObras` (`irpfCalculationService.ts:741`); imputa `VC × (1,1 % | 2 %) × diasVacio/diasTotal` (`:931-937`).
- **A disposición (sin contrato en todo el año)**: rama «fully vacant», misma fórmula (`:966-990`).
- **Vivienda habitual del titular**: excluida del todo (`:692-704` → `filtrarViviendaHabitualDePropiedades`, `:1249-1268`, por `usoTipo === 'vivienda_habitual'` o por referencia catastral).
- **En obras**: `daysUnderRenovation` resta días imputables (`:735-736`). **[D]** No es una regla del enunciado; a contrastar con Hacienda (la imputación solo cesa en construcción o inmueble no susceptible de uso).

Los estados descriptivos `usoTipo = 'disponible'` y `explotacion.estadoOperativo = 'vacante'` **no aparecen** en `irpfCalculationService.ts` ni en `imputacionRentaService.ts` **[V]**; el estado temporal se deriva únicamente de fechas de contrato o de `propertyDays`.

### ⚠️ DESALINEADO · tres formas de contar días, y una que ignora los contratos

| Implementación | Fichero:línea | Fuente de días arrendados | Solapes entre contratos |
|---|---|---|---|
| A · `calcularDiasAlquiladoDesdeContratos` | `irpfCalculationService.ts:572-590` | contratos (o `propertyDays` solo si `manualOverride`, `:722-738`) | **suma sin unir** y recorta a 365 (`:589`) |
| B · `getRentalDaysForYear` | `services/aeatAmortizationService.ts:310-331` | `propertyDays.daysRented` si es número (sin mirar `manualOverride`); si no, contratos | unión correcta vía `services/diasArrendados.ts:55-100` |
| C · `calcularImputacion` | `services/imputacionRentaService.ts:124-140` | **solo `propertyDays`**; sin fila → `diasDisposicion = diasAnio` | no mira contratos |

**[V] Nadie escribe `propertyDays`.** Grep de `propertyDays` en `src/` (excluyendo tests): solo lecturas (`getAllFromIndex`), borrados (`services/inmuebleDeleteService.ts:100,206`) y la definición del store (`services/db.ts:101`, `db/upgrade-a.ts:105-109`). No hay ningún `put`/`add`.

Consecuencias:
- **C alimenta la casilla 0089 de la ficha del inmueble** (`fiscalSummaryService.ts:200-205` → `summary.box0089 = imp.imputacion`; la UI la pinta en `inmuebleCasillasService.ts:52-67`). **[D]** Para ejercicios en curso, todo inmueble con valor catastral muestra imputación de 365 días aunque esté alquilado todo el año. Solo se corrige en ejercicios ya declarados, donde manda el XML (`fiscalSummaryService.ts:671-675`).
- **A (el motor de la declaración) cuenta distinto que la ficha**: con dos habitaciones alquiladas a la vez, A duplica días y recorta a 365 → `diasVacio = 0` → no imputa aunque hubiera huecos. B haría la unión correcta. **[D]** La misma cartera da una imputación en la ficha y otra en la declaración.

**Regla decidida:** «no_arrendado (vacío entre inquilinos) → imputa renta, % del catastral». El motor IRPF (A) la cumple; la ficha (C) no.

---

# BLOQUE 2 · FECHAS

**Regla decidida:** cuando hay dos fechas, manda la **fecha de cargo real** (cuándo aparece ejecutado en el banco), no la fecha valor. Y esa fecha fija el ejercicio.

## 2.1 Check 1 · Qué campo es la fecha «real»

Modelo **[V]** · `services/db/types-movimientos.ts:40-44`
```ts
export interface Movement {
  date: string;       // booking_date in treasury_transactions
  valueDate?: string; // value_date in treasury_transactions
```
Son las únicas dos fechas de negocio del movimiento. `date` es la fecha de cargo/operación; `valueDate` la fecha valor.

### Importador (el vivo) **[V]**
Cadena real: `services/bankStatementOrchestrator.ts:25` importa `BankParserService` de `features/inbox/importers/bankParser.ts` y lo ejecuta en `:205-206`. `services/universalBankImporter/columnRoleDetector.ts` **no está cableado** (solo lo referencian sus propios tests) y `services/treasuryApiService.ts:650-687` es una ruta latente no usada por el import.

- Alias de columnas, `bankParser.ts:11-21`: `valueDate: ['fecha valor','f valor','value date','f. valor','fecha de valor','valor']` · `date: ['fecha','fecha operacion','fecha operación','f operacion','f operación','f. operacion','f. operación','date','fecha mov','fecha movimiento','fecha de operacion','fecha de operación','completed date']`.
- El match es **exacto** sobre texto normalizado (minúsculas, sin acentos, sin puntuación): `bankParser.ts:461` y `:808-818`.
- Fecha primaria: `date` si se reconoció; **si no, cae en `valueDate` sin aviso**: `bankParser.ts:523-528` y `:650`.
- Ambas se conservan: `bankParser.ts:702-713` (`valueDate: valueDate || date`).
- Inserción: `bankStatementOrchestrator.ts:629-639` → `date: isoDate(row.date)`, `valueDate: isoDate(row.valueDate) ?? date`. Filtro de periodo por `m.date` (`:506-518`). Dedupe por `date` (`hashMovement`, `:698-704`).
- Los perfiles por banco (`public/assets/bank-profiles.json`, `services/bankProfilesService.ts:253-254`) solo sirven para **identificar** el banco (`bankParser.ts:193`, `:309` → `detectBank`); **no** deciden columnas.

### Matcheo **[V]** · `services/movementMatchingService.ts:150`
```ts
const daysDiff = Math.abs(daysBetween(movement.date, event.predictedDate));
```
Ventana ±5 días (`:43`), 35 con importe exacto (`:69`). `valueDate` no aparece en el fichero.

## 2.2 Check 2 · Consistencia en toda la app

| Área | Fichero:línea | Campo | Estado |
|---|---|---|---|
| Import + dedupe + filtro periodo | `bankStatementOrchestrator.ts:506-518, 629-639, 698-704` | `date` | ✅ |
| Matcheo | `movementMatchingService.ts:150` | `date` | ✅ |
| Saldo a fecha | `services/accountBalanceService.ts:112-116, 127` | `date` | ✅ |
| Calendario / sesión de extracto / métricas v6 | `modules/tesoreria/v6/extractoSesion.ts:187,229` · `calendarioDias.ts:113,210` · `services/tesoreriaV6Metrics.ts:634-651,782` | `date` | ✅ |
| Tarjetas, previsión, reconciliación | `services/gastoPorTarjeta.ts:150,192,279` · `treasuryForecastService.ts:320,377` · `reconciliarConfirmado.ts:130` · `deterministas/cierreDeterminista.ts:62` | `date` | ✅ |
| Cierre de línea de gasto (ejercicio) | `services/cierreLineaInmueble.ts:197-211` | `date` → `fecha`, `ejercicio`; `valueDate` → `fechaValor` | ✅ |
| Alta de gasto/mejora desde extracto | `services/altaMovimientoService.ts:238, 262, 484-490` | `date` | ✅ |
| **Saldo persistido de la cuenta** | `services/treasuryEventsService.ts:67-71, 88-91` | **`valueDate \|\| date`** | ⚠️ inconsistente |
| Edición de fecha en línea | `services/lineasInmuebleService.ts:148-153` · `treasuryConfirmationService.ts:255, 1035` | pisa `valueDate` con `date` | ⚠️ pierde la fecha valor |

Detalle de la inconsistencia **[V]** · `treasuryEventsService.ts:67-71`:
```ts
const dateA = new Date(a.valueDate || a.date);
const dateB = new Date(b.valueDate || b.date);
```
y corte por apertura en `:88-91`. Este servicio está vivo: lo llama `treasuryConfirmationService.ts:50` en cada confirmación y `treasuryEventsService.ts:207`. **[D]** Un movimiento con valor 31/08 y cargo 02/09 a caballo de `openingBalanceDate` entra o sale del saldo según qué servicio lo calcule. No afecta al ejercicio fiscal, sí al saldo mostrado.

## 2.3 Check 3 · Asignación a ejercicio fiscal y frontera 31/12

### Gastos · fecha de cargo **[V]** · `cierreLineaInmueble.ts:197-211`
```ts
const fecha = String(movimiento.date).slice(0, 10);
return { …, fecha, ejercicio: Number(fecha.slice(0, 4)),
  ...(movimiento.valueDate ? { fechaValor: String(movimiento.valueDate).slice(0, 10) } : {}) };
```
El `ejercicio` sale de `date`, nunca de `valueDate`. `fechaValor` se guarda y **no se lee en ningún cálculo** (solo aparece en `types-inmuebles.ts:497` y en la lista de campos de cierre `cierreLineaInmueble.ts:169`). Test existente: `services/__tests__/cierreLineaInmueble.test.ts:79-90` (cargo 15/03, valor 16/03 → ejercicio 2026, `fechaValor` conservada). **[V] No hay test de frontera 31/12 → 01/01**; la regla está codificada pero no probada en el caso crítico.

Se deduce solo lo que ya ocurrió: `services/gastoDeducible.ts:43-45` (`yaOcurrio`). Suma por casilla filtrada por `ejercicio` de la línea: `services/gastosInmuebleService.ts:60-62, 99-102`.

Otros escritores del `ejercicio` de una línea:
- Facturas OCR / tesorería: `services/documentIngestionService.ts:170, 417` y `treasuryCreationService.ts:217` → `new Date(gasto.fecha_emision).getFullYear()` (**fecha de emisión de factura**). **[D]** Criterio distinto (devengo documental) hasta que la línea se concilia, momento en que `camposDeCierre` la pisa con la fecha de cargo. Una factura emitida el 28/12 y cargada el 03/01 que nunca se concilie quedaría en el año viejo.
- Edición manual de `fecha`: `lineasInmuebleService.ts:81` hace `{ ...existing, ...updates }`; no recalcula `ejercicio`. **[D]** Si el que edita no manda también `ejercicio`, la línea cambia de fecha sin cambiar de año.

### Ingresos · por contrato, no por movimiento **[V]**
`irpfCalculationService.ts:774` y `desgloseReduccion.ts:263-277`: `ingresosIntegros = rentaMensual × meses de solape del contrato con el ejercicio`. La fecha del cobro real no interviene. **[D]** Coherente con la imputación temporal del alquiler (exigibilidad), pero conviene saber que la regla «fecha de cargo» no aplica a los ingresos: una renta de diciembre cobrada el 3 de enero va al año viejo.

### Frontera 31/12 · caso resuelto y caso roto
- **Santander / Unicaja** (cabeceras `FECHA OPERACIÓN`/`FECHA VALOR`, `Fecha de operación`/`Fecha valor`): `date` = operación. Probado (§2.5): op 02/01/2026 · valor 31/12/2025 → `date = 2026-01-02` → ejercicio 2026. ✅ según la regla.
- **Sabadell** (cabeceras `F. Operativa` / `F. Valor`): `f operativa` **no está en ningún alias** (ni `bankParser.ts:16-21` ni el perfil Sabadell del JSON). Solo se reconoce `F. Valor` → `date := valueDate` (`bankParser.ts:523-528`). Probado (§2.5): op 02/01/2026 · valor 31/12/2025 → `date = 2025-12-31` → **ejercicio 2025**. ❌ contra la regla. Mismo hecho económico, dos ejercicios según el banco.

## 2.4 Check 4 · ¿El fichero real trae ambas fechas y se conservan?

Ficheros reales de extractos (raíz del repo), leídos directamente **[V]**. Se identifican solo por banco y formato; no se reproducen nombres de fichero ni textos de movimientos:

| Fichero (banco) | Cabecera | Columnas de fecha | Filas | op ≠ valor |
|---|---|---|---|---|
| ING · csv y xlsx | fila 6/5 | solo `F. VALOR` | — | n/a (una sola fecha) |
| Sabadell · xlsx | fila 9 | `F. Operativa`, `F. Valor` | 27 | **2** |
| Unicaja · xlsx | fila 5 | `Fecha de operación`, `Fecha valor` | 23 | 0 |
| Santander · xlsx | fila 8 | `FECHA OPERACIÓN`, `FECHA VALOR` | 24 | **6** |

Filas discrepantes reales:
```
Santander · op 02/09/2025 · valor 31/08/2025 · cuota de préstamo (×4)
Santander · op 01/09/2025 · valor 31/08/2025 · recibo de seguro
Santander · op 28/08/2025 · valor 27/08/2025 · pago por móvil
Sabadell  · op 29/08/2025 · valor 31/08/2025 · cuota de préstamo
Sabadell  · op 07/07/2025 · valor 05/07/2025 · transferencia recibida
```
Ninguna cruza un 31/12 (los extractos son de julio-septiembre), pero **5 de 8 cruzan un cambio de mes** y el patrón es sistemático en las cuotas de préstamo: operación el primer hábil del mes siguiente, valor el último día del mes anterior. En enero eso es un cambio de ejercicio, y los intereses de préstamo son gasto deducible.

Conservación: sí, `valueDate` se persiste en el movimiento (`bankStatementOrchestrator.ts:639`) y en la línea de gasto como `fechaValor` (`cierreLineaInmueble.ts:210-211`). Se pierde solo al editar la fecha a mano (`lineasInmuebleService.ts:151-152`, `treasuryConfirmationService.ts:1035`).

## 2.5 Prueba empírica (ejecutada, no deducida) **[V]**

Se ejecutó un test temporal contra `BankParserService.detectHeaders` + `parseMovements` con las cabeceras exactas de los cuatro ficheros reales (el test se borró después; el árbol queda limpio). Resultado:

| Cabecera | `detectedColumns` | `date` resultante |
|---|---|---|
| Sabadell `F. Operativa · Concepto · F. Valor · Importe · Saldo` | `{valueDate: 2, date: 2, description: 1, amount: 3, balance: 4}` | **fecha valor** (op 29/08 → `2025-08-31`; op 02/01/2026 → `2025-12-31`) |
| Santander `FECHA OPERACIÓN · FECHA VALOR · …` | `{date: 0, valueDate: 1, …}` | operación (`2025-09-02`, valor `2025-08-31` conservada) |
| Unicaja `Fecha de operación · Fecha valor · …` | `{date: 0, valueDate: 1, …}` | operación (`2026-01-02`, valor `2025-12-31` conservada) |
| ING `F. VALOR · … · IMPORTE (€) · SALDO (€)` | `{valueDate: 0, date: 0, …}` | fecha valor (única fecha disponible; inevitable) |

---

# PUNTOS NO ALINEADOS (lista cerrada)

| # | Regla decidida | Dónde el código la incumple | Gravedad |
|---|---|---|---|
| N1 | Fecha de cargo manda y fija el ejercicio | `features/inbox/importers/bankParser.ts:16-21` no reconoce `F. Operativa` (Sabadell); `:523-528` cae en fecha valor sin aviso | **Alta** · ejercicio equivocado en frontera 31/12 para un banco real del usuario |
| N2 | Vacío entre inquilinos imputa renta (por días) | `services/imputacionRentaService.ts:124-140` ignora contratos; `propertyDays` no lo escribe nadie; alimenta la 0089 de la ficha (`fiscalSummaryService.ts:200-205`) | **Alta** · la ficha imputa 365 días a inmuebles alquilados |
| N3 | Una sola forma de contar días arrendados | `irpfCalculationService.ts:572-590` (suma sin unir) vs `aeatAmortizationService.ts:310-331` + `diasArrendados.ts:55-100` (unión) vs N2 | Media · ficha y declaración discrepan con habitaciones simultáneas |
| N4 | Reducción por contrato según reglas | `declaracionOnboardingService.ts:1030` escribe 60 % fijo con motivo `general_post_2023` (=50 % en el motor) y queda blindado | Media · contratos importados post-2023 al 60 % |
| N5 | Reducción por contrato, no por inmueble | `irpfCalculationService.ts:789-804` fallback 60 % desde `fiscalData` del inmueble | Baja · rama residual |
| N6 | Solo `vivienda_habitual` reduce | `contractDraftService.ts:90-96, 132`: `otro` y cualquier texto no reconocido → `larga_estancia` | Baja · depende de importar Rentila |
| N7 | Fecha de cargo en toda la app | `treasuryEventsService.ts:67-71, 88-91` usa `valueDate \|\| date` para ordenar y cortar el saldo persistido | Baja · afecta al saldo, no al ejercicio |
| N8 | Conservar las dos fechas | `lineasInmuebleService.ts:151-152` y `treasuryConfirmationService.ts:255, 1035` pisan `valueDate` al editar | Baja · pérdida de dato, no de ejercicio |

**Alineado y verificado:** taxonomía de tres subtipos; temporada y turístico al mismo 0 % sin umbral fiscal de días; `actividad_economica` fuera de la app; reducción por contrato con 50/60/70/90 y gates de la Ley 12/2023; vivienda habitual del titular exenta; `Movement.date` como fecha de cargo en importador, matcheo, saldo, calendario y cierre de línea; `ejercicio` derivado de la fecha de cargo con `fechaValor` guardada aparte.

**Huecos de prueba:** no existe test de frontera 31/12 en `cierreLineaInmueble.test.ts` ni test de cabecera Sabadell en `bankParser.detectHeaders.test.ts` (el único test Sabadell, `bankProfileMatcher.test.ts:60-84`, solo comprueba que se identifica el banco, no qué columna acaba en `date`).
