# T-C-PROY-5 · FASE A · Informe · qué hay y qué falta para el motor de patrimonio a 20 años

> **Tarea** · `TAREA CC · C-PROY-5 · FASE A` · cero código · solo medición con `path:línea`.
> **Fecha** · 2026-07-21 · rama de trabajo `claude/new-session-fnt2cy` (== `main` al inicio).
> **Método** · lectura directa de código + historial de PRs en GitHub (el clon local es superficial: 50 commits).

---

## 0 · Titular · la premisa de la tarea está desactualizada en ambos sentidos

La referencia `docs/audits/T-PROYECCION-AUDIT-INFORME.md:696` dice *"motor 1 año cubierto al 100 % · 19 años faltan"* y pide *"generalizar `proyeccionMensualService` … loop anual sobre 20 años"*. La auditoría posterior `docs/AUDIT-ESTADO-REAL-2026-07.md:363` dice *"No hay motor a 20 años"*. **Las dos afirmaciones son falsas como titular literal:**

- `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:32` → `const PROJECTION_YEARS = 20;`
- `proyeccionMensualService.ts:1024-1038` → bucle `for (let yearIndex = 0; yearIndex < PROJECTION_YEARS; …)` × 12 meses, con caja arrastrada entre años (`:1037`).
- `proyeccionMensualService.ts:620` → cada uno de los 240 meses ya calcula `patrimonioNeto = activos − deudaTotal`, consolidando caja + inmuebles + planes pensión + inversiones − deuda (`:619-620`).

El bucle existe al menos desde marzo 2026: el commit de caché `2972e6b4` (2026-03-23) habla literalmente de *"el bucle 20 años × 12 meses"*. Es **anterior** a las dos auditorías que dicen que falta.

Lo que sí es verdad —y es lo que el titular quería decir— es que **los años 2-20 son una fotocopia plana del año 1**: la mecánica de iterar existe; la dinámica económica año-a-año, no. El detalle está en §1.3.

---

## 1 · Qué existe hoy · cuatro motores parciales, no dos

La tarea menciona dos motores. Hay **cuatro** piezas de proyección vivas, con solapes y cero integración entre ellas.

### 1.1 · `libertadService.proyectarLibertadDesdeRepo` — confirmado

- **Qué proyecta** · renta pasiva mensual vs gasto de vida, mes a mes, y detecta el mes de cruce. Función pura `proyectarRentaPasivaLibertad` (`src/services/libertadService.ts:28-136`) + wrapper que carga del repo (`libertadService.ts:142-176`). **No proyecta patrimonio** — confirmado: la serie es `{isoYM, rentaPasiva, gastosVida, cubierto, pctCobertura}` (`src/types/libertad.ts:126-132`).
- **Horizonte** · `config.horizonteAnios`, default **25 años** (`libertad.ts:49,58`), en meses (`libertadService.ts:44`).
- **Supuestos y su origen**:
  - `SupuestosLibertad` (`libertad.ts:90-99`): `inflacionAnualPct`, `subidaAnualRentasPct`, `subidaAnualGastosVidaPct`. **Parámetro de entrada**, default `SUPUESTOS_NEUTROS_LIBERTAD` = todo 0 (`libertad.ts:101-104`). No hay UI que los persista: quien no pasa nada proyecta sin inflación ni subidas.
  - Config persistida en el `Escenario` activo (`libertadService.ts:146-155`): merge `STANDARD` ← `escenario.libertadConfig` ← override.
  - Datos reales: renta pasiva HOY = alquiler bruto de contratos activos − OPEX del **año en curso** /12 (`libertadService.ts:213-223`) − cuota francesa de préstamos activos (`libertadService.ts:233-238,247-258`). Préstamos variables: **TIN 0 % como aproximación** (`libertadService.ts:189-190,241-245`).
  - Solo implementa `alcanceRentaPasiva='alquiler-neto'` y `reglaCruce='simple'`; el resto lanza error (`libertadService.ts:33-42`).

### 1.2 · `proyeccionActivoService.proyectarInversion` — confirmado

- **Qué proyecta** · valor futuro de **un activo suelto** (plan de pensiones, fondo, depósito…): serie `{ano, valor, aportadoAcumulado}` (`src/services/proyeccionActivoService.ts:56-63`), 3 escenarios + conos. **No consolida** — confirmado: función pura, la caller pasa los inputs de un solo activo (`proyeccionActivoService.ts:210`).
- **Horizonte** · años hasta rescate = `edadObjetivoRescate − edad actual`, fallback **25** si no hay fecha de nacimiento (`proyeccionActivoService.ts:136-149,219`).
- **Supuestos y su origen**:
  - TWR base: `twrHistorico` del activo → si null, benchmark rolling 5a → si tampoco, **2 % constante en código** (`proyeccionActivoService.ts:222`).
  - Conos: **±2 pp constantes en código** (`:275-299`). Escenario máx. aportación: **×3 constante en código** (`:263`).
  - Inflación: input `inflacionAnualAsumida`, que los callers sacan de `Escenario.inflacionAnualAsumida` (`src/types/miPlan.ts:47-50`, default 2 en `src/services/escenariosService.ts:33-34`).
  - Benchmark: configurable por el usuario en Ajustes → Datos de mercado (`src/types/benchmarksReferencia.ts:10-23`, `src/modules/ajustes/pages/DatosMercadoPage.tsx`).
- **Consumidores reales** · 5 bloques de la ficha de Inversiones: `src/modules/inversiones/components/bloques/{BloqueProyeccion,BloqueSandbox,BloqueBenchmark,BloqueCostes,BloqueHitos}.tsx`.

### 1.3 · `proyeccionMensualService.generateProyeccionMensual` — el "motor 1 año" del titular · **ya itera 20 años**

- **Qué proyecta** · `ProyeccionAnual[]` de 20 años × 12 meses (`src/modules/horizon/proyeccion/mensual/types/proyeccionMensual.ts:76-86`), cada mes con bloques `ingresos / gastos / financiacion / tesoreria / patrimonio` (`proyeccionMensual.ts:14-74`). El bloque `patrimonio` incluye `patrimonioNeto` (`proyeccionMensual.ts:64-73`). Integra ~12 servicios reales (nóminas, autónomos, pensiones, contratos, inmuebles, préstamos, inversiones, valoraciones, IRPF, cuentas…) (`proyeccionMensualService.ts:4-25`).
- **Respuesta a la pregunta de la tarea — "¿qué hace ese año que no se puede repetir veinte veces?"**: nada lo impide; **ya se repite veinte veces**. Lo que ocurre es que se repite **plano**. `loadBaseData()` calcula los 12 meses del año base una sola vez (`:690-954`) y `buildMonthRow` los reutiliza para los 240 meses. En concreto:

| Componente | Comportamiento años 2-20 | Evidencia |
|---|---|---|
| Rentas alquiler | Array de 12 meses construido **solo para el año base** (`isContractActiveInMonth(contract, year=START_YEAR, m)`); los contratos **ni vencen ni se renuevan ni se indexan** en años futuros. Comentario literal: *"C. Rentas: flat — no IPC applied"* | `proyeccionMensualService.ts:815-830`, `:471-472` |
| Nóminas | Patrón del año base repetido, *"flat, no growth applied"* | `:413-414`, `:700-717` |
| Gastos operativos (OPEX) | **Siempre 0 los 20 años, incluido el año 1**: `opexRules = []` hardcodeado desde que el store se eliminó en V62; nunca se reconectó a `compromisosRecurrentes` | `:833`, `:528` |
| Gastos personales | Patrón plano sin inflación | `:537-539`, `forecastEngine.ts:188-196` |
| Valor inmuebles | Última valoración conocida ≤ mes, **congelada hacia el futuro**; fallback precio de compra. Cero revalorización | `:578-585`, `:304-332`, `:806-807` |
| Planes pensión / otras inversiones | Valor constante los 20 años (sin rentabilidad compuesta ni aportaciones); solo intereses periódicos hasta `fecha_fin` y liquidaciones puntuales | `:606-617`, `:147-165` |
| **Deuda** | **Real año a año**: usa el cuadro de amortización francés persistido (`PeriodoPago.principalFinal`) → capital pendiente correcto en el año N y cuotas que terminan cuando el préstamo vence | `:592-604`, `:554-566`, `:959-985` |
| **Caja** | **Real**: se arrastra mes a mes los 240 meses | `:575-576`, `:1037` |
| IRPF | Se calcula `calcularDeclaracionIRPF(ejercicio)` para los **20 ejercicios** (`:358-361`), pero los años futuros se calculan sobre los datos que existan para ese ejercicio (contratos filtrados por fecha fin → las rentas fiscales sí mueren con el contrato, mientras el cashflow las mantiene planas: incoherencia interna) | `:349-395`, `src/services/irpfCalculationService.ts:698-699` |

- **Supuestos** · **ninguno configurable**: el motor no acepta parámetros (`generateProyeccionMensual(): Promise<ProyeccionAnual[]>`, `:1006`). El aplanado es una decisión deliberada, no un olvido: commit `fc53a3dd` (2026-02-24) *"Fix forecastEngine: remove inflation/IPC"*.
- **Consumidores** · Previsiones (`ProyeccionMensual.tsx:93`), dashboard (`dashboardService.ts:1179`), informes (`informesDataService.ts:503`), comparativa (`comparativaService.ts:147`), export (`atlasExportService.ts:271`). Caché módulo 3 min (`:987-1000`).

### 1.4 · `proyeccionService` (base) — el cuarto motor que nadie mencionó · 20 años con supuestos configurables pero datos legacy

- `src/modules/horizon/proyeccion/base/services/proyeccionService.ts:169` → bucle `for (let i = 0; i <= 20; i++)` que produce `YearlyProjectionData {year, rentalIncome, operatingExpenses, debtService, netCashflow, propertyValue, netWorth}` (`proyeccionService.ts:14-38`).
- **Aquí es donde viven los supuestos configurables que el motor mensual no tiene**: `BaseAssumptions {rentGrowth, expenseInflation, propertyAppreciation, vacancyRate, referenceRate}` (`proyeccionService.ts:5-12`), defaults 3.5 / 2.5 / 4.0 / 5.0 (`:43-46`), persistidos en `keyval['base-assumptions']`, editables con sliders en `AdjustAssumptionsModal.tsx:83-173`.
- **Pero está desconectado del dato real**: valor base de inmuebles desde `p.purchasePrice` legacy (`:257-260`), contratos por `c.status==='active'` y `c.rentAmount` legacy, `debtService: 0` hardcodeado (`:266`) y reducción de deuda por heurística `debtService * 0.3` (`:178-179`) — ignora el cuadro francés real que sí existe. Vivo en `/proyeccion/escenarios` (`ProyeccionBase.tsx:156-162`, `App.tsx:1183-1184`).

---

## 2 · Los cinco ingredientes · existe / calculable / no existe

| Ingrediente | Veredicto | Detalle con evidencia |
|---|---|---|
| **Valor inmuebles** | **Valor: EXISTE · tasa: solo global desconectada** | Valor de partida: `precio_compra` (`src/types/inmueble.ts:59`), `coste_total_compra` (`:70`), valor catastral (`:76-77`) y valoraciones históricas de mercado en el store `valoracionesActivos` (`src/types/valoracionActivo.ts:29-45`, servicio `valoracionesService.ts`; incluye `esAnchorFiscal` para tasación). Tasa de revalorización: **no existe por inmueble** (el `interface Inmueble`, `inmueble.ts:110-137`, no tiene ningún campo `revaloriz*`); existe **una global** `propertyAppreciation` default 4.0 con slider (`proyeccionService.ts:8,44`, `AdjustAssumptionsModal.tsx:131-133`), pero solo la usa el motor base legacy (§1.4). El motor mensual no aplica ninguna (§1.3). **El usuario no fija hoy ninguna tasa que llegue a un motor con datos reales.** |
| **Deuda** | **EXISTE · el ingrediente más sólido** | Cuadro francés completo: `generatePaymentSchedule(prestamo): PlanPagos` (`src/services/prestamosCalculationService.ts:327`), con carencia/solo-intereses/prorrateo. Cada `PeriodoPago` lleva `principalFinal` = capital pendiente tras la cuota (`src/types/prestamos.ts:264-279`, `:272`). Expuesto vía `prestamosService.getPaymentPlan(id)` (`prestamosService.ts:529`) y auto-generado al crear/editar (`:298-312`). **Sí: el capital pendiente en el año N es lectura directa** — el motor mensual ya lo hace exactamente así (`proyeccionMensualService.ts:592-604`). No hay azúcar `getCapitalPendienteAt(fecha)`, pero es un `find` sobre `fechaCargo`. |
| **Rentas** | **Renta actual: EXISTE · subida: solo supuesto global sin UI en un caso y legacy en otro · vacancia: solo global legacy** | Renta contratada: `Contract.rentaMensual` (`src/services/db/types-contratos.ts:131`), indexación declarada `'none'\|'ipc'\|'irav'\|'otros'` (`:136`) con histórico (`:29-43,144-149`) — el dato de QUÉ índice aplica existe, pero **ningún motor lo usa para proyectar**. Supuesto de subida: `SupuestosLibertad.subidaAnualRentasPct` (`libertad.ts:95`, default 0, sin UI de persistencia) y `rentGrowth` 3.5 del motor base legacy (`proyeccionService.ts:7`). Vacancia: **solo** `vacancyRate` 5.0 global del motor base legacy (`proyeccionService.ts:9,45`, slider `AdjustAssumptionsModal.tsx:152-173`); ni el motor mensual ni libertad modelan vacancia; no existe por contrato ni por inmueble. |
| **Gastos e impuestos** | **NO EXISTE proyección plurianual conectada a dato real** | Gastos operativos: en el motor mensual valen **0** (`proyeccionMensualService.ts:833`); presupuesto/proyección de gastos = 12 meses del año natural (`src/modules/mi-plan/services/budgetProjection.ts:216-252`). Fiscal: `estimacionFiscalEnCursoService` es estrictamente del ejercicio en curso — `calcularEstimacionEnCurso(ejercicio?)` (`estimacionFiscalEnCursoService.ts:191-194`) y su proyección de rentas solo cubre "meses restantes del año" (`:130-160`). **Respuesta a la pregunta de la tarea**: proyectarlo a años futuros no es iterar este servicio: la maquinaria de base (`calcularDeclaracionIRPF(ejercicio)` acepta cualquier ejercicio, y el motor mensual ya la invoca para 20 ejercicios, `proyeccionMensualService.ts:358-361`) existe, pero calcula sobre los datos registrados de cada ejercicio futuro (≈ patrón actual decayendo), sin amortización AEAT futura, sin plusvalías de venta, sin deducciones proyectadas — eso es el motor aparte que la auditoría catalogó como C-PROY-8 (`T-PROYECCION-AUDIT-INFORME.md:725`) y **no existe**. |
| **Tesorería e inversiones** | **Rentabilidad por activo: EXISTE · ahorro anual proyectado: NO EXISTE** | Rentabilidad: TWR histórico por activo + benchmarks configurables (`benchmarksReferencia.ts:10-23`, `DatosMercadoPage.tsx`) + motor por activo (§1.2). Remuneración de cuentas: dato puntual `Account.remuneracion.tinAnual` (`types-contratos.ts:479-486`), no proyectado. **Ahorro anual**: no existe ningún supuesto `ahorroAnualProyectado` ni regla de barrido caja→inversión en `Escenario` (`miPlan.ts:22-53`; `tasaAhorroMinima` en `:38` es un KPI-objetivo, no un input) ni en `SupuestosLibertad`. El motor mensual acumula caja sin remunerar ni invertir; `aportacionAnualEstimada` de `proyectarInversion` la debe pasar la caller a mano (`proyeccionActivoService.ts:28`). |

---

## 3 · C-PROY-1 a C-PROY-4 · qué está mergeado en `main`

Verificado contra PRs de GitHub (el historial local está truncado a 50 commits) y contra el código actual:

| Cable | PR | Estado en `main` | Evidencia en código |
|---|---|---|---|
| **C-PROY-1** limpieza | #1298 · merged 2026-05-08 | ✅ Mergeado, con **1 desviación** | Borrados: `ProyeccionSimulaciones.tsx`, `ProyeccionComparativas.tsx`, `escenarioService.ts` (mock 822 líneas), `PatrimonioHeader.tsx` y huérfanos dashboard — 0 hits en `src/`. **Desviación**: `proyeccion/base/components/ProjectionChart.tsx` pedía borrarse y **sigue vivo y usado** (`ProyeccionBase.tsx:6,161`) — no era huérfano. |
| **C-PROY-1-bis** budgetService | (spec `docs/specs/PR-C-PROY-1-bis-eliminar-budgetService.md`) | ✅ Mergeado completo | `budgetService.ts` eliminado; stub en `comparativaService.ts:6-9`; algoritmos rescatados en `docs/audits/algoritmos-budgetservice-rescate.md`; grep `budgetService` en `src/` = 0 código. Los stores fantasma `budgets`/`budgetLines` nunca existieron en el schema (solo en `STORES_OBSOLETOS`). |
| **C-PROY-2** LibertadPage → servicio real | #1300 · merged 2026-05-08 | ✅ Mergeado completo | `LibertadPage.tsx:14,22` consume `useProyeccionLibertad`; la proyección naive SVG desapareció. |
| **C-PROY-3** matar Math.random | #1303 · merged 2026-05-08 | ✅ Mergeado completo · **PR #1302 duplicado sigue ABIERTO** | `comparativaService.ts:3,147` consume `generateProyeccionMensual`; las 3 ocurrencias `Math.random` no existen; `PresupuestoCalendario.tsx` borrado. Único `Math.random` restante en `proyeccion/` es un UUID (`presupuestoService.ts:9`). ⚠️ `AUDIT-ESTADO-REAL-2026-07.md:363,462` cita el PR #1302 abierto como si el trabajo estuviera pendiente: **es un duplicado de #1303 ya mergeado**. |
| **C-PROY-4** catálogo hitos ampliado | sin PR | ⛔ **Sin empezar** | `Hito.tipo` sigue con los 5 valores originales (`src/types/miPlan.ts:17` y su gemelo `libertad.ts:82`); no existe `EventosCatalogoModal`; sin tipo `'custom'` en `Hito`. |

**Fantasmas a medias**: ninguno nuevo. `budgetMatchingService` (`src/services/`) es huérfano sin imports vivos (solo comentarios `db.ts:205-208`), pero es ajeno al frente proyección. Los servicios de proyección vivos son los cuatro de §1 más `budgetProjection.ts` (Mi Plan, 12 meses, vivo: `LandingPage.tsx:12`, `ProyeccionPage.tsx:8`).

---

## 4 · Dónde tiene que enchufar · tres consumidores, **tres formas distintas**

| Consumidor | Componente | Forma que espera HOY | Estado |
|---|---|---|---|
| **1 · Curva del héroe del Panel** | `src/modules/panel/components/HeroPatrimonio.tsx` (montado en `PanelPage.tsx:445-455`) | `HeroPatrimonioProps` (`HeroPatrimonio.tsx:13-23`): **solo escalares del presente** (`patrimonioNeto`, `activosTotales`, `deudaViva`…). **No existe prop de serie temporal.** | Estado vacío honesto en `HeroPatrimonio.tsx:96-106` ("llegará con el motor de proyección"); el comentario de cabecera (`:1-4`) cita el bloqueo por C-PROY-5. Nota: `TAREA-CC-PANEL-VERSION-C.md` no está en el repo; el informe de su fase A sí (`docs/audits/T-CC-PANEL-VERSION-C-FASE-A-INFORME.md`). |
| **2 · Mi Plan** | `ProyeccionPage.tsx` y `LibertadPage.tsx` | Dos series que **no son patrimonio**: `BudgetProjection` = cashflow 12 meses (`budgetProjection.ts:67-74`, waterfall en `ProyeccionPage.tsx:140-197`) y serie libertad `{isoYM, rentaPasiva}` re-agregada a anual en el SVG (`LibertadPage.tsx:143-153`). | Conectado a dato real, pero **no existe hoy ningún punto de Mi Plan que pinte patrimonio**: sería un consumidor nuevo. |
| **3 · Panel de KPIs** | Ambigüedad resuelta: el `kpiService`/`KpiBuilder` literal es KPIs por inmueble y está stub (store eliminado V62, `kpiService.ts:245-251`) — **no es este**. El panel que sí consume patrimonio 20a es `ProyeccionBase.tsx:108-162` (`/proyeccion/escenarios`): KPI card "Patrimonio neto estimado (20a)" = `projection.netWorth20Y` (`:132-136`) + gráfica `ProjectionChart data={projection.yearlyData}` (`:156-162`). | Espera `BaseProjection` / `YearlyProjectionData[]` (`proyeccionService.ts:14-38`) — **la única forma `{year, netWorth}` anual que ya existe** — pero alimentada hoy por el motor legacy de §1.4 (deuda 0, purchasePrice). |

**Conclusión del apartado**: no piden lo mismo. El único contrato de datos que encaja casi directo con una salida `{año, patrimonio…}` es `YearlyProjectionData` (consumidor 3). El héroe del Panel necesita un prop de serie que hoy no existe, y Mi Plan no tiene superficie de patrimonio. La restricción de la tarea ("el motor debe tener una sola salida y que cada pantalla la lea") es viable pero hoy **nadie comparte tipo**: hay 5 formas de "proyección" circulando (`ProyeccionAnual` mensual, `YearlyProjectionData` anual, `BudgetProjection` 12m, serie libertad, `ProyeccionPunto` por activo).

---

## 5 · Conclusión · cuánto es iterar y cuánto es construir

**La parte "iterar 20 años" que la auditoría dimensionó como el grueso del cable ya está hecha.** `generateProyeccionMensual` produce hoy 20 años consolidados con `patrimonioNeto` mensual, deuda amortizada con cuadro real y caja arrastrada. Sobre esa base:

**Es iterar / reusar lo que ya hay (existe y funciona):**
- Bucle 20 años + consolidación activos−deuda (`proyeccionMensualService.ts:1024`, `:619-620`).
- Deuda año N con cuadro francés real (`:592-604` + `prestamosService.getPaymentPlan`).
- Caja acumulada 240 meses (`:1037`).
- Fontanería IRPF multi-ejercicio (`:349-395`) — la invocación a 20 ejercicios ya existe, aunque el contenido futuro sea pobre.
- Salida tipada `ProyeccionAnual[]` con `patrimonioNetoFinal` anual (`proyeccionMensual.ts:76-86`) — muy cerca de la "una sola salida" que piden los consumidores.
- Patrón de supuestos configurables con UI (sliders de `AdjustAssumptionsModal` + persistencia keyval) — existe como pieza, aunque enchufada al motor equivocado.

**Es construir (no existe, y sin ello la curva de 20 años es una línea plana o falsa):**
1. **Dinámica anual**: aplicar subida de rentas / inflación de gastos / revalorización de inmuebles / rentabilidad de inversiones año a año dentro del motor mensual. Los supuestos existen **dispersos en 3 sitios con defaults contradictorios** (0 neutro en `SupuestosLibertad`; 3.5/2.5/4.0/5.0 en `BaseAssumptions` legacy; 2 de inflación en `Escenario`) y **ninguno llega al motor que tiene los datos reales**. No existe fuente única de supuestos.
2. **Ciclo de vida de contratos multianual**: hoy los contratos ni vencen ni renuevan ni indexan más allá del año base (`:815-830`), pese a que el campo `indexacion` existe por contrato.
3. **Fuente de gastos operativos**: OPEX = 0 hardcodeado desde V62 (`:833`) — esto es un agujero **incluso en el año 1** y contamina cualquier proyección.
4. **Capa fiscal proyectada real**: es C-PROY-8, motor aparte, no existe (confirmado §2).
5. **Regla de ahorro/inversión**: qué hace la caja acumulada (hoy: nada, ni se remunera) — el supuesto no existe en ningún tipo.
6. **Unificación de salida**: adaptar 3 consumidores con 3 formas distintas (prop de serie nuevo en `HeroPatrimonio`, superficie nueva en Mi Plan, sustituir el motor legacy detrás de `ProyeccionBase`).

**Proporción honesta**: el esqueleto (bucle, consolidación, deuda, caja, salida tipada) está construido y es reusable; lo que falta es la economía (supuestos unificados + dinámica anual), una fuente de OPEX, la fiscalidad futura y los adaptadores de salida. La estimación L · 16-24 h de `T-PROYECCION-AUDIT-INFORME.md:696` asumía construir el loop multianual desde el motor de 1 año: el loop ya está, pero el agujero de OPEX y la dispersión de supuestos no estaban dimensionados. El trabajo real es de naturaleza distinta a la descrita en la auditoría, no necesariamente menor.

---

## 6 · Para la lista (hallazgos fuera de alcance, sin abrir trabajo)

1. **PR #1302 abierto** · duplicado de C-PROY-3 ya mergeado en #1303 — cerrar sin mergear. Además `AUDIT-ESTADO-REAL-2026-07.md:363,462` lo cita como trabajo pendiente: corrección documental.
2. **OPEX = 0 en Previsiones/proyección** · `proyeccionMensualService.ts:833` (`opexRules = []` desde V62, nunca reconectado a `compromisosRecurrentes`): la vista Previsiones y todo consumidor de `generateProyeccionMensual` proyectan hoy gastos operativos 0.
3. **KPI "Patrimonio neto estimado (20a)" engañoso hoy** · `ProyeccionBase.tsx:132` muestra `netWorth20Y` de un motor con `debtService: 0` hardcodeado y `purchasePrice` legacy (`proyeccionService.ts:257-266,178-179`).
4. **Dos auditorías contradicen el código** · `T-PROYECCION-AUDIT-INFORME.md:696` ("añadir loop 20 años" — ya existe) y `AUDIT-ESTADO-REAL-2026-07.md:363` ("no hay motor a 20 años" — falso literal). Cualquier planificación de C-PROY-5 que parta de esos textos sin releer el código dimensionará mal.
5. **Incoherencia fiscal-vs-cashflow en años futuros** · el IRPF proyectado respeta el fin de los contratos (`irpfCalculationService.ts:698-699`) mientras el cashflow mantiene la renta plana para siempre (`proyeccionMensualService.ts:471-472`): en años futuros el motor paga impuestos por rentas distintas de las que ingresa.
6. **`libertadService` aproxima préstamos variables a TIN 0 %** (`libertadService.ts:189-190`) → cuota infraestimada → renta pasiva neta sobreestimada en la curva de libertad.
7. **Resto de C-PROY-1**: `ProjectionChart.tsx` no se borró porque estaba vivo — actualizar el registro del cable para que nadie lo "re-limpie".
8. **`Hito.tipo` duplicado en dos tipos gemelos** (`miPlan.ts:17` y `libertad.ts:82`) — cuando C-PROY-4 amplíe el catálogo habrá que tocar ambos o unificar.

---

**STOP.** Fin de la fase A · cero código tocado fuera de este informe.

---

# ANEXO B0 · Verificaciones previas a la fase B (2026-07-22)

> Pedidas por `TAREA CC · C-PROY-5 · FASE B` §B0. Cero código. Limpieza hecha al empezar: **PR #1302 (duplicado de C-PROY-3) cerrado sin mergear.**

## B0.1 · El salario · el sexto supuesto

**Cómo se modela hoy el ingreso personal en el motor mensual:**

- **Nóminas** · `loadBaseData` calcula el neto de cada mes del **año base** con `calcularNetoMesNomina(nomina, mes, year)` y `year = START_YEAR` fijo (`proyeccionMensualService.ts:691,700-717`); `buildMonthRow` repite ese array de 12 los 20 años, *"flat, no growth applied"* (`:413-414`). Varias nóminas activas se suman al mismo array.
- **Autónomo** · entidad completamente aparte (`autonomoService`), estructurada **por negocio**: `fuentesIngreso[]` con `importeEstimado` y `meses` de impacto (`src/types/personal.ts:317-326`), `gastosRecurrentesActividad[]` y `cuotaAutonomos` (`proyeccionMensualService.ts:422-467`). También plano: `FuenteIngreso` no tiene ningún campo de crecimiento.
- **¿Supuesto de subida en algún sitio?** · **No existe hoy** — grep de `subidaSalar|salaryGrowth|incrementoSalarial|crecimientoSalar` en `src/` = 0 resultados. Existió: `FIXED_ASSUMPTIONS.salaryGrowth` (2 % oculto), borrado en PR #326 (ver B0.2).

**¿Distingue las dos fuentes?** Sí, de punta a punta: stores distintos, servicios distintos y filas distintas en la salida (`ingresos.nomina` vs `ingresos.serviciosFreelance` + `gastos.gastosAutonomo`, `proyeccionMensual.ts:18-19,39`). **Dos sliders son viables sin tocar el modelo de datos**; un slider único sería decisión de producto, no limitación técnica.

**Matiz que cambia el diseño del slider de nómina:** la nómina ya tiene mecanismo de subidas **con fecha**: `Nomina.historial[]` con `vigenciaDesde` (`src/types/personal.ts:143,157`; cable C-4). `calcularNetoMesNomina` resuelve el snapshot vigente por mes **si se le pasa el año** — pero el motor congela `year = START_YEAR`, así que una subida ya registrada con vigencia futura hoy **se ignora** en la proyección. Es decir: para nómina, las subidas *conocidas* ya tienen dónde vivir (historial) y el supuesto % anual solo debería cubrir lo *desconocido* a partir del último snapshot; para autónomo no existe mecanismo equivalente y el % anual lo es todo. Argumento a favor de **dos mandos** (o al menos de no aplicar el % de nómina pisando el historial).

## B0.2 · Por qué se quitó la dinámica

Commit `fc53a3dd` = **PR #326**, merged 2026-02-24, titulado *"Remove forecast inflation assumptions and fix loan classification"*. Leído el PR completo, incluida la instrucción original:

- **Se quitó a petición explícita de Jose**, no por error de cálculo: *"ELIMINAR INFLACIÓN/IPC AL 100 % … Los valores proyectados deben ser rígidamente PLANOS … limpia el motor de estas 'asunciones inteligentes'"*.
- **El pecado no era la matemática, era el gobierno**: los crecimientos eran constantes **ocultas y no configurables** — `FIXED_ASSUMPTIONS` con `salaryGrowth` 2 %, `expenseInflation` y `investmentReturn` 4 % aplicado a planes de pensión — que según el propio PR *"producían proyecciones que se alejaban de los valores definidos por el usuario"*. El usuario veía crecer sus planes de pensión un 4 % que nadie había pactado y no podía apagarlo. El mismo PR borró el banner informativo que lo "explicaba".
- (El resto del PR — clasificación hipoteca vs préstamo personal — es ajeno a la dinámica.)

**Lección para B3**: lo vetado no es el crecimiento año a año; es el crecimiento **invisible con default escondido**. Reponer la dinámica exige exactamente lo que impone B1: cada tasa visible, editable y con default declarado en un único sitio. Si B3 introdujera cualquier constante local tipo `FIXED_ASSUMPTIONS`, estaría repitiendo el error que motivó el borrado.

## B0.3 · La vía de OPEX · directa, confirmada

**La vía directa es invocable desde el motor mensual y sirve para 20 años:**

- `expandirPatron(patron, desdeISO, hastaISO): Date[]` (`patronCalendario.ts:121-128`) — horizonte arbitrario: los bucles avanzan hasta `hasta` sin límite de año. Vale `('2026-01-01', '2045-12-31')`.
- `calcularImporte(importe, fecha): number` (`:277-300`) — regla #4, nunca prorratea. ⚠️ el modo `porPago` **lanza excepción** si el mes no está definido (`:294-296`); los consumidores actuales envuelven en try/catch (`compromisosMensual.ts:22-28,53-58`) — el motor deberá hacer lo mismo.
- `aplicarVariacion(base, variacion, fechaInicio, fechaEvento): number` (`:307-349`) — crecimiento **compuesto** `Math.pow(1 + tasa, revisiones)` tanto para `ipcAnual` (`:333`, usa `ultimoIpcAplicado` como tasa) como para `aniversarioContrato` (`:346`).
- `patronCalendario.ts` es un módulo **puro** (importa solo tipos, cero DB) → importable desde `proyeccionMensualService` sin ciclos. Los datos entran por `listarCompromisos({ambito:'inmueble', soloActivos:true})` (`compromisosRecurrentesService.ts:38-50`).
- **Forma que devuelve**: fechas de evento + importe por evento. El motor agrega por mes `YYYY-MM` — exactamente lo que hace `importeRecurrenteEnMes` del Panel (`compromisosMensual.ts:44-60`). Matiz de coherencia entre pantallas: la **fuente y la expansión** son las mismas, pero el colchón del Panel muestra el prorrateo anual /12 (`costeMensualRecurrente`, `:35-41`) mientras el motor debe imputar al mes del evento (regla #4). Mismo euro, dos agregaciones declaradas — no es contradicción, pero conviene decirlo en la UI.

**El adaptador queda prohibido con más motivos de los que contó el sondeo.** `mapCompromisoToOpexRule` (`opexService.ts:249-280`) pierde **cuatro** cosas, no una:
1. **`variacion`** — el objeto de salida (`:261-279`) no la incluye; `OpexRule` no tiene el campo. El IPC/aniversario compuesto se aplana.
2. **`puntual` → anual recurrente** (`:178-185`): una derrama única de 3.000 € se convertiría en 3.000 €/año × 20 años.
3. **Vigencia** — `fechaInicio`/`fechaFin` del compromiso no viajan: un compromiso que termina en 2028 seguiría cobrándose hasta 2045.
4. `mensualDiaRelativo` pierde el día real (`:133-134`) — menor, pero suma.

Para el horizonte de 12 meses de `GastosRecurrentesTab` esas pérdidas eran tolerables; a 20 años, las tres primeras son estructurales. **Confirmado: el motor entra por `listarCompromisos` + `expandirPatron` + `calcularImporte` + `aplicarVariacion`.**

## B0.4 · La incoherencia fiscal-cashflow · NO se corrige sola · se invierte

**Hoy** · el IRPF de ejercicios futuros lee los contratos **de la DB** y hace `renta × meses` recortando por las fechas del contrato en cada ejercicio (`irpfCalculationService.ts:748-756`): respeta vencimientos y usa la `rentaMensual` actual sin indexar. El cashflow del motor mantiene la renta plana para siempre (`proyeccionMensualService.ts:815-830`). Incoherencia actual: **tributa por rentas que deja de ingresar… no; al revés: ingresa rentas por las que deja de tributar** — el cashflow sigue cobrando tras el vencimiento, el fiscal no.

**Tras B3, sin acción explícita, empeora invertida**: B3 hará que el cashflow venza, renueve e indexe contratos **en memoria** (con supuestos de B1). Pero `calcularDeclaracionIRPF` seguirá leyendo la DB cruda: no verá renovaciones simuladas, ni rentas indexadas, ni vacancia. Resultado: el cashflow ingresaría rentas renovadas e indexadas mientras el fiscal tributaría por las de DB, menores y extinguidas al vencer.

**Hace falta algo explícito en B3.** Dos salidas posibles (decisión de diseño, no la tomo aquí):
- **(a)** Inyectar la serie de rentas simulada del motor al cálculo fiscal de ejercicios futuros — implica que `loadIrpfForecastByMonth` (`proyeccionMensualService.ts:349-395`) deje de delegar en `calcularDeclaracionIRPF(ejercicio)` a ciegas y le pase overrides de ingresos inmobiliarios.
- **(b)** Congelar el IRPF proyectado sobre datos DB hasta C-PROY-8 y **declararlo** en la nota honesta de B5 ("la fiscalidad futura no refleja renovaciones ni indexación").

Con (b) la incoherencia persiste pero pasa de silenciosa a declarada; con (a) se paga complejidad en B3 que roza el territorio de C-PROY-8. Lo único inaceptable es no elegir. Dato de alcance: la previsión cubre ejercicios `START_YEAR-1 … +18` y solo eventos `irpf_declaracion` (`proyeccionMensualService.ts:358-361,379-388`).

---

**STOP B0.** Cuatro respuestas listas para validar el orden antes de tocar código.

---

# ANEXO B · CIERRE DE LA FASE B (2026-07-22)

> Fases B1-B5 implementadas y mergeadas en la rama de trabajo. Commits:
> B1 `c32b099` · B2 `46bb07e` · B3 `38f93b6` · B4 `516dbee` · B5 `8025d05`.

## 1 · Qué supuestos quedaron y de dónde lee cada dinámica

Fuente única: `SupuestosProyeccion` (`src/types/supuestosProyeccion.ts`) · persistido como `Escenario.supuestos` (solo lo tocado; defaults visibles) · resuelto por `escenariosService.getSupuestosProyeccion()`. Los tres sitios viejos borrados.

| Supuesto | Default | Quién lo lee |
|---|---|---|
| `revalorizacionInmueblesPct` | 3,0 | patrimonio inmuebles del motor (factor compuesto sobre última valoración) |
| `subidaRentasPct` | 2,5 | `rentasContratosEngine` (default global · el contrato lo sobrescribe: `indexacion='none'` → 0 · legacy `fixed-percentage` → su %) + curva libertad |
| `inflacionGastosPct` | 2,5 | `opexCompromisosEngine` (el compromiso lo sobrescribe con su `variacion`) · gastos personales · gastos actividad autónomo · gastos vida de libertad · deflactor de `proyectarInversion` |
| `vacanciaPct` | 5,0 | renovaciones simuladas de contratos (no aplica mientras el contrato firmado vive · no aplica al lado fiscal · declarado) |
| `rentabilidadAhorroPct` | 2,0 | remuneración mensual de la caja positiva del motor |
| `subidaNominaPct` | 2,0 | nómina por año (compone solo tras el último `vigenciaDesde` del historial) |
| `subidaAutonomoPct` | 2,0 | ingresos de actividad (los gastos de actividad siguen la inflación) |

Coherencia fiscal (B0.4 · opción a): `calcularDeclaracionIRPF` acepta `contratosOverride` y el motor le inyecta los mismos contratos simulados (renovados+indexados) para ejercicios futuros · caché fiscal omitida en lectura y escritura con override.

Quedan planos y declarados (sin supuesto · no se inventa): pensiones, otros ingresos, valor de inversiones/planes de pensión.

## 2 · Cómo cambió cada pantalla

| Pantalla | Cambio |
|---|---|
| **Héroe del Panel** | La mitad derecha pinta la curva real de 20 años (salida canónica · solo lectura · "según tus supuestos de Mi Plan · sin fiscalidad futura"). Sin datos → estado vacío honesto. |
| **Mi Plan · Proyección** | Card "Patrimonio a 20 años" (misma curva) + card "Supuestos de la proyección" con los mandos: 3 de impacto arriba, 4 en segundo plano, sobrescritura por compromiso plegada, nota fiscal. Mover un mando persiste solo lo tocado, invalida caché y recalcula curva y año de libertad en la misma pantalla. |
| **`/proyeccion/escenarios`** | KPI "Patrimonio neto estimado (20a)" y gráfica salen del motor real (deuda con cuadro francés · OPEX de compromisos · dinámica anual). El motor legacy con `debtService: 0` fue **borrado**. Los números cambian de forma visible: era el engaño, no una regresión. |
| **Previsiones** | Fila de gastos operativos poblada (antes 0 los 20 años) con drill-down por inmueble; rentas que vencen/renuevan/indexan (drill-down marca "renovación estimada"); nómina que respeta el historial; flujo y patrimonio en cascada. |
| **KPI cashflow inmuebles del dashboard** | Baja al valor honesto (ahora resta OPEX real). |
| **Curva de libertad (Panel · Landing · LibertadPage)** | Deja de asumir 0 % por defecto: proyecta con los supuestos del Escenario (2,5/2,5 default). El año de cruce se acerca. |
| **No cambiaron** (verificado) | Colchón del Panel (ya leía compromisos directos) · rentabilidad neta de Inmuebles (lee `gastosInmueble` reales del ejercicio). |

## 3 · Para la lista · descubierto y NO tocado

1. **Datos huérfanos** para una pasada de limpieza keyval: `'base-assumptions'`, `'base-projection'`, localStorage `'atlas-proyeccion-base-assumptions'` y el campo persistido `inflacionAnualAsumida` en escenarios existentes (valor custom no migrado · "git es el archivo").
2. **`treasurySyncService:254`** conserva su propio `opexRules = []` — ramal legacy de tesorería; los compromisos llegan por eventos, pero conviene revisar el ramal en su frente.
3. **Indexación en paso anual (enero)**, no en el mes de aniversario de cada contrato — simplificación declarada; afinado si algún contrato lo exige.
4. **`aplicarVariacion` ancla en `fechaInicio`**: un compromiso antiguo con `ipcAnual` e importe ya actualizado puede sobre-inflarse (semántica heredada del generador canónico de eventos · no introducida aquí).
5. **Vacancia solo en renovaciones simuladas** y sin lado fiscal — modelo declarado; si se quiere vacancia estructural (también bajo contrato firmado) es decisión de producto.
6. **Rentabilidad de inversiones/planes en el motor**: sin supuesto en B1 quedan planos; conectar el TWR por activo (motor `proyectarInversion`) al patrimonio consolidado es trabajo nuevo (relacionado con C-PROY del frente inversiones).
7. **Revalorización por inmueble**: frontera explícita de la spec · sigue global.
8. **`atlas-supuestos-proyeccion.html`** citado como referencia visual en la spec **no existe en el repo** — B5 siguió el patrón V5 de Mi Plan.
9. **Rendimiento de los sliders**: cada recálculo con supuestos nuevos recomputa 18 declaraciones IRPF futuras sin caché (correcto pero costoso); si se nota, cachear por hash de supuestos.
10. **HitosVitalesPage** conserva su mando de inflación (misma fuente única · no puede divergir) — decidir si sobra tras B5.
11. **C-PROY-8 (fiscal plurianual)** sigue sin existir y la curva lo declara — la nota está en el panel de supuestos y en el héroe.

**Fin de la fase B.**
