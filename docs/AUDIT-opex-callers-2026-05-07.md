# T-OPEX-INVESTIGATE · Mini-auditoría 3 callers de `opexService`

> Fecha · 2026-05-07 · Solo lectura · NO se ha modificado código.
>
> Predecesor · T-AUDIT-9 mergeada · T-RECONNECT-1 mergeada.
> DB_VERSION = 69 · 40 stores · `opexRules` ELIMINADO en V62.

---

## Punto de partida

`src/services/opexService.ts` es un **stub legacy v62** (Hallazgo 2.A · T-AUDIT-9). Estado real verificado:

- `generateBaseOpexForProperty()` · `console.warn` + return — no escribe nada · `src/services/opexService.ts:15-20`.
- `getOpexRulesForProperty()` · siempre devuelve `[]` · `src/services/opexService.ts:26-28`.
- `saveOpexRule()` · `console.warn` + `return null` — no persiste · `src/services/opexService.ts:33-36`.
- `deleteOpexRule()` · `console.warn` + return — no borra · `src/services/opexService.ts:41-43`.
- `mapCompromisoToOpexRule()` · siempre devuelve `null` · `src/services/opexService.ts:49-51`.
- `getCompromisosForInmueble()` · **única función real** · sí lee de `compromisosRecurrentes` · `src/services/opexService.ts:57-66`.
- `injectContractOpex()` · `console.warn` + return · `src/services/opexService.ts:72-78`.

Re-exporta los tipos `OpexRule, OpexCategory, OpexFrequency, OpexEstacionalidad, ExpenseBusinessType, AsymmetricPayment` desde `db.ts` para preservar la API surface · `src/services/opexService.ts:9`.

Definición vigente del tipo `OpexRule` · `src/services/db.ts:1898-1927` (sigue exportado aunque el store ya no exista en V62 · `src/services/db.ts:2279`).

---

## Caller 1 · `src/modules/horizon/fiscalidad/dashboard/FiscalDashboard.tsx`

**Ámbito** · pantalla `Impuestos` · estado fiscal del ejercicio + tarjeta por inmueble con chips de categorías "registradas / faltantes".

### 1 · Qué función llama

- `getOpexRulesForProperty` · import en `FiscalDashboard.tsx:22`, invocación en `FiscalDashboard.tsx:133`.
- Es la **única** función de `opexService` que utiliza este caller.

### 2 · Qué hace con el resultado

- Almacena el resultado en `opexByInmueble: Record<number, OpexRule[]>` · `FiscalDashboard.tsx:81`.
- Por cada inmueble del ejercicio (`getInmueblesDelEjercicio(selectedYear)`) hace `opexMap[id] = await getOpexRulesForProperty(id)` · `FiscalDashboard.tsx:130-134`.
- En render itera `EXPECTED_CATEGORIES` (Comunidad, IBI, Seguro, Suministros, Amortización, Intereses hipoteca, Reparaciones · `FiscalDashboard.tsx:50-58`) y, para cada inmueble, comprueba `rules.some((r) => r.activo && cat.match(r))` · `FiscalDashboard.tsx:425-427`.
  - Si la categoría está "registrada" → chip neutral con la etiqueta · `FiscalDashboard.tsx:428-438`.
  - Si **no** está registrada → chip ámbar `+ Comunidad` que navega a `/inmuebles/:id/gastos` · `FiscalDashboard.tsx:441-458`.
- Sólo se consulta `r.activo`, `r.categoria` y `r.concepto` (este último con `.toLowerCase().includes(...)` para IBI, hipoteca, reparación) · `FiscalDashboard.tsx:51-57`.
- **No** se consume importe, frecuencia, cuenta ni fechas. Los KPIs de Ingresos / Gastos / Arrastres se calculan a partir de `declaracion` (FiscalContext), no de las reglas opex · `FiscalDashboard.tsx:181-193`.

### 3 · Qué tipo de dato espera realmente

Una **lista de plantillas/compromisos activos por inmueble** · sólo necesita saber si existe al menos un registro de cada categoría fiscal (señalización presencia / ausencia). Es información de **PREVISTO / template** (¿el usuario ha configurado este tipo de gasto recurrente para este inmueble?), no de gasto real.

Bastan tres campos: `activo: boolean`, una `categoria` mapeable al enum de `OpexRule.categoria` (`comunidad | impuesto | seguro | suministro | servicio | gestion | otro`) y un `concepto: string` para los chequeos por substring (IBI, hipoteca, reparación).

### 4 · Fuente de verdad coherente

- **Primaria · `compromisosRecurrentes` con `ambito === 'inmueble'`** · es el catálogo único de compromisos del hogar después de la decisión G-01 · `src/types/compromisosRecurrentes.ts:1-12`. Existe ya un atajo en el propio stub: `getCompromisosForInmueble(propertyId)` · `src/services/opexService.ts:57-66` lee `compromisosRecurrentes` por índice `inmuebleId` y filtra por `ambito === 'inmueble'`.
  - El campo `tipo` (`suministro | suscripcion | seguro | cuota | comunidad | impuesto | otros` · `src/types/compromisosRecurrentes.ts:59-66`) cubre 4 de las 5 categorías que el dashboard necesita (Comunidad, IBI ⊂ impuesto, Seguro, Suministros).
  - El campo `categoria` (string normalizada en `inmueble.opex | inmueble.suministros | inmueble.ibi | inmueble.comunidad | inmueble.seguros | inmueble.gestionAlquiler | inmueble.otros` · `src/types/compromisosRecurrentes.ts:109-116`) es aún más directo.
  - `estado === 'activo'` sustituye al booleano `activo` · `src/types/compromisosRecurrentes.ts:127, 182`.
- **Complementaria para "Reparaciones" e "Intereses hipoteca"** · estas dos categorías **no son compromisos recurrentes habituales**. Las reparaciones se registran como `gastosInmueble` casilla 0106 (`src/services/gastosInmuebleService.ts:5-15`) o como `mejoraActivo` con `tipo='reparacion'` · ver consumo en `InmueblePresupuestoTab.tsx:254-273`. Los intereses de hipoteca viven en `prestamos` y/o se reflejan automáticamente como casilla 0105 vía `aeatClassificationService` (referencia en `operacionFiscalService.ts:7,190`).
- **Amortización** ya está marcada `alwaysRegistered: true` · no requiere fuente · `FiscalDashboard.tsx:55`.

### 5 · Conclusión

El dashboard **no necesita reglas/templates OPEX**: necesita un *flag de presencia* por categoría fiscal por inmueble. La fuente coherente es **`compromisosRecurrentes` filtrado por `inmuebleId` + `ambito='inmueble'` + `estado='activo'`**, mapeando `tipo`/`categoria` a las 4 etiquetas (Comunidad, IBI, Seguro, Suministros). Para Reparaciones conviene además consultar `gastosInmueble` (`casillaAEAT === '0106'`) y/o `mejoraActivo` para evitar falsos negativos. Intereses hipoteca → derivar de `prestamos` o de `gastosInmueble` casilla 0105.

**Impacto del stub vacío hoy**: el dashboard siempre muestra TODAS las categorías como `+ Comunidad / + IBI / …` (botones ámbar "faltante"), independientemente de lo configurado por el usuario · regresión funcional.

---

## Caller 2 · `src/components/inmuebles/InmueblePresupuestoTab.tsx`

> Nota · la ruta indicada en el brief (`src/modules/inmuebles/components/InmueblePresupuestoTab.tsx`) no existe. La ubicación real del archivo es `src/components/inmuebles/InmueblePresupuestoTab.tsx` (verificado con `find src -name 'InmueblePresupuestoTab.tsx'`).

**Ámbito** · pestaña "Presupuesto" dentro de la ficha de un inmueble · vista combinada de gastos previstos (recurrentes), reparaciones, mejoras, mobiliario, gastos reales.

### 1 · Qué funciones llama

- `getOpexRulesForProperty` · `InmueblePresupuestoTab.tsx:32, 238, 241`.
- `generateBaseOpexForProperty` · `InmueblePresupuestoTab.tsx:33, 240`.
- `deleteOpexRule` · `InmueblePresupuestoTab.tsx:34, 475`.
- `saveOpexRule` · `InmueblePresupuestoTab.tsx:35, 497`.

(4 de las 4 funciones CRUD del stub.)

### 2 · Qué hace con el resultado

- Carga inicial · si `getOpexRulesForProperty(propertyId)` devuelve `[]`, llama a `generateBaseOpexForProperty(propertyId)` y vuelve a leer · `InmueblePresupuestoTab.tsx:238-243`. **Con el stub esto se traduce en bucle vacío permanente: nunca habrá reglas que mostrar.**
- Las reglas alimentan la fila "Recurrentes" de la tabla `BudgetExpenseRow` · `InmueblePresupuestoTab.tsx:313-327`. Campos consumidos: `id, categoria, concepto, importeEstimado, frecuencia, mesesCobro, asymmetricPayments, mesInicio, accountId, proveedorNIF, proveedorNombre, businessType, activo` (este último para `annualTotalsByType.recurrente` · `InmueblePresupuestoTab.tsx:640-642`).
- KPI "Presupuesto anual estimado" suma `getAnnualAmount(rule)` sobre reglas activas + reparaciones + mejoras + mobiliario + gastos reales · `InmueblePresupuestoTab.tsx:139-154, 640-650`.
- Edición · al pulsar editar abre `OpexRuleForm` (recurrente) o `oneOffForm` (mobiliario/mejora derivados desde la rule) · `InmueblePresupuestoTab.tsx:393-415`.
- `deleteOpexRule(row.id)` se invoca al eliminar una fila cuyo `source === 'opexRule'` · `InmueblePresupuestoTab.tsx:474-475`.
- `saveOpexRule({...formData, businessType: selectedType})` se invoca al guardar el formulario recurrente · `InmueblePresupuestoTab.tsx:493-497`.
- Adicionalmente combina datos de `operacionFiscal` (casilla 0106 reparación), `mejoraActivo`, `mobiliarioActivo` y `gastosInmueble` · `InmueblePresupuestoTab.tsx:247-273`.

### 3 · Qué tipo de dato espera realmente

CRUD completo de **plantillas / reglas recurrentes** por inmueble (PREVISTO). El formulario captura: importe estimado por ciclo, frecuencia (con sub-tipos `mensual | bimestral | trimestral | semestral | anual | semanal | meses_especificos`), día/mes de cobro, pagos asimétricos, cuenta bancaria, proveedor NIF/nombre, categoría (`comunidad | impuesto | seguro | suministro | servicio | gestion | otro`), `categoryKey`/`subtypeKey`, `casillaAEAT` opcional · `OpexRuleForm.tsx:1-77` y `db.ts:1898-1927`.

Esta forma del dato es **muy parecida** a `CompromisoRecurrente` (alias = concepto · `proveedor.{nombre,nif}` = proveedorNombre/NIF · `patron` = frecuencia + diaCobro/mesInicio/asymmetricPayments · `importe` = importeEstimado · `cuentaCargo` = accountId · `estado` = activo · `categoria` = categoria · `inmuebleId`/`ambito='inmueble'`) pero requiere **un mapping bidireccional** que hoy no existe (`mapCompromisoToOpexRule` también es stub que devuelve `null` · `opexService.ts:49-51`).

### 4 · Fuente de verdad coherente

- **`compromisosRecurrentes` con `ambito='inmueble'`** vía `personal/compromisosRecurrentesService.ts` que ya expone:
  - `listarCompromisos({ ambito: 'inmueble', inmuebleId })` · `compromisosRecurrentesService.ts:38-46`.
  - `crearCompromiso(propuesta)` · valida invariantes y regenera `treasuryEvents` · `compromisosRecurrentesService.ts:57`.
  - `actualizarCompromiso(id, parche)` · `compromisosRecurrentesService.ts:84`.
  - `eliminarCompromiso(id)` · `compromisosRecurrentesService.ts:117`.
  - `puedeCrearCompromiso()` (validación G-01) bloquea la creación de IBI/comunidad/seguro/hipoteca para vivienda habitual · `compromisosRecurrentesService.ts:139-242`.
- Las **reparaciones, mejoras y mobiliario** YA usan stores propios (`operacionFiscal`, `mejoraActivo`, `mobiliarioActivo`, `gastosInmueble`) · este caller ya los lee correctamente y no depende de `opexService` para esa parte · `InmueblePresupuestoTab.tsx:247-273`.

### 5 · Conclusión

Este caller necesita **CRUD real** de plantillas recurrentes (no señalización). La fuente coherente es **`compromisosRecurrentes`** vía `personal/compromisosRecurrentesService` (ya validado, idempotente y con regeneración de eventos de tesorería). Hace falta un **mapping bidireccional `OpexRule ↔ CompromisoRecurrente`** para que el `OpexRuleForm` actual siga funcionando sin reescribir el formulario, **o** sustituir el formulario por uno nativo de `CompromisoRecurrente`.

**Impacto del stub vacío hoy**: la pestaña Presupuesto NO muestra ningún gasto recurrente, NO permite crearlos (botón "Añadir gasto" → "Gasto recurrente" abre `OpexRuleForm`, `saveOpexRule` no persiste · `InmueblePresupuestoTab.tsx:493-505` aparece como "Gasto creado" pero la siguiente recarga devuelve `[]`), NI editar/eliminar los existentes. Las reparaciones/mejoras/mobiliario sí funcionan porque tienen stores propios.

---

## Caller 3 · `src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx`

**Ámbito** · pantalla C · pestaña "Gastos recurrentes" dentro de Gestión de un inmueble · vista CRUD pura de plantillas recurrentes con KPIs.

### 1 · Qué funciones llama

- `getOpexRulesForProperty` · `GastosRecurrentesTab.tsx:9, 171`.
- `deleteOpexRule` · `GastosRecurrentesTab.tsx:9, 217`.
- `saveOpexRule` · `GastosRecurrentesTab.tsx:9, 341`.

(No usa `generateBaseOpexForProperty`.)

### 2 · Qué hace con el resultado

- Carga `setRules(allRules)` · `GastosRecurrentesTab.tsx:166-181`.
- Calcula 4 KPIs · `GastosRecurrentesTab.tsx:197-200, 228-249`:
  - **Plantillas activas** · `activeRules.length`.
  - **Coste anual estimado** · `getAnnualAmount(rule)` sumado · `GastosRecurrentesTab.tsx:55-76, 198`.
  - **Próximo cargo** · `getNextCharge(activeRules)` recorre `frecuencia + diaCobro + mesInicio` · `GastosRecurrentesTab.tsx:108-148`.
  - **Cuentas vinculadas** · `Set(rules.map(r => r.accountId))` · `GastosRecurrentesTab.tsx:200`.
- Renderiza tabla "Plantillas configuradas" con columnas `Categoría · Concepto · Importe · Frecuencia · Cuenta · Acciones` · `GastosRecurrentesTab.tsx:275-318`.
- Editar abre `OpexRuleForm` y al guardar invoca `saveOpexRule(saved)` con `createdAt`/`updatedAt` recompuestos · `GastosRecurrentesTab.tsx:325-352`.
- `deleteOpexRule(rule.id)` previa confirmación · `GastosRecurrentesTab.tsx:212-224`.
- También monta `EjecucionesRecurrentesSection` (sección 2 · PR5.5) que es independiente de `opexService` · `GastosRecurrentesTab.tsx:323`.

### 3 · Qué tipo de dato espera realmente

Idéntico al caller 2: CRUD de **plantillas / reglas recurrentes** por inmueble. Mismos campos consumidos (`activo, categoria, concepto, importeEstimado, frecuencia, diaCobro, mesInicio, mesesCobro, asymmetricPayments, accountId, id`) · `GastosRecurrentesTab.tsx:55-101, 197-211, 287-318`.

Sin reparaciones, mejoras o mobiliario · esta vista **es 100 % "templates recurrentes"**.

### 4 · Fuente de verdad coherente

Misma que caller 2 · **`compromisosRecurrentes`** con `ambito='inmueble'` vía `personal/compromisosRecurrentesService.ts` (`listarCompromisos`, `crearCompromiso`, `actualizarCompromiso`, `eliminarCompromiso`).

### 5 · Conclusión

Este caller es el **caso más limpio** para reconectar con `compromisosRecurrentes`: no se mezcla con gastos reales ni con activos depreciables, y no necesita `generateBaseOpexForProperty` (no llama al stub de inicialización). Necesita el mismo mapping bidireccional `OpexRule ↔ CompromisoRecurrente` que el caller 2.

**Impacto del stub vacío hoy**: KPIs siempre `0 / 0 € / — / 0`, tabla siempre "No hay plantillas. Usa Nueva plantilla para crear la primera.", botones de crear/editar/eliminar no persisten. Misma regresión funcional que caller 2.

---

## Recomendación destino fuente por caller

| # | Caller | Funciones que invoca | Necesita | Fuente recomendada | Lectura | Escritura |
|---|---|---|---|---|---|---|
| 1 | `FiscalDashboard.tsx` | `getOpexRulesForProperty` | Flag de **presencia** de categorías fiscales por inmueble (PREVISTO + indicios de REAL para Reparaciones/Intereses) | `compromisosRecurrentes` (ambito='inmueble', estado='activo') · complementar con `gastosInmueble` (casilla 0106 reparaciones, 0105 intereses) y `prestamos` para hipoteca | `listarCompromisos({ambito:'inmueble', inmuebleId, soloActivos:true})` + `gastosInmuebleService.getByInmuebleYEjercicio()` | — (read-only) |
| 2 | `InmueblePresupuestoTab.tsx` | `getOpexRulesForProperty`, `generateBaseOpexForProperty`, `saveOpexRule`, `deleteOpexRule` | CRUD completo de plantillas recurrentes (PREVISTO) — la parte de reparaciones/mejoras/mobiliario YA usa otros stores y funciona | `compromisosRecurrentes` (ambito='inmueble') | `listarCompromisos({ambito:'inmueble', inmuebleId})` | `crearCompromiso`, `actualizarCompromiso`, `eliminarCompromiso` |
| 3 | `GastosRecurrentesTab.tsx` | `getOpexRulesForProperty`, `saveOpexRule`, `deleteOpexRule` | CRUD puro de plantillas recurrentes (PREVISTO) | `compromisosRecurrentes` (ambito='inmueble') | `listarCompromisos({ambito:'inmueble', inmuebleId})` | `crearCompromiso`, `actualizarCompromiso`, `eliminarCompromiso` |

### Observaciones transversales

1. **Los 3 callers necesitan PREVISTO (templates / compromisos), no REAL confirmado**. Ningún caller suma importes reales ni cierra mes; los gastos reales viven ya en `gastosInmueble` y este último está correctamente desacoplado de `opexService`.
2. **El stub afecta a un cuarto consumidor indirecto** · `operacionFiscalService.generarOperacionesDesdeRecurrentes` (`operacionFiscalService.ts:177-184`) lee `compromisosRecurrentes` correctamente pero pasa por `mapCompromisoToOpexRule` (que devuelve `null`), por lo que el `.map(...).filter(r => r !== null)` siempre resulta `[]`. Esto significa que **la generación de operaciones fiscales recurrentes desde el catálogo también está rota** (regresión silenciosa). No es un caller de `opexService` desde UI pero está fuertemente acoplado al mismo stub. Propuesta · incluir en el alcance de la siguiente tarea junto con los callers 2 y 3.
3. **El formulario `OpexRuleForm`** (`src/components/inmuebles/OpexRuleForm.tsx:1-512`) trabaja con la forma `OpexRule`. Cualquier reconexión exige (a) implementar `mapCompromisoToOpexRule` + un `mapOpexRuleToCompromiso`, **o** (b) reescribir el formulario contra `CompromisoRecurrente`. Opción (a) es menos invasiva y aprovecha la API surface existente.
4. **`generateBaseOpexForProperty`** (caller 2) genera "reglas base a €0" para que el usuario las complete. Equivalente en `compromisosRecurrentes`: **probablemente innecesario** — el modelo nuevo no asume reglas placeholder, y el dashboard fiscal (caller 1) detecta ausencia y propone "+ categoría" desde la UI, que es exactamente la misma intención. Propuesta · marcar `generateBaseOpexForProperty` como deprecated y eliminar el bloque `if (opexRules.length === 0) { await generateBaseOpexForProperty(...) }` del caller 2.

---

## Preguntas pendientes para Jose

1. **Mapping vs reescritura** · ¿prefieres que mantengamos la API `OpexRule*` viva implementando `mapCompromisoToOpexRule` + `mapOpexRuleToCompromiso` y conectándolos al store `compromisosRecurrentes` (mínimo cambio en 3 vistas + `OpexRuleForm` intactos), o reescribir los 3 callers + el formulario para hablar `CompromisoRecurrente` nativo (más limpio, más trabajo, posible cambio de UX)?
2. **Caller 1 (FiscalDashboard)** · ¿basta con considerar "registrada" la categoría si existe un `compromisosRecurrentes` activo, o quieres además marcar como registradas las categorías que tengan al menos un `gastoInmueble` real del ejercicio actual (ej. seguro pagado este año aunque no haya plantilla)? Esto afecta a la lógica de match.
3. **Reparaciones e intereses hipoteca en caller 1** · ¿se aceptan como "registradas" cuando hay (a) cualquier `gastoInmueble` casilla 0106 / 0105 del ejercicio, (b) un `prestamo` activo asociado al inmueble, (c) una `mejoraActivo` con `tipo='reparacion'`? Hoy la heurística era por substring sobre `concepto` de `OpexRule` ("repar", "conserv", "hipoteca", "interés") · `FiscalDashboard.tsx:56-57`.
4. **Eliminar `generateBaseOpexForProperty`** · ¿lo damos por deprecated definitivamente, o necesitas mantener el comportamiento "rellenar fila vacía" en alguna otra vista que no haya entrado en este alcance?
5. **`mapCompromisoToOpexRule` y `operacionFiscalService.generarOperacionesDesdeRecurrentes`** · ¿incluimos la reparación de este flujo (que actualmente no genera nada por el stub) en la misma tarea de reconexión, o lo separamos a una T-OPEX-FISCAL aparte? Propuesta · juntarlas porque comparten el mismo mapping.

---

## Verificación

- 3 callers analizados con las 5 preguntas cada uno · ✅ secciones "Caller 1/2/3".
- Tabla de recomendación de destino fuente · ✅ sección "Recomendación destino fuente por caller".
- Cada afirmación con evidencia `archivo:línea` · ✅.
- No se ha modificado código · ✅ (sólo este documento).
